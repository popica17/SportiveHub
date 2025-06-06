import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { db } from "../firebase";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  deleteDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import MatchList from "../components/MatchList";

// Helper function to fetch real-time team data
const getLatestTeamData = async (teamId) => {
  if (!teamId) return null;

  try {
    const teamRef = doc(db, "teams", teamId);
    const teamDoc = await getDoc(teamRef);

    if (teamDoc.exists()) {
      const teamData = teamDoc.data();
      return {
        name: teamData.name,
        memberCount: teamData.memberIds ? teamData.memberIds.length : 0,
      };
    }
  } catch (err) {
    console.error(`Error fetching latest data for team ${teamId}:`, err);
  }

  return null;
};

function TournamentDetail() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { currentUser, userProfile, isAdmin, isSuperAdmin } = useAuth();
  const [tournament, setTournament] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [teams, setTeams] = useState({});
  const [teamCount, setTeamCount] = useState(0);

  // Edit mode state variables
  const [editMode, setEditMode] = useState(false);
  const [editFormData, setEditFormData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  // Permission check for editing tournament - only superadmins can edit tournaments
  const canEditTournament = tournament && isSuperAdmin;

  // Delete tournament confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    fetchTournamentDetails();
  }, [tournamentId]);

  useEffect(() => {
    // Since our participants are now teams, we can simplify this
    if (participants.length > 0) {
      const teamSummary = {};
      participants.forEach((team) => {
        if (team.teamId && team.teamName) {
          // Ensure we're using the most up-to-date member count
          const memberCount =
            typeof team.memberCount === "number" ? team.memberCount : 0;
          console.log(
            `Team summary for ${team.teamName}: ${memberCount} members`
          );
          teamSummary[team.teamId] = {
            name: team.teamName,
            members: memberCount,
          };
        }
      });

      setTeams(teamSummary);
      setTeamCount(participants.length);
    } else {
      setTeams({});
      setTeamCount(0);
    }
  }, [participants]);

  const fetchTournamentDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch tournament details
      const tournamentRef = doc(db, "tournaments", tournamentId);
      const tournamentDoc = await getDoc(tournamentRef);

      if (!tournamentDoc.exists()) {
        setError("Tournament not found");
        setIsLoading(false);
        return;
      }

      // Format dates for display
      const tournamentData = tournamentDoc.data();
      const formattedTournament = {
        id: tournamentDoc.id,
        ...tournamentData,
        startDate:
          tournamentData.startDate && tournamentData.startDate.seconds
            ? new Date(tournamentData.startDate.seconds * 1000)
            : null,
        registrationDeadline:
          tournamentData.registrationDeadline &&
          tournamentData.registrationDeadline.seconds
            ? new Date(tournamentData.registrationDeadline.seconds * 1000)
            : null,
        createdAt:
          tournamentData.createdAt && tournamentData.createdAt.seconds
            ? new Date(tournamentData.createdAt.seconds * 1000)
            : null,
      };

      setTournament(formattedTournament);

      // Check if current user's team is registered (only for admins with teams)
      if (currentUser && isAdmin) {
        // Get user data including their teamId
        const userRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();

        if (userData && userData.teamId) {
          const teamRegistrationQuery = query(
            collection(db, "tournamentTeams"),
            where("tournamentId", "==", tournamentId),
            where("teamId", "==", userData.teamId)
          );

          const teamRegistrationSnapshot = await getDocs(teamRegistrationQuery);
          setIsRegistered(!teamRegistrationSnapshot.empty);
        }
      } // Fetch all registered teams (only registration documents, not statistics documents)
      const registeredTeamsQuery = query(
        collection(db, "tournamentTeams"),
        where("tournamentId", "==", tournamentId)
      );

      const registeredTeamsSnapshot = await getDocs(registeredTeamsQuery);
      // Filter out statistics documents - only keep registration documents
      const registrationDocs = registeredTeamsSnapshot.docs.filter((doc) => {
        const data = doc.data();
        const docId = doc.id;
        // Registration documents have teamName and managerName, and don't end with "_stats"
        return (
          data.teamName &&
          data.managerName !== undefined &&
          !docId.endsWith("_stats")
        );
      });

      const teamsData = await Promise.all(
        registrationDocs.map(async (teamSnapshot) => {
          const teamData = teamSnapshot.data();
          let updatedTeamData = {
            id: teamSnapshot.id,
            ...teamData,
          };

          // Fetch current team information to get the latest member count
          if (teamData.teamId) {
            try {
              const teamRef = doc(db, "teams", teamData.teamId);
              const teamDoc = await getDoc(teamRef);
              if (teamDoc.exists()) {
                const currentTeamData = teamDoc.data();
                const currentMemberCount = currentTeamData.memberIds
                  ? currentTeamData.memberIds.length
                  : 0;
                console.log(
                  `Team ${teamData.teamName} has ${currentMemberCount} members`
                );
                // Update the member count with the current value
                updatedTeamData.memberCount = currentMemberCount;
              } else {
                console.log(
                  `Team document not found for ${
                    teamData.teamName
                  }, using stored memberCount: ${teamData.memberCount || 0}`
                );
              }
            } catch (teamErr) {
              console.error(
                "Error fetching team details for " + teamData.teamName,
                teamErr
              );
            }
          } else {
            console.log(
              `No teamId for team ${
                teamData.teamName
              }, using stored memberCount: ${teamData.memberCount || 0}`
            );
          }

          return updatedTeamData;
        })
      );

      // Filter out any undefined values and ensure all entries have valid data
      const validTeamsData = teamsData.filter((team) => team && team.id);

      // Log detailed information about each team's member count for debugging
      validTeamsData.forEach((team) => {
        console.log(
          `Team ${team.teamName}: memberCount=${
            team.memberCount
          }, type=${typeof team.memberCount}`
        );
      });

      console.log("Final teams data:", validTeamsData);

      setParticipants(validTeamsData);
    } catch (err) {
      console.error("Error fetching tournament details:", err);
      setError("Failed to load tournament details. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    try {
      console.log("Registration attempt - User:", currentUser.uid);
      console.log("Current user profile:", userProfile);
      console.log("Is admin:", isAdmin);

      // Check if registration is still open
      const now = new Date();
      if (tournament.registrationDeadline < now) {
        setError("Registration for this tournament has closed");
        return;
      }

      // Check if tournament is full
      if (participants.length >= tournament.maxParticipants) {
        setError(
          "This tournament has reached its maximum number of participants"
        );
        return;
      }

      // Check if user is an admin
      if (!isAdmin) {
        setError("Only administrators can register teams for tournaments.");
        console.log(
          "User is not an admin or team manager, cannot register for tournament"
        );
        return;
      }

      // Check if admin has a team
      const userRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();

      console.log("User data from database:", userData);
      console.log("User role:", userData?.role);
      console.log("User teamId:", userData?.teamId);
      console.log("isAdmin check result:", isAdmin);

      if (!userData || !userData.teamId) {
        setError(
          "You must have a team to register for this tournament. Please create a team first."
        );
        console.log("No teamId found in user data");
        return;
      }

      // Double-check that the team actually exists in the database
      try {
        const teamRef = doc(db, "teams", userData.teamId);
        const teamDoc = await getDoc(teamRef);

        if (!teamDoc.exists()) {
          console.error(
            "Team referenced in user profile does not exist:",
            userData.teamId
          );
          setError(
            "Your team could not be found in the database. Please try creating your team again."
          );
          return;
        }

        console.log(
          "Team verification successful - team exists:",
          teamDoc.data()
        );
      } catch (teamVerifyError) {
        console.error("Error verifying team existence:", teamVerifyError);
        setError("Error verifying your team. Please try again.");
        return;
      }

      // Check if team is already registered for this tournament
      const teamRegistrationQuery = query(
        collection(db, "tournamentTeams"),
        where("tournamentId", "==", tournamentId),
        where("teamId", "==", userData.teamId)
      );

      const teamRegistrationSnapshot = await getDocs(teamRegistrationQuery);
      if (!teamRegistrationSnapshot.empty) {
        setError("Your team is already registered for this tournament.");
        return;
      }

      // Get team information
      console.log("Fetching team with ID:", userData.teamId);
      const teamRef = doc(db, "teams", userData.teamId);
      const teamDoc = await getDoc(teamRef);

      if (!teamDoc.exists()) {
        console.error("Team document not found for ID:", userData.teamId);
        setError(
          "Your team information could not be found. Please contact an administrator."
        );
        return;
      }

      const teamData = teamDoc.data();
      console.log("Team data found:", teamData);

      // Prepare the team registration data
      const teamRegistrationData = {
        tournamentId,
        teamId: userData.teamId,
        teamName: teamData.name || "Team",
        sport: teamData.sport || "General",
        managerId: currentUser.uid,
        managerName:
          currentUser.displayName ||
          userProfile?.firstName ||
          currentUser.email,
        registeredAt: new Date(),
        memberCount: teamData.memberIds ? teamData.memberIds.length : 1,
      };

      console.log("Registering team with data:", teamRegistrationData);

      // Register the team for the tournament
      try {
        const docRef = await addDoc(
          collection(db, "tournamentTeams"),
          teamRegistrationData
        );
        console.log("Team registered successfully with ID:", docRef.id);
      } catch (err) {
        console.error("Error registering team:", err);
        setError("Failed to register team: " + err.message);
        return;
      }

      // Update tournament participants count
      await updateDoc(doc(db, "tournaments", tournamentId), {
        participants: participants.length + 1,
      });

      // Refresh data
      setIsRegistered(true);
      fetchTournamentDetails();
    } catch (err) {
      console.error("Error registering for tournament:", err);
      setError("Failed to register for tournament. Please try again.");
    }
  };

  const handleCancelRegistration = async () => {
    if (!currentUser || !isAdmin) return;

    try {
      // Get user data to find their team
      const userRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();

      if (!userData || !userData.teamId) {
        setError("No team information found");
        return;
      }

      // Find team registration
      const teamRegistrationQuery = query(
        collection(db, "tournamentTeams"),
        where("tournamentId", "==", tournamentId),
        where("teamId", "==", userData.teamId)
      );

      const teamRegistrationSnapshot = await getDocs(teamRegistrationQuery);

      if (teamRegistrationSnapshot.empty) {
        setError("Your team is not registered for this tournament");
        return;
      }

      // Delete team registration
      await deleteDoc(
        doc(db, "tournamentTeams", teamRegistrationSnapshot.docs[0].id)
      );

      // Update tournament participants count
      await updateDoc(doc(db, "tournaments", tournamentId), {
        participants: participants.length - 1,
      });

      // Refresh data
      setIsRegistered(false);
      fetchTournamentDetails();
    } catch (err) {
      console.error("Error canceling team registration:", err);
      setError("Failed to cancel team registration. Please try again.");
    }
  };

  // Handle switching to edit mode
  const handleEditClick = () => {
    setEditMode(true);
    setEditFormData({
      name: tournament.name,
      sport: tournament.sport,
      location: tournament.location,
      description: tournament.description,
      startDate: formatDateForInput(tournament.startDate),
      registrationDeadline: formatDateForInput(tournament.registrationDeadline),
      maxParticipants: tournament.maxParticipants,
      status: tournament.status || "Registration Open",
    });
  };

  // Handle edit form input changes
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData({
      ...editFormData,
      [name]: name === "maxParticipants" ? parseInt(value) : value,
    });
  };

  // Format date for input field
  const formatDateForInput = (date) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toISOString().split("T")[0];
  };

  // Handle tournament update
  const handleUpdateTournament = async (e) => {
    e.preventDefault();

    if (!isSuperAdmin) {
      setError("Only superadmins can edit tournaments");
      return;
    }

    try {
      setIsEditing(true);
      setError(null);

      const tournamentRef = doc(db, "tournaments", tournamentId);

      await updateDoc(tournamentRef, {
        name: editFormData.name,
        sport: editFormData.sport,
        location: editFormData.location,
        description: editFormData.description,
        startDate: new Date(editFormData.startDate),
        registrationDeadline: new Date(editFormData.registrationDeadline),
        maxParticipants: parseInt(editFormData.maxParticipants),
        status: editFormData.status,
      });

      // Refresh tournament data
      await fetchTournamentDetails();

      // Exit edit mode
      setEditMode(false);
      setEditFormData(null);
    } catch (err) {
      console.error("Error updating tournament:", err);
      setError("Failed to update tournament. Please try again.");
    } finally {
      setIsEditing(false);
    }
  };

  // Handle tournament deletion
  const handleDeleteTournament = async () => {
    if (!isSuperAdmin) {
      setError("Only superadmins can delete tournaments");
      return;
    }
    try {
      setIsLoading(true);
      setError(null);

      // Delete all team registrations first
      const teamsQuery = query(
        collection(db, "tournamentTeams"),
        where("tournamentId", "==", tournamentId)
      );
      const teamsSnapshot = await getDocs(teamsQuery);

      const deleteTeamPromises = teamsSnapshot.docs.map((teamDoc) =>
        deleteDoc(teamDoc.ref)
      );
      await Promise.all(deleteTeamPromises);

      // Delete the tournament document
      const tournamentRef = doc(db, "tournaments", tournamentId);
      await deleteDoc(tournamentRef);

      // Redirect to tournaments page
      navigate("/tournaments");
    } catch (err) {
      console.error("Error deleting tournament:", err);
      setError("Failed to delete tournament. Please try again.");
      setIsLoading(false);
    }
  };

  // Cancel edit mode
  const handleCancelEdit = () => {
    setEditMode(false);
    setEditFormData(null);
  }; // Function to refresh team data
  const refreshTeamData = async () => {
    if (!participants || participants.length === 0) return Promise.resolve(); // Return resolved promise if no participants

    try {
      console.log("Refreshing team data...");
      // Using a local variable instead of component loading state to avoid render cycles
      let isRefreshing = true;

      const updatedParticipants = await Promise.all(
        participants.map(async (team) => {
          if (!team.teamId) return team;

          // Get the latest team data
          try {
            const teamRef = doc(db, "teams", team.teamId);
            const teamDoc = await getDoc(teamRef);

            if (teamDoc.exists()) {
              const currentTeamData = teamDoc.data();
              const currentMemberCount = currentTeamData.memberIds
                ? currentTeamData.memberIds.length
                : 0;

              // If count changed, update both the local state and the database record
              if (currentMemberCount !== team.memberCount) {
                console.log(
                  `Team ${team.teamName} memberCount changed from ${team.memberCount} to ${currentMemberCount}`
                );

                // Update the database
                await updateDoc(doc(db, "tournamentTeams", team.id), {
                  memberCount: currentMemberCount,
                });

                // Return updated team data
                return {
                  ...team,
                  memberCount: currentMemberCount,
                };
              }
            } else {
              console.log(
                `Team ${team.teamName} (${team.teamId}) no longer exists in the database`
              );
              // Team might have been deleted, but registration still exists
              return team;
            }
          } catch (err) {
            console.error(
              `Error refreshing data for team ${team.teamName}:`,
              err
            );
          }

          return team;
        })
      );
      console.log("Team data refresh complete"); // Update participants state with the refreshed data
      setParticipants(updatedParticipants);
      return Promise.resolve(); // Return a resolved promise when completed successfully
    } catch (err) {
      console.error("Error refreshing team data:", err);
      setError("Failed to refresh team data. Please try again.");
      return Promise.reject(err); // Return a rejected promise on error
    }
  }; // Add effect hook to refresh team data only once when participants are initially loaded
  useEffect(() => {
    // Only run this effect once when participants are first loaded
    // This prevents the refresh cycle and only updates the data when participants change
    if (participants.length > 0) {
      const timer = setTimeout(() => {
        refreshTeamData();
      }, 500); // Small delay to avoid any race conditions

      return () => clearTimeout(timer);
    }
  }, [participants.length]); // Only run when the number of participants changes

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading tournament details...</p>
        </div>
      </div>
    );
  }

  if (error && !tournament) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto text-center bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700 mb-6">{error}</p>
          <Link to="/tournaments">
            <button className="bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors duration-200">
              Back to Tournaments
            </button>
          </Link>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return null;
  }

  // Format dates for display
  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const isCreator = currentUser && tournament.createdBy === currentUser.uid;
  const registrationDeadlinePassed =
    new Date() > tournament.registrationDeadline;
  const tournamentStarted = new Date() > tournament.startDate;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Back button */}
        <div className="mb-6">
          <Link
            to="/tournaments"
            className="inline-flex items-center text-blue-600 hover:text-blue-800"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              ></path>
            </svg>
            Back to Tournaments
          </Link>
        </div>
        {/* Tournament header */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
          <div className="relative h-64">
            <img
              src={
                tournament.image ||
                `https://source.unsplash.com/random/1200x600/?${tournament.sport.toLowerCase()}`
              }
              alt={tournament.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black bg-opacity-30"></div>
            <div className="absolute bottom-0 left-0 p-6 text-white">
              <h1 className="text-3xl font-bold mb-2">{tournament.name}</h1>
              <div className="flex items-center">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium mr-2
                  ${
                    tournament.status === "Completed"
                      ? "bg-gray-100 text-gray-800"
                      : tournament.status === "In Progress"
                      ? "bg-yellow-100 text-yellow-800"
                      : tournament.status === "Registration Closed"
                      ? "bg-red-100 text-red-800"
                      : "bg-green-100 text-green-800"
                  }`}
                >
                  {tournament.status}
                </span>
                <span className="text-sm opacity-90">
                  Organized by {tournament.creatorName}
                </span>
              </div>
            </div>
          </div>
          <div className="p-6">
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}
            <div className="flex flex-wrap -mx-2 mb-6">
              <div className="w-full md:w-1/3 px-2 mb-4 md:mb-0">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-700 mb-1">Sport</h3>
                  <p className="text-gray-900">{tournament.sport}</p>
                </div>
              </div>
              <div className="w-full md:w-1/3 px-2 mb-4 md:mb-0">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-700 mb-1">Location</h3>
                  <p className="text-gray-900">{tournament.location}</p>
                </div>
              </div>
              <div className="w-full md:w-1/3 px-2 mb-4 md:mb-0">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-700 mb-1">
                    Participants
                  </h3>
                  <p className="text-gray-900">
                    {participants.length} / {tournament.maxParticipants}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap -mx-2 mb-6">
              <div className="w-full md:w-1/2 px-2 mb-4 md:mb-0">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-700 mb-1">Start Date</h3>
                  <p className="text-gray-900">
                    {formatDate(tournament.startDate)}
                  </p>
                </div>
              </div>
              <div className="w-full md:w-1/2 px-2 mb-4 md:mb-0">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-700 mb-1">
                    Registration Deadline
                  </h3>
                  <p className="text-gray-900">
                    {formatDate(tournament.registrationDeadline)}
                  </p>
                </div>
              </div>
            </div>
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Description</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                {tournament.description || "No description provided."}
              </div>
            </div>
            {/* Registration button */}
            {currentUser ? (
              isRegistered ? (
                <button
                  onClick={handleCancelRegistration}
                  disabled={tournamentStarted}
                  className={`w-full py-2 px-4 rounded-lg text-white text-center 
                    ${
                      tournamentStarted
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-red-600 hover:bg-red-700 transition-colors duration-200"
                    }`}
                >
                  {tournamentStarted
                    ? "Tournament has started"
                    : "Withdraw My Team"}
                </button>
              ) : (
                <button
                  onClick={handleRegister}
                  disabled={
                    registrationDeadlinePassed ||
                    participants.length >= tournament.maxParticipants ||
                    !isAdmin
                  }
                  className={`w-full py-2 px-4 rounded-lg text-white text-center 
                    ${
                      registrationDeadlinePassed ||
                      participants.length >= tournament.maxParticipants ||
                      !isAdmin
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700 transition-colors duration-200"
                    }`}
                >
                  {registrationDeadlinePassed
                    ? "Registration Closed"
                    : participants.length >= tournament.maxParticipants
                    ? "Tournament Full"
                    : isAdmin
                    ? "Register My Team"
                    : "Only Admins Can Register Teams"}
                </button>
              )
            ) : (
              <Link to="/login">
                <button className="w-full py-2 px-4 rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors duration-200 text-center">
                  Login as Admin to Register Team
                </button>
              </Link>
            )}
          </div>
        </div>
        {/* Tournament Navigation */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-8">
          <div className="flex flex-wrap items-center justify-center space-x-2 md:space-x-4">
            {isAdmin && (
              <Link
                to={`/tournament/${tournamentId}/matches`}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors my-2"
              >
                Match Schedule
              </Link>
            )}{" "}
            <Link
              to={`/tournament/${tournamentId}/rankings`}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors my-2"
            >
              Team Rankings
            </Link>
            <Link
              to={`/tournament/${tournamentId}/rankings?tab=players`}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors my-2"
            >
              Player Statistics
            </Link>
          </div>
        </div>
        {/* Participating Teams section */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Participating Teams</h2>{" "}
            <button
              onClick={() => {
                // Show feedback via a temporary message
                const btn = document.getElementById("refresh-btn");
                if (btn) {
                  const originalText = btn.innerHTML;
                  btn.innerHTML = `<svg class="w-4 h-4 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Refreshing...`;

                  refreshTeamData().then(() => {
                    setTimeout(() => {
                      if (btn) btn.innerHTML = originalText;
                    }, 1000);
                  });
                } else {
                  refreshTeamData();
                }
              }}
              id="refresh-btn"
              className="text-sm bg-blue-50 hover:bg-blue-100 text-blue-600 py-1 px-3 rounded border border-blue-200 flex items-center"
            >
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                ></path>
              </svg>
              Refresh Teams
            </button>
          </div>
          {participants.length === 0 ? (
            <p className="text-gray-600">No teams have registered yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white">
                <thead>
                  <tr>
                    <th className="py-2 px-4 border-b text-left">Team</th>
                    <th className="py-2 px-4 border-b text-left">Sport</th>
                    <th className="py-2 px-4 border-b text-left">Manager</th>
                    <th className="py-2 px-4 border-b text-left">Members</th>
                    <th className="py-2 px-4 border-b text-left">
                      Registered On
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((team) => (
                    <tr key={team.id}>
                      <td className="py-2 px-4 border-b font-medium">
                        {team.teamName}
                      </td>
                      <td className="py-2 px-4 border-b">{team.sport}</td>
                      <td className="py-2 px-4 border-b">
                        {team.managerName || "Unknown"}
                      </td>
                      <td className="py-2 px-4 border-b text-center">
                        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                          {typeof team.memberCount === "number"
                            ? team.memberCount
                            : 0}
                        </span>
                      </td>
                      <td className="py-2 px-4 border-b">
                        {team.registeredAt
                          ? new Date(
                              team.registeredAt.seconds * 1000
                            ).toLocaleDateString()
                          : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>{" "}
        {/* Tournament Matches Section */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          {" "}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Tournament Matches</h2>
            {isAdmin && (
              <Link
                to={`/tournament/${tournamentId}/matches/create`}
                className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition flex items-center"
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Schedule New Match
              </Link>
            )}
          </div>
          {tournamentId ? (
            <MatchList
              tournamentId={tournamentId}
              tournamentName={tournament?.name || "Tournament"}
            />
          ) : (
            <div className="bg-white rounded-xl shadow-md overflow-hidden mt-8">
              <div className="p-6 text-center">
                <p className="text-red-600">
                  Unable to load matches: Missing tournament ID
                </p>
              </div>
            </div>
          )}
        </div>
        {/* Admin Controls - Only visible to tournament creator and superadmins */}
        {canEditTournament && !editMode && (
          <div className="bg-white rounded-xl shadow-md p-6 mb-8 border-l-4 border-blue-500">
            {" "}
            <h2 className="text-2xl font-bold mb-4">Tournament Management</h2>
            <p className="text-gray-600 mb-4">
              As a super administrator, you can edit tournament details or
              delete it. Only superadmins have permission to manage tournaments.
            </p>
            <div className="flex space-x-4">
              <button
                onClick={handleEditClick}
                className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors duration-200"
              >
                Edit Tournament
              </button>

              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 transition-colors duration-200"
              >
                Delete Tournament
              </button>
            </div>
            {/* Delete confirmation */}
            {showDeleteConfirm && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="font-medium text-red-800 mb-2">
                  Are you sure you want to delete this tournament?
                </p>
                <p className="text-red-700 mb-4">
                  This action cannot be undone. All registrations will be
                  removed.
                </p>
                <div className="flex space-x-4">
                  <button
                    onClick={handleDeleteTournament}
                    className="bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 transition-colors duration-200"
                  >
                    Yes, Delete Tournament
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {/* Edit Tournament Form */}
        {editMode && (
          <div className="bg-white rounded-xl shadow-md p-6 mb-8 border-l-4 border-yellow-500">
            <h2 className="text-2xl font-bold mb-4">Edit Tournament</h2>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleUpdateTournament} className="space-y-4">
              <div>
                <label className="block text-gray-700 mb-1">
                  Tournament Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={editFormData.name}
                  onChange={handleEditChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-1">Sport</label>
                  <select
                    name="sport"
                    value={editFormData.sport}
                    onChange={handleEditChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
                  <label className="block text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    name="location"
                    value={editFormData.location}
                    onChange={handleEditChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    name="startDate"
                    value={editFormData.startDate}
                    onChange={handleEditChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 mb-1">
                    Registration Deadline
                  </label>
                  <input
                    type="date"
                    name="registrationDeadline"
                    value={editFormData.registrationDeadline}
                    onChange={handleEditChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-1">
                    Maximum Participants
                  </label>
                  <input
                    type="number"
                    name="maxParticipants"
                    value={editFormData.maxParticipants}
                    onChange={handleEditChange}
                    min={participants.length}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  {participants.length > 0 && (
                    <p className="text-sm text-gray-500 mt-1">
                      Cannot be less than current participants (
                      {participants.length})
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 mb-1">Status</label>
                  <select
                    name="status"
                    value={editFormData.status}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="Registration Open">Registration Open</option>
                    <option value="Registration Closed">
                      Registration Closed
                    </option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  value={editFormData.description}
                  onChange={handleEditChange}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                ></textarea>
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="bg-gray-500 text-white py-2 px-6 rounded-lg hover:bg-gray-600 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditing}
                  className={`bg-blue-600 text-white py-2 px-6 rounded-lg ${
                    isEditing
                      ? "opacity-70 cursor-not-allowed"
                      : "hover:bg-blue-700"
                  } transition-colors duration-200`}
                >
                  {isEditing ? "Updating..." : "Update Tournament"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default TournamentDetail;
