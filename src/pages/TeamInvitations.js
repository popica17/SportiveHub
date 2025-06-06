import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  Timestamp,
  getDoc,
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";

function TeamInvitations() {
  const { currentUser, userProfile } = useAuth();
  const [invitations, setInvitations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    if (currentUser) {
      fetchInvitations();
    }
  }, [currentUser]);

  const fetchInvitations = async () => {
    if (!currentUser) return;

    setIsLoading(true);
    try {
      const invitesQuery = query(
        collection(db, "teamInvites"),
        where("userEmail", "==", currentUser.email),
        where("status", "==", "pending")
      );

      const querySnapshot = await getDocs(invitesQuery);
      const invitesData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setInvitations(invitesData);
    } catch (err) {
      console.error("Error fetching invitations:", err);
      setError("Failed to load team invitations");
    } finally {
      setIsLoading(false);
    }
  };
  const handleInviteResponse = async (inviteId, teamId, accept) => {
    try {
      // Update invitation status
      await updateDoc(doc(db, "teamInvites", inviteId), {
        status: accept ? "accepted" : "declined",
        respondedAt: Timestamp.now(),
      });

      if (accept) {
        // Get team reference
        const teamRef = doc(db, "teams", teamId);
        const teamDoc = await getDoc(teamRef);

        if (teamDoc.exists()) {
          const teamData = teamDoc.data();
          const updatedMemberIds = [
            ...(teamData.memberIds || []),
            currentUser.uid,
          ];

          // Update team members list
          await updateDoc(teamRef, {
            memberIds: updatedMemberIds,
          });

          // Update user profile
          if (userProfile && userProfile.id) {
            await updateDoc(doc(db, "users", userProfile.id), {
              teamId: teamId,
              role: "player",
            });
          }

          // Update memberCount in all tournament registrations that include this team
          const updatedMemberCount = updatedMemberIds.length;
          console.log(
            `Team ${teamData.name} now has ${updatedMemberCount} members after adding a new player.`
          );

          const tournamentTeamsQuery = query(
            collection(db, "tournamentTeams"),
            where("teamId", "==", teamId)
          );

          const tournamentTeamsSnapshot = await getDocs(tournamentTeamsQuery);

          if (!tournamentTeamsSnapshot.empty) {
            console.log(
              `Updating ${tournamentTeamsSnapshot.size} tournament registrations with new member count: ${updatedMemberCount}`
            );

            const updatePromises = tournamentTeamsSnapshot.docs.map(
              (registrationDoc) => {
                return updateDoc(registrationDoc.ref, {
                  memberCount: updatedMemberCount,
                });
              }
            );

            await Promise.all(updatePromises);
            console.log("All tournament registrations updated successfully");
          }

          setSuccessMessage("You have successfully joined the team!");
        } else {
          setError("Team no longer exists");
        }
      } else {
        setSuccessMessage("Invitation declined");
      }

      // Refresh invitations
      fetchInvitations();
    } catch (err) {
      console.error("Error responding to invitation:", err);
      setError("Failed to process your response");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Team Invitations
          </h1>
          <p className="text-lg text-gray-600">Manage your team invitations</p>
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

        <div className="max-w-3xl mx-auto">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">Loading invitations...</p>
            </div>
          ) : invitations.length > 0 ? (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">
                  Pending Invitations
                </h2>
                <div className="space-y-4">
                  {invitations.map((invite) => (
                    <div
                      key={invite.id}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                        <div>
                          <h3 className="font-medium text-lg">
                            {invite.teamName}
                          </h3>
                          <p className="text-gray-600 text-sm">
                            Invitation from {invite.managerName}
                          </p>
                          <p className="text-gray-500 text-xs mt-1">
                            Sent on{" "}
                            {new Date(
                              invite.createdAt.seconds * 1000
                            ).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="flex gap-2 mt-3 md:mt-0">
                          <button
                            onClick={() =>
                              handleInviteResponse(
                                invite.id,
                                invite.teamId,
                                false
                              )
                            }
                            className="px-4 py-1 border border-gray-300 text-gray-700 rounded hover:bg-gray-100"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() =>
                              handleInviteResponse(
                                invite.id,
                                invite.teamId,
                                true
                              )
                            }
                            className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Accept
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-lg shadow-md text-center">
              <h2 className="text-xl font-semibold mb-2">
                No Pending Invitations
              </h2>
              <p className="text-gray-600">
                You don't have any team invitations at the moment.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TeamInvitations;
