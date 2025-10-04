import React, { useEffect, useState, useRef } from 'react';
import { 
  CodeIcon, 
  PlayIcon, 
  ChatBubbleIcon, 
  AiIcon, 
  AnalyzeIcon, 
  QuoteIcon, 
  RocketIcon, 
  LayersIcon, 
  TargetIcon,
  FolderIcon,
  FileIcon,
  UsersIcon,
  CommandLineIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChecklistIcon
} from '../components/icons';
import { AiProvider } from '../types';

interface LandingPageProps {
  onStartBuilding: (prompt: string, provider: AiProvider, model?: string) => void;
  onSignInClick: () => void;
  onShowDocs: () => void;
}

const useCases = {
    Developers: { icon: LayersIcon, title: 'Supercharge Your Workflow', text: 'Eliminate boilerplate, automate refactoring, and pair-program with both AI and human teammates in a seamless, real-time environment.' },
    Teams: { icon: UsersIcon, title: 'Collaborate in Real-Time', text: 'Bring your team together on a self-hosted, secure server. See changes live, communicate with a feature-rich chat, and manage project history with snapshots.' },
    'Indie Hackers': { icon: RocketIcon, title: 'Launch Your MVP Faster', text: 'Go from idea to a minimum viable product in record time. Collaborate with a co-founder and validate your vision with a functional app, not just mockups.' },
};

const steps = [
  { icon: ChatBubbleIcon, title: '1. Prompt', text: 'Describe a new feature or a change in plain English using our Chat or Build modes.' },
  { icon: AiIcon, title: '2. Plan', text: 'The AI analyzes your request and returns a detailed plan, outlining every file it will create, update, or delete.' },
  { icon: CodeIcon, title: '3. Review & Approve', text: 'You review the plan. If you like it, approve it with a single click to let the AI proceed. You are in full control.' },
  { icon: PlayIcon, title: '4. Execute & Preview', text: 'The AI writes the code and applies the changes, which you can see instantly in the live preview.' }
];

const comparisonFeatures = [
    { feature: 'Autonomous Agent Mode', asai: true, others: 'Limited/Manual' },
    { feature: 'Real-time Collaboration', asai: 'Self-Hosted', others: 'Limited/SaaS-Hosted' },
    { feature: 'Live StackBlitz Sandbox', asai: true, others: 'Slow iFrame/No Live Preview' },
    { feature: 'Project Version Snapshots', asai: true, others: 'Manual Git' },
    { feature: 'User-Approved Planning', asai: true, others: 'Direct-to-Code' },
    { feature: 'Integrated Rich Team Chat', asai: true, others: false },
    { feature: 'Bring Your Own Server (BYOS)', asai: true, others: false },
    { feature: 'Multi-Provider AI Models', asai: true, others: 'Single Model Lock-in' },
];

const GithubIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.168 6.839 9.492.5.092.682-.217.682-.482 0-.237-.009-.868-.014-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.031-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.378.203 2.398.1 2.651.64.7 1.03 1.595 1.03 2.688 0 3.848-2.338 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.001 10.001 0 0022 12c0-5.523-4.477-10-10-10z" clipRule="evenodd" />
  </svg>
);


const Header: React.FC<{ onSignInClick: () => void; onShowDocs: () => void; }> = ({ onSignInClick, onShowDocs }) => {
    const [isScrolled, setIsScrolled] = useState(false);
    
    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 10);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <header className={`fixed top-0 left-0 right-0 z-30 p-4 transition-all duration-300 ${isScrolled ? 'bg-base-100/70 backdrop-blur-md border-b border-base-300' : 'bg-transparent border-b border-transparent'}`}>
            <div className="container mx-auto flex justify-between items-center px-4">
                <div className="flex items-center space-x-3">
                    <CodeIcon className="w-8 h-8 text-accent"/>
                    <span className="text-xl font-bold tracking-wider text-base-content">ACCS STUDIOS AI</span>
                </div>
                <div className="flex items-center space-x-4">
                     <button 
                        onClick={onShowDocs}
                        className="text-sm font-semibold text-neutral hover:text-base-content transition-colors"
                    >
                        Docs
                    </button>
                    <button 
                        onClick={onSignInClick} 
                        className="px-5 py-2 text-sm font-semibold bg-primary/10 backdrop-blur-sm border border-primary/20 rounded-lg text-base-content hover:bg-primary/20 transition-colors"
                    >
                        Sign In
                    </button>
                </div>
            </div>
        </header>
    );
};


