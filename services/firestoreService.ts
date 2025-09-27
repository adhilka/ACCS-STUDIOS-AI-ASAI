import firebase, { firestore, serverTimestamp } from './firebase';
// FIX: Import admin-related types to support the new feature.
import { Project, FileNode, AiChanges, ApiConfig, AiChatMessage, AiProvider, ApiPoolConfig, ApiPoolKey, AdminUser, User, AdminSettings, PlatformError, CustomFirebaseConfig, ChatMessageSenderInfo, Invite } from '../types';

const projectsCollection = firestore.collection('projects');
const userSettingsCollection = firestore.collection('userSettings');
const usersCollection = firestore.collection('users');
const adminSettingsCollection = firestore.collection('adminSettings');
const shareKeysCollection = firestore.collection('shareKeys');
const platformErrorsCollection = firestore.collection('platformErrors');
const invitesCollection = firestore.collection('invites');


// --- User Management ---

export const ensureUserDocument = async (uid: string, email: string | null) => {
    const userRef = usersCollection.doc(uid);
    const doc = await userRef.get();
    if (!doc.exists) {
        await userRef.set({
            uid,
            email,
            createdAt: serverTimestamp(),
            tokenBalance: 1_000_000_000, // Grant 1 billion tokens on signup
            lastLogin: serverTimestamp(),
            customFirebaseConfig: { enabled: false }
        });
    }
};

export const getUserProfile = async (userId: string): Promise<User | null> => {
    const doc = await usersCollection.doc(userId).get();
    if (!doc.exists) return null;
    return doc.data() as User;
};

export const getUsersProfiles = async (uids: string[]): Promise<ChatMessageSenderInfo[]> => {
    if (uids.length === 0) return [];
    // Firestore 'in' query is limited to 10 items. For larger teams, this would need chunking.
    const snapshot = await usersCollection.where('uid', 'in', uids.slice(0, 10)).get();
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            uid: data.uid,
            displayName: data.displayName || data.email,
            photoURL: data.photoURL || null,
        };
    });
};

// --- User Settings (API Keys, Tokens & Custom Firebase) ---

export const saveUserApiConfig = async (userId: string, config: ApiConfig) => {
    await userSettingsCollection.doc(userId).set({ apiKeys: config }, { merge: true });
};

export const getUserApiConfig = async (userId: string): Promise<ApiConfig> => {
    const doc = await userSettingsCollection.doc(userId).get();
    const defaults: ApiConfig = { gemini: null, openrouter: null, groq: null, e2b: null };
    if (!doc.exists) return defaults;
    const data = doc.data();
    return { ...defaults, ...(data?.apiKeys || {}) };
};

export const saveCustomFirebaseConfig = async (userId: string, config: CustomFirebaseConfig): Promise<void> => {
    await usersCollection.doc(userId).update({
        customFirebaseConfig: config,
    });
};

export const deductToken = async (userId: string): Promise<void> => {
    const userRef = usersCollection.doc(userId);
    // Use an atomic decrement operation to prevent race conditions
    await userRef.update({
        tokenBalance: firebase.firestore.FieldValue.increment(-1)
    });
};

export const updateUserTokenBalance = async (userId: string, newBalance: number, updateLogin: boolean = false): Promise<void> => {
    const updateData: { tokenBalance: number, lastLogin?: firebase.firestore.FieldValue } = {
        tokenBalance: newBalance,
    };
    if (updateLogin) {
        updateData.lastLogin = serverTimestamp();
    }
    await usersCollection.doc(userId).update(updateData);
};

// --- Project Management ---

export const createProject = async (
  ownerId: string,
  name: string,
  prompt: string,
  projectType: string,
  provider: AiProvider,
  files?: Record<string, string>,
  model?: string,
): Promise<string> => {
  const projectRef = await projectsCollection.add({
    ownerId,
    name,
    prompt,
    type: projectType,
    provider,
    model,
    createdAt: serverTimestamp(),
    members: [ownerId], // Add owner to members list for easy querying
    sandboxType: 'stackblitz', // Default sandbox type
    deployment: null,
  });

  if (files && Object.keys(files).length > 0) {
    const filesBatch = firestore.batch();
    const filesCollection = projectRef.collection('files');
    Object.entries(files).forEach(([path, content]) => {
        const fileDoc: Omit<FileNode, 'id'> = {
            name: path.split('/').pop() || '',
            path: path,
            type: 'file',
            content: content,
        };
        filesBatch.set(filesCollection.doc(), fileDoc);
    });
    await filesBatch.commit();
  }

  return projectRef.id;
};

