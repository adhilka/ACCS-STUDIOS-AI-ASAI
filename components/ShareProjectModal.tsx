import React, { useState } from 'react';
import Spinner from './ui/Spinner';
import { CopyIcon, CheckIcon, ShareIcon, UsersIcon } from './icons';
import { createInvite } from '../services/firestoreService';

interface ShareProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onGenerateKey: (projectId: string) => Promise<string>;
  isCollaborationEnabled: boolean;
  ownerUid: string;
}

const ShareProjectModal: React.FC<ShareProjectModalProps> = ({ isOpen, onClose, projectId, onGenerateKey, isCollaborationEnabled, ownerUid }) => {
  const [shareKey, setShareKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsLoading(true);
    setError('');
    setShareKey(null);
    try {
      const key = await onGenerateKey(projectId);
      setShareKey(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate key.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleInvite = async () => {
    if (!inviteEmail.trim() || !isCollaborationEnabled) return;
    setIsInviting(true);
    setError('');
    setInviteCode(null);
    try {
      const code = await createInvite(projectId, ownerUid, inviteEmail);
      setInviteCode(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invite.');
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
  
  const handleClose = () => {
    setShareKey(null);
    setError('');
    setInviteCode(null);
    setInviteEmail('');
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity duration-300">
      <div className="bg-base-200 rounded-lg shadow-2xl p-8 w-full max-w-lg m-4 border border-base-300">
        <div className="flex items-center gap-3 mb-2">
          <ShareIcon className="w-6 h-6 text-green-400" />
          <h2 className="text-2xl font-bold text-base-content">Share Project</h2>
        </div>
        <p className="text-sm text-neutral mb-6">
          Invite others to view or collaborate on your project.
        </p>

        {error && <p className="text-red-400 text-sm p-3 rounded-md bg-red-500/10 border border-red-500/20 my-4">{error}</p>}
        
        {/* Collaboration Invite Section */}
        <div className={`p-4 rounded-lg border ${isCollaborationEnabled ? 'border-secondary/50 bg-secondary/10' : 'border-base-300 bg-base-300/30'}`}>
            <div className='flex items-center gap-2 mb-2'>
                <UsersIcon className={`w-5 h-5 ${isCollaborationEnabled ? 'text-secondary' : 'text-neutral'}`} />
                <h3 className="font-semibold text-base-content">Invite Collaborator (Live Server)</h3>
            </div>
            {isCollaborationEnabled ? (
                <div>
                     <p className="text-xs text-neutral mb-3">Invite a user via email for real-time collaboration. Requires a user-provided Firebase server.</p>
                     {inviteCode ? (
                         <div className="space-y-2">
                            <p className="text-sm text-neutral">Share this invite code:</p>
                            <div className="flex items-center gap-2 p-2 bg-base-100 border border-base-300 rounded-md">
                                <input type="text" readOnly value={inviteCode} className="w-full bg-transparent font-mono text-base-content focus:outline-none"/>
                                <button onClick={() => handleCopy(inviteCode)} className="p-2 rounded-md hover:bg-base-300" title={copied ? 'Copied!' : 'Copy code'}>
                                    {copied ? <CheckIcon className="w-5 h-5 text-green-500" /> : <CopyIcon className="w-5 h-5 text-neutral" />}
                                </button>
                            </div>
                         </div>
                     ) : (
                        <div className="flex items-center gap-2">
                           <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder=" collaborator@email.com" className="flex-grow bg-base-100 border border-base-300 rounded-md py-2 px-3 text-sm" disabled={isInviting} />
                           <button onClick={handleInvite} disabled={isInviting || !inviteEmail.trim()} className="px-4 py-2 bg-secondary text-white font-semibold rounded-md text-sm w-36 flex justify-center items-center">
                               {isInviting ? <Spinner size="sm" /> : 'Get Invite Code'}
                           </button>
                        </div>
                     )}
                </div>
            ) : (
                <p className="text-xs text-neutral">To enable real-time collaboration, the project owner must configure a Firebase server in Project Settings.</p>
            )}
        </div>
        
        <div className="my-4 text-center text-xs text-neutral">OR</div>

        {/* Simple Share Key Section */}
        <div className="p-4 rounded-lg border border-base-300 bg-base-300/30">
             <h3 className="font-semibold text-base-content mb-2">Generate Simple Share Key</h3>
             <p className="text-xs text-neutral mb-3">Generate a single-use key to let another user join and edit this project (non-real-time).</p>
            {shareKey ? (
                <div className="space-y-2">
                    <p className="text-sm text-neutral">Share this key:</p>
                    <div className="flex items-center gap-2 p-2 bg-base-100 border border-base-300 rounded-md">
                        <input type="text" readOnly value={shareKey} className="w-full bg-transparent font-mono text-base-content focus:outline-none"/>
                        <button onClick={() => handleCopy(shareKey)} className="p-2 rounded-md hover:bg-base-300" title={copied ? 'Copied!' : 'Copy key'}>
                            {copied ? <CheckIcon className="w-5 h-5 text-green-500" /> : <CopyIcon className="w-5 h-5 text-neutral" />}
                        </button>
                    </div>
                </div>
            ) : (
                 <button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className="w-full px-6 py-2 bg-primary/80 hover:bg-primary rounded-md text-white font-semibold transition-colors flex items-center justify-center disabled:bg-primary/50"
                 >
                    {isLoading ? <Spinner size="sm" /> : 'Generate Share Key'}
                </button>
            )}
        </div>

        <div className="flex justify-end mt-8">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-base-300 hover:bg-opacity-80 rounded-md text-base-content font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareProjectModal;