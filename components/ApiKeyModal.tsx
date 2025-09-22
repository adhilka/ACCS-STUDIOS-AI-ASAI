import React, { useState, useEffect } from 'react';
import { ApiConfig, AiProvider } from '../types';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: ApiConfig) => void;
  currentConfig: ApiConfig;
}

const providerDetails = {
    gemini: { name: 'Gemini', placeholder: 'Enter your Gemini API Key', note: 'Get your key from Google AI Studio.' },
    openrouter: { name: 'OpenRouter', placeholder: 'Enter your OpenRouter API Key', note: 'Get your key from openrouter.ai.'},
    groq: { name: 'Groq', placeholder: 'Enter your Groq API Key', note: 'Get your key from groq.com.'},
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave, currentConfig }) => {
  const [keys, setKeys] = useState<ApiConfig>({ gemini: null, openrouter: null, groq: null });

  useEffect(() => {
    if (isOpen) {
        setKeys(currentConfig);
    }
  }, [currentConfig, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmedKeys: ApiConfig = {
        gemini: keys.gemini?.trim() || null,
        openrouter: keys.openrouter?.trim() || null,
        groq: keys.groq?.trim() || null,
    };
    onSave(trimmedKeys);
    onClose();
  };
  
  const handleKeyChange = (provider: AiProvider, value: string) => {
    setKeys(prev => ({ ...prev, [provider]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity duration-300">
      <div className="bg-base-200 rounded-lg shadow-2xl p-8 w-full max-w-md m-4 border border-base-300">
        <h2 className="text-2xl font-bold mb-4 text-base-content">API Key Settings</h2>
        <p className="text-sm text-neutral mb-6">Your keys are stored securely in your account and are never shared.</p>
        
        <div className="space-y-6">
             {(Object.keys(providerDetails) as AiProvider[]).map((providerKey) => (
                <div key={providerKey}>
                    <label htmlFor={providerKey} className="block text-sm font-medium text-neutral mb-2">
                        {providerDetails[providerKey].name} API Key
                    </label>
                    <input
                        type="password"
                        id={providerKey}
                        value={keys[providerKey] || ''}
                        onChange={(e) => handleKeyChange(providerKey, e.target.value)}
                        placeholder={providerDetails[providerKey].placeholder}
                        className="w-full bg-base-100 border border-base-300 rounded-md py-2 px-3 text-base-content focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                     <p className="text-xs text-neutral/80 mt-2">{providerDetails[providerKey].note}</p>
                </div>
            ))}
        </div>

        <div className="flex justify-end space-x-4 mt-8">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-base-300 hover:bg-opacity-80 rounded-md text-base-content font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-primary hover:opacity-90 rounded-md text-white font-semibold transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;