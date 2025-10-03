import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { AiChatMessage, AiPlan, ChatMessageSenderInfo, FileNode, Project, ApiConfig, ApiPoolConfig, ApiPoolKey, User } from '../types';
import { UserIcon, AiIcon, FileIcon, DeleteIcon, RobotIcon, CodeIcon, AnalyzeIcon, BrainIcon, RocketIcon, CopyIcon, CheckIcon, UsersIcon } from './icons';
import { generateCodeSnippet } from '../services/aiService';
import Spinner from './ui/Spinner';

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
        <div className="bg-base-100 rounded-md my-2 text-base-content code-block border border-base-300">
            <div className="flex items-center justify-between px-3 py-1 bg-base-200/50 rounded-t-md text-xs text-neutral">
                <span>{language || 'code'}</span>
                <button onClick={handleCopy} className="flex items-center gap-1 hover:text-base-content">
                    {copied ? <><CheckIcon className="w-3 h-3 text-green-500" /> Copied!</> : <><CopyIcon className="w-3 h-3" /> Copy</>}
                </button>
            </div>
            <pre className="p-3 text-sm overflow-x-auto font-mono"><code>{code}</code></pre>
        </div>
    );
};

const MarkdownRenderer: React.FC<{ text: string, members: ChatMessageSenderInfo[] }> = ({ text, members }) => {
    const memberMap = new Map(members.map(m => [m.uid, m.displayName]));

    const parts = text
        .split(/(```[\s\S]*?```|@\[.*?\]\(.*?\))/g) // Split by code blocks and mentions
        .map((part, i) => {
            if (!part) return null;

            // Handle code blocks
            if (part.startsWith('```')) {
                const codeBlock = part.slice(3, -3);
                const firstLineEnd = codeBlock.indexOf('\n');
                const language = codeBlock.substring(0, firstLineEnd).trim();
                const code = codeBlock.substring(firstLineEnd + 1).trim();
                return <CodeBlock key={i} language={language} code={code} />;
            }
            
            // Handle mentions
            const mentionMatch = part.match(/@\[(.*?)\]\((.*?)\)/);
            if (mentionMatch) {
                const name = mentionMatch[1];
                return <span key={i} className="bg-primary/20 text-primary font-semibold px-1 rounded-sm">@{name}</span>;
            }

            // Process other markdown
            return part
                .split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g) // Split by bold, inline code, italics
                .map((segment, index) => {
                    if (segment.startsWith('**') && segment.endsWith('**')) {
                        return <strong key={index}>{segment.slice(2, -2)}</strong>;
                    }
                    if (segment.startsWith('*') && segment.endsWith('*')) {
                        return <em key={index}>{segment.slice(1, -1)}</em>;
                    }
                    if (segment.startsWith('`') && segment.endsWith('`')) {
                        return <code key={index} className="bg-base-300/70 text-accent font-mono text-xs px-1.5 py-0.5 rounded-md">{segment.slice(1, -1)}</code>;
                    }
                    if (/^\s*[*+-]\s/.test(segment)) {
                        const listItems = segment.trim().split(/\n\s*[*+-]\s/).map((item, j) => {
                            if (!item.trim()) return null;
                            const text = j === 0 ? item.replace(/^\s*[*+-]\s/, '') : item;
                            return <li key={j}>{text}</li>;
                        }).filter(Boolean);
                        return <ul key={index} className="list-disc list-inside space-y-1 my-2">{listItems}</ul>;
                    }
                    return segment;
                });
        });

    return <div className="whitespace-pre-wrap leading-relaxed">{parts.filter(Boolean)}</div>;
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
                    <div className="typing-indicator"><div/><div/><div/></div>
                    <span>Executing plan...</span>
                </div>
            )}
        </div>
    )
}

const AgentStatusMessage: React.FC<{ message: AiChatMessage, members: ChatMessageSenderInfo[] }> = ({ message, members }) => {
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
            
            <MarkdownRenderer text={message.text} members={members} />
            
            {message.thoughts && (
                <div className="mt-3 pt-2 border-t border-base-300/50">
                    <p className="text-xs font-semibold text-neutral flex items-center gap-1.5"><BrainIcon className="w-4 h-4" /> AI THOUGHTS</p>
                    <p className="text-xs text-neutral/90 italic mt-1">"{message.thoughts}"</p>
                </div>
            )}
        </div>
    );
};

// --- New Rich Message Components ---

