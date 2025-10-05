import React from 'react';
import { ArrowLeftIcon, CodeIcon, KeyIcon, PlayIcon, CommandLineIcon, ChatBubbleIcon, RobotIcon, WrenchScrewdriverIcon, AnalyzeIcon, UsersIcon, MagicWandIcon, SettingsIcon, RocketIcon, FileIcon, BrainIcon, SaveIcon, CrownIcon, DatabaseIcon, ChecklistIcon, UploadIcon } from '../components/icons';

interface DocumentationPageProps {
    onBack: () => void;
    onSignInClick: () => void;
}

const Section: React.FC<{ id: string; title: string; children: React.ReactNode }> = ({ id, title, children }) => (
    <section id={id} className="mb-12 py-4 border-b border-base-300 last:border-b-0">
        <h2 className="text-3xl font-bold text-primary mb-4 pt-20 -mt-20">{title}</h2>
        <div className="prose prose-invert max-w-none text-base-content/90">
            {children}
        </div>
        <style>{`
            .prose h3 { font-size: 1.5rem; font-weight: 600; color: var(--color-base-content); margin-top: 2em; border-bottom: 1px solid var(--color-base-300); padding-bottom: 0.3em; margin-bottom: 1em; }
            .prose h4 { font-size: 1.1rem; font-weight: 600; color: var(--color-neutral); margin-top: 1.5em; }
            .prose p { margin-top: 0.75em; line-height: 1.7; }
            .prose ul { list-style-type: disc; margin-left: 1.5em; margin-top: 0.75em; }
            .prose li { margin-top: 0.5em; }
            .prose code { background-color: var(--color-base-300); color: var(--color-accent); padding: 0.2em 0.4em; border-radius: 0.25rem; font-size: 0.9em; }
            .prose a { color: var(--color-primary); text-decoration: none; }
            .prose a:hover { text-decoration: underline; }
        `}</style>
    </section>
);

const NavLink: React.FC<{ href: string, children: React.ReactNode }> = ({ href, children }) => (
    <a href={href} className="block text-sm text-neutral hover:text-primary hover:translate-x-1 transition-transform duration-200 py-1">{children}</a>
);

const features = [
  { icon: RobotIcon, title: 'Autonomous Development', text: "Give the AI a high-level objective and watch it plan, code, analyze, and self-correct to complete the task." },
  { icon: CrownIcon, title: 'God Mode', text: "Unleash a trio of AI agents that can control the UI—clicking buttons and typing text—to fulfill complex requests." },
  { icon: UsersIcon, title: 'Real-time Collaboration', text: "Bring your own server to code with your team in real-time. See live edits, chat, and file changes in a secure, self-hosted environment." },
  { icon: ChatBubbleIcon, title: 'Rich Team Chat', text: "Go beyond code. Mention teammates, pin files, generate snippets with /snippet, and manage tasks with /task." },
  { icon: SaveIcon, title: 'Project Snapshots', text: "Experiment without fear. Create a version snapshot of your project at any point and revert back instantly (requires collaboration setup)." },
  { icon: PlayIcon, title: 'Live Sandbox Preview', text: "Instantly preview your application in a live, interactive StackBlitz environment right inside the editor." },
  { icon: BrainIcon, title: 'Multi-Provider AI Core', text: "Choose the best AI for the job. Seamlessly switch between Gemini, Groq, and a wide range of models via OpenRouter." },
  { icon: WrenchScrewdriverIcon, title: 'AI Debug & Refactor', text: "Describe a bug or issue, and let the AI analyze your code, propose a working fix, and apply it with your approval." },
  { icon: MagicWandIcon, title: 'AI Rebranding Studio', text: "Instantly generate and apply a new visual identity (logo, color palette, background) to the ASAI editor itself." },
];


