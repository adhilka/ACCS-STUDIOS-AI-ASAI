import React, { useState } from 'react';
import FileExplorer from './FileExplorer';
import ChatInterface from './ChatInterface';
import { CodeIcon, ChatBubbleIcon } from './icons';
import { FileNode, AiChatMessage } from '../types';
// FIX: Imported Spinner component to resolve reference error.
import Spinner from './ui/Spinner';

interface SidebarProps {
  files: FileNode[];
  // FIX: Renamed 'selectedFileId' to 'selectedFilePath' for clarity and consistency.
  selectedFilePath: string | null;
  onFileSelect: (id: string) => void;
  onFileDelete: (id:string) => void;
  onFileAdd: (parentId: string, type: 'file' | 'folder') => void;
  onFileUpload: (file: File, parentPath: string) => void;
  chatMessages: AiChatMessage[];
  // FIX: Updated 'onSendMessage' to include the 'mode' parameter to match ChatInterface's signature.
  onSendMessage: (message: string, mode: 'build' | 'ask') => void;
  isAiLoading: boolean;
  onApprovePlan: (messageId: string) => void;
  onRejectPlan: (messageId: string) => void;
  activeTab: 'files' | 'chat';
  onTabChange: (tab: 'files' | 'chat') => void;
  isGenerating: boolean;
}

type Tab = 'files' | 'chat';

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
        <button onClick={() => onTabChange('chat')} className={tabClasses('chat')}>
          <ChatBubbleIcon /> Chat
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
                />
            )
        )}
        {activeTab === 'chat' && (
          <ChatInterface 
            messages={props.chatMessages} 
            onSendMessage={props.onSendMessage}
            isLoading={props.isAiLoading}
            onApprovePlan={props.onApprovePlan}
            onRejectPlan={props.onRejectPlan}
          />
        )}
      </div>
    </div>
  );
};

export default Sidebar;