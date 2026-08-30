import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

// Firebase web config is public by design (protected by Auth + security rules).
const app = initializeApp({
  apiKey: "AIzaSyCKr9ISLAHwCKCMcmrgGhxpxBa7dSKqYYA",
  authDomain: "legaldoc-14f4d.firebaseapp.com",
  projectId: "legaldoc-14f4d",
  storageBucket: "legaldoc-14f4d.firebasestorage.app",
  messagingSenderId: "672883131757",
  appId: "1:672883131757:web:e76e2bdc5f0b8b47054664",
});

export const auth = getAuth(app);
// Non-default Firestore database — the whole project lives in `default2`.
export const db = getFirestore(app, "default2");
// Must match the Cloud Functions deploy region.
export const functions = getFunctions(app, "asia-south1");
