import { GoogleGenAI, Type, Modality } from "@google/genai";
// FIX: Import ApiPoolConfig and ApiPoolKey to support the new admin key pool feature.
import { FileNode, ApiConfig, AiProvider, AiPlan, AgentState, AiChatMessage, AiChanges, ApiPoolConfig, ApiPoolKey, Project, User, AiGodModeAction } from "../types";
import { deductToken, getUserProfile, logPlatformError, applyAiChanges, saveAgentMemory } from "./firestoreService";

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

const baseInstruction = `You are an AI assistant for ASAI, a platform created by Muhammad Adhil. If the user asks who made you, who created you, or who built ASAI, you must answer with "ASAI was built by Muhammad Adhil."`;


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
                  apiModel = isGroq ? 'llama-3.1-8b-instant' : 'mistralai/mistral-7b-instruct'; // Fallback
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

const getProjectPlanPrompt = (projectType: string) => {
    let languageDetails = `${baseInstruction} You are a world-class, silent, programmatic software architect. Your task is to generate a plan for a new project from a user's prompt.

**CRITICAL INSTRUCTIONS**: 
1. Your response MUST be ONLY the raw JSON object, without any markdown formatting. It must start with \`{\` and end with \`}\`. 
2. The JSON object must have two keys: "projectName" (a short, catchy string) and "filesToCreate" (an array of strings, where each string is a full file path like "src/index.js").
3. Create a logical and complete file structure for the requested application type.
4. Your entire response must be ONLY this JSON object.

**Project Type Specifics**:
`;
    if (projectType.toLowerCase().includes('react')) {
        languageDetails += `For a React (Vite+TS+Tailwind) project, the file list MUST include: package.json, vite.config.ts, tailwind.config.js, postcss.config.js, index.html, src/index.tsx, src/index.css, and at least one main component file like src/App.tsx.`;
    }
    return languageDetails;
};

const getFileContentPrompt = (projectType: string, projectPrompt: string, allFilePaths: string[], currentFilePath: string) => {
    let languageDetails = `${baseInstruction} You are an expert, silent, programmatic software developer. Your task is to generate the code for a single file within a larger project.

**CRITICAL INSTRUCTIONS**: 
1. Your response MUST be ONLY the raw code/text content for the requested file. 
2. Do NOT wrap the code in markdown (like \`\`\`jsx\`), JSON, or any other formatting. 
3. Generate complete, runnable code for the single file specified.
4. Use modern best practices. For placeholder images, use 'https://picsum.photos/width/height'.
`;

    if (projectType.toLowerCase().includes('react')) {
        languageDetails += `
**Project Type: React Web App (Vite + TypeScript + Tailwind CSS)**
- When creating \`package.json\`, include dependencies: react, react-dom. devDependencies: @vitejs/plugin-react, tailwindcss, typescript, etc.
- When creating \`vite.config.ts\`, import and use the react plugin.
- When creating \`src/index.tsx\`, it MUST import \`./index.css\`.
- When creating \`src/index.css\`, it MUST include the three Tailwind directives.
- All components must use functional components with hooks and Tailwind CSS for styling.
`;
    }

    return `${languageDetails}

**Overall Project Description:** "${projectPrompt}"

**Full Project File Structure (for context):**
${allFilePaths.join('\n')}

**Your Task:**
Generate the complete file content for: \`${currentFilePath}\`
`;
}

