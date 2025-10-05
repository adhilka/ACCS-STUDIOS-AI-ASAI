import React, { useState, useEffect } from 'react';
import { AiProvider } from '../types';
import { RocketIcon } from './icons';
import Spinner from './ui/Spinner';

interface NewProjectBuilderProps {
  onStartBuilding: (prompt: string, provider: AiProvider, model: string) => void;
  isLoading: boolean;
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

const NewProjectBuilder: React.FC<NewProjectBuilderProps> = ({ onStartBuilding, isLoading }) => {
    const [prompt, setPrompt] = useState('');
    const [provider, setProvider] = useState<AiProvider>('gemini');
    const [model, setModel] = useState('');

    useEffect(() => {
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
        <div>
            <h2 className="text-xl font-bold mb-4 text-base-content">Describe Your Application</h2>
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
};

export default NewProjectBuilder;
