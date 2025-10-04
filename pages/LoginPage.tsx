import React, { useState } from 'react';
import { auth } from '../services/firebase';
import { CodeIcon, RobotIcon, UsersIcon, PlayIcon } from '../components/icons';
import ThemeToggle from '../components/ThemeToggle';

interface LoginPageProps {
    onShowDocs: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onShowDocs }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (isLogin) {
                await auth.signInWithEmailAndPassword(email, password);
            } else {
                await auth.createUserWithEmailAndPassword(email, password);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-base-100 flex items-center justify-center p-4 selection:bg-primary/20 relative">
            <ThemeToggle className="absolute top-4 right-4" />
            <div className="grid md:grid-cols-2 max-w-4xl w-full bg-base-200 rounded-2xl shadow-2xl overflow-hidden border border-base-300/50">
                {/* Left Panel */}
                <div className="hidden md:block p-12 bg-gradient-to-br from-primary/5 via-base-200 to-base-200 relative">
                    <div className="text-base-content">
                        <div className="flex items-center gap-3">
                            <CodeIcon className="w-10 h-10 text-primary" />
                            <h1 className="text-2xl font-bold tracking-wider">ACCS STUDIOS AI</h1>
                        </div>
                        <p className="mt-4 text-3xl font-bold">Build applications at the speed of thought.</p>
                        <p className="mt-4 text-neutral">Your autonomous AI partner for planning, coding, and collaboration.</p>
                    </div>
                    <div className="mt-12 space-y-8">
                        <div className="flex items-start gap-4">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary"><RobotIcon className="w-6 h-6" /></div>
                            <div>
                                <h3 className="font-semibold">Autonomous Agents</h3>
                                <p className="text-sm text-neutral">Define high-level objectives and let the AI handle the implementation details.</p>
                            </div>
                        </div>
                         <div className="flex items-start gap-4">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary"><UsersIcon className="w-6 h-6" /></div>
                            <div>
                                <h3 className="font-semibold">Real-time Collaboration</h3>
                                <p className="text-sm text-neutral">Code together in real-time on your own secure, self-hosted server.</p>
                            </div>
                        </div>
                         <div className="flex items-start gap-4">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary"><PlayIcon className="w-6 h-6" /></div>
                            <div>
                                <h3 className="font-semibold">Live Sandbox Preview</h3>
                                <p className="text-sm text-neutral">Instantly preview your application in an interactive StackBlitz environment.</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Right Panel (Form) */}
                <div className="p-8 md:p-12 flex flex-col justify-center">
                     <div className="mb-8 text-center md:hidden">
                         <div className="flex items-center gap-3 justify-center">
                            <CodeIcon className="w-8 h-8 text-primary" />
                            <h1 className="text-xl font-bold tracking-wider">ACCS STUDIOS AI</h1>
                        </div>
                    </div>

                    <h2 className="text-3xl font-bold text-base-content mb-2">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
                    <p className="text-neutral mb-8">{isLogin ? 'Sign in to continue.' : 'Get started in seconds.'}</p>
                    
                    {error && <p className="bg-red-500/10 text-red-400 text-sm p-3 rounded-md mb-6 border border-red-500/20">{error}</p>}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-neutral text-sm font-bold mb-2" htmlFor="email">
                                Email Address
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full bg-base-300 border border-base-300/50 rounded-md py-3 px-4 text-base-content focus:outline-none focus:ring-2 focus:ring-primary transition"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-neutral text-sm font-bold mb-2" htmlFor="password">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-base-300 border border-base-300/50 rounded-md py-3 px-4 text-base-content focus:outline-none focus:ring-2 focus:ring-primary transition"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary hover:opacity-90 text-white font-bold py-3 px-4 rounded-md transition-all duration-300 transform hover:scale-105 disabled:bg-primary/50 disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center"
                        >
                            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Sign Up')}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm">
                        <button onClick={() => setIsLogin(!isLogin)} className="text-accent hover:underline">
                            {isLogin ? 'Need an account? Sign Up' : 'Already have an account? Login'}
                        </button>
                        <span className="mx-2 text-neutral">|</span>
                        <button onClick={onShowDocs} className="text-accent hover:underline">
                            Documentation
                        </button>
                    </div>
                    <p className="text-center text-xs text-neutral/50 mt-4">Version 1.0.1 ALPHA</p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;