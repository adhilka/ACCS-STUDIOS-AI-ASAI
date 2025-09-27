import React, { useState } from 'react';
import FileExplorer from './FileExplorer';
import { CodeIcon, ChatBubbleIcon, SaveIcon } from './icons';
import { FileNode, AiChatMessage, User, Project, ApiConfig, ApiPoolConfig, ApiPoolKey, ChatMessageSenderInfo } from '../types';
// FIX: Imported Spinner component to resolve reference error.
import Spinner from './ui/Spinner';

interface SidebarProps {
  files: FileNode[];
  selectedFilePath: string | null;
  onFileSelect: (id: string) => void;
  onFileDelete: (id:string) => void;
  onFileAdd: (parentId: string, type: 'file' | 'folder') => void;
  onFileUpload: (file: File, parentPath: string) => void;
  activeTab: 'files' | 'snapshots';
  onTabChange: (tab: 'files' | 'snapshots') => void;
  isGenerating: boolean;
  onContextMenuRequest: (path: string, x: number, y: number) => void;
  isCollaborationEnabled: boolean;
}

type Tab = 'files' | 'snapshots';

const SnapshotsPanel: React.FC<{ isCollaborationEnabled: boolean }> = ({ isCollaborationEnabled }) => {
    // This is a placeholder for the full snapshot UI
    return (
        <div className="p-4 text-sm text-neutral h-full flex flex-col">
            <h3 className="text-sm font-semibold tracking-wider uppercase text-base-content mb-4 border-b border-base-300 pb-2">Project Snapshots</h3>
            {!isCollaborationEnabled ? (
                <div className="flex-grow flex items-center justify-center text-center">
                    <div>
                        <SaveIcon className="w-12 h-12 text-base-300 mx-auto mb-4" />
                        <h4 className="font-semibold text-base-content">Feature Disabled</h4>
                        <p className="mt-1">To enable Snapshots, the project owner must first configure a custom Firebase server in Project Settings.</p>
                    </div>
                </div>
            ) : (
                <div className="flex-grow">
                    <button className="w-full text-center py-2 bg-primary hover:opacity-90 text-white font-semibold rounded-md transition-colors text-sm">
                        Create New Snapshot
                    </button>
                    <div className="mt-4 text-center">
                        <p>Your snapshots will appear here.</p>
                         {/* Snapshot list would be rendered here */}
                    </div>
                </div>
            )}
        </div>
    );
};


const Sidebar: React.FC<SidebarProps> = (props) => {
  const { activeTab, onTabChange } = props;

  const tabClasses = (tab: Tab) => `flex-1 py-2 px-4 text-sm font-medium text-center cursor-pointer flex items-center justify-center gap-2 border-b-2 transition-colors ${
    activeTab === tab 
      ? 'border-primary text-base-content' 
      : 'border-transparent text-neutral hover:bg-base-300'
  }`;

  return (
    <div className="bg-base-200 flex flex-col h-full">
      <div className="flex border-b border-base-300">
        <button onClick={() => onTabChange('files')} className={tabClasses('files')}>
          <CodeIcon /> Files
        </button>
        <button onClick={() => onTabChange('snapshots')} className={tabClasses('snapshots')}>
          <SaveIcon /> Snapshots
        </button>
      </div>
      <div className="flex-grow overflow-hidden">
        {activeTab === 'files' && (
           props.isGenerating ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-neutral p-4">
                    <Spinner size="md" />
                    <p className="mt-4 font-semibold">AI is building your project...</p>
                    <p className="text-sm">Check the Chat tab for progress.</p>
                </div>
            ) : (
                <FileExplorer 
                    files={props.files} 
                    selectedFilePath={props.selectedFilePath} 
                    onFileSelect={props.onFileSelect}
                    onFileDelete={props.onFileDelete}
                    onFileAdd={props.onFileAdd}
                    onFileUpload={props.onFileUpload}
                    onContextMenuRequest={props.onContextMenuRequest}
                />
            )
        )}
        {activeTab === 'snapshots' && (
            <SnapshotsPanel isCollaborationEnabled={props.isCollaborationEnabled} />
        )}
      </div>
    </div>
  );
};

export default Sidebar;