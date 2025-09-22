import React, { useState, useEffect, useRef } from 'react';
import { SaveIcon } from './icons';
import Spinner from './ui/Spinner';

interface CodeEditorProps {
    filePath: string;
    content: string;
    onChange: (newContent: string) => void;
    onSave: (filePath: string) => void;
    isDirty: boolean;
    isSavingFile: boolean;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ filePath, content, onChange, onSave, isDirty, isSavingFile }) => {
  const lineCounterRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const lines = content.split('\n');
  const lineCount = lines.length;

  const handleScroll = () => {
    if (lineCounterRef.current && textAreaRef.current) {
        lineCounterRef.current.scrollTop = textAreaRef.current.scrollTop;
    }
  };

  return (
    <div className="h-full bg-base-100 flex flex-col font-mono">
      <div className="bg-base-200 text-base-content px-4 py-2 text-sm border-b border-base-300 flex justify-between items-center shrink-0">
        <span className="text-accent">{filePath}</span>
        <div className='flex items-center gap-4'>
            <span className={`text-xs text-yellow-400 transition-opacity duration-300 ${isSavingFile ? 'opacity-100' : 'opacity-0'}`}>
                Saving...
            </span>
             <button
                onClick={() => onSave(filePath)}
                disabled={!isDirty || isSavingFile}
                className="flex items-center gap-1.5 text-sm text-base-content disabled:text-neutral hover:text-white transition-colors"
             >
                <SaveIcon className="w-4 h-4" />
                <span>Save</span>
            </button>
        </div>
      </div>
      <div className="flex-grow flex overflow-hidden">
        <div 
          ref={lineCounterRef} 
          className="w-14 text-right pr-4 text-neutral text-sm pt-4 bg-base-100 select-none overflow-y-hidden shrink-0 leading-6"
        >
            {Array.from({ length: lineCount }, (_, i) => i + 1).map(num => (
                <div key={num}>{num}</div>
            ))}
        </div>
        <textarea
            ref={textAreaRef}
            onScroll={handleScroll}
            key={filePath} // force re-render on file change
            value={content}
            onChange={(e) => onChange(e.target.value)}
            className="flex-grow w-full p-4 bg-base-100 text-base-content text-sm resize-none focus:outline-none leading-6 tracking-wide"
            spellCheck="false"
        />
      </div>
    </div>
  );
};

export default CodeEditor;