const FilePinMessage: React.FC<{ filePath: string; onOpenFile: (path: string) => void }> = ({ filePath, onOpenFile }) => (
    <button onClick={() => onOpenFile(filePath)} className="flex items-center gap-2 p-2 bg-base-100/50 hover:bg-base-300 rounded-md w-full text-left">
        <FileIcon className="w-5 h-5 text-neutral shrink-0" />
        <div>
            <p className="text-xs text-neutral">File Pinned</p>
            <p className="font-semibold text-base-content truncate">{filePath}</p>
        </div>
    </button>
);

const CodeSnippetMessage: React.FC<{ code: string; language: string; text: string; members: ChatMessageSenderInfo[] }> = ({ code, language, text, members }) => (
    <div>
        <MarkdownRenderer text={text} members={members} />
        <div className="text-xs text-neutral my-2 font-semibold">Generated Snippet:</div>
        <CodeBlock language={language} code={code} />
    </div>
);

const TaskMessage: React.FC<{ message: AiChatMessage; onToggle: (isComplete: boolean) => void;}> = ({ message, onToggle }) => (
    <div className="flex items-start gap-3 p-2 bg-base-100/50 rounded-md">
      <input
        type="checkbox"
        checked={!!message.isComplete}
        onChange={(e) => onToggle(e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
      />
      <div>
        <p className={`text-sm ${message.isComplete ? 'line-through text-neutral' : 'text-base-content'}`}>
          {message.taskText}
        </p>
        <p className="text-xs text-neutral/80 mt-1">
            Task created by {message.senderInfo?.displayName || 'user'}
        </p>
      </div>
    </div>
);

interface ChatInterfaceProps {
    messages: AiChatMessage[];
    onSendMessage: (message: string, mode: 'build' | 'ask' | 'general') => void;
    isLoading: boolean;
    onApprovePlan: (messageId: string) => void;
    onRejectPlan: (messageId: string) => void;
    // New props for collaboration
    projectMembers: ChatMessageSenderInfo[];
    currentUser: User;
    isOwner: boolean;
    files: FileNode[];
    project: Project | null;
    apiConfig: ApiConfig;
    apiPoolConfig: ApiPoolConfig;
    apiPoolKeys: ApiPoolKey[];
    currentUserId: string;
    onSendRichMessage: (messageData: Partial<Omit<AiChatMessage, 'id' | 'timestamp' | 'sender'>>) => void;
    onDeleteMessage: (messageId: string) => void;
    onOpenFileFromPin: (filePath: string) => void;
    onUpdateTaskStatus: (messageId: string, isComplete: boolean) => void;
    chatMessageRefs?: React.MutableRefObject<Map<string, HTMLDivElement | null>>;
}

const ChatInterface: React.FC<ChatInterfaceProps> = (props) => {
    const { messages, onSendMessage, isLoading, onApprovePlan, onRejectPlan, projectMembers, currentUser, isOwner, files, project, apiConfig, apiPoolConfig, apiPoolKeys, onSendRichMessage, onDeleteMessage, onOpenFileFromPin, onUpdateTaskStatus, chatMessageRefs } = props;
    const [input, setInput] = useState('');
    const [mode, setMode] = useState<'build' | 'ask' | 'general'>('build');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [mentionQuery, setMentionQuery] = useState('');
    const [showMentionPopup, setShowMentionPopup] = useState(false);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    };

    useLayoutEffect(scrollToBottom, [messages]);
    
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
            const text = input.trim();

            if (text.startsWith('/snippet ')) {
                const prompt = text.substring(9);
                setInput('');
                
                // Fire-and-forget async function to handle snippet generation
                (async () => {
                    const senderInfo: ChatMessageSenderInfo = {
                        uid: currentUser.uid, displayName: currentUser.displayName || currentUser.email || null, photoURL: currentUser.photoURL || null,
                    };
                    onSendRichMessage({ senderInfo, type: 'text', text: `Generating snippet for: \`${prompt}\`...` });
                    
                    try {
                        if (!project) throw new Error("Project context not available.");
                        const code = await generateCodeSnippet(prompt, project, apiConfig, currentUser.uid, apiPoolConfig, apiPoolKeys);
                        onSendRichMessage({ senderInfo, type: 'code_snippet', text: `Here's a snippet for \`${prompt}\`...`, code: code, language: '' });
                    } catch (err) {
                        const message = err instanceof Error ? err.message : "An unknown error occurred.";
                        onSendRichMessage({ senderInfo, type: 'text', text: `Sorry, snippet generation failed: ${message}` });
                    }
                })();
                return;
            }
            
            if (text.startsWith('/task ')) {
                const taskText = text.substring(6);
                onSendRichMessage({
                    type: 'task',
                    text: `New task created: "${taskText}"`,
                    taskText: taskText,
                    isComplete: false,
                });
                setInput('');
                return;
            }

            if (isCollaborationEnabled()) {
                const mentionedUsers = projectMembers.filter(m => text.includes(`@[${m.displayName}](${m.uid})`));
                onSendRichMessage({ type: 'text', text: text, mentions: mentionedUsers.map(m => m.uid) });
            } else {
                onSendMessage(text, mode);
            }
            setInput('');
        }
    };
    
    const isCollaborationEnabled = () => project?.members.length > 1;

    const placeholders = {
        build: "Describe a change or type /snippet, /task...",
        ask: "Ask a question about your project...",
        general: "Ask me anything...",
    }

    const handleMentionSelect = (member: ChatMessageSenderInfo) => {
        const atIndex = input.lastIndexOf('@');
        const newText = `${input.substring(0, atIndex)}@[${member.displayName}](${member.uid}) `;
        setInput(newText);
        setShowMentionPopup(false);
        textareaRef.current?.focus();
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        setInput(text);
        const atIndex = text.lastIndexOf('@');
        if (atIndex !== -1 && text.substring(atIndex + 1).match(/^[a-zA-Z0-9_]*$/)) {
             setMentionQuery(text.substring(atIndex + 1));
             setShowMentionPopup(true);
        } else {
             setShowMentionPopup(false);
        }
    };

    const filteredMembers = projectMembers.filter(m =>
        m.uid !== currentUser.uid &&
        m.displayName?.toLowerCase().includes(mentionQuery.toLowerCase())
    );

    const renderMessageContent = (msg: AiChatMessage) => {
        if (msg.isDeleted) {
            return <p className="italic text-neutral/70">{msg.text}</p>
        }
        
        switch (msg.type) {
            case 'file_pin':
                return msg.filePath ? <FilePinMessage filePath={msg.filePath} onOpenFile={onOpenFileFromPin} /> : <MarkdownRenderer text={msg.text} members={projectMembers} />;
            case 'code_snippet':
                return msg.code ? <CodeSnippetMessage code={msg.code} language={msg.language || ''} text={msg.text} members={projectMembers} /> : <MarkdownRenderer text={msg.text} members={projectMembers} />;
            case 'task':
                return <TaskMessage message={msg} onToggle={(isComplete) => onUpdateTaskStatus(msg.id, isComplete)} />;
            default: // 'text' and undefined
                if (msg.isAgentMessage) {
                    return <AgentStatusMessage message={msg} members={projectMembers}/>;
                }
                return (
                    <>
                        <MarkdownRenderer text={msg.text} members={projectMembers} />
                        {msg.plan && msg.planStatus && (
                            <PlanReviewMessage 
                                plan={msg.plan}
                                status={msg.planStatus}
                                onApprove={() => onApprovePlan(msg.id)}
                                onReject={() => onRejectPlan(msg.id)}
                            />
                        )}
                        {msg.isLoading && (
                            <div className="flex items-center gap-2 pt-2">
                               <div className="typing-indicator"><div/><div/><div/></div>
                            </div>
                        )}
                    </>
                );
        }
    };

    const senderFor = (msg: AiChatMessage) => {
      if (msg.sender === 'ai') return 'ai';
      return msg.senderInfo?.uid || 'user_fallback';
    }

    return (
        <div className="h-full bg-base-100 flex flex-col">
            <div className="p-3 mb-2 border-b border-base-300">
                <div className="flex items-center gap-2">
                    {isCollaborationEnabled() ? <UsersIcon className="w-5 h-5 text-secondary" /> : <AiIcon className="w-5 h-5 text-accent" />}
                    <h3 className="text-sm font-semibold tracking-wider uppercase text-base-content">
                        {isCollaborationEnabled() ? "Team Chat" : "AI Chat"}
                    </h3>
                </div>
            </div>
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
                {messages.map((msg, index) => {
                    const prevMsg = messages[index - 1];
                    const showHeader = !prevMsg || senderFor(prevMsg) !== senderFor(msg) || msg.sender === 'ai';
                    
                    return (
// FIX: The ref callback should not return a value. Encapsulating the map 'set' operation in a block statement ensures it returns undefined.
                        <div ref={el => { chatMessageRefs?.current.set(msg.id, el); }} key={msg.id} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.sender === 'ai' && (
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white ${msg.isAgentMessage ? 'bg-secondary' : 'bg-accent'}`}>
                                {msg.isAgentMessage ? <RobotIcon className="w-5 h-5" /> : <AiIcon className="w-5 h-5" />}
                              </div>
                            )}
                            <div className={`w-auto max-w-lg lg:max-w-xl group relative ${msg.sender === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                               {showHeader && msg.sender === 'user' && msg.senderInfo && (
                                   <p className="text-xs text-neutral mb-1 pr-10">{msg.senderInfo.displayName}</p>
                               )}
                               {showHeader && msg.sender === 'ai' && (
                                   <p className="text-xs text-neutral mb-1 pl-1">ASAI</p>
                               )}

                                <div className={`rounded-lg text-sm shadow-md px-4 py-3 ${
                                   msg.sender === 'user' ? 'bg-primary text-white rounded-br-none' : 'bg-base-200 text-base-content rounded-bl-none'
                                }`}>
                                   {renderMessageContent(msg)}
                                </div>
                                {isOwner && msg.sender === 'user' && !msg.isDeleted && (
                                    <button onClick={() => onDeleteMessage(msg.id)} className="absolute top-0 right-0 p-1 bg-base-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" title="Delete message">
                                        <DeleteIcon className="w-3 h-3 text-red-400" />
                                    </button>
                                )}
                            </div>
                             {msg.sender === 'user' && msg.senderInfo && (
                               <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-base-300 text-base-content overflow-hidden">
                                {msg.senderInfo.photoURL ? <img src={msg.senderInfo.photoURL} alt={msg.senderInfo.displayName || ''} className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5" />}
                              </div>
                            )}
                        </div>
                    )
                })}
                {isLoading && messages.every(m => !m.isLoading) && (
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-accent text-white">
                            <AiIcon className="w-5 h-5" />
                        </div>
                        <div className="bg-base-200 rounded-lg px-4 py-3 text-sm shadow-md rounded-bl-none">
                            <div className="typing-indicator"><div/><div/><div/></div>
                        </div>
                    </div>
                )}
                 <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSend} className="p-2 border-t border-base-300">
                 {!isCollaborationEnabled() && (
                    <div className="flex items-center gap-2 mb-2 px-1">
                        <button type="button" data-testid="godmode-chat-build-button" onClick={() => setMode('build')} className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${mode === 'build' ? 'bg-primary text-white' : 'bg-base-200 text-neutral hover:bg-base-300'}`}>Build</button>
                        <button type="button" data-testid="godmode-chat-ask-button" onClick={() => setMode('ask')} className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${mode === 'ask' ? 'bg-primary text-white' : 'bg-base-200 text-neutral hover:bg-base-300'}`}>Ask Project</button>
                        <button type="button" data-testid="godmode-chat-general-button" onClick={() => setMode('general')} className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${mode === 'general' ? 'bg-primary text-white' : 'bg-base-200 text-neutral hover:bg-base-300'}`}>Ask General</button>
                    </div>
                 )}
                <div className="relative">
                    {showMentionPopup && filteredMembers.length > 0 && (
                        <div className="absolute bottom-full mb-2 w-full bg-base-300 rounded-lg shadow-lg p-2 z-20 max-h-48 overflow-y-auto">
                            {filteredMembers.map(member => (
                                <div key={member.uid} onClick={() => handleMentionSelect(member)} className="flex items-center gap-2 p-2 hover:bg-primary/20 rounded-md cursor-pointer">
                                    <div className="w-6 h-6 rounded-full overflow-hidden shrink-0">
                                       {member.photoURL ? <img src={member.photoURL} className="w-full h-full object-cover" /> : <UserIcon className="w-4 h-4" />}
                                    </div>
                                    <span className="font-semibold">{member.displayName}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <textarea
                        ref={textareaRef}
                        data-testid="godmode-chat-input"
                        rows={1}
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend(e);
                            }
                        }}
                        placeholder={isCollaborationEnabled() ? "Type a message, @mention, /snippet, or /task..." : placeholders[mode]}
                        className="w-full bg-base-200 border border-base-300/80 rounded-md py-2 pl-3 pr-10 text-base-content focus:outline-none focus:ring-2 focus:ring-primary resize-none max-h-40"
                        disabled={isLoading}
                    />
                    <button type="submit" data-testid="godmode-chat-send-button" disabled={isLoading || !input.trim()} className="absolute bottom-2 right-0 flex items-center justify-center px-3 text-primary hover:opacity-80 disabled:text-neutral/50 disabled:cursor-not-allowed">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path></svg>
                    </button>
                </div>
            </form>
            <style>{`.typing-indicator{display:flex;align-items:center;justify-content:center}.typing-indicator div{width:6px;height:6px;background-color:var(--color-neutral);border-radius:50%;margin:0 2px;animation:typing-wave 1.2s infinite ease-in-out}.typing-indicator div:nth-child(2){animation-delay:.1s}.typing-indicator div:nth-child(3){animation-delay:.2s}@keyframes typing-wave{0%,60%,100%{transform:initial}30%{transform:translateY(-6px)}}`}</style>
        </div>
    );
};

export default ChatInterface;