export const getUserProjects = async (userId: string): Promise<Project[]> => {
    const snapshot = await projectsCollection.where('members', 'array-contains', userId).orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
};

export const getProjectDetails = async (projectId: string, db: firebase.firestore.Firestore = firestore): Promise<Project | null> => {
    const doc = await db.collection('projects').doc(projectId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Project;
};

export const streamProjectDetails = (projectId: string, callback: (project: Project | null) => void, db: firebase.firestore.Firestore = firestore): (() => void) => {
    return db.collection('projects').doc(projectId).onSnapshot(
        (doc) => {
            if (doc.exists) {
                callback({ id: doc.id, ...doc.data() } as Project);
            } else {
                callback(null);
            }
        },
        (error) => {
            console.error(`Error streaming project details for ${projectId}:`, error);
            callback(null);
        }
    );
};


export const updateProjectDetails = async (projectId: string, name: string, prompt: string, model?: string, sandboxType?: 'iframe' | 'stackblitz', provider?: AiProvider, db: firebase.firestore.Firestore = firestore) => {
    const updateData: Partial<Project> = { name, prompt };
    if (model) {
      updateData.model = model;
    }
     if (provider) {
      updateData.provider = provider;
    }
    if (sandboxType) {
      updateData.sandboxType = sandboxType;
    }
    await db.collection('projects').doc(projectId).update(updateData);
};

export const deleteProject = async (projectId: string): Promise<void> => {
    const projectRef = projectsCollection.doc(projectId);

    // This is a simplified client-side deletion. For large projects, a Cloud Function is better.
    // Delete files subcollection
    const filesSnapshot = await projectRef.collection('files').get();
    const fileBatch = firestore.batch();
    filesSnapshot.docs.forEach(doc => fileBatch.delete(doc.ref));
    await fileBatch.commit();

    // Delete chatHistory subcollection
    const chatSnapshot = await projectRef.collection('chatHistory').get();
    const chatBatch = firestore.batch();
    chatSnapshot.docs.forEach(doc => chatBatch.delete(doc.ref));
    await chatBatch.commit();

    // Delete project document
    await projectRef.delete();
};

export const copyProject = async (projectId: string, newName: string, userId: string): Promise<string> => {
    const originalProject = await getProjectDetails(projectId);
    if (!originalProject) throw new Error("Original project not found.");

    const originalFiles = await getProjectFiles(projectId);
    const filesRecord: Record<string, string> = {};
    originalFiles.forEach(file => {
        if (file.type === 'file' && file.content) {
            filesRecord[file.path] = file.content;
        }
    });

    const newProjectId = await createProject(
        userId,
        newName,
        originalProject.prompt || '',
        originalProject.type,
        originalProject.provider,
        filesRecord,
        originalProject.model
    );
    return newProjectId;
};

// --- Project Sharing & Collaboration Invites ---

export const createShareKey = async (projectId: string): Promise<string> => {
    const keyRef = await shareKeysCollection.add({
        projectId,
        createdAt: serverTimestamp(),
    });
    return keyRef.id;
};

export const joinProjectByShareKey = async (key: string, userId: string): Promise<Project> => {
    const keyDoc = await shareKeysCollection.doc(key).get();
    if (!keyDoc.exists) {
        throw new Error("Invalid or expired share key.");
    }

    const { projectId } = keyDoc.data()!;
    const projectRef = projectsCollection.doc(projectId);
    const projectDoc = await projectRef.get();

    if (!projectDoc.exists) {
        throw new Error("The project associated with this key no longer exists.");
    }
    
    // Add user to project members if not already a member
    await projectRef.update({
        members: firebase.firestore.FieldValue.arrayUnion(userId)
    });

    // Share keys are single-use, so delete it after it has been used.
    await keyDoc.ref.delete();

    return { id: projectDoc.id, ...projectDoc.data() } as Project;
};

export const createInvite = async (projectId: string, ownerUid: string, inviteeEmail: string): Promise<string> => {
    const inviteRef = await invitesCollection.add({
        projectId,
        ownerUid,
        inviteeEmail: inviteeEmail.toLowerCase(),
        createdAt: serverTimestamp(),
    });
    return inviteRef.id;
};

export const acceptInvite = async (code: string, inviteeUid: string, inviteeEmail: string | null): Promise<Project> => {
    if (!inviteeEmail) {
        throw new Error("Current user has no email address.");
    }
    const inviteDoc = await invitesCollection.doc(code).get();
    if (!inviteDoc.exists) {
        throw new Error("Invalid or expired invite code.");
    }
    const inviteData = inviteDoc.data()!;
    if (inviteData.inviteeEmail.toLowerCase() !== inviteeEmail.toLowerCase()) {
        throw new Error("This invite is for a different email address.");
    }

    const projectRef = projectsCollection.doc(inviteData.projectId);
    const projectDoc = await projectRef.get();
    if (!projectDoc.exists) {
        throw new Error("The project for this invite no longer exists.");
    }

    await projectRef.update({
        members: firebase.firestore.FieldValue.arrayUnion(inviteeUid)
    });

    await inviteDoc.ref.delete();

    return { id: projectDoc.id, ...projectDoc.data() } as Project;
};

export const removeProjectMember = async (projectId: string, memberUidToRemove: string): Promise<void> => {
    const projectRef = projectsCollection.doc(projectId);
    await projectRef.update({
        members: firebase.firestore.FieldValue.arrayRemove(memberUidToRemove),
    });
};


// --- File Management ---

export const getProjectFiles = async (projectId: string, db: firebase.firestore.Firestore = firestore): Promise<FileNode[]> => {
    const snapshot = await db.collection('projects').doc(projectId).collection('files').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FileNode));
};

