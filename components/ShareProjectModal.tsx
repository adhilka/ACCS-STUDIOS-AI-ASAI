import React, { useState } from 'react';
import Spinner from './ui/Spinner';
import { CopyIcon, CheckIcon, ShareIcon } from './icons';

interface ShareProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onGenerateKey: (projectId: string) => Promise<string>;
}

const ShareProjectModal: React.FC<ShareProjectModalProps> = ({ isOpen, onClose, projectId, onGenerateKey }) => {
  const [shareKey, setShareKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

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

  const handleCopy = () => {
    if (!shareKey) return;
    navigator.clipboard.writeText(shareKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleClose = () => {
    setShareKey(null);
    setError('');
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity duration-300">
      <div className="bg-base-200 rounded-lg shadow-2xl p-8 w-full max-w-md m-4 border border-base-300">
        <div className="flex items-center gap-3 mb-4">
          <ShareIcon className="w-6 h-6 text-green-400" />
          <h2 className="text-2xl font-bold text-base-content">Share Project</h2>
        </div>
        <p className="text-sm text-neutral mb-6">
          Generate a single-use key to invite a collaborator to your project. They will have full edit access.
        </p>

        {error && <p className="text-red-400 text-sm p-3 rounded-md bg-red-500/10 border border-red-500/20 my-4">{error}</p>}

        {shareKey ? (
            <div className="space-y-4">
                <p className="text-sm text-neutral">Share this key with your collaborator:</p>
                <div className="flex items-center gap-2 p-3 bg-base-100 border border-base-300 rounded-md">
                    <input
                        type="text"
                        readOnly
                        value={shareKey}
                        className="w-full bg-transparent font-mono text-base-content focus:outline-none"
                    />
                    <button onClick={handleCopy} className="p-2 rounded-md hover:bg-base-300 transition-colors" title={copied ? 'Copied!' : 'Copy key'}>
                        {copied ? <CheckIcon className="w-5 h-5 text-green-500" /> : <CopyIcon className="w-5 h-5 text-neutral" />}
                    </button>
                </div>
                 <p className="text-xs text-neutral/80">This key can only be used once and will be deleted after use.</p>
            </div>
        ) : (
             <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="w-full px-6 py-3 bg-primary hover:opacity-90 rounded-md text-white font-semibold transition-colors flex items-center justify-center disabled:bg-primary/50"
             >
                {isLoading ? <Spinner size="sm" /> : 'Generate Share Key'}
            </button>
        )}

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