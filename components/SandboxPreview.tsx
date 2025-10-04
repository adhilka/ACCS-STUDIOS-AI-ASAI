import React, { useEffect, useRef, useState } from 'react';
import sdk from '@stackblitz/sdk';
import { FileNode } from '../types';
import Spinner from './ui/Spinner';
import { RefreshIcon, XCircleIcon } from './icons';

interface SandboxPreviewProps {
  files: FileNode[];
  projectType: string;
  isFullScreen?: boolean;
  onCloseFullScreen?: () => void;
  isMobile?: boolean;
}

// Default files for a Vite + React + TS + Tailwind project
const viteConfigContent = `
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
})
`;

const tailwindConfigContent = `
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
`;

const postcssConfigContent = `
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`;

const indexCssContent = `
@tailwind base;
@tailwind components;
@tailwind utilities;
`;

const SandboxPreview: React.FC<SandboxPreviewProps> = ({ files, projectType, isFullScreen, onCloseFullScreen, isMobile }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const vmRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const transformFilesForSdk = (fileNodes: FileNode[]): Record<string, string> => {
    const sdkFiles: Record<string, string> = {};
    fileNodes.forEach(node => {
      if (node.type === 'file' && node.content !== undefined) {
        sdkFiles[node.path] = node.content;
      }
    });
    return sdkFiles;
  };

  const bootOrUpdateVm = async () => {
    if (!containerRef.current || files.length === 0) {
        setIsLoading(false);
        return;
    };
    
    setIsLoading(true);
    setError(null);

    try {
      const projectFiles = transformFilesForSdk(files);

      // --- 1. Intelligent index.html handling ---
      if (!projectFiles['index.html']) {
          const entryPoint = ['src/index.tsx', 'src/main.tsx', 'src/index.jsx', 'src/main.jsx'].find(p => projectFiles[p]);
          projectFiles['index.html'] = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ASAI Live Preview</title>
</head>
<body>
  <div id="root"></div>
  ${entryPoint ? `<script type="module" src="/${entryPoint}"></script>` : `<div>Error: Main entry file (e.g., src/index.tsx) not found.</div>`}
</body>
</html>`;
      }

      // --- 2. Add required config files if they don't exist ---
      if (!projectFiles['vite.config.ts']) projectFiles['vite.config.ts'] = viteConfigContent;
      if (!projectFiles['tailwind.config.js']) projectFiles['tailwind.config.js'] = tailwindConfigContent;
      if (!projectFiles['postcss.config.js']) projectFiles['postcss.config.js'] = postcssConfigContent;
      
      // --- 3. CSS Handling ---
      const cssEntryPoint = 'src/index.css';
      if (!projectFiles[cssEntryPoint]) {
           projectFiles[cssEntryPoint] = indexCssContent;
      }

      const mainJsEntryPoint = ['src/index.tsx', 'src/main.tsx', 'src/index.jsx', 'src/main.jsx'].find(p => projectFiles[p]);
      if (mainJsEntryPoint && !projectFiles[mainJsEntryPoint].includes('index.css')) {
          projectFiles[mainJsEntryPoint] = `import './index.css';\n${projectFiles[mainJsEntryPoint]}`;
      }

      // --- 4. Robust package.json management ---
      let packageJson;
      try {
          packageJson = projectFiles['package.json'] ? JSON.parse(projectFiles['package.json']) : {};
      } catch (e) {
          console.warn("Invalid package.json, creating a new one.");
          packageJson = {};
      }

      packageJson.dependencies = packageJson.dependencies || {};
      packageJson.devDependencies = packageJson.devDependencies || {};
      
      const requiredDependencies = {
          "react": "^18.2.0",
          "react-dom": "^18.2.0",
      };
      const requiredDevDependencies = {
          "@types/react": "^18.2.0",
          "@types/react-dom": "^18.2.0",
          "@vitejs/plugin-react": "^4.2.0",
          "autoprefixer": "^10.4.10",
          "postcss": "^8.4.30",
          "tailwindcss": "^3.4.0",
          "typescript": "^5.2.0",
          "vite": "^5.0.0",
      };

      packageJson.dependencies = { ...requiredDependencies, ...packageJson.dependencies };
      packageJson.devDependencies = { ...requiredDevDependencies, ...packageJson.devDependencies };
      
      projectFiles['package.json'] = JSON.stringify({
          name: 'asai-sandbox-project',
          private: true,
          version: '0.0.0',
          type: 'module',
          scripts: { "dev": "vite", "build": "vite build", "preview": "vite preview" },
          ...packageJson
      }, null, 2);

      // --- 5. Embed the project ---
      if (vmRef.current) {
        await vmRef.current.destroy();
      }

      vmRef.current = await sdk.embedProject(
        containerRef.current,
        {
          title: 'ASAI Live Preview',
          description: 'A live preview of the generated application.',
          template: 'node',
          files: projectFiles,
          dependencies: packageJson.dependencies,
        },
        {
          openFile: mainJsEntryPoint || 'src/index.tsx',
          view: 'preview',
          hideExplorer: true,
          showSidebar: false,
          terminalHeight: 0,
          clickToLoad: false,
          forceEmbedLayout: true,
        }
      );

    } catch (error) {
        console.error("StackBlitz SDK Error:", error);
        setError(error instanceof Error ? error.message : "An unknown error occurred while loading the preview.");
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
        bootOrUpdateVm();
    }, 1000);

    return () => {
        clearTimeout(handler);
    };
  }, [files, projectType]);

  const wrapperClasses = isFullScreen
    ? 'fixed inset-0 bg-base-100 z-50 flex flex-col'
    : 'h-full bg-base-100 flex flex-col';


  return (
    <div className={wrapperClasses}>
      <div className="bg-base-200 text-base-content px-4 py-2 text-sm border-b border-base-300 flex justify-between items-center shrink-0">
        <span>Live Preview (StackBlitz)</span>
        <div className="flex items-center gap-2">
            <button onClick={bootOrUpdateVm} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-base-300 transition-colors text-sm font-semibold" title="Force Refresh Preview">
                <RefreshIcon className="w-5 h-5" />
                <span>Refresh</span>
            </button>
            {isFullScreen && (
                <button onClick={onCloseFullScreen} className="px-2 py-1 text-xs bg-base-300 hover:bg-opacity-80 rounded-md font-semibold">
                    Close
                </button>
            )}
        </div>
      </div>
      <div className="w-full h-full border-0 bg-base-100 relative">
        {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-base-100/80 z-10">
                <Spinner size="lg" />
                <p className="mt-4 text-neutral">Preparing Sandbox Environment...</p>
            </div>
        )}
        {error && !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-base-100/80 z-10 p-4 text-center">
                <XCircleIcon className="w-12 h-12 text-red-400 mb-4" />
                <p className="font-semibold text-base-content">Preview Failed to Load</p>
                <p className="text-sm text-neutral mt-2 mb-4">There was an error initializing the sandbox environment.</p>
                <pre className="text-xs bg-base-200 p-2 rounded-md text-red-300 max-w-full overflow-auto">{error}</pre>
                <button onClick={bootOrUpdateVm} className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-white hover:bg-primary/90 transition-colors text-sm font-semibold">
                    <RefreshIcon className="w-5 h-5" />
                    <span>Retry</span>
                </button>
            </div>
        )}
        <div ref={containerRef} className={`w-full h-full ${error ? 'hidden' : ''}`} />
      </div>
    </div>
  );
};

export default SandboxPreview;