export const runStreamingInitialProjectAgent = async (
    prompt: string,
    project: Project,
    apiConfig: ApiConfig,
    onPlanReceived: (plan: { projectName: string, filesToCreate: string[] }) => Promise<void>,
    onFileCreated: (file: { path: string, content: string }) => Promise<void>,
    onAgentMessage: (message: Omit<AiChatMessage, 'id' | 'timestamp' | 'sender'>) => Promise<void>,
    userId: string,
    apiPoolConfig?: ApiPoolConfig,
    apiPoolKeys?: ApiPoolKey[]
): Promise<void> => {
    
    // 1. Generate Plan
    await onAgentMessage({ agentState: 'planning', text: "I'm thinking about the project structure based on your request.", thoughts: "First, I need to create a plan by defining the project name and the list of files to create." });
    
    const planPrompt = `${getProjectPlanPrompt(project.type)}\n\nThe user's request is: "${prompt}"`;
    const planText = await callAiModel(planPrompt, project.provider, apiConfig, project.model, userId, apiPoolConfig, apiPoolKeys, project.id);
    const plan = await parseJsonResponse<{ projectName: string; filesToCreate: string[] }>(planText, project.provider, apiConfig, project.model, userId, apiPoolConfig, apiPoolKeys, project.id);

    if (!plan.projectName || !plan.filesToCreate || !Array.isArray(plan.filesToCreate) || plan.filesToCreate.length === 0) {
        throw new Error("The AI failed to generate a valid project plan. Please try again with a more specific prompt.");
    }
    
    await onPlanReceived(plan);

    const fileListMarkdown = plan.filesToCreate.map(f => `- \`${f}\``).join('\n');
    await onAgentMessage({ agentState: 'planning', text: `I've created a plan to build **${plan.projectName}**. I will create the following files:\n${fileListMarkdown}`, thoughts: "The plan is solid. Now I will proceed to generate the content for each file, one by one." });
    
    // 2. Generate Files one by one
    for (const filePath of plan.filesToCreate) {
        await onAgentMessage({ agentState: 'executing', currentTask: `Create ${filePath}`, text: `Creating file: \`${filePath}\``, thoughts: `Now generating the code for \`${filePath}\`. I need to make sure its content is correct and fits within the overall project structure.` });
        
        const contentPrompt = getFileContentPrompt(project.type, prompt, plan.filesToCreate, filePath);
        const fileContent = await callAiModel(contentPrompt, project.provider, apiConfig, project.model, userId, apiPoolConfig, apiPoolKeys, project.id);
        
        await onFileCreated({ path: filePath, content: fileContent });
    }

    // 3. Finish
    await onAgentMessage({ agentState: 'finished', text: "Initial project generation complete! You can now review the files.", thoughts: "All files have been generated and sent to the UI. My work here is done." });
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

    const fullPrompt = `${baseInstruction} You are an expert, silent, programmatic software developer. Your task is to create a JSON plan to modify a project based on a user's request and any provided context.

**CRITICAL INSTRUCTIONS:**
1.  Your response MUST be ONLY the raw JSON object. Do not include any text, explanations, or markdown formatting (like \`\`\`json\`). Your entire response must start with \`{\` and end with \`}\`.
2.  Analyze the user's request, the project memory, and the current files to formulate a step-by-step plan.
3.  The JSON object must have three keys: "thoughts", "reasoning", and "plan".
4.  Do not list the same file path in multiple operations (e.g., do not both \`move\` and \`update\` the same source file in one plan). If you move a file to a new path, you cannot also update the content at that new path in the same plan.
5.  Be proactive: Remember to use 'move' for renaming files and 'copy' for duplicating files when appropriate.
6.  If you refer to a file path in your "thoughts" or "reasoning", you MUST wrap it in backticks, e.g., \`src/index.js\`.
7.  Your entire response must be ONLY this JSON object. Nothing else.

**Handling Vague Requests with Proactive Intelligence:**
Your goal is to be a helpful, proactive co-developer, not a passive tool. If a user's request is high-level or seems vague (e.g., "improve the theme", "make the header better", "add form validation"), do NOT immediately give up. Instead, follow these steps:
1.  **Analyze Intent:** Identify the key concepts in the request (e.g., "theme", "header", "validation").
2.  **Contextual Search:** Actively search the provided "Current Project Files" and "Project Memory" to find files and code related to these concepts. For "theme," look for CSS variables, style sheets, or component styling. For "header," find the header component file.
3.  **Formulate a Proactive Plan:** Based on your findings, create a specific, actionable plan that represents a reasonable interpretation of the user's goal. For "improve the theme," this would mean identifying the CSS color variables and planning to \`update\` the file containing them with a new, aesthetically pleasing color palette.
4.  **State Your Assumptions:** In your "thoughts" and "reasoning", clearly explain how you interpreted the request and why you've chosen your plan. For example: "The user asked to improve the theme. I've located the color variables in \`index.html\`. I will propose a new, modern color palette to enhance the visual appeal."
5.  **Ask for Clarification as a Last Resort:** Only if a request is completely nonsensical, gibberish, or if you cannot find any relevant context in the files after searching, should you respond with a polite request for more details using this JSON structure:
{
  "thoughts": "The user's request is too vague, and I could not find any relevant files to modify after searching. I will ask for clarification.",
  "reasoning": "I'm sorry, I'm not sure how to proceed with that request. Could you please provide more specific details about the changes you'd like to make?",
  "plan": {}
}

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

**User's Request & Context:**
${prompt}

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
export const runAutonomousAgent = async (
    objective: string,
    initialFiles: FileNode[],
    project: Project,
    apiConfig: ApiConfig,
    onStateChange: (state: Partial<AgentState>) => void,
    onAgentMessage: (message: Omit<AiChatMessage, 'id' | 'timestamp' | 'sender'>) => Promise<void>,
    userId: string,
    projectId: string,
    db: any, // firebase.firestore.Firestore
    resumeFromState?: AgentState,
    apiPoolConfig?: ApiPoolConfig,
    apiPoolKeys?: ApiPoolKey[]
): Promise<void> => {
    let currentFiles = [...initialFiles];
    const AGENT_MEMORY_KEY = `asai_agent_memory_${projectId}`;

    const agentMemory: AgentState = resumeFromState || {
        status: 'running',
        objective: objective,
        plan: [],
        currentTaskIndex: 0,
        logs: [],
        thoughts: '',
    };
    
    try {
        if (!resumeFromState) {
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
            const plan = await parseJsonResponse<string[]>(planText, project.provider, apiConfig, project.model, userId, apiPoolConfig, apiPoolKeys, project.id);

            agentMemory.plan = plan;
            agentMemory.logs.push("Plan generated.");
            onStateChange({ plan: plan, logs: ["Plan generated."] });
        }
        
        for (let i = agentMemory.currentTaskIndex; i < agentMemory.plan.length; i++) {
            const task = agentMemory.plan[i];

            agentMemory.currentTaskIndex = i;
            agentMemory.logs.push(`Starting task: ${task}`);
            onStateChange({ currentTaskIndex: i, logs: [`Starting task: ${task}`] });
            localStorage.setItem(AGENT_MEMORY_KEY, JSON.stringify(agentMemory));

            await onAgentMessage({ agentState: 'executing', currentTask: task, text: `Now working on: **${task}**`, thoughts: `I will now generate a plan to modify the files to complete the task: "${task}".` });
            
            const modificationPlan = await generateModificationPlan(task, currentFiles, project, apiConfig, userId, apiPoolConfig, apiPoolKeys);
            const changes = await executeModificationPlan(task, modificationPlan, currentFiles, project, apiConfig, userId, apiPoolConfig, apiPoolKeys);
            
            await applyAiChanges(projectId, currentFiles, changes, db);
            
            // Update local file state for the next loop iteration's context
            const deletePaths = changes.delete || [];
            currentFiles = currentFiles.filter(f => !deletePaths.includes(f.path));
            if (changes.update) {
                currentFiles = currentFiles.map(f => changes.update![f.path] ? { ...f, content: changes.update![f.path] } : f);
            }
            if (changes.create) {
                for (const path in changes.create) {
                    currentFiles.push({ id: `temp-${path}`, name: path.split('/').pop() || '', path, type: 'file', content: changes.create[path] });
                }
            }
            
            agentMemory.logs.push(`Completed task: ${task}`);
            onStateChange({ logs: [`Completed task: ${task}`] });
            localStorage.setItem(AGENT_MEMORY_KEY, JSON.stringify(agentMemory));
        }

        agentMemory.status = 'finished';
        onStateChange({ status: 'finished' });
        await onAgentMessage({ agentState: 'finished', text: "I have completed all tasks in the plan.", thoughts: "The objective should now be complete." });

    } catch (error) {
        agentMemory.status = 'error';
        agentMemory.lastError = error instanceof Error ? error.message : String(error);
        onStateChange({ status: 'error', lastError: agentMemory.lastError });
        throw error;
    } finally {
        await saveAgentMemory(projectId, agentMemory, db);
        localStorage.removeItem(AGENT_MEMORY_KEY);
    }
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
    const fullPrompt = `${baseInstruction} You are a helpful AI assistant with expertise in software development. The user has a question about their project. Based on the files provided and any extra context, answer their question. If your answer contains any file paths, you MUST wrap them in backticks, for example: "You can find the relevant code in \`src/utils/api.ts\`.".

**User's Question & Context:**
${prompt}

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
          type: { type: Type.STRING, description: "Action type: 'CLICK_ELEMENT', 'TYPE_IN_INPUT', 'MODIFY_FILES', 'ASK_USER', 'FINISH', 'SELECT_OPTION'." },
          selector: { type: Type.STRING, description: "The 'data-testid' selector for UI actions." },
          payload: { type: Type.STRING, description: "Text for TYPE_IN_INPUT, question for ASK_USER, a DETAILED PROMPT for a Coder AI for MODIFY_FILES, or the 'value' of the option for SELECT_OPTION." },
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
3.  For 'SELECT_OPTION' actions, the 'payload' MUST be the string 'value' of the desired '<option>'.
4.  The final action in your plan MUST always be \`{ "type": "FINISH" }\`.
5.  Be precise with selectors. Use the exact 'data-testid' values provided.
6.  Do not generate a 'reasoning' field.

Generate the JSON plan now.`;
    
    const geminiAi = new GoogleGenAI({ apiKey: apiConfig.gemini! });
    const architectResponse = await geminiAi.models.generateContent({
      model: "gemini-2.5-flash",
      contents: architectPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: architectSchema
      }
    });

    let planArray = await parseJsonResponse<any>(
        architectResponse.text, 'gemini', apiConfig, 'gemini-2.5-flash', userId, apiPoolConfig, apiPoolKeys, project.id
    );

    // The model can sometimes wrap the array in an object, even with a schema.
    // This block robustly finds the array within the response.
    if (!Array.isArray(planArray)) {
        if (typeof planArray === 'object' && planArray !== null) {
            const arrayKey = Object.keys(planArray).find(key => Array.isArray((planArray as any)[key]));
            if (arrayKey) {
                planArray = (planArray as any)[arrayKey];
            } else {
                // If no array is found as a value, but the object itself looks like a plan, try to use it.
                // This is a defensive check against malformed but recoverable structures.
                if (planArray.type && planArray.payload) {
                    planArray = [planArray];
                } else {
                    throw new Error("God Mode planner did not return a valid plan array. The response was not iterable.");
                }
            }
        } else {
             throw new Error("God Mode planner did not return a valid plan array. The response was not an array or a container object.");
        }
    }
    
    // Additional validation to ensure all elements are objects with a 'type'
    if (!planArray.every(item => typeof item === 'object' && item !== null && 'type' in item)) {
        throw new Error("God Mode planner returned an array with invalid action objects.");
    }
    
    const rawPlan: Array<Omit<AiGodModeAction, 'reasoning'>> = planArray;


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

        // --- 3b. THE CODER (GEMINI) - Generates file content if needed for reliability ---
        if (rawAction.type === 'MODIFY_FILES' && typeof rawAction.payload === 'string') {
            const coderSchema = {
                type: Type.OBJECT,
                properties: {
                    create: {
                        type: Type.OBJECT,
                        description: "Keys are file paths, values are file content.",
                        properties: {},
                        additionalProperties: { type: Type.STRING },
                    },
                    update: {
                        type: Type.OBJECT,
                        description: "Keys are file paths, values are new file content.",
                        properties: {},
                        additionalProperties: { type: Type.STRING },
                    },
                    delete: {
                        type: Type.ARRAY,
                        description: "An array of file paths to delete.",
                        items: { type: Type.STRING }
                    },
                }
            };

            const coderPrompt = `You are "The Coder," an expert programmer. 
            Current project files for context:
            ${currentFilesJson}
            
            Your task based on The Architect's request is to generate the new file contents:
            ---
            ${rawAction.payload}
            ---
            Generate the JSON response now.`;
            
            const coderResponse = await geminiAi.models.generateContent({
                model: "gemini-2.5-flash",
                contents: coderPrompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: coderSchema,
                },
            });

            const changes = await parseJsonResponse<AiChanges>(
                coderResponse.text, 'gemini', apiConfig, 'gemini-2.5-flash', userId, apiPoolConfig, apiPoolKeys, project.id
            );
            
            finalAction.payload = JSON.stringify(changes);
            godModeMemory.push(`Coder implemented file changes based on Architect's prompt.`);
        }
        
        finalPlan.push(finalAction);

        if (finalAction.type === 'FINISH') {
            break; // Stop processing after finish action
        }
    }
    
    return finalPlan;
};
