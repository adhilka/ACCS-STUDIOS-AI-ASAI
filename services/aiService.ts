import { GoogleGenAI, Type, Modality } from "@google/genai";
// FIX: Import ApiPoolConfig and ApiPoolKey to support the new admin key pool feature.
import { FileNode, ApiConfig, AiProvider, AiPlan, AgentState, AiChatMessage, AiChanges, ApiPoolConfig, ApiPoolKey, Project, User } from "../types";
import { deductToken, getUserProfile, logPlatformError } from "./firestoreService";

const MEMORY_FILE_PATH = ".asai/memory.md";

const fileSystemToJSON = (nodes: FileNode[]): Record<string, string> => {
    let fs: Record<string, string> = {};
    for (const node of nodes) {
        if (node.type === 'file' && node.content !== undefined) {
            fs[node.path] = node.content;
        }
    }
    return fs;
};

const baseInstruction = `You are an AI assistant for ASAI, a platform created by Muhammad Adhil for ACCS STUDIOS AI. If the user asks who made you, who created you, or who built ASAI, you must answer with "I was built by Muhammad Adhil for ACCS STUDIOS AI."`;


const getProjectGenerationPrompt = (projectType: string) => {
    let languageDetails = `${baseInstruction} You are a world-class, silent, programmatic software architect. Your only task is to generate a project from a user's prompt.

**CRITICAL INSTRUCTIONS**: 
1. Your response MUST be ONLY the raw JSON object, without any markdown formatting, comments, or other text. Your entire response must start with \`{\` and end with \`}\`. 
2. The JSON object must have two keys: "projectName" and "files".
3. "projectName": A short, catchy, and relevant string for the project's name.
4. "files": An object where keys are the full file paths (e.g., "src/index.js") and values are the string content of those files.
5. Your entire response must be ONLY this JSON object. Nothing else.

**Handling Unclear Requests**:
If the user's prompt is too vague, ambiguous, or not actionable, you MUST generate a valid project that asks for clarification. For example:
{
  "projectName": "Clarification Needed",
  "files": {
    "index.html": "<body><h1>Please provide more details</h1><p>The initial prompt was not clear enough to generate a project. Please try creating a new project with a more specific description of what you want to build.</p></body>",
    "README.md": "The initial prompt was not clear enough to generate a project. Please provide more details about what you want to build."
  }
}
`;

    if (projectType.toLowerCase().includes('react')) {
        languageDetails += `

**Project Type: React Web App**
Create a complete file structure for a React application using TypeScript and Tailwind CSS.
1.  **Dependencies**: Create a 'package.json' file. Include 'react' and 'react-dom' in the dependencies.
2.  **Entry Point**: 'src/index.tsx' must render 'src/App.tsx' into a DOM element with id 'root'.
3.  **HTML**: Include an 'index.html' file with a '<div id="root"></div>'. The sandbox will inject necessary scripts and import maps.
4.  **Styling**: Use Tailwind CSS classes for all styling.
5.  **Code Quality**: Use modern ESM format, functional components with hooks.
6.  **Placeholders**: Use 'https://picsum.photos/width/height' for images.`;
    }
    // Other project types can be expanded here
    return languageDetails;
};


