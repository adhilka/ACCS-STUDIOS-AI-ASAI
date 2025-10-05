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

const debuggerScriptContent = `
<script>
  (() => {
    console.log('ASAI Visual Debugger Initialized.');
    let highlightEl = null;
    let styleSheet = null;

    const actionStyles = {
      CLICK_ELEMENT: {
          borderColor: 'rgba(59, 130, 246, 0.9)', // blue-500
          label: 'Clicking'
      },
      TYPE_IN_INPUT: {
          borderColor: 'rgba(16, 185, 129, 0.9)', // emerald-500
          label: 'Typing'
      },
    };

    const injectStylesheet = (actionType) => {
        if (styleSheet) styleSheet.remove();
        const style = actionStyles[actionType] || actionStyles.CLICK_ELEMENT;
        styleSheet = document.createElement("style");
        styleSheet.type = "text/css";
        styleSheet.innerText = \`
            @keyframes asai-pulse {
                0% { box-shadow: 0 0 0 0 \${style.borderColor}; }
                70% { box-shadow: 0 0 0 10px rgba(129, 140, 248, 0); }
                100% { box-shadow: 0 0 0 0 rgba(129, 140, 248, 0); }
            }
        \`;
        document.head.appendChild(styleSheet);
    }

    const clearHighlight = () => {
        if (highlightEl) {
            highlightEl.remove();
            highlightEl = null;
        }
    };

    const showHighlight = ({ selector, actionType }) => {
        clearHighlight();
        const targetEl = document.querySelector(\`[data-testid="\${selector}"]\`);
        if (!targetEl) {
            console.warn(\`ASAI Debugger: Could not find element with selector [\${selector}]\`);
            return;
        }

        injectStylesheet(actionType);
        const rect = targetEl.getBoundingClientRect();
        const style = actionStyles[actionType] || actionStyles.CLICK_ELEMENT;

        highlightEl = document.createElement('div');
        highlightEl.style.position = 'fixed';
        highlightEl.style.top = \`\${rect.top}px\`;
        highlightEl.style.left = \`\${rect.left}px\`;
        highlightEl.style.width = \`\${rect.width}px\`;
        highlightEl.style.height = \`\${rect.height}px\`;
        highlightEl.style.border = \`3px solid \${style.borderColor}\`;
        highlightEl.style.borderRadius = '4px';
        highlightEl.style.backgroundColor = 'rgba(129, 140, 248, 0.2)';
        highlightEl.style.zIndex = '99999';
        highlightEl.style.pointerEvents = 'none';
        highlightEl.style.transition = 'all 0.2s ease-out';
        highlightEl.style.animation = 'asai-pulse 1.5s infinite';
        
        const labelEl = document.createElement('div');
        labelEl.innerText = style.label;
        labelEl.style.position = 'absolute';
        labelEl.style.top = '-24px';
        labelEl.style.left = '0';
        labelEl.style.backgroundColor = style.borderColor;
        labelEl.style.color = 'white';
        labelEl.style.padding = '2px 6px';
        labelEl.style.borderRadius = '4px';
        labelEl.style.fontSize = '12px';
        labelEl.style.fontWeight = 'bold';
        
        highlightEl.appendChild(labelEl);
        document.body.appendChild(highlightEl);
    };
    
    window.addEventListener('message', (event) => {
        if (event.data?.source === 'asai-god-mode-debugger') {
            if (event.data.type === 'HIGHLIGHT') {
                showHighlight(event.data.payload);
            } else if (event.data.type === 'CLEAR') {
                clearHighlight();
            }
        }
    });
  })();
</script>
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

      // --- Inject God Mode Debugger ---
      if (projectFiles['index.html']) {
        if (projectFiles['index.html'].includes('</body>')) {
            projectFiles['index.html'] = projectFiles['index.html'].replace('</body>', `${debuggerScriptContent}</body>`);
        } else {
            projectFiles['index.html'] += debuggerScriptContent;
        }
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
      <div id="sandbox-container" className="w-full h-full border-0 bg-base-100 relative">
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
