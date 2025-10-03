import React, { useState } from 'react';
import { ApiConfig, BrandAssets } from '../types';
import { generateBrandAssets } from '../services/rebrandingService';
import Spinner from './ui/Spinner';
import { MagicWandIcon } from './icons';
import { useBranding } from '../contexts/BrandingContext';

interface RebrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiConfig: ApiConfig;
}

const RebrandModal: React.FC<RebrandModalProps> = ({ isOpen, onClose, apiConfig }) => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatedAssets, setGeneratedAssets] = useState<BrandAssets | null>(null);
    const { saveBrand, resetBrand } = useBranding();

    if (!isOpen) return null;

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsLoading(true);
        setError(null);
        setGeneratedAssets(null);
        try {
            const assets = await generateBrandAssets(prompt, apiConfig);
            setGeneratedAssets(assets);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred during generation.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleApply = () => {
        if (generatedAssets) {
            saveBrand(generatedAssets);
            onClose();
        }
    };
    
    const handleReset = () => {
        resetBrand();
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity duration-300 p-4">
            <div className="bg-base-200 rounded-lg shadow-2xl p-6 sm:p-8 w-full max-w-md sm:max-w-4xl border border-base-300 flex flex-col h-[90vh]">
                <div className='flex items-center gap-3 mb-4'>
                    <MagicWandIcon className="w-8 h-8 text-accent"/>
                    <div>
                        <h2 className="text-2xl font-bold text-base-content">Rebrand ASAI</h2>
                        <p className="text-sm text-neutral">Use AI to generate a new visual identity for your editor.</p>
                    </div>
                </div>
                
                <div className="mb-4 flex flex-col sm:flex-row gap-4">
                    <input
                      type="text"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="e.g., 'Cyberpunk synthwave', 'Minimalist solar'"
                      className="flex-grow w-full bg-base-100 border border-base-300 rounded-md py-2 px-3 text-base-content focus:outline-none focus:ring-2 focus:ring-accent"
                      disabled={isLoading}
                    />
                    <button onClick={handleGenerate} disabled={isLoading || !prompt.trim()} className="w-full sm:w-48 px-6 py-2 bg-accent hover:opacity-90 rounded-md text-white font-semibold transition-colors flex items-center justify-center disabled:bg-opacity-50 disabled:cursor-not-allowed">
                        {isLoading ? <Spinner size="sm" /> : "Generate Identity"}
                    </button>
                </div>

                {error && <p className="text-red-400 text-sm p-3 rounded-md bg-red-500/10 border border-red-500/20 my-4">{error}</p>}

                <div className="flex-grow bg-base-100 my-4 rounded-lg p-4 overflow-y-auto border border-base-300">
                    {!generatedAssets && !isLoading && (
                        <div className="flex items-center justify-center h-full text-neutral">Enter a prompt to generate assets.</div>
                    )}
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center h-full text-neutral">
                            <Spinner size="lg" />
                            <p className="mt-4 text-lg">Generating assets... this can take a moment.</p>
                        </div>
                    )}
                    {generatedAssets && (
                        <div>
                            <h3 className="text-lg font-semibold mb-4 text-base-content">Generated Assets Preview</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-neutral mb-2">Logo</label>
                                    <div className="bg-base-300 p-4 rounded-md flex justify-center items-center">
                                        <img src={generatedAssets.logo} alt="Generated Logo" className="w-24 h-24 object-contain" />
                                    </div>
                                </div>
                                 <div>
                                    <label className="block text-sm font-medium text-neutral mb-2">Color Palette</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {Object.entries(generatedAssets.colors).map(([name, color]) => (
                                            <div key={name} className="text-center">
                                                <div className="w-full h-12 rounded" style={{ backgroundColor: color }}></div>
                                                <p className="text-xs mt-1 text-neutral truncate">{name}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                     <label className="block text-sm font-medium text-neutral mb-2">Background Image</label>
                                     <div className="w-full h-32 bg-base-300 rounded-md bg-cover bg-center" style={{ backgroundImage: `url(${generatedAssets.background})`}}></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <button onClick={handleReset} className="w-full sm:w-auto px-4 py-2 bg-base-300 hover:bg-opacity-80 rounded-md text-base-content font-semibold transition-colors">
                        Reset to Default
                    </button>
                    <div className="flex w-full sm:w-auto space-x-4">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-base-300 hover:bg-opacity-80 rounded-md text-base-content font-semibold transition-colors">
                            Cancel
                        </button>
                        <button onClick={handleApply} disabled={!generatedAssets} className="flex-1 px-6 py-2 bg-green-600 hover:bg-green-500 rounded-md text-white font-semibold transition-colors disabled:bg-opacity-50 disabled:cursor-not-allowed">
                            Apply Brand
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RebrandModal;