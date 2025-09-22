import React, { useState, useRef, useEffect } from 'react';
import { AiChatMessage, AiPlan } from '../types';
import Spinner from './ui/Spinner';
import { UserIcon, AiIcon, FileIcon, DeleteIcon, RobotIcon, CodeIcon, AnalyzeIcon, BrainIcon, RocketIcon, CopyIcon, CheckIcon } from './icons';

interface PlanReviewMessageProps {
    plan: AiPlan;
    status: 'pending' | 'approved' | 'rejected' | 'executing';
    onApprove: () => void;
    onReject: () => void;
}

const CodeBlock: React.FC<{ language: string, code: string }> = ({ language, code }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-base-300 rounded-md my-2 text-base-content code-block">
            <div className="flex items-center justify-between px-3 py-1 bg-base-100/50 rounded-t-md text-xs text-neutral">
                <span>{language || 'code'}</span>
                <button onClick={handleCopy} className="flex items-center gap-1 hover:text-base-content">
                    {copied ? <><CheckIcon className="w-3 h-3 text-green-500" /> Copied!</> : <><CopyIcon className="w-3 h-3" /> Copy</>}
                </button>
            </div>
            <pre className="p-3 text-sm overflow-x-auto font-mono"><code>{code}</code></pre>
        </div>
    );
};

