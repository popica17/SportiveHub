import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

function MatchCreation() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { currentUser, isAdmin, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tournament, setTournament] = useState(null);
  const [teams, setTeams] = useState([]);
  const [formData, setFormData] = useState({
    homeTeamId: "",
    awayTeamId: "",
    scheduledDate: new Date(),
    scheduledTime: new Date(),
    location: "",
    referee: "",
  });
  useEffect(() => {
    const fetchTournamentAndTeams = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log(
          "MatchCreation - Starting data fetch with tournamentId:",
          tournamentId
        );
        console.log("URL path:", window.location.pathname);

        if (!tournamentId) {
          setError("Missing tournament ID parameter");
          console.error("No tournamentId found in URL parameters");
          setLoading(false);
          return;
        }

        // Check permissions
        if (!isAdmin && !isSuperAdmin) {
          setError("You don't have permission to schedule matches");
          console.error(
            "Permission denied: User is not an admin or super admin"
          );
          setLoading(false);
          return;
        }

        // Fetch tournament details
        console.log(
          "Attempting to fetch tournament document with ID:",
          tournamentId
        );
        const tournamentRef = doc(db, "tournaments", tournamentId);
        const tournamentDoc = await getDoc(tournamentRef);

        if (!tournamentDoc.exists()) {
          setError(`Tournament not found with ID: ${tournamentId}`);
          console.error(
            `Tournament document with ID ${tournamentId} does not exist`
          );
          setLoading(false);
          return;
        }

        console.log("Successfully fetched tournament:", tournamentDoc.id);

        setTournament({
          id: tournamentDoc.id,
          ...tournamentDoc.data(),
        }); // Fetch teams registered for this tournament
        console.log("Fetching teams registered for tournament:", tournamentId);
        const teamsQuery = query(
          collection(db, "tournamentTeams"),
          where("tournamentId", "==", tournamentId)
        );

        const teamsSnapshot = await getDocs(teamsQuery);

        if (teamsSnapshot.empty) {
          console.log(
            "No teams found in tournament teams collection for tournamentId:",
            tournamentId
          );
          setError("No teams are registered for this tournament");
          setLoading(false);
          return;
        }
        console.log(
          `Found ${teamsSnapshot.size} registered teams for tournament`
        );
        console.log(`Processing teams and deduplicating by teamId...`);
        const registeredTeams = [];
        const teamPromises = [];
        const uniqueTeamIds = new Set(); // Track unique team IDs to prevent duplicates

        teamsSnapshot.forEach((docSnapshot) => {
          const teamData = docSnapshot.data();

          // Get full team details only if we haven't already processed this teamId
          if (teamData.teamId && !uniqueTeamIds.has(teamData.teamId)) {
            uniqueTeamIds.add(teamData.teamId); // Mark this teamId as processed

            // Create a document reference the correct way
            const teamRef = doc(db, "teams", teamData.teamId);
            const teamPromise = getDoc(teamRef).then((teamDoc) => {
              if (teamDoc.exists()) {
                return {
                  id: teamDoc.id,
                  name: teamDoc.data().name,
                  logo: teamDoc.data().logo || null,
                };
              }
              return null;
            });

            teamPromises.push(teamPromise);
          } else if (teamData.teamId && uniqueTeamIds.has(teamData.teamId)) {
            console.log(`Skipping duplicate team with ID: ${teamData.teamId}`);
          }
        });

        console.log(
          `After deduplication: ${uniqueTeamIds.size} unique teams found`
        );

        // Wait for all team details to be fetched
        const teamResults = await Promise.all(teamPromises);
        const validTeams = teamResults.filter((team) => team !== null);

        setTeams(validTeams);
        if (validTeams.length < 2) {
          setError("At least 2 teams are required to schedule a match");
        }

        setLoading(false);
      } catch (err) {
        console.error("Error fetching tournament data:", err);
        console.error("Error details:", {
          message: err.message,
          stack: err.stack,
          tournamentId: tournamentId,
          currentUrl: window.location.href,
        });

        // Try to provide more specific error information based on common issues
        let errorMessage = `Failed to load tournament data: ${err.message}. Tournament ID: ${tournamentId}`;

        if (err.code === "permission-denied") {
          errorMessage =
            "You don't have permission to access this tournament data";
        } else if (err.message.includes("offline")) {
          errorMessage = "Network error: Please check your internet connection";
        } else if (
          err.message.includes("not found") ||
          err.message.includes("exist")
        ) {
          errorMessage = `Tournament with ID ${tournamentId} could not be found`;
        }

        setError(errorMessage);
        setLoading(false);
      }
    };

    fetchTournamentAndTeams();
  }, [tournamentId, isAdmin, isSuperAdmin]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleDateChange = (date) => {
    setFormData({
      ...formData,
      scheduledDate: date,
    });
  };

  const handleTimeChange = (time) => {
    setFormData({
      ...formData,
      scheduledTime: time,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);

      // Validation
      if (formData.homeTeamId === formData.awayTeamId) {
        setError("Home team and away team cannot be the same");
        setLoading(false);
        return;
      }

      // Get team names and logos
      const homeTeam = teams.find((team) => team.id === formData.homeTeamId);
      const awayTeam = teams.find((team) => team.id === formData.awayTeamId);

      if (!homeTeam || !awayTeam) {
        setError("Selected teams not found");
        setLoading(false);
        return;
      }

      // Combine date and time
      const scheduledDateTime = new Date(formData.scheduledDate);
      scheduledDateTime.setHours(
        formData.scheduledTime.getHours(),
        formData.scheduledTime.getMinutes(),
        0,
        0
      );

      // Create match document
      const matchData = {
        tournamentId,
        homeTeamId: formData.homeTeamId,
        homeTeamName: homeTeam.name,
        homeTeamLogo: homeTeam.logo,
        awayTeamId: formData.awayTeamId,
        awayTeamName: awayTeam.name,
        awayTeamLogo: awayTeam.logo,
        homeScore: 0,
        awayScore: 0,
        status: "scheduled",
        scheduledTime: scheduledDateTime,
        location: formData.location,
        referee: formData.referee,
        createdAt: serverTimestamp(),
        createdBy: currentUser.uid,
        events: [],
      };

      // Add to Firestore
      const matchRef = await addDoc(collection(db, "matches"), matchData);

      // Navigate to tournament page
      navigate(`/tournament/${tournamentId}`);
    } catch (err) {
      console.error("Error creating match:", err);
      setError("Failed to schedule match");
      setLoading(false);
    }
  };
  if (loading && !tournament) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading tournament data...</p>
          <p className="text-gray-500 mt-2 text-sm">
            Tournament ID: {tournamentId || "Missing ID"}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 text-center">
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-red-700 text-left">{error}</p>
                <p className="text-red-500 text-sm text-left mt-1">
                  Path: {window.location.pathname}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-6">
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
          <div className="bg-blue-500 px-6 py-4 text-white">
            <h1 className="text-2xl font-bold">Schedule New Match</h1>
            {tournament && (
              <p className="text-blue-100">Tournament: {tournament.name}</p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 m-6">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Team Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="homeTeamId"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Home Team
                </label>
                <select
                  id="homeTeamId"
                  name="homeTeamId"
                  value={formData.homeTeamId}
                  onChange={handleInputChange}
                  required
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Home Team</option>
                  {teams.map((team) => (
                    <option key={`home_${team.id}`} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="awayTeamId"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Away Team
                </label>
                <select
                  id="awayTeamId"
                  name="awayTeamId"
                  value={formData.awayTeamId}
                  onChange={handleInputChange}
                  required
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Away Team</option>
                  {teams.map((team) => (
                    <option key={`away_${team.id}`} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Match Date
                </label>
                <DatePicker
                  selected={formData.scheduledDate}
                  onChange={handleDateChange}
                  dateFormat="MMMM d, yyyy"
                  minDate={new Date()}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Match Time
                </label>
                <DatePicker
                  selected={formData.scheduledTime}
                  onChange={handleTimeChange}
                  showTimeSelect
                  showTimeSelectOnly
                  timeIntervals={15}
                  timeCaption="Time"
                  dateFormat="h:mm aa"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Location and Referee */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="location"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Location
                </label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="Match venue or stadium"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="referee"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Referee (Optional)
                </label>
                <input
                  type="text"
                  id="referee"
                  name="referee"
                  value={formData.referee}
                  onChange={handleInputChange}
                  placeholder="Referee name"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Visual preview */}
            {formData.homeTeamId && formData.awayTeamId && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-gray-700 font-medium mb-3">
                  Match Preview
                </h3>
                <div className="flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
                      {teams.find((t) => t.id === formData.homeTeamId)?.logo ? (
                        <img
                          src={
                            teams.find((t) => t.id === formData.homeTeamId)
                              ?.logo
                          }
                          alt="Home Team"
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : (
                        <span className="text-blue-800 font-bold">
                          {teams
                            .find((t) => t.id === formData.homeTeamId)
                            ?.name?.charAt(0) || "H"}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 font-medium text-sm">
                      {teams.find((t) => t.id === formData.homeTeamId)?.name}
                    </div>
                  </div>

                  <div className="px-4 text-gray-500">vs</div>

                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                      {teams.find((t) => t.id === formData.awayTeamId)?.logo ? (
                        <img
                          src={
                            teams.find((t) => t.id === formData.awayTeamId)
                              ?.logo
                          }
                          alt="Away Team"
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : (
                        <span className="text-red-800 font-bold">
                          {teams
                            .find((t) => t.id === formData.awayTeamId)
                            ?.name?.charAt(0) || "A"}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 font-medium text-sm">
                      {teams.find((t) => t.id === formData.awayTeamId)?.name}
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-center text-sm text-gray-600">
                  <div>
                    {formData.scheduledDate.toLocaleDateString()} at{" "}
                    {formData.scheduledTime.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  {formData.location && (
                    <div className="mt-1">{formData.location}</div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => navigate(`/tournament/${tournamentId}`)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || teams.length < 2}
                className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 ${
                  loading || teams.length < 2
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
              >
                {loading ? "Scheduling..." : "Schedule Match"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default MatchCreation;
