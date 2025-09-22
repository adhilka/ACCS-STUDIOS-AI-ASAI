import React, { useState, useEffect } from 'react';
import { Project } from '../types';

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, prompt: string, model?: string) => void;
  project: Project;
  isSaving?: boolean;
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

const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({ isOpen, onClose, onSave, project, isSaving }) => {
  const [name, setName] = useState(project.name);
  const [prompt, setPrompt] = useState(project.prompt || '');
  const [model, setModel] = useState(project.model || '');

  useEffect(() => {
    setName(project.name);
    setPrompt(project.prompt || '');
    setModel(project.model || (project.provider === 'groq' ? modelOptions.groq[0].id : project.provider === 'openrouter' ? modelOptions.openrouter[0].id : ''));
  }, [project, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(name, prompt, model);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity duration-300">
      <div className="bg-base-200 rounded-lg shadow-2xl p-8 w-full max-w-2xl m-4 border border-base-300">
        <h2 className="text-2xl font-bold mb-6 text-base-content">Project Settings</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="projectName" className="block text-sm font-medium text-neutral mb-2">
                Project Name
              </label>
              <input
                type="text"
                id="projectName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-base-300 border border-base-300/50 rounded-md py-2 px-3 text-base-content focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            {(project.provider === 'openrouter' || project.provider === 'groq') && (
                <div>
                    <label htmlFor="model" className="block text-sm font-medium text-neutral mb-2">
                        AI Model ({project.provider})
                    </label>
                    <select
                        id="model"
                        value={model}
                        onChange={e => setModel(e.target.value)}
                        className="w-full h-[42px] bg-base-300 border border-base-300/50 rounded-md px-3 text-base-content text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        {modelOptions[project.provider].map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                    </select>
                </div>
            )}
        </div>

        <div className="mb-6">
          <label htmlFor="projectPrompt" className="block text-sm font-medium text-neutral mb-2">
            Core Project Prompt / Description
          </label>
           <textarea
              id="projectPrompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              className="w-full bg-base-300 border border-base-300/50 rounded-md py-2 px-3 text-base-content focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g., A simple todo list app with a button to add new items..."
            />
          <p className="text-xs text-neutral/80 mt-2">This is the original prompt used to generate the project. Modifying it can help the AI understand future requests better.</p>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 bg-base-300 hover:bg-opacity-80 rounded-md text-base-content font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-primary hover:opacity-90 rounded-md text-white font-semibold transition-colors disabled:bg-primary/50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectSettingsModal;
