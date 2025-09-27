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
  RobotIcon,
  MagicWandIcon,
  BrainIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
  CommandLineIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChecklistIcon,
  SaveIcon
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

const features = [
  { icon: RobotIcon, title: 'Autonomous Development', text: "Give the AI a high-level objective and watch it plan, code, analyze, and self-correct to complete the task." },
  { icon: UsersIcon, title: 'Real-time Collaboration', text: "Code together in real-time. Invite your team and see every change mirrored instantly on your own secure server." },
  { icon: ChatBubbleIcon, title: 'Rich Team Chat', text: "Go beyond code. Mention teammates, pin files, share and generate code snippets, and manage tasks with a built-in to-do list." },
  { icon: SaveIcon, title: 'Version Control (Snapshots)', text: "Experiment without fear. Create a snapshot of your project at any point and revert back to a previous version instantly." },
  { icon: PlayIcon, title: 'Live Sandbox Preview', text: "Instantly preview your application in a live, interactive StackBlitz environment right inside the editor." },
  { icon: BrainIcon, title: 'Multi-Provider AI', text: "Choose the best AI for the job. Seamlessly switch between Gemini, Groq, and a wide range of models via OpenRouter." },
  { icon: WrenchScrewdriverIcon, title: 'AI-Powered Debugging', text: "Describe a bug or issue, and let the AI analyze your code, propose a working fix, and apply it with your approval." },
  { icon: RocketIcon, title: 'One-Click Deployment', text: "Deploy your project directly to CodeSandbox with a single click, with more providers like Netlify coming soon." },
];

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

