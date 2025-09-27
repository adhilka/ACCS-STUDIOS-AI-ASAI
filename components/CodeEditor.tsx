import React, { useRef, useEffect } from 'react';
import { SaveIcon, ArrowLeftIcon } from './icons';

interface CodeEditorProps {
    filePath: string;
    content: string;
    onChange: (newContent: string) => void;
    onSave: (filePath: string) => void;
    isDirty: boolean;
    isSavingFile: boolean;
    isMobile?: boolean;
    onBack?: () => void;
}

// Basic syntax highlighting function
const highlightSyntax = (code: string): string => {
    if (!code) return '';
    return code
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') // HTML escape
        .replace(/\b(import|from|export|default|const|let|var|return|function|async|await|if|else|new|class|extends|=>|of|in)\b/g, '<span class="text-purple-400">$1</span>') // Keywords
        .replace(/(\/\*[\s\S]*?\*\/)|(\/\/.*)/g, '<span class="text-green-500/70 italic">$1</span>') // Comments
        .replace(/(['"`])(.*?)\1/g, '<span class="text-green-400">$1$2$1</span>'); // Strings
};


const CodeEditor: React.FC<CodeEditorProps> = ({ filePath, content, onChange, onSave, isDirty, isSavingFile, isMobile, onBack }) => {
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const preRef = useRef<HTMLElement>(null);
    const lineNumbersRef = useRef<HTMLDivElement>(null);

    const syncScroll = () => {
        if (textAreaRef.current && preRef.current && lineNumbersRef.current) {
            preRef.current.scrollTop = textAreaRef.current.scrollTop;
            preRef.current.scrollLeft = textAreaRef.current.scrollLeft;
            lineNumbersRef.current.scrollTop = textAreaRef.current.scrollTop;
        }
    };

    useEffect(syncScroll, [content]);

    const lineCount = content.split('\n').length;

    if (isMobile) {
        return (
            <div className="h-full bg-base-100 flex flex-col font-mono text-sm">
                <div className="bg-base-200 text-base-content px-4 py-2 border-b border-base-300 flex justify-between items-center shrink-0">
                    <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-neutral hover:text-base-content">
                        <ArrowLeftIcon className="w-4 h-4" />
                        <span>Back</span>
                    </button>
                    <span className="text-accent text-sm truncate">{filePath}</span>
                    <button
                        onClick={() => onSave(filePath)}
                        disabled={!isDirty || isSavingFile}
                        className="flex items-center gap-1.5 text-sm text-base-content disabled:text-neutral hover:text-white transition-colors"
                    >
                        {isSavingFile ? '...' : <SaveIcon className="w-4 h-4" />}
                        <span>Save</span>
                    </button>
                </div>
                <div className="flex-grow relative">
                    <textarea
                        value={content}
                        onChange={(e) => onChange(e.target.value)}
                        spellCheck="false"
                        autoCapitalize="off"
                        autoComplete="off"
                        autoCorrect="off"
                        className="absolute inset-0 w-full h-full p-2 bg-base-100 text-base-content resize-none leading-6 tracking-wide focus:outline-none"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="h-full bg-base-100 flex flex-col font-mono text-sm">
            <div className="bg-base-200 text-base-content px-4 py-2 border-b border-base-300 flex justify-between items-center shrink-0">
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
            <div className="flex-grow flex relative overflow-hidden">
                <div ref={lineNumbersRef} className="w-12 text-right pr-4 text-neutral pt-4 bg-base-100 select-none overflow-y-hidden shrink-0">
                    {Array.from({ length: lineCount }, (_, i) => (
                        <div key={i} className="leading-6 h-6">{i + 1}</div>
                    ))}
                </div>
                <div className="flex-grow h-full relative">
                    <textarea
                        ref={textAreaRef}
                        value={content}
                        onChange={(e) => onChange(e.target.value)}
                        onScroll={syncScroll}
                        spellCheck="false"
                        autoCapitalize="off"
                        autoComplete="off"
                        autoCorrect="off"
                        className="absolute inset-0 w-full h-full p-4 bg-transparent text-transparent caret-white resize-none z-10 leading-6 tracking-wide focus:outline-none"
                    />
                    <pre
                        ref={preRef as any}
                        aria-hidden="true"
                        className="absolute inset-0 w-full h-full p-4 pointer-events-none overflow-auto"
                    >
                        <code dangerouslySetInnerHTML={{ __html: highlightSyntax(content) + '\n' }} className="leading-6 tracking-wide" />
                    </pre>
                </div>
            </div>
        </div>
    );
};

export default CodeEditor;