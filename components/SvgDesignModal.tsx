import React, { useState } from 'react';
import Spinner from './ui/Spinner';
import { PaintBrushIcon, CopyIcon, CheckIcon } from './icons';

interface SvgDesignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (prompt: string, assetType: 'icon' | 'background') => Promise<string>;
  onSaveToFile: (svgCode: string) => void;
  onApplyAsIcon: (svgCode: string) => void;
  isGenerating: boolean;
}

const SvgDesignModal: React.FC<SvgDesignModalProps> = ({ isOpen, onClose, onGenerate, onSaveToFile, onApplyAsIcon, isGenerating }) => {
    const [prompt, setPrompt] = useState('');
    const [assetType, setAssetType] = useState<'icon' | 'background'>('icon');
    const [generatedSvg, setGeneratedSvg] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setError(null);
        setGeneratedSvg(null);
        try {
            const svgCode = await onGenerate(prompt, assetType);
            setGeneratedSvg(svgCode);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        }
    };

    const handleCopy = () => {
        if (!generatedSvg) return;
        navigator.clipboard.writeText(generatedSvg);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    
    const handleClose = () => {
        setPrompt('');
        setGeneratedSvg(null);
        setError(null);
        onClose();
    };
    
    const tabClasses = (tab: 'icon' | 'background') =>
    `px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors border-b-2 ${
      assetType === tab 
      ? 'border-accent text-accent' 
      : 'border-transparent text-neutral hover:text-base-content'
    }`;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity duration-300">
            <div className="bg-base-200 rounded-lg shadow-2xl p-8 w-full max-w-4xl m-4 border border-base-300 flex flex-col" style={{height: '90vh'}}>
                <div className='flex items-center gap-3 mb-4'>
                    <PaintBrushIcon className="w-8 h-8 text-accent"/>
                    <div>
                        <h2 className="text-2xl font-bold text-base-content">AI Design Studio</h2>
                        <p className="text-sm text-neutral">Generate SVG icons, logos, and backgrounds from a description.</p>
                    </div>
                </div>
                
                <div className="border-b border-base-300 mb-4">
                    <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                        <button onClick={() => setAssetType('icon')} className={tabClasses('icon')}>Icon / Logo</button>
                        <button onClick={() => setAssetType('background')} className={tabClasses('background')}>Background</button>
                    </nav>
                </div>

                <div className="mb-4 flex gap-4">
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder={assetType === 'icon' ? "e.g., A minimalist logo of a mountain range inside a circle" : "e.g., A subtle, abstract background with wavy blue lines"}
                      rows={2}
                      className="flex-grow w-full bg-base-100 border border-base-300 rounded-md py-2 px-3 text-base-content focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                      disabled={isGenerating}
                    />
                    <button onClick={handleGenerate} disabled={isGenerating || !prompt.trim()} className="px-6 py-2 bg-accent hover:opacity-90 rounded-md text-white font-semibold transition-colors flex items-center justify-center disabled:bg-opacity-50 disabled:cursor-not-allowed w-48">
                        {isGenerating ? <Spinner size="sm" /> : "Generate"}
                    </button>
                </div>

                {error && <p className="text-red-400 text-sm p-3 rounded-md bg-red-500/10 border border-red-500/20 my-2">{error}</p>}

                <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 my-4 overflow-hidden">
                    <div className="flex flex-col">
                         <h3 className="text-lg font-semibold mb-2 text-base-content">Preview</h3>
                         <div className="flex-grow bg-base-100 rounded-lg p-4 overflow-auto border border-base-300 flex items-center justify-center">
                            {isGenerating && <Spinner size="lg" />}
                            {!isGenerating && !generatedSvg && <div className="text-neutral text-center">Your generated asset will appear here.</div>}
                            {generatedSvg && (
                                <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: generatedSvg }} />
                            )}
                         </div>
                    </div>
                    <div className="flex flex-col">
                        <h3 className="text-lg font-semibold mb-2 text-base-content">SVG Code</h3>
                        <div className="flex-grow bg-base-100 rounded-lg p-4 overflow-auto border border-base-300 relative font-mono text-xs">
                             {generatedSvg && (
                                <button onClick={handleCopy} className="absolute top-2 right-2 px-2 py-1 text-xs bg-base-300 rounded hover:bg-base-200 flex items-center gap-1 text-neutral hover:text-base-content">
                                    {copied ? <><CheckIcon className="w-3 h-3 text-green-400" /> Copied</> : <><CopyIcon className="w-3 h-3" /> Copy</>}
                                </button>
                            )}
                            <pre className="h-full w-full whitespace-pre-wrap text-neutral"><code>{generatedSvg || '// SVG code will appear here...'}</code></pre>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center mt-6 pt-4 border-t border-base-300">
                    <div>
                         {generatedSvg && (
                             <div className="flex space-x-4">
                                <button onClick={() => onSaveToFile(generatedSvg)} className="px-4 py-2 bg-primary/80 hover:bg-primary rounded-md text-white font-semibold transition-colors">
                                    Add to Project
                                </button>
                                {assetType === 'icon' && (
                                    <button onClick={() => onApplyAsIcon(generatedSvg)} className="px-4 py-2 bg-primary/80 hover:bg-primary rounded-md text-white font-semibold transition-colors">
                                        Apply as Project Icon
                                    </button>
                                )}
                            </div>
                         )}
                    </div>
                    <button onClick={handleClose} className="px-4 py-2 bg-base-300 hover:bg-opacity-80 rounded-md text-base-content font-semibold transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SvgDesignModal;