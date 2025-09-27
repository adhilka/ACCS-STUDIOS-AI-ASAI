import React from 'react';
import { CodeIcon, ChatBubbleIcon, PlayIcon, FolderIcon } from './icons';

type MobileView = 'files' | 'chat' | 'editor' | 'preview';

interface MobileNavBarProps {
  activeView: MobileView;
  onViewChange: (view: MobileView) => void;
  isEditorDisabled: boolean;
}

const NavItem: React.FC<{
  view: MobileView;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}> = ({ view, label, icon, isActive, onClick, disabled }) => {
  const activeClasses = 'text-primary';
  const inactiveClasses = 'text-neutral';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
        isActive ? activeClasses : inactiveClasses
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:text-base-content'}`}
    >
      <div className="w-6 h-6">{icon}</div>
      <span className="text-xs mt-0.5">{label}</span>
    </button>
  );
};

const MobileNavBar: React.FC<MobileNavBarProps> = ({ activeView, onViewChange, isEditorDisabled }) => {
  return (
    <div className="bg-base-200 border-t border-base-300 flex justify-around items-center h-16 shrink-0">
      <NavItem
        view="files"
        label="Files"
        icon={<FolderIcon />}
        isActive={activeView === 'files'}
        onClick={() => onViewChange('files')}
      />
      <NavItem
        view="chat"
        label="Chat"
        icon={<ChatBubbleIcon />}
        isActive={activeView === 'chat'}
        onClick={() => onViewChange('chat')}
      />
      <NavItem
        view="editor"
        label="Editor"
        icon={<CodeIcon />}
        isActive={activeView === 'editor'}
        onClick={() => onViewChange('editor')}
        disabled={isEditorDisabled}
      />
      <NavItem
        view="preview"
        label="Preview"
        icon={<PlayIcon />}
        isActive={activeView === 'preview'}
        onClick={() => onViewChange('preview')}
      />
    </div>
  );
};

export default MobileNavBar;
