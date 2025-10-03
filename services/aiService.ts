import { GoogleGenAI, Type, Modality } from "@google/genai";
// FIX: Import ApiPoolConfig and ApiPoolKey to support the new admin key pool feature.
import { FileNode, ApiConfig, AiProvider, AiPlan, AgentState, AiChatMessage, AiChanges, ApiPoolConfig, ApiPoolKey, Project, User, AiGodModeAction } from "../types";
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
                const endpoint = isGroq ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
                
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

// FIX: Implemented a self-correction mechanism to handle malformed JSON responses from the AI.
const parseJsonResponse = async <T>(
    text: string,
    provider: AiProvider, 
    apiConfig: ApiConfig,
    model: string | undefined,
    userId: string,
    apiPoolConfig?: ApiPoolConfig,
    apiPoolKeys?: ApiPoolKey[],
    projectId?: string | null
): Promise<T> => {
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

        // Strategy 2: Find the largest valid JSON object or array within the text.
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}');
        const arrayStart = text.indexOf('[');
        const arrayEnd = text.lastIndexOf(']');

        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
             const jsonString = text.substring(jsonStart, jsonEnd + 1);
            try {
                return JSON.parse(jsonString) as T;
            } catch (e) {
                console.warn("Found text between '{' and '}', but failed to parse. Trying array.", e);
            }
        }
        
        if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
             const jsonString = text.substring(arrayStart, arrayEnd + 1);
            try {
                return JSON.parse(jsonString) as T;
            } catch (e) {
                console.warn("Found text between '[' and ']', but failed to parse. Trying final method.", e);
            }
        }

        // Strategy 3: Try to parse the whole string as a fallback.
        return JSON.parse(text.trim()) as T;
        
    } catch (initialError) {
       console.warn("Initial JSON parsing failed. Attempting self-correction.", { originalText: text });

        const correctionPrompt = `The following response was expected to be a valid JSON object or array, but it failed to parse. Please analyze the text, correct any errors (like missing brackets, trailing commas, or extraneous text), and return ONLY the raw, valid JSON. Do not include any explanations, markdown, or apologies in your response.

--- INVALID TEXT ---
${text}
--- END OF INVALID TEXT ---

Return only the corrected JSON.`;
        
        try {
            // Use a reliable provider for correction.
            const correctedText = await callAiModel(
                correctionPrompt, 
                'gemini',
                apiConfig,
                'gemini-2.5-flash',
                userId,
                apiPoolConfig,
                apiPoolKeys,
                projectId
            );

            // Try parsing the corrected text. If this fails, we give up.
            return JSON.parse(correctedText.trim()) as T;
        } catch (correctionError) {
            console.error("Self-correction also failed. The AI response is unrecoverable.", { initialText: text, correctionError });
            throw new Error(`Failed to parse AI response, and self-correction also failed. The AI may have returned malformed text that could not be recovered.`);
        }
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
    const result = await parseJsonResponse<{ projectName: string; files: Record<string, string> }>(
        text, provider, apiConfig, model, userId, apiPoolConfig, apiPoolKeys, null
    );
    
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
  "reasoning": "I will rename the main 'App' component to 'Main' for clarity and copy the utility functions to a shared 'lib' folder for better organization.",
  "plan": {
    "move": [{ "from": "src/App.tsx", "to": "src/Main.tsx" }],
    "copy": [{ "from": "src/utils.ts", "to": "src/lib/utils.ts" }]
  }
}
`;
    const text = await callAiModel(fullPrompt, project.provider, apiConfig, project.model, userId, apiPoolConfig, apiPoolKeys, project.id);
    return await parseJsonResponse<AiPlan>(text, project.provider, apiConfig, project.model, userId, apiPoolConfig, apiPoolKeys, project.id);
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
    const changes: AiChanges = {
        create: {},
        update: {},
        delete: plan.plan.delete || [],
        move: plan.plan.move || [],
        copy: plan.plan.copy || [],
    };
    
    const allFilesToCreate = [...(plan.plan.create || []), ...(plan.plan.update || [])];

    if (allFilesToCreate.length > 0) {
        const currentFilesJsonString = JSON.stringify(fileSystemToJSON(currentFiles), null, 2);
        
        const fullPrompt = `${baseInstruction} You are an expert, silent, programmatic software developer. Your task is to generate the code for a set of files based on a user's request and an execution plan.

