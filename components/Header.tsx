import React, { useState, useRef, useEffect } from 'react';
import { DownloadIcon, KeyIcon, CodeIcon, SettingsIcon, UndoIcon, RedoIcon, AnalyzeIcon, AiIcon, RobotIcon, WrenchScrewdriverIcon, ArrowLeftIcon, PlayIcon, UserIcon, ShareIcon, CommandLineIcon, RocketIcon, ExternalLinkIcon, PaintBrushIcon, CrownIcon } from './icons';
import { User } from '../types';
import { auth } from '../services/firebase';
import { useBranding } from '../contexts/BrandingContext';
import { AiTypingIndicator } from './ui/Spinner';

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
    onGodModeClick: () => void;
    onDebugRefactorClick: () => void;
    onBackToDashboard: () => void;
    onTogglePreview: () => void;
    onToggleFullScreenPreview: () => void;
    onToggleBottomPanel: () => void;
    onProfileClick: () => void;
    onShareClick: () => void;
    onDeployClick: () => void;
    onDesignClick: () => void;
    isAiLoading: boolean;
    isMobile: boolean;
}

const Header: React.FC<HeaderProps> = ({ 
    user, project, onDownload, onApiKeyClick, onSettingsClick, 
    onUndo, onRedo, canUndo, canRedo, onAnalyzeClick, onBuildClick, 
    onAutoDevClick, onGodModeClick, onDebugRefactorClick, onBackToDashboard,
    onTogglePreview, onToggleFullScreenPreview, onToggleBottomPanel, 
    onProfileClick, onShareClick, onDeployClick, onDesignClick,
    isAiLoading,
    isMobile
}) => {
  const { brand } = useBranding();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const ProjectIcon: React.FC = () => {
    if (project?.iconSvg) {
        try {
            const svgDataUrl = `data:image/svg+xml;base64,${btoa(project.iconSvg)}`;
            return <img src={svgDataUrl} alt="Project Icon" className="w-6 h-6 object-contain"/>;
        } catch (e) {
            console.error("Error encoding SVG for data URL:", e);
        }
    }
    if (brand?.logo) {
        return <img src={brand.logo} alt="Brand Logo" className="w-6 h-6 object-contain"/>;
    }
    return <CodeIcon className="w-6 h-6 text-base-content"/>;
  };

  const DesktopHeader = () => (
     <div className="flex items-center space-x-1 sm:space-x-2">
       <button onClick={onGodModeClick} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-yellow-600 hover:bg-yellow-500 text-white transition-colors" title="God Mode">
        <CrownIcon className="w-5 h-5" />
        <span className="text-sm font-semibold hidden sm:inline">God Mode</span>
      </button>
       <button onClick={onAutoDevClick} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary hover:opacity-90 text-white transition-colors" title="Autonomous Mode">
        <RobotIcon className="w-5 h-5" />
        <span className="text-sm font-semibold hidden sm:inline">Auto-Dev</span>
      </button>
       <button onClick={onBuildClick} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary hover:opacity-90 text-white transition-colors" title="Build Mode">
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
      <button onClick={onToggleBottomPanel} className="p-2 rounded-md hover:bg-base-300 transition-colors" title="Toggle Console/Terminal Panel">
        <CommandLineIcon className="w-5 h-5 text-neutral" />
      </button>
      <button onClick={onTogglePreview} className="p-2 rounded-md hover:bg-base-300 transition-colors" title="Toggle Preview Panel">
        <PlayIcon className="w-5 h-5 text-neutral" />
      </button>
      <button onClick={onToggleFullScreenPreview} className="p-2 rounded-md hover:bg-base-300 transition-colors" title="Full Screen Preview">
        <ExternalLinkIcon className="w-5 h-5 text-neutral" />
      </button>
      <button onClick={onDeployClick} className="p-2 rounded-md hover:bg-base-300 transition-colors" title="Deploy Project">
          <RocketIcon className="w-5 h-5 text-green-400" />
      </button>
      <button onClick={onShareClick} className="p-2 rounded-md hover:bg-base-300 transition-colors" title="Share Project">
          <ShareIcon className="w-5 h-5 text-neutral" />
      </button>
       <button onClick={onDesignClick} className="p-2 rounded-md hover:bg-base-300 transition-colors" title="AI Design Studio">
        <PaintBrushIcon className="w-5 h-5 text-accent" />
      </button>
      <button onClick={onAnalyzeClick} className="p-2 rounded-md hover:bg-base-300 transition-colors" title="Analyze Project">
        <AnalyzeIcon className="w-5 h-5 text-neutral" />
      </button>
      <button onClick={onDebugRefactorClick} className="p-2 rounded-md hover:bg-base-300 transition-colors" title="Debug & Refactor with AI">
        <WrenchScrewdriverIcon className="w-5 h-5 text-yellow-500" />
      </button>
      <div className="h-6 w-px bg-base-300 mx-1"></div>
      <button data-testid="godmode-open-settings-modal" onClick={onSettingsClick} className="p-2 rounded-md hover:bg-base-300 transition-colors" title="Project Settings">
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
  );

  const MobileMenu = () => {
    const MenuItem: React.FC<{ icon: React.ReactNode, text: string, onClick: () => void }> = ({ icon, text, onClick }) => (
      <button onClick={() => { onClick(); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2 text-base-content hover:bg-base-300 text-sm">
        {icon}
        <span>{text}</span>
      </button>
    );

    return (
      <div ref={menuRef} className="absolute top-full right-2 mt-2 w-64 bg-base-200 border border-base-300 rounded-lg shadow-xl z-50 py-2">
        <MenuItem icon={<CrownIcon className="w-5 h-5 text-yellow-500" />} text="God Mode" onClick={onGodModeClick} />
        <MenuItem icon={<RobotIcon className="w-5 h-5 text-secondary" />} text="Autonomous Mode" onClick={onAutoDevClick} />
        <MenuItem icon={<AiIcon className="w-5 h-5 text-primary" />} text="Build Mode" onClick={onBuildClick} />
        <div className="h-px bg-base-300 my-1 mx-2"></div>
        <MenuItem icon={<PaintBrushIcon className="w-5 h-5 text-accent" />} text="AI Design Studio" onClick={onDesignClick} />
        <MenuItem icon={<PlayIcon className="w-5 h-5 text-neutral" />} text="Full Screen Preview" onClick={onToggleFullScreenPreview} />
        <MenuItem icon={<CommandLineIcon className="w-5 h-5 text-neutral" />} text="Toggle Console" onClick={onToggleBottomPanel} />
        <div className="h-px bg-base-300 my-1 mx-2"></div>
        <MenuItem icon={<AnalyzeIcon className="w-5 h-5 text-neutral" />} text="Analyze Project" onClick={onAnalyzeClick} />
        <MenuItem icon={<WrenchScrewdriverIcon className="w-5 h-5 text-yellow-500" />} text="Debug & Refactor" onClick={onDebugRefactorClick} />
        <div className="h-px bg-base-300 my-1 mx-2"></div>
        <MenuItem icon={<RocketIcon className="w-5 h-5 text-green-400" />} text="Deploy Project" onClick={onDeployClick} />
        <MenuItem icon={<ShareIcon className="w-5 h-5 text-neutral" />} text="Share Project" onClick={onShareClick} />
        <MenuItem icon={<DownloadIcon className="w-5 h-5 text-neutral" />} text="Download Project" onClick={onDownload} />
        <div className="h-px bg-base-300 my-1 mx-2"></div>
        <MenuItem icon={<SettingsIcon className="w-5 h-5 text-neutral" />} text="Project Settings" onClick={onSettingsClick} />
        <MenuItem icon={<KeyIcon className="w-5 h-5 text-neutral" />} text="API Key Settings" onClick={onApiKeyClick} />
        <MenuItem icon={<UserIcon className="w-5 h-5 text-neutral" />} text="Profile" onClick={onProfileClick} />
      </div>
    );
  };
  
  return (
    <header className="bg-base-200 p-3 flex items-center justify-between z-30 shrink-0 border-b border-base-300 relative">
      <div className="flex items-center space-x-2">
        <button onClick={onBackToDashboard} className="p-2 rounded-md hover:bg-base-300 transition-colors" title="Back to Dashboard">
          <ArrowLeftIcon className="w-5 h-5 text-neutral" />
        </button>
        <div className="bg-primary/20 p-2 rounded-md border border-primary/30">
            <ProjectIcon />
        </div>
        <div>
            <h1 className="text-lg font-bold text-base-content tracking-wider hidden sm:block">ASAI</h1>
            <p className="text-sm text-neutral truncate max-w-[150px] sm:max-w-none">{project?.name || 'Editor'}</p>
        </div>
      </div>
      
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        {isAiLoading && <AiTypingIndicator />}
      </div>
      
      {isMobile ? (
        <div className="relative">
          <button onClick={() => setIsMenuOpen(prev => !prev)} className="p-2 rounded-md hover:bg-base-300 transition-colors" title="Menu">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
          {isMenuOpen && <MobileMenu />}
        </div>
      ) : (
        <DesktopHeader />
      )}
    </header>
  );
};

export default Header;