export const streamProjectFiles = (projectId: string, callback: (files: FileNode[]) => void, db: firebase.firestore.Firestore = firestore): (() => void) => {
    return db.collection('projects').doc(projectId).collection('files').onSnapshot(
        (snapshot) => {
            const files = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FileNode));
            callback(files);
        },
        (error) => {
            console.error(`Error streaming files for project ${projectId}:`, error);
            callback([]);
        }
    );
};

export const updateFileContent = async (projectId: string, fileId: string, newContent: string, db: firebase.firestore.Firestore = firestore) => {
    await db.collection('projects').doc(projectId).collection('files').doc(fileId).update({ content: newContent });
};

export const addFileOrFolder = async (projectId: string, path: string, type: 'file' | 'folder', content: string = '', db: firebase.firestore.Firestore = firestore) => {
    const newDoc: Omit<FileNode, 'id'> = {
        name: path.split('/').pop() || '',
        path,
        type,
        ...(type === 'file' && { content }),
    };
    await db.collection('projects').doc(projectId).collection('files').add(newDoc);
};

export const deleteFileByPath = async (projectId: string, path: string, db: firebase.firestore.Firestore = firestore) => {
    const filesCollection = db.collection('projects').doc(projectId).collection('files');
    const batch = db.batch();

    // Find the main file/folder to delete
    const mainDocSnapshot = await filesCollection.where('path', '==', path).limit(1).get();
    if (mainDocSnapshot.empty) return;
    const mainDoc = mainDocSnapshot.docs[0];
    batch.delete(mainDoc.ref);

    // If it's a folder, find and delete all children
    if (mainDoc.data().type === 'folder') {
        const childrenSnapshot = await filesCollection.where('path', '>', path + '/').where('path', '<', path + '/~').get();
        childrenSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
    }
    
    await batch.commit();
};

export const renameOrMovePath = async (projectId: string, oldPath: string, newPath: string, db: firebase.firestore.Firestore = firestore) => {
    const filesCollection = db.collection('projects').doc(projectId).collection('files');
    const batch = db.batch();
    
    // Find the main file/folder
    const mainDocSnapshot = await filesCollection.where('path', '==', oldPath).limit(1).get();
    if (mainDocSnapshot.empty) throw new Error("Source path not found.");
    
    const mainDoc = mainDocSnapshot.docs[0];
    const mainDocData = mainDoc.data() as FileNode;

    // Update the main doc
    batch.update(mainDoc.ref, { path: newPath, name: newPath.split('/').pop() || '' });
    
    // If it's a folder, update all children paths
    if (mainDocData.type === 'folder') {
        const childrenSnapshot = await filesCollection.where('path', '>', oldPath + '/').where('path', '<', oldPath + '/~').get();
        childrenSnapshot.docs.forEach(doc => {
            const childPath = doc.data().path;
            const updatedChildPath = childPath.replace(oldPath, newPath);
            batch.update(doc.ref, { path: updatedChildPath });
        });
    }

    await batch.commit();
};


