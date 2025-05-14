import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { getAuth, signInWithPopup, signOut } from "firebase/auth";
import { googleProvider } from "./firebase";
import { db, auth } from "./firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/contacts.readonly");

auth.languageCode = "en";
provider.setCustomParameters({
  login_hint: "user@example.com",
});

// Export sign out function for use throughout the app
export const signOutUser = async () => {
  try {
    await signOut(auth);
    console.log("User signed out.");
    return true;
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
};

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Check if user document exists, if not create one
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      await setDoc(userDocRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        role: "user",
        createdAt: serverTimestamp(),
      });
    }

    console.log("User signed in:", user.displayName);
    return user;
  } catch (error) {
    console.error("Error signing in with Google:", error.message);
    throw error;
  }
};

export const loginWithEmail = async (email, password) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const user = result.user;
    console.log("User logged in:", user.email);
    return user;
  } catch (error) {
    console.error("Error logging in with email:", error.message);
    throw error;
  }
};

export const registerWithEmail = async (
  firstName,
  lastName,
  email,
  password
) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const user = result.user;
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: user.email,
      firstName: firstName,
      lastName: lastName,
      role: "user",
      createdAt: serverTimestamp(),
    });
    console.log("User registered:", user.email);
    return user;
  } catch (error) {
    console.error("Error registering with email:", error.message);
    throw error;
  }
};

// Get current authenticated user
export const getCurrentUser = () => {
  return auth.currentUser;
};
