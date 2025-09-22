import firebase from 'firebase/compat/app';

// FIX: Added isAdmin flag to User type for the new admin system.
export type User = firebase.User & {
    isAdmin?: boolean;
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
        action: 'DELETE_PROJECT' | 'COPY_PROJECT' | 'CLEAR_CHAT_HISTORY' | 'RENAME_PROJECT';
        payload?: { newName?: string };
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

export type AiChatMessage = ChatMessage & {
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
  addedAt: firebase.firestore.Timestamp;
};

export type ApiPoolConfig = {
  isEnabled: boolean;
};

export type AdminUser = {
  uid: string;
  email: string | null;
  createdAt: firebase.firestore.Timestamp;
};

export type ConsoleMessage = {
  id: string;
  method: 'log' | 'warn' | 'error' | 'info';
  timestamp: string;
  args: any[];
};