export const applyAiChanges = async (projectId: string, currentFiles: FileNode[], changes: AiChanges, db: firebase.firestore.Firestore = firestore): Promise<void> => {
    const batch = db.batch();
    const filesCollection = db.collection('projects').doc(projectId).collection('files');

    // Handle Moves/Renames
    if (changes.move) {
        for (const moveOp of changes.move) {
            const fileToMove = currentFiles.find(f => f.path === moveOp.from);
            if (fileToMove) {
                const newName = moveOp.to.split('/').pop() || '';
                batch.update(filesCollection.doc(fileToMove.id), { path: moveOp.to, name: newName });
            }
        }
    }

    // Handle Copies
    if (changes.copy) {
        for (const copyOp of changes.copy) {
            const fileToCopy = currentFiles.find(f => f.path === copyOp.from);
            if (fileToCopy && fileToCopy.type === 'file') {
                const newDocRef = filesCollection.doc();
                const newDoc: Omit<FileNode, 'id'> = {
                    name: copyOp.to.split('/').pop() || '',
                    path: copyOp.to,
                    type: 'file',
                    content: fileToCopy.content || '',
                };
                batch.set(newDocRef, newDoc);
            }
        }
    }

    const deletePaths = changes.delete && Array.isArray(changes.delete) ? changes.delete : [];

    // Handle Deletions
    if (deletePaths.length > 0) {
        const filesToDelete = currentFiles.filter(f => deletePaths.includes(f.path));
        filesToDelete.forEach(file => {
            batch.delete(filesCollection.doc(file.id));
        });
    }

    // Handle Updates, ensuring we don't update a file that is being deleted
    if (changes.update) {
        const updatePaths = Object.keys(changes.update);
        const filesToUpdate = currentFiles.filter(f => 
            updatePaths.includes(f.path) && !deletePaths.includes(f.path)
        );
        filesToUpdate.forEach(file => {
            batch.update(filesCollection.doc(file.id), { content: changes.update![file.path] });
        });
    }
    
    // Handle Creations
    if (changes.create) {
        Object.entries(changes.create).forEach(([path, content]) => {
            const newDocRef = filesCollection.doc(); // Generate a new doc reference
            const newDoc: Omit<FileNode, 'id'> = {
                name: path.split('/').pop() || '',
                path: path,
                type: 'file',
                content: content,
            };
            batch.set(newDocRef, newDoc);
        });
    }

    await batch.commit();

    // After file operations, check for icon update and sync it to the project document
    const iconPath = 'public/icon.svg';
    const projectRef = db.collection('projects').doc(projectId);

    if (changes.create?.[iconPath]) {
        await projectRef.update({ iconSvg: changes.create[iconPath] });
    } else if (changes.update?.[iconPath]) {
        await projectRef.update({ iconSvg: changes.update[iconPath] });
    } else if (deletePaths.includes(iconPath)) {
        await projectRef.update({ iconSvg: firebase.firestore.FieldValue.delete() });
    }
}


// --- Chat Management ---

export const getChatHistory = async (projectId: string, db: firebase.firestore.Firestore = firestore): Promise<AiChatMessage[]> => {
    const snapshot = await db.collection('projects').doc(projectId).collection('chatHistory').orderBy('timestamp', 'asc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AiChatMessage));
};

export const streamChatHistory = (projectId: string, callback: (messages: AiChatMessage[]) => void, db: firebase.firestore.Firestore = firestore): (() => void) => {
    return db.collection('projects').doc(projectId).collection('chatHistory').orderBy('timestamp', 'asc').onSnapshot(
        (snapshot) => {
            const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AiChatMessage));
            callback(messages);
        },
        (error) => {
            console.error(`Error streaming chat history for project ${projectId}:`, error);
            callback([]);
        }
    );
};

export const addChatMessage = async (projectId: string, message: Omit<AiChatMessage, 'id' | 'timestamp'>, db: firebase.firestore.Firestore = firestore) => {
    await db.collection('projects').doc(projectId).collection('chatHistory').add({
        ...message,
        timestamp: serverTimestamp(),
    });
};