**CRITICAL INSTRUCTIONS:**
1.  Your response MUST be ONLY the raw JSON object. Do not include any text, explanations, or markdown formatting. Your entire response must start with \`{\` and end with \`}\`.
2.  The JSON object keys MUST be the full file paths (e.g., "src/components/Button.tsx").
3.  The JSON object values MUST be the complete, new string content for those files.
4.  ONLY generate content for the files listed in the "Files to Generate" section below. Do NOT generate content for any other files.
5.  If a file exists, you MUST provide its full new content. Do not provide diffs or partial code.
6.  If you are updating the project icon at \`public/icon.svg\`, you must generate the complete XML content for a valid SVG file.

**User's Request:** "${prompt}"

**Execution Plan:**
\`\`\`json
${JSON.stringify(plan, null, 2)}
\`\`\`

**Current Project Files (for context):**
\`\`\`json
${currentFilesJsonString}
\`\`\`

**Files to Generate:**
${allFilesToCreate.join('\n')}
`;
        
        const text = await callAiModel(fullPrompt, project.provider, apiConfig, project.model, userId, apiPoolConfig, apiPoolKeys, project.id);
        const generatedFiles = await parseJsonResponse<Record<string, string>>(
            text, project.provider, apiConfig, project.model, userId, apiPoolConfig, apiPoolKeys, project.id
        );
        
        for(const path of (plan.plan.create || [])) {
            if (generatedFiles[path] !== undefined) {
                changes.create![path] = generatedFiles[path];
            }
        }
        for(const path of (plan.plan.update || [])) {
            if (generatedFiles[path] !== undefined) {
                changes.update![path] = generatedFiles[path];
            }
        }
    }
    
    return changes;
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
    
    const changesSummary = `
- Created: ${changes.create ? Object.keys(changes.create).join(', ') : 'None'}
- Updated: ${changes.update ? Object.keys(changes.update).join(', ') : 'None'}
- Deleted: ${changes.delete && Array.isArray(changes.delete) && changes.delete.length > 0 ? changes.delete.join(', ') : 'None'}
- Moved: ${changes.move ? changes.move.map(m => `${m.from} -> ${m.to}`).join(', ') : 'None'}
- Copied: ${changes.copy ? changes.copy.map(c => `${c.from} -> ${c.to}`).join(', ') : 'None'}
    `.trim();

    const fullPrompt = `${baseInstruction} You are an AI project manager. Your task is to write a concise, one-paragraph summary of the work that was just completed.

**User's Request:** "${prompt}"

**AI's Reasoning:** "${plan.reasoning}"

**File Changes Made:**
${changesSummary}

Based on the information above, write a brief, one-paragraph summary for the project's memory log. Focus on the user's intent and the outcome.`;

    const text = await callAiModel(fullPrompt, project.provider, apiConfig, project.model, userId, apiPoolConfig, apiPoolKeys, project.id);
    return text.trim();
};

// FIX: Updated function signature to accept and pass userId and API pool parameters.
export const analyzeCode = async (
    files: FileNode[],
    project: Project,
    apiConfig: ApiConfig,
    userId: string,
    apiPoolConfig?: ApiPoolConfig,
    apiPoolKeys?: ApiPoolKey[]
): Promise<string> => {
    const projectJsonString = JSON.stringify(fileSystemToJSON(files), null, 2);
    const fullPrompt = `${baseInstruction} You are a world-class software architect and code reviewer. Analyze the following project files and provide a comprehensive summary of potential bugs, areas for improvement, and ways to adhere to best practices. Structure your response in clear markdown format.

**Project Files:**
\`\`\`json
${projectJsonString}
\`\`\`
`;
    return callAiModel(fullPrompt, project.provider, apiConfig, project.model, userId, apiPoolConfig, apiPoolKeys, project.id);
};

