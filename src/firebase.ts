import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0960684724",
  appId: "1:68617100684:web:a88024a9a5640c81380aa9",
  apiKey: "AIzaSyCFlTLbzmr1dmfNuynGX4o5-gQqVFY7zfA",
  authDomain: "gen-lang-client-0960684724.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-2e496efb-c2cb-4fca-8197-5018949e7c97",
  storageBucket: "gen-lang-client-0960684724.firebasestorage.app",
  messagingSenderId: "68617100684",
  measurementId: "G-BW0GBTW73S"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// In modern Firebase Web SDK, custom database ID is passed as the second argument to getFirestore.
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export { app, auth, db };
