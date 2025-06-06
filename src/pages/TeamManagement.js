import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
  deleteDoc,
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";

function TeamManagement() {
  const { currentUser, userProfile, isAdmin, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [team, setTeam] = useState(null);
  const [isCreateTeamModalOpen, setIsCreateTeamModalOpen] = useState(false);
  const [isEditTeamModalOpen, setIsEditTeamModalOpen] = useState(false);
  const [isDeleteTeamModalOpen, setIsDeleteTeamModalOpen] = useState(false);
  const [isRemovePlayerModalOpen, setIsRemovePlayerModalOpen] = useState(false);
  const [selectedPlayerToRemove, setSelectedPlayerToRemove] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [pendingInvites, setPendingInvites] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [confirmDeleteInput, setConfirmDeleteInput] = useState("");
  const [isEditingExternalTeam, setIsEditingExternalTeam] = useState(false);

  // Get teamId from URL if provided (for superadmin editing)
  const urlParams = new URLSearchParams(location.search);
  const editTeamId = urlParams.get("edit");

  // Form state for team creation/editing
  const [formData, setFormData] = useState({
    name: "",
    sport: "Football",
    logo: "",
    description: "",
  });

  // Check if user can manage this team (is team manager or superadmin)
  const canManageTeam =
    team && (team.managerId === currentUser?.uid || isSuperAdmin);

  // Check if we should load a specific team from URL param
  useEffect(() => {
    if (editTeamId && isSuperAdmin) {
      fetchSpecificTeam(editTeamId);
      setIsEditingExternalTeam(true);
    } else if (currentUser) {
      console.log("Fetching team data - currentUser:", currentUser.uid);
      console.log("Current userProfile state:", userProfile);
      fetchTeamData();
    }
  }, [currentUser, userProfile, editTeamId, isSuperAdmin]);

  const fetchSpecificTeam = async (teamId) => {
    setIsLoading(true);
    try {
      const teamRef = doc(db, "teams", teamId);
      const teamDoc = await getDoc(teamRef);

      if (teamDoc.exists()) {
        const teamData = teamDoc.data();
        setTeam({ id: teamDoc.id, ...teamData });
        setSuccessMessage("You are editing this team as a Super Admin");

        // Fetch team members
        await fetchTeamMembers(teamData.memberIds || []);
        // Fetch pending invites
        await fetchPendingInvites(teamDoc.id);
      } else {
        setError("Team not found");
        setTimeout(() => {
          navigate("/");
        }, 3000);
      }
    } catch (err) {
      console.error("Error fetching team data:", err);
      setError("Failed to load team information");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTeamData = async () => {
    setIsLoading(true);
    try {
      // First, get the latest user data to ensure teamId is up to date
      const userRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();

      console.log("Current user data from Firestore:", userData);
      console.log("Current teamId in user profile:", userData?.teamId);

      // Check if user is a team manager
      const teamQuery = query(
        collection(db, "teams"),
        where("managerId", "==", currentUser.uid)
      );
      const teamSnapshot = await getDocs(teamQuery);

      // Check if user is a team member
      const memberTeamQuery = query(
        collection(db, "teams"),
        where("memberIds", "array-contains", currentUser.uid)
      );
      const memberTeamSnapshot = await getDocs(memberTeamQuery);

      if (!teamSnapshot.empty) {
        // User is a team manager
        const teamData = teamSnapshot.docs[0].data();
        setTeam({ id: teamSnapshot.docs[0].id, ...teamData });

        // Fetch team members
        await fetchTeamMembers(teamData.memberIds || []);
        // Fetch pending invites
        await fetchPendingInvites(teamSnapshot.docs[0].id);
      } else if (!memberTeamSnapshot.empty) {
        // User is a team member
        const teamData = memberTeamSnapshot.docs[0].data();
        setTeam({
          id: memberTeamSnapshot.docs[0].id,
          ...teamData,
          isManager: false,
        });

        // Fetch team members
        await fetchTeamMembers(teamData.memberIds || []);
      } else {
        // User has no team
        setTeam(null);
      }
    } catch (err) {
      console.error("Error fetching team data:", err);
      setError("Failed to load team information");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTeamMembers = async (memberIds) => {
    if (!memberIds.length) {
      setTeamMembers([]);
      return;
    }

    try {
      const members = [];
      for (const memberId of memberIds) {
        const userDoc = await getDoc(doc(db, "users", memberId));
        if (userDoc.exists()) {
          members.push({
            id: memberId,
            ...userDoc.data(),
          });
        }
      }
      setTeamMembers(members);
    } catch (err) {
      console.error("Error fetching team members:", err);
    }
  };

  const fetchPendingInvites = async (teamId) => {
    try {
      const invitesQuery = query(
        collection(db, "teamInvites"),
        where("teamId", "==", teamId),
        where("status", "==", "pending")
      );
      const invitesSnapshot = await getDocs(invitesQuery);
      const invites = invitesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPendingInvites(invites);
    } catch (err) {
      console.error("Error fetching pending invites:", err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      setError("You must be logged in to create a team");
      return;
    }

    if (!isAdmin) {
      setError("Only admin users can create teams");
      return;
    }

    try {
      const teamData = {
        ...formData,
        managerId: currentUser.uid,
        managerName:
          currentUser.displayName ||
          userProfile?.firstName ||
          currentUser.email,
        memberIds: [currentUser.uid], // Manager is also a member
        createdAt: Timestamp.now(),
      };

      console.log("Creating team with data:", teamData);
      const teamRef = await addDoc(collection(db, "teams"), teamData);
      console.log("Team created with ID:", teamRef.id);

      // Update user profile to indicate they're a team manager with correct capitalization
      // This should match the Firestore rules which expect "teamManager" with capital M
      const userRef = doc(db, "users", currentUser.uid);

      try {
        await updateDoc(userRef, {
          teamId: teamRef.id,
          role: "teamManager", // Ensuring correct capitalization here
        });

        // Verify the update was successful by fetching the updated user document
        const updatedUserDoc = await getDoc(userRef);
        console.log("Updated user profile:", updatedUserDoc.data());
        console.log("TeamId in database:", updatedUserDoc.data().teamId);
        console.log("User role in database:", updatedUserDoc.data().role);
      } catch (updateError) {
        console.error("Error updating user profile:", updateError);
        throw updateError; // Re-throw to handle in the outer catch block
      }

      setSuccessMessage("Team created successfully!");
      setIsCreateTeamModalOpen(false);
      setFormData({
        name: "",
        sport: "Football",
        logo: "",
        description: "",
      });
      // Reload the entire userProfile to ensure we have the latest data
      try {
        const refreshedUserRef = doc(db, "users", currentUser.uid);
        const refreshedUserDoc = await getDoc(refreshedUserRef);

        if (refreshedUserDoc.exists()) {
          const refreshedData = refreshedUserDoc.data();
          console.log(
            "After team creation - refreshed user data:",
            refreshedData
          );
          console.log("TeamId in refreshed data:", refreshedData.teamId);
        }
      } catch (refreshError) {
        console.error("Error refreshing user data:", refreshError);
      }

      // Refresh team data
      fetchTeamData();
    } catch (error) {
      console.error("Error creating team:", error);
      setError("Failed to create team. Please try again.");
    }
  };
  const handleInvitePlayer = async (e) => {
    e.preventDefault();

    if (!team) {
      setError("You need a team to invite players");
      return;
    }

    if (!canManageTeam) {
      setError("You don't have permission to invite players to this team");
      return;
    }

    try {
      // Check if email exists in user collection
      const usersQuery = query(
        collection(db, "users"),
        where("email", "==", inviteEmail)
      );
      const userSnapshot = await getDocs(usersQuery);

      if (userSnapshot.empty) {
        setError("No user found with that email address");
        return;
      }

      const userData = userSnapshot.docs[0].data();
      const userId = userSnapshot.docs[0].id;

      // Check if user is already in a team
      if (userData.teamId) {
        setError("This user is already part of a team");
        return;
      }

      // Create invitation
      await addDoc(collection(db, "teamInvites"), {
        teamId: team.id,
        teamName: team.name,
        userId: userId,
        userEmail: inviteEmail,
        managerId: currentUser.uid,
        managerName:
          currentUser.displayName ||
          userProfile?.firstName ||
          currentUser.email,
        status: "pending",
        createdAt: Timestamp.now(),
      });

      setSuccessMessage("Invitation sent successfully!");
      setInviteEmail("");

      // Refresh pending invites
      fetchPendingInvites(team.id);
    } catch (error) {
      console.error("Error sending invitation:", error);
      setError("Failed to send invitation. Please try again.");
    }
  };
  // Function to show player removal modal
  const handleRemovePlayerClick = (playerId) => {
    if (!canManageTeam) {
      setError("You don't have permission to remove players from this team");
      return;
    }

    // Make sure we don't remove the team manager
    if (playerId === team.managerId) {
      setError("You cannot remove the team manager");
      return;
    }

    // Find the player details
    const playerToRemove = teamMembers.find((member) => member.id === playerId);

    if (playerToRemove) {
      setSelectedPlayerToRemove(playerToRemove);
      setIsRemovePlayerModalOpen(true);
    }
  };
  // Function to remove a player from the team
  const handleRemovePlayer = async () => {
    if (!selectedPlayerToRemove || !canManageTeam) {
      return;
    }

    try {
      setIsLoading(true);
      const playerId = selectedPlayerToRemove.id;

      // Update the team document to remove player from memberIds
      const teamRef = doc(db, "teams", team.id);
      await updateDoc(teamRef, {
        memberIds: arrayRemove(playerId),
      });

      // Update the player's user document to remove teamId
      const userRef = doc(db, "users", playerId);
      // Check if the player is a superadmin first
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();

        if (userData.role === "superadmin") {
          // Just remove team association, preserve superadmin role
          await updateDoc(userRef, {
            teamId: null,
          });
        } else {
          await updateDoc(userRef, {
            teamId: null,
            role: "user", // Reset role to regular user
          });
        }
      }

      // Get the updated member count after removal
      const updatedTeamDoc = await getDoc(teamRef);
      const updatedMemberCount = updatedTeamDoc.exists()
        ? updatedTeamDoc.data().memberIds?.length || 0
        : 0;

      console.log(
        `Team ${team.name} now has ${updatedMemberCount} members after removal.`
      );

      // Update memberCount in all tournament registrations that include this team
      const tournamentTeamsQuery = query(
        collection(db, "tournamentTeams"),
        where("teamId", "==", team.id)
      );

      const tournamentTeamsSnapshot = await getDocs(tournamentTeamsQuery);

      if (!tournamentTeamsSnapshot.empty) {
        console.log(
          `Updating ${tournamentTeamsSnapshot.size} tournament registrations with new member count: ${updatedMemberCount}`
        );

        const updatePromises = tournamentTeamsSnapshot.docs.map((doc) => {
          return updateDoc(doc.ref, {
            memberCount: updatedMemberCount,
          });
        });

        await Promise.all(updatePromises);
        console.log("All tournament registrations updated successfully");
      }

      setSuccessMessage("Player removed from the team successfully");
      setIsRemovePlayerModalOpen(false);
      setSelectedPlayerToRemove(null);

      // Refresh data - use the appropriate fetch based on context
      if (isEditingExternalTeam) {
        fetchSpecificTeam(team.id);
      } else {
        fetchTeamData();
      }
    } catch (error) {
      console.error("Error removing player:", error);
      setError("Failed to remove player. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Function to open the edit team modal
  const handleEditTeamClick = () => {
    if (!canManageTeam) {
      setError("You don't have permission to edit this team");
      return;
    }

    // Pre-populate form with current team data
    setFormData({
      name: team.name || "",
      sport: team.sport || "Football",
      logo: team.logo || "",
      description: team.description || "",
    });

    setIsEditTeamModalOpen(true);
  };

  // Function to update team details
  const handleUpdateTeam = async (e) => {
    e.preventDefault();

    if (!canManageTeam) {
      setError("You don't have permission to update this team");
      return;
    }

    try {
      const teamRef = doc(db, "teams", team.id);
      await updateDoc(teamRef, {
        name: formData.name,
        sport: formData.sport,
        logo: formData.logo,
        description: formData.description,
        updatedAt: Timestamp.now(),
      });

      setSuccessMessage("Team updated successfully!");
      setIsEditTeamModalOpen(false);

      // Refresh data - use the appropriate fetch based on context
      if (isEditingExternalTeam) {
        fetchSpecificTeam(team.id);
      } else {
        fetchTeamData();
      }
    } catch (error) {
      console.error("Error updating team:", error);
      setError("Failed to update team. Please try again.");
    }
  };

  // Function to delete the team
  const handleDeleteTeam = async () => {
    if (!canManageTeam) {
      setError("You don't have permission to delete this team");
      return;
    }

    if (confirmDeleteInput !== team.name) {
      setError("Team name confirmation doesn't match");
      return;
    }

    try {
      setIsLoading(true);

      // 1. Get all team members
      const memberIds = team.memberIds || [];
      // 2. Update each member's user document to remove teamId
      const updateMemberPromises = memberIds.map(async (memberId) => {
        const userRef = doc(db, "users", memberId);
        // Get current user data to check if they're a superadmin
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();

          // Don't change the role of superadmins
          if (userData.role === "superadmin") {
            return updateDoc(userRef, {
              teamId: null, // Just remove team association, keep superadmin role
            });
          } else {
            return updateDoc(userRef, {
              teamId: null,
              role: memberId === team.managerId ? "admin" : "user", // Keep admin role for team manager
            });
          }
        }
      });

      await Promise.all(updateMemberPromises);
      // 3. Delete all pending invites
      const invitesQuery = query(
        collection(db, "teamInvites"),
        where("teamId", "==", team.id)
      );

      const invitesSnapshot = await getDocs(invitesQuery);
      const deleteInvitesPromises = invitesSnapshot.docs.map((doc) =>
        deleteDoc(doc.ref)
      );

      await Promise.all(deleteInvitesPromises);

      // 4. Remove the team from any tournaments it's registered for
      const tournamentTeamsQuery = query(
        collection(db, "tournamentTeams"),
        where("teamId", "==", team.id)
      );

      const tournamentTeamsSnapshot = await getDocs(tournamentTeamsQuery);

      if (!tournamentTeamsSnapshot.empty) {
        console.log(
          `Team is registered in ${tournamentTeamsSnapshot.size} tournaments, removing...`
        );

        // First, update participant counts in the affected tournaments
        const tournamentUpdates = [];

        for (const registration of tournamentTeamsSnapshot.docs) {
          const tournamentId = registration.data().tournamentId;
          const tournamentRef = doc(db, "tournaments", tournamentId);
          const tournamentDoc = await getDoc(tournamentRef);

          if (tournamentDoc.exists()) {
            const currentParticipants = tournamentDoc.data().participants || 0;
            if (currentParticipants > 0) {
              tournamentUpdates.push(
                updateDoc(tournamentRef, {
                  participants: currentParticipants - 1,
                })
              );
            }
          }
        }

        await Promise.all(tournamentUpdates);

        // Then delete all team registrations
        const deleteRegistrationPromises = tournamentTeamsSnapshot.docs.map(
          (doc) => deleteDoc(doc.ref)
        );
        await Promise.all(deleteRegistrationPromises);
      }

      // 5. Delete the team
      await deleteDoc(doc(db, "teams", team.id));

      setSuccessMessage("Team deleted successfully");
      setIsDeleteTeamModalOpen(false);
      setConfirmDeleteInput("");

      // Redirect based on context
      if (isEditingExternalTeam) {
        setTimeout(() => {
          navigate("/admin/dashboard");
        }, 2000);
      } else {
        setTimeout(() => {
          navigate("/");
        }, 2000);
      }
    } catch (error) {
      console.error("Error deleting team:", error);
      setError("Failed to delete team. Please try again.");
      setIsLoading(false);
    }
  };

  // Returns to admin dashboard when closing external edit mode
  const handleBackToAdmin = () => {
    navigate("/admin/dashboard");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Team Management
          </h1>
          {isEditingExternalTeam && (
            <button
              onClick={handleBackToAdmin}
              className="mt-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Back to Admin Dashboard
            </button>
          )}
        </div>
        {/* Error and success messages */}
        {error && (
          <div className="max-w-2xl mx-auto mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="max-w-2xl mx-auto mb-6 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            {successMessage}
          </div>
        )}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading team information...</p>
          </div>
        ) : team ? (
          <div className="max-w-4xl mx-auto">
            {" "}
            {/* Team Information Card */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <div className="flex flex-col md:flex-row items-start gap-6">
                <div className="w-32 h-32 bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
                  {team.logo ? (
                    <img
                      src={team.logo}
                      alt={team.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl text-gray-400">
                      {team.name.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-800">
                        {team.name}
                      </h2>
                      <p className="text-blue-600 font-medium">{team.sport}</p>
                      <p className="text-gray-500 mt-2 text-sm">
                        Managed by: {team.managerName}
                      </p>
                    </div>

                    {/* Management Actions for team owners and superadmins */}
                    {canManageTeam && (
                      <div className="flex space-x-2">
                        <button
                          onClick={handleEditTeamClick}
                          className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                        >
                          Edit Team
                        </button>
                        <button
                          onClick={() => setIsDeleteTeamModalOpen(true)}
                          className="px-3 py-1 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
                        >
                          Delete Team
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="mt-4 text-gray-700">{team.description}</p>

                  {isSuperAdmin && team.managerId !== currentUser.uid && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-yellow-700 text-sm">
                        <span className="font-bold">Super Admin Note:</span> You
                        have administrative access to manage this team.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>{" "}
            {/* Team Members Section */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                Team Members
              </h3>
              {teamMembers.length === 0 ? (
                <p className="text-gray-600">No team members yet.</p>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {teamMembers.map((member) => (
                    <li
                      key={member.id}
                      className="py-4 flex items-center justify-between"
                    >
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-800 font-medium">
                          {member.firstName?.charAt(0) ||
                            member.email?.charAt(0)}
                        </div>
                        <div className="ml-3">
                          <p className="font-medium text-gray-800">
                            {member.firstName} {member.lastName || ""}
                          </p>
                          <p className="text-sm text-gray-500">
                            {member.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 text-xs rounded-full ${
                            member.id === team.managerId
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {member.id === team.managerId ? "Manager" : "Player"}
                        </span>
                        {/* Remove player button - only for non-managers and only visible to team manager or superadmin */}
                        {canManageTeam && member.id !== team.managerId && (
                          <button
                            onClick={() => handleRemovePlayerClick(member.id)}
                            className="ml-2 text-xs px-2 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded"
                            title="Remove player"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>{" "}
            {/* Player Invitation Section - For team managers and superadmins */}
            {canManageTeam && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">
                  Invite Players
                </h3>
                <form onSubmit={handleInvitePlayer} className="flex gap-2 mb-4">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Enter player's email"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Send Invite
                  </button>
                </form>

                {/* Pending Invitations */}
                {pendingInvites.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium text-gray-700 mb-2">
                      Pending Invitations
                    </h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {pendingInvites.map((invite) => (
                        <li
                          key={invite.id}
                          className="flex items-center justify-between"
                        >
                          <span>{invite.userEmail}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              Sent{" "}
                              {new Date(
                                invite.createdAt.seconds * 1000
                              ).toLocaleDateString()}
                            </span>
                            <button
                              onClick={async () => {
                                try {
                                  await deleteDoc(
                                    doc(db, "teamInvites", invite.id)
                                  );
                                  setSuccessMessage(
                                    "Invitation canceled successfully"
                                  );
                                  fetchPendingInvites(team.id);
                                } catch (error) {
                                  console.error(
                                    "Error canceling invitation:",
                                    error
                                  );
                                  setError("Failed to cancel invitation");
                                }
                              }}
                              className="text-xs text-red-600 hover:text-red-800"
                            >
                              Cancel
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-4">
                You don't have a team yet
              </h3>
              {isAdmin ? (
                <div>
                  <p className="text-gray-600 mb-4">
                    As an admin, you can create a team and invite players to
                    join.
                  </p>
                  <button
                    onClick={() => setIsCreateTeamModalOpen(true)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Create a Team
                  </button>
                </div>
              ) : (
                <p className="text-gray-600">
                  You need to be invited to a team by a team manager. Once
                  invited, you'll receive a notification.
                </p>
              )}
            </div>
          </div>
        )}{" "}
        {/* Create Team Modal */}
        {isCreateTeamModalOpen && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 m-4 max-w-xl w-full">
              <h2 className="text-2xl font-bold mb-4">Create a New Team</h2>
              <form onSubmit={handleCreateTeam} className="space-y-4">
                <div>
                  <label className="block text-gray-700 mb-1">Team Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-1">Sport</label>
                  <select
                    name="sport"
                    value={formData.sport}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  >
                    <option value="Football">Football</option>
                    <option value="Basketball">Basketball</option>
                    <option value="Tennis">Tennis</option>
                    <option value="Volleyball">Volleyball</option>
                    <option value="Swimming">Swimming</option>
                    <option value="Athletics">Athletics</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 mb-1">
                    Team Logo URL (optional)
                  </label>
                  <input
                    type="url"
                    name="logo"
                    value={formData.logo}
                    onChange={handleInputChange}
                    placeholder="https://example.com/logo.png"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  ></textarea>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateTeamModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Create Team
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Edit Team Modal */}
        {isEditTeamModalOpen && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 m-4 max-w-xl w-full">
              <h2 className="text-2xl font-bold mb-4">Edit Team</h2>
              <form onSubmit={handleUpdateTeam} className="space-y-4">
                <div>
                  <label className="block text-gray-700 mb-1">Team Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-1">Sport</label>
                  <select
                    name="sport"
                    value={formData.sport}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  >
                    <option value="Football">Football</option>
                    <option value="Basketball">Basketball</option>
                    <option value="Tennis">Tennis</option>
                    <option value="Volleyball">Volleyball</option>
                    <option value="Swimming">Swimming</option>
                    <option value="Athletics">Athletics</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 mb-1">
                    Team Logo URL (optional)
                  </label>
                  <input
                    type="url"
                    name="logo"
                    value={formData.logo}
                    onChange={handleInputChange}
                    placeholder="https://example.com/logo.png"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  ></textarea>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditTeamModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Update Team
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Delete Team Modal */}
        {isDeleteTeamModalOpen && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 m-4 max-w-xl w-full">
              <h2 className="text-2xl font-bold text-red-600 mb-2">
                Delete Team
              </h2>
              <p className="text-gray-700 mb-4">
                This action cannot be undone. All team members will be removed
                from the team, and all pending invitations will be canceled.
              </p>

              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                <p className="text-red-700 text-sm mb-2">
                  To confirm deletion, please type the team name:{" "}
                  <span className="font-bold">{team.name}</span>
                </p>
                <input
                  type="text"
                  value={confirmDeleteInput}
                  onChange={(e) => setConfirmDeleteInput(e.target.value)}
                  className="w-full px-3 py-2 border border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Type team name to confirm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteTeamModalOpen(false);
                    setConfirmDeleteInput("");
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteTeam}
                  disabled={confirmDeleteInput !== team.name || isLoading}
                  className={`px-4 py-2 text-white rounded-md ${
                    confirmDeleteInput !== team.name || isLoading
                      ? "bg-red-400 cursor-not-allowed"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {isLoading ? "Deleting..." : "Delete Team"}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Remove Player Modal */}
        {isRemovePlayerModalOpen && selectedPlayerToRemove && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 m-4 max-w-xl w-full">
              <h2 className="text-2xl font-bold text-red-600 mb-2">
                Remove Player
              </h2>
              <p className="text-gray-700 mb-4">
                You are about to remove{" "}
                <span className="font-semibold">
                  {selectedPlayerToRemove.firstName}{" "}
                  {selectedPlayerToRemove.lastName}
                </span>{" "}
                from the team.
              </p>

              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-800 font-medium mr-4">
                    {selectedPlayerToRemove.firstName?.charAt(0) ||
                      selectedPlayerToRemove.email?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">
                      {selectedPlayerToRemove.firstName}{" "}
                      {selectedPlayerToRemove.lastName || ""}
                    </p>
                    <p className="text-sm text-gray-600">
                      {selectedPlayerToRemove.email}
                    </p>
                  </div>
                </div>
                <p className="text-red-700 text-sm mt-3">
                  This player will lose access to the team. This action cannot
                  be undone.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsRemovePlayerModalOpen(false);
                    setSelectedPlayerToRemove(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRemovePlayer}
                  disabled={isLoading}
                  className={`px-4 py-2 text-white rounded-md ${
                    isLoading
                      ? "bg-red-400 cursor-not-allowed"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {isLoading ? "Removing..." : "Remove Player"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TeamManagement;
