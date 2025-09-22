
import React from 'react';
import { PlayIcon } from './icons';

interface SandboxPreviewProps {
  htmlContent: string;
  onRefresh: () => void;
}

const SandboxPreview: React.FC<SandboxPreviewProps> = ({ htmlContent, onRefresh }) => {
  return (
    <div className="h-full bg-base-100 flex flex-col">
      <div className="bg-base-200 text-base-content px-4 py-2 text-sm border-b border-base-300 flex justify-between items-center">
        <span>Live Preview</span>
        <button onClick={onRefresh} className="p-1 rounded-md hover:bg-base-300 transition-colors" title="Refresh Preview">
            <PlayIcon className="w-5 h-5" />
        </button>
      </div>
      <iframe
        srcDoc={htmlContent}
        title="Preview"
        sandbox="allow-scripts allow-modals allow-forms"
        className="w-full h-full border-0 bg-base-100"
      />
    </div>
  );
};

export default SandboxPreview;