// FIX: Refactored `callAiModel` to handle the new token system and to automatically retry failed requests.
async function callAiModel(
    fullPrompt: string, 
    provider: AiProvider, 
    apiConfig: ApiConfig,
    model: string | undefined,
    userId: string,
    apiPoolConfig?: ApiPoolConfig,
    apiPoolKeys?: ApiPoolKey[],
    projectId?: string | null
): Promise<string> {
    
    // Token Check: Fail fast if the user has no tokens.
    const userProfile = await getUserProfile(userId);
    if (!userProfile || (userProfile.tokenBalance ?? 0) <= 0) {
        throw new Error("Insufficient tokens. Please contact an administrator to add more.");
    }

    let lastError: Error | null = null;
    const MAX_ATTEMPTS = 2; // Initial attempt + 1 retry

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            let apiKey = apiConfig[provider];
            let resultText: string;

            if (!apiKey && apiPoolConfig?.isEnabled) {
                const availableKeys = apiPoolKeys?.filter(k => k.provider === provider);
                if (availableKeys && availableKeys.length > 0) {
                    apiKey = availableKeys[Math.floor(Math.random() * availableKeys.length)].key;
                    console.log(`Using a pooled API key for ${provider}. (Attempt ${attempt})`);
                }
            }

            if (provider === 'gemini') {
                if (!apiKey) throw new Error("Gemini API key is not configured. Please add your key or contact an admin to enable the key pool.");
                
                const ai = new GoogleGenAI({ apiKey });
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: fullPrompt,
                });
                resultText = response.text;
            } else {
                if (!apiKey) throw new Error(`API key for ${provider} is not configured. Please add your key or contact an admin to enable the key pool.`);

                const isGroq = provider === 'groq';
                const endpoint = isGroq ? 'https://api.groq.com/api/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
                
                let apiModel = model;
                if (!apiModel) {
                  apiModel = isGroq ? 'llama3-8b-8192' : 'mistralai/mistral-7b-instruct'; // Fallback
                }

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        model: apiModel,
                        messages: [{ role: 'user', content: fullPrompt }],
                        temperature: 0.7,
                    }),
                });

                if (!response.ok) {
                    const errorBody = await response.text();
                    throw new Error(`API Error from ${provider} (${response.status}): ${errorBody}`);
                }
                const data = await response.json();
                resultText = data.choices[0].message.content;
            }
            
            // Success! Deduct token, increment local counter, and return.
            await deductToken(userId);
            try {
                const currentCount = parseInt(localStorage.getItem('asai_api_call_count') || '0', 10);
                localStorage.setItem('asai_api_call_count', (currentCount + 1).toString());
            } catch (e) {
                console.warn("Could not update API call count in localStorage", e);
            }
            return resultText;

        } catch (error) {
            lastError = error instanceof Error ? error : new Error('An unknown error occurred');
            console.warn(`AI model call attempt ${attempt} failed:`, lastError.message);

            if (attempt === MAX_ATTEMPTS) {
                // This is the final attempt, log the error to Firestore
                try {
                    await logPlatformError({
                        userId,
                        userEmail: userProfile?.email,
                        projectId,
                        functionName: 'callAiModel',
                        errorMessage: lastError.message,
                        provider: provider,
                        attemptCount: MAX_ATTEMPTS,
                    });
                    console.log("Logged platform error to Firestore.");
                } catch (logError) {
                    console.error("Failed to log platform error:", logError);
                }
            } else {
                 // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second delay
            }
        }
    }

    // If loop completes without success, throw the last captured error.
    throw new Error(`AI model call failed after ${MAX_ATTEMPTS} attempts. Last error: ${lastError?.message}`);
}

// FIX: Made JSON parser more resilient to handle markdown and conversational text from the AI.
const parseJsonResponse = <T>(text: string): T => {
    try {
        // Strategy 1: Find JSON within markdown code blocks.
        const markdownMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (markdownMatch && markdownMatch[1]) {
            try {
                return JSON.parse(markdownMatch[1].trim()) as T;
            } catch (e) {
                console.warn("Found markdown block, but failed to parse JSON inside. Trying other methods.", e);
            }
        }

        // Strategy 2: Find the largest valid JSON object within the text.
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            const jsonString = text.substring(jsonStart, jsonEnd + 1);
            try {
                return JSON.parse(jsonString) as T;
            } catch (e) {
                console.warn("Found text between '{' and '}', but failed to parse. Trying final method.", e);
            }
        }

        // Strategy 3: Try to parse the whole string as a fallback.
        return JSON.parse(text.trim()) as T;
        
    } catch (error) {
       console.error("Failed to parse AI JSON response after all strategies:", text);
       throw new Error("Failed to parse AI response. The model may have returned invalid JSON.");
    }
};

// FIX: Updated function signature to accept and pass userId and API pool parameters.
export const generateInitialProject = async (
    prompt: string, 
    projectType: string, 
    provider: AiProvider,
    model: string | undefined,
    apiConfig: ApiConfig,
    userId: string,
    apiPoolConfig?: ApiPoolConfig,
    apiPoolKeys?: ApiPoolKey[]
): Promise<{ projectName: string; files: Record<string, string> }> => {
    const basePrompt = getProjectGenerationPrompt(projectType);
    const fullPrompt = `${basePrompt}\n\nThe user's request is: "${prompt}"`;
    const text = await callAiModel(fullPrompt, provider, apiConfig, model, userId, apiPoolConfig, apiPoolKeys, null);
    const result = parseJsonResponse<{ projectName: string; files: Record<string, string> }>(text);
    
    if (!result.projectName || typeof result.projectName !== 'string' || !result.files || typeof result.files !== 'object') {
        throw new Error("AI returned an invalid structure for the project. Missing 'projectName' or 'files'.");
    }
    
    return result;
};