// FIX: Updated function signature to accept and pass userId and API pool parameters.
export const proposeFixes = async (
    description: string,
    filesToFix: { path: string, content: string }[],
    project: Project,
    apiConfig: ApiConfig,
    userId: string,
    apiPoolConfig?: ApiPoolConfig,
    apiPoolKeys?: ApiPoolKey[]
): Promise<AiChanges> => {
    const filesJsonString = JSON.stringify(Object.fromEntries(filesToFix.map(f => [f.path, f.content])), null, 2);
    const fullPrompt = `${baseInstruction} You are an expert programmer tasked with fixing a bug or refactoring code. Based on the user's description and the provided files, generate the complete, new content for the file(s) that need to be changed.

**CRITICAL INSTRUCTIONS:**
1. Your response MUST be ONLY the raw JSON object. Do not include any markdown or other text.
2. The JSON object must have one key: "update".
3. The value of "update" must be another object where keys are the full file paths and values are the complete, new file content.
4. Only include files that you are actually changing.
5. If you cannot determine a fix, respond with an empty "update" object: \`{"update": {}}\`.

**Problem Description:** "${description}"

**Files to Analyze/Fix:**
\`\`\`json
${filesJsonString}
\`\`\`
`;
    const text = await callAiModel(fullPrompt, project.provider, apiConfig, project.model, userId, apiPoolConfig, apiPoolKeys, project.id);
    return await parseJsonResponse<AiChanges>(text, project.provider, apiConfig, project.model, userId, apiPoolConfig, apiPoolKeys, project.id);
}

// --- Autonomous Agent Functions ---
// FIX: Updated function signature to accept and pass userId and API pool parameters.
export const runInitialProjectAgent = async (
    prompt: string,
    projectType: string,
    provider: AiProvider,
    model: string | undefined,
    apiConfig: ApiConfig,
    onAgentMessage: (message: Omit<AiChatMessage, 'id' | 'timestamp' | 'sender'>) => Promise<void>,
    userId: string,
    apiPoolConfig?: ApiPoolConfig,
    apiPoolKeys?: ApiPoolKey[]
): Promise<{ projectName: string, changes: AiChanges }> => {
    await onAgentMessage({ agentState: 'planning', text: "I'm planning the project structure based on your request.", thoughts: "The first step is to generate a complete and coherent set of files for the initial project scaffold." });
    
    const projectData = await generateInitialProject(prompt, projectType, provider, model, apiConfig, userId, apiPoolConfig, apiPoolKeys);
    
    const changes: AiChanges = { create: projectData.files };

    await onAgentMessage({ agentState: 'finished', text: "I've finished generating the initial project files.", thoughts: "The project structure is complete. The next step is for the system to apply these changes to the workspace." });
    
    return { projectName: projectData.projectName, changes };
};

