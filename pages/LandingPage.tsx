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
} from '../components/icons';
import { AiProvider } from '../types';

interface LandingPageProps {
  onStartBuilding: (prompt: string, provider: AiProvider) => void;
  onSignInClick: () => void;
}

const useCases = {
    Developers: { icon: LayersIcon, title: 'Eliminate Boilerplate', text: 'Bootstrap projects and automate refactoring, saving hours on tedious setup and repetitive tasks. Focus on complex logic, not configuration.' },
    'Indie Hackers': { icon: RocketIcon, title: 'Launch Your MVP Faster', text: 'Go from idea to a minimum viable product in record time. Validate your vision with a functional app, not just mockups.' },
    Prototypers: { icon: TargetIcon, title: 'Create Functional Prototypes', text: 'Build high-fidelity, interactive prototypes in minutes. Test user flows and gather real feedback with a working application.' },
};

const features = [
  { icon: RobotIcon, title: 'Autonomous Development', text: "Give the AI an objective and watch it plan, code, analyze, and self-correct to complete the task." },
  { icon: PlayIcon, title: 'Live Sandbox Preview', text: "See your application come to life instantly. No setup required, just code and preview." },
  { icon: BrainIcon, title: 'Persistent AI Memory', text: "The AI learns from past changes, leading to smarter, more context-aware development over time." },
  { icon: MagicWandIcon, title: 'Dynamic AI Rebranding', text: "Instantly generate and apply a new visual identity—logo, colors, and background—with a simple prompt." },
  { icon: UsersIcon, title: 'Collaborate with Your Team', text: "Share your project with a simple key. Allow teammates to join and contribute to the codebase." },
  { icon: WrenchScrewdriverIcon, title: 'AI-Powered Debugging', text: "Describe a bug or issue, and let the AI analyze your code and propose a working fix." },
  { icon: AnalyzeIcon, title: 'In-Depth Code Analysis', text: "Ask the AI to review your entire project for improvements, from performance optimizations to best practices." },
  { icon: CodeIcon, title: 'Full Control', text: "You're always in charge. The AI proposes a plan for every change, which you must approve before it writes any code." },
];

const steps = [
  { icon: ChatBubbleIcon, title: '1. Prompt', text: 'Describe a new feature or a change in plain English using our Chat or Build modes.' },
  { icon: AiIcon, title: '2. Plan', text: 'The AI analyzes your request and returns a detailed plan, outlining every file it will create, update, or delete.' },
  { icon: CodeIcon, title: '3. Review & Approve', text: 'You review the plan. If you like it, approve it with a single click to let the AI proceed. You are in full control.' },
  { icon: PlayIcon, title: '4. Execute & Preview', text: 'The AI writes the code and applies the changes, which you can see instantly in the live preview.' }
];

const GithubIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.168 6.839 9.492.5.092.682-.217.682-.482 0-.237-.009-.868-.014-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.031-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.378.203 2.398.1 2.651.64.7 1.03 1.595 1.03 2.688 0 3.848-2.338 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.001 10.001 0 0022 12c0-5.523-4.477-10-10-10z" clipRule="evenodd" />
  </svg>
);


const Header: React.FC<{ onSignInClick: () => void }> = ({ onSignInClick }) => {
    const [isScrolled, setIsScrolled] = useState(false);
    
    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 10);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <header className={`fixed top-0 left-0 right-0 z-30 p-4 transition-all duration-300 ${isScrolled ? 'bg-slate-950/70 backdrop-blur-md border-b border-slate-800' : 'bg-transparent border-b border-transparent'}`}>
            <div className="container mx-auto flex justify-between items-center px-4">
                <div className="flex items-center space-x-3">
                    <CodeIcon className="w-8 h-8 text-sky-400"/>
                    <span className="text-xl font-bold tracking-wider text-white">ACCS STUDIOS AI</span>
                </div>
                <button 
                    onClick={onSignInClick} 
                    className="px-5 py-2 text-sm font-semibold bg-sky-500/10 backdrop-blur-sm border border-sky-500/20 rounded-lg text-white hover:bg-sky-500/20 transition-colors"
                >
                    Sign In
                </button>
            </div>
        </header>
    );
};


