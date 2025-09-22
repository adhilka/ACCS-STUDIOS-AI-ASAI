import React, { useState, useEffect, useCallback } from 'react';
// FIX: Import admin-related types to support the new feature.
import { User, Project, ApiConfig, AiProvider, ApiPoolConfig, ApiPoolKey, AdminUser } from '../types';
// FIX: Import firestore functions for admin panel.
import { getUserProjects, saveApiPoolConfig, addApiPoolKey, deleteApiPoolKey, joinProjectByShareKey, getCollectionCount, getAllUsers } from '../services/firestoreService';
import Spinner from '../components/ui/Spinner';
import { CodeIcon, KeyIcon, RocketIcon, UserIcon, SettingsIcon, UsersIcon, ReactIcon } from '../components/icons';
import ApiKeyModal from '../components/ApiKeyModal';
import ProfileSettingsModal from '../components/ProfileSettingsModal';
// FIX: Import the new AdminPanelModal.
import AdminPanelModal from '../components/AdminPanelModal';


interface DashboardProps {
    user: User;
    onSelectProject: (projectId: string) => void;
    onStartBuilding: (prompt: string, provider?: AiProvider, model?: string) => void;
    apiConfig: ApiConfig;
    onApiConfigChange: (config: ApiConfig) => void;
    // FIX: Add props for admin functionality.
    apiPoolConfig: ApiPoolConfig;
    apiPoolKeys: ApiPoolKey[];
    setApiPoolConfig: (config: ApiPoolConfig) => void;
    setApiPoolKeys: (keys: ApiPoolKey[]) => void;
}

const modelOptions = {
    openrouter: [
        { id: 'mistralai/mistral-7b-instruct', name: 'Mistral 7B Instruct (Free)' },
        { id: 'google/gemma-7b-it', name: 'Gemma 7B (Free)' },
        { id: 'huggingfaceh4/zephyr-7b-beta', name: 'Zephyr 7B (Free)' },
        { id: 'openai/gpt-3.5-turbo', name: 'OpenAI GPT-3.5 Turbo' },
    ],
    groq: [
        { id: 'llama3-8b-8192', name: 'LLaMA3 8b' },
        { id: 'llama3-70b-8192', name: 'LLaMA3 70b' },
        { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
        { id: 'gemma-7b-it', name: 'Gemma 7b' },
    ]
};

const NewProjectBuilder: React.FC<{ onStartBuilding: (prompt: string, provider: AiProvider, model: string) => void; isLoading: boolean }> = ({ onStartBuilding, isLoading }) => {
    const [prompt, setPrompt] = useState('');
    const [provider, setProvider] = useState<AiProvider>('gemini');
    const [model, setModel] = useState('');

    useEffect(() => {
        // Set default model when provider changes
        if (provider === 'groq') setModel(modelOptions.groq[0].id);
        else if (provider === 'openrouter') setModel(modelOptions.openrouter[0].id);
        else setModel('');
    }, [provider]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (prompt.trim()) {
            onStartBuilding(prompt.trim(), provider, model);
        }
    };
    
    return (
        <div className="bg-base-200 rounded-lg p-6 border border-base-300 shadow-sm mb-12">
            <h2 className="text-2xl font-bold mb-4 text-base-content">Start a New Project</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                 <textarea 
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    rows={2}
                    placeholder="e.g., A pomodoro timer with a customizable work/break cycle..."
                    className="w-full bg-base-100 border border-base-300 rounded-md py-2 px-3 text-base-content placeholder-neutral focus:outline-none focus:ring-2 focus:ring-primary transition resize-none"
                    disabled={isLoading}
                />
                <div className="flex flex-col sm:flex-row items-start gap-4">
                    <select
                        value={provider}
                        onChange={e => setProvider(e.target.value as AiProvider)}
                        className="w-full sm:w-auto h-11 bg-base-200 border border-base-300 rounded-md px-3 text-base-content text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-colors hover:bg-base-300 shrink-0"
                        disabled={isLoading}
                    >
                        <option value="gemini">Gemini</option>
                        <option value="openrouter">OpenRouter</option>
                        <option value="groq">Groq</option>
                    </select>

                    {(provider === 'openrouter' || provider === 'groq') && (
                        <select
                            value={model}
                            onChange={e => setModel(e.target.value)}
                            className="w-full sm:w-auto h-11 bg-base-200 border border-base-300 rounded-md px-3 text-base-content text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-colors hover:bg-base-300 shrink-0"
                            disabled={isLoading}
                        >
                            {modelOptions[provider].map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                        </select>
                    )}

                    <button 
                        type="submit" 
                        disabled={isLoading || !prompt.trim()} 
                        className="w-full sm:w-auto px-6 py-2 h-11 bg-primary hover:bg-primary/90 text-white font-semibold rounded-md transition-all flex items-center justify-center gap-2 shrink-0 disabled:bg-primary/50 disabled:cursor-not-allowed sm:ml-auto"
                    >
                        {isLoading ? <Spinner size="sm"/> : <><RocketIcon className="w-5 h-5"/> <span>Start Building</span></>}
                    </button>
                </div>
            </form>
        </div>
    )
}

const JoinProject: React.FC<{ onJoin: (key: string) => Promise<void> }> = ({ onJoin }) => {
    const [key, setKey] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!key.trim() || isLoading) return;
        setIsLoading(true);
        await onJoin(key.trim());
        setIsLoading(false);
        setKey('');
    };

    return (
        <div className="bg-base-200 rounded-lg p-6 border border-base-300 shadow-sm">
            <h3 className="text-xl font-bold mb-3 text-base-content">Join a Project</h3>
            <form onSubmit={handleSubmit} className="flex items-center gap-4">
                <input
                    type="text"
                    value={key}
                    onChange={e => setKey(e.target.value)}
                    placeholder="Enter share key..."
                    className="flex-grow bg-base-100 border border-base-300 rounded-md py-2 px-3 text-base-content placeholder-neutral focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    disabled={isLoading || !key.trim()}
                    className="px-6 py-2 bg-secondary hover:bg-secondary/90 text-white font-semibold rounded-md transition-colors flex items-center justify-center gap-2 disabled:bg-secondary/50 disabled:cursor-not-allowed"
                >
                    {isLoading ? <Spinner size="sm" /> : <>Join</>}
                </button>
            </form>
        </div>
    );
};

