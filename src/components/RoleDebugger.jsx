import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function RoleDebugger() {
  const { currentUser, userProfile, isAdmin, isSuperAdmin } = useAuth();

  // Only show this component in development
  if (process.env.NODE_ENV !== "development") return null;

  // Don't show if not logged in
  if (!currentUser) return null;
  const makeUserAdmin = async () => {
    if (!currentUser) return;

    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, { role: "admin" });
      alert("Role updated to admin! Please refresh the page.");
    } catch (error) {
      console.error("Error updating role:", error);
      alert("Error updating role. See console for details.");
    }
  };

  const makeUserSuperAdmin = async () => {
    if (!currentUser) return;

    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, { role: "superadmin" });
      alert("Role updated to superadmin! Please refresh the page.");
    } catch (error) {
      console.error("Error updating role:", error);
      alert("Error updating role. See console for details.");
    }
  };

  const makeTeamManager = async () => {
    if (!currentUser) return;

    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, { role: "teamManager" });
      alert("Role updated to teamManager! Please refresh the page.");
    } catch (error) {
      console.error("Error updating role:", error);
      alert("Error updating role. See console for details.");
    }
  };
  const resetToUser = async () => {
    if (!currentUser) return;

    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, { role: "user" });
      alert("Role reset to user! Please refresh the page.");
    } catch (error) {
      console.error("Error updating role:", error);
      alert("Error updating role. See console for details.");
    }
  };

  const setTeamId = async () => {
    if (!currentUser) return;

    const teamId = prompt("Enter team ID to assign to user:");
    if (!teamId) return;

    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, { teamId });
      alert(`Team ID set to: ${teamId}! Please refresh the page.`);
    } catch (error) {
      console.error("Error updating teamId:", error);
      alert("Error updating teamId. See console for details.");
    }
  };

  const clearTeamId = async () => {
    if (!currentUser) return;

    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, { teamId: null });
      alert("Team ID cleared! Please refresh the page.");
    } catch (error) {
      console.error("Error clearing teamId:", error);
      alert("Error clearing teamId. See console for details.");
    }
  };

  return (
    <div className="fixed bottom-4 right-4 p-4 bg-gray-100 border border-gray-300 rounded-lg shadow-lg z-50">
      <h4 className="font-bold mb-2 text-sm">Developer Role Tools</h4>
      <div className="mb-2 text-xs">
        <p>User ID: {currentUser.uid}</p>
        <p>Email: {currentUser.email}</p>
        <p>
          Role: <strong>{userProfile?.role || "undefined"}</strong>
        </p>
        <p>isAdmin: {isAdmin ? "true" : "false"}</p>
        <p>isSuperAdmin: {isSuperAdmin ? "true" : "false"}</p>
      </div>{" "}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={makeUserAdmin}
          className="bg-blue-500 text-white text-xs px-2 py-1 rounded hover:bg-blue-600"
        >
          Make Admin
        </button>

        <button
          onClick={makeTeamManager}
          className="bg-green-500 text-white text-xs px-2 py-1 rounded hover:bg-green-600"
        >
          Make TeamManager
        </button>

        <button
          onClick={makeUserSuperAdmin}
          className="bg-purple-500 text-white text-xs px-2 py-1 rounded hover:bg-purple-600"
        >
          Make SuperAdmin
        </button>

        <button
          onClick={resetToUser}
          className="bg-gray-500 text-white text-xs px-2 py-1 rounded hover:bg-gray-600"
        >
          Reset to User
        </button>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        <button
          onClick={setTeamId}
          className="bg-yellow-500 text-white text-xs px-2 py-1 rounded hover:bg-yellow-600"
        >
          Set TeamId
        </button>

        <button
          onClick={clearTeamId}
          className="bg-red-500 text-white text-xs px-2 py-1 rounded hover:bg-red-600"
        >
          Clear TeamId
        </button>
      </div>
      <div className="mt-2 text-xs">
        <p>
          TeamId: <strong>{userProfile?.teamId || "none"}</strong>
        </p>
      </div>
    </div>
  );
}