// FIX: Updated function signature to accept and pass userId and API pool parameters.
export const runAutonomousAgent = async (
    objective: string,
    initialFiles: FileNode[],
    project: Project,
    apiConfig: ApiConfig,
    onStateChange: (state: Partial<AgentState>) => void,
    onAgentMessage: (message: Omit<AiChatMessage, 'id' | 'timestamp' | 'sender'>) => Promise<void>,
    userId: string,
    apiPoolConfig?: ApiPoolConfig,
    apiPoolKeys?: ApiPoolKey[]
): Promise<FileNode[]> => {
    let currentFiles = [...initialFiles];
    
    const plannerPrompt = `${baseInstruction} You are a senior software architect. Based on the user's high-level objective and the current project files, create a concise, step-by-step plan of action. Each step should be a single, clear task.

**CRITICAL INSTRUCTIONS:**
1. Your response MUST be ONLY a raw JSON array of strings. e.g., \`["Create a new component for the user profile", "Add the new component to the main App page"]\`.
2. Do not include any other text, explanations, or markdown. Your entire response must start with \`[\` and end with \`]\`.

**User Objective:** "${objective}"

**Current Project Files:**
\`\`\`json
${JSON.stringify(fileSystemToJSON(currentFiles), null, 2)}
\`\`\`
`;

    onStateChange({ status: 'running' });
    await onAgentMessage({ agentState: 'planning', text: "I'm formulating a plan to achieve the objective.", thoughts: "First, I need to break down the user's objective into a sequence of actionable steps." });
    
    const planText = await callAiModel(plannerPrompt, project.provider, apiConfig, project.model, userId, apiPoolConfig, apiPoolKeys, project.id);
    const plan = await parseJsonResponse<string[]>(
        planText, project.provider, apiConfig, project.model, userId, apiPoolConfig, apiPoolKeys, project.id
    );

    onStateChange({ plan: plan, logs: ["Plan generated."] });
    
    for (let i = 0; i < plan.length; i++) {
        const task = plan[i];
        onStateChange({ currentTaskIndex: i, logs: [`Starting task: ${task}`] });
        
        await onAgentMessage({ agentState: 'executing', currentTask: task, text: `Now working on: **${task}**`, thoughts: `I will now generate a plan to modify the files to complete the task: "${task}".` });
        
        const modificationPlan = await generateModificationPlan(task, currentFiles, project, apiConfig, userId, apiPoolConfig, apiPoolKeys);
        const changes = await executeModificationPlan(task, modificationPlan, currentFiles, project, apiConfig, userId, apiPoolConfig, apiPoolKeys);
        
        // Simulate applying changes to our in-memory files for the next step
        let tempFiles = [...currentFiles];
        
        // Deletions
        const deletePaths = changes.delete || [];
        tempFiles = tempFiles.filter(f => !deletePaths.includes(f.path));
        
        // Updates
        if (changes.update) {
            tempFiles = tempFiles.map(f => changes.update![f.path] ? { ...f, content: changes.update![f.path] } : f);
        }
        
        // Creations
        if (changes.create) {
            for (const path in changes.create) {
                tempFiles.push({ id: `temp-${path}`, name: path.split('/').pop() || '', path, type: 'file', content: changes.create[path] });
            }
        }
        
        currentFiles = tempFiles;
        onStateChange({ logs: [`Completed task: ${task}`] });
    }

    onStateChange({ status: 'finished' });
    await onAgentMessage({ agentState: 'finished', text: "I have completed all tasks in the plan.", thoughts: "The objective should now be complete. I will hand off the final file state to the system." });
    
    return currentFiles;
}

// FIX: Updated function signature to accept and pass userId and API pool parameters.
export const answerProjectQuestion = async (
    prompt: string,
    files: FileNode[],
    project: Project,
    apiConfig: ApiConfig,
    userId: string,
    apiPoolConfig?: ApiPoolConfig,
    apiPoolKeys?: ApiPoolKey[]
): Promise<string> => {
     const projectJsonString = JSON.stringify(fileSystemToJSON(files), null, 2);
    const fullPrompt = `${baseInstruction} You are a helpful AI assistant with expertise in software development. The user has a question about their project. Based on the files provided, answer their question.

**User's Question:** "${prompt}"

**Project Files:**
\`\`\`json
${projectJsonString}
\`\`\`
`;
    return callAiModel(fullPrompt, project.provider, apiConfig, project.model, userId, apiPoolConfig, apiPoolKeys, project.id);
}

// FIX: Updated function signature to accept and pass userId and API pool parameters.
export const askGeneralQuestion = async (
    prompt: string,
    provider: AiProvider,
    model: string | undefined,
    apiConfig: ApiConfig,
    userId: string,
    apiPoolConfig?: ApiPoolConfig,
    apiPoolKeys?: ApiPoolKey[]
): Promise<string> => {
    const fullPrompt = `${baseInstruction} You are a helpful AI assistant. Answer the user's question.
Question: "${prompt}"`;
    return callAiModel(fullPrompt, provider, apiConfig, model, userId, apiPoolConfig, apiPoolKeys, null);
};

