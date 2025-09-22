
import React from 'react';

const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const dotClasses = "absolute w-full h-full rounded-full";

  return (
    <div className={`relative ${sizeClasses[size]}`}>
      <div className={`${dotClasses} bg-primary opacity-75 animate-pulse-1`}></div>
      <div className={`${dotClasses} bg-secondary opacity-75 animate-pulse-2`}></div>
      <div className={`${dotClasses} bg-accent opacity-75 animate-pulse-3`}></div>
      <style>{`
        @keyframes pulse-1 {
          0%, 100% { transform: scale(0.2); }
          50% { transform: scale(1.0); }
        }
        @keyframes pulse-2 {
          0%, 100% { transform: scale(0.2); }
          50% { transform: scale(1.0); }
        }
        @keyframes pulse-3 {
          0%, 100% { transform: scale(0.2); }
          50% { transform: scale(1.0); }
        }
        .animate-pulse-1 { animation: pulse-1 2s infinite ease-in-out; }
        .animate-pulse-2 { animation: pulse-2 2s infinite ease-in-out 0.33s; }
        .animate-pulse-3 { animation: pulse-3 2s infinite ease-in-out 0.66s; }
      `}</style>
    </div>
  );
};

export default Spinner;