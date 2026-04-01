// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";

// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBnBvUAL8TRY1xCzzXdCIzHlqS1X410sU8",
  authDomain: "healthcare1-9832d.firebaseapp.com",
  projectId: "healthcare1-9832d",
  storageBucket: "healthcare1-9832d.firebasestorage.app",
  messagingSenderId: "756516158796",
  appId: "1:756516158796:web:4f0286918ec1a498dd23e9",
  measurementId: "G-M1FY3LD098"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