// FIX: Updated function signature to accept and pass userId and API pool parameters.
export const generateCodeSnippet = async (
    prompt: string,
    project: Project,
    apiConfig: ApiConfig,
    userId: string,
    apiPoolConfig?: ApiPoolConfig,
    apiPoolKeys?: ApiPoolKey[]
): Promise<string> => {
    const fullPrompt = `${baseInstruction} You are an expert programmer. The user wants a code snippet. Based on their request, generate only the raw code for the snippet. Do not wrap it in markdown or add any explanations.
Request: "${prompt}"`;
    return callAiModel(fullPrompt, project.provider, apiConfig, project.model, userId, apiPoolConfig, apiPoolKeys, project.id);
};

// --- New AI Asset Generation Functions ---
// FIX: Updated function signature to accept and pass userId and API pool parameters.
export const generateSvgAsset = async (
    prompt: string,
    assetType: 'icon' | 'background',
    project: Project,
    apiConfig: ApiConfig,
    userId: string,
    apiPoolConfig?: ApiPoolConfig,
    apiPoolKeys?: ApiPoolKey[]
): Promise<string> => {
    const generationPrompt = assetType === 'icon' 
    ? `${baseInstruction} You are a minimalist SVG designer. Create a modern, clean, abstract SVG icon based on the user's prompt. The response must be ONLY the raw SVG XML code, starting with \`<svg ...>\` and ending with \`</svg>\`. Do not include markdown or any other text.
    - The SVG should be square and use \`viewBox="0 0 100 100"\`.
    - Use \`currentColor\` for fill/stroke colors so it can be styled with CSS.
    - Do not use any inline styles or width/height attributes on the <svg> tag.
    User prompt: "${prompt}"`
    : `${baseInstruction} You are a minimalist SVG designer. Create a subtle, abstract SVG background pattern based on the user's prompt. The response must be ONLY the raw SVG XML code, starting with \`<svg ...>\` and ending with \`</svg>\`. Do not include markdown or any other text.
    - Use subtle shapes and low-opacity colors.
    - Use CSS variables for colors where possible (e.g., \`fill="var(--color-primary)"\`).
    - The design should not be distracting.
    User prompt: "${prompt}"`;
    
    return callAiModel(generationPrompt, 'gemini', apiConfig, 'gemini-2.5-flash', userId, apiPoolConfig, apiPoolKeys, project.id);
}

