import React, { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc, onSnapshot } from "firebase/firestore";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        // Get additional user data from Firestore
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log("User profile loaded:", userData);
            console.log("User role from Firestore:", userData.role);
            console.log("User teamId from Firestore:", userData.teamId);
            setUserProfile(userData);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Separate useEffect for the real-time profile listener to avoid dependency issues
  useEffect(() => {
    let userProfileListener = null;

    if (currentUser) {
      console.log(
        "Setting up real-time listener for user profile with ID:",
        currentUser.uid
      );
      userProfileListener = onSnapshot(
        doc(db, "users", currentUser.uid),
        (doc) => {
          if (doc.exists()) {
            const userData = doc.data();
            console.log("User profile updated in real-time:", userData);
            console.log("Updated role:", userData.role);
            console.log("Updated teamId:", userData.teamId || "No teamId set");
            setUserProfile(userData);
          }
        }
      );
    }

    return () => {
      if (userProfileListener) {
        console.log("Cleaning up user profile listener");
        userProfileListener();
      }
    };
  }, [currentUser]); // Calculate role flags using case-insensitive comparison
  const isAdmin =
    currentUser &&
    userProfile?.role &&
    (userProfile.role.toLowerCase() === "admin" ||
      userProfile.role.toLowerCase() === "teammanager" ||
      userProfile.role.toLowerCase() === "teammanager"); // Check both "teammanager" and "teamManager"
  const isSuperAdmin =
    currentUser &&
    userProfile?.role &&
    userProfile.role.toLowerCase() === "superadmin";

  const value = {
    currentUser,
    userProfile,
    isAuthenticated: !!currentUser,
    loading,
    isAdmin,
    isSuperAdmin,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
