import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  deleteDoc,
  orderBy,
  getDoc,
  updateDoc,
  arrayRemove,
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";

function AdminDashboard() {
  const { currentUser, userProfile, isAdmin, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState([]);
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteTeamConfirm, setDeleteTeamConfirm] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState([]);
  const [isViewMembersModalOpen, setIsViewMembersModalOpen] = useState(false);
  const [isDeleteTeamModalOpen, setIsDeleteTeamModalOpen] = useState(false);
  const [confirmDeleteInput, setConfirmDeleteInput] = useState("");

  useEffect(() => {
    // Redirect non-superadmin users
    if (!isSuperAdmin) {
      navigate("/");
      return;
    }

    fetchTournaments();
    fetchTeams();
  }, [currentUser, isSuperAdmin, navigate]);

  // Fetch recent matches for active tournaments
  useEffect(() => {
    if (tournaments.length > 0) {
      fetchRecentMatches();
    }
  }, [tournaments]);

  const fetchTeams = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Query all teams
      const teamsQuery = query(
        collection(db, "teams"),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(teamsQuery);
      const teamsList = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          memberCount: data.memberIds ? data.memberIds.length : 0,
          createdAt: data.createdAt
            ? new Date(data.createdAt.seconds * 1000).toLocaleDateString()
            : "",
        };
      });

      setTeams(teamsList);
    } catch (err) {
      console.error("Error fetching teams:", err);
      setError("Failed to load teams. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const viewTeamMembers = async (teamId) => {
    try {
      const teamRef = doc(db, "teams", teamId);
      const teamDoc = await getDoc(teamRef);

      if (!teamDoc.exists()) {
        setError("Team not found");
        return;
      }

      const teamData = teamDoc.data();
      setSelectedTeam({
        id: teamDoc.id,
        ...teamData,
      });

      // Fetch team members
      const members = [];
      for (const memberId of teamData.memberIds || []) {
        const userDoc = await getDoc(doc(db, "users", memberId));
        if (userDoc.exists()) {
          members.push({
            id: memberId,
            ...userDoc.data(),
          });
        }
      }

      setSelectedTeamMembers(members);
      setIsViewMembersModalOpen(true);
    } catch (err) {
      console.error("Error fetching team members:", err);
      setError("Failed to load team members.");
    }
  };

  const openDeleteTeamModal = (team) => {
    setSelectedTeam(team);
    setIsDeleteTeamModalOpen(true);
  };

  const handleDeleteTeam = async () => {
    if (!selectedTeam) return;

    if (confirmDeleteInput !== selectedTeam.name) {
      setError("Team name confirmation doesn't match");
      return;
    }

    try {
      setIsLoading(true);

      // 1. Get all team members
      const memberIds = selectedTeam.memberIds || [];

      // 2. Update each member's user document to remove teamId
      const updateMemberPromises = memberIds.map((memberId) => {
        const userRef = doc(db, "users", memberId);
        return updateDoc(userRef, {
          teamId: null,
          role: memberId === selectedTeam.managerId ? "admin" : "user", // Keep admin role for team manager
        });
      });

      await Promise.all(updateMemberPromises);

      // 3. Delete all pending invites
      const invitesQuery = query(
        collection(db, "teamInvites"),
        where("teamId", "==", selectedTeam.id)
      );

      const invitesSnapshot = await getDocs(invitesQuery);
      const deleteInvitesPromises = invitesSnapshot.docs.map((doc) =>
        deleteDoc(doc.ref)
      );

      await Promise.all(deleteInvitesPromises);

      // 4. Delete the team
      await deleteDoc(doc(db, "teams", selectedTeam.id));

      setSuccessMessage("Team deleted successfully");
      setIsDeleteTeamModalOpen(false);
      setConfirmDeleteInput("");

      // Refresh teams list
      fetchTeams();
    } catch (error) {
      console.error("Error deleting team:", error);
      setError("Failed to delete team. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTournaments = async () => {
    try {
      setIsLoading(true);
      setError(null);
      let tournamentQuery;

      // Superadmins can see all tournaments
      tournamentQuery = query(
        collection(db, "tournaments"),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(tournamentQuery);
      const tournamentList = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startDate: data.startDate
            ? new Date(data.startDate.seconds * 1000).toLocaleDateString()
            : "",
          createdAt: data.createdAt
            ? new Date(data.createdAt.seconds * 1000).toLocaleDateString()
            : "",
        };
      });

      setTournaments(tournamentList);
    } catch (err) {
      console.error("Error fetching tournaments:", err);
      setError("Failed to load tournaments. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecentMatches = async () => {
    try {
      // Get IDs of active tournaments
      const activeTournamentIds = tournaments
        .filter((t) => t.status !== "Completed")
        .map((t) => t.id)
        .slice(0, 5); // Limit to 5 most recent tournaments

      if (activeTournamentIds.length === 0) return;

      const recentMatches = [];

      for (const tournamentId of activeTournamentIds) {
        const matchesQuery = query(
          collection(db, "matches"),
          where("tournamentId", "==", tournamentId),
          orderBy("createdAt", "desc")
        );

        const matchesSnapshot = await getDocs(matchesQuery);

        if (!matchesSnapshot.empty) {
          const tournamentMatches = await Promise.all(
            matchesSnapshot.docs.map(async (matchDoc) => {
              const match = {
                id: matchDoc.id,
                ...matchDoc.data(),
                tournamentName:
                  tournaments.find((t) => t.id === tournamentId)?.name ||
                  "Unknown Tournament",
              };

              // Format dates
              if (match.scheduledDate) {
                match.scheduledDateFormatted = new Date(
                  match.scheduledDate.seconds * 1000
                ).toLocaleString();
              }

              return match;
            })
          );

          recentMatches.push(...tournamentMatches);
        }
      }

      // Sort by scheduled date and take the 10 most recent
      recentMatches.sort((a, b) => {
        if (!a.scheduledDate) return 1;
        if (!b.scheduledDate) return -1;
        return b.scheduledDate.seconds - a.scheduledDate.seconds;
      });

      setMatches(recentMatches.slice(0, 10));
    } catch (err) {
      console.error("Error fetching recent matches:", err);
    }
  };

  const handleDeleteTournament = async (tournamentId) => {
    try {
      setIsLoading(true);

      // Delete the tournament document
      await deleteDoc(doc(db, "tournaments", tournamentId));

      // Delete all participant registrations
      const participantsQuery = query(
        collection(db, "tournamentParticipants"),
        where("tournamentId", "==", tournamentId)
      );
      const participantsSnapshot = await getDocs(participantsQuery);

      const deletePromises = participantsSnapshot.docs.map((doc) =>
        deleteDoc(doc.ref)
      );
      await Promise.all(deletePromises);

      // Refresh tournaments list
      setDeleteConfirm(null);
      fetchTournaments();
    } catch (err) {
      console.error("Error deleting tournament:", err);
      setError("Failed to delete tournament. Please try again.");
      setIsLoading(false);
    }
  };
  if (!isSuperAdmin) {
    return null; // Just to be safe, in case the redirect hasn't happened yet
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            {successMessage}
          </div>
        )}

        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Super Admin Dashboard
            </h1>
            <p className="text-gray-600">
              Manage all tournaments and teams on the platform
            </p>
          </div>
          <Link to="/tournaments">
            <button className="bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors duration-200">
              Create New Tournament
            </button>
          </Link>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading data...</p>
          </div>
        ) : (
          <>
            {/* Tournaments Section */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Tournament Management
              </h2>

              {tournaments.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-8 text-center">
                  <h2 className="text-xl font-medium text-gray-900 mb-2">
                    No tournaments found
                  </h2>
                  <p className="text-gray-600 mb-6">
                    There are no tournaments on the platform yet.
                  </p>
                  <Link to="/tournaments">
                    <button className="bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors duration-200">
                      Create Your First Tournament
                    </button>
                  </Link>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full table-auto">
                      <thead className="bg-gray-100 text-gray-700">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                            Tournament Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                            Sport
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                            Created By
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {tournaments.map((tournament) => (
                          <tr key={tournament.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {tournament.name}
                              </div>
                              <div className="text-xs text-gray-500">
                                {tournament.location}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {tournament.sport}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {tournament.startDate}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
                                ${
                                  tournament.status === "Completed"
                                    ? "bg-gray-100 text-gray-800"
                                    : tournament.status === "In Progress"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : tournament.status ===
                                      "Registration Closed"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-green-100 text-green-800"
                                }`}
                              >
                                {tournament.status || "Registration Open"}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {tournament.creatorName}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex justify-end space-x-2">
                                <Link to={`/tournament/${tournament.id}`}>
                                  <button className="text-blue-600 hover:text-blue-900">
                                    View
                                  </button>
                                </Link>
                                <Link to={`/tournament/${tournament.id}`}>
                                  <button className="text-indigo-600 hover:text-indigo-900">
                                    Edit
                                  </button>
                                </Link>
                                {deleteConfirm === tournament.id ? (
                                  <div className="flex space-x-1">
                                    <button
                                      onClick={() =>
                                        handleDeleteTournament(tournament.id)
                                      }
                                      className="text-red-600 hover:text-red-900 font-bold"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirm(null)}
                                      className="text-gray-600 hover:text-gray-900"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() =>
                                      setDeleteConfirm(tournament.id)
                                    }
                                    className="text-red-600 hover:text-red-900"
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Team Management Section */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Team Management
              </h2>

              {teams.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-8 text-center">
                  <h2 className="text-xl font-medium text-gray-900 mb-2">
                    No teams found
                  </h2>
                  <p className="text-gray-600">
                    There are no teams on the platform yet.
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full table-auto">
                      <thead className="bg-gray-100 text-gray-700">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                            Team Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                            Sport
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                            Manager
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                            Members
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                            Created
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {teams.map((team) => (
                          <tr key={team.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {team.name}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {team.sport}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {team.managerName}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-center">
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                                  {team.memberCount}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {team.createdAt}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex justify-end space-x-2">
                                <button
                                  onClick={() => viewTeamMembers(team.id)}
                                  className="text-blue-600 hover:text-blue-900"
                                >
                                  Members
                                </button>
                                <Link to={`/team?edit=${team.id}`}>
                                  <button className="text-indigo-600 hover:text-indigo-900">
                                    Edit
                                  </button>
                                </Link>
                                <button
                                  onClick={() => openDeleteTeamModal(team)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Match Management Section */}
            <div className="mt-12">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Match Management
                </h2>
              </div>

              {matches.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-6 text-center">
                  <p className="text-gray-600">
                    No active matches found for your tournaments.
                  </p>
                  <p className="text-gray-600 mt-2">
                    Create matches for your tournaments by visiting the
                    tournament detail page.
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full table-auto">
                      <thead className="bg-gray-100 text-gray-700">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                            Tournament
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                            Teams
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                            Scheduled For
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {matches.map((match) => (
                          <tr key={match.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {match.tournamentName}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {match.team1Name || "Team 1"} vs{" "}
                                {match.team2Name || "Team 2"}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {match.scheduledDateFormatted ||
                                  "Not scheduled"}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full                                ${
                                  match.status === "finished"
                                    ? "bg-green-100 text-green-800"
                                    : match.status === "in_progress"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {match.status === "finished"
                                  ? `Completed (${match.team1Score || 0}-${
                                      match.team2Score || 0
                                    })`
                                  : match.status === "in_progress"
                                  ? "In Progress"
                                  : "Scheduled"}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <Link
                                to={`/tournament/${match.tournamentId}/matches`}
                              >
                                <button className="text-blue-600 hover:text-blue-900">
                                  Manage
                                </button>
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Team Members Modal */}
        {isViewMembersModalOpen && selectedTeam && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 m-4 max-w-2xl w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">
                  {selectedTeam.name} - Team Members
                </h2>
                <button
                  onClick={() => setIsViewMembersModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    ></path>
                  </svg>
                </button>
              </div>

              {selectedTeamMembers.length === 0 ? (
                <p className="text-gray-600 py-4">No team members found.</p>
              ) : (
                <div className="overflow-y-auto max-h-80">
                  <ul className="divide-y divide-gray-200">
                    {selectedTeamMembers.map((member) => (
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
                        <span
                          className={`px-3 py-1 text-xs rounded-full ${
                            member.id === selectedTeam.managerId
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {member.id === selectedTeam.managerId
                            ? "Manager"
                            : "Player"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setIsViewMembersModalOpen(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Team Modal */}
        {isDeleteTeamModalOpen && selectedTeam && (
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
                  <span className="font-bold">{selectedTeam.name}</span>
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
                    setSelectedTeam(null);
                    setConfirmDeleteInput("");
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteTeam}
                  disabled={
                    confirmDeleteInput !== selectedTeam.name || isLoading
                  }
                  className={`px-4 py-2 text-white rounded-md ${
                    confirmDeleteInput !== selectedTeam.name || isLoading
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
      </div>
    </div>
  );
}

export default AdminDashboard;