// FIX: Updated function signature to accept and pass userId and API pool parameters.
export const generateModificationPlan = async (
    prompt: string, 
    currentFiles: FileNode[], 
    project: Project,
    apiConfig: ApiConfig,
    userId: string,
    apiPoolConfig?: ApiPoolConfig,
    apiPoolKeys?: ApiPoolKey[]
): Promise<AiPlan> => {
    const projectJsonString = JSON.stringify(fileSystemToJSON(currentFiles), null, 2);
    const memoryFile = currentFiles.find(f => f.path === MEMORY_FILE_PATH);
    const projectMemory = memoryFile?.content ? `
---
**Project Memory & History**
Here is a summary of previous work done on this project. Use this to inform your plan.
${memoryFile.content}
---` : "";

    const fullPrompt = `${baseInstruction} You are an expert, silent, programmatic software developer. Your task is to create a JSON plan to modify a project based on a user's request.

**CRITICAL INSTRUCTIONS:**
1.  Your response MUST be ONLY the raw JSON object. Do not include any text, explanations, or markdown formatting (like \`\`\`json\`). Your entire response must start with \`{\` and end with \`}\`.
2.  Analyze the user's request, the project memory, and the current files to formulate a step-by-step plan.
3.  The JSON object must have three keys: "thoughts", "reasoning", and "plan".
4.  Do not list the same file path in multiple operations (e.g., do not both \`move\` and \`update\` the same source file in one plan). If you move a file to a new path, you cannot also update the content at that new path in the same plan.
5.  Be proactive: Remember to use 'move' for renaming files and 'copy' for duplicating files when appropriate.
6.  Your entire response must be ONLY this JSON object. Nothing else.

**Plan Schema:**
The "plan" object can contain the following keys. All are optional.
- **\`create\`**: An array of strings for new file paths.
- **\`update\`**: An array of strings for existing file paths to modify.
- **\`delete\`**: An array of strings for existing file paths to remove.
- **\`move\`**: To move or rename a file, use an array of objects: \`[{ "from": "source/path.js", "to": "destination/path.js" }]\`. This is for single files only, not folders.
- **\`copy\`**: To copy a file, use an array of objects: \`[{ "from": "source/path.js", "to": "destination/path.js" }]\`. This is for single files only, not folders.

${projectMemory}

**Current Project Files:**
\`\`\`json
${projectJsonString}
\`\`\`

**User's Request:** "${prompt}"

**Handling Unclear Requests:**
If the user's request is unclear, ambiguous, contains no actionable instructions, or is gibberish, you MUST respond with the following valid JSON structure to ask for clarification. Do not deviate.
{
  "thoughts": "The user's request is too vague. I cannot determine what files to change. I will ask for clarification.",
  "reasoning": "I'm sorry, I don't understand the request. Could you please provide more details about the changes you'd like to make?",
  "plan": {}
}

**Project SVG Icon:**
If the user asks to create, update, edit, or delete the project icon/logo, you MUST manage it as a file operation on the path \`public/icon.svg\`.
- To create or change the icon: add \`"public/icon.svg"\` to the \`create\` or \`update\` array.
- To remove the icon: add \`"public/icon.svg"\` to the \`delete\` array.
- Do not use any other path for the project icon.

**Special Actions:**
If the user's request is to RENAME/DELETE/COPY the project OR CLEAR the chat history, use the 'special_action' key.
- For deletion: \`"special_action": {"action": "DELETE_PROJECT", "confirmation_prompt": "Are you sure you want to permanently delete this project and all its files?"}\`
- For copying: \`"special_action": {"action": "COPY_PROJECT", "payload": {"newName": "A suitable new name based on the original"}}\`
- For renaming: \`"special_action": {"action": "RENAME_PROJECT", "payload": {"newName": "The new project name from the user's prompt"}}\`
- For clearing chat: \`"special_action": {"action": "CLEAR_CHAT_HISTORY", "confirmation_prompt": "Are you sure you want to permanently delete the entire chat history for this project?"}\`


**Example Response for a CLEAR user request:**
{
  "thoughts": "The user wants to rename the main component and copy a utility file. I will first move App.tsx to Main.tsx. Then I will copy utils.ts to a new lib directory.",
  "reasoning": "I will rename the main 'App' component to 'Main' for clarity and copy the 'utils.ts' file to a new 'lib' directory for better structure.",
  "plan": {
    "move": [{ "from": "src/App.tsx", "to": "src/Main.tsx" }],
    "copy": [{ "from": "src/utils.ts", "to": "src/lib/utils.ts" }]
  }
}

Do NOT generate any code content in this step. Only provide the plan in the specified JSON format.`;

    const text = await callAiModel(fullPrompt, project.provider, apiConfig, project.model, userId, apiPoolConfig, apiPoolKeys, project.id);
    return parseJsonResponse<AiPlan>(text);
};