const DocumentationPage: React.FC<DocumentationPageProps> = ({ onBack, onSignInClick }) => {
    return (
        <div className="min-h-screen bg-base-100 text-base-content">
            <header className="sticky top-0 bg-base-200/80 backdrop-blur-md z-40 border-b border-base-300">
                <div className="max-w-7xl mx-auto p-4 flex justify-between items-center">
                    <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-neutral hover:text-base-content">
                        <ArrowLeftIcon className="w-5 h-5"/> Back to Home
                    </button>
                    <div className="flex items-center gap-3">
                           <CodeIcon className="w-6 h-6 text-primary"/>
                           <h1 className="text-xl font-bold text-base-content">ASAI Documentation</h1>
                        </div>
                     <button 
                        onClick={onSignInClick} 
                        className="px-4 py-2 text-sm font-semibold bg-primary hover:opacity-90 rounded-lg text-white transition-colors"
                    >
                        Sign In
                    </button>
                </div>
            </header>
            <div className="max-w-7xl mx-auto p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
                <aside className="hidden lg:block lg:col-span-2 md:sticky md:top-24 h-fit">
                    <h3 className="font-semibold text-base-content mb-3">On this page</h3>
                    <nav className="space-y-1">
                        <NavLink href="#intro">Introduction</NavLink>
                        <NavLink href="#feature-overview">Feature Overview</NavLink>
                        <NavLink href="#getting-started">Getting Started</NavLink>
                        <NavLink href="#editor">The Editor Interface</NavLink>
                        <NavLink href="#ai-features">Core AI Features</NavLink>
                        <NavLink href="#collaboration">Collaboration & Chat</NavLink>
                        <NavLink href="#management">Project Management</NavLink>
                        <NavLink href="#admin">For Administrators</NavLink>
                    </nav>
                </aside>
                <main className="lg:col-span-10">
                    <Section id="intro" title="Introduction">
                        <p>Welcome to ASAI, an AI-powered application builder that transforms your ideas into functional web applications. ASAI acts as an autonomous co-developer, handling the entire development lifecycle from planning and coding to analysis and self-correction. Whether you're a developer looking to eliminate boilerplate, an entrepreneur building an MVP, or a designer creating interactive prototypes, ASAI accelerates your workflow while keeping you in complete control.</p>
                    </Section>

                    <Section id="feature-overview" title="Feature Overview">
                        <p className="text-center -mt-8 mb-12 text-neutral">ASAI is a comprehensive suite of tools designed for modern development. Here's a quick look at the key features available.</p>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 not-prose">
                            {features.map((feature, i) => (
                                <div key={feature.title} className="p-6 rounded-xl bg-base-200 border border-base-300">
                                    <div className="relative">
                                        <div className="mb-4 text-accent"><feature.icon className="w-8 h-8"/></div>
                                        <h3 className="font-bold text-lg mb-2 text-base-content">{feature.title}</h3>
                                        <p className="text-neutral text-sm">{feature.text}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Section>
                    
                    <Section id="getting-started" title="Getting Started">
                        <h3>1. Sign Up & Daily Tokens</h3>
                        <p>Create an account to save your projects and securely store your API keys. Upon signing up, you'll receive a generous token balance, which is automatically refilled with a daily allowance (configurable by platform admins). This ensures you can keep building and experimenting every day.</p>
                        
                        <h3>2. API Keys</h3>
                        <p>ASAI integrates with multiple AI providers to give you flexibility. You'll need to add your own API keys to start building. Your keys are stored securely in your user profile and only used to make requests on your behalf.</p>
                        <ul>
                            <li><KeyIcon className="w-4 h-4 inline-block mr-2"/><strong>Gemini:</strong> For general development tasks and rebranding. Get a key from Google AI Studio.</li>
                            <li><KeyIcon className="w-4 h-4 inline-block mr-2"/><strong>OpenRouter/Groq:</strong> For access to a wide variety of open-source models, including high-speed options from Groq.</li>
                        </ul>
                        <p>If the administrator has enabled the <strong>API Key Pool</strong>, you may be able to use the platform without your own keys.</p>
                        
                         <h3>3. Create Your First Project</h3>
                        <p>From the dashboard, describe the application you want to build in the "Start a New Project" section. Select your preferred AI provider and model, then click "Start Building". The AI will generate a complete, ready-to-run project based on your prompt.</p>

                        <h3><UploadIcon className="w-4 h-4 inline-block mr-2"/>Importing an Existing Project</h3>
                        <p>You can bring your existing codebase into ASAI to leverage its powerful AI capabilities for refactoring, debugging, and adding new features. On the dashboard, switch to the <strong>Upload Project</strong> tab.</p>
                        <ul>
                            <li>Provide a name for your project in the ASAI environment.</li>
                            <li>Drag and drop your project folder, individual files, or a <code>.zip</code> archive into the upload area.</li>
                            <li>Alternatively, you can use the "Select Files" or "Select Folder" buttons.</li>
                            <li>Choose an AI provider that will be used for future modifications to this project.</li>
                            <li>Click "Create Project". Your files will be uploaded, and a new workspace will be created for you.</li>
                        </ul>
                    </Section>

                    <Section id="editor" title="The Editor Interface">
                         <h3><ChatBubbleIcon className="w-4 h-4 inline-block mr-2"/>The AI Chat</h3>
                        <p>The chat is your primary interface for interacting with the AI. It features three distinct modes:</p>
                        <ul>
                            <li><strong>Build Mode:</strong> Request new features, make changes, or refactor code. The AI will propose a plan for your approval.</li>
                            <li><strong>Ask Project Mode:</strong> Ask questions specifically about your project's codebase without modifying any files.</li>
                            <li><strong>Ask General Mode:</strong> Have a general conversation with the AI for brainstorming, asking for documentation, or any other non-project-related queries.</li>
                        </ul>
                        
                         <h3><PlayIcon className="w-4 h-4 inline-block mr-2"/>Live Preview & Sandbox</h3>
                        <p>ASAI uses a powerful in-browser virtual machine from <strong>StackBlitz</strong> to provide an instant, interactive preview of your application. It runs a real development server, so you see your changes live as the AI makes them.</p>

                         <h3><CommandLineIcon className="w-4 h-4 inline-block mr-2"/>Console & Simulated Terminal</h3>
                        <p>The bottom panel gives you essential tools. The <strong>Console</strong> displays logs (<code>console.log</code>, errors, etc.) from your live preview. The <strong>Terminal</strong> (coming soon) will provide a simulated command-line interface where you can run commands like <code>npm install</code>.</p>

                        <h3><ChecklistIcon className="w-4 h-4 inline-block mr-2"/>To-Do List Panel</h3>
                        <p>Manage project tasks directly from the sidebar. The To-Do list is populated by tasks you create in the chat using the <code>/task</code> command, keeping your objectives organized and in view.</p>
                    </Section>

                    <Section id="ai-features" title="Core AI Features">
                         <h3><RobotIcon className="w-4 h-4 inline-block mr-2"/>Autonomous "Auto-Dev" Mode</h3>
                        <p>For complex tasks, activate Auto-Dev mode. Give the AI a high-level objective (e.g., "implement user authentication"), and watch it work. The modal provides a real-time view of the AI's plan, current task, internal thoughts, and action log as it codes, analyzes, and self-corrects to complete the objective.</p>

                        <h3><CrownIcon className="w-4 h-4 inline-block mr-2"/>God Mode</h3>
                        <p>An advanced form of autonomous operation where the AI takes direct control of the ASAI user interface. It can click buttons, type into fields, and navigate the editor just like a human would, in addition to modifying files. This mode uses a specialized trio of AI agents (Architect, Coder, Reviewer) to achieve its goals with high precision.</p>

                         <h3><WrenchScrewdriverIcon className="w-4 h-4 inline-block mr-2"/>Debugging & Refactoring</h3>
                        <p>Encounter a bug? Open the Debug & Refactor modal, describe the problem, and the AI will analyze the relevant code, propose a working fix, and apply it with one click.</p>

                        <h3><AnalyzeIcon className="w-4 h-4 inline-block mr-2"/>Code Analysis</h3>
                        <p>Click the "Analyze Project" button in the header to get a comprehensive review of your entire codebase for bugs, performance issues, and best-practice recommendations.</p>
                    </Section>

                    <Section id="collaboration" title="Collaboration & Chat">
                        <p>ASAI is built from the ground up for teamwork. Go beyond solo code generation and create in a fully collaborative environment, powered by your own secure backend.</p>
                        
                        <h3><DatabaseIcon className="w-5 h-5 inline-block mr-2"/>Enabling Real-Time Collaboration (BYOS)</h3>
                        <p>To unlock true real-time features, the project owner must connect a personal Firebase project—a "Bring Your Own Server" model. This self-hosting approach ensures your data remains private and under your control. Once configured in <strong>Project Settings</strong>, this enables:</p>
                        <ul>
                            <li>Live, synchronized code editing for all project members.</li>
                            <li>Instant updates to the file explorer and preview for everyone.</li>
                            <li>A shared, real-time chat history.</li>
                            <li>The ability to create and restore project-wide snapshots.</li>
                        </ul>

                        <h3><ChatBubbleIcon className="w-5 h-5 inline-block mr-2"/>Feature-Rich Team Chat</h3>
                        <p>The integrated chat is designed for developer workflows, allowing for seamless communication without leaving the editor.</p>
                        <h4>@mentions</h4>
                        <p>Notify a team member directly by typing <code>@</code> followed by their name. They will receive a notification (feature coming soon) and the message will be highlighted for them.</p>

                        <h4><FileIcon className="w-4 h-4 inline-block mr-2"/>File Pinning</h4>
                        <p>When discussing specific parts of the codebase, the AI or other users can pin a file to a chat message. This creates a direct, clickable link to that file, allowing team members to quickly jump to the relevant context.</p>

                        <h4><CodeIcon className="w-4 h-4 inline-block mr-2"/>AI Code Snippets</h4>
                        <p>Quickly generate and share code without affecting the project files. Use the <code>/snippet</code> command to ask the AI for a piece of code, which will be posted directly in the chat.</p>
                        <p>Example: <code>/snippet create a custom React hook for debouncing input</code></p>

                        <h4><ChecklistIcon className="w-4 h-4 inline-block mr-2"/>Tasks & To-Do List</h4>
                        <p>Create and manage a project to-do list directly from the chat. Use the <code>/task</code> command to add a new item, which will appear in the "To-Do" sidebar panel.</p>
                        <p>Example: <code>/task Refactor the authentication flow</code></p>
                    </Section>

                    <Section id="management" title="Project Management">
                        <h3><RocketIcon className="w-4 h-4 inline-block mr-2"/>Deployment</h3>
                        <p>When you're ready to share your work, use the Deploy button. You can instantly deploy your entire project to <strong>CodeSandbox</strong> for a shareable, live version. Support for other providers like Netlify is coming soon.</p>
                        <h3><UsersIcon className="w-4 h-4 inline-block mr-2"/>Sharing & Collaboration</h3>
                        <p>Invite others to collaborate on your project by generating a single-use share key (for non-real-time joining) or an email-based invite code (for real-time collaboration).</p>
                        
                        <h3><MagicWandIcon className="w-4 h-4 inline-block mr-2"/>AI Rebranding Studio</h3>
                        <p>Instantly change the entire look and feel of the ASAI editor itself. Provide a theme (e.g., "oceanic deep sea"), and the AI will generate a unique logo, color palette, and background image and apply it to your workspace.</p>
                    </Section>

                    <Section id="admin" title="For Administrators">
                         <h3><SettingsIcon className="w-4 h-4 inline-block mr-2"/>Admin Panel</h3>
                        <p>The admin panel provides a platform-wide overview, user management tools, and global configuration options.</p>
                        <ul>
                            <li><strong>Dashboard:</strong> View key metrics like total users and projects.</li>
                            <li><strong>Users:</strong> See a list of all registered users and manage their token balances.</li>
                            <li><strong>Settings:</strong> Configure platform-wide settings, including the API Key Pool and the daily token reward for users.</li>
                             <li><strong>Errors:</strong> View a log of platform-level errors to monitor application health.</li>
                        </ul>
                         <h3>API Key Pooling</h3>
                        <p>Admins can enable API key pooling to provide access for users who may not have their own keys. When enabled, the system will use a key from the shared pool as a fallback, allowing for seamless onboarding and usage across a team or organization.</p>
                    </Section>
                    <p className="mt-16 text-center text-xs text-neutral">ACCS STUDIOS AI (ASAI) was built by ACCS STUDIOS a project of Muhammad Adhil K.A</p>
                    <p className="mt-4 text-center text-xs text-neutral">
                        Contact: <a href="mailto:muhammedadhil856@gmail.com" className="text-primary hover:underline">muhammedadhil856@gmail.com</a> | <a href="mailto:cloudfireinternational@gmail.com" className="text-primary hover:underline">cloudfireinternational@gmail.com</a>
                    </p>
                </main>
            </div>
        </div>
    );
};

export default DocumentationPage;
