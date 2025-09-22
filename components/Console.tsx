import React from 'react';
import { ConsoleMessage } from '../types';
import { CommandLineIcon, InformationCircleIcon, ExclamationTriangleIcon, XCircleIcon, ChevronRightIcon, DeleteIcon } from './icons';

interface ConsoleProps {
  messages: ConsoleMessage[];
  onClear: () => void;
}

const getIconForMethod = (method: ConsoleMessage['method']) => {
  switch (method) {
    case 'error':
      return <XCircleIcon className="w-4 h-4 text-red-500 shrink-0" />;
    case 'warn':
      return <ExclamationTriangleIcon className="w-4 h-4 text-yellow-500 shrink-0" />;
    case 'info':
      return <InformationCircleIcon className="w-4 h-4 text-blue-400 shrink-0" />;
    default:
      return <ChevronRightIcon className="w-4 h-4 text-neutral shrink-0" />;
  }
};

const formatArg = (arg: any): string => {
  if (typeof arg === 'object' && arg !== null) {
    try {
      // Special handling for error objects from the sandbox
      if (arg.message && arg.name) {
         return `${arg.name}: ${arg.message}\n${arg.stack || ''}`;
      }
      return JSON.stringify(arg, null, 2);
    } catch (e) {
      return '[Unserializable Object]';
    }
  }
  return String(arg);
};

const Console: React.FC<ConsoleProps> = ({ messages, onClear }) => {
  return (
    <div className="h-full bg-base-100 flex flex-col font-mono text-sm">
      <div className="bg-base-200 text-base-content px-4 py-2 border-b border-t border-base-300 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <CommandLineIcon className="w-5 h-5 text-neutral" />
          <span>Console</span>
        </div>
        <button onClick={onClear} className="p-1 rounded-md hover:bg-base-300 transition-colors" title="Clear console">
          <DeleteIcon className="w-5 h-5 text-neutral" />
        </button>
      </div>
      <div className="flex-grow p-2 overflow-y-auto text-base-content">
        {messages.length === 0 ? (
          <div className="text-neutral italic h-full flex items-center justify-center">Console is empty. Logs from your app will appear here.</div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-2 p-1.5 border-b border-base-300/50 ${
                msg.method === 'error' ? 'bg-red-500/10 text-red-300' : msg.method === 'warn' ? 'bg-yellow-500/10 text-yellow-300' : ''
              }`}
            >
              <div className="flex items-center gap-2 pt-0.5">
                <span className="text-neutral/60">{msg.timestamp}</span>
                {getIconForMethod(msg.method)}
              </div>
              <pre className="whitespace-pre-wrap break-words flex-grow">
                <code>{msg.args.map(formatArg).join(' ')}</code>
              </pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Console;