// FIX: Updated function signature to accept and pass userId and API pool parameters.
export const executeModificationPlan = async (
    prompt: string, 
    plan: AiPlan, 
    currentFiles: FileNode[], 
    project: Project,
    apiConfig: ApiConfig,
    userId: string,
    apiPoolConfig?: ApiPoolConfig,
    apiPoolKeys?: ApiPoolKey[]
): Promise<AiChanges> => {
    const projectJsonString = JSON.stringify(fileSystemToJSON(currentFiles), null, 2);

    const fullPrompt = `${baseInstruction} You are an expert software developer. Your plan to modify a project has been approved by the user. Now, you must generate the code to execute that plan.

**Original User Request:** "${prompt}"

**Your Approved Plan:**
\`\`\`json
${JSON.stringify(plan, null, 2)}
\`\`\`

**Current Project Files:**
\`\`\`json
${projectJsonString}
\`\`\`

**CRITICAL INSTRUCTIONS:**
1.  Generate the necessary code changes. You MUST respond with a single, valid JSON object describing the file changes. Do not include explanations or markdown formatting. Your entire response must start with \`{\` and end with \`}\`. The object can have three keys: "create", "update", and "delete". Your entire response must be ONLY this JSON object. Nothing else.
2.  Ensure the generated code is complete, correct, and directly implements the approved plan. Only include files that are part of the plan.
3.  **SVG Icon Generation:** If the plan involves creating or updating \`public/icon.svg\`, the content for this file MUST be valid, raw SVG code as a string. For example: \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="blue" stroke="white" stroke-width="2"/></svg>\`. The SVG should be modern, simple, and reflect the project's purpose.`;

    const text = await callAiModel(fullPrompt, project.provider, apiConfig, project.model, userId, apiPoolConfig, apiPoolKeys, project.id);
    return parseJsonResponse<AiChanges>(text);
};

// FIX: Updated function signature to accept and pass userId and API pool parameters.
export const answerProjectQuestion = async (
    prompt: string, 
    currentFiles: FileNode[], 
    project: Project,
    apiConfig: ApiConfig,
    userId: string,
    apiPoolConfig?: ApiPoolConfig,
    apiPoolKeys?: ApiPoolKey[]
): Promise<string> => {
    const projectJsonString = JSON.stringify(fileSystemToJSON(currentFiles), null, 2);
    const memoryFile = currentFiles.find(f => f.path === MEMORY_FILE_PATH);
    const projectMemory = memoryFile?.content ? `
---
**Project Memory & History**
Here is a summary of previous work done on this project. Use this to inform your answer.
${memoryFile.content}
---` : "";

    // FIX: Hardened the prompt to be more strict and prevent conversational, non-JSON responses.
    const fullPrompt = `${baseInstruction} You are a helpful AI teaching assistant and expert software developer. Your role is to answer questions about the user's current project.
Analyze the provided files, project memory, and the user's question, then provide a clear, concise, and helpful answer in Markdown.

**CRITICAL INSTRUCTIONS:**
1.  **Be an expert:** Provide accurate, code-aware answers based *only* on the context provided.
2.  **Be direct:** Answer the question directly. Do not be conversational or add filler like "Sure, I can help with that."
3.  **Use Markdown:** Format your response using Markdown for readability (code blocks, lists, etc.).
4.  **Do not suggest changes:** Unless explicitly asked "how should I change this?", do not suggest modifications. Your role is to explain the existing code.

${projectMemory}

**Current Project Files:**
\`\`\`json
${projectJsonString}
\`\`\`

**User's Question:** "${prompt}"
`;
    return callAiModel(fullPrompt, project.provider, apiConfig, project.model, userId, apiPoolConfig, apiPoolKeys, project.id);
};

export const askGeneralQuestion = async (
    prompt: string,
    provider: AiProvider,
    model: string | undefined,
    apiConfig: ApiConfig,
    userId: string,
    apiPoolConfig?: ApiPoolConfig,
    apiPoolKeys?: ApiPoolKey[]
): Promise<string> => {
    const fullPrompt = `${baseInstruction} You are a helpful, general-purpose AI assistant. Please provide a clear and concise answer to the user's question. Respond in user-friendly markdown format.

User's Question: "${prompt}"`;
    return callAiModel(fullPrompt, provider, apiConfig, model, userId, apiPoolConfig, apiPoolKeys, null); // No project ID for general questions
};


