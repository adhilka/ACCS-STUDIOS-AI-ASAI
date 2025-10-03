import React, { useEffect, useRef, useState } from 'react';
import sdk from '@stackblitz/sdk';
import { FileNode } from '../types';
import Spinner from './ui/Spinner';
import { RefreshIcon } from './icons';

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

const defaultIndexHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ASAI Live Preview</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/index.tsx"></script>
  </body>
</html>
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

    const projectFiles = transformFilesForSdk(files);

    // --- Enforce a consistent Vite + Tailwind setup ---

    // Always overwrite index.html for a reliable entry point.
    projectFiles['index.html'] = defaultIndexHtml;
    
    // Add required config files if they don't exist.
    if (!projectFiles['vite.config.ts']) projectFiles['vite.config.ts'] = viteConfigContent;
    if (!projectFiles['tailwind.config.js']) projectFiles['tailwind.config.js'] = tailwindConfigContent;
    if (!projectFiles['postcss.config.js']) projectFiles['postcss.config.js'] = postcssConfigContent;
    if (!projectFiles['src/index.css']) projectFiles['src/index.css'] = indexCssContent;
    
    // Ensure the main CSS file is imported in the JS entry point.
    const entryFilePath = 'src/index.tsx';
    if (projectFiles[entryFilePath] && !projectFiles[entryFilePath].includes('index.css')) {
        projectFiles[entryFilePath] = `import './index.css';\n${projectFiles[entryFilePath]}`;
    }
    
    const packageJsonFile = files.find(f => f.path === 'package.json');
    let packageJson = { dependencies: {}, devDependencies: {} };
    if (packageJsonFile?.content) {
        try {
            packageJson = JSON.parse(packageJsonFile.content);
        } catch (e) { console.error("Invalid package.json, starting fresh.", e); }
    }

    // Merge and add required dependencies for the sandbox environment.
    packageJson.devDependencies = {
        ...packageJson.devDependencies,
        "vite": "latest",
        "@vitejs/plugin-react": "latest",
        "typescript": "latest",
        "tailwindcss": "latest",
        "postcss": "latest",
        "autoprefixer": "latest",
    };
    packageJson.dependencies = {
        ...packageJson.dependencies,
        "react": "latest",
        "react-dom": "latest",
    };

    projectFiles['package.json'] = JSON.stringify({
        name: 'asai-sandbox-project',
        private: true,
        version: '0.0.0',
        type: 'module', // Essential for Vite
        scripts: {
            "dev": "vite",
            "build": "vite build",
            "preview": "vite preview"
        },
        ...packageJson
    }, null, 2);

    try {
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
        },
        {
          openFile: files.find(f => f.path.match(/app.tsx|index.tsx/i))?.path || 'src/index.tsx',
          view: 'preview',
          hideExplorer: true,
          showSidebar: false,
          terminalHeight: 0,
          clickToLoad: true, // Recommended for browser compatibility
        }
      );

    } catch (error) {
        console.error("StackBlitz SDK Error:", error);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    // Debounce to prevent rapid reloads on file changes.
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
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
};

export default SandboxPreview;
