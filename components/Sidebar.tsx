import React, { useState } from 'react';
import FileExplorer from './FileExplorer';
import { CodeIcon, ChatBubbleIcon, SaveIcon, TrashIcon, ChecklistIcon } from './icons';
import { FileNode, AiChatMessage, User, Project, ApiConfig, ApiPoolConfig, ApiPoolKey, ChatMessageSenderInfo, Snapshot } from '../types';
import Spinner from './ui/Spinner';
import ChatInterface from './ChatInterface';
import TodoListPanel from './TodoListPanel';

interface SidebarProps {
  files: FileNode[];
  selectedFilePath: string | null;
  onFileSelect: (id: string) => void;
  onFileDelete: (id:string) => void;
  onFileAdd: (parentId: string, type: 'file' | 'folder') => void;
  onFileUpload: (file: File, parentPath: string) => void;
  activeTab: 'files' | 'chat' | 'snapshots' | 'todo';
  onTabChange: (tab: 'files' | 'chat' | 'snapshots' | 'todo') => void;
  onContextMenuRequest: (path: string, x: number, y: number) => void;
  isCollaborationEnabled: boolean;
  projectId: string;
  
  // Chat Props
  messages: AiChatMessage[];
  onSendMessage: (message: string, mode: 'build' | 'ask' | 'general') => void;
  isLoading: boolean;
  onApprovePlan: (messageId: string) => void;
  onRejectPlan: (messageId: string) => void;
  projectMembers: ChatMessageSenderInfo[];
  currentUser: User;
  isOwner: boolean;
  project: Project | null;
  apiConfig: ApiConfig;
  apiPoolConfig: ApiPoolConfig;
  apiPoolKeys: ApiPoolKey[];
  currentUserId: string;
  onSendRichMessage: (messageData: Partial<Omit<AiChatMessage, 'id' | 'timestamp' | 'sender'>>) => void;
  onDeleteMessage: (messageId: string) => void;
  onOpenFileFromPin: (filePath: string) => void;
  onUpdateTaskStatus: (messageId: string, isComplete: boolean) => void;
  chatMessageRefs: React.MutableRefObject<Map<string, HTMLDivElement | null>>;
  onJumpToMessage: (messageId: string) => void;

  // Snapshot Props
  snapshots: Snapshot[];
  onCreateSnapshot: () => void;
  onDeleteSnapshot: (snapshotId: string) => void;
}

type Tab = 'files' | 'chat' | 'snapshots' | 'todo';

