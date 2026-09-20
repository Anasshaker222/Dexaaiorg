import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, type User } from 'firebase/auth';

// هاي القيم بتجيبها من لوحة تحكم Firebase (Project settings -> General -> Your apps)
// وبتحطها كمتغيرات بيئة (Environment Variables) بمنصة النشر تبعتك، مش هون مباشرة.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

const app = firebaseEnabled && getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = firebaseEnabled ? getFirestore(app) : null;
export const auth = firebaseEnabled ? getAuth(app) : null;

let currentUser: User | null = null;
let authReadyResolve: (u: User | null) => void;
export const authReady: Promise<User | null> = new Promise((res) => (authReadyResolve = res));

if (auth) {
  onAuthStateChanged(auth, (u) => {
    currentUser = u;
    authReadyResolve(u);
  });
}

export async function ensureSignedIn(): Promise<string | null> {
  if (!auth) return null;
  await authReady;
  if (currentUser) return currentUser.uid;
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}

export function getUid(): string | null {
  return currentUser?.uid ?? null;
}
