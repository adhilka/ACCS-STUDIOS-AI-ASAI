import React, { useState, useEffect } from 'react';
import { Project, AiProvider, ChatMessageSenderInfo, User } from '../types';
import CollaborationSettingsModal from './CollaborationSettingsModal';
import { useAuth } from '../hooks/useAuth';
import Spinner from './ui/Spinner';
import { UserIcon, TrashIcon, CopyIcon, CheckIcon } from './icons';

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, prompt: string, model?: string, sandboxType?: 'iframe' | 'stackblitz', provider?: AiProvider) => void;
  project: Project;
  isSaving?: boolean;
  members: ChatMessageSenderInfo[];
  onRemoveMember: (memberUid: string) => Promise<void>;
  onCreateInvite: (email: string) => Promise<string>;
  onUpdateSuccess?: () => void;
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

const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({ isOpen, onClose, onSave, project, isSaving, members, onRemoveMember, onCreateInvite, onUpdateSuccess }) => {
  const { user } = useAuth();
  const [name, setName] = useState(project.name);
  const [prompt, setPrompt] = useState(project.prompt || '');
  const [provider, setProvider] = useState(project.provider);
  const [model, setModel] = useState(project.model || '');
  const [sandboxType, setSandboxType] = useState(project.sandboxType || 'stackblitz');
  const [isCollabModalOpen, setIsCollabModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'members'>('general');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const isOwner = user?.uid === project.ownerId;

  useEffect(() => {
    setName(project.name);
    setPrompt(project.prompt || '');
    setProvider(project.provider);
    setModel(project.model || (project.provider === 'groq' ? modelOptions.groq[0].id : project.provider === 'openrouter' ? modelOptions.openrouter[0].id : ''));
    setSandboxType(project.sandboxType || 'stackblitz');
    setActiveTab('general');
    setInviteCode(null);
    setInviteEmail('');
  }, [project, isOpen]);
  
  useEffect(() => {
    if (provider === 'gemini') {
        setModel('');
    } else if (provider === 'groq' && !modelOptions.groq.some(m => m.id === model)) {
        setModel(modelOptions.groq[0].id);
    } else if (provider === 'openrouter' && !modelOptions.openrouter.some(m => m.id === model)) {
        setModel(modelOptions.openrouter[0].id);
    }
  }, [provider, model]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(name, prompt, model, sandboxType, provider);
  };
  
  const handleGenerateInvite = async () => {
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    setInviteCode(null);
    try {
        const code = await onCreateInvite(inviteEmail);
        setInviteCode(code);
    } catch (error) {
        alert(error instanceof Error ? error.message : "Failed to create invite");
    } finally {
        setIsInviting(false);
    }
  };

  const handleCopy = (textToCopy: string | null) => {
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabClasses = (tab: 'general' | 'members') => 
    `px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors border-b-2 ${
      activeTab === tab 
      ? 'border-primary text-primary' 
      : 'border-transparent text-neutral hover:text-base-content'
    }`;

  return (
    <>
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity duration-300 p-4">
      <div className="bg-base-200 rounded-lg shadow-2xl p-6 sm:p-8 w-full max-w-md sm:max-w-2xl border border-base-300 max-h-[90vh] flex flex-col">
        <h2 className="text-2xl font-bold mb-4 text-base-content">Project Settings</h2>
        
        <div className="border-b border-base-300 mb-6">
            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                <button onClick={() => setActiveTab('general')} className={tabClasses('general')}>General</button>
                {isOwner && <button onClick={() => setActiveTab('members')} className={tabClasses('members')}>Members & Collaboration</button>}
            </nav>
        </div>

        <div className="flex-grow overflow-y-auto pr-2">
            {activeTab === 'general' && (
                <div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label htmlFor="projectName" className="block text-sm font-medium text-neutral mb-2">
                            Project Name
                          </label>
                          <input
                            type="text"
                            id="projectName"
                            data-testid="godmode-project-name-input"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-base-100 border border-base-300 rounded-md py-2 px-3 text-base-content focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>
                         <div>
                            <label htmlFor="sandboxType" className="block text-sm font-medium text-neutral mb-2">
                                Sandbox Environment
                            </label>
                            <select
                                id="sandboxType"
                                value={sandboxType}
                                onChange={e => setSandboxType(e.target.value as 'iframe' | 'stackblitz')}
                                className="w-full h-[42px] bg-base-100 border border-base-300 rounded-md px-3 text-base-content text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                <option value="stackblitz">StackBlitz (In-Browser VM)</option>
                                <option value="iframe">Legacy (Browser Iframe)</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label htmlFor="provider" className="block text-sm font-medium text-neutral mb-2">
                                AI Provider
                            </label>
                             <select
                                id="provider"
                                value={provider}
                                onChange={e => setProvider(e.target.value as AiProvider)}
                                className="w-full h-[42px] bg-base-100 border border-base-300 rounded-md px-3 text-base-content text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                <option value="gemini">Gemini</option>
                                <option value="openrouter">OpenRouter</option>
                                <option value="groq">Groq</option>
                            </select>
                        </div>
                        {(provider === 'openrouter' || provider === 'groq') && (
                            <div>
                                <label htmlFor="model" className="block text-sm font-medium text-neutral mb-2">
                                    AI Model
                                </label>
                                <select
                                    id="model"
                                    value={model}
                                    onChange={e => setModel(e.target.value)}
                                    className="w-full h-[42px] bg-base-100 border border-base-300 rounded-md px-3 text-base-content text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                    {modelOptions[provider].map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
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
                          data-testid="godmode-project-prompt-input"
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          rows={5}
                          className="w-full bg-base-100 border border-base-300 rounded-md py-2 px-3 text-base-content focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="e.g., A simple todo list app with a button to add new items..."
                        />
                      <p className="text-xs text-neutral/80 mt-2">This is the original prompt used to generate the project. Modifying it can help the AI understand future requests better.</p>
                    </div>
                </div>
            )}
            {activeTab === 'members' && isOwner && (
                <div>
                     <div className="mb-6 p-4 border border-dashed border-secondary/50 rounded-lg bg-secondary/10">
                        <h3 className="font-semibold text-secondary mb-2">Setup Collaboration & Snapshots</h3>
                        <p className="text-sm text-neutral mb-3">Enable real-time collaboration by connecting your own Firebase server. This allows for live editing and project snapshots.</p>
                        <button
                            onClick={() => setIsCollabModalOpen(true)}
                            className="px-4 py-2 bg-secondary/80 hover:bg-secondary rounded-md text-white text-sm font-semibold transition-colors"
                        >
                            Open Collaboration Setup
                        </button>
                    </div>
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-base-content mb-3">Project Members ({members.length})</h3>
                        <div className="space-y-2 max-h-48 overflow-y-auto bg-base-100 p-2 rounded-md border border-base-300">
                            {members.map(member => (
                                <div key={member.uid} className="flex items-center justify-between p-2 bg-base-200 rounded-md">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full overflow-hidden bg-base-300 flex items-center justify-center">
                                            {member.photoURL ? <img src={member.photoURL} alt={member.displayName || ''} className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5 text-neutral" />}
                                        </div>
                                        <span className="text-sm font-medium">{member.displayName} {member.uid === project.ownerId && '(Owner)'}</span>
                                    </div>
                                    {isOwner && user.uid !== member.uid && (
                                        <button onClick={() => onRemoveMember(member.uid)} className="p-1.5 hover:bg-red-500/10 rounded-full" title="Remove member">
                                            <TrashIcon className="w-4 h-4 text-red-400"/>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                         <h3 className="text-lg font-semibold text-base-content mb-3">Invite New Member</h3>
                         {inviteCode ? (
                             <div>
                                 <p className="text-sm text-neutral mb-2">Share this single-use invite code with {inviteEmail}:</p>
                                 <div className="flex items-center gap-2 p-2 bg-base-100 border border-base-300 rounded-md">
                                     <input type="text" readOnly value={inviteCode} className="w-full bg-transparent font-mono text-base-content focus:outline-none"/>
                                     <button onClick={() => handleCopy(inviteCode)} className="p-2 rounded-md hover:bg-base-300" title={copied ? 'Copied!' : 'Copy code'}>
                                         {copied ? <CheckIcon className="w-5 h-5 text-green-500" /> : <CopyIcon className="w-5 h-5 text-neutral" />}
                                     </button>
                                 </div>
                                 <button onClick={() => setInviteCode(null)} className="text-xs text-primary hover:underline mt-2">Generate another invite</button>
                             </div>
                         ) : (
                             <div className="flex flex-col sm:flex-row items-center gap-2">
                                <input
                                   type="email"
                                   value={inviteEmail}
                                   onChange={(e) => setInviteEmail(e.target.value)}
                                   placeholder="Enter member's email address"
                                   className="flex-grow w-full bg-base-100 border border-base-300 rounded-md py-2 px-3 text-sm"
                                   disabled={isInviting}
                                />
                                <button onClick={handleGenerateInvite} disabled={isInviting || !inviteEmail.trim()} className="w-full sm:w-48 px-4 py-2 bg-primary text-white font-semibold rounded-md text-sm flex justify-center items-center">
                                   {isInviting ? <Spinner size="sm" /> : 'Generate Invite Code'}
                                </button>
                             </div>
                         )}
                    </div>
                </div>
            )}
        </div>
        
        <div className="flex justify-end space-x-4 mt-8 pt-4 border-t border-base-300 shrink-0">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 bg-base-300 hover:bg-opacity-80 rounded-md text-base-content font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            data-testid="godmode-save-settings-button"
            disabled={isSaving || activeTab !== 'general'}
            className="px-4 py-2 bg-primary hover:opacity-90 rounded-md text-white font-semibold transition-colors disabled:bg-primary/50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
    {user && <CollaborationSettingsModal isOpen={isCollabModalOpen} onClose={() => setIsCollabModalOpen(false)} user={user} onUpdateSuccess={onUpdateSuccess} />}
    </>
  );
};

export default ProjectSettingsModal;