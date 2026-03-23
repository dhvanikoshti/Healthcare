// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBx_5R-RXk3OV818wA-KoMH_jMLYrA7PcU",
  authDomain: "healthcare-2b7fb.firebaseapp.com",
  projectId: "healthcare-2b7fb",
  storageBucket: "healthcare-2b7fb.firebasestorage.app",
  messagingSenderId: "1056202220781",
  appId: "1:1056202220781:web:17198fdf498eb623b818e4",
  measurementId: "G-ZPGSNZC454"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
