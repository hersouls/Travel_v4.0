// ============================================
// Firebase Service (Modular SDK v10+)
// Auth + Firestore + Storage
// ============================================

import { type FirebaseApp, initializeApp } from 'firebase/app'
import { type Auth, connectAuthEmulator, getAuth } from 'firebase/auth'
import { type Firestore, connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { type FirebaseStorage, connectStorageEmulator, getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const REQUIRED_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const

let app: FirebaseApp | null = null
let authInstance: Auth | null = null
let dbInstance: Firestore | null = null
let storageInstance: FirebaseStorage | null = null
let emulatorsConnected = false

function validateConfig(): boolean {
  const missing = REQUIRED_ENV_KEYS.filter((key) => !import.meta.env[key])
  if (missing.length > 0) {
    console.warn(
      `[Firebase] Missing env vars: ${missing.join(', ')}. Firebase will not be available.`,
    )
    return false
  }
  return true
}

function getApp(): FirebaseApp {
  if (!app) {
    if (!validateConfig()) {
      throw new Error('[Firebase] Cannot initialize: missing configuration')
    }
    app = initializeApp(firebaseConfig)
  }
  return app
}

function connectEmulators(): void {
  if (emulatorsConnected || !import.meta.env.DEV) return

  try {
    if (authInstance) {
      connectAuthEmulator(authInstance, 'http://localhost:9099', {
        disableWarnings: true,
      })
    }
    if (dbInstance) {
      connectFirestoreEmulator(dbInstance, 'localhost', 8080)
    }
    if (storageInstance) {
      connectStorageEmulator(storageInstance, 'localhost', 9199)
    }
    emulatorsConnected = true
    console.log('[Firebase] Emulators connected')
  } catch (error) {
    console.warn('[Firebase] Emulator connection failed:', error)
  }
}

export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(getApp())
  }
  return authInstance
}

export function getFirebaseDb(): Firestore {
  if (!dbInstance) {
    dbInstance = getFirestore(getApp())
  }
  return dbInstance
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storageInstance) {
    storageInstance = getStorage(getApp())
  }
  return storageInstance
}

export function initFirebase(): {
  auth: Auth
  db: Firestore
  storage: FirebaseStorage
} {
  const auth = getFirebaseAuth()
  const db = getFirebaseDb()
  const storage = getFirebaseStorage()

  if (import.meta.env.DEV) {
    connectEmulators()
  }

  return { auth, db, storage }
}

export function isFirebaseConfigured(): boolean {
  return validateConfig()
}
