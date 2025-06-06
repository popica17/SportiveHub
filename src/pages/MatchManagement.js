import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { db } from "../firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  Timestamp,
  arrayUnion,
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";

function MatchManagement() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { currentUser, isAdmin } = useAuth();
  const [tournament, setTournament] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [matches, setMatches] = useState([]);

  // Match creation state
  const [isCreateMatchModalOpen, setIsCreateMatchModalOpen] = useState(false);
  const [matchData, setMatchData] = useState({
    team1Id: "",
    team2Id: "",
    scheduledDate: "",
    location: "",
    notes: "",
  });
  // Match result recording state
  const [isRecordResultModalOpen, setIsRecordResultModalOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [resultData, setResultData] = useState({
    team1Score: 0,
    team2Score: 0,
    playerStats: [], // Will hold individual player statistics for team members
  });
  const [team1Players, setTeam1Players] = useState([]);
  const [team2Players, setTeam2Players] = useState([]);
  useEffect(() => {
    if (tournamentId) {
      fetchTournamentDetails();
      fetchMatches();
    }
  }, [tournamentId]);

  const fetchTournamentDetails = async () => {
    try {
      setLoading(true);

      // Get tournament details
      const tournamentRef = doc(db, "tournaments", tournamentId);
      const tournamentDoc = await getDoc(tournamentRef);

      if (!tournamentDoc.exists()) {
        setError("Tournament not found");
        return;
      }

      const tournamentData = tournamentDoc.data();
      setTournament({
        id: tournamentDoc.id,
        ...tournamentData,
      });
      // Fetch participating teams directly from tournamentTeams collection
      const teamsQuery = query(
        collection(db, "tournamentTeams"),
        where("tournamentId", "==", tournamentId)
      );
      const teamsSnapshot = await getDocs(teamsQuery);

      // Extract team IDs from tournament teams
      const teamIds = teamsSnapshot.docs.map((doc) => doc.data().teamId);

      // Fetch team details
      const teamDetails = [];
      for (const teamId of teamIds) {
        const teamDoc = await getDoc(doc(db, "teams", teamId));
        if (teamDoc.exists()) {
          teamDetails.push({
            id: teamDoc.id,
            ...teamDoc.data(),
          });
        }
      }

      setTeams(teamDetails);
    } catch (err) {
      console.error("Error fetching tournament details:", err);
      setError("Failed to load tournament details");
    } finally {
      setLoading(false);
    }
  };
  const fetchMatches = async () => {
    try {
      const matchesQuery = query(
        collection(db, "matches"),
        where("tournamentId", "==", tournamentId)
      );

      const matchesSnapshot = await getDocs(matchesQuery);
      const matchesData = await Promise.all(
        matchesSnapshot.docs.map(async (doc) => {
          const match = {
            id: doc.id,
            ...doc.data(),
          };

          // Handle both old and new field formats for backward compatibility
          const team1Id = match.homeTeamId || match.team1Id;
          const team2Id = match.awayTeamId || match.team2Id;

          // Get team names if not already present
          if (team1Id && !match.homeTeamName && !match.team1Name) {
            const team1Doc = await getDoc(doc(db, "teams", team1Id));
            if (team1Doc.exists()) {
              match.team1Name = team1Doc.data().name;
              match.homeTeamName = team1Doc.data().name;
            }
          }

          if (team2Id && !match.awayTeamName && !match.team2Name) {
            const team2Doc = await getDoc(doc(db, "teams", team2Id));
            if (team2Doc.exists()) {
              match.team2Name = team2Doc.data().name;
              match.awayTeamName = team2Doc.data().name;
            }
          }

          // Ensure consistent field names
          if (!match.team1Id && match.homeTeamId) {
            match.team1Id = match.homeTeamId;
          }
          if (!match.team2Id && match.awayTeamId) {
            match.team2Id = match.awayTeamId;
          }
          if (!match.team1Name && match.homeTeamName) {
            match.team1Name = match.homeTeamName;
          }
          if (!match.team2Name && match.awayTeamName) {
            match.team2Name = match.awayTeamName;
          }

          return match;
        })
      );

      setMatches(matchesData);
    } catch (err) {
      console.error("Error fetching matches:", err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setMatchData({
      ...matchData,
      [name]: value,
    });
  };

  const handleResultInputChange = (e) => {
    const { name, value } = e.target;
    setResultData({
      ...resultData,
      [name]: name.includes("Score") ? parseInt(value) : value,
    });
  };

  const handleCreateMatch = async (e) => {
    e.preventDefault();

    if (!isAdmin) {
      setError("Only administrators can create matches");
      return;
    }
    try {
      // Get team names for the match
      const team1Doc = await getDoc(doc(db, "teams", matchData.team1Id));
      const team2Doc = await getDoc(doc(db, "teams", matchData.team2Id));

      const team1Name = team1Doc.exists()
        ? team1Doc.data().name
        : "Unknown Team";
      const team2Name = team2Doc.exists()
        ? team2Doc.data().name
        : "Unknown Team";

      const newMatch = {
        ...matchData,
        tournamentId,
        homeTeamId: matchData.team1Id,
        awayTeamId: matchData.team2Id,
        homeTeamName: team1Name,
        awayTeamName: team2Name,
        status: "scheduled",
        createdAt: Timestamp.now(),
        scheduledTime: Timestamp.fromDate(new Date(matchData.scheduledDate)),
      };

      await addDoc(collection(db, "matches"), newMatch);

      setSuccessMessage("Match created successfully!");
      setIsCreateMatchModalOpen(false);
      setMatchData({
        team1Id: "",
        team2Id: "",
        scheduledDate: "",
        location: "",
        notes: "",
      });

      // Refresh matches
      fetchMatches();
    } catch (err) {
      console.error("Error creating match:", err);
      setError("Failed to create match");
    }
  };

  const handleRecordResult = async (e) => {
    e.preventDefault();

    if (!isAdmin) {
      setError("Only administrators can record match results");
      return;
    }

    if (!selectedMatch) {
      setError("No match selected");
      return;
    }
    try {
      // Update match with results - using homeScore/awayScore for consistency
      await updateDoc(doc(db, "matches", selectedMatch.id), {
        homeScore: resultData.team1Score,
        awayScore: resultData.team2Score,
        homeTeamId: selectedMatch.team1Id,
        awayTeamId: selectedMatch.team2Id,
        homeTeamName: selectedMatch.team1Name,
        awayTeamName: selectedMatch.team2Name,
        status: "finished",
        completedAt: Timestamp.now(),
      });

      // Determine winner
      const winnerId =
        resultData.team1Score > resultData.team2Score
          ? selectedMatch.team1Id
          : resultData.team2Score > resultData.team1Score
          ? selectedMatch.team2Id
          : null; // Draw if scores are equal

      // Update tournament standings if there's a winner
      if (winnerId) {
        const tournamentRef = doc(db, "tournaments", tournamentId);
        await updateDoc(tournamentRef, {
          standings: arrayUnion({
            teamId: winnerId,
            matchId: selectedMatch.id,
            points: 3, // 3 points for a win
          }),
        });
      } else {
        // Draw - both teams get 1 point
        const tournamentRef = doc(db, "tournaments", tournamentId);
        await updateDoc(tournamentRef, {
          standings: arrayUnion(
            {
              teamId: selectedMatch.team1Id,
              matchId: selectedMatch.id,
              points: 1, // 1 point for a draw
            },
            {
              teamId: selectedMatch.team2Id,
              matchId: selectedMatch.id,
              points: 1, // 1 point for a draw
            }
          ),
        });
      }
      // Record player statistics if provided (players are part of teams)
      if (resultData.playerStats && resultData.playerStats.length > 0) {
        for (const playerStat of resultData.playerStats) {
          await addDoc(collection(db, "playerStats"), {
            matchId: selectedMatch.id,
            tournamentId,
            playerId: playerStat.playerId,
            teamId: playerStat.teamId, // Link player stats to their team
            goals: playerStat.goals || 0,
            assists: playerStat.assists || 0,
            yellowCards: playerStat.yellowCards || 0,
            redCards: playerStat.redCards || 0,
            minutesPlayed: playerStat.minutesPlayed || 0,
            createdAt: Timestamp.now(),
          });
        }
      }

      // Update team statistics for this tournament
      const team1StatsUpdate = {
        gamesPlayed: Timestamp.now(),
        goalsScored: resultData.team1Score,
        goalsConceded: resultData.team2Score,
        result:
          resultData.team1Score > resultData.team2Score
            ? "win"
            : resultData.team1Score < resultData.team2Score
            ? "loss"
            : "draw",
      };

      const team2StatsUpdate = {
        gamesPlayed: Timestamp.now(),
        goalsScored: resultData.team2Score,
        goalsConceded: resultData.team1Score,
        result:
          resultData.team2Score > resultData.team1Score
            ? "win"
            : resultData.team2Score < resultData.team1Score
            ? "loss"
            : "draw",
      };

      // Add team stats to tournament history
      await addDoc(collection(db, "teamStats"), {
        tournamentId,
        matchId: selectedMatch.id,
        teamId: selectedMatch.team1Id,
        ...team1StatsUpdate,
      });

      await addDoc(collection(db, "teamStats"), {
        tournamentId,
        matchId: selectedMatch.id,
        teamId: selectedMatch.team2Id,
        ...team2StatsUpdate,
      });

      setSuccessMessage("Match result recorded successfully!");
      setIsRecordResultModalOpen(false);
      setSelectedMatch(null);
      setResultData({
        team1Score: 0,
        team2Score: 0,
        playerStats: [],
      });

      // Refresh matches
      fetchMatches();
    } catch (err) {
      console.error("Error recording match result:", err);
      setError("Failed to record match result");
    }
  }; // Fetch players for a single team
  const fetchTeamPlayers = async (teamId) => {
    try {
      const teamDoc = await getDoc(doc(db, "teams", teamId));
      if (teamDoc.exists() && teamDoc.data().memberIds) {
        const playersList = [];
        for (const playerId of teamDoc.data().memberIds) {
          const playerDoc = await getDoc(doc(db, "users", playerId));
          if (playerDoc.exists()) {
            playersList.push({
              id: playerId,
              name:
                playerDoc.data().firstName + " " + playerDoc.data().lastName ||
                playerDoc.data().displayName ||
                playerDoc.data().email,
              teamId: teamId,
            });
          }
        }
        return playersList;
      }
      return [];
    } catch (err) {
      console.error("Error fetching team players:", err);
      return [];
    }
  };

  const openRecordResultModal = async (match) => {
    setSelectedMatch(match);
    setResultData({
      team1Score: match.team1Score || 0,
      team2Score: match.team2Score || 0,
      playerStats: [],
    });

    // Fetch players from both teams to allow recording individual stats
    if (match.team1Id) {
      const players = await fetchTeamPlayers(match.team1Id);
      setTeam1Players(players);
    }

    if (match.team2Id) {
      const players = await fetchTeamPlayers(match.team2Id);
      setTeam2Players(players);
    }
    setIsRecordResultModalOpen(true);
  };

  const updatePlayerStat = (index, field, value) => {
    const updatedStats = [...resultData.playerStats];
    updatedStats[index][field] = parseInt(value);

    setResultData((prev) => ({
      ...prev,
      playerStats: updatedStats,
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Link
          to={`/tournament/${tournamentId}`}
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
          Back to Tournament
        </Link>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Match Management</h1>
          {isAdmin && (
            <button
              onClick={() => setIsCreateMatchModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
            >
              Create Match
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
            <p>{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6">
            <p>{successMessage}</p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-3 px-4 text-left">Teams</th>
                <th className="py-3 px-4 text-left">Date</th>
                <th className="py-3 px-4 text-left">Location</th>
                <th className="py-3 px-4 text-left">Status</th>
                <th className="py-3 px-4 text-left">Result</th>
                <th className="py-3 px-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {matches.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="py-4 px-4 text-center text-gray-500"
                  >
                    No matches scheduled yet
                  </td>
                </tr>
              ) : (
                matches.map((match) => (
                  <tr key={match.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      {match.team1Name || "Team 1"} vs{" "}
                      {match.team2Name || "Team 2"}
                    </td>
                    <td className="py-3 px-4">
                      {match.scheduledDate
                        ? new Date(
                            match.scheduledDate.seconds * 1000
                          ).toLocaleString()
                        : "Not scheduled"}
                    </td>
                    <td className="py-3 px-4">{match.location || "TBD"}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium
                          ${
                            match.status === "finished"
                              ? "bg-green-100 text-green-800"
                              : match.status === "in_progress"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-blue-100 text-blue-800"
                          }
                        `}
                      >
                        {match.status === "finished"
                          ? "Completed"
                          : match.status === "in_progress"
                          ? "In Progress"
                          : "Scheduled"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {match.status === "finished"
                        ? `${match.team1Score || 0} - ${match.team2Score || 0}`
                        : "N/A"}
                    </td>
                    <td className="py-3 px-4">
                      {isAdmin && match.status !== "finished" && (
                        <button
                          onClick={() => openRecordResultModal(match)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Record Result
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Match Modal */}
      {isCreateMatchModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">Create New Match</h2>
            <form onSubmit={handleCreateMatch}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Team 1</label>
                <select
                  name="team1Id"
                  value={matchData.team1Id}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                >
                  <option value="">Select Team 1</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Team 2</label>
                <select
                  name="team2Id"
                  value={matchData.team2Id}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                >
                  <option value="">Select Team 2</option>
                  {teams
                    .filter((team) => team.id !== matchData.team1Id)
                    .map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Date & Time</label>
                <input
                  type="datetime-local"
                  name="scheduledDate"
                  value={matchData.scheduledDate}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Location</label>
                <input
                  type="text"
                  name="location"
                  value={matchData.location}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Notes</label>
                <textarea
                  name="notes"
                  value={matchData.notes}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md"
                  rows="3"
                ></textarea>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreateMatchModalOpen(false)}
                  className="px-4 py-2 border rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md"
                >
                  Create Match
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Result Modal */}
      {isRecordResultModalOpen && selectedMatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-screen overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Record Match Result</h2>
            <form onSubmit={handleRecordResult}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-gray-700 mb-2">
                    {selectedMatch.team1Name || "Team 1"} Score
                  </label>
                  <input
                    type="number"
                    name="team1Score"
                    value={resultData.team1Score}
                    onChange={handleResultInputChange}
                    className="w-full px-3 py-2 border rounded-md"
                    min="0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">
                    {selectedMatch.team2Name || "Team 2"} Score
                  </label>
                  <input
                    type="number"
                    name="team2Score"
                    value={resultData.team2Score}
                    onChange={handleResultInputChange}
                    className="w-full px-3 py-2 border rounded-md"
                    min="0"
                    required
                  />
                </div>
              </div>{" "}
              <h3 className="text-xl font-bold mb-4">Player Statistics</h3>
              {/* Team 1 Players */}
              <h4 className="text-lg font-semibold mb-2">
                {selectedMatch.team1Name || "Team 1"} Players
              </h4>
              <div className="overflow-x-auto mb-6">
                <table className="min-w-full bg-white">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="py-2 px-3 text-left">Player</th>
                      <th className="py-2 px-3 text-center">Goals</th>
                      <th className="py-2 px-3 text-center">Assists</th>
                      <th className="py-2 px-3 text-center">Yellow Cards</th>
                      <th className="py-2 px-3 text-center">Red Cards</th>
                      <th className="py-2 px-3 text-center">Minutes Played</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team1Players.map((player, index) => (
                      <tr key={player.id} className="border-b">
                        <td className="py-2 px-3">{player.name}</td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            value={
                              resultData.playerStats.find(
                                (p) => p.playerId === player.id
                              )?.goals || 0
                            }
                            onChange={(e) => {
                              const statIndex =
                                resultData.playerStats.findIndex(
                                  (p) => p.playerId === player.id
                                );
                              if (statIndex >= 0) {
                                updatePlayerStat(
                                  statIndex,
                                  "goals",
                                  e.target.value
                                );
                              } else {
                                const newStats = [...resultData.playerStats];
                                newStats.push({
                                  playerId: player.id,
                                  playerName: player.name,
                                  teamId: selectedMatch.team1Id,
                                  goals: parseInt(e.target.value),
                                  assists: 0,
                                  yellowCards: 0,
                                  redCards: 0,
                                  minutesPlayed: 0,
                                });
                                setResultData({
                                  ...resultData,
                                  playerStats: newStats,
                                });
                              }
                            }}
                            className="w-16 px-2 py-1 border rounded-md text-center"
                            min="0"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            value={
                              resultData.playerStats.find(
                                (p) => p.playerId === player.id
                              )?.assists || 0
                            }
                            onChange={(e) => {
                              const statIndex =
                                resultData.playerStats.findIndex(
                                  (p) => p.playerId === player.id
                                );
                              if (statIndex >= 0) {
                                updatePlayerStat(
                                  statIndex,
                                  "assists",
                                  e.target.value
                                );
                              } else {
                                const newStats = [...resultData.playerStats];
                                newStats.push({
                                  playerId: player.id,
                                  playerName: player.name,
                                  teamId: selectedMatch.team1Id,
                                  goals: 0,
                                  assists: parseInt(e.target.value),
                                  yellowCards: 0,
                                  redCards: 0,
                                  minutesPlayed: 0,
                                });
                                setResultData({
                                  ...resultData,
                                  playerStats: newStats,
                                });
                              }
                            }}
                            className="w-16 px-2 py-1 border rounded-md text-center"
                            min="0"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            value={
                              resultData.playerStats.find(
                                (p) => p.playerId === player.id
                              )?.yellowCards || 0
                            }
                            onChange={(e) => {
                              const statIndex =
                                resultData.playerStats.findIndex(
                                  (p) => p.playerId === player.id
                                );
                              if (statIndex >= 0) {
                                updatePlayerStat(
                                  statIndex,
                                  "yellowCards",
                                  e.target.value
                                );
                              } else {
                                const newStats = [...resultData.playerStats];
                                newStats.push({
                                  playerId: player.id,
                                  playerName: player.name,
                                  teamId: selectedMatch.team1Id,
                                  goals: 0,
                                  assists: 0,
                                  yellowCards: parseInt(e.target.value),
                                  redCards: 0,
                                  minutesPlayed: 0,
                                });
                                setResultData({
                                  ...resultData,
                                  playerStats: newStats,
                                });
                              }
                            }}
                            className="w-16 px-2 py-1 border rounded-md text-center"
                            min="0"
                            max="2"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            value={
                              resultData.playerStats.find(
                                (p) => p.playerId === player.id
                              )?.redCards || 0
                            }
                            onChange={(e) => {
                              const statIndex =
                                resultData.playerStats.findIndex(
                                  (p) => p.playerId === player.id
                                );
                              if (statIndex >= 0) {
                                updatePlayerStat(
                                  statIndex,
                                  "redCards",
                                  e.target.value
                                );
                              } else {
                                const newStats = [...resultData.playerStats];
                                newStats.push({
                                  playerId: player.id,
                                  playerName: player.name,
                                  teamId: selectedMatch.team1Id,
                                  goals: 0,
                                  assists: 0,
                                  yellowCards: 0,
                                  redCards: parseInt(e.target.value),
                                  minutesPlayed: 0,
                                });
                                setResultData({
                                  ...resultData,
                                  playerStats: newStats,
                                });
                              }
                            }}
                            className="w-16 px-2 py-1 border rounded-md text-center"
                            min="0"
                            max="1"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            value={
                              resultData.playerStats.find(
                                (p) => p.playerId === player.id
                              )?.minutesPlayed || 0
                            }
                            onChange={(e) => {
                              const statIndex =
                                resultData.playerStats.findIndex(
                                  (p) => p.playerId === player.id
                                );
                              if (statIndex >= 0) {
                                updatePlayerStat(
                                  statIndex,
                                  "minutesPlayed",
                                  e.target.value
                                );
                              } else {
                                const newStats = [...resultData.playerStats];
                                newStats.push({
                                  playerId: player.id,
                                  playerName: player.name,
                                  teamId: selectedMatch.team1Id,
                                  goals: 0,
                                  assists: 0,
                                  yellowCards: 0,
                                  redCards: 0,
                                  minutesPlayed: parseInt(e.target.value),
                                });
                                setResultData({
                                  ...resultData,
                                  playerStats: newStats,
                                });
                              }
                            }}
                            className="w-16 px-2 py-1 border rounded-md text-center"
                            min="0"
                          />
                        </td>
                      </tr>
                    ))}
                    {team1Players.length === 0 && (
                      <tr>
                        <td
                          colSpan="6"
                          className="py-2 px-3 text-center text-gray-500"
                        >
                          No players found for this team
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Team 2 Players */}
              <h4 className="text-lg font-semibold mb-2">
                {selectedMatch.team2Name || "Team 2"} Players
              </h4>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="py-2 px-3 text-left">Player</th>
                      <th className="py-2 px-3 text-center">Goals</th>
                      <th className="py-2 px-3 text-center">Assists</th>
                      <th className="py-2 px-3 text-center">Yellow Cards</th>
                      <th className="py-2 px-3 text-center">Red Cards</th>
                      <th className="py-2 px-3 text-center">Minutes Played</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team2Players.map((player, index) => (
                      <tr key={player.id} className="border-b">
                        <td className="py-2 px-3">{player.name}</td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            value={
                              resultData.playerStats.find(
                                (p) => p.playerId === player.id
                              )?.goals || 0
                            }
                            onChange={(e) => {
                              const statIndex =
                                resultData.playerStats.findIndex(
                                  (p) => p.playerId === player.id
                                );
                              if (statIndex >= 0) {
                                updatePlayerStat(
                                  statIndex,
                                  "goals",
                                  e.target.value
                                );
                              } else {
                                const newStats = [...resultData.playerStats];
                                newStats.push({
                                  playerId: player.id,
                                  playerName: player.name,
                                  teamId: selectedMatch.team2Id,
                                  goals: parseInt(e.target.value),
                                  assists: 0,
                                  yellowCards: 0,
                                  redCards: 0,
                                  minutesPlayed: 0,
                                });
                                setResultData({
                                  ...resultData,
                                  playerStats: newStats,
                                });
                              }
                            }}
                            className="w-16 px-2 py-1 border rounded-md text-center"
                            min="0"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            value={
                              resultData.playerStats.find(
                                (p) => p.playerId === player.id
                              )?.assists || 0
                            }
                            onChange={(e) => {
                              const statIndex =
                                resultData.playerStats.findIndex(
                                  (p) => p.playerId === player.id
                                );
                              if (statIndex >= 0) {
                                updatePlayerStat(
                                  statIndex,
                                  "assists",
                                  e.target.value
                                );
                              } else {
                                const newStats = [...resultData.playerStats];
                                newStats.push({
                                  playerId: player.id,
                                  playerName: player.name,
                                  teamId: selectedMatch.team2Id,
                                  goals: 0,
                                  assists: parseInt(e.target.value),
                                  yellowCards: 0,
                                  redCards: 0,
                                  minutesPlayed: 0,
                                });
                                setResultData({
                                  ...resultData,
                                  playerStats: newStats,
                                });
                              }
                            }}
                            className="w-16 px-2 py-1 border rounded-md text-center"
                            min="0"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            value={
                              resultData.playerStats.find(
                                (p) => p.playerId === player.id
                              )?.yellowCards || 0
                            }
                            onChange={(e) => {
                              const statIndex =
                                resultData.playerStats.findIndex(
                                  (p) => p.playerId === player.id
                                );
                              if (statIndex >= 0) {
                                updatePlayerStat(
                                  statIndex,
                                  "yellowCards",
                                  e.target.value
                                );
                              } else {
                                const newStats = [...resultData.playerStats];
                                newStats.push({
                                  playerId: player.id,
                                  playerName: player.name,
                                  teamId: selectedMatch.team2Id,
                                  goals: 0,
                                  assists: 0,
                                  yellowCards: parseInt(e.target.value),
                                  redCards: 0,
                                  minutesPlayed: 0,
                                });
                                setResultData({
                                  ...resultData,
                                  playerStats: newStats,
                                });
                              }
                            }}
                            className="w-16 px-2 py-1 border rounded-md text-center"
                            min="0"
                            max="2"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            value={
                              resultData.playerStats.find(
                                (p) => p.playerId === player.id
                              )?.redCards || 0
                            }
                            onChange={(e) => {
                              const statIndex =
                                resultData.playerStats.findIndex(
                                  (p) => p.playerId === player.id
                                );
                              if (statIndex >= 0) {
                                updatePlayerStat(
                                  statIndex,
                                  "redCards",
                                  e.target.value
                                );
                              } else {
                                const newStats = [...resultData.playerStats];
                                newStats.push({
                                  playerId: player.id,
                                  playerName: player.name,
                                  teamId: selectedMatch.team2Id,
                                  goals: 0,
                                  assists: 0,
                                  yellowCards: 0,
                                  redCards: parseInt(e.target.value),
                                  minutesPlayed: 0,
                                });
                                setResultData({
                                  ...resultData,
                                  playerStats: newStats,
                                });
                              }
                            }}
                            className="w-16 px-2 py-1 border rounded-md text-center"
                            min="0"
                            max="1"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            value={
                              resultData.playerStats.find(
                                (p) => p.playerId === player.id
                              )?.minutesPlayed || 0
                            }
                            onChange={(e) => {
                              const statIndex =
                                resultData.playerStats.findIndex(
                                  (p) => p.playerId === player.id
                                );
                              if (statIndex >= 0) {
                                updatePlayerStat(
                                  statIndex,
                                  "minutesPlayed",
                                  e.target.value
                                );
                              } else {
                                const newStats = [...resultData.playerStats];
                                newStats.push({
                                  playerId: player.id,
                                  playerName: player.name,
                                  teamId: selectedMatch.team2Id,
                                  goals: 0,
                                  assists: 0,
                                  yellowCards: 0,
                                  redCards: 0,
                                  minutesPlayed: parseInt(e.target.value),
                                });
                                setResultData({
                                  ...resultData,
                                  playerStats: newStats,
                                });
                              }
                            }}
                            className="w-16 px-2 py-1 border rounded-md text-center"
                            min="0"
                          />
                        </td>
                      </tr>
                    ))}
                    {team2Players.length === 0 && (
                      <tr>
                        <td
                          colSpan="6"
                          className="py-2 px-3 text-center text-gray-500"
                        >
                          No players found for this team
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  type="button"
                  onClick={() => setIsRecordResultModalOpen(false)}
                  className="px-4 py-2 border rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md"
                >
                  Save Result
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MatchManagement;
