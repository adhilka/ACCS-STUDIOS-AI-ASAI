// FIX: Import firebase to use its types.
import firebase from 'firebase/compat/app';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EditorPage from './pages/EditorPage';
import Spinner from './components/ui/Spinner';
import { BrandingProvider } from './contexts/BrandingContext';
// FIX: Import admin-related firestore functions and types.
import { createProject, getUserApiConfig, saveUserApiConfig, getApiPoolConfig, getApiPoolKeys, ensureUserDocument, getUserProfile, getAdminSettings, updateUserTokenBalance } from './services/firestoreService';
import { ApiConfig, AiProvider, ApiPoolConfig, ApiPoolKey, User, Project } from './types';
import DocumentationPage from './pages/DocumentationPage';
import { ThemeProvider } from './contexts/ThemeContext';

// FIX: Encapsulated all logic within the App component to fix scoping issues.
const App: React.FC = () => {
    const { user: firebaseUser, loading } = useAuth();
    const [appUser, setAppUser] = useState<User | null>(null);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    
    const [initialGenerationTask, setInitialGenerationTask] = useState<{ prompt: string; provider: AiProvider, model?: string } | null>(null);
    const [isNavigating, setIsNavigating] = useState(false); // Used for interim loading state
    
    // FIX: Added 'e2b: null' to the initial state to match the ApiConfig type.
    const [apiConfig, setApiConfig] = useState<ApiConfig>({ gemini: null, openrouter: null, groq: null, e2b: null });
    
    // FIX: Added state for admin features.
    const [apiPoolConfig, setApiPoolConfig] = useState<ApiPoolConfig>({ isEnabled: false });
    const [apiPoolKeys, setApiPoolKeys] = useState<ApiPoolKey[]>([]);

    // State for documentation page visibility
    const [showDocs, setShowDocs] = useState(false);


    const refreshUserProfile = useCallback(async (uid: string) => {
        const userProfile = await getUserProfile(uid);
        const poolConfig = await getApiPoolConfig();
        setApiPoolConfig(poolConfig);

        const newAppUser = { ...firebaseUser, ...userProfile } as User;
        
        if (newAppUser.email === 'admin@gmail.com') {
            newAppUser.isAdmin = true;
            const poolKeys = await getApiPoolKeys();
            setApiPoolKeys(poolKeys);
        } else {
            newAppUser.isAdmin = false;
            if(poolConfig.isEnabled) {
                const poolKeys = await getApiPoolKeys();
                setApiPoolKeys(poolKeys);
            }
        }
        setAppUser(newAppUser);
    }, [firebaseUser]);

    // Fetch user's custom profile, API config, and admin status on login
    useEffect(() => {
        const loadUserData = async (fbUser: firebase.User) => {
            await ensureUserDocument(fbUser.uid, fbUser.email);
            const config = await getUserApiConfig(fbUser.uid);
            setApiConfig(config);

            const userProfile = await getUserProfile(fbUser.uid);
            const poolConfig = await getApiPoolConfig();
            setApiPoolConfig(poolConfig);

            const combinedUser = { ...fbUser, ...userProfile } as User;

            // Daily Token Reward Logic
            const today = new Date().setHours(0, 0, 0, 0);
            const lastLoginDate = combinedUser.lastLogin?.toDate().setHours(0, 0, 0, 0) || 0;

            if (lastLoginDate < today) {
                const adminSettings = await getAdminSettings();
                const reward = adminSettings.dailyTokenReward || 1000000; // Default to 1M
                const newBalance = (combinedUser.tokenBalance || 0) + reward;
                await updateUserTokenBalance(fbUser.uid, newBalance, true); // true to update lastLogin
                combinedUser.tokenBalance = newBalance;
                console.log(`Granted ${reward} daily tokens.`);
            }

            if (combinedUser.email === 'admin@gmail.com') {
                combinedUser.isAdmin = true;
                const poolKeys = await getApiPoolKeys();
                setApiPoolKeys(poolKeys);
            } else {
                combinedUser.isAdmin = false;
                 if(poolConfig.isEnabled) {
                    const poolKeys = await getApiPoolKeys();
                    setApiPoolKeys(poolKeys);
                }
            }
            setAppUser(combinedUser);
        };

        if (firebaseUser) {
            loadUserData(firebaseUser);
        } else {
            setAppUser(null);
        }
    }, [firebaseUser]);
    
    const handleApiConfigSave = (newConfig: ApiConfig) => {
        setApiConfig(newConfig);
        if (appUser) {
            saveUserApiConfig(appUser.uid, newConfig);
        }
    };
    
    const handleTaskConsumed = useCallback(() => {
        setInitialGenerationTask(null);
    }, []);

    const handleStartBuilding = useCallback(async (prompt: string, provider?: AiProvider, model?: string) => {
        if (!appUser) {
            alert("Please sign in to create a project.");
            return;
        }

        setIsNavigating(true);
        try {
            const projectType = 'React Web App';
            const projectProvider = provider || 'gemini';
            const tempName = prompt.length > 50 ? prompt.substring(0, 47) + '...' : prompt;
            
            const newProjectId = await createProject(appUser.uid, tempName, prompt, projectType, projectProvider, {}, model);
            
            setInitialGenerationTask({ prompt, provider: projectProvider, model });
            setSelectedProjectId(newProjectId);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to create project.";
            alert(`Error: ${errorMessage}`);
        } finally {
            setIsNavigating(false);
        }
    }, [appUser]);


    const handleSelectProject = (projectId: string) => {
        setSelectedProjectId(projectId);
    };

    const handleBackToDashboard = () => {
        setSelectedProjectId(null);
        setInitialGenerationTask(null); // Clear any pending tasks
    };

    const renderContent = () => {
        if (showDocs) {
            return <DocumentationPage onBack={() => setShowDocs(false)} onSignInClick={() => setShowDocs(false)} />;
        }
        
        if (loading || (firebaseUser && !appUser) || isNavigating) {
            return (
                <div className="flex flex-col items-center justify-center h-screen bg-base-100">
                    <Spinner size="lg" />
                    <p className="mt-4 text-base-content">{isNavigating ? 'Preparing your workspace...' : 'Loading...'}</p>
                </div>
            );
        }
        
        if (appUser) {
            if (selectedProjectId) {
                const project = { prompt: initialGenerationTask?.prompt, provider: initialGenerationTask?.provider, model: initialGenerationTask?.model } as Project;
                return <EditorPage 
                            projectId={selectedProjectId} 
                            onBackToDashboard={handleBackToDashboard} 
                            user={appUser} 
                            apiConfig={apiConfig} 
                            onApiConfigChange={handleApiConfigSave}
                            initialGenerationTask={initialGenerationTask}
                            onTaskConsumed={handleTaskConsumed}
                            apiPoolConfig={apiPoolConfig}
                            apiPoolKeys={apiPoolKeys}
                            refreshUserProfile={() => refreshUserProfile(appUser.uid)}
                        />;
            }
            return <DashboardPage 
                        user={appUser} 
                        onSelectProject={handleSelectProject} 
                        onStartBuilding={handleStartBuilding} 
                        apiConfig={apiConfig} 
                        onApiConfigChange={handleApiConfigSave}
                        apiPoolConfig={apiPoolConfig}
                        apiPoolKeys={apiPoolKeys}
                        setApiPoolConfig={setApiPoolConfig}
                        setApiPoolKeys={setApiPoolKeys}
                        onShowDocs={() => setShowDocs(true)}
                        refreshUserProfile={() => refreshUserProfile(appUser.uid)}
                    />;
        }

        return <LoginPage onShowDocs={() => setShowDocs(true)} />;
    };

    return (
        <ThemeProvider>
            <BrandingProvider>
                {renderContent()}
            </BrandingProvider>
        </ThemeProvider>
    );
};

export default App;