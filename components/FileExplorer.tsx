import React, { useMemo, useState, useRef, useEffect } from 'react';
import { FileNode } from '../types';
import { 
    FolderIcon, FileIcon, DeleteIcon, AddFileIcon, AddFolderIcon, SearchIcon, UploadIcon,
    ChevronRightIcon, ChevronDownIcon, ReactIcon, HtmlIcon, CssIcon, JsIcon, TsIcon, JsonIcon, SvgIcon, MarkdownIcon 
} from './icons';

interface FileExplorerProps {
  files: FileNode[];
  selectedFilePath: string | null;
  onFileSelect: (path: string) => void;
  onFileDelete: (path: string) => void;
  onFileAdd: (path: string, type: 'file' | 'folder') => void;
  onFileUpload: (file: File, parentPath: string) => void;
  onContextMenuRequest: (path: string, x: number, y: number) => void;
  projectId: string;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
}

const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'tsx':
        case 'jsx':
            return <ReactIcon className="w-5 h-5 text-cyan-400 shrink-0" />;
        case 'js':
            return <JsIcon className="w-5 h-5 text-yellow-400 shrink-0" />;
        case 'ts':
            return <TsIcon className="w-5 h-5 text-blue-400 shrink-0" />;
        case 'css':
            return <CssIcon className="w-5 h-5 text-sky-500 shrink-0" />;
        case 'html':
            return <HtmlIcon className="w-5 h-5 text-orange-500 shrink-0" />;
        case 'json':
            return <JsonIcon className="w-5 h-5 text-green-400 shrink-0" />;
        case 'svg':
            return <SvgIcon className="w-5 h-5 text-pink-400 shrink-0" />;
        case 'md':
            return <MarkdownIcon className="w-5 h-5 text-gray-400 shrink-0" />;
        default:
            return <FileIcon className="w-5 h-5 text-neutral shrink-0" />;
    }
};

const buildTree = (files: FileNode[]): TreeNode[] => {
    const tree: TreeNode[] = [];
    const nodeMap = new Map<string, TreeNode>();

    files.forEach(file => {
        nodeMap.set(file.path, {
            ...file,
            children: file.type === 'folder' ? [] : undefined,
        });
    });

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

    nodeMap.forEach(node => {
        const parentPath = node.path.substring(0, node.path.lastIndexOf('/'));
        const parent = nodeMap.get(parentPath);
        if (parent && parent.children) {
            parent.children.push(node);
        } else {
            tree.push(node);
        }
    });
    
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
    onContextMenuRequest: (path: string, x: number, y: number) => void;
    expandedFolders: Set<string>;
    onFolderToggle: (path: string) => void;
}> = ({ node, level, selectedFilePath, onFileSelect, onContextMenuRequest, expandedFolders, onFolderToggle }) => {
  const isSelected = selectedFilePath === node.path;
  const isExpanded = expandedFolders.has(node.path);

  const handleNodeClick = () => {
    if (node.type === 'folder') {
        onFolderToggle(node.path);
    }
    onFileSelect(node.path);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenuRequest(node.path, e.clientX, e.clientY);
  };

  return (
    <div>
      <div
        onClick={handleNodeClick}
        onContextMenu={handleContextMenu}
        style={{ paddingLeft: `${level * 1.25}rem` }}
        className={`flex items-center justify-between pr-2 py-1.5 cursor-pointer rounded-md text-sm group ${
          isSelected ? 'bg-primary text-white' : 'hover:bg-base-300 text-base-content'
        }`}
      >
        <div className="flex items-center space-x-2 truncate">
          {node.type === 'folder' ? (
              <>
                  {isExpanded ? <ChevronDownIcon className="w-4 h-4 shrink-0" /> : <ChevronRightIcon className="w-4 h-4 shrink-0" />}
                  <FolderIcon className="w-5 h-5 text-sky-500 shrink-0" />
              </>
          ) : getFileIcon(node.name)}
          <span className="truncate">{node.name}</span>
        </div>
      </div>
      {node.type === 'folder' && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
                <TreeNodeComponent
                    key={child.path} 
                    node={child} 
                    level={level + 1} 
                    selectedFilePath={selectedFilePath}
                    onFileSelect={onFileSelect}
                    onContextMenuRequest={onContextMenuRequest}
                    expandedFolders={expandedFolders}
                    onFolderToggle={onFolderToggle}
                />
          ))}
        </div>
      )}
    </div>
  );
};


const FileExplorer: React.FC<FileExplorerProps> = ({ files, selectedFilePath, onFileSelect, onFileDelete, onFileAdd, onFileUpload, onContextMenuRequest, projectId }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const LOCAL_STORAGE_KEY = `asai_expanded_folders_${projectId}`;

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
            return new Set(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to parse expanded folders from localStorage", e);
    }
    // Default for new projects or on error
    return new Set(['src']);
  });
  
  useEffect(() => {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(Array.from(expandedFolders)));
      } catch (e) {
        console.error("Failed to save expanded folders to localStorage", e);
      }
  }, [expandedFolders, LOCAL_STORAGE_KEY]);


  const handleFolderToggle = (path: string) => {
    setExpandedFolders(prev => {
        const newSet = new Set(prev);
        if (newSet.has(path)) {
            newSet.delete(path);
        } else {
            newSet.add(path);
        }
        return newSet;
    });
  };

  const handleFileSelectForUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const parentPath = selectedFilePath && files.find(f => f.path === selectedFilePath)?.type === 'folder' 
            ? selectedFilePath 
            : (selectedFilePath?.substring(0, selectedFilePath.lastIndexOf('/')) || '');
        onFileUpload(file, parentPath);
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
        matchingPaths.add(file.path);
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
        accept="image/*,video/*,.json,.txt,.md,.html,.css,.js,.ts,.tsx"
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
            onContextMenuRequest={onContextMenuRequest}
            expandedFolders={expandedFolders}
            onFolderToggle={handleFolderToggle}
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