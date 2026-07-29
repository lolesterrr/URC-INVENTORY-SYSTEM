import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import config from '../firebase-applet-config.json';
import { HardwareAsset, SoftwareLicense, ServerComponent, User, AuditLog, Alert } from './types';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(config) : getApp();

// Initialize Firestore with specific database ID from config
export const db = config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, config.firestoreDatabaseId)
  : getFirestore(app);

export const auth = getAuth(app);

// Firestore Collections Constants
export const COLLECTIONS = {
  HARDWARE: 'hardware',
  SOFTWARE: 'software',
  SERVER_COMPONENTS: 'serverComponents',
  USERS: 'users',
  AUDIT_LOGS: 'auditLogs',
  ALERTS: 'alerts'
};

// --- REAL-TIME LISTENERS & SUBSCRIPTIONS ---

export function subscribeCollection<T>(collectionName: string, callback: (items: T[]) => void) {
  const colRef = collection(db, collectionName);
  return onSnapshot(colRef, (snapshot) => {
    const items: T[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as unknown as T));
    callback(items);
  }, (error) => {
    console.error(`Firestore subscription error on ${collectionName}:`, error);
  });
}

// --- HARDWARE CRUD ---
export async function fetchHardware(): Promise<HardwareAsset[]> {
  const snapshot = await getDocs(collection(db, COLLECTIONS.HARDWARE));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as HardwareAsset));
}

export async function saveHardwareAsset(item: HardwareAsset): Promise<void> {
  const docRef = doc(db, COLLECTIONS.HARDWARE, item.id);
  await setDoc(docRef, item, { merge: true });
}

export async function removeHardwareAsset(id: string): Promise<void> {
  const docRef = doc(db, COLLECTIONS.HARDWARE, id);
  await deleteDoc(docRef);
}

// --- SOFTWARE CRUD ---
export async function fetchSoftware(): Promise<SoftwareLicense[]> {
  const snapshot = await getDocs(collection(db, COLLECTIONS.SOFTWARE));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SoftwareLicense));
}

export async function saveSoftwareLicense(item: SoftwareLicense): Promise<void> {
  const docRef = doc(db, COLLECTIONS.SOFTWARE, item.id);
  await setDoc(docRef, item, { merge: true });
}

export async function removeSoftwareLicense(id: string): Promise<void> {
  const docRef = doc(db, COLLECTIONS.SOFTWARE, id);
  await deleteDoc(docRef);
}

// --- SERVER COMPONENTS CRUD ---
export async function fetchServerComponents(): Promise<ServerComponent[]> {
  const snapshot = await getDocs(collection(db, COLLECTIONS.SERVER_COMPONENTS));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ServerComponent));
}

export async function saveServerComponent(item: ServerComponent): Promise<void> {
  const docRef = doc(db, COLLECTIONS.SERVER_COMPONENTS, item.id);
  await setDoc(docRef, item, { merge: true });
}

export async function removeServerComponent(id: string): Promise<void> {
  const docRef = doc(db, COLLECTIONS.SERVER_COMPONENTS, id);
  await deleteDoc(docRef);
}

// --- USERS CRUD ---
export async function fetchUsers(): Promise<User[]> {
  const snapshot = await getDocs(collection(db, COLLECTIONS.USERS));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as User));
}

export async function saveUser(user: User): Promise<void> {
  const docRef = doc(db, COLLECTIONS.USERS, user.id);
  await setDoc(docRef, user, { merge: true });
}

// --- AUDIT LOGS CRUD ---
export async function fetchAuditLogs(): Promise<AuditLog[]> {
  const q = query(collection(db, COLLECTIONS.AUDIT_LOGS), orderBy('timestamp', 'desc'));
  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog));
  } catch (e) {
    const snapshot = await getDocs(collection(db, COLLECTIONS.AUDIT_LOGS));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog));
  }
}

export async function saveAuditLog(log: AuditLog): Promise<void> {
  const docRef = doc(db, COLLECTIONS.AUDIT_LOGS, log.id);
  await setDoc(docRef, log, { merge: true });
}

// --- AUTO-SEED FIRESTORE WITH INITIAL DEFAULTS IF EMPTY ---
export async function seedFirestoreIfEmpty(initialData: {
  hardware: HardwareAsset[];
  software: SoftwareLicense[];
  serverComponents: ServerComponent[];
  users: User[];
  auditLogs: AuditLog[];
}): Promise<void> {
  try {
    const hwDocs = await getDocs(collection(db, COLLECTIONS.HARDWARE));
    if (hwDocs.empty && initialData.hardware.length > 0) {
      console.log('Seeding initial Hardware to Firestore...');
      for (const item of initialData.hardware) {
        await saveHardwareAsset(item);
      }
    }

    const swDocs = await getDocs(collection(db, COLLECTIONS.SOFTWARE));
    if (swDocs.empty && initialData.software.length > 0) {
      console.log('Seeding initial Software to Firestore...');
      for (const item of initialData.software) {
        await saveSoftwareLicense(item);
      }
    }

    const scDocs = await getDocs(collection(db, COLLECTIONS.SERVER_COMPONENTS));
    if (scDocs.empty && initialData.serverComponents.length > 0) {
      console.log('Seeding initial Server Components to Firestore...');
      for (const item of initialData.serverComponents) {
        await saveServerComponent(item);
      }
    }

    const userDocs = await getDocs(collection(db, COLLECTIONS.USERS));
    if (userDocs.empty && initialData.users.length > 0) {
      console.log('Seeding initial Users to Firestore...');
      for (const item of initialData.users) {
        await saveUser(item);
      }
    }

    const logDocs = await getDocs(collection(db, COLLECTIONS.AUDIT_LOGS));
    if (logDocs.empty && initialData.auditLogs.length > 0) {
      console.log('Seeding initial Audit Logs to Firestore...');
      for (const item of initialData.auditLogs) {
        await saveAuditLog(item);
      }
    }
  } catch (err) {
    console.error('Error auto-seeding Firestore:', err);
  }
}

export default app;
