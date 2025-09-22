import React, { useState } from 'react';
import { auth } from '../services/firebase';
import { CodeIcon, ArrowLeftIcon } from '../components/icons';

interface LoginPageProps {
    onBackToHome: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onBackToHome }) => {
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
        <div className="min-h-screen flex items-center justify-center bg-base-100 p-4">
            <div className="w-full max-w-md bg-base-200 rounded-lg shadow-2xl p-8 border border-base-300 relative">
                <button onClick={onBackToHome} className="absolute top-4 left-4 text-neutral hover:text-base-content transition-colors p-2 rounded-full hover:bg-base-300 flex items-center gap-2" title="Back to Home">
                    <ArrowLeftIcon className="w-5 h-5" />
                </button>

                <div className="flex flex-col items-center mb-8">
                     <div className="bg-primary p-3 rounded-lg mb-4 shadow-lg">
                        <CodeIcon className="w-8 h-8 text-white"/>
                    </div>
                    <h1 className="text-3xl font-bold text-base-content">Welcome to ASAI</h1>
                    <p className="text-neutral mt-1">{isLogin ? 'Sign in to your account' : 'Create a new account'}</p>
                </div>
                
                {error && <p className="bg-red-500/20 text-red-400 text-sm p-3 rounded-md mb-4 border border-red-500/30">{error}</p>}

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
                            className="w-full bg-base-100 border border-base-300 rounded-md py-2 px-4 text-base-content focus:outline-none focus:ring-2 focus:ring-primary transition"
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
                            className="w-full bg-base-100 border border-base-300 rounded-md py-2 px-4 text-base-content focus:outline-none focus:ring-2 focus:ring-primary transition"
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

                <div className="text-center mt-6">
                    <button onClick={() => setIsLogin(!isLogin)} className="text-sm text-accent hover:underline">
                        {isLogin ? 'Need an account? Sign Up' : 'Already have an account? Login'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;