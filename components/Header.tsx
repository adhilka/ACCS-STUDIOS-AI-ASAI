import React from 'react';
import { DownloadIcon, KeyIcon, CodeIcon, SettingsIcon, UndoIcon, RedoIcon, AnalyzeIcon, AiIcon, RobotIcon, WrenchScrewdriverIcon, ArrowLeftIcon, PlayIcon, UserIcon, ShareIcon, CommandLineIcon } from './icons';
import { User } from '../types';
import { auth } from '../services/firebase';
import { useBranding } from '../contexts/BrandingContext';

interface HeaderProps {
    user: User | null;
    project: { name: string, iconSvg?: string } | null;
    onDownload: () => void;
    onApiKeyClick: () => void;
    onSettingsClick: () => void;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    onAnalyzeClick: () => void;
    onBuildClick: () => void;
    onAutoDevClick: () => void;
    onDebugRefactorClick: () => void;
    onBackToDashboard: () => void;
    onTogglePreview: () => void;
    onToggleConsole: () => void;
    onProfileClick: () => void;
    onShareClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
    user, project, onDownload, onApiKeyClick, onSettingsClick, 
    onUndo, onRedo, canUndo, canRedo, onAnalyzeClick, onBuildClick, 
    onAutoDevClick, onDebugRefactorClick, onBackToDashboard,
    onTogglePreview, onToggleConsole, onProfileClick, onShareClick
}) => {
  const { brand } = useBranding();
  
  const handleSignOut = () => {
    auth.signOut();
  };
  
  const ProjectIcon: React.FC = () => {
    if (project?.iconSvg) {
        try {
            const svgDataUrl = `data:image/svg+xml;base64,${btoa(project.iconSvg)}`;
            return <img src={svgDataUrl} alt="Project Icon" className="w-6 h-6 object-contain"/>;
        } catch (e) {
            console.error("Error encoding SVG for data URL:", e);
            // Fallback to default icon if encoding fails
        }
    }
    if (brand?.logo) {
        return <img src={brand.logo} alt="Brand Logo" className="w-6 h-6 object-contain"/>;
    }
    return <CodeIcon className="w-6 h-6 text-base-content"/>;
  };

  return (
    <header className="bg-base-200/50 p-3 flex items-center justify-between z-30 shrink-0 border-b border-base-300 backdrop-blur-sm">
      <div className="flex items-center space-x-3">
        <button onClick={onBackToDashboard} className="p-2 rounded-md hover:bg-base-300 transition-colors" title="Back to Dashboard">
            <ArrowLeftIcon className="w-5 h-5 text-neutral" />
        </button>
        <div className="bg-primary p-2 rounded-md">
            <ProjectIcon />
        </div>
        <div>
            <h1 className="text-lg font-bold text-base-content tracking-wider hidden sm:block">ASAI</h1>
            <p className="text-sm text-neutral">{project?.name || 'Editor'}</p>
        </div>
      </div>
      <div className="flex items-center space-x-1 sm:space-x-2">
         <button onClick={onAutoDevClick} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary hover:opacity-90 text-base-content transition-colors" title="Autonomous Mode">
          <RobotIcon className="w-5 h-5" />
          <span className="text-sm font-semibold hidden sm:inline">Auto-Dev</span>
        </button>
         <button onClick={onBuildClick} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary hover:opacity-90 text-base-content transition-colors" title="Build Mode">
          <AiIcon className="w-5 h-5" />
          <span className="text-sm font-semibold hidden sm:inline">Build</span>
        </button>
        <div className="h-6 w-px bg-base-300 mx-1"></div>
        <button onClick={onUndo} disabled={!canUndo} className="p-2 rounded-md hover:bg-base-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="Undo">
          <UndoIcon className="w-5 h-5 text-neutral" />
        </button>
        <button onClick={onRedo} disabled={!canRedo} className="p-2 rounded-md hover:bg-base-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="Redo">
          <RedoIcon className="w-5 h-5 text-neutral" />
        </button>
        <div className="h-6 w-px bg-base-300 mx-1"></div>
        <button onClick={onToggleConsole} className="p-2 rounded-md hover:bg-base-300 transition-colors" title="Toggle Console Panel">
          <CommandLineIcon className="w-5 h-5 text-neutral" />
        </button>
        <button onClick={onTogglePreview} className="p-2 rounded-md hover:bg-base-300 transition-colors" title="Toggle Preview Panel">
          <PlayIcon className="w-5 h-5 text-neutral" />
        </button>
        <button onClick={onShareClick} className="p-2 rounded-md hover:bg-base-300 transition-colors" title="Share Project">
            <ShareIcon className="w-5 h-5 text-green-400" />
        </button>
        <button onClick={onAnalyzeClick} className="p-2 rounded-md hover:bg-base-300 transition-colors" title="Analyze Project">
          <AnalyzeIcon className="w-5 h-5 text-neutral" />
        </button>
        <button onClick={onDebugRefactorClick} className="p-2 rounded-md hover:bg-base-300 transition-colors" title="Debug & Refactor with AI">
          <WrenchScrewdriverIcon className="w-5 h-5 text-yellow-500" />
        </button>
        <div className="h-6 w-px bg-base-300 mx-1"></div>
        <button onClick={onSettingsClick} className="p-2 rounded-md hover:bg-base-300 transition-colors" title="Project Settings">
          <SettingsIcon className="w-5 h-5 text-neutral" />
        </button>
        <button onClick={onApiKeyClick} className="p-2 rounded-md hover:bg-base-300 transition-colors" title="API Key Settings">
          <KeyIcon className="w-5 h-5 text-neutral" />
        </button>
        <button onClick={onDownload} className="p-2 rounded-md hover:bg-base-300 transition-colors" title="Download Project as ZIP">
          <DownloadIcon className="w-5 h-5 text-neutral" />
        </button>
        {user && (
           <div className="flex items-center space-x-2 pl-2">
               <button onClick={onProfileClick} className="flex items-center gap-2 p-1 rounded-full hover:bg-base-300" title="Profile Settings">
                  <span className="text-sm text-neutral hidden sm:inline">{user.displayName || user.email}</span>
                   {user.photoURL ? (
                       <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full object-cover"/>
                   ) : (
                       <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center">
                           <UserIcon className="w-5 h-5 text-neutral"/>
                       </div>
                   )}
               </button>
           </div>
        )}
      </div>
    </header>
  );
};

export default Header;