import React, { useState, useMemo } from 'react';
import { CrownIcon, BrainIcon, GroqIcon, OpenRouterIcon, GeminiIcon, ExclamationTriangleIcon } from './icons';
import Spinner from './ui/Spinner';
import { ApiConfig } from '../types';

interface GodModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (objective: string) => void;
  isLoading: boolean;
  apiConfig: ApiConfig;
}

const GodModeModal: React.FC<GodModeModalProps> = ({ isOpen, onClose, onStart, isLoading, apiConfig }) => {
  const [objective, setObjective] = useState('');

  const hasAllKeys = useMemo(() => !!apiConfig.gemini && !!apiConfig.groq && !!apiConfig.openrouter, [apiConfig]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!objective.trim() || isLoading || !hasAllKeys) return;
    onStart(objective);
    onClose();
  };

  const KeyStatus: React.FC<{ provider: string, hasKey: boolean, icon: React.ReactNode }> = ({ provider, hasKey, icon }) => (
     <div className={`flex items-center justify-between p-2 rounded-md text-sm ${hasKey ? 'bg-green-500/10 text-green-300' : 'bg-red-500/10 text-red-400'}`}>
        <div className="flex items-center gap-2">
            {icon}
            <span className="font-semibold">{provider}</span>
        </div>
        <span>{hasKey ? 'Ready' : 'API Key Missing'}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity duration-300 p-4">
      <form onSubmit={handleSubmit} className="bg-base-200 rounded-lg shadow-2xl p-6 sm:p-8 w-full max-w-md sm:max-w-3xl border border-base-300 flex flex-col h-[90vh]">
        <div className='flex items-center gap-3 mb-4'>
            <CrownIcon className="w-8 h-8 text-yellow-400"/>
            <div>
                <h2 className="text-2xl font-bold text-base-content">God Mode</h2>
                <p className="text-sm text-neutral">Give the AI full control to achieve your objective.</p>
            </div>
        </div>
        
        <div className="flex-grow flex flex-col mb-6">
          <label htmlFor="objective" className="block text-sm font-medium text-neutral mb-2">
            Your High-Level Objective
          </label>
           <textarea
              id="objective"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className="flex-grow w-full bg-base-100 border border-base-300 rounded-md py-2 px-3 text-base-content focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
              placeholder="e.g., Rename the project to 'Super Timer', then create a new component called TimerDisplay.tsx and add a basic <h1> to it..."
            />
             <p className="text-xs text-neutral/80 mt-2">The AI will take control of the UI and files to complete this task. You can stop it at any time.</p>
        </div>
        
        <div className="p-4 rounded-lg border border-base-300 bg-base-100/50 mb-6">
            <h3 className="font-bold text-center text-base-content mb-3">AI Agent Trio</h3>
            <p className="text-xs text-neutral text-center mb-4">God Mode uses a team of specialized AI agents to ensure accuracy and quality.</p>
            <div className="space-y-2">
                <KeyStatus provider="Gemini (Architect)" hasKey={!!apiConfig.gemini} icon={<GeminiIcon className="w-5 h-5"/>} />
                <KeyStatus provider="Groq (Coder)" hasKey={!!apiConfig.groq} icon={<GroqIcon className="w-5 h-5"/>} />
                <KeyStatus provider="OpenRouter (Reviewer)" hasKey={!!apiConfig.openrouter} icon={<OpenRouterIcon className="w-5 h-5"/>} />
            </div>
            {!hasAllKeys && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-400/90 text-sm flex items-center gap-3">
                    <ExclamationTriangleIcon className="w-6 h-6 shrink-0"/>
                    <div>
                       <span className="font-semibold">Missing API Keys:</span> Please add all three required API keys in Settings to enable God Mode.
                    </div>
                </div>
            )}
        </div>


        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 bg-base-300 hover:bg-opacity-80 rounded-md text-base-content font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || !objective.trim() || !hasAllKeys}
            className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-md text-white font-semibold transition-colors flex items-center justify-center disabled:bg-opacity-50 disabled:cursor-not-allowed w-40"
          >
            {isLoading ? <Spinner size="sm" /> : 'Unleash AI'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default GodModeModal;