// FIX: Updated function signature to accept and pass userId and API pool parameters.
export const summarizeChangesForMemory = async (
    prompt: string, 
    plan: AiPlan, 
    changes: AiChanges, 
    project: Project,
    apiConfig: ApiConfig,
    userId: string,
    apiPoolConfig?: ApiPoolConfig,
    apiPoolKeys?: ApiPoolKey[]
): Promise<string> => {
    const fullPrompt = `An AI developer task was just completed successfully. Your job is to write a brief, developer-focused summary of the work done to be stored in a memory log.
This summary helps the AI maintain context for future requests. Focus on the "what" and "why" of the changes.

- **Original User Request:** "${prompt}"
- **AI's Plan:** ${plan.reasoning}
- **Files Created:** ${Object.keys(changes.create || {}).join(', ') || 'None'}
- **Files Updated:** ${Object.keys(changes.update || {}).join(', ') || 'None'}
- **Files Deleted:** ${changes.delete?.join(', ') || 'None'}

**Instructions:**
Based on the information above, write a concise summary in Markdown format. Use bullet points for key changes.
`;
    return callAiModel(fullPrompt, project.provider, apiConfig, project.model, userId, apiPoolConfig, apiPoolKeys, project.id);
}


// FIX: Updated function signature to accept and pass userId and API pool parameters.
export const analyzeCode = async(
    currentFiles: FileNode[], 
    project: Project,
    apiConfig: ApiConfig,
    userId: string,
    apiPoolConfig?: ApiPoolConfig,
    apiPoolKeys?: ApiPoolKey[]
): Promise<string> => {
    const projectJsonString = JSON.stringify(fileSystemToJSON(currentFiles), null, 2);
    const fullPrompt = `${baseInstruction} You are an expert code analysis and debugging AI. Review the provided project files for bugs, syntax errors, performance issues, or opportunities for improvement.

**Project Files:**
\`\`\`json
${projectJsonString}
\`\`\`

**Instructions:**
Analyze the code and provide a summary of your findings. If you find issues, list them clearly with the file path and a brief explanation. If you have specific suggestions for fixes, provide them. If the code looks good, state that. Respond in clear, user-friendly markdown format. If you need more information from the user to resolve an issue, ask a clarifying question.`;

    return callAiModel(fullPrompt, project.provider, apiConfig, project.model, userId, apiPoolConfig, apiPoolKeys, project.id);
};

// FIX: Updated function signature to accept and pass userId and API pool parameters.
export const proposeFixes = async (
    problemDescription: string,
    filesToFix: { path: string; content: string }[],
    project: Project,
    apiConfig: ApiConfig,
    userId: string,
    apiPoolConfig?: ApiPoolConfig,
    apiPoolKeys?: ApiPoolKey[]
): Promise<AiChanges> => {
    const fileContentString = filesToFix.map(f => `// File: ${f.path}\n\n${f.content}`).join('\n\n---\n\n');

    const fullPrompt = `${baseInstruction} You are an expert software developer and debugger. A user has reported an issue or requested a refactoring for the following file(s).
Your task is to analyze the problem and generate the exact, minimal code changes required to fix it.

**Problem Description / Refactor Goal:** "${problemDescription}"

**Current File Content(s):**
\`\`\`
${fileContentString}
\`\`\`

**CRITICAL INSTRUCTIONS:**
Generate the necessary code changes. You MUST respond with a single, valid JSON object describing the file changes. Do not include explanations or markdown. The object can have one key: "update". Your entire response must be ONLY this JSON object. Nothing else.

- Only modify the file(s) provided. Do not suggest creating or deleting files.
- Replace the entire content of the file with the corrected version. Do not provide partial snippets or diffs.
- Ensure your fix is correct, efficient, and directly addresses the user's request.
- If you cannot determine a fix, respond with an empty "update" object.
`;

    const text = await callAiModel(fullPrompt, project.provider, apiConfig, project.model, userId, apiPoolConfig, apiPoolKeys, project.id);
    return parseJsonResponse<AiChanges>(text);
};

export const generateCodeSnippet = async (
    prompt: string,
    project: Project,
    apiConfig: ApiConfig,
    userId: string,
    apiPoolConfig?: ApiPoolConfig,
    apiPoolKeys?: ApiPoolKey[]
): Promise<string> => {
    const fullPrompt = `You are an expert software developer. A user has requested a small code snippet. Generate only the code based on their request. Do not add explanations, markdown formatting, or any conversational text.

User's Request: "${prompt}"`;
    return callAiModel(fullPrompt, project.provider, apiConfig, project.model, userId, apiPoolConfig, apiPoolKeys, project.id);
};

