import React from 'react';
import { InformationCircleIcon, CheckCircleIcon, XCircleIcon } from '../icons';

interface AlertModalProps {
  isOpen: boolean;
  message: string;
  type: 'info' | 'success' | 'error';
  onClose: () => void;
}

const alertConfig = {
  info: {
    icon: <InformationCircleIcon className="w-12 h-12 text-blue-400" />,
    title: 'Information',
    buttonClass: 'bg-blue-500 hover:bg-blue-600',
  },
  success: {
    icon: <CheckCircleIcon className="w-12 h-12 text-green-400" />,
    title: 'Success',
    buttonClass: 'bg-green-500 hover:bg-green-600',
  },
  error: {
    icon: <XCircleIcon className="w-12 h-12 text-red-400" />,
    title: 'Error',
    buttonClass: 'bg-red-500 hover:bg-red-600',
  },
};

const AlertModal: React.FC<AlertModalProps> = ({ isOpen, message, type, onClose }) => {
  if (!isOpen) return null;

  const config = alertConfig[type];

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] transition-opacity duration-300"
      aria-labelledby="alert-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-base-200 rounded-lg shadow-2xl p-6 sm:p-8 w-full max-w-sm m-4 border border-base-300 text-center transform transition-all animate-fade-in-up">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-base-300">
          {config.icon}
        </div>
        <h3 id="alert-title" className="text-xl font-bold mt-4 text-base-content">
          {config.title}
        </h3>
        <p className="text-sm text-neutral mt-2 mb-6 break-words">
          {message}
        </p>
        <button
          onClick={onClose}
          className={`w-full px-4 py-2 rounded-md text-white font-semibold transition-colors ${config.buttonClass}`}
        >
          OK
        </button>
      </div>
       <style>{`
            @keyframes fade-in-up {
                from { opacity: 0; transform: translateY(20px) scale(0.95); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            .animate-fade-in-up {
                animation: fade-in-up 0.3s ease-out forwards;
            }
        `}</style>
    </div>
  );
};

export default AlertModal;
