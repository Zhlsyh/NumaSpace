import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, User, Auth } from 'firebase/auth';
import { getFirestore, doc, setDoc, deleteDoc, Firestore } from 'firebase/firestore';
import { UserProfile } from '../types';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId,
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

try {
  if (hasFirebaseConfig) {
    const config = {
      apiKey: firebaseConfig.apiKey as string,
      authDomain: firebaseConfig.authDomain as string,
      projectId: firebaseConfig.projectId as string,
      appId: firebaseConfig.appId as string,
      ...(firebaseConfig.storageBucket ? { storageBucket: firebaseConfig.storageBucket } : {}),
      ...(firebaseConfig.messagingSenderId ? { messagingSenderId: firebaseConfig.messagingSenderId } : {}),
    };
    app = getApps()[0] || initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
  } else {
    console.warn('Firebase environment is incomplete; using stateless local mode.');
  }
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
  if (!db || auth?.currentUser?.uid !== uid) return;
  try {
    const profileRef = doc(db, 'temporaryProfiles', uid);
    await setDoc(profileRef, {
      id: uid,
      displayName: profile.displayName,
      gender: profile.gender,
      major: profile.major,
      interest: profile.interest,
      currentGoal: profile.currentGoal,
      studyMode: profile.studyMode,
      ...(profile.subjectTopic ? { subjectTopic: profile.subjectTopic } : {}),
      ...(profile.roomCode ? { roomCode: profile.roomCode } : {}),
      avatarColor: profile.avatarColor,
      avatarIcon: profile.avatarIcon,
      firebaseUid: uid,
      createdAt: Date.now(),
      sessionStatus: 'active',
    });
  } catch (err) {
    console.warn('Firestore profile write fallback:', err);
  }
}

export async function deleteTemporaryProfileData(uid: string): Promise<void> {
  if (!db || auth?.currentUser?.uid !== uid) return;
  try {
    await deleteDoc(doc(db, 'temporaryProfiles', uid));
  } catch (err) {
    console.warn('Firestore profile cleanup fallback:', err);
  }
}

export { auth, db };
