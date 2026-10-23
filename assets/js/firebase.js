/* PageUp — Firebase bootstrap (modular SDK v10, loaded from CDN) */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";
import { firebaseConfig, isConfigured } from "./firebase-config.js";

export { isConfigured };

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

/* Offline-first Firestore: survives flaky networks and speeds up repeat reads. */
function initFirestore() {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    return getFirestore(app); // falls back when IndexedDB is unavailable
  }
}
export const db = initFirestore();
export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

/* Keep the session across tabs and reloads. */
setPersistence(auth, browserLocalPersistence).catch(() => {});

export const COLLECTIONS = {
  books: "books",
  users: "users",
  comments: "comments",
  ratings: "ratings",
  likes: "likes",
};

export const FUNCTIONS_REGION = "asia-south1";
