import React, { useState } from "react";
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
} from "firebase/auth";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  doc,
  deleteDoc,
  query,
  collection,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";

function Profile() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [loading, setLoading] = useState(false);

  const changePassword = async (e) => {
    e.preventDefault();

    if (!currentPassword) {
      setMessage({ text: "Please enter your current password", type: "error" });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ text: "Passwords do not match", type: "error" });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({
        text: "New password must be at least 6 characters",
        type: "error",
      });
      return;
    }

    setLoading(true);
    setMessage({ text: "", type: "" });

    try {
      // First re-authenticate the user with their current password
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        currentPassword
      );

      await reauthenticateWithCredential(currentUser, credential);

      // Then update the password
      await updatePassword(currentUser, newPassword);

      setMessage({ text: "Password updated successfully", type: "success" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
    } catch (error) {
      console.error("Error updating password:", error.message);

      if (error.code === "auth/wrong-password") {
        setMessage({ text: "Current password is incorrect", type: "error" });
      } else {
        setMessage({
          text: error.message.includes("requires-recent-login")
            ? "Please log out and log in again before changing your password"
            : "Error updating password: " + error.message,
          type: "error",
        });
      }
    } finally {
      setLoading(false);
    }
  };
  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteConfirm(false);
  };

  const deleteAccount = async () => {
    setLoading(true);
    try {
      // Get user ID for Firestore operations
      const userId = currentUser.uid;

        // 1. Delete user's tournament registrations
        const participantsQuery = query(
          collection(db, "tournamentParticipants"),
          where("userId", "==", userId)
        );

        const participantsSnapshot = await getDocs(participantsQuery);
        const deleteParticipantsPromises = participantsSnapshot.docs.map(
          (doc) => deleteDoc(doc.ref)
        );
        await Promise.all(deleteParticipantsPromises);

        // 2. Delete tournaments created by the user
        const tournamentsQuery = query(
          collection(db, "tournaments"),
          where("createdBy", "==", userId)
        );

        const tournamentsSnapshot = await getDocs(tournamentsQuery);
        const deleteTournamentsPromises = tournamentsSnapshot.docs.map((doc) =>
          deleteDoc(doc.ref)
        );
        await Promise.all(deleteTournamentsPromises);

        // 3. Delete user document from users collection
        await deleteDoc(doc(db, "users", userId));

        // 4. Finally delete the authentication account
        await deleteUser(currentUser);

        // 5. Redirect to home page
        navigate("/");
      } catch (error) {
        console.error("Error deleting account:", error.message);        setMessage({
          text: error.message.includes("requires-recent-login")
            ? "Please log out and log in again before deleting your account"
            : "Error deleting account: " + error.message,
          type: "error",
        });
        setLoading(false);
      }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-2xl">
        <div className="p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">My Profile</h2>

          {message.text && (
            <div
              className={`mb-4 p-3 rounded ${
                message.type === "success"
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="space-y-4 mb-8">
            <div className="flex border-b border-gray-200 py-3">
              <span className="font-medium text-gray-700 w-1/3">Email:</span>
              <span className="text-gray-900">{currentUser?.email}</span>
            </div>

            <div className="flex border-b border-gray-200 py-3">
              <span className="font-medium text-gray-700 w-1/3">Name:</span>
              <span className="text-gray-900">
                {userProfile?.firstName} {userProfile?.lastName}
                {!userProfile?.firstName &&
                  !userProfile?.lastName &&
                  currentUser?.displayName && (
                    <span>{currentUser.displayName}</span>
                  )}
                {!userProfile?.firstName &&
                  !userProfile?.lastName &&
                  !currentUser?.displayName && (
                    <span className="text-gray-400">Not provided</span>
                  )}
              </span>
            </div>

            <div className="flex border-b border-gray-200 py-3">
              <span className="font-medium text-gray-700 w-1/3">Role:</span>
              <span className="text-gray-900">
                {userProfile?.role || "User"}
              </span>
            </div>
          </div>

          {/* Change Password Section */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              Account Settings
            </h3>

            {!showPasswordForm ? (
              <button
                onClick={() => setShowPasswordForm(true)}
                className="text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Change Password
              </button>
            ) : (
              <form onSubmit={changePassword} className="space-y-3">
                <div>
                  <label
                    htmlFor="currentPassword"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Current Password
                  </label>
                  <input
                    type="password"
                    id="currentPassword"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="newPassword"
                    className="block text-sm font-medium text-gray-700"
                  >
                    New Password
                  </label>
                  <input
                    type="password"
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className={`text-sm font-medium py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                              ${
                                loading
                                  ? "bg-blue-400"
                                  : "bg-blue-600 hover:bg-blue-700"
                              } text-white`}
                  >
                    {loading ? "Updating..." : "Update Password"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                      setMessage({ text: "", type: "" });
                    }}
                    className="text-sm border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}            <div className="mt-6">
              <button
                onClick={handleDeleteClick}
                disabled={loading}
                className={`text-sm ${
                  loading ? "bg-red-400" : "bg-red-600 hover:bg-red-700"
                } text-white font-medium py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500`}
              >
                {loading ? "Processing..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  ></path>
                </svg>
              </div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-2">Delete Account</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-600">
                  Once you delete your account, there is no going back. Please be certain.
                </p>
              </div>
              <div className="flex justify-center gap-4 mt-4">
                <button
                  onClick={closeDeleteModal}
                  className="px-4 py-2 bg-gray-300 text-gray-700 text-base font-medium rounded-md shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={deleteAccount}
                  disabled={loading}
                  className={`px-4 py-2 text-white text-base font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 ${
                    loading ? "bg-red-400" : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {loading ? "Processing..." : "Delete Account"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default Profile;