export const updateChatMessage = async (projectId: string, messageId: string, updates: Partial<AiChatMessage>, db: firebase.firestore.Firestore = firestore) => {
    await db.collection('projects').doc(projectId).collection('chatHistory').doc(messageId).update(updates);
};

export const deleteChatMessage = async (projectId: string, messageId: string, db: firebase.firestore.Firestore = firestore): Promise<void> => {
    await db.collection('projects').doc(projectId).collection('chatHistory').doc(messageId).update({
        isDeleted: true,
        text: '[This message was deleted by the owner.]',
        type: 'text',
        filePath: firebase.firestore.FieldValue.delete(),
        code: firebase.firestore.FieldValue.delete(),
        language: firebase.firestore.FieldValue.delete(),
    });
};

export const clearChatHistory = async (projectId: string, db: firebase.firestore.Firestore = firestore): Promise<void> => {
    const chatCollection = db.collection('projects').doc(projectId).collection('chatHistory');
    const snapshot = await chatCollection.get();
    if (snapshot.empty) return;
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();
};

// --- Usage Statistics ---

export const getUserFileStats = async (userId: string): Promise<{ fileCount: number; totalSize: number }> => {
    const projectsSnapshot = await projectsCollection.where('members', 'array-contains', userId).get();
    if (projectsSnapshot.empty) {
        return { fileCount: 0, totalSize: 0 };
    }

    let fileCount = 0;
    let totalSize = 0;

    const filePromises = projectsSnapshot.docs.map(projectDoc => 
        projectDoc.ref.collection('files').get()
    );

    const filesSnapshots = await Promise.all(filePromises);

    for (const filesSnapshot of filesSnapshots) {
        filesSnapshot.forEach(fileDoc => {
            const fileData = fileDoc.data();
            if (fileData.type === 'file' && fileData.content) {
                fileCount++;
                totalSize += new TextEncoder().encode(fileData.content).length; // Get byte length
            } else if (fileData.type === 'file' && !fileData.content) {
                fileCount++;
            }
        });
    }

    return { fileCount, totalSize };
};

// --- Admin Features ---

export const getCollectionCount = async (collectionName: 'projects' | 'users'): Promise<number> => {
    const snapshot = await firestore.collection(collectionName).get();
    return snapshot.size;
}

export const getAllUsers = async (): Promise<AdminUser[]> => {
    const snapshot = await usersCollection.orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => doc.data() as AdminUser);
}

export const getAdminSettings = async (): Promise<AdminSettings> => {
    const doc = await adminSettingsCollection.doc('config').get();
    if (!doc.exists) return { dailyTokenReward: 1000000 };
    return doc.data() as AdminSettings;
}

export const saveAdminSettings = async (settings: AdminSettings): Promise<void> => {
    await adminSettingsCollection.doc('config').set(settings);
}


// --- Admin API Pool Management ---

export const getApiPoolConfig = async (): Promise<ApiPoolConfig> => {
    const doc = await adminSettingsCollection.doc('apiPoolConfig').get();
    if (!doc.exists) return { isEnabled: false };
    return doc.data() as ApiPoolConfig;
};

export const saveApiPoolConfig = async (config: ApiPoolConfig): Promise<void> => {
    await adminSettingsCollection.doc('apiPoolConfig').set(config);
};

export const getApiPoolKeys = async (): Promise<ApiPoolKey[]> => {
    const snapshot = await adminSettingsCollection.doc('apiPoolConfig').collection('keys').orderBy('addedAt', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ApiPoolKey));
};

export const addApiPoolKey = async (provider: AiProvider, key: string): Promise<string> => {
    const docRef = await adminSettingsCollection.doc('apiPoolConfig').collection('keys').add({
        provider,
        key,
        addedAt: serverTimestamp(),
    });
    return docRef.id;
};

export const deleteApiPoolKey = async (keyId: string): Promise<void> => {
    await adminSettingsCollection.doc('apiPoolConfig').collection('keys').doc(keyId).delete();
};

// --- Platform Error Logging ---
export const logPlatformError = async (errorData: Omit<PlatformError, 'id' | 'timestamp'>): Promise<void> => {
    await platformErrorsCollection.add({
        ...errorData,
        timestamp: serverTimestamp(),
    });
};

export const getPlatformErrors = async (): Promise<PlatformError[]> => {
    const snapshot = await platformErrorsCollection.orderBy('timestamp', 'desc').limit(100).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlatformError));
};