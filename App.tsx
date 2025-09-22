
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EditorPage from './pages/EditorPage';
import Spinner from './components/ui/Spinner';
import LandingPage from './pages/LandingPage';
import { BrandingProvider } from './contexts/BrandingContext';
// FIX: Import admin-related firestore functions and types.
import { createProject, getUserApiConfig, saveUserApiConfig, getApiPoolConfig, getApiPoolKeys, ensureUserDocument } from './services/firestoreService';
import { ApiConfig, AiProvider, ApiPoolConfig, ApiPoolKey, User } from './types';

// FIX: Encapsulated all logic within the App component to fix scoping issues.
const App: React.FC = () => {
    console.log("Hello, World!");
    const { user, loading } = useAuth();
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [showLogin, setShowLogin] = useState(false);
    
    const [initialGenerationTask, setInitialGenerationTask] = useState<{ prompt: string; provider: AiProvider, model?: string } | null>(null);
    const [isNavigating, setIsNavigating] = useState(false); // Used for interim loading state
    
    const [apiConfig, setApiConfig] = useState<ApiConfig>({ gemini: null, openrouter: null, groq: null });
    
    // FIX: Added state for admin features.
    const [isAdmin, setIsAdmin] = useState(false);
    const [apiPoolConfig, setApiPoolConfig] = useState<ApiPoolConfig>({ isEnabled: false });
    const [apiPoolKeys, setApiPoolKeys] = useState<ApiPoolKey[]>([]);


    // Fetch user's saved API config on login & check for admin status
    useEffect(() => {
        const checkAdminStatus = async (uid: string) => {
            const poolConfig = await getApiPoolConfig();
            setApiPoolConfig(poolConfig);
            if (user?.email === 'admin@gmail.com') {
                setIsAdmin(true);
                const poolKeys = await getApiPoolKeys();
                setApiPoolKeys(poolKeys);
            } else {
                setIsAdmin(false);
                // Non-admins only need pool keys if the pool is enabled
                if(poolConfig.isEnabled) {
                    const poolKeys = await getApiPoolKeys();
                    setApiPoolKeys(poolKeys);
                }
            }
        };

        if (user) {
            ensureUserDocument(user.uid, user.email);
            getUserApiConfig(user.uid).then(config => {
                if (config) {
                    setApiConfig(config);
                }
            });
            checkAdminStatus(user.uid);
        } else {
            setIsAdmin(false);
        }
    }, [user]);
    
    const handleApiConfigSave = (newConfig: ApiConfig) => {
        setApiConfig(newConfig);
        if (user) {
            saveUserApiConfig(user.uid, newConfig);
        }
    };
    
    const handleTaskConsumed = useCallback(() => {
        setInitialGenerationTask(null);
    }, []);

    // This is now the primary function to kick things off from Landing or Dashboard
    const handleStartBuilding = useCallback(async (prompt: string, provider?: AiProvider, model?: string) => {
        if (!user) {
            // If user isn't logged in, save the task and show the login page.
            setInitialGenerationTask({ prompt, provider: provider || 'gemini', model });
            setShowLogin(true);
            return;
        }

        setIsNavigating(true);
        try {
            // For now, default to React Web App. This could be a user choice later.
            const projectType = 'React Web App';
            const projectProvider = provider || 'gemini';
            // Use a temporary name; the AI will provide a better one.
            const tempName = prompt.length > 50 ? prompt.substring(0, 47) + '...' : prompt;
            
            // Create a new, empty project in Firestore to get an ID.
            const newProjectId = await createProject(user.uid, tempName, prompt, projectType, projectProvider, {}, model);
            
            // Set the task for the EditorPage to execute upon loading.
            setInitialGenerationTask({ prompt, provider: projectProvider, model });
            setSelectedProjectId(newProjectId);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to create project.";
            alert(`Error: ${errorMessage}`);
        } finally {
            setIsNavigating(false);
        }
    }, [user]);

    // Effect to trigger project creation after login if a prompt is pending
    useEffect(() => {
        if (user && initialGenerationTask && !selectedProjectId && !isNavigating) {
             handleStartBuilding(initialGenerationTask.prompt, initialGenerationTask.provider, initialGenerationTask.model);
        }
    }, [user, initialGenerationTask, selectedProjectId, isNavigating, handleStartBuilding]);


    const handleSelectProject = (projectId: string) => {
        setSelectedProjectId(projectId);
    };

    const handleBackToDashboard = () => {
        setSelectedProjectId(null);
        setInitialGenerationTask(null); // Clear any pending tasks
    };

    const augmentedUser: User | null = useMemo(() => {
        if (!user) {
            return null;
        }
        // Create a new object that inherits from the original Firebase user object.
        // This preserves prototype methods (like `updateProfile`) while allowing us
        // to add custom properties like `isAdmin`.
        const newAppUser = Object.create(user);
        newAppUser.isAdmin = isAdmin;
        return newAppUser;
    }, [user, isAdmin]);


    const renderContent = () => {
        if (loading || isNavigating) {
            return (
                <div className="flex flex-col items-center justify-center h-screen bg-base-100">
                    <Spinner size="lg" />
                    <p className="mt-4 text-base-content">{isNavigating ? 'Preparing your workspace...' : 'Loading...'}</p>
                </div>
            );
        }
        
        if (augmentedUser) {
            if (selectedProjectId) {
                return <EditorPage 
                            projectId={selectedProjectId} 
                            onBackToDashboard={handleBackToDashboard} 
                            user={augmentedUser} 
                            apiConfig={apiConfig} 
                            onApiConfigChange={handleApiConfigSave}
                            initialGenerationTask={initialGenerationTask}
                            onTaskConsumed={handleTaskConsumed}
                            // FIX: Pass admin state down to the editor page.
                            apiPoolConfig={apiPoolConfig}
                            apiPoolKeys={apiPoolKeys}
                        />;
            }
            return <DashboardPage 
                        user={augmentedUser} 
                        onSelectProject={handleSelectProject} 
                        onStartBuilding={handleStartBuilding} 
                        apiConfig={apiConfig} 
                        onApiConfigChange={handleApiConfigSave}
                        // FIX: Pass admin state down to the dashboard.
                        apiPoolConfig={apiPoolConfig}
                        apiPoolKeys={apiPoolKeys}
                        setApiPoolConfig={setApiPoolConfig}
                        setApiPoolKeys={setApiPoolKeys}
                    />;
        }

        // User is not logged in
        if (showLogin) {
            return <LoginPage onBackToHome={() => {
                setShowLogin(false);
                setInitialGenerationTask(null); // Clear prompt if user cancels login
            }} />;
        }

        return <LandingPage onStartBuilding={handleStartBuilding} onSignInClick={() => setShowLogin(true)} />;
    };

    return (
        <BrandingProvider>
            {renderContent()}
        </BrandingProvider>
    );
};

export default App;
