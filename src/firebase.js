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

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const analytics = getAnalytics(app);
const googleProvider = new GoogleAuthProvider();

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("User is signed in:", user);
  } else {
    console.log("No user is signed in.");
  }
});
export { auth, db, googleProvider };
