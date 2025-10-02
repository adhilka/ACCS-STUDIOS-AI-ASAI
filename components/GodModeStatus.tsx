import React from 'react';
import { AiGodModeAction } from '../types';
import { BrainIcon, CrownIcon } from './icons';
import Spinner from './ui/Spinner';

interface GodModeStatusProps {
  currentAction: AiGodModeAction | null;
  onStop: () => void;
}

const GodModeStatus: React.FC<GodModeStatusProps> = ({ currentAction, onStop }) => {
  if (!currentAction) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-4xl z-50 px-4">
      <div className="bg-base-300/80 backdrop-blur-md border border-yellow-400/50 rounded-lg shadow-2xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="text-yellow-400">
            <CrownIcon className="w-8 h-8" />
          </div>
          <div className="flex-grow">
            <h3 className="font-bold text-base-content flex items-center gap-2">
              <Spinner size="sm" />
              AI God Mode is Active
            </h3>
            <div className="text-sm text-neutral mt-1 flex items-start gap-2">
                <BrainIcon className="w-4 h-4 mt-0.5 shrink-0" />
                <p className="italic">"{currentAction.reasoning}"</p>
            </div>
          </div>
        </div>
        <button
          onClick={onStop}
          className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-md text-white font-semibold transition-colors text-sm"
        >
          Stop AI
        </button>
      </div>
    </div>
  );
};

export default GodModeStatus;
