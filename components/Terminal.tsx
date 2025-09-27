import React, { useState, useEffect, useRef } from 'react';
import { TerminalOutput } from '../types';
import { CommandLineIcon, ChevronRightIcon } from './icons';

interface TerminalProps {
  output: TerminalOutput[];
  onCommand: (command: string) => void;
  isReady: boolean;
}

const Terminal: React.FC<TerminalProps> = ({ output, onCommand, isReady }) => {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const outputEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && isReady) {
      onCommand(input.trim());
      setHistory(prev => [input.trim(), ...prev].slice(0, 50));
      setHistoryIndex(-1);
      setInput('');
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setInput(history[newIndex]);
        }
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setInput(history[newIndex]);
        } else if (historyIndex === 0) {
            setHistoryIndex(-1);
            setInput('');
        }
    }
  };

  return (
    <div className="h-full bg-black flex flex-col font-mono text-sm text-green-400 p-2" onClick={() => inputRef.current?.focus()}>
      <div className="flex-grow overflow-y-auto pr-2">
        {output.map((line) => (
            <pre key={line.id} className="whitespace-pre-wrap break-words">{line.data}</pre>
        ))}
        <div ref={outputEndRef} />
      </div>
      <form onSubmit={handleCommand} className="flex items-center gap-2 shrink-0 pt-2">
        <span className="text-blue-400">~/project $</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent focus:outline-none text-green-400"
          placeholder={isReady ? 'Enter a command...' : 'Terminal is starting...'}
          disabled={!isReady}
          autoComplete="off"
          spellCheck="false"
        />
      </form>
    </div>
  );
};

export default Terminal;
