import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
// FIX: Added 'AiPlan', 'ApiPoolConfig', and 'ApiPoolKey' to the import list to resolve type errors.
import { FileNode, AiChatMessage, ApiConfig, User, Project, AgentState, AiChanges, AiProvider, AiPlan, ApiPoolConfig, ApiPoolKey, ConsoleMessage } from '../types';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import CodeEditor from '../components/CodeEditor';
import SandboxPreview from '../components/SandboxPreview';
import ApiKeyModal from '../components/ApiKeyModal';
import ProjectSettingsModal from '../components/ProjectSettingsModal';
import BuildModeModal from '../components/BuildModeModal';
import AutonomousModeModal from '../components/AutonomousModeModal';
import Spinner from '../components/ui/Spinner';
import { buildPreviewHtml } from '../services/sandboxService';
import { generateModificationPlan, executeModificationPlan, analyzeCode, runAutonomousAgent, proposeFixes, runInitialProjectAgent, answerProjectQuestion, summarizeChangesForMemory } from '../services/aiService';
import { getProjectFiles, updateFileContent, getChatHistory, addChatMessage, addFileOrFolder, deleteFileByPath, applyAiChanges, getProjectDetails, updateProjectDetails, updateChatMessage, deleteProject, copyProject, clearChatHistory, createShareKey } from '../services/firestoreService';
import { CodeIcon, PlayIcon } from '../components/icons';
import DebugRefactorModal from '../components/DebugRefactorModal';
import ProfileSettingsModal from '../components/ProfileSettingsModal';
import ShareProjectModal from '../components/ShareProjectModal';
import Console from '../components/Console';

declare const JSZip: any;

interface EditorPageProps {
    projectId: string;
    onBackToDashboard: () => void;
    user: User;
    apiConfig: ApiConfig;
    onApiConfigChange: (config: ApiConfig) => void;
    initialGenerationTask?: { prompt: string; provider: AiProvider, model?: string } | null;
    onTaskConsumed: () => void;
    // FIX: Pass down admin API pool configuration to be used by AI services.
    apiPoolConfig: ApiPoolConfig;
    apiPoolKeys: ApiPoolKey[];
}

