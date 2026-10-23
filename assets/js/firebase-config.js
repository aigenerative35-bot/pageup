/**
 * PageUp — Firebase configuration
 * ------------------------------------------------------------------
 * Replace the placeholder values below with the config block from:
 *   Firebase Console -> Project settings -> General -> Your apps -> Web app
 *
 * Everything here is a *public* client key. It is safe to ship in a static
 * site; access is enforced by firestore.rules and storage.rules, not by
 * keeping these values secret. Never put a service-account JSON here.
 *
 * You also need to enable, in the Firebase Console:
 *   Authentication -> Sign-in method -> Google + Email/Password
 *   Firestore Database -> Create database
 *   Storage -> Get started
 */
export const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
};

/** Public site settings — safe to edit. */
export const siteConfig = {
  name: "PageUp",
  tagline: "Read unlimited. Pay only for what you love.",
  supportEmail: "support@pageup.example",
  currency: "INR",
  currencySymbol: "\u20B9",
  /** Razorpay checkout key id (public). Leave blank to use the demo flow. */
  razorpayKeyId: "",
  /** Free pages of every premium book that anyone can read. */
  defaultPreviewPages: 12,
};

/** True when the placeholders above have not been replaced yet. */
export const isConfigured = !String(firebaseConfig.apiKey).startsWith("YOUR_");
