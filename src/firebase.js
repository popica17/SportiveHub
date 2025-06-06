import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCLugwhPdNPuyBrN8bqGtkvfs9kT91ZykQ",
  authDomain: "proiect-licenta-edc7f.firebaseapp.com",
  projectId: "proiect-licenta-edc7f",
  storageBucket: "proiect-licenta-edc7f.firebasestorage.app",
  messagingSenderId: "77901809042",
  appId: "1:77901809042:web:af539864487ae77ad9ed4b",
  measurementId: "G-CDM1XJXT45",
};

// Initialize Firebase once
let app;
try {
  // Check if Firebase app is already initialized
  app = initializeApp(firebaseConfig);
  console.log("Firebase initialized successfully");
} catch (error) {
  if (error.code === "app/duplicate-app") {
    // If the app is already initialized, get the existing one
    console.warn("Firebase app already exists, using existing app");
  } else {
    // Handle other initialization errors
    console.error("Firebase initialization error:", error);
  }
}

// Get Firebase services
const auth = getAuth();
const db = getFirestore();
const analytics = getAnalytics();
const googleProvider = new GoogleAuthProvider();

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("User is signed in:", user);
  } else {
    console.log("No user is signed in.");
  }
});
export { auth, db, googleProvider };
