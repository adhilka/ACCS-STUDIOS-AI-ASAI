import React, { useState, useEffect, useCallback, useRef } from 'react';
// FIX: Import admin-related types to support the new feature.
import { User, Project, ApiConfig, AiProvider, ApiPoolConfig, ApiPoolKey, AdminUser, UserUsageStats, AdminSettings, AdminStats, PlatformError } from '../types';
// FIX: Import firestore functions for admin panel and usage stats.
import { getUserProjects, saveApiPoolConfig, addApiPoolKey, deleteApiPoolKey, joinProjectByShareKey, getCollectionCount, getAllUsers, getUserFileStats, updateUserTokenBalance, getAdminSettings, saveAdminSettings, getPlatformErrors, acceptInvite } from '../services/firestoreService';
import Spinner, { AiTypingIndicator } from '../components/ui/Spinner';
import { CodeIcon, KeyIcon, RocketIcon, UserIcon, SettingsIcon, UsersIcon, ReactIcon, FileIcon, DatabaseIcon, InformationCircleIcon, TokenIcon } from '../components/icons';
import ApiKeyModal from '../components/ApiKeyModal';
import ProfileSettingsModal from '../components/ProfileSettingsModal';
// FIX: Import the new AdminPanelModal.
import AdminPanelModal from '../components/AdminPanelModal';
import { auth } from '../services/firebase';
import { formatTokens } from '../utils/formatters';
import ThemeToggle from '../components/ThemeToggle';
import { useAlert } from '../contexts/AlertContext';


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
    onShowDocs: () => void;
    refreshUserProfile: () => void;
}