const EditorPage: React.FC<EditorPageProps> = ({ projectId, onBackToDashboard, user, apiConfig, onApiConfigChange, initialGenerationTask, onTaskConsumed, apiPoolConfig, apiPoolKeys }) => {
    const [project, setProject] = useState<Project | null>(null);
    const [files, setFiles] = useState<FileNode[]>([]);
    const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
    const [previewHtml, setPreviewHtml] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [chatMessages, setChatMessages] = useState<AiChatMessage[]>([]);
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isBuildModalOpen, setIsBuildModalOpen] = useState(false);
    const [isAutoDevModalOpen, setIsAutoDevModalOpen] = useState(false);
    const [isDebugRefactorModalOpen, setIsDebugRefactorModalOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isFixing, setIsFixing] = useState(false);
    const [proposedFixes, setProposedFixes] = useState<AiChanges | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(true);
    const [isConsoleOpen, setIsConsoleOpen] = useState(true);
    const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
    const [agentState, setAgentState] = useState<AgentState>({ status: 'idle', objective: '', plan: [], currentTaskIndex: -1, logs: [] });
    const [isGeneratingInitialProject, setIsGeneratingInitialProject] = useState(false);
    const [sidebarTab, setSidebarTab] = useState<'files' | 'chat'>('files');
    const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());
    const [savingFile, setSavingFile] = useState<string | null>(null);
    
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const savedWidth = localStorage.getItem('sidebarWidth');
        return savedWidth ? parseInt(savedWidth, 10) : 480;
    });
    const [bottomPanelHeight, setBottomPanelHeight] = useState(() => {
        const savedHeight = localStorage.getItem('bottomPanelHeight');
        return savedHeight ? parseInt(savedHeight, 10) : 250;
    });

    const isResizing = useRef(false);
    const isResizingVertical = useRef(false);

    const fetchProjectData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [projectDetails, projectFiles, chatHistory] = await Promise.all([
                getProjectDetails(projectId),
                getProjectFiles(projectId),
                getChatHistory(projectId),
            ]);
            
            if (!projectDetails) throw new Error("Project not found");
            
            setProject(projectDetails);
            setFiles(projectFiles);
            setChatMessages(chatHistory as AiChatMessage[]);
            
            if (!selectedFilePath && projectFiles.length > 0) {
                 const entryFile = projectFiles.find(f => f.path.match(/app.tsx|index.tsx|index.html/i)) || projectFiles.find(f => f.type === 'file');
                 if (entryFile) {
                    setSelectedFilePath(entryFile.path);
                 }
            }

        } catch (error) {
            console.error("Failed to load project:", error);
            alert("Could not load project data.");
            onBackToDashboard();
        } finally {
            setIsLoading(false);
        }
    }, [projectId, onBackToDashboard, selectedFilePath]);

    useEffect(() => {
        fetchProjectData();
    }, [projectId]);

    // Effect for initial project generation
    useEffect(() => {
        const runInitialBuild = async () => {
            if (!initialGenerationTask || files.length > 0 || !project) return;
            
            onTaskConsumed();

            setIsGeneratingInitialProject(true);
            setIsAiLoading(true);
            setSidebarTab('chat');
            setIsPreviewOpen(true);

            const { prompt, provider, model } = initialGenerationTask;
            
            const userMessage: Omit<AiChatMessage, 'id' | 'timestamp'> = { sender: 'user', text: `Build me this: "${prompt}"` };
            await addChatMessage(projectId, userMessage);
            setChatMessages(prev => [...prev, { ...userMessage, id: 'temp-user-init', timestamp: new Date() as any}]);

            const onAgentMessage = async (message: Omit<AiChatMessage, 'id' | 'timestamp' | 'sender'>) => {
                const agentMessage: Omit<AiChatMessage, 'id' | 'timestamp'> = { sender: 'ai', isAgentMessage: false, ...message };
                await addChatMessage(projectId, agentMessage);
                setChatMessages(prev => [...prev, { ...agentMessage, id: `temp-gen-${Date.now()}`, timestamp: new Date() as any }]);
            };

            try {
                const key = apiConfig[provider];
                // FIX: Updated to check for pooled keys as a fallback.
                if (!key && !apiPoolConfig.isEnabled) throw new Error(`API key for ${provider} is not configured.`);
                
                // FIX: Pass API pool config to the agent.
                const { projectName, changes } = await runInitialProjectAgent(prompt, project.type, provider, model, apiConfig, onAgentMessage, apiPoolConfig, apiPoolKeys);
                
                await applyAiChanges(projectId, files, changes);
                await updateProjectDetails(projectId, projectName, prompt, model);

            } catch (error) {
                 const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
                 let friendlyMessage = `Sorry, I encountered an error building the project: ${errorMessage}`;
                 
                 if (errorMessage.toLowerCase().includes('api key')) {
                    friendlyMessage = `It looks like your API key isn't set up correctly. Please add your key to continue.\n\nError: ${errorMessage}`;
                    setIsApiKeyModalOpen(true);
                 }
                 
                 onAgentMessage({ text: friendlyMessage, isLoading: false });
            } finally {
                await fetchProjectData();
                setIsGeneratingInitialProject(false);
                setIsAiLoading(false);
            }
        };

        runInitialBuild();

    }, [initialGenerationTask, projectId, project, apiConfig, files, fetchProjectData, onTaskConsumed, apiPoolConfig, apiPoolKeys]);


    const refreshPreview = useCallback(() => {
        if (project) {
            const html = buildPreviewHtml(files, project.type);
            setPreviewHtml(html);
        }
    }, [files, project]);
    
    useEffect(() => {
        refreshPreview();
    }, [files, refreshPreview]);
    
    // Listener for console logs from iframe
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data && event.data.type === 'CONSOLE_LOG') {
                const { method, args } = event.data.payload;
                setConsoleMessages(prev => [
                    ...prev.slice(-200), // Keep max 201 messages
                    {
                        id: `msg-${Date.now()}-${Math.random()}`,
                        method,
                        args,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    }
                ]);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const handleClearConsole = () => setConsoleMessages([]);

    const handleFileSelect = (path: string) => {
        const file = files.find(f => f.path === path);
        if(file?.type === 'file' || file?.type === 'folder') {
            setSelectedFilePath(path);
        }
    }
    
    const handleFileContentChange = (newContent: string) => {
        if (!selectedFilePath) return;

        setFiles(currentFiles => currentFiles.map(f => f.path === selectedFilePath ? { ...f, content: newContent } : f));
        setDirtyFiles(prev => new Set(prev).add(selectedFilePath));
    };

    const handleSaveFile = async (filePath: string) => {
        const fileToSave = files.find(f => f.path === filePath);
        if (!fileToSave || !dirtyFiles.has(filePath)) return;

        setSavingFile(filePath);
        try {
            await updateFileContent(projectId, fileToSave.id, fileToSave.content || '');
            setDirtyFiles(prev => {
                const newDirty = new Set(prev);
                newDirty.delete(filePath);
                return newDirty;
            });
        } catch (error) {
            console.error("Failed to save file:", error);
            alert(`Could not save file: ${filePath}`);
        } finally {
            setSavingFile(null);
        }
    };

    const handleSendMessage = async (message: string, mode: 'build' | 'ask') => {
        if (!project) return;
        const userMessage: Omit<AiChatMessage, 'id' | 'timestamp'> = { sender: 'user', text: message };
        await addChatMessage(projectId, userMessage);
        
        const tempUserMessage = { ...userMessage, id: 'temp-user-' + Date.now(), timestamp: new Date() } as any;
        setChatMessages(prev => [...prev, tempUserMessage]);
        setIsAiLoading(true);

        try {
            if (mode === 'ask') {
                // FIX: Pass API pool config to the AI service.
                const answer = await answerProjectQuestion(message, files, project, apiConfig, apiPoolConfig, apiPoolKeys);
                const aiMessage: Omit<AiChatMessage, 'id' | 'timestamp'> = { sender: 'ai', text: answer };
                await addChatMessage(projectId, aiMessage);
            } else {
                 // FIX: Pass API pool config to the AI service.
                 const plan = await generateModificationPlan(message, files, project, apiConfig, apiPoolConfig, apiPoolKeys);
                 
                 // Handle special actions immediately
                 if (plan.plan.special_action) {
                     handleSpecialAction(plan);
                     return; // Stop further processing
                 }

                 const aiPlanMessage: Omit<AiChatMessage, 'id' | 'timestamp'> = { 
                    sender: 'ai', 
                    text: "I've analyzed your request. Here's my plan:",
                    plan: plan,
                    planStatus: 'pending'
                };
                await addChatMessage(projectId, aiPlanMessage);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            const aiMessage: Omit<AiChatMessage, 'id' | 'timestamp'> = { sender: 'ai', text: `Sorry, I encountered an error: ${errorMessage}` };
            await addChatMessage(projectId, aiMessage);
        } finally {
            await fetchProjectData();
            setIsAiLoading(false);
        }
    };

    const handleSpecialAction = async (plan: AiPlan) => {
        const action = plan.plan.special_action;
        if (!action) return;

        const isRename = action.action === 'RENAME_PROJECT';
        const confirmed = isRename ? true : window.confirm(action.confirmation_prompt || `Are you sure you want to perform action: ${action.action}?`);
        
        if (!confirmed) {
             const aiMessage: Omit<AiChatMessage, 'id' | 'timestamp'> = { sender: 'ai', text: "Okay, I've cancelled the action." };
             await addChatMessage(projectId, aiMessage);
             await fetchProjectData();
             setIsAiLoading(false);
             return;
        }

        try {
            if (action.action === 'DELETE_PROJECT') {
                await deleteProject(projectId);
                alert("Project deleted successfully.");
                onBackToDashboard();
            } else if (action.action === 'COPY_PROJECT') {
                const newName = action.payload?.newName || `${project?.name} - Copy`;
                await copyProject(projectId, newName, user.uid);
                const aiMessage: Omit<AiChatMessage, 'id' | 'timestamp'> = { sender: 'ai', text: `Successfully created a copy named "${newName}".` };
                await addChatMessage(projectId, aiMessage);
            } else if (action.action === 'CLEAR_CHAT_HISTORY') {
                await clearChatHistory(projectId);
                const aiMessage: Omit<AiChatMessage, 'id' | 'timestamp'> = { sender: 'ai', text: "Chat history has been cleared." };
                await addChatMessage(projectId, aiMessage); // Add one message back
            } else if (action.action === 'RENAME_PROJECT' && action.payload?.newName) {
                const newName = action.payload.newName;
                await updateProjectDetails(projectId, newName, project?.prompt || '', project?.model);
                setProject(prev => prev ? { ...prev, name: newName } : null);
                const aiMessage: Omit<AiChatMessage, 'id' | 'timestamp'> = { sender: 'ai', text: `I have renamed the project to "${newName}".` };
                await addChatMessage(projectId, aiMessage);
            }
        } catch(e) {
            const error = e instanceof Error ? e.message : "An unknown error occurred.";
            const aiMessage: Omit<AiChatMessage, 'id' | 'timestamp'> = { sender: 'ai', text: `Action failed: ${error}` };
            await addChatMessage(projectId, aiMessage);
        } finally {
            await fetchProjectData();
            setIsAiLoading(false);
        }
    };

    const handlePlanApproval = async (messageId: string) => {
        const planMessage = chatMessages.find(m => m.id === messageId);
        if (!planMessage || !planMessage.plan || !project) return;
        
        await updateChatMessage(projectId, messageId, { planStatus: 'executing' });
        setChatMessages(msgs => msgs.map(m => m.id === messageId ? {...m, planStatus: 'executing'} : m));
        setIsAiLoading(true);
        
        const prompt = chatMessages.find(m => m.sender === 'user' && m.timestamp < planMessage.timestamp!)?.text || "Execute the approved plan.";

        try {
            // FIX: Pass API pool config to the AI service.
            const changes = await executeModificationPlan(prompt, planMessage.plan, files, project, apiConfig, apiPoolConfig, apiPoolKeys);

            // Add the move/copy operations to the changes object passed to summarize and apply
            changes.move = planMessage.plan.plan.move;
            changes.copy = planMessage.plan.plan.copy;

            const addFeedbackMessage = async (text: string) => {
                const feedbackMsg: Omit<AiChatMessage, 'id' | 'timestamp'> = { sender: 'ai', text };
                await addChatMessage(projectId, feedbackMsg);
                setChatMessages(prev => [...prev, { ...feedbackMsg, id: `temp-feedback-${Date.now()}`, timestamp: new Date() as any }]);
                await new Promise(resolve => setTimeout(resolve, 200));
            };

            const createdFiles = Object.keys(changes.create || {});
            for (const path of createdFiles) {
                await addFeedbackMessage(`Creating file: \`${path}\``);
            }

            const updatedFiles = Object.keys(changes.update || {});
            for (const path of updatedFiles) {
                await addFeedbackMessage(`Updating file: \`${path}\``);
            }
            
            const deletedFiles = changes.delete || [];
            if (Array.isArray(deletedFiles)) {
                for (const path of deletedFiles) {
                    await addFeedbackMessage(`Deleting file: \`${path}\``);
                }
            }
            
            // Summarize changes and add memory file to the changes object
            // FIX: Pass API pool config to the AI service.
            const summary = await summarizeChangesForMemory(prompt, planMessage.plan, changes, project, apiConfig, apiPoolConfig, apiPoolKeys);
            const memoryFile = files.find(f => f.path === ".asai/memory.md");
            const oldContent = memoryFile?.content || `# Project Memory Log\n\nThis file contains a log of changes made by the AI to maintain context for future requests.\n`;
            const newContent = `${oldContent}\n\n---\n\n**${new Date().toLocaleString()} | User Request: "${prompt}"**\n\n${summary}\n`;
            
            if (memoryFile) {
                if (!changes.update) changes.update = {};
                changes.update[".asai/memory.md"] = newContent;
            } else {
                if (!changes.create) changes.create = {};
                changes.create[".asai/memory.md"] = newContent;
            }
            
            await applyAiChanges(projectId, files, changes);
            await updateChatMessage(projectId, messageId, { planStatus: 'approved' });
            const aiMessage: Omit<AiChatMessage, 'id' | 'timestamp'> = { sender: 'ai', text: "I've successfully applied the changes and updated my project memory." };
            await addChatMessage(projectId, aiMessage);

        } catch(error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            await updateChatMessage(projectId, messageId, { planStatus: 'rejected' });
            const aiMessage: Omit<AiChatMessage, 'id' | 'timestamp'> = { sender: 'ai', text: `Sorry, I encountered an error executing the plan: ${errorMessage}` };
            await addChatMessage(projectId, aiMessage);
        } finally {
            await fetchProjectData();
            setDirtyFiles(new Set()); // Changes applied, clear dirty state
            setIsAiLoading(false);
        }
    };

    const handlePlanRejection = async (messageId: string) => {
        await updateChatMessage(projectId, messageId, { planStatus: 'rejected' });
        setChatMessages(msgs => msgs.map(m => m.id === messageId ? {...m, planStatus: 'rejected'} : m));
        const aiMessage: Omit<AiChatMessage, 'id' | 'timestamp'> = { sender: 'ai', text: "Okay, I've cancelled that plan. What would you like to do instead?" };
        await addChatMessage(projectId, aiMessage);
        await fetchProjectData();
    };

    const handleAnalyzeProject = async() => {
        if (!project) return;
        setSidebarTab('chat');
        const tempAiMessage = { sender: 'ai', text: 'Analyzing project...', isLoading: true, id: 'temp-ai-analysis-' + Date.now(), timestamp: new Date() } as any;
        setChatMessages(prev => [...prev, tempAiMessage]);
        setIsAiLoading(true);

        try {
            // FIX: Pass API pool config to the AI service.
            const analysis = await analyzeCode(files, project, apiConfig, apiPoolConfig, apiPoolKeys);
            const aiMessage: Omit<AiChatMessage, 'id' | 'timestamp'> = { sender: 'ai', text: analysis };
            await addChatMessage(projectId, aiMessage);
        } catch(e) {
             const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
            const aiMessage: Omit<AiChatMessage, 'id' | 'timestamp'> = { sender: 'ai', text: `Sorry, I couldn't analyze the project: ${errorMessage}` };
            await addChatMessage(projectId, aiMessage);
        } finally {
            await fetchProjectData();
            setIsAiLoading(false);
        }
    };
    
    const selectedFile = useMemo(() => files.find(f => f.path === selectedFilePath), [files, selectedFilePath]);
    
    const handleFileDelete = async (path: string) => {
        try {
            await deleteFileByPath(projectId, path);
            setFiles(files.filter(f => f.path !== path));
            if(selectedFilePath === path) setSelectedFilePath(null);
        } catch (error) {
            console.error("Failed to delete file:", error);
        }
    };

    const handleFileAdd = async (parentPath: string, type: 'file' | 'folder') => {
      const name = prompt(`Enter name for new ${type} in '${parentPath || 'root'}':`);
      if (!name || name.includes('/')) {
        if(name) alert("Invalid name. Slashes are not allowed.");
        return;
      }
      
      const newPath = parentPath ? `${parentPath}/${name}` : name;

      if(files.some(f => f.path === newPath)) {
        alert(`${type} with this name already exists at this location.`);
        return;
      }

      await addFileOrFolder(projectId, newPath, type);
      await fetchProjectData();
    };

    const handleFileUpload = async (file: File, parentPath: string) => {
        const MAX_SIZE = 750 * 1024; // 750KB limit for Base64 safety in Firestore
        if (file.size > MAX_SIZE) {
            alert(`File is too large. Maximum size is ${MAX_SIZE / 1024}KB.`);
            return;
        }

        setIsLoading(true);
        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const dataUrl = event.target?.result as string;
                if (!dataUrl) {
                    alert("Could not read file.");
                    setIsLoading(false);
                    return;
                }

                // For React projects, create an assets folder if it doesn't exist
                // and save the asset as a JS module exporting the data URL.
                let assetsFolderPath = 'src/assets';
                if (project?.type.toLowerCase().includes('react')) {
                    const assetsFolderExists = files.some(f => f.path === assetsFolderPath && f.type === 'folder');
                    if (!assetsFolderExists) {
                        await addFileOrFolder(projectId, assetsFolderPath, 'folder');
                    }
                } else {
                    // For other project types, place in root 'assets' folder
                    assetsFolderPath = 'assets';
                     const assetsFolderExists = files.some(f => f.path === assetsFolderPath && f.type === 'folder');
                    if (!assetsFolderExists) {
                        await addFileOrFolder(projectId, assetsFolderPath, 'folder');
                    }
                }
                
                const fileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
                const modulePath = `${assetsFolderPath}/${fileName}.ts`;
                const moduleContent = `export default "${dataUrl}";`;

                await addFileOrFolder(projectId, modulePath, 'file', moduleContent);
                
                // Add a message to chat to inform the user
                const userMessage: Omit<AiChatMessage, 'id' | 'timestamp'> = { sender: 'user', text: `Uploaded file ${file.name}.` };
                await addChatMessage(projectId, userMessage);
                const aiMessage: Omit<AiChatMessage, 'id' | 'timestamp'> = { sender: 'ai', text: `I've saved \`${file.name}\` as a module at \`${modulePath}\`. You can now import it in your code and use it as the \`src\` for an image or video tag.` };
                await addChatMessage(projectId, aiMessage);
                
                await fetchProjectData();
            };
            reader.onerror = () => {
                alert("Error reading file.");
                setIsLoading(false);
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error("Failed to upload file:", error);
            alert("An error occurred during upload.");
            setIsLoading(false);
        }
    };

    const downloadProject = () => {
        const zip = new JSZip();
        files.forEach(file => {
            if(file.type === 'file' && file.content !== undefined) {
                zip.file(file.path, file.content);
            } else if (file.type === 'folder') {
                zip.folder(file.path);
            }
        });
        
        zip.generateAsync({ type: "blob" }).then(content => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `${project?.name || 'asai-project'}.zip`;
            link.click();
        });
    };
    
    const handleSaveSettings = async (newName: string, newPrompt: string, newModel?: string) => {
        if (!project) return;
        try {
            await updateProjectDetails(projectId, newName, newPrompt, newModel);
            setProject({ ...project, name: newName, prompt: newPrompt, model: newModel });
            setIsSettingsModalOpen(false);
        } catch (error) {
            console.error("Failed to save project settings:", error);
            alert("Could not save settings.");
        }
    };

    const handleStartAgent = async (objective: string) => {
        if (!project) return;
        setSidebarTab('chat');
        setIsAutoDevModalOpen(true);
        const startMessage: Omit<AiChatMessage, 'id' | 'timestamp'> = { sender: 'ai', text: `Starting Auto-Dev mode with objective: ${objective}`, isAgentMessage: true, agentState: 'planning' };
        await addChatMessage(projectId, startMessage);
        await fetchProjectData();

        setAgentState({ status: 'running', objective: objective, plan: [], currentTaskIndex: -1, logs: [`Agent initialized with objective: ${objective}`] });

        const onAgentMessage = async (message: Omit<AiChatMessage, 'id' | 'timestamp' | 'sender'>) => {
            const agentMessage: Omit<AiChatMessage, 'id' | 'timestamp'> = { sender: 'ai', isAgentMessage: true, ...message };
            await addChatMessage(projectId, agentMessage);
            setChatMessages(prev => [...prev.filter(m => m.id), {...agentMessage, id: `temp-agent-${Date.now()}`, timestamp: new Date() as any}]);
        };

        try {
            // FIX: Pass API pool config to the agent.
            const finalFiles = await runAutonomousAgent(objective, files, project, apiConfig, 
                (newStateUpdate) => {
                    setAgentState(prevState => {
                        const newLogs = newStateUpdate.logs ? [...prevState.logs, ...newStateUpdate.logs].slice(-100) : prevState.logs;
                        return { ...prevState, ...newStateUpdate, logs: newLogs };
                    });
                },
                onAgentMessage,
                apiPoolConfig,
                apiPoolKeys
            );
            
            const originalFileMap = new Map(files.map(f => [f.path, f]));
            const finalFileMap = new Map(finalFiles.map(f => [f.path, f]));
            const changes: AiChanges = { create: {}, update: {}, delete: [] };

            finalFileMap.forEach((file, path) => {
                const originalFile = originalFileMap.get(path);
                if (!originalFile) {
                    changes.create![path] = file.content!;
                } else if (originalFile.content !== file.content) {
                    changes.update![path] = file.content!;
                }
            });
            originalFileMap.forEach((file, path) => {
                if (!finalFileMap.has(path)) {
                    changes.delete!.push(path);
                }
            });
            
            if (Object.keys(changes.create!).length > 0 || Object.keys(changes.update!).length > 0 || changes.delete!.length > 0) {
                await applyAiChanges(projectId, files, changes);
            }

        } catch (error) {
            console.error("Agent failed to run:", error);
        } finally {
            await fetchProjectData();
            setDirtyFiles(new Set()); // Agent finished, clear dirty files.
        }
    };

    const handleProposeFixes = async (description: string, scope: 'file' | 'project') => {
        if (!project) return;
        setIsFixing(true);
        setProposedFixes(null);
        let filesToFix: { path: string; content: string }[] = [];

        if (scope === 'file' && selectedFile) {
            filesToFix.push({ path: selectedFile.path, content: selectedFile.content || '' });
        } else {
            filesToFix = files.filter(f => f.type === 'file').map(f => ({ path: f.path, content: f.content || '' }));
        }

        if (filesToFix.length === 0) {
            alert("No files to fix.");
            setIsFixing(false);
            return;
        }
        
        try {
            // FIX: Pass API pool config to the AI service.
            const changes = await proposeFixes(description, filesToFix, project, apiConfig, apiPoolConfig, apiPoolKeys);
            setProposedFixes(changes);
        } catch (error) {
            alert(error instanceof Error ? `Error proposing fixes: ${error.message}` : 'An unknown error occurred.');
        } finally {
            setIsFixing(false);
        }
    };

    const handleApplyFixes = async () => {
        if (!proposedFixes) return;
        setIsFixing(true);
        try {
            await applyAiChanges(projectId, files, proposedFixes);
            await fetchProjectData();
            setDirtyFiles(new Set()); // Fixes applied, clear dirty state
            setIsDebugRefactorModalOpen(false);
            setProposedFixes(null);
        } catch (error) {
            alert(error instanceof Error ? `Error applying fixes: ${error.message}` : 'An unknown error occurred.');
        } finally {
            setIsFixing(false);
        }
    };
    
    // Sidebar resizing logic
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isResizing.current = true;
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isResizing.current) {
            let newWidth = e.clientX;
            if (newWidth < 350) newWidth = 350; // min width
            if (newWidth > 800) newWidth = 800; // max width
            setSidebarWidth(newWidth);
        }
    }, []);

    const handleMouseUp = useCallback(() => {
        isResizing.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }, []);
    
    // Vertical resizing logic
    const handleVerticalMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isResizingVertical.current = true;
        document.addEventListener('mousemove', handleVerticalMouseMove);
        document.addEventListener('mouseup', handleVerticalMouseUp);
    }, []);

    const handleVerticalMouseMove = useCallback((e: MouseEvent) => {
        if (isResizingVertical.current) {
            const totalHeight = window.innerHeight - 60; // Approximate height of the main area (screen - header)
            let newHeight = totalHeight - e.clientY;
            if (newHeight < 80) newHeight = 80; // min height
            if (newHeight > totalHeight - 200) newHeight = totalHeight - 200; // max height (leaves 200px for top panel)
            setBottomPanelHeight(newHeight);
        }
    }, []);

    const handleVerticalMouseUp = useCallback(() => {
        isResizingVertical.current = false;
        document.removeEventListener('mousemove', handleVerticalMouseMove);
        document.removeEventListener('mouseup', handleVerticalMouseUp);
    }, []);


    useEffect(() => {
        localStorage.setItem('sidebarWidth', sidebarWidth.toString());
        localStorage.setItem('bottomPanelHeight', bottomPanelHeight.toString());
    }, [sidebarWidth, bottomPanelHeight]);


    const MainContent = () => (
        <div className="h-full bg-base-100 flex flex-col">
            {isGeneratingInitialProject ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-neutral p-4">
                    <Spinner size="lg" />
                    <p className="mt-4 text-xl font-semibold">AI is building your project...</p>
                    <p className="text-md">This can take a minute. You can see progress in the Chat tab.</p>
                </div>
            ) : selectedFile ? (
                <CodeEditor
                    filePath={selectedFile.path}
                    content={selectedFile.content || ''}
                    onChange={handleFileContentChange}
                    isSavingFile={savingFile === selectedFile.path}
                    isDirty={dirtyFiles.has(selectedFile.path)}
                    onSave={handleSaveFile}
                />
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-neutral p-4 bg-base-100">
                    <CodeIcon className="w-16 h-16 text-base-300 mb-4" />
                    <h2 className="text-xl font-semibold text-base-content">No File Selected</h2>
                    <p>Select a file from the explorer to view or edit its content.</p>
                </div>
            )}
        </div>
    );
    
    if (isLoading && !project) {
        return <div className="flex items-center justify-center h-screen bg-base-100"><Spinner size="lg" /></div>;
    }

    return (
        <div className="h-screen w-screen flex flex-col bg-base-100 text-base-content">
            <Header
                user={user}
                project={project}
                onDownload={downloadProject}
                onApiKeyClick={() => setIsApiKeyModalOpen(true)}
                onSettingsClick={() => setIsSettingsModalOpen(true)}
                onUndo={() => {}} // Undo/Redo needs to be reworked for manual save
                onRedo={() => {}}
                canUndo={false}
                canRedo={false}
                onAnalyzeClick={handleAnalyzeProject}
                onBuildClick={() => setIsBuildModalOpen(true)}
                onAutoDevClick={() => {
                    setIsAutoDevModalOpen(true);
                    setAgentState({ status: 'idle', objective: '', plan: [], currentTaskIndex: -1, logs: [] });
                }}
                onDebugRefactorClick={() => {
                    setIsDebugRefactorModalOpen(true);
                    setProposedFixes(null);
                }}
                onBackToDashboard={onBackToDashboard}
                onTogglePreview={() => setIsPreviewOpen(p => !p)}
                onToggleConsole={() => setIsConsoleOpen(p => !p)}
                onProfileClick={() => setIsProfileModalOpen(true)}
                onShareClick={() => setIsShareModalOpen(true)}
            />
            <main className="flex-grow flex overflow-hidden">
                <div 
                    style={{ width: `${sidebarWidth}px` }} 
                    className="relative shrink-0 border-r border-base-300"
                >
                    <Sidebar 
                        files={files} 
                        selectedFilePath={selectedFilePath} 
                        onFileSelect={handleFileSelect}
                        onFileDelete={handleFileDelete}
                        onFileAdd={handleFileAdd}
                        onFileUpload={handleFileUpload}
                        chatMessages={chatMessages}
                        onSendMessage={handleSendMessage}
                        isAiLoading={isAiLoading}
                        onApprovePlan={handlePlanApproval}
                        onRejectPlan={handlePlanRejection}
                        activeTab={sidebarTab}
                        onTabChange={setSidebarTab}
                        isGenerating={isGeneratingInitialProject}
                    />
                    <div 
                        onMouseDown={handleMouseDown} 
                        className="absolute top-0 -right-1.5 w-3 h-full cursor-col-resize z-20 group"
                        title="Resize sidebar"
                    >
                        <div className="w-0.5 h-full bg-base-300 group-hover:bg-primary transition-colors duration-200 mx-auto"></div>
                    </div>
                </div>

                <div className="flex-grow flex flex-col overflow-hidden relative">
                    {/* Top Panel: Editor + Preview */}
                    <div className="flex-grow grid grid-cols-1 md:grid-cols-2 overflow-hidden" style={{ minHeight: '150px' }}>
                        <div className="h-full overflow-hidden">
                           <MainContent />
                        </div>
                        <div className={`h-full overflow-hidden transition-all duration-300 ${isPreviewOpen ? 'block' : 'hidden'}`}>
                           <SandboxPreview htmlContent={previewHtml} onRefresh={refreshPreview} />
                        </div>
                    </div>

                    {!isPreviewOpen && (
                         <div className="absolute right-4 bottom-4 z-20" style={{ bottom: isConsoleOpen ? `${bottomPanelHeight + 16}px` : '16px' }}>
                             <button onClick={() => setIsPreviewOpen(true)} className="px-4 py-2 bg-primary hover:opacity-90 rounded-md text-white font-semibold flex items-center gap-2">
                                <PlayIcon className="w-5 h-5"/> Show Preview
                             </button>
                         </div>
                    )}
                    
                    {/* Bottom Panel: Console */}
                    {isConsoleOpen && (
                        <>
                            <div 
                                onMouseDown={handleVerticalMouseDown}
                                className="w-full h-2 bg-base-300 cursor-row-resize hover:bg-primary/50 transition-colors z-20 group"
                                title="Resize console"
                            >
                               <div className="h-0.5 w-full bg-base-300 group-hover:bg-primary transition-colors duration-200" />
                            </div>
                            <div style={{ height: `${bottomPanelHeight}px` }} className="shrink-0 overflow-hidden">
                                <Console messages={consoleMessages} onClear={handleClearConsole} />
                            </div>
                        </>
                    )}
                </div>
            </main>

            <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} onSave={onApiConfigChange} currentConfig={apiConfig} />
            {project && <ProjectSettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} onSave={handleSaveSettings} project={project} />}
            <BuildModeModal isOpen={isBuildModalOpen} onClose={() => setIsBuildModalOpen(false)} onBuild={(prompt) => handleSendMessage(prompt, 'build')} isLoading={isAiLoading} />
            <AutonomousModeModal isOpen={isAutoDevModalOpen} onClose={() => setIsAutoDevModalOpen(false)} onStart={handleStartAgent} agentState={agentState} />
            <DebugRefactorModal isOpen={isDebugRefactorModalOpen} onClose={() => setIsDebugRefactorModalOpen(false)} onProposeFixes={handleProposeFixes} onApplyFixes={handleApplyFixes} isLoading={isFixing} proposedChanges={proposedFixes} selectedFile={selectedFile} />
             {user && <ProfileSettingsModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} user={user} />}
             {project && <ShareProjectModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} projectId={projectId} onGenerateKey={createShareKey} />}
        </div>
    );
};

export default EditorPage;