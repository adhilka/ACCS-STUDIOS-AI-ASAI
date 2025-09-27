import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FileNode, AiChatMessage, ApiConfig, User, Project, AgentState, AiChanges, AiProvider, AiPlan, ApiPoolConfig, ApiPoolKey, ConsoleMessage, TerminalOutput, ChatMessageSenderInfo } from '../types';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import CodeEditor from '../components/CodeEditor';
import SandboxPreview from '../components/SandboxPreview';
import ApiKeyModal from '../components/ApiKeyModal';
import ProjectSettingsModal from '../components/ProjectSettingsModal';
import BuildModeModal from '../components/BuildModeModal';
import AutonomousModeModal from '../components/AutonomousModeModal';
import Spinner from '../components/ui/Spinner';
import { generateModificationPlan, executeModificationPlan, analyzeCode, runAutonomousAgent, proposeFixes, runInitialProjectAgent, answerProjectQuestion, summarizeChangesForMemory, askGeneralQuestion } from '../services/aiService';
import { 
    addChatMessage, addFileOrFolder, deleteFileByPath, applyAiChanges, 
    getProjectDetails, updateProjectDetails, updateChatMessage, deleteProject, 
    copyProject, clearChatHistory, createShareKey, renameOrMovePath, 
    getUserProfile, updateFileContent, streamProjectDetails, streamProjectFiles, 
    streamChatHistory, getUsersProfiles, deleteChatMessage, getProjectFiles, getChatHistory, removeProjectMember, createInvite
} from '../services/firestoreService';
import { firestore, getSecondaryFirebaseApp } from '../services/firebase';
import { CodeIcon, PlayIcon, CommandLineIcon, ChevronRightIcon, ExternalLinkIcon, PaperClipIcon, PencilIcon, ArrowRightIcon, DeleteIcon, TrashIcon } from '../components/icons';
import DebugRefactorModal from '../components/DebugRefactorModal';
import ProfileSettingsModal from '../components/ProfileSettingsModal';
import ShareProjectModal from '../components/ShareProjectModal';
import Console from '../components/Console';
import Terminal from '../components/Terminal';
import ContextMenu, { ContextMenuItem } from '../components/ui/ContextMenu';
import DeploymentModal from '../components/DeploymentModal';
import ChatInterface from '../components/ChatInterface';
import MobileNavBar from '../components/MobileNavBar';
import FileExplorer from '../components/FileExplorer';

declare const JSZip: any;
declare const LZString: any;

const useMediaQuery = (query: string) => {
    const [matches, setMatches] = useState(false);
    useEffect(() => {
        const media = window.matchMedia(query);
        if (media.matches !== matches) {
            setMatches(media.matches);
        }
        const listener = () => setMatches(media.matches);
        window.addEventListener('resize', listener);
        return () => window.removeEventListener('resize', listener);
    }, [matches, query]);
    return matches;
};

interface EditorPageProps {
    projectId: string;
    onBackToDashboard: () => void;
    user: User;
    apiConfig: ApiConfig;
    onApiConfigChange: (config: ApiConfig) => void;
    initialGenerationTask?: { prompt: string; provider: AiProvider, model?: string } | null;
    onTaskConsumed: () => void;
    apiPoolConfig: ApiPoolConfig;
    apiPoolKeys: ApiPoolKey[];
    refreshUserProfile: () => void;
}

type MobileView = 'files' | 'chat' | 'editor' | 'preview';