const MockEditor: React.FC = () => {
  return (
    <div className="w-full max-w-4xl mx-auto mt-16 scroll-animate" style={{ transitionDelay: '0.4s' }}>
      <div className="relative bg-base-200/70 backdrop-blur-sm border border-base-300 rounded-xl shadow-2xl shadow-accent/10 overflow-hidden">
        {/* Header bar */}
        <div className="h-10 bg-base-300/80 flex items-center px-4">
          <div className="flex space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
        </div>
        
        <div className="grid grid-cols-12 h-[450px]">
          {/* File Explorer */}
          <div className="col-span-4 md:col-span-3 bg-base-200/50 p-4 border-r border-base-300 text-sm overflow-y-auto">
            <h3 className="text-xs uppercase text-neutral font-semibold tracking-wider mb-4">Explorer</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-neutral">
                <FolderIcon className="w-4 h-4 text-accent shrink-0" />
                <span className="truncate">src</span>
              </div>
              <div className="pl-4 flex items-center gap-2 text-neutral">
                <FolderIcon className="w-4 h-4 text-accent shrink-0" />
                <span className="truncate">components</span>
              </div>
              <div className="pl-8 flex items-center gap-2 text-base-content bg-primary/10 rounded py-1 px-2">
                <FileIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">Button.tsx</span>
              </div>
              <div className="pl-4 flex items-center gap-2 text-neutral">
                <FileIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">App.tsx</span>
              </div>
              <div className="flex items-center gap-2 text-neutral">
                <FileIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">index.html</span>
              </div>
              <div className="flex items-center gap-2 text-neutral">
                <FileIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">package.json</span>
              </div>
            </div>
          </div>
          
          {/* Code Editor */}
          <div className="col-span-8 md:col-span-9 p-6 font-mono text-sm text-slate-300 overflow-auto">
            <pre>
              <code>
                <span className="text-purple-400">import</span> React <span className="text-purple-400">from</span> <span className="text-green-400">'react'</span>;{'\n\n'}
                <span className="text-purple-400">const</span> <span className="text-yellow-300">Button</span> = () =&gt; {'{'}{'\n'}
                {'  '}<span className="text-purple-400">return</span> ({'\n'}
                {'    '}&lt;<span className="text-red-400">button</span> <span className="text-sky-300">className</span>=<span className="text-green-400">"bg-blue-500 text-white p-2 rounded"</span>&gt;{'\n'}
                {'      '}Click Me{'\n'}
                {'    '}&lt;/<span className="text-red-400">button</span>&gt;{'\n'}
                {'  '});{'\n'}
                {'}'};{'\n\n'}
                <span className="text-purple-400">export default</span> Button;
                <span className="inline-block w-0.5 h-4 bg-accent animate-blink ml-1 align-[-2px]"></span>
              </code>
            </pre>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .animate-blink {
          animation: blink 1s infinite steps(1, start);
        }
      `}</style>
    </div>
  );
};


const Section: React.FC<{ children: React.ReactNode, id?: string, className?: string }> = ({ children, id, className = "" }) => (
    <section id={id} className={`py-20 sm:py-32 ${className}`}>
        <div className="container mx-auto px-4">
            {children}
        </div>
    </section>
);

const SectionTitle: React.FC<{ children: React.ReactNode, subtitle: string, delay?: string }> = ({ children, subtitle, delay = '0.2s' }) => (
    <div className="text-center mb-16 max-w-3xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-base-content scroll-animate">{children}</h2>
        <p className="mt-4 text-neutral scroll-animate" style={{ transitionDelay: delay }}>{subtitle}</p>
    </div>
);

const Landing