const SnapshotsPanel: React.FC<{
  isCollaborationEnabled: boolean;
  snapshots: Snapshot[];
  onCreateSnapshot: () => void;
  onDeleteSnapshot: (snapshotId: string) => void;
  isOwner: boolean;
}> = ({ isCollaborationEnabled, snapshots, onCreateSnapshot, onDeleteSnapshot, isOwner }) => {
    return (
        <div className="p-2 text-sm text-neutral h-full flex flex-col">
            <h3 className="text-sm font-semibold tracking-wider uppercase text-base-content mb-2 p-2 border-b border-base-300">Project Snapshots</h3>
            {!isCollaborationEnabled ? (
                <div className="flex-grow flex items-center justify-center text-center p-4">
                    <div>
                        <SaveIcon className="w-12 h-12 text-base-300 mx-auto mb-4" />
                        <h4 className="font-semibold text-base-content">Feature Disabled</h4>
                        <p className="mt-1">To enable Snapshots, the project owner must first configure a custom Firebase server in Project Settings.</p>
                    </div>
                </div>
            ) : (
                <div className="flex-grow flex flex-col">
                    {isOwner && (
                        <div className="px-2 pb-2 mb-2 border-b border-base-300">
                             <button data-testid="godmode-create-snapshot-button" onClick={onCreateSnapshot} className="w-full text-center py-2 bg-primary hover:opacity-90 text-white font-semibold rounded-md transition-colors text-sm">
                                Create New Snapshot
                            </button>
                        </div>
                    )}
                    {snapshots.length === 0 ? (
                        <div className="flex-grow flex items-center justify-center text-center text-neutral p-4">
                            No snapshots created yet.
                        </div>
                    ) : (
                        <div className="flex-grow overflow-y-auto pr-1">
                            {snapshots.map(snap => (
                                <div key={snap.id} className="p-2 rounded-md hover:bg-base-300/50 group">
                                    <div className="flex justify-between items-start">
                                        <p className="text-xs text-base-content font-semibold flex-grow pr-2">{snap.triggeringPrompt}</p>
                                        {isOwner && (
                                            <button 
                                                onClick={() => onDeleteSnapshot(snap.id)}
                                                className="p-1 rounded-full hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Delete snapshot"
                                            >
                                                <TrashIcon className="w-4 h-4 text-red-400" />
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-xs text-neutral/80 mt-1">
                                        {snap.createdAt?.toDate().toLocaleString()}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};


const Sidebar: React.FC<SidebarProps> = (props) => {
  const { activeTab, onTabChange, isCollaborationEnabled, snapshots, onCreateSnapshot, onDeleteSnapshot, isOwner, projectId } = props;

  const tabClasses = (tab: Tab, disabled: boolean = false) => `flex-1 py-2 px-4 text-sm font-medium text-center cursor-pointer flex items-center justify-center gap-2 border-b-2 transition-colors ${
    disabled
      ? 'border-transparent text-neutral/50 cursor-not-allowed'
      : activeTab === tab 
        ? 'border-primary text-base-content' 
        : 'border-transparent text-neutral hover:bg-base-300'
  }`;

  return (
    <div className="bg-base-200 flex flex-col h-full">
      <div className="flex border-b border-base-300">
        <button data-testid="godmode-sidebar-files-tab" onClick={() => onTabChange('files')} className={tabClasses('files')}>
          <CodeIcon /> Files
        </button>
        <button data-testid="godmode-sidebar-chat-tab" onClick={() => onTabChange('chat')} className={tabClasses('chat')}>
          <ChatBubbleIcon /> {isCollaborationEnabled ? "Team Chat" : "AI Chat"}
        </button>
         <button data-testid="godmode-sidebar-todo-tab" onClick={() => onTabChange('todo')} className={tabClasses('todo')}>
          <ChecklistIcon /> To-Do
        </button>
        <button
          data-testid="godmode-sidebar-snapshots-tab"
          onClick={() => onTabChange('snapshots')}
          disabled={!isCollaborationEnabled}
          className={tabClasses('snapshots', !isCollaborationEnabled)}
          title={!isCollaborationEnabled ? "Enable Collaboration in Project Settings to use Snapshots" : "Project Snapshots"}
        >
          <SaveIcon /> Snapshots
        </button>
      </div>
      <div className="flex-grow overflow-hidden">
        {activeTab === 'files' && (
            <FileExplorer 
                files={props.files} 
                selectedFilePath={props.selectedFilePath} 
                onFileSelect={props.onFileSelect}
                onFileDelete={props.onFileDelete}
                onFileAdd={props.onFileAdd}
                onFileUpload={props.onFileUpload}
                onContextMenuRequest={props.onContextMenuRequest}
                projectId={projectId}
            />
        )}
        {activeTab === 'chat' && (
             <ChatInterface 
                messages={props.messages}
                onSendMessage={props.onSendMessage}
                isLoading={props.isLoading}
                onApprovePlan={props.onApprovePlan}
                onRejectPlan={props.onRejectPlan}
                projectMembers={props.projectMembers}
                currentUser={props.currentUser}
                isOwner={props.isOwner}
                files={props.files}
                project={props.project}
                apiConfig={props.apiConfig}
                apiPoolConfig={props.apiPoolConfig}
                apiPoolKeys={props.apiPoolKeys}
                currentUserId={props.currentUserId}
                onSendRichMessage={props.onSendRichMessage}
                onDeleteMessage={props.onDeleteMessage}
                onOpenFileFromPin={props.onOpenFileFromPin}
                onUpdateTaskStatus={props.onUpdateTaskStatus}
                chatMessageRefs={props.chatMessageRefs}
            />
        )}
         {activeTab === 'todo' && (
             <TodoListPanel
                messages={props.messages}
                onUpdateTaskStatus={props.onUpdateTaskStatus}
                onJumpToMessage={props.onJumpToMessage}
            />
        )}
        {activeTab === 'snapshots' && (
             <SnapshotsPanel 
                isCollaborationEnabled={isCollaborationEnabled}
                snapshots={snapshots}
                onCreateSnapshot={onCreateSnapshot}
                onDeleteSnapshot={onDeleteSnapshot}
                isOwner={isOwner}
            />
        )}
      </div>
    </div>
  );
};

export default Sidebar;