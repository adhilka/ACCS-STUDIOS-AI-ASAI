import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AiProvider } from '../types';
import { UploadIcon, FileIcon } from './icons';
import Spinner from './ui/Spinner';
import { useAlert } from '../contexts/AlertContext';

declare const JSZip: any;

interface ProjectUploadBuilderProps {
  onStartBuilding: (projectName: string, files: Record<string, string>, provider: AiProvider, model?: string) => void;
  isLoading: boolean;
}

const modelOptions = {
    openrouter: [
        { id: 'mistralai/mistral-7b-instruct', name: 'Mistral 7B Instruct (Free)' },
        { id: 'google/gemma-7b-it', name: 'Gemma 7B (Free)' },
        { id: 'huggingfaceh4/zephyr-7b-beta', name: 'Zephyr 7B (Free)' },
        { id: 'openai/gpt-3.5-turbo', name: 'OpenAI GPT-3.5 Turbo' },
    ],
    groq: [
        { id: 'llama-3.1-8b-instant', name: 'LLaMA 3.1 8B (Fastest)' },
        { id: 'llama-3.1-70b-versatile', name: 'LLaMA 3.1 70B (Powerful)' },
        { id: 'gemma2-9b-it', name: 'Gemma 2 9B' },
        { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
        { id: 'llama3-70b-8192', name: 'LLaMA 3 70B' },
        { id: 'llama3-8b-8192', name: 'LLaMA 3 8B' },
    ]
};

const ProjectUploadBuilder: React.FC<ProjectUploadBuilderProps> = ({ onStartBuilding, isLoading }) => {
    const [projectName, setProjectName] = useState('');
    const [files, setFiles] = useState<Record<string, string>>({});
    const [isProcessing, setIsProcessing] = useState(false);
    const [provider, setProvider] = useState<AiProvider>('gemini');
    const [model, setModel] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const { showAlert } = useAlert();

    const folderInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (provider === 'groq') setModel(modelOptions.groq[0].id);
        else if (provider === 'openrouter') setModel(modelOptions.openrouter[0].id);
        else setModel('');
    }, [provider]);

    const processFileList = useCallback(async (fileList: FileList) => {
        setIsProcessing(true);
        try {
            const readPromises: Promise<{ path: string; content: string }[]>[] = [];
            
            for (const file of Array.from(fileList)) {
                readPromises.push(new Promise(async (resolve, reject) => {
                    try {
                        if (file.name.endsWith('.zip')) {
                            const zip = new JSZip();
                            const contents = await zip.loadAsync(file);
                            const unzippedFiles: { path: string, content: string }[] = [];
                            // FIX: Cast zipEntry to 'any' to resolve TypeScript errors since its type is inferred as 'unknown'.
                            for (const [relativePath, zipEntry] of Object.entries(contents.files)) {
                                if (!(zipEntry as any).dir) {
                                    unzippedFiles.push({ path: relativePath, content: await (zipEntry as any).async('string') });
                                }
                            }
                            resolve(unzippedFiles);
                        } else {
                            const path = (file as any).webkitRelativePath || file.name;
                            const content = await file.text();
                            resolve([{ path, content }]);
                        }
                    } catch (e) {
                        console.error(`Failed to process file ${file.name}:`, e);
                        reject(e);
                    }
                }));
            }
            
            const allFilesNested = await Promise.all(readPromises);
            const allFiles = allFilesNested.flat();

            const newFiles: Record<string, string> = {};
            allFiles.forEach(f => newFiles[f.path] = f.content);
            
            setFiles(prev => ({ ...prev, ...newFiles }));

        } catch (e) {
            showAlert("Failed to process some files. Please ensure they are valid text files or .zip archives.", "error");
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    }, [showAlert]);
    
    const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }, []);
    const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFileList(e.dataTransfer.files);
        }
    }, [processFileList]);
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            processFileList(e.target.files);
            e.target.value = ''; // Reset input
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (projectName.trim() && Object.keys(files).length > 0) {
            onStartBuilding(projectName.trim(), files, provider, model);
        }
    };

    const hasFiles = Object.keys(files).length > 0;

    return (
        <div>
            <h2 className="text-xl font-bold mb-4 text-base-content">Upload Your Project Files</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <input 
                    value={projectName}
                    onChange={e => setProjectName(e.target.value)}
                    placeholder="Enter a project name..."
                    className="w-full bg-base-300 border border-base-300/50 rounded-md py-3 px-4 text-base-content placeholder-neutral focus:outline-none focus:ring-2 focus:ring-primary transition"
                    required
                    disabled={isLoading}
                />
                
                <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-base-300 hover:border-primary/50'}`}>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple className="hidden" accept=".zip,text/*,application/json,.md" />
                    <input type="file" ref={folderInputRef} onChange={handleFileChange} webkitdirectory="true" directory="true" className="hidden" />

                    <div className="flex flex-col items-center text-neutral">
                        <UploadIcon className="w-10 h-10 mb-2" />
                        <p className="font-semibold">Drag & drop files or a .zip archive here</p>
                        <p className="text-sm mt-2">or</p>
                        <div className="flex gap-4 mt-2">
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 text-sm bg-base-300 hover:bg-base-300/80 rounded-md font-semibold">Select Files / Zip</button>
                            <button type="button" onClick={() => folderInputRef.current?.click()} className="px-4 py-2 text-sm bg-base-300 hover:bg-base-300/80 rounded-md font-semibold">Select Folder</button>
                        </div>
                    </div>
                </div>

                {(isProcessing || hasFiles) && (
                    <div className="mt-2 text-sm">
                        {isProcessing && <div className="flex items-center gap-2 text-neutral"><Spinner size="sm" /><span>Processing files...</span></div>}
                        {hasFiles && !isProcessing && (
                             <div>
                                <h4 className="font-semibold">{Object.keys(files).length} files loaded:</h4>
                                <ul className="h-24 overflow-y-auto bg-base-100 p-2 rounded-md border border-base-300 mt-2 text-xs font-mono text-neutral">
                                    {Object.keys(files).slice(0, 100).map(path => <li key={path} className="truncate flex items-center gap-2"><FileIcon className="w-3 h-3 shrink-0" />{path}</li>)}
                                    {Object.keys(files).length > 100 && <li>...and {Object.keys(files).length - 100} more</li>}
                                </ul>
                                <button onClick={() => setFiles({})} type="button" className="text-xs text-red-400 hover:underline mt-1">Clear files</button>
                            </div>
                        )}
                    </div>
                )}
                
                <div className="flex flex-col sm:flex-row items-start gap-4">
                    <select value={provider} onChange={e => setProvider(e.target.value as AiProvider)} className="w-full sm:w-auto h-11 bg-base-200 border border-base-300 rounded-md px-3 text-base-content text-sm" disabled={isLoading}>
                        <option value="gemini">Gemini (for AI features)</option>
                        <option value="openrouter">OpenRouter</option>
                        <option value="groq">Groq</option>
                    </select>

                    {(provider === 'openrouter' || provider === 'groq') && (
                        <select value={model} onChange={e => setModel(e.target.value)} className="w-full sm:w-auto h-11 bg-base-200 border border-base-300 rounded-md px-3 text-base-content text-sm" disabled={isLoading}>
                            {modelOptions[provider].map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                        </select>
                    )}

                    <button type="submit" disabled={isLoading || isProcessing || !projectName.trim() || !hasFiles} className="w-full sm:w-auto px-6 py-2 h-11 bg-primary hover:bg-primary/90 text-white font-semibold rounded-md transition-all flex items-center justify-center gap-2 shrink-0 disabled:bg-primary/50 disabled:cursor-not-allowed sm:ml-auto btn-shine">
                        {isLoading ? <Spinner size="sm"/> : <>Create Project</>}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ProjectUploadBuilder;