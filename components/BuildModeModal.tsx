import React, { useState } from 'react';
import { AiIcon } from './icons';
import Spinner from './ui/Spinner';

interface BuildModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBuild: (prompt: string) => void;
  isLoading: boolean;
}

const BuildModeModal: React.FC<BuildModeModalProps> = ({ isOpen, onClose, onBuild, isLoading }) => {
  const [prompt, setPrompt] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    onBuild(prompt);
    onClose(); // Close modal after submitting
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity duration-300">
      <form onSubmit={handleSubmit} className="bg-base-200 rounded-lg shadow-2xl p-8 w-full max-w-3xl m-4 border border-base-300 flex flex-col" style={{height: '70vh'}}>
        <div className='flex items-center gap-3 mb-4'>
            <AiIcon className="w-8 h-8 text-primary"/>
            <div>
                <h2 className="text-2xl font-bold text-base-content">Build Mode</h2>
                <p className="text-sm text-neutral">Describe a new feature, a big change, or a complex refactor.</p>
            </div>
        </div>
        
        <div className="flex-grow flex flex-col mb-6">
          <label htmlFor="buildPrompt" className="block text-sm font-medium text-neutral mb-2">
            Your Request
          </label>
           <textarea
              id="buildPrompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="flex-grow w-full bg-base-100 border border-base-300 rounded-md py-2 px-3 text-base-content focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="e.g., Refactor the App component to use a context for state management, and create a new settings page with a theme toggle..."
            />
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
            disabled={isLoading || !prompt.trim()}
            className="px-6 py-2 bg-primary hover:opacity-90 rounded-md text-white font-semibold transition-colors flex items-center justify-center disabled:bg-primary/50 w-40"
          >
            {isLoading ? <Spinner size="sm" /> : 'Generate Plan'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BuildModeModal;