const DashboardPage: React.FC<DashboardProps> = ({ 
    user, 
    onSelectProject, 
    onStartBuilding, 
    apiConfig, 
    onApiConfigChange,
    apiPoolConfig,
    apiPoolKeys,
    setApiPoolConfig,
    setApiPoolKeys,
}) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
    const [adminStats, setAdminStats] = useState<{users: number, projects: number} | null>(null);
    const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
    
    const fetchProjects = useCallback(async () => {
        if (!user?.uid) {
            return;
        }
        setLoading(true);
        try {
            const userProjects = await getUserProjects(user.uid);
            setProjects(userProjects);
        } catch (error) {
            console.error("Failed to fetch projects:", error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);
    
    const handleStart = async (prompt: string, provider: AiProvider, model: string) => {
        setIsCreating(true);
        onStartBuilding(prompt, provider, model);
    }

    const handleJoinProject = async (key: string) => {
        try {
            const joinedProject = await joinProjectByShareKey(key, user.uid);
            alert(`Successfully joined project: ${joinedProject.name}`);
            await fetchProjects();
        } catch (error) {
            alert(`Failed to join project: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };
    
    const openAdminPanel = async () => {
      setIsAdminPanelOpen(true);
      try {
        const [userCount, projectCount, users] = await Promise.all([
          getCollectionCount('users'),
          getCollectionCount('projects'),
          getAllUsers()
        ]);
        setAdminStats({ users: userCount, projects: projectCount });
        setAdminUsers(users);
      } catch (error) {
        console.error("Failed to fetch admin data:", error);
      }
    };
    
    const handleSavePoolConfig = async (newConfig: ApiPoolConfig) => {
        await saveApiPoolConfig(newConfig);
        setApiPoolConfig(newConfig);
    };

    const handleAddPoolKey = async (provider: AiProvider, key: string) => {
        const newId = await addApiPoolKey(provider, key);
        setApiPoolKeys([...apiPoolKeys, { id: newId, provider, key, addedAt: new Date() as any }]);
    };

    const handleDeletePoolKey = async (keyId: string) => {
        await deleteApiPoolKey(keyId);
        setApiPoolKeys(apiPoolKeys.filter(k => k.id !== keyId));
    };

    const getProjectIcon = (project: Project) => {
        if (project.iconSvg) {
            try {
                const svgDataUrl = `data:image/svg+xml;base64,${btoa(project.iconSvg)}`;
                return <img src={svgDataUrl} alt={project.name} className="w-6 h-6 object-contain" />;
            } catch (e) {
                console.error("Failed to parse project SVG:", e);
            }
        }
        if (project.type.toLowerCase().includes('react')) {
            return <ReactIcon className="w-6 h-6 text-cyan-500" />;
        }
        return <CodeIcon className="w-6 h-6 text-neutral" />;
    };


    return (
        <div className="min-h-screen bg-base-100 text-base-content">
            <header className="bg-base-200 z-40 border-b border-base-300">
                <div className="max-w-7xl mx-auto p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                       <div className="bg-primary p-2 rounded-md"><CodeIcon className="w-6 h-6 text-white"/></div>
                       <h1 className="text-xl font-bold text-base-content">ASAI Dashboard</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        {user.isAdmin && (
                            <button onClick={openAdminPanel} className="p-2 rounded-full hover:bg-base-300 transition-colors" title="Admin Panel">
                                <SettingsIcon className="w-5 h-5 text-neutral" />
                            </button>
                        )}
                        <button onClick={() => setIsApiKeyModalOpen(true)} className="p-2 rounded-full hover:bg-base-300 transition-colors" title="API Key Settings">
                            <KeyIcon className="w-5 h-5 text-neutral" />
                        </button>
                         <button onClick={() => setIsProfileModalOpen(true)} className="flex items-center gap-2 p-1 rounded-full hover:bg-base-300" title="Profile Settings">
                            <span className="text-sm text-neutral hidden sm:inline">{user.displayName || user.email}</span>
                             {user.photoURL ? (
                                 <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full object-cover"/>
                             ) : (
                                 <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center">
                                     <UserIcon className="w-5 h-5 text-neutral"/>
                                 </div>
                             )}
                         </button>
                    </div>
                </div>
            </header>
            <main className="p-4 sm:p-8 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    <div className="lg:col-span-2">
                        <NewProjectBuilder onStartBuilding={handleStart} isLoading={isCreating} />
                    </div>
                    <div>
                        <JoinProject onJoin={handleJoinProject} />
                    </div>
                </div>
                
                <h2 className="text-2xl font-bold mt-12 mb-6">Your Projects</h2>

                {loading ? (
                    <div className="flex justify-center pt-16"><Spinner size="lg"/></div>
                ) : projects.length === 0 ? (
                    <div className="text-center py-16 border-2 border-dashed border-base-300 rounded-lg bg-base-200">
                        <h3 className="text-xl font-semibold text-base-content">No projects yet</h3>
                        <p className="text-neutral mt-2">Use the builder above to create your first project with AI.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.map(project => (
                            <div key={project.id} onClick={() => onSelectProject(project.id)} className="bg-base-200 rounded-lg p-5 cursor-pointer group hover:shadow-lg hover:border-primary/40 transition-all border border-base-300">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="p-2 bg-base-300 rounded-md">
                                        {getProjectIcon(project)}
                                    </div>
                                    {project.members && project.members.length > 1 && (
                                        <div className="flex items-center gap-1.5 text-xs text-neutral bg-base-300 px-2 py-1 rounded-full" title={`${project.members.length} collaborators`}>
                                            <UsersIcon className="w-4 h-4" />
                                            <span>{project.members.length}</span>
                                        </div>
                                    )}
                                </div>
                                <h3 className="font-bold text-lg text-base-content truncate group-hover:text-primary transition-colors">{project.name}</h3>
                                <p className="text-sm text-neutral mt-1 h-10 overflow-hidden text-ellipsis">{project.prompt}</p>
                                <div className="text-xs text-neutral/80 mt-4 flex justify-between items-center">
                                    <span>{project.createdAt?.toDate().toLocaleDateString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
            <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} onSave={onApiConfigChange} currentConfig={apiConfig} />
            {user && <ProfileSettingsModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} user={user} />}
            {user.isAdmin && (
                <AdminPanelModal
                    isOpen={isAdminPanelOpen}
                    onClose={() => setIsAdminPanelOpen(false)}
                    poolConfig={apiPoolConfig}
                    poolKeys={apiPoolKeys}
                    onSaveConfig={handleSavePoolConfig}
                    onAddKey={handleAddPoolKey}
                    onDeleteKey={handleDeletePoolKey}
                    stats={adminStats}
                    users={adminUsers}
                />
            )}
        </div>
    );
};

export default DashboardPage;