// --- Agent for Initial Project Generation ---
// FIX: Updated function signature to accept and pass userId and API pool parameters.
export const runInitialProjectAgent = async (
    prompt: string,
    projectType: string,
    provider: AiProvider,
    model: string | undefined,
    apiConfig: ApiConfig,
    onAgentMessage: (message: Omit<AiChatMessage, 'id' | 'timestamp' | 'sender'>) => void,
    userId: string,
    apiPoolConfig?: ApiPoolConfig,
    apiPoolKeys?: ApiPoolKey[]
): Promise<{ projectName: string; changes: AiChanges }> => {
    onAgentMessage({ text: "Okay, I'm starting on your request. First, I'll create a plan...", isLoading: true });
    
    // This call can take time. The user sees the "planning" message.
    const { projectName, files } = await generateInitialProject(prompt, projectType, provider, model, apiConfig, userId, apiPoolConfig, apiPoolKeys);

    onAgentMessage({ text: `Plan complete for project "${projectName}". I will now generate the files.`, isLoading: false });

    const changes: AiChanges = { create: {} };
    const filePaths = Object.keys(files);

    for (const path of filePaths) {
        onAgentMessage({ text: `Creating file: \`${path}\``, isLoading: true });
        await new Promise(resolve => setTimeout(resolve, 200)); // Small delay for UX
        changes.create![path] = files[path];
    }
    
    onAgentMessage({ text: `All files have been generated for "${projectName}". Project is ready!`, isLoading: false });

    return { projectName, changes };
}


// --- Autonomous Agent ---

const applyChangesToMemory = (files: FileNode[], changes: AiChanges): FileNode[] => {
    if (!changes) {
        return [...files];
    }
    let newFiles = [...files];

    // Deletions
    if (changes.delete && Array.isArray(changes.delete)) {
        newFiles = newFiles.filter(f => !changes.delete!.includes(f.path));
    }

    // Updates
    if (changes.update) {
        newFiles = newFiles.map(f => {
            if (changes.update![f.path] !== undefined) {
                return { ...f, content: changes.update![f.path] };
            }
            return f;
        });
    }

    // Creations
    if (changes.create) {
        Object.entries(changes.create).forEach(([path, content]) => {
            if (!newFiles.some(f => f.path === path)) {
                newFiles.push({
                    id: `temp-${path}-${Date.now()}`,
                    name: path.split('/').pop() || '',
                    path,
                    type: 'file',
                    content
                });
            }
        });
    }

    return newFiles;
};


