import React, { useState, useEffect } from 'react';
import { AiChanges, FileNode } from '../types';
import { WrenchScrewdriverIcon } from './icons';
import Spinner from './ui/Spinner';

interface DebugRefactorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProposeFixes: (description: string, scope: 'file' | 'project') => void;
  onApplyFixes: () => void;
  isLoading: boolean;
  proposedChanges: AiChanges | null;
  selectedFile: FileNode | undefined;
}

const DebugRefactorModal: React.FC<DebugRefactorModalProps> = ({
  isOpen,
  onClose,
  onProposeFixes,
  onApplyFixes,
  isLoading,
  proposedChanges,
  selectedFile
}) => {
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<'file' | 'project'>('file');

  useEffect(() => {
    if (selectedFile) {
        setScope('file');
    } else {
        setScope('project');
    }
  }, [selectedFile, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || isLoading) return;
    onProposeFixes(description, scope);
  };

  const hasChanges = proposedChanges && proposedChanges.update && Object.keys(proposedChanges.update).length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity duration-300 p-4">
      <div className="bg-base-200 rounded-lg shadow-2xl p-6 sm:p-8 w-full max-w-md sm:max-w-4xl border border-base-300 flex flex-col h-[90vh]">
        <div className='flex items-center gap-3 mb-4'>
            <WrenchScrewdriverIcon className="w-8 h-8 text-yellow-500"/>
            <div>
                <h2 className="text-2xl font-bold text-base-content">AI Debug & Refactor</h2>
                <p className="text-sm text-neutral">Describe a bug or a desired refactoring and let the AI propose a fix.</p>
            </div>
        </div>
        
        {proposedChanges ? (
             <div className="flex-grow flex flex-col overflow-hidden">
                <h3 className="text-lg font-semibold text-base-content mb-3">AI Proposed Changes</h3>
                {hasChanges ? (
                    <div className="flex-grow overflow-y-auto bg-base-100 rounded-lg p-4 border border-base-300 space-y-4">
                        {Object.entries(proposedChanges.update!).map(([path, content]) => (
                            <div key={path}>
                                <p className="font-mono text-sm text-neutral mb-1">{path}</p>
                                <pre className="bg-base-300 text-neutral p-3 rounded-md text-xs w-full overflow-x-auto">
                                    <code>{content}</code>
                                </pre>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex-grow flex items-center justify-center text-center bg-base-100 rounded-lg p-4 border border-base-300">
                       <p className="text-neutral">The AI could not determine a fix based on your description.</p>
                    </div>
                )}
                <div className="flex justify-end space-x-4 mt-6">
                    <button onClick={onClose} disabled={isLoading} className="px-4 py-2 bg-base-300 hover:bg-opacity-80 rounded-md text-base-content font-semibold transition-colors">
                        Cancel
                    </button>
                    {hasChanges && (
                        <button onClick={onApplyFixes} disabled={isLoading} className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded-md text-white font-semibold transition-colors flex items-center justify-center disabled:bg-opacity-50 w-40">
                             {isLoading ? <Spinner size="sm" /> : 'Apply Changes'}
                        </button>
                    )}
                </div>
            </div>
        ) : (
            <form onSubmit={handleSubmit} className="flex flex-col flex-grow">
                 <div className="mb-4">
                    <label htmlFor="scope" className="block text-sm font-medium text-neutral mb-2">Scope</label>
                    <select
                        id="scope"
                        value={scope}
                        onChange={e => setScope(e.target.value as 'file' | 'project')}
                        className="w-full bg-base-100 border border-base-300 rounded-md py-2 px-3 text-base-content focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    >
                        <option value="file" disabled={!selectedFile}>
                            Selected File ({selectedFile ? selectedFile.path : 'No file selected'})
                        </option>
                        <option value="project">Entire Project</option>
                    </select>
                </div>
                 <div className="flex-grow flex flex-col mb-6">
                    <label htmlFor="description" className="block text-sm font-medium text-neutral mb-2">
                        Problem Description or Refactor Goal
                    </label>
                    <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="flex-grow w-full bg-base-100 border border-base-300 rounded-md py-2 px-3 text-base-content focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                        placeholder="e.g., The increment button in the Counter component is not updating the state correctly.&#10;e.g., Refactor the data fetching logic to use async/await instead of promises."
                    />
                </div>
                <div className="flex justify-end space-x-4">
                    <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2 bg-base-300 hover:bg-opacity-80 rounded-md text-base-content font-semibold transition-colors">
                        Cancel
                    </button>
                    <button type="submit" disabled={isLoading || !description.trim()} className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-md text-white font-semibold transition-colors flex items-center justify-center disabled:bg-opacity-50 w-48">
                        {isLoading ? <Spinner size="sm" /> : 'Propose Fix'}
                    </button>
                </div>
            </form>
        )}
      </div>
    </div>
  );
};

export default DebugRefactorModal;