import React, { useMemo, useState, useRef } from 'react';
import { FileNode } from '../types';
import { FolderIcon, FileIcon, DeleteIcon, AddFileIcon, AddFolderIcon, SearchIcon, UploadIcon } from './icons';

interface FileExplorerProps {
  files: FileNode[];
  selectedFilePath: string | null;
  onFileSelect: (path: string) => void;
  onFileDelete: (path: string) => void;
  onFileAdd: (path: string, type: 'file' | 'folder') => void;
  onFileUpload: (file: File, parentPath: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
}

const buildTree = (files: FileNode[]): TreeNode[] => {
    const tree: TreeNode[] = [];
    const nodeMap = new Map<string, TreeNode>();

    // First, create explicit nodes for all files and folders from the flat list
    files.forEach(file => {
        nodeMap.set(file.path, {
            ...file, // includes name, path, type
            children: file.type === 'folder' ? [] : undefined,
        });
    });

    // Ensure all parent directories exist implicitly
    files.forEach(file => {
        const pathParts = file.path.split('/');
        let currentPath = '';
        for (let i = 0; i < pathParts.length - 1; i++) {
            const part = pathParts[i];
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            if (!nodeMap.has(currentPath)) {
                nodeMap.set(currentPath, {
                    name: part,
                    path: currentPath,
                    type: 'folder',
                    children: [],
                });
            }
        }
    });

    // Link children to their parents
    nodeMap.forEach(node => {
        const parentPath = node.path.substring(0, node.path.lastIndexOf('/'));
        const parent = nodeMap.get(parentPath);
        if (parent && parent.children) {
            parent.children.push(node);
        } else {
            tree.push(node);
        }
    });
    
    // Recursive sort function
    const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
        nodes.forEach(node => {
            if (node.children) {
                node.children = sortNodes(node.children);
            }
        });
        return nodes
            .sort((a, b) => a.name.localeCompare(b.name))
            .sort((a, b) => (a.type === 'folder' ? -1 : 1) - (b.type === 'folder' ? -1 : 1));
    };

    return sortNodes(tree);
};


const TreeNodeComponent: React.FC<{
    node: TreeNode;
    level: number;
    selectedFilePath: string | null;
    onFileSelect: (path: string) => void;
    onFileDelete: (path: string) => void;
}> = ({ node, level, selectedFilePath, onFileSelect, onFileDelete }) => {
  const isSelected = selectedFilePath === node.path;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete ${node.name}?`)) {
        onFileDelete(node.path);
    }
  };

  return (
    <div>
      <div
        onClick={() => onFileSelect(node.path)}
        style={{ paddingLeft: `${level * 1.25}rem` }}
        className={`flex items-center justify-between pr-2 py-1.5 cursor-pointer rounded-md text-sm group ${
          isSelected ? 'bg-primary text-white' : 'hover:bg-base-300 text-base-content'
        }`}
      >
        <div className="flex items-center space-x-2 truncate">
          {node.type === 'folder' ? <FolderIcon className="w-5 h-5 text-sky-500" /> : <FileIcon className="w-5 h-5 text-neutral" />}
          <span className="truncate">{node.name}</span>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={handleDelete} className="p-1 hover:bg-red-500/20 rounded"><DeleteIcon className="w-4 h-4 text-red-500"/></button>
        </div>
      </div>
      {node.type === 'folder' && node.children && (
        <div>
          {node.children.map((child) => (
                <TreeNodeComponent
                    key={child.path} 
                    node={child} 
                    level={level + 1} 
                    selectedFilePath={selectedFilePath}
                    onFileSelect={onFileSelect}
                    onFileDelete={onFileDelete}
                />
          ))}
        </div>
      )}
    </div>
  );
};


const FileExplorer: React.FC<FileExplorerProps> = ({ files, selectedFilePath, onFileSelect, onFileDelete, onFileAdd, onFileUpload }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelectForUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const parentPath = selectedFilePath && files.find(f => f.path === selectedFilePath)?.type === 'folder' 
            ? selectedFilePath 
            : (selectedFilePath?.substring(0, selectedFilePath.lastIndexOf('/')) || '');
        onFileUpload(file, parentPath);
        // Reset file input to allow uploading the same file again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }
  };

  const filteredFiles = useMemo(() => {
    if (!searchQuery) return files;
    
    const lowercasedQuery = searchQuery.toLowerCase();
    const matchingPaths = new Set<string>();

    files.forEach(file => {
      if (file.name.toLowerCase().includes(lowercasedQuery)) {
        // Add the file itself
        matchingPaths.add(file.path);
        // Add all its parent directories
        const pathParts = file.path.split('/');
        let currentPath = '';
        for (let i = 0; i < pathParts.length - 1; i++) {
          const part = pathParts[i];
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          matchingPaths.add(currentPath);
        }
      }
    });

    return files.filter(file => matchingPaths.has(file.path));

  }, [files, searchQuery]);

  const fileTree = useMemo(() => buildTree(filteredFiles), [filteredFiles]);

  return (
    <div className="h-full bg-base-200 text-base-content flex flex-col p-2">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelectForUpload}
        className="hidden"
        accept="image/*,video/*"
      />
      <div className="flex items-center justify-between p-2 mb-2 border-b border-base-300">
        <h3 className="text-sm font-semibold tracking-wider uppercase">Project Files</h3>
        <div className="flex items-center space-x-1">
            <button onClick={() => fileInputRef.current?.click()} className="p-1 hover:bg-base-300 rounded" title="Upload File"><UploadIcon className="w-5 h-5"/></button>
            <button onClick={() => onFileAdd(selectedFilePath && files.find(f => f.path === selectedFilePath)?.type === 'folder' ? selectedFilePath : (selectedFilePath?.substring(0, selectedFilePath.lastIndexOf('/')) || ''), 'file')} className="p-1 hover:bg-base-300 rounded" title="Add File"><AddFileIcon className="w-5 h-5"/></button>
            <button onClick={() => onFileAdd(selectedFilePath && files.find(f => f.path === selectedFilePath)?.type === 'folder' ? selectedFilePath : (selectedFilePath?.substring(0, selectedFilePath.lastIndexOf('/')) || ''), 'folder')} className="p-1 hover:bg-base-300 rounded" title="Add Folder"><AddFolderIcon className="w-5 h-5"/></button>
        </div>
      </div>
      <div className="px-1 mb-2">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <SearchIcon className="h-4 w-4 text-neutral" />
          </div>
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full rounded-md border-0 bg-base-100 py-1.5 pl-9 pr-3 text-base-content placeholder:text-neutral focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm"
          />
        </div>
      </div>
      <div className="flex-grow overflow-y-auto pr-1">
        {fileTree.length > 0 ? fileTree.map((node) => (
          <TreeNodeComponent
            key={node.path}
            node={node}
            level={0}
            selectedFilePath={selectedFilePath}
            onFileSelect={onFileSelect}
            onFileDelete={onFileDelete}
          />
        )) : (
            <div className="text-center text-neutral text-sm mt-4 px-2">
                <p>{searchQuery ? 'No matching files found.' : 'No files in this project.'}</p>
                {!searchQuery && <p className="mt-2">Use the chat to ask the AI to build something!</p>}
            </div>
        )}
      </div>
    </div>
  );
};

export default FileExplorer;