// FIX: Updated function signature to accept and pass userId and API pool parameters.
export const runAutonomousAgent = async (
    objective: string,
    initialFiles: FileNode[],
    project: Project,
    apiConfig: ApiConfig,
    onStateChange: (state: Partial<AgentState>) => void,
    onAgentMessage: (message: Omit<AiChatMessage, 'id' | 'timestamp' | 'sender'>) => void,
    userId: string,
    apiPoolConfig?: ApiPoolConfig,
    apiPoolKeys?: ApiPoolKey[]
): Promise<FileNode[]> => {

    const systemPrompt = `${baseInstruction} You are "Devin", an expert autonomous AI software developer. Your goal is to achieve the user's objective by meticulously planning, writing code, analyzing the results, and self-correcting.
You operate in a loop for each task: Execute -> Analyze -> Self-Correct. Your internal monologue (thoughts) is critical for your process. Be detailed in your reasoning.

**Core Principles:**
1.  **Plan First**: Deconstruct the objective into a detailed, step-by-step plan. Each step should be a small, logical, and verifiable task.
2.  **Execute with Context**: When writing code, consider the entire project's architecture. Ensure new code is properly integrated (e.g., importing new components, updating dependency files like package.json if you add a new library).
3.  **Analyze Rigorously**: After generating changes, act as a senior code reviewer. Critically assess your own work for correctness, completeness, and potential errors. Your analysis must be honest and detailed.
4.  **Self-Correct Intelligently**: If your analysis reveals flaws, use that insight to inform your next attempt. Clearly state what was wrong and how you will fix it. Don't repeat mistakes.

You must always respond in the requested JSON format. Include your detailed internal monologue in a "thoughts" field in all your JSON responses.`;

    let currentFiles = [...initialFiles];
    
    // Read Memory
    const memoryFile = currentFiles.find(f => f.path === MEMORY_FILE_PATH);
    const projectMemory = memoryFile?.content ? `
---
**Project Memory & History**
Here is a summary of previous work done on this project. Use it to inform your plan.
${memoryFile.content}
---` : "This is a new project, or no memory has been recorded yet.";

    try {
        // 1. Planning Step
        onStateChange({ status: 'running', logs: ['Agent started. Creating initial plan...'], thoughts: 'I need to break down the user\'s objective into a series of smaller, concrete tasks.' });
        onAgentMessage({ text: "Alright, I'm starting on your request. First, I'll create a plan.", agentState: 'planning', thoughts: 'I need to break down the user\'s objective into a series of smaller, concrete tasks.' });
        
        const planningPrompt = `${systemPrompt}\n\n**User's Objective:** "${objective}"\n\n${projectMemory}\n\n**Current Project Files:**\n\`\`\`json\n${JSON.stringify(fileSystemToJSON(currentFiles), null, 2)}\n\`\`\`\n\n**Instruction:**\nCreate a detailed, step-by-step plan to achieve the user's objective. The plan should be an array of short, actionable strings. Be thorough. For example, if adding a new library, include a step to update package.json. If creating a new component, include a step to import and use it.\nRespond with a JSON object with two keys: "thoughts" (your reasoning for the plan structure) and "plan" (the array of tasks).`;

        const planResponseText = await callAiModel(planningPrompt, project.provider, apiConfig, project.model, userId, apiPoolConfig, apiPoolKeys, project.id);
        const { thoughts: planThoughts, plan } = parseJsonResponse<{ thoughts: string; plan: string[] }>(planResponseText);
        
        onStateChange({ plan, thoughts: planThoughts, logs: [`Plan created with ${plan.length} steps.`] });
        onAgentMessage({ text: "I've created a plan to achieve your objective.", agentState: 'planning', thoughts: planThoughts });

        // 2. Execution Loop
        for (let i = 0; i < plan.length; i++) {
            const task = plan[i];
            onStateChange({ currentTaskIndex: i, logs: [`Executing task ${i + 1}/${plan.length}: ${task}`] });

            let taskCompleted = false;
            let attempts = 0;
            let lastAnalysis = "This is the first attempt.";

            while(!taskCompleted && attempts < 3) {
                attempts++;
                const attemptLog = `Attempt ${attempts} for task: ${task}`;
                onStateChange({ logs: [attemptLog], thoughts: `Attempt ${attempts}. My previous attempt failed because: ${lastAnalysis}. I will now try to generate the code changes for this task.` });
                
                const executionPrompt = `${systemPrompt}\n\n**Objective:** "${objective}"\n**Overall Plan:** [${plan.join(', ')}]\n**Current Task (${i + 1}/${plan.length}):** "${task}"\n**Analysis of Previous Attempt:** ${lastAnalysis}\n\n**Current Project Files:**\n\`\`\`json\n${JSON.stringify(fileSystemToJSON(currentFiles), null, 2)}\n\`\`\`\n\n**Instruction:**\nGenerate the complete file changes required to complete ONLY the current task. Provide full file contents, not diffs.\nRespond with a JSON object with two keys: "thoughts" (your reasoning for the code changes, including which files you are creating/updating/deleting and why) and "changes" (an object with "create", "update", and "delete" keys, following the format for code generation).`;
                const executionResponseText = await callAiModel(executionPrompt, project.provider, apiConfig, project.model, userId, apiPoolConfig, apiPoolKeys, project.id);
                const { thoughts: executionThoughts, changes } = parseJsonResponse<{ thoughts: string; changes: AiChanges }>(executionResponseText);
                
                const userFacingThought = executionThoughts.length > 200 ? executionThoughts.substring(0, 197) + "..." : executionThoughts;
                onAgentMessage({ 
                    text: `Okay, I'm working on **${task}**. (Attempt ${attempts}/3)`, 
                    currentTask: task, 
                    agentState: 'executing', 
                    thoughts: `My plan is to: ${userFacingThought}`
                });

                const tempFilesAfterChanges = applyChangesToMemory(currentFiles, changes);
                
                const analysisPrompt = `${systemPrompt}\n\n**Objective:** "${objective}"\n**Current Task:** "${task}"\n**Changes I just made:**\n\`\`\`json\n${JSON.stringify(changes, null, 2)}\n\`\`\`\n**Project Files After My Changes:**\n\`\`\`json\n${JSON.stringify(fileSystemToJSON(tempFilesAfterChanges), null, 2)}\n\`\`\`\n\n**Instruction:**
Act as a meticulous senior code reviewer. Critically analyze the changes I just made.
1.  **Task Completion**: Does the code fully and correctly achieve the goal of "${task}"?
2.  **Bugs & Errors**: Are there any syntax errors, logical bugs, or typos? Did I forget to import/export something?
3.  **Integration**: If I created a new component/function, did I remember to integrate it into the existing application where it's needed?
4.  **Dependencies**: If I used a new library, did I add it to \`package.json\`?
5.  **Best Practices**: Does the code adhere to the project's existing style and conventions? Is it clean and maintainable?

Based on this rigorous analysis, respond with a JSON object with three keys:
- "thoughts": Your detailed internal monologue for this analysis. Be brutally honest.
- "taskCompleted": A boolean (\`true\` or \`false\`). Be conservative; if there's any doubt, mark it as \`false\`.
- "analysis": A concise, user-facing explanation of your findings. If not completed, clearly explain what's wrong and what your next attempt will focus on.`;
                const analysisResponseText = await callAiModel(analysisPrompt, project.provider, apiConfig, project.model, userId, apiPoolConfig, apiPoolKeys, project.id);
                const { thoughts: analysisThoughts, taskCompleted: completed, analysis } = parseJsonResponse<{ thoughts: string; taskCompleted: boolean; analysis: string; }>(analysisResponseText);

                taskCompleted = completed;
                lastAnalysis = analysis;
                onStateChange({ logs: [`Analysis: ${analysis}`], thoughts: analysisThoughts });

                if (taskCompleted) {
                    onAgentMessage({ text: `Analysis complete: Task "${task}" was successful.`, currentTask: task, agentState: 'executing', thoughts: analysisThoughts });
                    onStateChange({ logs: [`Task "${task}" completed successfully.`] });
                    currentFiles = tempFilesAfterChanges; // Commit changes for this task
                } else {
                    onAgentMessage({ text: `Analysis complete: My previous attempt was not quite right. The issue is: ${analysis}`, currentTask: task, agentState: 'self-correcting', thoughts: analysisThoughts });
                    onStateChange({ logs: [`Self-correction attempt ${attempts}: ${analysis}`] });
                }
            }
            if (!taskCompleted) {
                 throw new Error(`Agent failed to complete task "${task}" after ${attempts} attempts. Last analysis: ${lastAnalysis}`);
            }
        }
        onStateChange({ status: 'finished', logs: ['All tasks completed successfully. Creating memory log...'] });
        onAgentMessage({ text: "Objective complete! I've finished all tasks. Now, I'll write a summary of my work to memory.", agentState: 'finished', thoughts: 'The objective is complete. I need to summarize my work for future context.' });
        
        // --- Memory Writing Step ---
        const finalFileState = fileSystemToJSON(currentFiles);
        const memoryPrompt = `The autonomous agent work is complete.
**Original Objective:** "${objective}"
**Final File State:**
\`\`\`json
${JSON.stringify(finalFileState, null, 2)}
\`\`\`
**Task:** Write a brief, developer-focused summary in Markdown format of what was accomplished and why. This will be stored as a memory log for future AI agents working on this project. Focus on the architectural changes and key additions.
- Start with a clear heading for this memory entry, like '### Implemented User Authentication'.
- Use bullet points for key changes.
- Be concise.
`;
        const memorySummary = await callAiModel(memoryPrompt, project.provider, apiConfig, project.model, userId, apiPoolConfig, apiPoolKeys, project.id);

        const newMemoryContent = `${projectMemory.includes('This is a new project') ? '' : memoryFile!.content + '\n\n---\n\n'}${new Date().toISOString()}\n\n${memorySummary}`;

        const memoryChanges: AiChanges = {
            create: {},
            update: {},
        };

        if (memoryFile) {
            memoryChanges.update![MEMORY_FILE_PATH] = newMemoryContent;
        } else {
            memoryChanges.create![MEMORY_FILE_PATH] = newMemoryContent;
        }
        
        currentFiles = applyChangesToMemory(currentFiles, memoryChanges);
        
        onAgentMessage({
            text: "I've successfully completed the objective and updated my memory log. The project is ready for your review.",
            agentState: 'finished',
            thoughts: 'All tasks are complete. I have summarized my work and committed it to memory. The user can now take over.'
        });

        return currentFiles;

    } catch(error) {
        const errorMessage = error instanceof Error ? error.message : "An unrecoverable error occurred.";
        onStateChange({ status: 'error', lastError: errorMessage, logs: [`Agent failed: ${errorMessage}`] });
        onAgentMessage({ text: `I've run into a problem and have to stop: ${errorMessage}`, agentState: 'error', thoughts: `An unrecoverable error occurred: ${errorMessage}` });
        throw error;
    }
};