const MockEditor: React.FC = () => {
  return (
    <div className="w-full max-w-4xl mx-auto mt-16 scroll-animate" style={{ transitionDelay: '0.4s' }}>
      <div className="relative bg-slate-900/70 backdrop-blur-sm border border-slate-800 rounded-xl shadow-2xl shadow-sky-500/10 overflow-hidden">
        {/* Header bar */}
        <div className="h-10 bg-slate-800/80 flex items-center px-4">
          <div className="flex space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
        </div>
        
        <div className="grid grid-cols-12 h-[450px]">
          {/* File Explorer */}
          <div className="col-span-4 md:col-span-3 bg-slate-900/50 p-4 border-r border-slate-800 text-sm overflow-y-auto">
            <h3 className="text-xs uppercase text-slate-500 font-semibold tracking-wider mb-4">Explorer</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-400">
                <FolderIcon className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="truncate">src</span>
              </div>
              <div className="pl-4 flex items-center gap-2 text-slate-400">
                <FolderIcon className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="truncate">components</span>
              </div>
              <div className="pl-8 flex items-center gap-2 text-white bg-sky-500/10 rounded py-1 px-2">
                <FileIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">Button.tsx</span>
              </div>
              <div className="pl-4 flex items-center gap-2 text-slate-400">
                <FileIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">App.tsx</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <FileIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">index.html</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
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
                <span className="inline-block w-0.5 h-4 bg-sky-400 animate-blink ml-1 align-[-2px]"></span>
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
        <h2 className="text-3xl sm:text-4xl font-bold text-white scroll-animate">{children}</h2>
        <p className="mt-4 text-slate-400 scroll-animate" style={{ transitionDelay: delay }}>{subtitle}</p>
    </div>
);

const LandingPage: React.FC<LandingPageProps> = ({ onStartBuilding, onSignInClick }) => {
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
    <div className="bg-slate-950 text-white min-h-screen">
      <style>{`
        .aurora-background {
            position: absolute; top: 0; left: 0; right: 0; bottom: 0;
            background-color: #020617;
            overflow: hidden; z-index: 1;
        }
        .aurora-background::before {
            content: ""; position: absolute; top: 50%; left: 50%;
            width: 120vw; height: 120vh;
            background-image:
                radial-gradient(ellipse 50% 80% at 20% 40%, rgba(14, 165, 233, 0.15), transparent),
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
            background-image: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
            background-size: 40px 40px; z-index: 2; opacity: 0.5;
        }
      `}</style>
      
      <div className="relative w-full min-h-screen">
        <div className="aurora-background"></div>
        <div className="grid-pattern-overlay"></div>
        <Header onSignInClick={onSignInClick} />
        
        <main className="relative min-h-screen flex flex-col items-center justify-center text-center p-4 z-10 pt-24 pb-12">
          <div className="relative max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-300 scroll-animate">
              The Autonomous AI Co-Developer That Builds For You.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-slate-400 max-w-3xl mx-auto scroll-animate" style={{ transitionDelay: '0.2s' }}>
              From a single objective to a full-stack application. Our AI plans, codes, and self-corrects in a seamless, autonomous workflow.
            </p>
            <div className="mt-10 max-w-2xl mx-auto scroll-animate" style={{ transitionDelay: '0.3s' }}>
                 <form onSubmit={handleSubmit} className="relative">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe your application idea..."
                        rows={3}
                        className="w-full pl-6 pr-48 py-4 text-lg bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:outline-none transition resize-none"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <select
                            value={provider}
                            onChange={e => setProvider(e.target.value as AiProvider)}
                            className="bg-slate-700/80 border border-slate-600 rounded-md h-10 px-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors hover:bg-slate-700"
                        >
                            <option value="gemini">Gemini</option>
                            <option value="openrouter">OpenRouter</option>
                            <option value="groq">Groq</option>
                        </select>
                        <button type="submit" className="group btn-shine h-10 w-10 inline-flex items-center justify-center bg-gradient-to-r from-sky-500 to-violet-600 text-white font-bold rounded-md overflow-hidden transition-transform duration-300 hover:scale-105 shadow-lg shadow-sky-500/20 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed" disabled={!prompt.trim()}>
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
        <SectionTitle subtitle="ASAI is more than a code generator; it's an autonomous partner that brings your ideas to life while you stay in control.">
            A Smarter Way to Build
        </SectionTitle>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, i) => (
                <div key={feature.title} className="relative p-6 rounded-xl bg-slate-900 overflow-hidden group scroll-animate" style={{ transitionDelay: `${0.3 + i*0.1}s`}}>
                    <div className="absolute -inset-px rounded-xl bg-gradient-to-r from-sky-500 to-violet-500 opacity-0 group-hover:opacity-70 transition-opacity duration-300"/>
                    <div className="relative">
                        <div className="mb-4 text-sky-400"><feature.icon className="w-10 h-10"/></div>
                        <h3 className="font-bold text-lg mb-2 text-white">{feature.title}</h3>
                        <p className="text-slate-400 text-sm">{feature.text}</p>
                    </div>
                </div>
            ))}
        </div>
      </Section>
      
      <Section id="how-it-works" className="bg-slate-900/50">
        <SectionTitle subtitle="Our simple, 4-step process puts you in the driver's seat.">
            How It Works
        </SectionTitle>
        <div className="max-w-3xl mx-auto">
            <div className="relative">
                <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-slate-800 hidden sm:block" aria-hidden="true"/>
                <div className="space-y-12 sm:space-y-16">
                    {steps.map((step, i) => (
                        <div key={step.title} className="flex flex-col sm:flex-row items-start gap-6 scroll-animate" style={{ transitionDelay: `${0.3 + i*0.1}s` }}>
                            <div className="relative z-10 flex items-center justify-center w-16 h-16 rounded-full bg-slate-900 border-2 border-sky-500 text-sky-500 shrink-0">
                                <step.icon className="w-8 h-8"/>
                            </div>
                            <div>
                                <h3 className="font-bold text-xl mb-2 text-white">{step.title}</h3>
                                <p className="text-slate-400">{step.text}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </Section>

      <Section id="use-cases">
        <SectionTitle subtitle="Whether you're shipping a side project or prototyping the next big thing, ASAI is your secret weapon.">
            Built for Modern Builders
        </SectionTitle>
        <div className="max-w-4xl mx-auto">
            <div className="flex justify-center flex-wrap gap-2 md:gap-4 mb-8 border-b border-slate-800 pb-2 scroll-animate" style={{ transitionDelay: `0.3s` }}>
                {Object.keys(useCases).map((uc) => (
                    <button
                        key={uc}
                        onClick={() => setActiveUseCase(uc)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${activeUseCase === uc ? 'bg-sky-500/10 text-sky-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                    >
                        {React.createElement(useCases[uc as keyof typeof useCases].icon, { className: 'w-5 h-5'})}
                        <span>{uc}</span>
                    </button>
                ))}
            </div>
            <div className="relative p-8 bg-slate-900 rounded-xl border border-slate-800 scroll-animate" style={{ transitionDelay: `0.4s` }}>
                <h3 className="font-bold text-xl mb-2 text-white">{useCases[activeUseCase as keyof typeof useCases].title}</h3>
                <p className="text-slate-400">{useCases[activeUseCase as keyof typeof useCases].text}</p>
            </div>
        </div>
      </Section>
      
      <Section className="!py-24">
        <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white scroll-animate" style={{ transitionDelay: '0.2s' }}>Ready to Build Your Next Idea?</h2>
            <p className="mt-4 text-slate-400 max-w-2xl mx-auto scroll-animate" style={{ transitionDelay: '0.3s' }}>Stop wrestling with boilerplate and start creating. Let our autonomous AI co-developer handle the heavy lifting.</p>
            <div className="mt-10 scroll-animate" style={{ transitionDelay: '0.4s' }}>
                <button onClick={onSignInClick} className="group btn-shine relative inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-sky-500 to-violet-600 text-white font-bold text-lg rounded-lg overflow-hidden transition-transform duration-300 hover:scale-105 shadow-lg shadow-sky-500/20">
                    <span className="relative">Sign In & Start Building</span>
                </button>
            </div>
        </div>
      </Section>

      <footer className="py-8 bg-slate-900 border-t border-slate-800">
        <div className="container mx-auto text-center text-slate-400">
           <div className="flex items-center justify-center space-x-3">
             <CodeIcon className="w-7 h-7 text-sky-400"/>
             <span className="text-lg font-bold tracking-wider text-white">ACCS STUDIOS AI</span>
           </div>
           <p className='mt-2'>A Project by Muhammad Adhil K.A</p>
            <div className="flex justify-center space-x-6 my-6">
                <a href="https://github.com/ADIL-KA" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-white transition-colors" aria-label="GitHub">
                    <GithubIcon />
                </a>
            </div>
           <p className="text-sm text-slate-500">© {new Date().getFullYear()} ACCS STUDIOS AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;