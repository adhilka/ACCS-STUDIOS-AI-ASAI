

import { FileNode } from '../types';

function findFile(files: FileNode[], fileName: string): FileNode | null {
  return files.find(file => file.type === 'file' && file.name.toLowerCase() === fileName.toLowerCase()) || null;
}

function getAllFiles(files: FileNode[], extension: string): {path: string, content: string}[] {
    return files
        .filter(file => file.type === 'file' && file.name.endsWith(extension))
        .map(file => ({ path: file.path, content: file.content || '' }));
}

function generateImportMap(files: FileNode[]): string {
    const packageJsonFile = findFile(files, 'package.json');
    if (!packageJsonFile || !packageJsonFile.content) return '';

    try {
        const packageJson = JSON.parse(packageJsonFile.content);
        const dependencies = packageJson.dependencies || {};
        
        let imports: Record<string, string> = {
             "react": "https://cdn.jsdelivr.net/npm/react@18/dev.min.js",
             "react-dom": "https://cdn.jsdelivr.net/npm/react-dom@18/dev.min.js",
             "react-dom/client": "https://cdn.jsdelivr.net/npm/react-dom@18/dev.min.js"
        };

        for (const [pkg, version] of Object.entries(dependencies)) {
            // Basic check to avoid overwriting core react libs if user adds them
            if (!imports[pkg]) {
                imports[pkg] = `https://cdn.jsdelivr.net/npm/${pkg}@${version}`;
                imports[`${pkg}/`] = `https://cdn.jsdelivr.net/npm/${pkg}@${version}/`;
            }
        }
        
        return `<script type="importmap">${JSON.stringify({ imports })}</script>`;

    } catch (e) {
        console.error("Failed to parse package.json for import map:", e);
        return '';
    }
}


export function buildPreviewHtml(files: FileNode[], projectType: string): string {
  const htmlFile = findFile(files, 'index.html');
  const cssFiles = getAllFiles(files, '.css').map(f => f.content);
  const allCss = cssFiles.join('\n');
  const customImportMap = generateImportMap(files);

  const getBabelScript = (files: {path: string, content: string}[]) => {
      const allJsx = files.map(f => `// File: ${f.path}\n${f.content}`).join('\n\n// ---- New File ----\n\n');
      return `<script type="text/babel" data-type="module">${allJsx}</script>`;
  };

  const consoleHijackScript = `
<script>
  try {
    const originalConsole = { ...console };
    const methods = ['log', 'warn', 'error', 'info'];
    
    const serializeArg = (arg) => {
      if (arg instanceof Error) {
        return { message: arg.message, stack: arg.stack, name: arg.name };
      }
      if (typeof arg === 'function') {
        return '[Function]';
      }
      if (typeof arg === 'object' && arg !== null) {
        // Basic cycle detection
        const cache = new Set();
        try {
            return JSON.parse(JSON.stringify(arg, (key, value) => {
                if (typeof value === 'object' && value !== null) {
                    if (cache.has(value)) return '[Circular]';
                    cache.add(value);
                }
                return value;
            }));
        } catch (e) {
            return '[Unserializable Object]';
        }
      }
      return arg;
    };

    methods.forEach(method => {
      console[method] = (...args) => {
        originalConsole[method](...args);
        try {
          window.parent.postMessage({
            type: 'CONSOLE_LOG',
            payload: {
              method: method,
              args: args.map(serializeArg)
            }
          }, '*');
        } catch (e) {
          originalConsole.error('Error posting message to parent:', e);
        }
      };
    });

    window.addEventListener('error', (event) => {
      const { message, filename, lineno, colno, error } = event;
      originalConsole.error('Uncaught Error:', message, error);
      try {
        window.parent.postMessage({
          type: 'CONSOLE_LOG',
          payload: {
            method: 'error',
            args: ['Uncaught Error:', serializeArg(error) || message]
          }
        }, '*');
      } catch (e) {}
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      originalConsole.warn('Unhandled Promise Rejection:', event.reason);
      try {
         window.parent.postMessage({
          type: 'CONSOLE_LOG',
          payload: {
            method: 'warn',
            args: ['Unhandled Promise Rejection:', serializeArg(event.reason)]
          }
        }, '*');
      } catch(e) {}
    });

  } catch (e) {
    console.error('ASAI Console Hijack failed:', e);
  }
</script>
`;

  if (htmlFile && htmlFile.content) {
    let content = htmlFile.content;
    
    // Inject console hijack script, CSS, and import map into head
    if (!content.includes('</head>')) {
      content = content.replace('<body>', '<head></head><body>');
    }

    let headInjections = consoleHijackScript;
    if (allCss) {
        headInjections += `<style>${allCss}</style>`;
    }
    if (customImportMap && !content.includes('type="importmap"')) {
        headInjections += customImportMap;
    }
    content = content.replace('</head>', `${headInjections}</head>`);
    
    // Inject scripts based on type
    if (projectType.toLowerCase().includes('react')) {
        const tsxFiles = getAllFiles(files, '.tsx');
        content = content.replace('</body>', `${getBabelScript(tsxFiles)}</body>`);
    } else if (projectType.toLowerCase().includes('vanilla')) {
        const jsFiles = getAllFiles(files, '.js');
        const allJs = jsFiles.map(js => `<script type="module">${js.content}</script>`).join('\n');
        content = content.replace('</body>', `${allJs}</body>`);
    }

    return content;
  }

  // Fallback to a default template if no index.html is found
  if (projectType.toLowerCase().includes('react')) {
      const tsxFiles = getAllFiles(files, '.tsx');
      
      return `
        <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>React Preview</title>
        ${consoleHijackScript}
        ${customImportMap}
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
        <style>${allCss}</style></head><body class="bg-black text-gray-200"><div id="root"></div>${getBabelScript(tsxFiles)}</body></html>`;
  }
  
  if (projectType.toLowerCase().includes('vanilla')) {
      const jsFiles = getAllFiles(files, '.js');
      const allJsScripts = jsFiles.map((js, index) => {
          return `<script type="module">// File: ${js.path}\n${js.content}</script>`;
      }).join('\n');

      return `
        <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Vanilla JS Preview</title>
        ${consoleHijackScript}
        <script src="https://cdn.tailwindcss.com"></script><style>${allCss}</style></head><body class="bg-black text-gray-200"><div id="root"></div>${allJsScripts}</body></html>`;
  }
  
  // Default fallback for non-previewable types like Python
  return `
    <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Preview Unavailable</title>
    <script src="https://cdn.tailwindcss.com"></script></head><body class="bg-black flex items-center justify-center h-screen">
    <div class="text-center text-gray-300"><h1 class="text-2xl font-bold">Preview Not Available</h1><p class="mt-2">Live preview is not supported for '${projectType}' projects.</p></div></body></html>`;
}