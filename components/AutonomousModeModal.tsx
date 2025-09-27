import React, { useState, useEffect, useRef } from 'react';
import { RobotIcon, BrainIcon } from './icons';
import Spinner from './ui/Spinner';
import { AgentState } from '../types';

interface AutonomousModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (objective: string) => void;
  agentState: AgentState;
}

const AutonomousModeModal: React.FC<AutonomousModeModalProps> = ({ isOpen, onClose, onStart, agentState }) => {
  const [objective, setObjective] = useState('');
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentState.logs]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!objective.trim() || agentState.status === 'running') return;
    onStart(objective);
  };
  
  const isRunning = agentState.status === 'running';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity duration-300">
      <div className="bg-base-200 rounded-lg shadow-2xl p-8 w-full max-w-4xl m-4 border border-base-300 flex flex-col" style={{height: '85vh'}}>
        <div className='flex items-center gap-3 mb-4'>
            <RobotIcon className="w-8 h-8 text-secondary"/>
            <div>
                <h2 className="text-2xl font-bold text-base-content">Autonomous "Auto-Dev" Mode</h2>
                <p className="text-sm text-neutral">Give the AI a high-level objective and watch it work.</p>
            </div>
        </div>
        
        {agentState.status === 'idle' || agentState.status === 'finished' || agentState.status === 'error' ? (
             <form onSubmit={handleSubmit} className="flex flex-col flex-grow">
                 <div className="flex-grow flex flex-col mb-6">
                    <label htmlFor="objective" className="block text-sm font-medium text-neutral mb-2">
                        Your Objective
                    </label>
                    <textarea
                        id="objective"
                        value={objective}
                        onChange={(e) => setObjective(e.target.value)}
                        className="flex-grow w-full bg-base-100 border border-base-300 rounded-md py-2 px-3 text-base-content focus:outline-none focus:ring-2 focus:ring-secondary resize-none"
                        placeholder="e.g., Implement a complete dark mode toggle and save the user's preference in localStorage..."
                    />
                </div>
                {agentState.status === 'error' && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-400 text-sm">
                        <strong>Error:</strong> {agentState.lastError}
                    </div>
                )}
                <div className="flex justify-end space-x-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-base-300 hover:bg-opacity-80 rounded-md text-base-content font-semibold transition-colors">
                        {agentState.status === 'finished' ? 'Close' : 'Cancel'}
                    </button>
                    <button type="submit" disabled={!objective.trim()} className="px-6 py-2 bg-secondary hover:opacity-90 rounded-md text-white font-semibold transition-colors flex items-center justify-center disabled:bg-opacity-50 w-48">
                        Start AI Developer
                    </button>
                </div>
            </form>
        ) : (
            <div className="flex-grow flex flex-col overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-grow overflow-hidden">
                    {/* Left: Plan & Status */}
                    <div className='flex flex-col'>
                         <h3 className="text-lg font-semibold text-base-content mb-2">Agent Status</h3>
                         <div className="bg-base-100 p-4 rounded-lg border border-base-300 flex-grow flex flex-col">
                             <p className="text-sm text-neutral"><strong>Objective:</strong> {agentState.objective}</p>
                             <div className="mt-2 flex items-center gap-2">
                                 <p className="text-sm text-neutral"><strong>Status:</strong></p>
                                 <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${isRunning ? 'bg-primary/20 text-primary' : 'bg-green-500/20 text-green-400'}`}>
                                    {agentState.status}
                                 </span>
                                 {isRunning && <Spinner size="sm" />}
                             </div>
                              {agentState.thoughts && (
                                <div className="mt-3 pt-3 border-t border-base-300/50">
                                    <p className="text-xs font-semibold text-neutral flex items-center gap-1"><BrainIcon className="w-4 h-4" /> AI THOUGHTS:</p>
                                    <p className="text-xs text-neutral/90 italic mt-1">"{agentState.thoughts}"</p>
                                </div>
                            )}
                             {agentState.plan.length > 0 && (
                                 <div className="mt-4 flex-shrink overflow-y-auto">
                                     <h4 className="font-semibold text-base-content mb-2">Plan:</h4>
                                     <ul className="space-y-1.5 text-sm">
                                         {agentState.plan.map((task, index) => (
                                             <li key={index} className={`flex items-start gap-2 ${index < agentState.currentTaskIndex ? 'text-neutral/60 line-through' : (index === agentState.currentTaskIndex ? 'text-primary font-bold' : 'text-neutral')}`}>
                                                 <span className='mt-1 text-xs shrink-0'>{index < agentState.currentTaskIndex ? '✅' : (index === agentState.currentTaskIndex ? '▶️' : '⏳')}</span>
                                                 <span>{task}</span>
                                             </li>
                                         ))}
                                     </ul>
                                 </div>
                             )}
                         </div>
                    </div>
                    {/* Right: Logs */}
                    <div className='flex flex-col overflow-hidden'>
                        <h3 className="text-lg font-semibold text-base-content mb-2">Action Log</h3>
                        <div className="bg-base-300/50 text-neutral font-mono text-xs rounded-lg p-4 flex-grow overflow-y-auto border border-base-300">
                           {agentState.logs.map((log, index) => (
                               <p key={index} className="whitespace-pre-wrap animate-fade-in">&gt; {log}</p>
                           ))}
                           <div ref={logsEndRef} />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end space-x-4 mt-6">
                     <button type="button" onClick={onClose} className="px-4 py-2 bg-base-300 hover:bg-opacity-80 rounded-md text-base-content font-semibold transition-colors">
                        Close
                    </button>
                    <button type="button" disabled={!isRunning} className="px-6 py-2 bg-red-600 hover:bg-red-500 rounded-md text-white font-semibold transition-colors flex items-center justify-center disabled:bg-opacity-50 w-48">
                        Stop Agent
                    </button>
                </div>
                 <style>{`
                    @keyframes fade-in {
                        from { opacity: 0; transform: translateY(5px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    .animate-fade-in { animation: fade-in 0.3s ease-out; }
                `}</style>
            </div>
        )}
      </div>
    </div>
  );
};

export default AutonomousModeModal;