const LandingPage: React.FC<LandingPageProps> = ({ onStartBuilding, onSignInClick, onShowDocs }) => {
  const [activeUseCase, setActiveUseCase] = useState(Object.keys(useCases)[0]);
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState<AiProvider>('gemini');
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('in-view');
        });
      }, { threshold: 0.1 }
    );
    const elements = document.querySelectorAll('.scroll-animate');
    elements.forEach((el) => observer.observe(el));
    return () => elements.forEach((el) => observer.unobserve(el));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if(prompt.trim()) {
        onStartBuilding(prompt.trim(), provider);
    }
  }

  return (
    <div className="bg-base-100 text-base-content min-h-screen">
      <style>{`
        .aurora-background {
            position: absolute; top: 0; left: 0; right: 0; bottom: 0;
            background-color: var(--color-base-100);
            overflow: hidden; z-index: 1;
        }
        .aurora-background::before {
            content: ""; position: absolute; top: 50%; left: 50%;
            width: 120vw; height: 120vh;
            background-image:
                radial-gradient(ellipse 50% 80% at 20% 40%, rgba(59, 130, 246, 0.15), transparent),
                radial-gradient(ellipse 50% 80% at 80% 50%, rgba(139, 92, 246, 0.1), transparent);
            transform: translate(-50%, -50%);
            filter: blur(80px);
            animation: rotate-aurora 25s infinite linear;
            opacity: 0.8;
        }
        @keyframes rotate-aurora {
            from { transform: translate(-50%, -50%) rotate(0deg); }
            to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        .grid-pattern-overlay {
            position: absolute; top: 0; left: 0; right: 0; bottom: 0;
            background-image: linear-gradient(var(--color-base-300) 1px, transparent 1px), linear-gradient(90deg, var(--color-base-300) 1px, transparent 1px);
            background-size: 40px 40px; z-index: 2; opacity: 0.2;
        }
      `}</style>
      
      <div className="relative w-full min-h-screen">
        <div className="aurora-background"></div>
        <div className="grid-pattern-overlay"></div>
        <Header onSignInClick={onSignInClick} onShowDocs={onShowDocs} />
        
        <main className="relative min-h-screen flex flex-col items-center justify-center text-center p-4 z-10 pt-24 pb-12">
          <div className="relative max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-base-content to-neutral scroll-animate">
              The Collaborative AI Workspace for Modern Development
            </h1>
            <p className="mt-6 text-lg md:text-xl text-neutral max-w-3xl mx-auto scroll-animate" style={{ transitionDelay: '0.2s' }}>
              Build, collaborate, and deploy with an autonomous AI partner. From real-time co-editing to version snapshots, ASAI is engineered for teams and professional developers.
            </p>
            <div className="mt-10 max-w-2xl mx-auto scroll-animate" style={{ transitionDelay: '0.3s' }}>
                 <form onSubmit={handleSubmit} className="relative">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe your application idea..."
                        rows={3}
                        className="w-full pl-6 pr-48 py-4 text-lg bg-base-200 border border-base-300 rounded-lg text-base-content placeholder-neutral focus:ring-2 focus:ring-accent focus:outline-none transition resize-none"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <select
                            value={provider}
                            onChange={e => setProvider(e.target.value as AiProvider)}
                            className="bg-base-200 border border-base-300 rounded-md h-10 px-3 text-base-content text-sm focus:outline-none focus:ring-2 focus:ring-accent transition-colors hover:bg-base-300"
                        >
                            <option value="gemini">Gemini</option>
                            <option value="openrouter">OpenRouter</option>
                            <option value="groq">Groq</option>
                        </select>
                        <button type="submit" className="group btn-shine h-10 w-10 inline-flex items-center justify-center bg-gradient-to-r from-accent to-secondary text-white font-bold rounded-md overflow-hidden transition-transform duration-300 hover:scale-105 shadow-lg shadow-accent/20 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed" disabled={!prompt.trim()}>
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path></svg>
                        </button>
                    </div>
                </form>
            </div>
          </div>
          <MockEditor />
        </main>
      </div>
      
      <Section id="features">
        <SectionTitle subtitle="ASAI is more than a code generator; it's a collaborative environment where you and your team build with an autonomous partner.">
            A Smarter Way to Build
        </SectionTitle>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, i) => (
                <div key={feature.title} className="relative p-6 rounded-xl bg-base-200 overflow-hidden group scroll-animate border border-base-300" style={{ transitionDelay: `${0.3 + i*0.1}s`}}>
                    <div className="absolute -inset-px rounded-xl bg-gradient-to-r from-accent to-secondary opacity-0 group-hover:opacity-70 transition-opacity duration-300"/>
                    <div className="relative">
                        <div className="mb-4 text-accent"><feature.icon className="w-10 h-10"/></div>
                        <h3 className="font-bold text-lg mb-2 text-base-content">{feature.title}</h3>
                        <p className="text-neutral text-sm">{feature.text}</p>
                    </div>
                </div>
            ))}
        </div>
      </Section>
      
      <Section id="collaboration" className="bg-base-200/50">
        <SectionTitle subtitle="Go beyond solo development. ASAI provides the tools for seamless teamwork, all on your own infrastructure.">
          Built for Collaboration and Control
        </SectionTitle>
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="p-6 rounded-xl text-center scroll-animate" style={{ transitionDelay: '0.3s' }}>
                <div className="inline-block p-4 bg-primary/10 rounded-xl text-primary mb-4"><UsersIcon className="w-10 h-10"/></div>
                <h3 className="font-bold text-xl mb-2 text-base-content">Live Server Collaboration</h3>
                <p className="text-neutral text-sm">Connect your own Firebase server to enable a true real-time workspace. Invite teammates and watch as every code edit, file change, and chat message appears instantly for everyone. Secure, private, and powerful.</p>
            </div>
             <div className="p-6 rounded-xl text-center scroll-animate" style={{ transitionDelay: '0.4s' }}>
                <div className="inline-block p-4 bg-secondary/10 rounded-xl text-secondary mb-4"><ChatBubbleIcon className="w-10 h-10"/></div>
                <h3 className="font-bold text-xl mb-2 text-base-content">Integrated Communication Hub</h3>
                <p className="text-neutral text-sm">Stop switching contexts. Our rich chat supports `@mentions`, file pinning to jump straight to code, sharing AI-generated snippets, and creating to-do lists to keep your team on track, all within the editor.</p>
            </div>
             <div className="p-6 rounded-xl text-center scroll-animate" style={{ transitionDelay: '0.5s' }}>
                <div className="inline-block p-4 bg-accent/10 rounded-xl text-accent mb-4"><LayersIcon className="w-10 h-10"/></div>
                <h3 className="font-bold text-xl mb-2 text-base-content">Safety Net with Snapshots</h3>
                <p className="text-neutral text-sm">Encourage experimentation with built-in version control. After the AI makes changes or at any point you choose, create a project "snapshot". You can view a full history and restore the entire project to any previous state with one click.</p>
            </div>
        </div>
      </Section>

        <Section id="comparison">
            <SectionTitle subtitle="See how ASAI's agent-based, collaborative approach provides a more powerful and controlled development experience.">
                How ASAI Compares
            </SectionTitle>
            <div className="max-w-4xl mx-auto scroll-animate" style={{ transitionDelay: '0.3s' }}>
                <div className="overflow-x-auto bg-base-200 rounded-lg border border-base-300">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-base-300/50 text-xs text-neutral uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Feature</th>
                                <th className="px-6 py-4 text-center">ASAI</th>
                                <th className="px-6 py-4 text-center">Other AI Builders</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-base-300">
                            {comparisonFeatures.map((item, index) => (
                                <tr key={index} className="hover:bg-base-300/30">
                                    <td className="px-6 py-4 font-semibold text-base-content">{item.feature}</td>
                                    <td className="px-6 py-4 text-center">
                                        {item.asai === true ? <CheckCircleIcon className="w-6 h-6 text-green-500 mx-auto" /> : <span className="text-base-content font-semibold">{item.asai}</span>}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {item.others === false ? <XCircleIcon className="w-6 h-6 text-red-500 mx-auto" /> : <span className="text-neutral">{item.others}</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </Section>

      <Section id="use-cases" className="bg-base-200/50">
        <SectionTitle subtitle="Whether you're shipping a side project or prototyping the next big thing, ASAI is your secret weapon.">
            Built for Modern Builders & Teams
        </SectionTitle>
        <div className="max-w-4xl mx-auto">
            <div className="flex justify-center flex-wrap gap-2 md:gap-4 mb-8 border-b border-base-300 pb-2 scroll-animate" style={{ transitionDelay: `0.3s` }}>
                {Object.keys(useCases).map((uc) => (
                    <button
                        key={uc}
                        onClick={() => setActiveUseCase(uc)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${activeUseCase === uc ? 'bg-primary/10 text-primary' : 'text-neutral hover:bg-base-200 hover:text-base-content'}`}
                    >
                        {React.createElement(useCases[uc as keyof typeof useCases].icon, { className: 'w-5 h-5'})}
                        <span>{uc}</span>
                    </button>
                ))}
            </div>
            <div className="relative p-8 bg-base-200 rounded-xl border border-base-300 scroll-animate" style={{ transitionDelay: `0.4s` }}>
                <h3 className="font-bold text-xl mb-2 text-base-content">{useCases[activeUseCase as keyof typeof useCases].title}</h3>
                <p className="text-neutral">{useCases[activeUseCase as keyof typeof useCases].text}</p>
            </div>
        </div>
      </Section>
      
      <Section className="!py-24">
        <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-base-content scroll-animate" style={{ transitionDelay: '0.2s' }}>Ready to Build Your Next Idea?</h2>
            <p className="mt-4 text-neutral max-w-2xl mx-auto scroll-animate" style={{ transitionDelay: '0.3s' }}>Stop wrestling with boilerplate and start creating. Let our autonomous AI co-developer handle the heavy lifting.</p>
            <div className="mt-10 scroll-animate" style={{ transitionDelay: '0.4s' }}>
                <button onClick={onSignInClick} className="group btn-shine relative inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-primary to-secondary text-white font-bold text-lg rounded-lg overflow-hidden transition-transform duration-300 hover:scale-105 shadow-lg shadow-primary/20">
                    <span className="relative">Sign In & Start Building</span>
                </button>
            </div>
        </div>
      </Section>

      <footer className="py-8 bg-base-200 border-t border-base-300">
        <div className="container mx-auto text-center text-neutral">
           <div className="flex items-center justify-center space-x-3">
             <CodeIcon className="w-7 h-7 text-accent"/>
             <span className="text-lg font-bold tracking-wider text-base-content">ACCS STUDIOS AI</span>
           </div>
           <p className='mt-2'>A Project by Muhammad Adhil K.A</p>
            <div className="flex justify-center space-x-6 my-6">
                <a href="https://github.com/ADIL-KA" target="_blank" rel="noopener noreferrer" className="text-neutral hover:text-base-content transition-colors" aria-label="GitHub">
                    <GithubIcon />
                </a>
            </div>
           <p className="text-sm text-neutral/80">© {new Date().getFullYear()} ACCS STUDIOS AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;