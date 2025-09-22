import firebase, { firestore, serverTimestamp } from './firebase';
// FIX: Import admin-related types to support the new feature.
import { Project, FileNode, AiChanges, ApiConfig, AiChatMessage, AiProvider, ApiPoolConfig, ApiPoolKey, AdminUser } from '../types';

const projectsCollection = firestore.collection('projects');
const userSettingsCollection = firestore.collection('userSettings');
const usersCollection = firestore.collection('users');
const adminSettingsCollection = firestore.collection('adminSettings');
const shareKeysCollection = firestore.collection('shareKeys');


// --- User Management ---

export const ensureUserDocument = async (uid: string, email: string | null) => {
    const userRef = usersCollection.doc(uid);
    const doc = await userRef.get();
    if (!doc.exists) {
        await userRef.set({
            uid,
            email,
            createdAt: serverTimestamp(),
        });
    }
};

// --- User Settings (API Keys) ---

export const saveUserApiConfig = async (userId: string, config: ApiConfig) => {
    await userSettingsCollection.doc(userId).set({ apiKeys: config }, { merge: true });
};

export const getUserApiConfig = async (userId: string): Promise<ApiConfig> => {
    const doc = await userSettingsCollection.doc(userId).get();
    const defaults: ApiConfig = { gemini: null, openrouter: null, groq: null };
    if (!doc.exists) return defaults;
    const data = doc.data();
    return { ...defaults, ...(data?.apiKeys || {}) };
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

export const getProjectDetails = async (projectId: string): Promise<Project | null> => {
    const doc = await projectsCollection.doc(projectId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Project;
};

export const updateProjectDetails = async (projectId: string, name: string, prompt: string, model?: string) => {
    await projectsCollection.doc(projectId).update({ name, prompt, model });
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

// --- Project Sharing ---

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


// --- File Management ---

export const getProjectFiles = async (projectId: string): Promise<FileNode[]> => {
    const snapshot = await projectsCollection.doc(projectId).collection('files').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FileNode));
};

export const updateFileContent = async (projectId: string, fileId: string, newContent: string) => {
    await projectsCollection.doc(projectId).collection('files').doc(fileId).update({ content: newContent });
};

export const addFileOrFolder = async (projectId: string, path: string, type: 'file' | 'folder', content: string = '') => {
    const newDoc: Omit<FileNode, 'id'> = {
        name: path.split('/').pop() || '',
        path,
        type,
        ...(type === 'file' && { content }),
    };
    await projectsCollection.doc(projectId).collection('files').add(newDoc);
};

export const deleteFileByPath = async (projectId: string, path: string) => {
    const snapshot = await projectsCollection.doc(projectId).collection('files').where('path', '==', path).limit(1).get();
    if (!snapshot.empty) {
        await snapshot.docs[0].ref.delete();
    }
};

export const applyAiChanges = async (projectId: string, currentFiles: FileNode[], changes: AiChanges): Promise<void> => {
    const batch = firestore.batch();
    const filesCollection = projectsCollection.doc(projectId).collection('files');

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
    const projectRef = projectsCollection.doc(projectId);

    if (changes.create?.[iconPath]) {
        await projectRef.update({ iconSvg: changes.create[iconPath] });
    } else if (changes.update?.[iconPath]) {
        await projectRef.update({ iconSvg: changes.update[iconPath] });
    } else if (deletePaths.includes(iconPath)) {
        await projectRef.update({ iconSvg: firebase.firestore.FieldValue.delete() });
    }
}


// --- Chat Management ---

export const getChatHistory = async (projectId: string): Promise<AiChatMessage[]> => {
    const snapshot = await projectsCollection.doc(projectId).collection('chatHistory').orderBy('timestamp', 'asc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AiChatMessage));
};

export const addChatMessage = async (projectId: string, message: Omit<AiChatMessage, 'id' | 'timestamp'>) => {
    await projectsCollection.doc(projectId).collection('chatHistory').add({
        ...message,
        timestamp: serverTimestamp(),
    });
};

export const updateChatMessage = async (projectId: string, messageId: string, updates: Partial<AiChatMessage>) => {
    await projectsCollection.doc(projectId).collection('chatHistory').doc(messageId).update(updates);
};

export const clearChatHistory = async (projectId: string): Promise<void> => {
    const chatCollection = projectsCollection.doc(projectId).collection('chatHistory');
    const snapshot = await chatCollection.get();
    if (snapshot.empty) return;
    
    const batch = firestore.batch();
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();
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