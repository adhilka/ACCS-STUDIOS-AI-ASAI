import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FileNode, AiChatMessage, ApiConfig, User, Project, AgentState, AiChanges, AiProvider, AiPlan, ApiPoolConfig, ApiPoolKey, ConsoleMessage, TerminalOutput, ChatMessageSenderInfo, Snapshot, AiGodModeAction } from '../types';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import CodeEditor from '../components/CodeEditor';
import SandboxPreview from '../components/SandboxPreview';
import ApiKeyModal from '../components/ApiKeyModal';
import ProjectSettingsModal from '../components/ProjectSettingsModal';
import BuildModeModal from '../components/BuildModeModal';
import AutonomousModeModal from '../components/AutonomousModeModal';
import Spinner from '../components/ui/Spinner';
import { generateModificationPlan, executeModificationPlan, analyzeCode, runAutonomousAgent, proposeFixes, runInitialProjectAgent, answerProjectQuestion, summarizeChangesForMemory, askGeneralQuestion, generateSvgAsset, godModePlanner } from '../services/aiService';
import { 
    addChatMessage, addFileOrFolder, deleteFileByPath, applyAiChanges, 
    getProjectDetails, updateProjectDetails, updateChatMessage, deleteProject, 
    copyProject, clearChatHistory, createShareKey, renameOrMovePath, 
    getUserProfile, updateFileContent, streamProjectDetails, streamProjectFiles, 
    streamChatHistory, getUsersProfiles, deleteChatMessage, getProjectFiles, getChatHistory, removeProjectMember, createInvite,
    streamSnapshots, createSnapshot, deleteSnapshot
} from '../services/firestoreService';
import { firestore, getSecondaryFirebaseApp } from '../services/firebase';
import { CodeIcon, PlayIcon, CommandLineIcon, ChevronRightIcon, ExternalLinkIcon, PaperClipIcon, PencilIcon, ArrowRightIcon, DeleteIcon, TrashIcon, DocumentDuplicateIcon } from '../components/icons';
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
import SvgDesignModal from '../components/SvgDesignModal';
import TodoListPanel from '../components/TodoListPanel';
// FIX: Import GodModeModal to be used in the component.
import GodModeModal from '../components/GodModeModal';
import GodModeStatus from '../components/GodModeStatus';
import { useAlert } from '../contexts/AlertContext';

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

