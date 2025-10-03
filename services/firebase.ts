import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import { CustomFirebaseConfig } from '../types';

const firebaseConfig = {
  apiKey: "AIzaSyC9uzhgNCtDL11_aQ4PIITHnvJTti57Efw",
  authDomain: "cloud-fire-system-services.firebaseapp.com",
  databaseURL: "https://cloud-fire-system-services-default-rtdb.firebaseio.com",
  projectId: "cloud-fire-system-services",
  storageBucket: "cloud-fire-system-services.appspot.com",
  messagingSenderId: "307560193017",
  appId: "1:307560193017:web:2543eb4b1e255aedcdbb28"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const firestore = firebase.firestore();
export const storage = firebase.storage();

// FIX: Enable Firestore offline persistence to improve resilience against network issues.
// This allows the app to work with cached data when the connection to the backend is lost,
// which is what the reported error message indicates is happening.
firestore.enablePersistence({ synchronizeTabs: true })
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      // This can happen if multiple tabs are open.
      console.warn('Firestore persistence failed: Multiple tabs open. Persistence will only be enabled in one tab.');
    } else if (err.code == 'unimplemented') {
      // The current browser does not support all of the features required to enable persistence.
      console.warn('Firestore persistence is not supported in this browser.');
    }
  });


export const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp;

export const getSecondaryFirebaseApp = (config: CustomFirebaseConfig, ownerUid: string): firebase.app.App => {
    const appName = `collab-${ownerUid}`; // Unique name per project owner
    const existingApp = firebase.apps.find(app => app.name === appName);
    if (existingApp) {
        return existingApp;
    }

    const newApp = firebase.initializeApp(
        {
            apiKey: config.apiKey,
            authDomain: config.authDomain,
            projectId: config.projectId,
        },
        appName // Unique name for the app instance
    );

    // Enable persistence on the new instance to improve offline resilience
    newApp.firestore().enablePersistence({ synchronizeTabs: true })
      .catch((err) => {
        console.warn(`Firestore persistence for secondary app '${appName}' failed:`, err.message);
      });

    return newApp;
};

export default firebase;