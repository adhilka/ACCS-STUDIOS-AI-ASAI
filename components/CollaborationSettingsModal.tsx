import React, { useState, useEffect } from 'react';
import { User, CustomFirebaseConfig } from '../types';
import { saveCustomFirebaseConfig } from '../services/firestoreService';
import Spinner from './ui/Spinner';
import { ExclamationTriangleIcon, CopyIcon, CheckIcon } from './icons';

interface CollaborationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUpdateSuccess?: () => void;
}

const CollaborationSettingsModal: React.FC<CollaborationSettingsModalProps> = ({ isOpen, onClose, user, onUpdateSuccess }) => {
  // FIX: Removed databaseURL from initial state to align with Firestore-only setup.
  const [config, setConfig] = useState<CustomFirebaseConfig>({
    enabled: false,
    apiKey: '',
    authDomain: '',
    projectId: '',
    ...user.customFirebaseConfig,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [rulesCopied, setRulesCopied] = useState(false);
  const [currentHostname, setCurrentHostname] = useState('');

  useEffect(() => {
    if (isOpen) {
      // FIX: Removed databaseURL from state reset to align with Firestore-only setup.
      setConfig({
        enabled: false,
        apiKey: '',
        authDomain: '',
        projectId: '',
        ...user.customFirebaseConfig,
      });
      setShowRules(false); // Reset on open
      if (typeof window !== 'undefined') {
        setCurrentHostname(window.location.hostname);
      }
    }
  }, [isOpen, user.customFirebaseConfig]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveCustomFirebaseConfig(user.uid, config);
      alert('Settings saved successfully!');
      onUpdateSuccess?.(); // Trigger profile refresh
      onClose();
    } catch (error) {
      alert(`Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
  };

const firestoreRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // WARNING: These rules are insecure and allow open access to your database.
    // Use this for development or trusted environments only.
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`;

    const handleCopyRules = () => {
        navigator.clipboard.writeText(firestoreRules);
        setRulesCopied(true);
        setTimeout(() => setRulesCopied(false), 2000);
    };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] transition-opacity duration-300">
      <div className="bg-base-200 rounded-lg shadow-2xl p-8 w-full max-w-3xl m-4 border border-base-300 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-2 text-base-content">Collaboration & Snapshots Setup</h2>
        <p className="text-sm text-neutral mb-6">Connect your own Firebase project to enable real-time collaboration using <strong className="text-base-content/80">Cloud Firestore</strong>.</p>

        <div className="flex items-center justify-between p-4 rounded-lg bg-base-300/50 border border-base-300 mb-6">
          <label htmlFor="enable-collab" className="font-semibold text-base-content">
            Enable Custom Firebase Server
          </label>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              id="enable-collab"
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig(prev => ({ ...prev, enabled: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-base-100 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary"></div>
          </label>
        </div>

        {/* FIX: Removed Database URL field and adjusted layout for Firestore config. */}
        <div className={`space-y-4 transition-opacity duration-300 ${config.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <div>
            <InputField label="Firebase API Key" name="apiKey" value={config.apiKey || ''} onChange={handleInputChange} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Firebase Auth Domain" name="authDomain" value={config.authDomain || ''} onChange={handleInputChange} placeholder="your-project-id.firebaseapp.com" />
            <InputField label="Firebase Project ID" name="projectId" value={config.projectId || ''} onChange={handleInputChange} placeholder="your-project-id" />
          </div>
        </div>

        {config.enabled && (
            <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-300/90 text-sm">
                <div className='flex items-start gap-3'>
                    <ExclamationTriangleIcon className="w-8 h-8 text-yellow-400 mt-0.5 shrink-0" />
                    <div>
                        <h4 className="font-bold text-yellow-300">Important Configuration</h4>
                         <p className="mt-2 text-yellow-300/90">To enable collaboration, you must configure your Firebase project:</p>
                        <ol className="list-decimal list-inside mt-2 space-y-3">
                            <li>
                                <strong>Authorize this App's Domain:</strong> In your Firebase project, go to <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-yellow-200 hover:underline font-semibold">Authentication &gt; Settings &gt; Authorized domains</a> and add the following domain:
                                <div className="my-1 p-2 bg-base-100/50 rounded-md text-slate-300 font-mono text-xs">
                                    {currentHostname || 'your-app-domain.com'}
                                </div>
                            </li>
                            <li>
                                <strong>Open Firestore Security Rules:</strong> For the simplest setup, your Firestore database needs to be freely accessible. <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-yellow-200 hover:underline font-semibold">Go to Firestore Database &gt; Rules</a> and replace the existing rules with the ones provided below. <strong>This will make your database public.</strong>
                            </li>
                        </ol>
                        <button onClick={() => setShowRules(!showRules)} className="text-yellow-200 hover:underline font-semibold mt-4 text-sm">
                            {showRules ? 'Hide' : 'Show'} Required Security Rules
                        </button>
                        {showRules && (
                            <div className="mt-2 bg-base-100/50 p-3 rounded-md relative">
                                <button onClick={handleCopyRules} className="absolute top-2 right-2 px-2 py-1 text-xs bg-base-300 rounded hover:bg-base-100 flex items-center gap-1 text-neutral hover:text-base-content">
                                    {rulesCopied ? <><CheckIcon className="w-3 h-3 text-green-400" /> Copied</> : <><CopyIcon className="w-3 h-3" /> Copy</>}
                                </button>
                                <pre className="text-xs text-slate-300 overflow-x-auto"><code>{firestoreRules}</code></pre>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        <div className="flex justify-end space-x-4 mt-8 pt-4 border-t border-base-300">
          <button onClick={onClose} disabled={isSaving} className="px-4 py-2 bg-base-300 hover:bg-opacity-80 rounded-md text-base-content font-semibold transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={isSaving} className="px-6 py-2 bg-secondary hover:opacity-90 rounded-md text-white font-semibold transition-colors w-32 flex justify-center items-center">
            {isSaving ? <Spinner size="sm" /> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

const InputField: React.FC<{ label: string, name: string, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, placeholder?: string }> = 
({ label, name, value, onChange, placeholder }) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-neutral mb-2">{label}</label>
        <input
            type="text"
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full bg-base-100 border border-base-300 rounded-md py-2 px-3 text-base-content focus:outline-none focus:ring-2 focus:ring-secondary"
        />
    </div>
);

export default CollaborationSettingsModal;