const EditorPage: React.FC<EditorPageProps> = ({ projectId, onBackToDashboard, user, apiConfig, onApiConfigChange, initialGenerationTask, onTaskConsumed, apiPoolConfig, apiPoolKeys, refreshUserProfile }) => {
    const [project, setProject] = useState<Project | null>(null);
    const [files, setFiles] = useState<FileNode[]>([]);
    const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
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
    const [isDeploymentModalOpen, setIsDeploymentModalOpen] = useState(false);
    const [isDeploying, setIsDeploying] = useState(false);
    const [isFixing, setIsFixing] = useState(false);
    const [proposedFixes, setProposedFixes] = useState<AiChanges | null>(null);
    const [isPreviewPaneOpen, setIsPreviewPaneOpen] = useState(true);
    const [isFullScreenPreview, setIsFullScreenPreview] = useState(false);
    const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(false);
    const [activeBottomTab, setActiveBottomTab] = useState<'console' | 'terminal'>('console');
    const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
    const [agentState, setAgentState] = useState<AgentState>({ status: 'idle', objective: '', plan: [], currentTaskIndex: -1, logs: [] });
    const [isGeneratingInitialProject, setIsGeneratingInitialProject] = useState(false);
    const [sidebarTab, setSidebarTab] = useState<'files' | 'snapshots'>('files');
    const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());
    const [savingFile, setSavingFile] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, path: string } | null>(null);
    const [isCollaborationEnabled, setIsCollaborationEnabled] = useState(false);
    const [dbInstance, setDbInstance] = useState(firestore);
    const [projectMembers, setProjectMembers] = useState<ChatMessageSenderInfo[]>([]);
    const [migrationStatus, setMigrationStatus] = useState<string>('');
    
    const isOwner = user?.uid === project?.ownerId;
    const isMobile = useMediaQuery('(max-width: 1023px)');
    const [mobileView, setMobileView] = useState<MobileView>('files');

    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const savedWidth = localStorage.getItem('sidebarWidth');
        return savedWidth ? parseInt(savedWidth, 10) : 320;
    });
     const [chatPanelWidth, setChatPanelWidth] = useState(() => {
        const savedWidth = localStorage.getItem('chatPanelWidth');
        return savedWidth ? parseInt(savedWidth, 10) : 480;
    });
    const [bottomPanelHeight, setBottomPanelHeight] = useState(() => {
        const savedHeight = localStorage.getItem('bottomPanelHeight');
        return savedHeight ? parseInt(savedHeight, 10) : 250;
    });
    const [editorWidthPercent, setEditorWidthPercent] = useState(() => {
        const saved = localStorage.getItem('editorWidthPercent');
        return saved ? parseFloat(saved) : 50;
    });

    const isResizingSidebar = useRef(false);
    const isResizingChatPanel = useRef(false);
    const isResizingVertical = useRef(false);
    const isResizingMain = useRef(false);

    useEffect(() => {
        // This effect handles the DB instance logic and data migration if needed
        const setupDbInstance = async () => {
            setIsLoading(true);
            setMigrationStatus('');
            try {
                const initialProjectDetails = await getProjectDetails(projectId, firestore); // Always check primary DB first
                if (!initialProjectDetails) throw new Error("Project not found in the primary database.");
                
                setProject(initialProjectDetails); // Set initial project data to prevent UI flashing empty
    
                const ownerProfile = await getUserProfile(initialProjectDetails.ownerId);
                const customConfig = ownerProfile?.customFirebaseConfig;
    
                if (customConfig?.enabled && customConfig.apiKey && customConfig.projectId) {
                    console.log("Custom Firebase config enabled. Attempting connection...");
                    setIsCollaborationEnabled(true);
                    const secondaryApp = getSecondaryFirebaseApp(customConfig, initialProjectDetails.ownerId);
                    const secondaryDb = secondaryApp.firestore();
                    
                    await secondaryDb.collection('asai-connection-test').doc('test-doc').get();
                    console.log("Connection to custom server successful.");
    
                    const projectDocOnSecondary = await secondaryDb.collection('projects').doc(projectId).get();
                    if (!projectDocOnSecondary.exists) {
                        setMigrationStatus("First-time connection detected. Copying project data to your server... This may take a moment.");
                        
                        const [filesFromPrimary, chatFromPrimary] = await Promise.all([
                            getProjectFiles(projectId, firestore),
                            getChatHistory(projectId, firestore)
                        ]);
    
                        const batch = secondaryDb.batch();
                        const { id, ...projectData } = initialProjectDetails;
                        const secondaryProjectRef = secondaryDb.collection('projects').doc(projectId);
                        batch.set(secondaryProjectRef, projectData);
    
                        filesFromPrimary.forEach(file => {
                            const { id, ...fileData } = file;
                            batch.set(secondaryProjectRef.collection('files').doc(), fileData);
                        });
    
                        chatFromPrimary.forEach(msg => {
                            const { id, ...msgData } = msg;
                            batch.set(secondaryProjectRef.collection('chatHistory').doc(), msgData);
                        });
    
                        await batch.commit();
                        setMigrationStatus("Project data successfully copied. Finalizing connection...");
                        console.log("Migration complete.");
                    }
                    
                    setDbInstance(secondaryDb);
                } else {
                    console.log("Using primary Firebase instance.");
                    setIsCollaborationEnabled(false);
                    setDbInstance(firestore);
                }
            } catch (error) {
                console.error("Failed to initialize or connect to custom Firebase server:", error);
                alert("Could not connect to the project's custom server. Real-time collaboration is disabled. Please check the owner's configuration and security rules.");
                setIsCollaborationEnabled(false);
                setDbInstance(firestore); // Fallback to primary
            } finally {
                setMigrationStatus('');
            }
        };
    
        setupDbInstance();
    }, [projectId]);

    useEffect(() => {
        // This effect sets up all real-time listeners once the dbInstance is determined.
        const unsubProject = streamProjectDetails(projectId, (proj) => {
            setProject(proj);
        }, dbInstance);

        const unsubFiles = streamProjectFiles(projectId, (files) => {
            setFiles(files);
        }, dbInstance);

        const unsubChat = streamChatHistory(projectId, (messages) => {
            setChatMessages(messages);
        }, dbInstance);
        
        // A small delay helps ensure initial data is processed before hiding the loader.
        const timer = setTimeout(() => setIsLoading(false), 500);

        return () => {
            unsubProject();
            unsubFiles();
            unsubChat();
            clearTimeout(timer);
        };
    }, [projectId, dbInstance]);

    useEffect(() => {
        // Auto-select first file if none is selected and files are loaded
        if (!selectedFilePath && files.length > 0) {
            const entryFile = files.find(f => f.path.match(/app.tsx|index.tsx|index.html/i)) || files.find(f => f.type === 'file');
            if (entryFile) {
                setSelectedFilePath(entryFile.path);
            }
        }
    }, [files, selectedFilePath]);

     useEffect(() => {
        const fetchMemberProfiles = async () => {
            if (project && project.members.length > 0) {
                const profiles = await getUsersProfiles(project.members);
                setProjectMembers(profiles);
            } else {
                setProjectMembers([]);
            }
        };
        fetchMemberProfiles();
    }, [project]);
    
    useEffect(() => {
        const runInitialBuild = async () => {
            if (!initialGenerationTask || files.length > 0 || !project) return;
            
            onTaskConsumed();

            setIsGeneratingInitialProject(true);
            setIsAiLoading(true);
            if(isMobile) {
                setMobileView('chat');
            } else {
// FIX: The sidebar does not have a 'chat' tab. Switched to 'files' to show the generation progress spinner.
                setSidebarTab('files');
                setIsPreviewPaneOpen(true);
            }

            const { prompt, provider, model } = initialGenerationTask;
            
            const userMessage: Omit<AiChatMessage, 'id' | 'timestamp'> = { sender: 'user', text: `Build me this: "${prompt}"` };
            await addChatMessage(projectId, userMessage, dbInstance);

            const onAgentMessage = async (message: Omit<AiChatMessage, 'id' | 'timestamp' | 'sender'>) => {
                const agentMessage: Omit<AiChatMessage, 'id' | 'timestamp'> = { sender: 'ai', isAgentMessage: false, ...message };
                await addChatMessage(projectId, agentMessage, dbInstance);
            };

            try {
                const key = apiConfig[provider];
                if (!key && !apiPoolConfig.isEnabled) throw new Error(`API key for ${provider} is not configured.`);
                
                const { projectName, changes } = await runInitialProjectAgent(
                    prompt,
                    project.type,
                    provider,
                    model,
                    apiConfig,
                    onAgentMessage,
                    user.uid,
                    apiPoolConfig,
                    apiPoolKeys
                );

                await updateProjectDetails(projectId, projectName, prompt, model, 'stackblitz', provider, dbInstance);
                await applyAiChanges(projectId, [], changes, dbInstance);
                
                const summary = await summarizeChangesForMemory(prompt, { reasoning: 'Initial project generation' } as AiPlan, changes, project, apiConfig, user.uid, apiPoolConfig, apiPoolKeys);
                const memoryFile = files.find(f => f.path === ".asai/memory.md");
                const newMemoryContent = `### Initial Project Generation\n${summary}`;
                
                if (memoryFile) {
                    await updateFileContent(projectId, memoryFile.id, newMemoryContent, dbInstance);
                } else {
                    await addFileOrFolder(projectId, ".asai/memory.md", 'file', newMemoryContent, dbInstance);
                }
                
                setSidebarTab('files');
            } catch (err) {
                const message = err instanceof Error ? err.message : "An unknown error occurred during project generation.";
                await addChatMessage(projectId, { sender: 'ai', text: `Sorry, I ran into a problem: ${message}` }, dbInstance);
                setSidebarTab('files');
            } finally {
                setIsAiLoading(false);
                setIsGeneratingInitialProject(false);
            }
        };

        runInitialBuild();
    }, [initialGenerationTask, files, project, onTaskConsumed, projectId, apiConfig, isMobile, user.uid, apiPoolConfig, apiPoolKeys, dbInstance]);


    const handleFileSelect = (path: string) => {
        setSelectedFilePath(path);
        if (isMobile) {
            const file = files.find(f => f.path === path);
            if (file?.type === 'file') {
                setMobileView('editor');
            }
        }
    };
    
    const handleFileAdd = async (parentPath: string, type: 'file' | 'folder') => {
        const name = prompt(`Enter the name for the new ${type}:`);
        if (name) {
            const newPath = parentPath ? `${parentPath}/${name}` : name;
            await addFileOrFolder(projectId, newPath, type, type === 'file' ? '' : undefined, dbInstance);
        }
    };

    const handleFileDelete = async (path: string) => {
        if (window.confirm(`Are you sure you want to delete ${path}? This cannot be undone.`)) {
            await deleteFileByPath(projectId, path, dbInstance);
            if (selectedFilePath === path) {
                setSelectedFilePath(null);
            }
        }
    };
    
    const handleFileUpload = async (file: File, parentPath: string) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const content = e.target?.result as string;
            const newPath = parentPath ? `${parentPath}/${file.name}` : file.name;
            await addFileOrFolder(projectId, newPath, 'file', content, dbInstance);
            setSelectedFilePath(newPath);
        };
        reader.readAsText(file);
    };

    const handleSendMessage = async (message: string, mode: 'build' | 'ask' | 'general') => {
        if (!project) return;
        setIsAiLoading(true);

        const userMessage: Omit<AiChatMessage, 'id' | 'timestamp'> = { sender: 'user', text: message };
        await addChatMessage(projectId, userMessage, dbInstance);

        try {
            const key = apiConfig[project.provider];
            if (!key && !apiPoolConfig.isEnabled) throw new Error(`API key for ${project.provider} is not configured.`);

            if (mode === 'general') {
                const answer = await askGeneralQuestion(message, project.provider, project.model, apiConfig, user.uid, apiPoolConfig, apiPoolKeys);
                await addChatMessage(projectId, { sender: 'ai', text: answer }, dbInstance);
            } else if (mode === 'ask') {
                const answer = await answerProjectQuestion(message, files, project, apiConfig, user.uid, apiPoolConfig, apiPoolKeys);
                await addChatMessage(projectId, { sender: 'ai', text: answer }, dbInstance);
            } else { // build mode
                const plan = await generateModificationPlan(message, files, project, apiConfig, user.uid, apiPoolConfig, apiPoolKeys);
                 if(plan.plan.special_action) {
                    const { action, payload, confirmation_prompt } = plan.plan.special_action;
                    if(window.confirm(confirmation_prompt || `Are you sure you want to perform the action: ${action}?`)) {
                        switch(action) {
                            case 'DELETE_PROJECT':
                                await deleteProject(projectId);
                                onBackToDashboard();
                                return; // Stop execution here
                            case 'COPY_PROJECT':
                                const newProjectId = await copyProject(projectId, payload?.newName || `${project.name} Copy`, user.uid);
                                await addChatMessage(newProjectId, { sender: 'ai', text: `This project was copied from ${project.name}.` });
                                await addChatMessage(projectId, { sender: 'ai', text: `Project successfully copied. The new project is named "${payload?.newName || `${project.name} Copy`}".` }, dbInstance);
                                break;
                            case 'RENAME_PROJECT':
                                if (payload?.newName) {
                                    await updateProjectDetails(projectId, payload.newName, project.prompt || '', project.model, project.sandboxType, project.provider, dbInstance);
                                }
                                break;
                            case 'CLEAR_CHAT_HISTORY':
                                await clearChatHistory(projectId, dbInstance);
                                break;
                        }
                    }
                } else {
                    await addChatMessage(projectId, { sender: 'ai', text: 'Here is the plan I came up with:', plan, planStatus: 'pending' }, dbInstance);
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            await addChatMessage(projectId, { sender: 'ai', text: `Sorry, I ran into a problem: ${errorMessage}` }, dbInstance);
        } finally {
            setIsAiLoading(false);
        }
    };
    
    const handleSendRichMessage = async (messageData: Partial<Omit<AiChatMessage, 'id' | 'timestamp' | 'sender'>>) => {
        const senderInfo: ChatMessageSenderInfo = {
            uid: user.uid,
            displayName: user.displayName || user.email || null,
            photoURL: user.photoURL || null,
        };
        const message: Omit<AiChatMessage, 'id' | 'timestamp'> = {
            sender: 'user',
            senderInfo,
            text: '', // default empty text
            ...messageData,
        };
        await addChatMessage(projectId, message, dbInstance);
    };

    const handleApprovePlan = async (messageId: string) => {
        const message = chatMessages.find(m => m.id === messageId);
        if (!message || !message.plan || !project) return;

        setIsAiLoading(true);
        await updateChatMessage(projectId, messageId, { planStatus: 'executing' }, dbInstance);

        try {
            const changes = await executeModificationPlan(message.text, message.plan, files, project, apiConfig, user.uid, apiPoolConfig, apiPoolKeys);
            await applyAiChanges(projectId, files, changes, dbInstance);
            
            const summary = await summarizeChangesForMemory(message.text, message.plan, changes, project, apiConfig, user.uid, apiPoolConfig, apiPoolKeys);
            const memoryFile = files.find(f => f.path === ".asai/memory.md");
            
            if (memoryFile) {
                const newMemoryContent = `${memoryFile.content || ''}\n\n---\n\n${new Date().toISOString()}\n\n${summary}`;
                const fileToUpdate = files.find(f => f.path === ".asai/memory.md");
                if(fileToUpdate) {
                    await updateFileContent(projectId, fileToUpdate.id, newMemoryContent, dbInstance);
                }
            } else {
                await addFileOrFolder(projectId, ".asai/memory.md", 'file', `### Initial Memory\n\n${summary}`, dbInstance);
            }
            
            await updateChatMessage(projectId, messageId, { planStatus: 'approved' }, dbInstance);
            await addChatMessage(projectId, { sender: 'ai', text: "I have successfully applied the changes." }, dbInstance);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during execution.";
            await updateChatMessage(projectId, messageId, { planStatus: 'pending' }, dbInstance); // Revert status
            await addChatMessage(projectId, { sender: 'ai', text: `I encountered an error while applying the changes: ${errorMessage}` }, dbInstance);
        } finally {
            setIsAiLoading(false);
        }
    };
    
    const handleRejectPlan = async (messageId: string) => {
        await updateChatMessage(projectId, messageId, { planStatus: 'rejected' }, dbInstance);
    };

    const handleDownload = async () => {
        if (!project) return;
        const zip = new JSZip();
        files.forEach(file => {
            if(file.type === 'file') {
                 zip.file(file.path, file.content || '');
            } else {
                 zip.folder(file.path);
            }
        });
        const content = await zip.generateAsync({ type: "blob" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(content);
        link.download = `${project.name.replace(/ /g, '_')}.zip`;
        link.click();
    };

    const handleSaveSettings = async (name: string, prompt: string, model?: string, sandboxType?: 'iframe' | 'stackblitz', provider?: AiProvider) => {
        if (!project) return;
        setIsAiLoading(true);
        try {
            await updateProjectDetails(projectId, name, prompt, model, sandboxType, provider, dbInstance);
            setIsSettingsModalOpen(false);
        } catch (error) {
            console.error("Failed to save project settings:", error);
            alert("Error saving settings.");
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleAnalyzeCode = async () => {
        if (!project) return;
        setIsAiLoading(true);
        const userMessage: Omit<AiChatMessage, 'id' | 'timestamp'> = { sender: 'user', text: "Please analyze the entire project for bugs, improvements, and best practices." };
        await addChatMessage(projectId, userMessage, dbInstance);
        try {
            const analysis = await analyzeCode(files, project, apiConfig, user.uid, apiPoolConfig, apiPoolKeys);
            await addChatMessage(projectId, { sender: 'ai', text: analysis }, dbInstance);
        } catch(err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during analysis.";
            await addChatMessage(projectId, { sender: 'ai', text: `Sorry, I ran into a problem during analysis: ${errorMessage}` }, dbInstance);
        } finally {
            setIsAiLoading(false);
        }
    }
    
    const handleProposeFixes = async (description: string, scope: 'file' | 'project') => {
        if (!project) return;
        setIsFixing(true);
        setProposedFixes(null);
        try {
            let filesToFix: { path: string; content: string }[] = [];
            if (scope === 'file' && selectedFilePath) {
                const file = files.find(f => f.path === selectedFilePath);
                if (file) filesToFix.push({ path: file.path, content: file.content || '' });
            } else { // project scope
                filesToFix = files.filter(f => f.type === 'file').map(f => ({ path: f.path, content: f.content || '' }));
            }
            if (filesToFix.length === 0) throw new Error("No files selected or found for the chosen scope.");
            const fixes = await proposeFixes(description, filesToFix, project, apiConfig, user.uid, apiPoolConfig, apiPoolKeys);
            setProposedFixes(fixes);
        } catch (err) {
             const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
             alert(`Error proposing fixes: ${errorMessage}`);
        } finally {
            setIsFixing(false);
        }
    };

    const handleApplyFixes = async () => {
        if (!proposedFixes || !project) return;
        setIsFixing(true);
        try {
            await applyAiChanges(projectId, files, proposedFixes, dbInstance);
            setProposedFixes(null);
            setIsDebugRefactorModalOpen(false);
            alert("Fixes applied successfully!");
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            alert(`Error applying fixes: ${errorMessage}`);
        } finally {
            setIsFixing(false);
        }
    };
    
    // FIX: This wrapper function correctly handles partial state updates from the AI service,
    // resolving the TypeScript error where `setAgentState` was incompatible with the expected callback signature.
    const handleStartAutoDev = async (objective: string) => {
        if (!project) return;
        setIsAiLoading(true);
        setAgentState({ status: 'running', objective, plan: [], currentTaskIndex: -1, logs: [`Objective set: ${objective}`] });
        
        const onAgentMessage = async (message: Omit<AiChatMessage, 'id' | 'timestamp' | 'sender'>) => {
            const agentMessage: Omit<AiChatMessage, 'id' | 'timestamp'> = { sender: 'ai', isAgentMessage: true, ...message };
            await addChatMessage(projectId, agentMessage, dbInstance);
        };
        
        const handleAgentStateChange = (stateUpdate: Partial<AgentState>) => {
            setAgentState(prevState => {
                const newState = { ...prevState, ...stateUpdate };
                // Append logs instead of replacing them, as the service sends log snippets.
                if (stateUpdate.logs) {
                    newState.logs = [...prevState.logs, ...stateUpdate.logs];
                }
                return newState;
            });
        };
        
        try {
            const finalFiles = await runAutonomousAgent(objective, files, project, apiConfig, handleAgentStateChange, onAgentMessage, user.uid, apiPoolConfig, apiPoolKeys);
            
            // This is a bit tricky, we need to calculate the diff and apply it
            const finalFileMap = new Map(finalFiles.map(f => [f.path, f]));
            const initialFileMap = new Map(files.map(f => [f.path, f]));
            const changes: AiChanges = { create: {}, update: {}, delete: [] };

            finalFileMap.forEach((file, path) => {
                if (!initialFileMap.has(path)) {
                    changes.create![path] = file.content!;
                } else if (initialFileMap.get(path)!.content !== file.content) {
                    changes.update![path] = file.content!;
                }
            });

            initialFileMap.forEach((file, path) => {
                if (!finalFileMap.has(path)) {
                    changes.delete!.push(path);
                }
            });

            await applyAiChanges(projectId, files, changes, dbInstance);
             await addChatMessage(projectId, { sender: 'ai', text: "Autonomous agent has completed the objective." }, dbInstance);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            // The agent service updates the state on error before throwing, so we only need to add the chat message.
             await addChatMessage(projectId, { sender: 'ai', text: `Agent stopped due to an error: ${errorMessage}` }, dbInstance);
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleGenerateShareKey = async (pid: string) => {
        return createShareKey(pid);
    };

    const handleRemoveMember = async (memberUid: string) => {
        if (!project || !isOwner) return;
        if (memberUid === user.uid) {
            alert("You cannot remove yourself from the project.");
            return;
        }
        if (window.confirm("Are you sure you want to remove this member from the project? Their access will be revoked immediately.")) {
            try {
                await removeProjectMember(projectId, memberUid);
            } catch (error) {
                console.error("Failed to remove member:", error);
                alert("Error: Could not remove member.");
            }
        }
    };

    const handleCreateInvite = async (email: string): Promise<string> => {
        if (!project || !isOwner) {
            throw new Error("You do not have permission to invite members.");
        }
        try {
            const inviteCode = await createInvite(projectId, user.uid, email);
            return inviteCode;
        } catch (error) {
            console.error("Failed to create invite:", error);
            throw new Error("Could not create invite. Please try again.");
        }
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isResizingSidebar.current) {
            const newWidth = e.clientX;
            if (newWidth > 200 && newWidth < 600) {
                setSidebarWidth(newWidth);
            }
        }
        if (isResizingChatPanel.current) {
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth > 300 && newWidth < 800) {
                 setChatPanelWidth(newWidth);
            }
        }
         if (isResizingVertical.current) {
            const newHeight = window.innerHeight - e.clientY;
            if (newHeight > 100 && newHeight < window.innerHeight - 200) {
                setBottomPanelHeight(newHeight);
            }
        }
         if (isResizingMain.current) {
            const mainPanel = document.getElementById('main-panel');
            if(mainPanel) {
                const rect = mainPanel.getBoundingClientRect();
                const newPercent = ((e.clientX - rect.left) / rect.width) * 100;
                if (newPercent > 20 && newPercent < 80) {
                    setEditorWidthPercent(newPercent);
                }
            }
        }
    }, []);

    const handleMouseUp = useCallback(() => {
        isResizingSidebar.current = false;
        isResizingChatPanel.current = false;
        isResizingVertical.current = false;
        isResizingMain.current = false;
        document.body.style.cursor = 'default';
        localStorage.setItem('sidebarWidth', sidebarWidth.toString());
        localStorage.setItem('chatPanelWidth', chatPanelWidth.toString());
        localStorage.setItem('bottomPanelHeight', bottomPanelHeight.toString());
        localStorage.setItem('editorWidthPercent', editorWidthPercent.toString());
    }, [sidebarWidth, chatPanelWidth, bottomPanelHeight, editorWidthPercent]);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);


    // Undo/Redo is not implemented yet. Placeholder.
    const [history, setHistory] = useState<FileNode[][]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const canUndo = false; // historyIndex > 0;
    const canRedo = false; // historyIndex < history.length - 1;
    const handleUndo = () => {};
    const handleRedo = () => {};

    const selectedFile = useMemo(() => files.find(f => f.path === selectedFilePath), [files, selectedFilePath]);
    
     const handleFileContentChange = (newContent: string) => {
        if (selectedFile) {
            // Update local state for instant UI feedback
            setFiles(prevFiles =>
                prevFiles.map(f =>
                    f.path === selectedFile.path ? { ...f, content: newContent } : f
                )
            );
            // Mark file as dirty
            setDirtyFiles(prev => new Set(prev).add(selectedFile.path));
        }
    };

    const handleSaveFile = async (filePath: string) => {
        const fileToSave = files.find(f => f.path === filePath);
        if (fileToSave && dirtyFiles.has(filePath)) {
            setSavingFile(filePath);
            try {
                await updateFileContent(projectId, fileToSave.id, fileToSave.content || '', dbInstance);
                setDirtyFiles(prev => {
                    const newDirty = new Set(prev);
                    newDirty.delete(filePath);
                    return newDirty;
                });
            } catch (err) {
                console.error("Failed to save file:", err);
                alert("Error saving file. See console for details.");
            } finally {
                setSavingFile(null);
            }
        }
    };
    
    const handleContextMenuRequest = (path: string, x: number, y: number) => {
        setContextMenu({ path, x, y });
    };

    const handleRenameFile = async (path: string) => {
        const newName = prompt("Enter new name:", path.split('/').pop());
        if (newName) {
            const parentPath = path.substring(0, path.lastIndexOf('/'));
            const newPath = parentPath ? `${parentPath}/${newName}` : newName;
            try {
                await renameOrMovePath(projectId, path, newPath, dbInstance);
                if (selectedFilePath === path) {
                    setSelectedFilePath(newPath);
                }
            } catch(e) {
                alert(`Error renaming: ${e instanceof Error ? e.message : 'Unknown error'}`);
            }
        }
    };
    
    const handlePinToChat = (path: string) => {
        handleSendRichMessage({
            type: 'file_pin',
            filePath: path,
            text: `Pinned file: ${path}`
        });
    };
    
    const contextMenuItems = useMemo((): ContextMenuItem[] => {
        if (!contextMenu) return [];
        return [
            { label: 'Pin to Chat', icon: <PaperClipIcon className="w-4 h-4" />, action: () => handlePinToChat(contextMenu.path) },
            { label: 'Rename', icon: <PencilIcon className="w-4 h-4" />, action: () => handleRenameFile(contextMenu.path) },
            { label: 'Copy Path', icon: <ArrowRightIcon className="w-4 h-4" />, action: () => navigator.clipboard.writeText(contextMenu.path) },
            { label: 'Delete', icon: <TrashIcon className="w-4 h-4 text-red-400" />, action: () => handleFileDelete(contextMenu.path) },
        ];
    }, [contextMenu, handlePinToChat, handleRenameFile, handleFileDelete]);


    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-base-100">
                <Spinner size="lg" />
                <p className="mt-4 text-base-content">{migrationStatus || 'Loading Project...'}</p>
            </div>
        );
    }
    
    if (!project) {
        return (
             <div className="flex flex-col items-center justify-center h-screen bg-base-100">
                <p className="text-red-400 text-lg">Error: Project not found.</p>
                <button onClick={onBackToDashboard} className="mt-4 px-4 py-2 bg-primary text-white rounded-md">
                    Back to Dashboard
                </button>
            </div>
        );
    }

    if (isMobile) {
        const CurrentView = () => {
            switch(mobileView) {
                case 'files': return <FileExplorer files={files} selectedFilePath={selectedFilePath} onFileSelect={handleFileSelect} onFileDelete={handleFileDelete} onFileAdd={handleFileAdd} onFileUpload={handleFileUpload} onContextMenuRequest={handleContextMenuRequest} />;
                case 'chat': return <ChatInterface messages={chatMessages} onSendMessage={handleSendMessage} isLoading={isAiLoading} onApprovePlan={handleApprovePlan} onRejectPlan={handleRejectPlan} projectMembers={projectMembers} currentUser={user} isOwner={isOwner} files={files} project={project} apiConfig={apiConfig} apiPoolConfig={apiPoolConfig} apiPoolKeys={apiPoolKeys} currentUserId={user.uid} onSendRichMessage={handleSendRichMessage} onDeleteMessage={(id) => deleteChatMessage(projectId, id, dbInstance)} onOpenFileFromPin={handleFileSelect}/>;
                case 'editor': return selectedFile ? <CodeEditor filePath={selectedFile.path} content={selectedFile.content || ''} onChange={handleFileContentChange} onSave={handleSaveFile} isDirty={dirtyFiles.has(selectedFile.path)} isSavingFile={savingFile === selectedFile.path} isMobile onBack={() => setMobileView('files')} /> : <div className="p-4 text-center text-neutral">Select a file to edit.</div>;
                case 'preview': return <SandboxPreview files={files} projectType={project.type} isMobile />;
                default: return <FileExplorer files={files} selectedFilePath={selectedFilePath} onFileSelect={handleFileSelect} onFileDelete={handleFileDelete} onFileAdd={handleFileAdd} onFileUpload={handleFileUpload} onContextMenuRequest={handleContextMenuRequest} />;
            }
        }

        return (
            <div className="h-screen w-screen flex flex-col bg-base-100 overflow-hidden">
                <Header 
                    user={user} project={project} onDownload={handleDownload} onApiKeyClick={() => setIsApiKeyModalOpen(true)}
                    onSettingsClick={() => setIsSettingsModalOpen(true)} onUndo={handleUndo} onRedo={handleRedo}
                    canUndo={canUndo} canRedo={canRedo} onAnalyzeClick={handleAnalyzeCode}
                    onBuildClick={() => setIsBuildModalOpen(true)} onAutoDevClick={() => setIsAutoDevModalOpen(true)}
                    onDebugRefactorClick={() => setIsDebugRefactorModalOpen(true)} onBackToDashboard={onBackToDashboard}
                    onTogglePreview={() => setMobileView('preview')} onToggleFullScreenPreview={() => setMobileView('preview')}
                    onToggleBottomPanel={() => {}} onProfileClick={() => setIsProfileModalOpen(true)} onShareClick={() => setIsShareModalOpen(true)}
                    onDeployClick={() => setIsDeploymentModalOpen(true)}
                    isAiLoading={isAiLoading} isMobile
                />
                <main className="flex-grow overflow-y-auto">
                    <CurrentView />
                </main>
                <MobileNavBar activeView={mobileView} onViewChange={setMobileView} isEditorDisabled={!selectedFilePath} />
            </div>
        )
    }

    return (
        <div className="h-screen w-screen flex flex-col bg-base-100 overflow-hidden">
            <Header 
                user={user} project={project} onDownload={handleDownload} onApiKeyClick={() => setIsApiKeyModalOpen(true)}
                onSettingsClick={() => setIsSettingsModalOpen(true)} onUndo={handleUndo} onRedo={handleRedo}
                canUndo={canUndo} canRedo={canRedo} onAnalyzeClick={handleAnalyzeCode}
                onBuildClick={() => setIsBuildModalOpen(true)} onAutoDevClick={() => setIsAutoDevModalOpen(true)}
                onDebugRefactorClick={() => setIsDebugRefactorModalOpen(true)} onBackToDashboard={onBackToDashboard}
                onTogglePreview={() => setIsPreviewPaneOpen(!isPreviewPaneOpen)} onToggleFullScreenPreview={() => setIsFullScreenPreview(true)}
                onToggleBottomPanel={() => setIsBottomPanelOpen(!isBottomPanelOpen)} onProfileClick={() => setIsProfileModalOpen(true)}
                onShareClick={() => setIsShareModalOpen(true)}
                onDeployClick={() => setIsDeploymentModalOpen(true)}
                isAiLoading={isAiLoading} isMobile={false}
            />
            <main className="flex-grow flex overflow-hidden">
                <div style={{ width: `${sidebarWidth}px` }} className="shrink-0 h-full">
                   <Sidebar 
                        files={files}
                        selectedFilePath={selectedFilePath}
                        onFileSelect={handleFileSelect}
                        onFileDelete={handleFileDelete}
                        onFileAdd={handleFileAdd}
                        onFileUpload={handleFileUpload}
                        activeTab={sidebarTab}
                        onTabChange={setSidebarTab}
                        isGenerating={isGeneratingInitialProject}
                        onContextMenuRequest={handleContextMenuRequest}
                        isCollaborationEnabled={isCollaborationEnabled}
                    />
                </div>
                 <div onMouseDown={() => {isResizingSidebar.current = true; document.body.style.cursor = 'col-resize';}} className="w-1.5 h-full cursor-col-resize bg-base-300 hover:bg-primary transition-colors shrink-0"></div>
                
                <div id="main-panel" className="flex-grow flex flex-col overflow-hidden">
                    <div className="flex-grow flex overflow-hidden">
                        <div style={{ width: `${editorWidthPercent}%`}} className="h-full flex flex-col">
                            {selectedFile ? (
                                <CodeEditor filePath={selectedFile.path} content={selectedFile.content || ''} onChange={handleFileContentChange} onSave={handleSaveFile} isDirty={dirtyFiles.has(selectedFile.path)} isSavingFile={savingFile === selectedFile.path} />
                            ) : (
                                <div className="h-full flex items-center justify-center text-center text-neutral p-4">
                                    <div className="flex flex-col items-center">
                                        <CodeIcon className="w-16 h-16 text-base-300 mb-4" />
                                        <p className="font-semibold text-lg">No file selected</p>
                                        <p>Select a file from the explorer to begin editing.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div onMouseDown={() => {isResizingMain.current = true; document.body.style.cursor = 'col-resize';}} className="w-1.5 h-full cursor-col-resize bg-base-300 hover:bg-primary transition-colors"></div>
                        <div className="flex-grow h-full" style={{ display: isPreviewPaneOpen ? 'block' : 'none' }}>
                             <SandboxPreview files={files} projectType={project.type} />
                        </div>
                    </div>
                     {isBottomPanelOpen && (
                        <>
                             <div onMouseDown={() => {isResizingVertical.current = true; document.body.style.cursor = 'row-resize';}} className="h-1.5 w-full cursor-row-resize bg-base-300 hover:bg-primary transition-colors"></div>
                            <div style={{ height: `${bottomPanelHeight}px`}} className="w-full shrink-0">
                                <Console messages={consoleMessages} onClear={() => setConsoleMessages([])} />
                            </div>
                        </>
                    )}
                </div>

                <div onMouseDown={() => {isResizingChatPanel.current = true; document.body.style.cursor = 'col-resize';}} className="w-1.5 h-full cursor-col-resize bg-base-300 hover:bg-primary transition-colors shrink-0"></div>
                <div style={{ width: `${chatPanelWidth}px` }} className="shrink-0 h-full">
                    <ChatInterface 
                        messages={chatMessages}
                        onSendMessage={handleSendMessage}
                        isLoading={isAiLoading}
                        onApprovePlan={handleApprovePlan}
                        onRejectPlan={handleRejectPlan}
                        projectMembers={projectMembers}
                        currentUser={user}
                        isOwner={isOwner}
                        files={files}
                        project={project}
                        apiConfig={apiConfig}
                        apiPoolConfig={apiPoolConfig}
                        apiPoolKeys={apiPoolKeys}
                        currentUserId={user.uid}
                        onSendRichMessage={handleSendRichMessage}
                        onDeleteMessage={(id) => deleteChatMessage(projectId, id, dbInstance)}
                        onOpenFileFromPin={handleFileSelect}
                    />
                </div>
            </main>

            <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} onSave={onApiConfigChange} currentConfig={apiConfig} />
            <ProjectSettingsModal 
                isOpen={isSettingsModalOpen} 
                onClose={() => setIsSettingsModalOpen(false)} 
                onSave={handleSaveSettings} 
                project={project} 
                isSaving={isAiLoading}
                members={projectMembers}
                onRemoveMember={handleRemoveMember}
                onCreateInvite={handleCreateInvite}
            />
            <BuildModeModal isOpen={isBuildModalOpen} onClose={() => setIsBuildModalOpen(false)} onBuild={(prompt) => handleSendMessage(prompt, 'build')} isLoading={isAiLoading} />
            <AutonomousModeModal isOpen={isAutoDevModalOpen} onClose={() => {setAgentState({ status: 'idle', objective: '', plan: [], currentTaskIndex: -1, logs: [] }); setIsAutoDevModalOpen(false)}} onStart={handleStartAutoDev} agentState={agentState} />
            <DebugRefactorModal isOpen={isDebugRefactorModalOpen} onClose={() => {setProposedFixes(null); setIsDebugRefactorModalOpen(false)}} onProposeFixes={handleProposeFixes} onApplyFixes={handleApplyFixes} isLoading={isFixing} proposedChanges={proposedFixes} selectedFile={selectedFile} />
            <ProfileSettingsModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} user={user} onUpdateSuccess={refreshUserProfile} />
            <ShareProjectModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} projectId={projectId} onGenerateKey={handleGenerateShareKey} isCollaborationEnabled={isCollaborationEnabled} ownerUid={project.ownerId} />
            <DeploymentModal isOpen={isDeploymentModalOpen} onClose={() => setIsDeploymentModalOpen(false)} onDeployCodeSandbox={()=>{}} isDeploying={isDeploying} />
            {isFullScreenPreview && <SandboxPreview files={files} projectType={project.type} isFullScreen onCloseFullScreen={() => setIsFullScreenPreview(false)} />}
            {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenuItems} onClose={() => setContextMenu(null)} />}
        </div>
    );
};

export default EditorPage;
