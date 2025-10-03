import firebase from 'firebase/compat/app';

// FIX: Removed `databaseURL` from CustomFirebaseConfig as it is not needed for Firestore.
export type CustomFirebaseConfig = {
  enabled: boolean;
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
};

// FIX: Added isAdmin flag and tokenBalance to User type for the new admin and token systems.
export type User = firebase.User & {
    isAdmin?: boolean;
    tokenBalance?: number;
    lastLogin?: firebase.firestore.Timestamp;
    customFirebaseConfig?: CustomFirebaseConfig;
};

export interface Project {
  id: string;
  name: string;
  prompt?: string;
  type: string; // e.g., 'React Web App', 'Vanilla JS', 'Python Script'
  provider: AiProvider;
  model?: string; // The specific model used for Groq/OpenRouter
  ownerId: string;
  createdAt: firebase.firestore.Timestamp;
  members: string[]; // List of user UIDs who can access the project
  iconSvg?: string; // New field for project SVG icon
  sandboxType?: 'iframe' | 'stackblitz'; // Add sandbox type
  deployment?: {
    provider: 'codesandbox' | 'netlify' | 'vercel';
    url: string;
    lastDeployed: firebase.firestore.Timestamp;
  } | null;
}

export interface FileNode {
  id: string;
  name:string;
  path: string; // full path from root, e.g. "src/components/Button.tsx"
  type: 'file' | 'folder';
  content?: string;
  // Children are managed via path queries in Firestore, not stored directly in the object
}

export type ChatMessage = {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: firebase.firestore.Timestamp;
};

export type AiProvider = 'gemini' | 'openrouter' | 'groq';

export type ApiConfig = {
  gemini: string | null;
  openrouter: string | null;
  groq: string | null;
  // FIX: Add 'e2b' to support the cloud sandbox API key.
  e2b: string | null;
};

// --- New Types for AI Planning ---

export interface AiPlan {
  thoughts?: string;
  reasoning: string;
  plan: {
    create?: string[];
    update?: string[];
    delete?: string[];
    move?: Array<{ from: string; to: string }>;
    copy?: Array<{ from: string; to: string }>;
    special_action?: {
        action: 'DELETE_PROJECT' | 'COPY_PROJECT' | 'CLEAR_CHAT_HISTORY' | 'RENAME_PROJECT' | 'CHANGE_MODEL';
        payload?: { newName?: string; provider?: AiProvider; model?: string; };
        confirmation_prompt?: string;
    }
  };
}


// FIX: Exported AiChanges to be used across multiple files.
export type AiChanges = {
  create?: Record<string, string>;
  update?: Record<string, string>;
  delete?: string[];
  move?: Array<{ from: string; to: string }>;
  copy?: Array<{ from: string; to: string }>;
};

export type ChatMessageSenderInfo = {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
};

export type AiChatMessage = ChatMessage & {
  // --- New fields for collaboration ---
  senderInfo?: ChatMessageSenderInfo; // For human senders
  type?: 'text' | 'file_pin' | 'code_snippet' | 'task';
  filePath?: string; // for file_pin
  code?: string; // for code_snippet
  language?: string; // for code_snippet
  // --- New fields for tasks ---
  taskText?: string;
  isComplete?: boolean;
  assignees?: string[];
  // --- End of task fields ---
  mentions?: string[]; // Array of mentioned user UIDs
  isDeleted?: boolean; // For owner-controlled soft deletes
  // --- End of new fields ---
  linkedFile?: string; // For linking to a file path

  plan?: AiPlan;
  planStatus?: 'pending' | 'approved' | 'rejected' | 'executing';
  isLoading?: boolean; // To show spinner on a specific message
  
  // Fields for Autonomous Agent
  isAgentMessage?: boolean;
  agentState?: 'planning' | 'executing' | 'analyzing' | 'self-correcting' | 'finished' | 'error';
  thoughts?: string; // AI's internal monologue
  currentTask?: string; // The specific task being worked on
};

export type AgentState = {
    status: 'idle' | 'running' | 'paused' | 'finished' | 'error';
    objective: string;
    plan: string[];
    currentTaskIndex: number;
    logs: string[];
    lastError?: string;
    thoughts?: string; // Add thoughts here as well for modal state
};

// --- Types for Rebranding Feature ---
export type BrandAssets = {
  logo: string; // base64 encoded image
  background: string; // base64 encoded image
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    neutral: string;
    'base-content': string;
    'base-100': string;
    'base-200': string;
    'base-300': string;
  };
};

export interface BrandingContextState {
  brand: BrandAssets | null;
  saveBrand: (assets: BrandAssets) => void;
  resetBrand: () => void;
}

// --- New Types for Admin API Pool ---
export type ApiPoolKey = {
  id: string; // Unique ID for the key
  key: string; // The API key itself
  provider: AiProvider;
  addedAt: firebase.firestore.Timestamp | Date;
};

export type ApiPoolConfig = {
  isEnabled: boolean;
};

export type AdminSettings = {
    dailyTokenReward: number;
}

export type AdminUser = {
  uid: string;
  email: string | null;
  createdAt: firebase.firestore.Timestamp;
  tokenBalance: number;
};

export type UserUsageStats = {
  projectCount: number;
  fileCount: number;
  dataStoredBytes: number;
};

export type AdminStats = {
    userCount: number;
    projectCount: number;
    totalFiles: number;
    totalDataStored: number;
}

export type ConsoleMessage = {
  id: string;
  method: 'log' | 'warn' | 'error' | 'info';
  timestamp: string;
  args: any[];
};

export type TerminalOutput = {
    id: string;
    timestamp: number;
    data: string;
};

export interface PlatformError {
  id: string;
  timestamp: firebase.firestore.Timestamp;
  userId: string;
  userEmail?: string | null;
  projectId?: string | null;
  functionName: string;
  errorMessage: string;
  provider?: AiProvider;
  attemptCount: number;
}

// --- Types for Snapshots & Collaboration ---
export interface Snapshot {
    id: string;
    createdAt: firebase.firestore.Timestamp;
    triggeringPrompt: string;
    fileData: string; // Compressed JSON string of all files
}

export interface Invite {
    id: string;
    projectId: string;
    ownerUid: string;
    inviteeEmail: string;
    createdAt: firebase.firestore.Timestamp;
}

// --- Types for AI God Mode ---
export type AiGodModeAction = {
    type: 'CLICK_ELEMENT' | 'TYPE_IN_INPUT' | 'MODIFY_FILES' | 'ASK_USER' | 'FINISH';
    selector?: string; // For CLICK_ELEMENT and TYPE_IN_INPUT
    payload?: string | AiChanges; // Text for TYPE_IN_INPUT, changes for MODIFY_FILES, question for ASK_USER
    reasoning: string; // AI's thought process for this specific action
};