type MobileView = 'files' | 'chat' | 'todo' | 'editor' | 'preview';

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
    const [isSvgDesignModalOpen, setIsSvgDesignModalOpen] = useState(false);
    const [isGodModeModalOpen, setIsGodModeModalOpen] = useState(false);
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
    const [sidebarTab, setSidebarTab] = useState<'files' | 'chat' | 'snapshots' | 'todo'>('files');
    const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());
    const [savingFile, setSavingFile] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, path: string } | null>(null);
    const [isCollaborationEnabled, setIsCollaborationEnabled] = useState(false);
    const [dbInstance, setDbInstance] = useState(firestore);
    const [projectMembers, setProjectMembers] = useState<ChatMessageSenderInfo[]>([]);
    const [migrationStatus, setMigrationStatus] = useState<string>('');
    const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
    
    const [godModeActionQueue, setGodModeActionQueue] = useState<AiGodModeAction[]>([]);
    const [currentGodModeAction, setCurrentGodModeAction] = useState<AiGodModeAction | null>(null);
    const [isGodModeActive, setIsGodModeActive] = useState(false);
    const { showAlert } = useAlert();
    
    const chatMessageRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

    const isOwner = user?.uid === project?.ownerId;
    const isMobile = useMediaQuery('(max-width: 1023px)');
    const [mobileView, setMobileView] = useState<MobileView>('files');

    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const savedWidth = localStorage.getItem('sidebarWidth');
        return savedWidth ? parseInt(savedWidth, 10) : 320;
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
    const isResizingVertical = useRef(false);
    const isResizingMain = useRef(false);

    const findFileMentions = (text: string, projectFiles: FileNode[]): string[] => {
        if (!text) return [];
        const filePaths = new Set(projectFiles.map(f => f.path));
        const foundPaths = new Set<string>();

        const backtickRegex = /`([^`]+)`/g;
        let match;
        while ((match = backtickRegex.exec(text)) !== null) {
            const potentialPath = match[1].trim();
            if (filePaths.has(potentialPath)) {
                foundPaths.add(potentialPath);
            }
        }

        return Array.from(foundPaths);
    };
    
    const addAndParseAiMessage = async (message: Omit<AiChatMessage, 'id' | 'timestamp'>) => {
        await addChatMessage(projectId, message, dbInstance);
        
        if (message.text && message.sender === 'ai') {
            const mentionedFiles = findFileMentions(message.text, files);
            
            for (const path of mentionedFiles) {
                 await addChatMessage(projectId, {
                    sender: 'ai',
                    type: 'file_pin',
                    filePath: path,
                    text: `Reference to \`${path}\``,
                    ...(message.isAgentMessage && { isAgentMessage: true })
                }, dbInstance);
            }
        }
    };


    useEffect(() => {
        let isMounted = true;
        const unsubscribers: (() => void)[] = [];
    
        const initialize = async () => {
            if (!isMounted) return;
            setIsLoading(true);
            setMigrationStatus('');
    
            try {
                const initialProjectDetails = await getProjectDetails(projectId, firestore);
                if (!initialProjectDetails) throw new Error("Project not found in the primary database.");
                
                if (isMounted) setProject(initialProjectDetails);
    
                const ownerProfile = await getUserProfile(initialProjectDetails.ownerId);
                const customConfig = ownerProfile?.customFirebaseConfig;
    
                let finalDb = firestore;
                let collabEnabled = false;
    
                if (customConfig?.enabled && customConfig.apiKey && customConfig.projectId) {
                    try {
                        console.log("Custom Firebase config enabled. Attempting connection...");
                        const secondaryApp = getSecondaryFirebaseApp(customConfig, initialProjectDetails.ownerId);
                        const secondaryDb = secondaryApp.firestore();
                        
                        await secondaryDb.collection('asai-connection-test').doc('test-doc').get();
                        console.log("Connection to custom server successful.");
        
                        const projectDocOnSecondary = await secondaryDb.collection('projects').doc(projectId).get();
                        if (!projectDocOnSecondary.exists) {
                            if (isMounted) setMigrationStatus("First-time connection detected. Copying project data to your server... This may take a moment.");
                            
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
                            if (isMounted) setMigrationStatus("Project data successfully copied. Finalizing connection...");
                            console.log("Migration complete.");
                        }
                        
                        finalDb = secondaryDb;
                        collabEnabled = true;

                    } catch (collabError) {
                         console.error("Failed to initialize or connect to custom Firebase server:", collabError);
                         showAlert("Could not connect to the project's custom server. Real-time collaboration is disabled. Please check the owner's configuration and security rules.", 'error');
                    }
                }
                
                if (!isMounted) return;
    
                setDbInstance(finalDb);
                setIsCollaborationEnabled(collabEnabled);
                
                unsubscribers.push(streamProjectDetails(projectId, (proj) => { if (isMounted) setProject(proj); }, finalDb));
                unsubscribers.push(streamProjectFiles(projectId, (files) => { if (isMounted) setFiles(files); }, finalDb));
                unsubscribers.push(streamChatHistory(projectId, (messages) => { if (isMounted) setChatMessages(messages); }, finalDb));
                unsubscribers.push(streamSnapshots(projectId, (snapshots) => { if (isMounted) setSnapshots(snapshots); }, finalDb));
    
            } catch (error) {
                console.error("Failed to load project:", error);
                if (isMounted) setProject(null); // Ensure project is null on error to show error screen
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                    setMigrationStatus('');
                }
            }
        };
        
        initialize();
        
        return () => {
            isMounted = false;
            unsubscribers.forEach(unsub => unsub());
        };
    }, [projectId, user, showAlert]);

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
                setSidebarTab('chat');
                setIsPreviewPaneOpen(true);
            }

            const { prompt, provider, model } = initialGenerationTask;
            
            const userMessage: Omit<AiChatMessage, 'id' | 'timestamp'> = { sender: 'user', text: `Build me this: "${prompt}"` };
            await addChatMessage(projectId, userMessage, dbInstance);

            const onAgentMessage = async (message: Omit<AiChatMessage, 'id' | 'timestamp' | 'sender'>) => {
                const agentMessage: Omit<AiChatMessage, 'id' | 'timestamp'> = { sender: 'ai', isAgentMessage: true, ...message };
                await addAndParseAiMessage(agentMessage);
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
                await addAndParseAiMessage({ sender: 'ai', text: `Sorry, I ran into a problem: ${message}` });
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
        setSidebarTab('chat');
    
        const userMessage: Omit<AiChatMessage, 'id' | 'timestamp'> = { sender: 'user', text: message };
        await addChatMessage(projectId, userMessage, dbInstance);
        const currentChatMessages = [...chatMessages, userMessage];
    
        // --- CONTEXT BUILDING ---
        let contextHeader = '';
        if (mode === 'build' || mode === 'ask') {
            const recentMessages = currentChatMessages.slice(-15);
    
            // 1. Pinned File Context
            const lastPinnedFileMessage = [...recentMessages].reverse().find(m => m.type === 'file_pin' && m.filePath);
            if (lastPinnedFileMessage && lastPinnedFileMessage.filePath) {
                const file = files.find(f => f.path === lastPinnedFileMessage.filePath);
                if (file && file.content !== undefined) {
                    contextHeader += `CONTEXT: The user has recently pinned the file \`${file.path}\`. Its content is provided below. Prioritize this file when considering changes.\n\n--- CONTENT OF ${file.path} ---\n${file.content}\n--- END OF CONTENT ---\n\n`;
                }
            }
    
            if (mode === 'build') {
                // 2. To-Do List Context
                const openTasks = currentChatMessages.filter(m => m.type === 'task' && !m.isComplete && m.taskText);
                if (openTasks.length > 0) {
                    contextHeader += `CONTEXT: The project has the following open tasks. Consider if the user's request relates to any of these tasks.\n\n--- OPEN TASKS ---\n${openTasks.map(t => `- ${t.taskText}`).join('\n')}\n--- END OF TASKS ---\n\n`;
                }
    
                // 3. Recent Snippet Context
                const recentSnippets = currentChatMessages.filter(m => m.type === 'code_snippet' && m.code).slice(-2);
                if (recentSnippets.length > 0) {
                    contextHeader += `CONTEXT: The following code snippets were recently generated in the chat. They may be relevant.\n\n--- RECENT SNIPPETS ---\n${recentSnippets.map(s => `// Snippet for: ${s.text}\n${s.code}`).join('\n\n')}\n--- END OF SNIPPETS ---\n\n`;
                }
            }
        }
        
        const promptWithContext = contextHeader 
            ? `${contextHeader}Based on all the context above, here is the user's request: "${message}"` 
            : message;
    
        try {
            const key = apiConfig[project.provider];
            if (!key && !apiPoolConfig.isEnabled) throw new Error(`API key for ${project.provider} is not configured.`);
    
            if (mode === 'general') {
                const answer = await askGeneralQuestion(message, project.provider, project.model, apiConfig, user.uid, apiPoolConfig, apiPoolKeys);
                await addAndParseAiMessage({ sender: 'ai', text: answer });
            } else if (mode === 'ask') {
                const answer = await answerProjectQuestion(promptWithContext, files, project, apiConfig, user.uid, apiPoolConfig, apiPoolKeys);
                await addAndParseAiMessage({ sender: 'ai', text: answer });
            } else { // build mode
                const plan = await generateModificationPlan(promptWithContext, files, project, apiConfig, user.uid, apiPoolConfig, apiPoolKeys);
                if (plan?.plan?.special_action) {
                    const { action, payload, confirmation_prompt } = plan.plan.special_action;
                    if (window.confirm(confirmation_prompt || `Are you sure you want to perform the action: ${action}?`)) {
                        switch (action) {
                            case 'DELETE_PROJECT':
                                await deleteProject(projectId);
                                onBackToDashboard();
                                return; // Stop execution here
                            case 'COPY_PROJECT':
                                const newProjectId = await copyProject(projectId, payload?.newName || `${project.name} Copy`, user.uid);
                                await addChatMessage(newProjectId, { sender: 'ai', text: `This project was copied from ${project.name}.` });
                                await addAndParseAiMessage({ sender: 'ai', text: `Project successfully copied. The new project is named "${payload?.newName || `${project.name} Copy`}".` });
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
            await addAndParseAiMessage({ sender: 'ai', text: `Sorry, I ran into a problem: ${errorMessage}` });
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
            await addAndParseAiMessage({ sender: 'ai', text: "I have successfully applied the changes." });

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during execution.";
            await updateChatMessage(projectId, messageId, { planStatus: 'pending' }, dbInstance); // Revert status
            await addAndParseAiMessage({ sender: 'ai', text: `I encountered an error while applying the changes: ${errorMessage}` });
        } finally {
            setIsAiLoading(false);
        }
    };
    
    const handleRejectPlan = async (messageId: string) => {
        await updateChatMessage(projectId, messageId, { planStatus: 'rejected' }, dbInstance);
    };
    
    const handleUpdateTaskStatus = async (messageId: string, isComplete: boolean) => {
        if (!project) return;
        try {
            await updateChatMessage(projectId, messageId, { isComplete }, dbInstance);
        } catch (error) {
            console.error("Failed to update task status:", error);
            showAlert("Could not update task.", 'error');
        }
    };

    const handleJumpToMessage = (messageId: string) => {
        const element = chatMessageRefs.current.get(messageId);
        if (element) {
            if (isMobile) {
                setMobileView('chat');
                // On mobile, the view needs to switch before we can scroll
                setTimeout(() => {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
            } else {
                setSidebarTab('chat');
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            // Highlight the message briefly
            element.style.transition = 'background-color 0.5s ease';
            element.style.backgroundColor = 'var(--color-primary-focus, #3a82f6)';
            setTimeout(() => {
                element.style.backgroundColor = '';
            }, 1500);
        }
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
            showAlert("Error saving settings.", 'error');
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleAnalyzeCode = async () => {
        if (!project) return;
        setIsAiLoading(true);
        setSidebarTab('chat');
        const userMessage: Omit<AiChatMessage, 'id' | 'timestamp'> = { sender: 'user', text: "Please analyze the entire project for bugs, improvements, and best practices." };
        await addChatMessage(projectId, userMessage, dbInstance);
        try {
            const analysis = await analyzeCode(files, project, apiConfig, user.uid, apiPoolConfig, apiPoolKeys);
            await addAndParseAiMessage({ sender: 'ai', text: analysis });
        } catch(err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during analysis.";
            await addAndParseAiMessage({ sender: 'ai', text: `Sorry, I ran into a problem during analysis: ${errorMessage}` });
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
             showAlert(`Error proposing fixes: ${errorMessage}`, 'error');
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
            showAlert("Fixes applied successfully!", 'success');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            showAlert(`Error applying fixes: ${errorMessage}`, 'error');
        } finally {
            setIsFixing(false);
        }
    };
    
    const handleStartAutoDev = async (objective: string) => {
        if (!project) return;
        setIsAiLoading(true);
        setSidebarTab('chat');
        setAgentState({ status: 'running', objective, plan: [], currentTaskIndex: -1, logs: [`Objective set: ${objective}`] });
        
        const onAgentMessage = async (message: Omit<AiChatMessage, 'id' | 'timestamp' | 'sender'>) => {
            const agentMessage: Omit<AiChatMessage, 'id' | 'timestamp'> = { sender: 'ai', isAgentMessage: true, ...message };
            await addAndParseAiMessage(agentMessage);
        };
        
        const handleAgentStateChange = (stateUpdate: Partial<AgentState>) => {
            setAgentState(prevState => {
                const newState = { ...prevState, ...stateUpdate };
                if (stateUpdate.logs) {
                    newState.logs = [...prevState.logs, ...stateUpdate.logs];
                }
                return newState;
            });
        };
        
        try {
            const finalFiles = await runAutonomousAgent(objective, files, project, apiConfig, handleAgentStateChange, onAgentMessage, user.uid, apiPoolConfig, apiPoolKeys);
            
            const finalFileMap: Map<string, FileNode> = new Map(finalFiles.map(f => [f.path, f]));
            const initialFileMap: Map<string, FileNode> = new Map(files.map(f => [f.path, f]));
            const changes: AiChanges = { create: {}, update: {}, delete: [] };

            // Detect creations and updates
            finalFiles.forEach((file: FileNode) => {
                const initialFile = initialFileMap.get(file.path);
                if (!initialFile) {
                    changes.create![file.path] = file.content || '';
// FIX: The type of `initialFile` was being inferred as `unknown`, preventing access to `.content`. Explicitly typing `initialFileMap` as `Map<string, FileNode>` ensures `initialFile` is correctly typed as `FileNode | undefined`, allowing safe access to its properties.
                } else if (initialFile.content !== file.content) {
                    changes.update![file.path] = file.content || '';
                }
            });

            // Detect deletions
            files.forEach(file => {
                if (!finalFileMap.has(file.path)) {
                    changes.delete!.push(file.path);
                }
            });

            await applyAiChanges(projectId, files, changes, dbInstance);
             await addAndParseAiMessage({ sender: 'ai', text: "Autonomous agent has completed the objective." });

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
             await addAndParseAiMessage({ sender: 'ai', text: `Agent stopped due to an error: ${errorMessage}` });
        } finally {
            setIsAiLoading(false);
        }
    };

    const executeGodModeAction = useCallback(async (action: AiGodModeAction) => {
        await new Promise(resolve => setTimeout(resolve, 1500));

        try {
            switch (action.type) {
                case 'CLICK_ELEMENT':
                    if (action.selector) {
                        const el = document.querySelector(`[data-testid="${action.selector}"]`) as HTMLElement;
                        if (el) el.click();
                        else throw new Error(`Element with selector [${action.selector}] not found.`);
                    }
                    break;
                case 'TYPE_IN_INPUT':
                    if (action.selector && typeof action.payload === 'string') {
                        const el = document.querySelector(`[data-testid="${action.selector}"]`) as HTMLInputElement | HTMLTextAreaElement;
                        if (el) {
                            el.focus();
                            
                            // This is the key to making React update state for controlled components
                            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
                            nativeInputValueSetter?.call(el, action.payload);

                            el.dispatchEvent(new Event('input', { bubbles: true }));
                        } else {
                            throw new Error(`Input with selector [${action.selector}] not found.`);
                        }
                    }
                    break;
                case 'MODIFY_FILES':
                    if (action.payload) {
                        let changes: AiChanges;
                        if (typeof action.payload === 'string') {
                            try {
                                changes = JSON.parse(action.payload);
                            } catch (e) {
                                const message = e instanceof Error ? e.message : 'Unknown parsing error';
                                throw new Error(`Failed to parse MODIFY_FILES payload: ${message}`);
                            }
                        } else if (typeof action.payload === 'object') {
                            // This is a fallback in case the AI returns an object directly
                            changes = action.payload as AiChanges;
                        } else {
                            throw new Error('Invalid payload type for MODIFY_FILES. Expected a JSON string or an object.');
                        }
                        await applyAiChanges(projectId, files, changes, dbInstance);
                    }
                    break;
                case 'ASK_USER':
                    if (typeof action.payload === 'string') {
                        showAlert(`AI is asking: ${action.payload}`, 'info');
                    }
                    break;
                case 'FINISH':
                    setIsGodModeActive(false);
                    setGodModeActionQueue([]);
                    showAlert("God Mode has completed the objective.", 'success');
                    break;
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "An unknown error occurred.";
            showAlert(`God Mode Action Failed: ${message}`, 'error');
            setIsGodModeActive(false);
            setGodModeActionQueue([]);
            setCurrentGodModeAction(null);
            return;
        }
        setCurrentGodModeAction(null);
    }, [projectId, files, dbInstance, showAlert]);

    useEffect(() => {
        if (isGodModeActive && currentGodModeAction === null && godModeActionQueue.length > 0) {
            const nextAction = godModeActionQueue[0];
            setCurrentGodModeAction(nextAction);
            setGodModeActionQueue(q => q.slice(1));
            executeGodModeAction(nextAction);
        } else if (isGodModeActive && godModeActionQueue.length === 0 && currentGodModeAction === null) {
            // If the queue runs out but FINISH wasn't the last action
            setIsGodModeActive(false);
            showAlert("God Mode finished all planned steps.", 'info');
        }
    }, [isGodModeActive, currentGodModeAction, godModeActionQueue, executeGodModeAction]);

    const generateUiContext = () => {
        const elements = document.querySelectorAll('[data-testid]');
        const context = Array.from(elements).map(el => {
            const testId = (el as HTMLElement).dataset.testid || '';
            let description = testId.replace('godmode-', '').replace(/-/g, ' ');
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                description += ' input field';
            } else if (el.tagName === 'BUTTON') {
                description += ' button';
            }
            return { selector: testId, description };
        });
        return JSON.stringify(context, null, 2);
    };

    const handleStartGodMode = async (objective: string) => {
        if (!project) return;
        setIsAiLoading(true);
        setIsGodModeActive(true);
        setCurrentGodModeAction({ type: 'CLICK_ELEMENT', reasoning: 'Starting God Mode and planning the steps...', selector: '' });

        try {
            const uiContext = generateUiContext();
            const plan = await godModePlanner(objective, files, uiContext, project, apiConfig, user.uid, apiPoolConfig, apiPoolKeys);
            if (plan && plan.length > 0) {
                setGodModeActionQueue(plan);
                setCurrentGodModeAction(null);
            } else {
                throw new Error("The AI did not return a valid plan.");
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "An unknown error occurred.";
            showAlert(`God Mode Failed: ${message}`, 'error');
            setIsGodModeActive(false);
            setCurrentGodModeAction(null);
        } finally {
            setIsAiLoading(false);
        }
    };
    
    const handleStopGodMode = () => {
        setIsGodModeActive(false);
        setGodModeActionQueue([]);
        setCurrentGodModeAction(null);
        showAlert("God Mode stopped by user.", 'info');
    };

    const handleGenerateShareKey = async (pid: string) => {
        return createShareKey(pid);
    };

    const handleRemoveMember = async (memberUid: string) => {
        if (!project || !isOwner) return;
        if (memberUid === user.uid) {
            showAlert("You cannot remove yourself from the project.", 'info');
            return;
        }
        if (window.confirm("Are you sure you want to remove this member from the project? Their access will be revoked immediately.")) {
            try {
                await removeProjectMember(projectId, memberUid);
            } catch (error) {
                console.error("Failed to remove member:", error);
                showAlert("Error: Could not remove member.", 'error');
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
    
    const handleGenerateSvg = async (prompt: string, assetType: 'icon' | 'background'): Promise<string> => {
        if (!project) throw new Error("Project context is not available.");
        if (isAiLoading) throw new Error("Another AI task is already in progress.");
        
        setIsAiLoading(true);
        try {
            const svgCode = await generateSvgAsset(prompt, assetType, project, apiConfig, user.uid, apiPoolConfig, apiPoolKeys);
            return svgCode;
        } finally {
            setIsAiLoading(false);
        }
    };
    
    const handleSaveSvgToFile = async (svgCode: string) => {
        const filePath = prompt("Enter the full path for the new SVG file:", "src/assets/new-icon.svg");
        if (filePath) {
            try {
                await addFileOrFolder(projectId, filePath, 'file', svgCode, dbInstance);
                showAlert(`File saved to ${filePath}`, 'success');
                setIsSvgDesignModalOpen(false);
            } catch (err) {
                const message = err instanceof Error ? err.message : "Could not save file.";
                showAlert(`Error: ${message}`, 'error');
            }
        }
    };
    
    const handleApplySvgAsIcon = async (svgCode: string) => {
        if (!project) return;
        const iconPath = 'public/icon.svg';
        const existingIcon = files.find(f => f.path === iconPath);
        const changes: AiChanges = {};

        if (existingIcon) {
            changes.update = { [iconPath]: svgCode };
        } else {
            changes.create = { [iconPath]: svgCode };
        }

        try {
            await applyAiChanges(projectId, files, changes, dbInstance);
            showAlert("Project icon updated successfully!", 'success');
            setIsSvgDesignModalOpen(false);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Could not apply icon.";
            showAlert(`Error: ${message}`, 'error');
        }
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isResizingSidebar.current) {
            const newWidth = e.clientX;
            if (newWidth > 200 && newWidth < 600) {
                setSidebarWidth(newWidth);
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
        isResizingVertical.current = false;
        isResizingMain.current = false;
        document.body.style.cursor = 'default';
        localStorage.setItem('sidebarWidth', sidebarWidth.toString());
        localStorage.setItem('bottomPanelHeight', bottomPanelHeight.toString());
        localStorage.setItem('editorWidthPercent', editorWidthPercent.toString());
    }, [sidebarWidth, bottomPanelHeight, editorWidthPercent]);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    const [history, setHistory] = useState<FileNode[][]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const canUndo = false;
    const canRedo = false;
    const handleUndo = () => {};
    const handleRedo = () => {};

    const selectedFile = useMemo(() => files.find(f => f.path === selectedFilePath), [files, selectedFilePath]);
    
     const handleFileContentChange = (newContent: string) => {
        if (selectedFile) {
            setFiles(prevFiles =>
                prevFiles.map(f =>
                    f.path === selectedFile.path ? { ...f, content: newContent } : f
                )
            );
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
                showAlert("Error saving file. See console for details.", 'error');
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
                showAlert(`Error renaming: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error');
            }
        }
    };
    
    const handlePinToChat = (path: string) => {
        handleSendRichMessage({
            type: 'file_pin',
            filePath: path,
            text: `Pinned file: ${path}`
        });
        setSidebarTab('chat');
    };

    const handleCreateSnapshot = async () => {
        if (!isOwner) {
            showAlert("Only the project owner can create snapshots.", 'info');
            return;
        }
        const message = prompt("Enter a brief description for this snapshot:");
        if (message && message.trim()) {
            try {
                const fileData = JSON.stringify(files);
                const compressedData = LZString.compressToUTF16(fileData);
                await createSnapshot(projectId, message.trim(), compressedData, dbInstance);
                showAlert("Snapshot created successfully!", 'success');
            } catch (error) {
                console.error("Failed to create snapshot:", error);
                showAlert(`Error: ${error instanceof Error ? error.message : "Could not create snapshot."}`, 'error');
            }
        }
    };

    const handleDeleteSnapshot = async (snapshotId: string) => {
        if (!isOwner) {
            showAlert("Only the project owner can delete snapshots.", 'info');
            return;
        }
        if (window.confirm("Are you sure you want to permanently delete this snapshot?")) {
            try {
                await deleteSnapshot(projectId, snapshotId, dbInstance);
            } catch (error) {
                console.error("Failed to delete snapshot:", error);
                showAlert(`Error: ${error instanceof Error ? error.message : "Could not delete snapshot."}`, 'error');
            }
        }
    };

    const handleDuplicateFile = async (path: string) => {
        const originalFile = files.find(f => f.path === path);
        if (!originalFile || originalFile.type === 'folder') return;

        let newPath = '';
        let counter = 1;
        const parts = originalFile.path.split('.');
        const extension = parts.length > 1 ? '.' + parts.pop() : '';
        const baseName = parts.join('.');
        
        do {
            const suffix = counter === 1 ? '-copy' : `-copy-${counter}`;
            newPath = `${baseName}${suffix}${extension}`;
            counter++;
        } while (files.some(f => f.path === newPath));

        try {
            await addFileOrFolder(projectId, newPath, 'file', originalFile.content || '', dbInstance);
            setSelectedFilePath(newPath);
        } catch(e) {
            showAlert(`Error duplicating file: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error');
        }
    };
    
    const contextMenuItems = useMemo((): ContextMenuItem[] => {
        if (!contextMenu) return [];
        const node = files.find(f => f.path === contextMenu.path);
        const isFile = node?.type === 'file';

        const items: ContextMenuItem[] = [
            { label: 'Pin to Chat', icon: <PaperClipIcon className="w-4 h-4" />, action: () => handlePinToChat(contextMenu.path) },
            { label: 'Rename', icon: <PencilIcon className="w-4 h-4" />, action: () => handleRenameFile(contextMenu.path) },
        ];

        if (isFile) {
            items.push({ label: 'Duplicate', icon: <DocumentDuplicateIcon className="w-4 h-4" />, action: () => handleDuplicateFile(contextMenu.path) });
        }
        
        items.push(
            { label: 'Copy Path', icon: <ArrowRightIcon className="w-4 h-4" />, action: () => navigator.clipboard.writeText(contextMenu.path) },
            { label: 'Delete', icon: <TrashIcon className="w-4 h-4 text-red-400" />, action: () => handleFileDelete(contextMenu.path) }
        );

        return items;
    }, [contextMenu, files]);


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
        return (
            <div className="h-screen w-screen flex flex-col bg-base-100 overflow-hidden">
                <Header 
                    user={user} project={project} onDownload={handleDownload} onApiKeyClick={() => setIsApiKeyModalOpen(true)}
                    onSettingsClick={() => setIsSettingsModalOpen(true)} onUndo={handleUndo} onRedo={handleRedo}
                    canUndo={canUndo} canRedo={canRedo} onAnalyzeClick={handleAnalyzeCode}
                    onBuildClick={() => setIsBuildModalOpen(true)} onAutoDevClick={() => setIsAutoDevModalOpen(true)}
                    onGodModeClick={() => setIsGodModeModalOpen(true)}
                    onDebugRefactorClick={() => setIsDebugRefactorModalOpen(true)} onBackToDashboard={onBackToDashboard}
                    onTogglePreview={() => setMobileView('preview')} onToggleFullScreenPreview={() => setMobileView('preview')}
                    onToggleBottomPanel={() => {}} onProfileClick={() => setIsProfileModalOpen(true)} onShareClick={() => setIsShareModalOpen(true)}
                    onDeployClick={() => setIsDeploymentModalOpen(true)}
                    onDesignClick={() => setIsSvgDesignModalOpen(true)}
                    isAiLoading={isAiLoading} isMobile
                />
                <main className="flex-grow overflow-hidden">
                    <div className="h-full" style={{ display: mobileView === 'files' ? 'block' : 'none' }}>
                        <FileExplorer files={files} selectedFilePath={selectedFilePath} onFileSelect={handleFileSelect} onFileDelete={handleFileDelete} onFileAdd={handleFileAdd} onFileUpload={handleFileUpload} onContextMenuRequest={handleContextMenuRequest} projectId={projectId} />
                    </div>
                    <div className="h-full" style={{ display: mobileView === 'chat' ? 'block' : 'none' }}>
                        <ChatInterface messages={chatMessages} onSendMessage={handleSendMessage} isLoading={isAiLoading} onApprovePlan={handleApprovePlan} onRejectPlan={handleRejectPlan} projectMembers={projectMembers} currentUser={user} isOwner={isOwner} files={files} project={project} apiConfig={apiConfig} apiPoolConfig={apiPoolConfig} apiPoolKeys={apiPoolKeys} currentUserId={user.uid} onSendRichMessage={handleSendRichMessage} onDeleteMessage={(id) => deleteChatMessage(projectId, id, dbInstance)} onOpenFileFromPin={handleFileSelect} onUpdateTaskStatus={handleUpdateTaskStatus} chatMessageRefs={chatMessageRefs}/>
                    </div>
                    <div className="h-full" style={{ display: mobileView === 'todo' ? 'block' : 'none' }}>
                        <TodoListPanel
                            messages={chatMessages}
                            onUpdateTaskStatus={handleUpdateTaskStatus}
                            onJumpToMessage={handleJumpToMessage}
                        />
                    </div>
                    <div className="h-full" style={{ display: mobileView === 'editor' ? 'block' : 'none' }}>
                        {selectedFile ? <CodeEditor filePath={selectedFile.path} content={selectedFile.content || ''} onChange={handleFileContentChange} onSave={handleSaveFile} isDirty={dirtyFiles.has(selectedFile.path)} isSavingFile={savingFile === selectedFile.path} isMobile onBack={() => setMobileView('files')} /> : <div className="p-4 text-center text-neutral">Select a file to edit.</div>}
                    </div>
                    <div className="h-full" style={{ display: mobileView === 'preview' ? 'block' : 'none' }}>
                        <SandboxPreview files={files} projectType={project.type} isMobile />
                    </div>
                </main>
                <MobileNavBar activeView={mobileView} onViewChange={setMobileView} isEditorDisabled={!selectedFilePath} />
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
                    onUpdateSuccess={refreshUserProfile}
                />
                <BuildModeModal isOpen={isBuildModalOpen} onClose={() => setIsBuildModalOpen(false)} onBuild={(prompt) => handleSendMessage(prompt, 'build')} isLoading={isAiLoading} />
                <AutonomousModeModal isOpen={isAutoDevModalOpen} onClose={() => {setAgentState({ status: 'idle', objective: '', plan: [], currentTaskIndex: -1, logs: [] }); setIsAutoDevModalOpen(false)}} onStart={handleStartAutoDev} agentState={agentState} />
                <DebugRefactorModal isOpen={isDebugRefactorModalOpen} onClose={() => {setProposedFixes(null); setIsDebugRefactorModalOpen(false)}} onProposeFixes={handleProposeFixes} onApplyFixes={handleApplyFixes} isLoading={isFixing} proposedChanges={proposedFixes} selectedFile={selectedFile} />
                <ProfileSettingsModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} user={user} onUpdateSuccess={refreshUserProfile} />
                <ShareProjectModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} projectId={projectId} onGenerateKey={handleGenerateShareKey} isCollaborationEnabled={isCollaborationEnabled} ownerUid={project.ownerId} />
                <DeploymentModal isOpen={isDeploymentModalOpen} onClose={() => setIsDeploymentModalOpen(false)} onDeployCodeSandbox={()=>{}} isDeploying={isDeploying} />
                 {/* FIX: Pass the 'project' prop to SvgDesignModal as it is required. */}
<SvgDesignModal isOpen={isSvgDesignModalOpen} onClose={() => setIsSvgDesignModalOpen(false)} onGenerate={handleGenerateSvg} onSaveToFile={handleSaveSvgToFile} onApplyAsIcon={handleApplySvgAsIcon} isGenerating={isAiLoading} project={project}/>
                <GodModeModal isOpen={isGodModeModalOpen} onClose={() => setIsGodModeModalOpen(false)} onStart={handleStartGodMode} isLoading={isAiLoading} apiConfig={apiConfig} />
                {isFullScreenPreview && <SandboxPreview files={files} projectType={project.type} isFullScreen onCloseFullScreen={() => setIsFullScreenPreview(false)} />}
                {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenuItems} onClose={() => setContextMenu(null)} />}
            </div>
        )
    }

    return (
        <div className="h-screen w-screen flex flex-col bg-base-100 overflow-hidden">
            {isGodModeActive && <GodModeStatus currentAction={currentGodModeAction} onStop={handleStopGodMode} />}
            <Header 
                user={user} project={project} onDownload={handleDownload} onApiKeyClick={() => setIsApiKeyModalOpen(true)}
                onSettingsClick={() => setIsSettingsModalOpen(true)} onUndo={handleUndo} onRedo={handleRedo}
                canUndo={canUndo} canRedo={canRedo} onAnalyzeClick={handleAnalyzeCode}
                onBuildClick={() => setIsBuildModalOpen(true)} onAutoDevClick={() => setIsAutoDevModalOpen(true)}
                onGodModeClick={() => setIsGodModeModalOpen(true)}
                onDebugRefactorClick={() => setIsDebugRefactorModalOpen(true)} onBackToDashboard={onBackToDashboard}
                onTogglePreview={() => setIsPreviewPaneOpen(!isPreviewPaneOpen)} onToggleFullScreenPreview={() => setIsFullScreenPreview(true)}
                onToggleBottomPanel={() => setIsBottomPanelOpen(!isBottomPanelOpen)} onProfileClick={() => setIsProfileModalOpen(true)}
                onShareClick={() => setIsShareModalOpen(true)}
                onDeployClick={() => setIsDeploymentModalOpen(true)}
                onDesignClick={() => setIsSvgDesignModalOpen(true)}
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
                        projectId={projectId}
                        messages={chatMessages}
                        onSendMessage={handleSendMessage}
                        isLoading={isAiLoading}
                        onApprovePlan={handleApprovePlan}
                        onRejectPlan={handleRejectPlan}
                        projectMembers={projectMembers}
                        currentUser={user}
                        isOwner={isOwner}
                        project={project}
                        apiConfig={apiConfig}
                        apiPoolConfig={apiPoolConfig}
                        apiPoolKeys={apiPoolKeys}
                        currentUserId={user.uid}
                        onSendRichMessage={handleSendRichMessage}
                        onDeleteMessage={(id) => deleteChatMessage(projectId, id, dbInstance)}
                        onOpenFileFromPin={handleFileSelect}
                        snapshots={snapshots}
                        onCreateSnapshot={handleCreateSnapshot}
                        onDeleteSnapshot={handleDeleteSnapshot}
                        onUpdateTaskStatus={handleUpdateTaskStatus}
                        chatMessageRefs={chatMessageRefs}
                        onJumpToMessage={handleJumpToMessage}
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
                onUpdateSuccess={refreshUserProfile}
            />
            <BuildModeModal isOpen={isBuildModalOpen} onClose={() => setIsBuildModalOpen(false)} onBuild={(prompt) => handleSendMessage(prompt, 'build')} isLoading={isAiLoading} />
            <AutonomousModeModal isOpen={isAutoDevModalOpen} onClose={() => {setAgentState({ status: 'idle', objective: '', plan: [], currentTaskIndex: -1, logs: [] }); setIsAutoDevModalOpen(false)}} onStart={handleStartAutoDev} agentState={agentState} />
            <DebugRefactorModal isOpen={isDebugRefactorModalOpen} onClose={() => {setProposedFixes(null); setIsDebugRefactorModalOpen(false)}} onProposeFixes={handleProposeFixes} onApplyFixes={handleApplyFixes} isLoading={isFixing} proposedChanges={proposedFixes} selectedFile={selectedFile} />
            <ProfileSettingsModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} user={user} onUpdateSuccess={refreshUserProfile} />
            <ShareProjectModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} projectId={projectId} onGenerateKey={handleGenerateShareKey} isCollaborationEnabled={isCollaborationEnabled} ownerUid={project.ownerId} />
            <DeploymentModal isOpen={isDeploymentModalOpen} onClose={() => setIsDeploymentModalOpen(false)} onDeployCodeSandbox={()=>{}} isDeploying={isDeploying} />
            {/* FIX: Pass the 'project' prop to SvgDesignModal as it is required. */}
<SvgDesignModal isOpen={isSvgDesignModalOpen} onClose={() => setIsSvgDesignModalOpen(false)} onGenerate={handleGenerateSvg} onSaveToFile={handleSaveSvgToFile} onApplyAsIcon={handleApplySvgAsIcon} isGenerating={isAiLoading} project={project} />
            <GodModeModal isOpen={isGodModeModalOpen} onClose={() => setIsGodModeModalOpen(false)} onStart={handleStartGodMode} isLoading={isAiLoading} apiConfig={apiConfig} />
            {isFullScreenPreview && <SandboxPreview files={files} projectType={project.type} isFullScreen onCloseFullScreen={() => setIsFullScreenPreview(false)} />}
            {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenuItems} onClose={() => setContextMenu(null)} />}
        </div>
    );
};

export default EditorPage;