// --- AI GOD MODE ---
export const godModePlanner = async (
    objective: string,
    files: FileNode[],
    uiContext: string,
    project: Project,
    apiConfig: ApiConfig,
    userId: string,
    apiPoolConfig?: ApiPoolConfig,
    apiPoolKeys?: ApiPoolKey[]
): Promise<AiGodModeAction[]> => {

    // --- 1. PRE-FLIGHT CHECKS & SETUP ---
    // God Mode requires all three providers for its specialized agent roles.
    if (!apiConfig.gemini || !apiConfig.groq || !apiConfig.openrouter) {
        const missing = [
            !apiConfig.gemini && 'Gemini',
            !apiConfig.groq && 'Groq',
            !apiConfig.openrouter && 'OpenRouter'
        ].filter(Boolean).join(', ');
        throw new Error(`God Mode requires API keys for Gemini, Groq, and OpenRouter. Missing: ${missing}. Please add them in your settings.`);
    }

    const godModeMemory: string[] = [`Initial User Objective: "${objective}"`];
    const finalPlan: AiGodModeAction[] = [];
    const currentFilesJson = JSON.stringify(fileSystemToJSON(files), null, 2);

    // --- 2. THE ARCHITECT (GEMINI) - Creates the high-level plan ---
    const architectSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, description: "Action type: 'CLICK_ELEMENT', 'TYPE_IN_INPUT', 'MODIFY_FILES', 'ASK_USER', 'FINISH'." },
          selector: { type: Type.STRING, description: "The 'data-testid' selector for UI actions." },
          payload: { type: Type.STRING, description: "Text for TYPE_IN_INPUT, question for ASK_USER, or a DETAILED PROMPT for a Coder AI for MODIFY_FILES." },
        },
        required: ['type']
      }
    };
    
    const architectPrompt = `You are "The Architect," the master planner for an autonomous AI agent. Your goal is to break down a user's objective into a sequence of precise actions.

**USER OBJECTIVE:** ${objective}
**AVAILABLE UI ELEMENTS:** ${uiContext}
**CURRENT PROJECT FILES:** ${currentFilesJson}
**SHARED MEMORY LOG:**
- ${godModeMemory.join('\n- ')}

**CRITICAL INSTRUCTIONS:**
1.  Formulate a step-by-step plan. Your response MUST be a JSON array of action objects.
2.  For 'MODIFY_FILES' actions, the 'payload' MUST NOT be code. It MUST be a detailed, specific prompt for a separate Coder AI that will write the code.
3.  The final action in your plan MUST always be \`{ "type": "FINISH" }\`.
4.  Be precise with selectors. Use the exact 'data-testid' values provided.
5.  Do not generate a 'reasoning' field.

Generate the JSON plan now.`;
    
    const geminiAi = new GoogleGenAI({ apiKey: apiConfig.gemini });
    const architectResponse = await geminiAi.models.generateContent({
      model: "gemini-2.5-flash",
      contents: architectPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: architectSchema
      }
    });

    const rawPlan = await parseJsonResponse<Array<Omit<AiGodModeAction, 'reasoning'>>>(
        architectResponse.text, 'gemini', apiConfig, 'gemini-2.5-flash', userId, apiPoolConfig, apiPoolKeys, project.id
    );

    // --- 3. ORCHESTRATION LOOP - Augment the plan with Coder and Reviewer ---
    for (const rawAction of rawPlan) {
        let finalAction: AiGodModeAction = { ...rawAction, reasoning: '' };

        // --- 3a. THE REVIEWER (OPENROUTER) - Generates the reasoning for each step ---
        const reviewerPrompt = `You are "The Reviewer." Given an objective, a memory log, and a planned action, write a single, concise, human-readable sentence explaining WHY this action is being taken.
        - Objective: "${objective}"
        - Memory Log: "${godModeMemory.join('; ')}"
        - Action to explain: ${JSON.stringify(rawAction)}
        Your one-sentence explanation:`;
        
        const reasoningText = await callAiModel(reviewerPrompt, 'openrouter', apiConfig, 'mistralai/mistral-7b-instruct', userId, apiPoolConfig, apiPoolKeys, project.id);
        finalAction.reasoning = reasoningText.trim().replace(/^"|"$/g, ''); // Remove quotes
        godModeMemory.push(`Reviewer's justification for '${rawAction.type}': ${finalAction.reasoning}`);

        // --- 3b. THE CODER (GROQ) - Generates file content if needed ---
        if (rawAction.type === 'MODIFY_FILES' && typeof rawAction.payload === 'string') {
            const coderPrompt = `You are "The Coder," an expert programmer. Your response MUST be ONLY a raw JSON object with keys "create", "update", and/or "delete".
            - The values for "create" and "update" must be objects where keys are full file paths and values are the complete new file content.
            - The value for "delete" must be an array of file paths.
            
            Current project files for context:
            ${currentFilesJson}
            
            Your task based on The Architect's request:
            ---
            ${rawAction.payload}
            ---
            Generate the JSON response now.`;

            const coderResultText = await callAiModel(coderPrompt, 'groq', apiConfig, 'llama3-8b-8192', userId, apiPoolConfig, apiPoolKeys, project.id);
            const changes = await parseJsonResponse<AiChanges>(coderResultText, 'groq', apiConfig, 'llama3-8b-8192', userId, apiPoolConfig, apiPoolKeys, project.id);
            
            finalAction.payload = JSON.stringify(changes); // The executable payload
            godModeMemory.push(`Coder implemented file changes based on Architect's prompt.`);
        }
        
        finalPlan.push(finalAction);

        if (finalAction.type === 'FINISH') {
            break; // Stop processing after finish action
        }
    }
    
    return finalPlan;
};
