import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, User, Auth } from 'firebase/auth';
import { getFirestore, doc, setDoc, deleteDoc, getDoc, Firestore } from 'firebase/firestore';
import { UserProfile } from '../types';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'studymatch-demo.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'studymatch-demo',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'studymatch-demo.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1234567890:web:demoapp',
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  auth = getAuth(app);
  db = getFirestore(app);
} catch (err) {
  console.warn('Firebase initialization notice (running in stateless fallback mode):', err);
}

/**
 * PRD Requirement: Firebase Anonymous Auth
 * Authenticates user anonymously without email/password.
 */
export async function authenticateAnonymously(): Promise<User | null> {
  if (!auth) return null;
  try {
    const userCredential = await signInAnonymously(auth);
    console.log('Firebase Anonymous Auth successful:', userCredential.user.uid);
    return userCredential.user;
  } catch (err) {
    console.warn('Firebase Anonymous Auth fallback (local ID active):', err);
    return null;
  }
}

/**
 * PRD Requirement: Cloud Firestore Temporary Profile & Session ID
 * Stores profile temporarily in Firestore during queue/room session.
 */
export async function saveTemporaryProfile(uid: string, profile: UserProfile): Promise<void> {
  if (!db) return;
  try {
    const profileRef = doc(db, 'temporaryProfiles', uid);
    await setDoc(profileRef, {
      ...profile,
      firebaseUid: uid,
      createdAt: Date.now(),
      sessionStatus: 'active',
    });
  } catch (err) {
    console.warn('Firestore profile write fallback:', err);
  }
}

/**
 * PRD Requirement: Cloud Firestore Session Tracking
 */
export async function createTemporarySessionDoc(roomId: string, user1Id: string, user2Id: string): Promise<void> {
  if (!db) return;
  try {
    const sessionRef = doc(db, 'activeSessions', roomId);
    await setDoc(sessionRef, {
      roomId,
      user1Id,
      user2Id,
      startedAt: Date.now(),
      status: 'active',
    });
  } catch (err) {
    console.warn('Firestore session doc write fallback:', err);
  }
}

/**
 * PRD Requirement: Stateless Cleanup
 * Cleans up temporary Firestore data when session ends or partner skips.
 */
export async function deleteTemporarySessionData(roomId?: string, uid?: string): Promise<void> {
  if (!db) return;
  try {
    if (roomId) {
      await deleteDoc(doc(db, 'activeSessions', roomId));
    }
    if (uid) {
      await deleteDoc(doc(db, 'temporaryProfiles', uid));
    }
  } catch (err) {
    console.warn('Firestore stateless cleanup fallback:', err);
  }
}

export { auth, db };