const MarkdownRenderer: React.FC<{ text: string }> = ({ text }) => {
    const renderableParts: (string | React.ReactElement)[] = [];
    
    // Regex to split by code blocks, preserving the delimiters
    const parts = text.split(/(```[\s\S]*?```)/g);

    parts.forEach((part, index) => {
        if (part.startsWith('```')) {
            const codeBlock = part.slice(3, -3);
            const firstLine = codeBlock.indexOf('\n');
            const language = codeBlock.substring(0, firstLine).trim();
            const code = codeBlock.substring(firstLine + 1).trim();
            renderableParts.push(<CodeBlock key={index} language={language} code={code} />);
        } else {
            // Process inline elements for non-code parts
            const inlineParts = part.split(/(`[^`]*`)/g);
            renderableParts.push(
                <span key={index}>
                    {inlineParts.map((inlinePart, j) => {
                        if (inlinePart.startsWith('`') && inlinePart.endsWith('`')) {
                            return <code key={j} className="bg-base-300/70 text-accent font-mono text-xs px-1.5 py-1 rounded-md">{inlinePart.slice(1, -1)}</code>;
                        }
                        return inlinePart;
                    })}
                </span>
            );
        }
    });

    return <div className="whitespace-pre-wrap">{renderableParts}</div>;
};


const PlanReviewMessage: React.FC<PlanReviewMessageProps> = ({ plan, status, onApprove, onReject }) => {
    const renderFileList = (files: string[] | undefined, type: 'create' | 'update' | 'delete') => {
        if (!files || files.length === 0) return null;
        
        const colors = {
            create: 'text-green-400',
            update: 'text-yellow-400',
            delete: 'text-red-400'
        };
        const titles = {
            create: 'Create',
            update: 'Update',
            delete: 'Delete'
        };

        return (
            <div>
                <h4 className={`font-semibold text-sm ${colors[type]}`}>{titles[type]}</h4>
                <ul className="list-none pl-2 mt-1 space-y-1">
                    {files.map(file => (
                        <li key={file} className="text-xs flex items-center gap-2 text-neutral">
                           {type === 'delete' ? <DeleteIcon className="w-3 h-3"/> : <FileIcon className="w-3 h-3"/>}
                           <span className="truncate">{file}</span>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    return (
        <div className="border border-base-300 rounded-lg p-3 mt-2 bg-base-100/30">
            <h3 className="font-bold text-base mb-2 text-base-content">AI's Proposed Plan</h3>
            <p className="text-sm text-neutral mb-3 italic">"{plan.reasoning}"</p>
            
            {plan.thoughts && (
                <div className="mb-3 p-2 border-l-2 border-neutral/50 bg-base-300/20 rounded-r-md">
                    <p className="text-xs font-semibold text-neutral flex items-center gap-1.5"><BrainIcon className="w-4 h-4" /> AI THOUGHTS</p>
                    <p className="text-xs text-neutral/90 italic mt-1">"{plan.thoughts}"</p>
                </div>
            )}

            <div className="space-y-3 mb-4">
                {renderFileList(plan.plan.create, 'create')}
                {renderFileList(plan.plan.update, 'update')}
                {renderFileList(plan.plan.delete, 'delete')}
            </div>
             {status === 'pending' && (
                <div className="flex justify-end gap-2 mt-2">
                    <button onClick={onReject} className="px-3 py-1 bg-base-300/80 hover:bg-base-300 rounded-md text-base-content text-xs font-semibold transition-colors">Reject</button>
                    <button onClick={onApprove} className="px-3 py-1 bg-primary/80 hover:bg-primary rounded-md text-white text-xs font-semibold transition-colors flex items-center gap-1">
                        <RocketIcon className="w-3 h-3"/>Approve & Run
                    </button>
                </div>
            )}
            {status === 'approved' && <p className="text-xs text-green-400 text-right font-semibold">Plan approved. Waiting for execution...</p>}
            {status === 'rejected' && <p className="text-xs text-red-400 text-right font-semibold">Plan rejected.</p>}
            {status === 'executing' && (
                 <div className="flex items-center justify-end gap-2 text-xs text-blue-400 font-semibold">
                    <Spinner size="sm" />
                    <span>Executing plan...</span>
                </div>
            )}
        </div>
    )
}

const AgentStatusMessage: React.FC<{ message: AiChatMessage }> = ({ message }) => {
    const stateInfo = {
        planning: { icon: CodeIcon, color: 'text-blue-400', title: 'Planning' },
        executing: { icon: CodeIcon, color: 'text-blue-400', title: 'Executing Task' },
        analyzing: { icon: AnalyzeIcon, color: 'text-yellow-400', title: 'Analyzing Work' },
        'self-correcting': { icon: RobotIcon, color: 'text-orange-400', title: 'Self-Correcting' },
        finished: { icon: RobotIcon, color: 'text-green-400', title: 'Finished' },
        error: { icon: RobotIcon, color: 'text-red-400', title: 'Error' },
    };

    const info = stateInfo[message.agentState || 'executing'];
    
    return (
        <div className="text-sm">
            <div className={`flex items-center gap-2 font-bold mb-2 text-base ${info.color}`}>
                <info.icon className="w-5 h-5"/>
                <h3>{info.title}</h3>
            </div>
            {message.currentTask && <p className="text-xs text-neutral mb-2"><strong>Task:</strong> {message.currentTask}</p>}
            
            <p className="text-base-content/90 whitespace-pre-wrap">{message.text}</p>
            
            {message.thoughts && (
                <div className="mt-3 pt-2 border-t border-base-300/50">
                    <p className="text-xs font-semibold text-neutral flex items-center gap-1.5"><BrainIcon className="w-4 h-4" /> AI THOUGHTS</p>
                    <p className="text-xs text-neutral/90 italic mt-1">"{message.thoughts}"</p>
                </div>
            )}
        </div>
    );
};


interface ChatInterfaceProps {
    messages: AiChatMessage[];
    onSendMessage: (message: string, mode: 'build' | 'ask') => void;
    isLoading: boolean;
    onApprovePlan: (messageId: string) => void;
    onRejectPlan: (messageId: string) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, isLoading, onApprovePlan, onRejectPlan }) => {
    const [input, setInput] = useState('');
    const [mode, setMode] = useState<'build' | 'ask'>('build');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);
    
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${scrollHeight}px`;
        }
    }, [input]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isLoading) {
            onSendMessage(input.trim(), mode);
            setInput('');
        }
    };
    
    const ModeButton: React.FC<{ value: 'build' | 'ask', children: React.ReactNode }> = ({ value, children }) => (
        <button
            type="button"
            onClick={() => setMode(value)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${mode === value ? 'bg-primary text-white' : 'bg-base-200 text-neutral hover:bg-base-300'}`}
        >
            {children}
        </button>
    );

    const renderMessageContent = (msg: AiChatMessage) => {
        if (msg.isAgentMessage) {
            return <AgentStatusMessage message={msg} />;
        }
        return (
            <>
                <MarkdownRenderer text={msg.text} />
                {msg.plan && msg.planStatus && (
                    <PlanReviewMessage 
                        plan={msg.plan}
                        status={msg.planStatus}
                        onApprove={() => onApprovePlan(msg.id)}
                        onReject={() => onRejectPlan(msg.id)}
                    />
                )}
                {msg.isLoading && (
                    <div className="flex items-center gap-2 text-xs text-neutral pt-2">
                        <Spinner size="sm" />
                        <span>Thinking...</span>
                    </div>
                )}
            </>
        );
    };

    return (
        <div className="h-full bg-base-100 flex flex-col">
            <div className="p-3 mb-2 border-b border-base-300">
                <h3 className="text-sm font-semibold tracking-wider uppercase text-base-content">Chat</h3>
            </div>
            <div className="flex-grow overflow-y-auto p-4 space-y-8">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex items-start gap-4 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                         <div className={`w-10 h-10 mt-1 rounded-full flex items-center justify-center shrink-0 text-white ${
                            msg.sender === 'user' ? 'bg-primary' : (msg.isAgentMessage ? 'bg-secondary' : 'bg-accent')
                         }`}>
                            {msg.sender === 'user' ? <UserIcon className="w-5 h-5" /> : (msg.isAgentMessage ? <RobotIcon className="w-5 h-5" /> : <AiIcon className="w-5 h-5" />)}
                        </div>
                        <div className={`w-full max-w-lg lg:max-w-xl rounded-lg text-sm shadow-md px-4 py-3 ${
                           msg.sender === 'user' ? 'bg-primary text-white' : 'bg-base-200 text-base-content'
                        }`}>
                           {renderMessageContent(msg)}
                        </div>
                    </div>
                ))}
                {isLoading && messages.every(m => !m.isLoading) && (
                    <div className="flex items-start gap-4 flex-row">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-accent text-white">
                            <AiIcon className="w-5 h-5" />
                        </div>
                        <div className="bg-base-200 rounded-lg px-4 py-3 text-sm shadow-md">
                            <Spinner size="sm" />
                        </div>
                    </div>
                )}
                 <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSend} className="p-2 border-t border-base-300">
                 <div className="flex items-center gap-2 mb-2 px-1">
                    <ModeButton value="build">Build</ModeButton>
                    <ModeButton value="ask">Ask</ModeButton>
                </div>
                <div className="relative">
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend(e);
                            }
                        }}
                        placeholder={mode === 'build' ? "Describe a change or new feature..." : "Ask a question about your project..."}
                        className="w-full bg-base-200 border border-base-300/80 rounded-md py-2 pl-3 pr-10 text-base-content focus:outline-none focus:ring-2 focus:ring-primary resize-none max-h-40"
                        disabled={isLoading}
                    />
                    <button type="submit" disabled={isLoading || !input.trim()} className="absolute bottom-2 right-0 flex items-center justify-center px-3 text-primary hover:opacity-80 disabled:text-neutral/50 disabled:cursor-not-allowed">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path></svg>
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ChatInterface;