const modelOptions = {
    openrouter: [
        { id: 'mistralai/mistral-7b-instruct', name: 'Mistral 7B Instruct (Free)' },
        { id: 'google/gemma-7b-it', name: 'Gemma 7B (Free)' },
        { id: 'huggingfaceh4/zephyr-7b-beta', name: 'Zephyr 7B (Free)' },
        { id: 'openai/gpt-3.5-turbo', name: 'OpenAI GPT-3.5 Turbo' },
    ],
    groq: [
        { id: 'llama-3.1-8b-instant', name: 'LLaMA 3.1 8B (Fastest)' },
        { id: 'llama-3.1-70b-versatile', name: 'LLaMA 3.1 70B (Powerful)' },
        { id: 'gemma2-9b-it', name: 'Gemma 2 9B' },
        { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
        { id: 'llama3-70b-8192', name: 'LLaMA 3 70B' },
        { id: 'llama3-8b-8192', name: 'LLaMA 3 8B' },
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
        <div className="bg-gradient-to-br from-base-200 to-base-200/50 rounded-xl p-6 border border-base-300 shadow-lg shadow-primary/5">
            <h2 className="text-2xl font-bold mb-4 text-base-content flex items-center gap-3"><RocketIcon className="w-6 h-6" /> Start a New Project</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                 <textarea 
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    rows={3}
                    placeholder="e.g., A pomodoro timer with a customizable work/break cycle..."
                    className="w-full bg-base-300 border border-base-300/50 rounded-md py-3 px-4 text-base-content placeholder-neutral focus:outline-none focus:ring-2 focus:ring-primary transition resize-none"
                    disabled={isLoading}
                />
                <div className="flex flex-col sm:flex-row items-start gap-4">
                    <select
                        value={provider}
                        data-testid="godmode-dashboard-provider-select"
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
                            data-testid="godmode-dashboard-model-select"
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
                        className="w-full sm:w-auto px-6 py-2 h-11 bg-primary hover:bg-primary/90 text-white font-semibold rounded-md transition-all flex items-center justify-center gap-2 shrink-0 disabled:bg-primary/50 disabled:cursor-not-allowed sm:ml-auto btn-shine"
                    >
                        {isLoading ? <Spinner size="sm"/> : <>Start Building</>}
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
        <div className="bg-base-200 rounded-xl p-6 border border-base-300">
            <h3 className="text-xl font-bold mb-3 text-base-content">Join a Project</h3>
            <form onSubmit={handleSubmit} className="flex items-center gap-4">
                <input
                    type="text"
                    value={key}
                    onChange={e => setKey(e.target.value)}
                    placeholder="Enter share key or invite code..."
                    className="flex-grow bg-base-300 border border-base-300/50 rounded-md py-2 px-3 text-base-content placeholder-neutral focus:outline-none focus:ring-2 focus:ring-primary"
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
    onShowDocs,
    refreshUserProfile
}) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
    const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
    const [adminSettings, setAdminSettings] = useState<AdminSettings>({ dailyTokenReward: 1000000 });
    const [platformErrors, setPlatformErrors] = useState<PlatformError[]>([]);
    const [usageStats, setUsageStats] = useState<UserUsageStats | null>(null);
    const [apiCallCount, setApiCallCount] = useState<number>(0);
    const { showAlert } = useAlert();
    
    const userMenuRef = useRef<HTMLDivElement>(null);

    const fetchDashboardData = useCallback(async () => {
        if (!user?.uid) return;
        setLoading(true);
        try {
            const [userProjects, fileStats] = await Promise.all([
                getUserProjects(user.uid),
                getUserFileStats(user.uid)
            ]);
            setProjects(userProjects);
            setUsageStats({
                projectCount: userProjects.length,
                fileCount: fileStats.fileCount,
                dataStoredBytes: fileStats.totalSize,
            });
            const calls = parseInt(localStorage.getItem('asai_api_call_count') || '0', 10);
            setApiCallCount(calls);
        } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    const handleStart = async (prompt: string, provider: AiProvider, model: string) => {
        setIsCreating(true);
        onStartBuilding(prompt, provider, model);
    }

    const handleJoinProject = async (key: string) => {
        try {
            // First, try to join as a real-time collaborator via invite code
            const joinedProject = await acceptInvite(key, user.uid, user.email);
            showAlert(`Successfully joined collaborative project: ${joinedProject.name}`, 'success');
        } catch (inviteError) {
             // If invite fails, try as a simple share key
            try {
                const joinedProject = await joinProjectByShareKey(key, user.uid);
                showAlert(`Successfully joined project: ${joinedProject.name}`, 'success');
            } catch (shareError) {
                const finalError = inviteError instanceof Error ? inviteError.message : String(inviteError);
                showAlert(`Failed to join project: ${finalError}`, 'error');
            }
        } finally {
            await fetchDashboardData();
        }
    };
    
    const openAdminPanel = async () => {
      setIsAdminPanelOpen(true);
      setAdminUsers([]); // Clear old data
      setAdminStats(null);
      setPlatformErrors([]);
      try {
        const [userCount, projectCount, users, settings, errors] = await Promise.all([
          getCollectionCount('users'),
          getCollectionCount('projects'),
          getAllUsers(),
          getAdminSettings(),
          getPlatformErrors(),
        ]);
        setAdminStats({ userCount, projectCount, totalFiles: 0, totalDataStored: 0 }); // Placeholder for global file stats
        setAdminUsers(users);
        setAdminSettings(settings);
        setPlatformErrors(errors);
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

    const handleUpdateUserTokens = async (userId: string, newBalance: number) => {
        await updateUserTokenBalance(userId, newBalance);
        // Refresh the user list in the admin panel to show the new balance
        const updatedUsers = await getAllUsers();
        setAdminUsers(updatedUsers);
    };
    
    const handleSaveAdminSettings = async (settings: AdminSettings) => {
        await saveAdminSettings(settings);
        setAdminSettings(settings);
    };

    const getProjectIcon = (project: Project) => {
        if (project.iconSvg) {
            try {
                const svgDataUrl = `data:image/svg+xml;base64,${btoa(project.iconSvg)}`;
                return <img src={svgDataUrl} alt={project.name} className="w-8 h-8 object-contain" />;
            } catch (e) {
                console.error("Failed to parse project SVG:", e);
            }
        }
        if (project.type.toLowerCase().includes('react')) {
            return <ReactIcon className="w-8 h-8 text-cyan-400" />;
        }
        return <CodeIcon className="w-8 h-8 text-neutral" />;
    };

    const StatCard: React.FC<{ title: string; value: React.ReactNode; icon: React.ReactNode }> = ({ title, value, icon }) => (
        <div className="bg-base-200 p-5 rounded-xl flex items-center gap-5 border border-base-300 transition-all hover:border-primary/50 hover:bg-base-200/80">
          <div className="p-3 bg-primary/10 rounded-lg text-primary">
              {icon}
          </div>
          <div>
              <p className="text-sm text-neutral font-medium">{title}</p>
              <div className="text-2xl font-bold text-base-content">{value}</div>
          </div>
        </div>
    );
    
    const formatBytes = (bytes: number, decimals = 2) => {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    return (
        <div className="min-h-screen bg-base-100 text-base-content">
            <header className="bg-base-200/50 backdrop-blur-sm sticky top-0 z-40 border-b border-base-300">
                <div className="max-w-7xl mx-auto p-4 flex justify-between items-center relative">
                    <div className="flex items-center gap-3">
                       <div className="bg-primary p-2 rounded-md"><CodeIcon className="w-6 h-6 text-white"/></div>
                        <div className="flex items-baseline gap-2">
                          <h1 className="text-xl font-bold text-base-content">ASAI Dashboard</h1>
                          <span className="text-xs bg-accent/20 text-accent font-semibold px-2 py-0.5 rounded-full">v1.0.1 ALPHA</span>
                        </div>
                    </div>
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                        {isCreating && <AiTypingIndicator />}
                    </div>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <div className="relative" ref={userMenuRef}>
                             <button onClick={() => setIsUserMenuOpen(prev => !prev)} className="flex items-center gap-2 p-1 rounded-full hover:bg-base-300" title="Profile Settings">
                                <span className="text-sm text-neutral hidden sm:inline">{user.displayName || user.email}</span>
                                 {user.photoURL ? (
                                     <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full object-cover"/>
                                 ) : (
                                     <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center">
                                         <UserIcon className="w-5 h-5 text-neutral"/>
                                     </div>
                                 )}
                            </button>
                             {isUserMenuOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-base-200 rounded-md shadow-lg z-50 border border-base-300 py-1">
                                    <button
                                        onClick={() => { setIsProfileModalOpen(true); setIsUserMenuOpen(false); }}
                                        className="w-full text-left px-4 py-2 text-sm text-base-content hover:bg-base-300"
                                    >
                                        Profile Settings
                                    </button>
                                    <button
                                        onClick={() => { setIsApiKeyModalOpen(true); setIsUserMenuOpen(false); }}
                                        className="w-full text-left px-4 py-2 text-sm text-base-content hover:bg-base-300"
                                    >
                                        API Key Settings
                                    </button>
                                    {user.isAdmin && (
                                         <button
                                            onClick={() => { openAdminPanel(); setIsUserMenuOpen(false); }}
                                            className="w-full text-left px-4 py-2 text-sm text-base-content hover:bg-base-300"
                                        >
                                            Admin Panel
                                        </button>
                                    )}
                                    <button
                                        onClick={() => { onShowDocs(); setIsUserMenuOpen(false); }}
                                        className="w-full text-left px-4 py-2 text-sm text-base-content hover:bg-base-300"
                                    >
                                        Documentation
                                    </button>
                                    <div className="h-px bg-base-300 my-1"></div>
                                    <button
                                        onClick={() => auth.signOut()}
                                        className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-base-300"
                                    >
                                        Sign Out
                                    </button>
                                </div>
                            )}
                         </div>
                     </div>
                </div>
            </header>
            <main className="p-4 sm:p-8 max-w-7xl mx-auto">
                <div className="mb-12">
                    <h1 className="text-3xl font-bold text-base-content">Welcome back, {user.displayName || user.email?.split('@')[0]}!</h1>
                    <p className="text-neutral mt-1">Let's build something amazing today.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    {/* Left Column */}
                    <div className="lg:col-span-3 flex flex-col gap-8">
                        <NewProjectBuilder onStartBuilding={handleStart} isLoading={isCreating} />

                        <div>
                            <h2 className="text-2xl font-bold mb-6">Your Projects</h2>
                             {loading ? (
                                <div className="flex justify-center pt-16"><Spinner size="lg"/></div>
                            ) : projects.length === 0 ? (
                                <div className="text-center py-16 border-2 border-dashed border-base-300 rounded-xl bg-base-200/50 mt-6 lg:col-span-3">
                                    <CodeIcon className="w-16 h-16 text-base-300 mx-auto mb-4" />
                                    <h3 className="text-xl font-semibold text-base-content">Your workspace is ready</h3>
                                    <p className="text-neutral mt-2">Use the builder above to create your first project with AI.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {projects.map(project => (
                                        <div key={project.id} onClick={() => onSelectProject(project.id)} className="bg-base-200 rounded-xl p-5 cursor-pointer group hover:-translate-y-1 transition-all border border-base-300 hover:border-primary shadow-sm hover:shadow-lg hover:shadow-primary/10">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="p-3 bg-base-300/70 rounded-lg group-hover:bg-primary/10 transition-colors">
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
                                            <p className="text-sm text-neutral mt-1 h-10 overflow-hidden text-ellipsis">{project.prompt || 'No description'}</p>
                                            <div className="text-xs text-neutral/80 mt-4 flex justify-between items-center border-t border-base-300/50 pt-3">
                                                 <span>{project.type}</span>
                                                <span>{project.createdAt?.toDate().toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Right Column */}
                    <div className="lg:col-span-2 flex flex-col gap-8">
                        <div>
                            <h2 className="text-2xl font-bold mb-6">Usage Statistics</h2>
                            <div className="space-y-4">
                               <StatCard 
                                    title="Token Balance" 
                                    value={user.tokenBalance !== undefined ? formatTokens(user.tokenBalance) : <Spinner size="sm" />}
                                    icon={<TokenIcon className="w-6 h-6" />}
                                />
                                <StatCard 
                                    title="Total Projects" 
                                    value={usageStats ? usageStats.projectCount : <Spinner size="sm" />}
                                    icon={<CodeIcon className="w-6 h-6" />}
                                />
                                <StatCard 
                                    title="Total Files" 
                                    value={usageStats ? usageStats.fileCount : <Spinner size="sm" />}
                                    icon={<FileIcon className="w-6 h-6" />}
                                />
                                <StatCard 
                                    title="Data Stored (Est.)" 
                                    value={usageStats ? formatBytes(usageStats.dataStoredBytes) : <Spinner size="sm" />}
                                    icon={<DatabaseIcon className="w-6 h-6" />}
                                />
                                <StatCard 
                                    title="AI API Calls (Session)" 
                                    value={apiCallCount}
                                    icon={<RocketIcon className="w-6 h-6" />}
                                />
                            </div>
                        </div>
                        <JoinProject onJoin={handleJoinProject} />
                    </div>
                </div>

            </main>
            <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} onSave={onApiConfigChange} currentConfig={apiConfig} />
            {user && <ProfileSettingsModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} user={user} onUpdateSuccess={refreshUserProfile} />}
            {user.isAdmin && (
                <AdminPanelModal
                    isOpen={isAdminPanelOpen}
                    onClose={() => setIsAdminPanelOpen(false)}
                    poolConfig={apiPoolConfig}
                    poolKeys={apiPoolKeys}
                    onSaveConfig={handleSavePoolConfig}
                    onAddKey={handleAddPoolKey as any}
                    onDeleteKey={handleDeletePoolKey}
                    stats={adminStats}
                    users={adminUsers}
                    adminSettings={adminSettings}
                    platformErrors={platformErrors}
                    onUpdateUserTokens={handleUpdateUserTokens}
                    onSaveAdminSettings={handleSaveAdminSettings}
                />
            )}
        </div>
    );
};

export default DashboardPage;