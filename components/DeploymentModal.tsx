import React from 'react';
import { RocketIcon } from './icons';
import Spinner from './ui/Spinner';

interface DeploymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeployCodeSandbox: () => void;
  isDeploying: boolean;
}

const DeploymentModal: React.FC<DeploymentModalProps> = ({ isOpen, onClose, onDeployCodeSandbox, isDeploying }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity duration-300">
      <div className="bg-base-200 rounded-lg shadow-2xl p-8 w-full max-w-lg m-4 border border-base-300">
        <div className="flex items-center gap-3 mb-4">
          <RocketIcon className="w-6 h-6 text-green-400" />
          <h2 className="text-2xl font-bold text-base-content">Deploy Project</h2>
        </div>
        <p className="text-sm text-neutral mb-6">
          Publish your project to a live environment. Select a provider below.
        </p>

        <div className="space-y-4">
            <button
                onClick={onDeployCodeSandbox}
                disabled={isDeploying}
                className="w-full flex items-center justify-between p-4 bg-base-300 hover:bg-primary/10 rounded-lg border border-base-100 hover:border-primary transition-colors"
            >
                <div className="flex items-center gap-4">
                    <img src="https://codesandbox.io/favicon.ico" alt="CodeSandbox Logo" className="w-8 h-8"/>
                    <div>
                        <p className="font-semibold text-base-content">CodeSandbox</p>
                        <p className="text-xs text-neutral">Opens your project in a new CodeSandbox instance.</p>
                    </div>
                </div>
                {isDeploying ? <Spinner size="sm" /> : <span>&rarr;</span>}
            </button>

            <div
                className="w-full flex items-center justify-between p-4 bg-base-300 rounded-lg border border-base-100 opacity-50 cursor-not-allowed"
            >
                <div className="flex items-center gap-4">
                    <img src="https://www.netlify.com/v3/img/components/logomark.png" alt="Netlify Logo" className="w-8 h-8"/>
                    <div>
                        <p className="font-semibold text-base-content">Netlify</p>
                        <p className="text-xs text-neutral">Deploy globally with one click.</p>
                    </div>
                </div>
                <span className="text-xs font-bold bg-secondary/20 text-secondary px-2 py-1 rounded-full">Coming Soon</span>
            </div>
        </div>

        <div className="flex justify-end mt-8">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-base-300 hover:bg-opacity-80 rounded-md text-base-content font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeploymentModal;
