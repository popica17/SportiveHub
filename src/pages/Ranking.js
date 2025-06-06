import React, { useState, useEffect } from "react";
import {
  Link,
  useParams,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { db } from "../firebase";
import {
  collection,
  doc,
  getDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from "firebase/firestore";

function Ranking() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedTournament, setSelectedTournament] = useState(
    tournamentId || "all"
  );
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [teamStats, setTeamStats] = useState([]);
  const [activeTab, setActiveTab] = useState("rankings");
  const [upcomingMatches, setUpcomingMatches] = useState([]);
  const [recentResults, setRecentResults] = useState([]);
  const [playerStats, setPlayerStats] = useState([]);
  const [teamFormData, setTeamFormData] = useState({}); // State for team form data
  const [statCategory, setStatCategory] = useState("goals"); // Default stat category for player filtering
  const [sortCache, setSortCache] = useState({});

  // Handle tab parameter from URL
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (
      tabParam &&
      ["rankings", "matches", "players", "upcoming", "results"].includes(
        tabParam
      )
    ) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Fetch all tournaments on component mount
  useEffect(() => {
    fetchTournaments();
  }, []);
  // When tournament ID or selected tournament changes, fetch rankings
  useEffect(() => {
    if (selectedTournament && selectedTournament !== "all") {
      // Clear sort cache when tournament changes
      setSortCache({});
      fetchTournamentRankings(selectedTournament);
      fetchUpcomingMatches(selectedTournament);
      fetchRecentResults(selectedTournament);
      fetchPlayerStats(selectedTournament);
      fetchTeamForm(selectedTournament); // New fetch for team form
    } else {
      setTeamStats([]);
      setUpcomingMatches([]);
      setRecentResults([]);
      setPlayerStats([]);
      setTeamFormData({});
      setLoading(false);
    }
  }, [selectedTournament]);

  // Re-sort player stats when stat category changes
  useEffect(() => {
    if (playerStats.length > 0) {
      setPlayerStats(sortPlayerStats([...playerStats], statCategory));
    }
  }, [statCategory]);

  const fetchTournaments = async () => {
    try {
      setLoading(true);
      const tournamentsRef = collection(db, "tournaments");
      const tournamentsSnapshot = await getDocs(tournamentsRef);

      const tournamentsList = tournamentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
      }));

      setTournaments(tournamentsList);

      // If we have a tournamentId in URL but it's not in our selected tournament
      if (tournamentId && selectedTournament === "all") {
        setSelectedTournament(tournamentId);
      }
    } catch (err) {
      console.error("Error fetching tournaments:", err);
      setError("Failed to load tournaments");
    } finally {
      if (selectedTournament === "all") {
        setLoading(false);
      }
    }
  };

  // New function to fetch team form data (last 5 match results)
  const fetchTeamForm = async (tournamentId) => {
    try {
      const matchesQuery = query(
        collection(db, "matches"),
        where("tournamentId", "==", tournamentId),
        where("status", "==", "finished"),
        orderBy("completedAt", "desc")
      );

      const matchesSnapshot = await getDocs(matchesQuery);
      const matches = matchesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Process matches to get form data for each team
      const formData = {};

      matches.forEach((match) => {
        // Home Team - Add form result
        if (!formData[match.homeTeamId]) {
          formData[match.homeTeamId] = [];
        }

        // Away Team - Add form result
        if (!formData[match.awayTeamId]) {
          formData[match.awayTeamId] = [];
        }

        // Add result: 'W' for win, 'D' for draw, 'L' for loss
        if (match.homeScore > match.awayScore) {
          formData[match.homeTeamId].push("W");
          formData[match.awayTeamId].push("L");
        } else if (match.homeScore < match.awayScore) {
          formData[match.homeTeamId].push("L");
          formData[match.awayTeamId].push("W");
        } else {
          formData[match.homeTeamId].push("D");
          formData[match.awayTeamId].push("D");
        }

        // Limit to last 5 matches per team
        if (formData[match.homeTeamId].length > 5) {
          formData[match.homeTeamId] = formData[match.homeTeamId].slice(0, 5);
        }

        if (formData[match.awayTeamId].length > 5) {
          formData[match.awayTeamId] = formData[match.awayTeamId].slice(0, 5);
        }
      });

      setTeamFormData(formData);
    } catch (err) {
      console.error("Error fetching team form data:", err);
    }
  };

  // Helper function to render form indicators
  const renderFormIndicators = (teamId) => {
    if (!teamFormData[teamId] || teamFormData[teamId].length === 0) {
      return <span className="text-xs text-gray-400">No recent matches</span>;
    }

    return (
      <div className="flex space-x-1">
        {teamFormData[teamId].map((result, idx) => (
          <span
            key={idx}
            className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
              result === "W"
                ? "bg-green-100 text-green-800"
                : result === "D"
                ? "bg-yellow-100 text-yellow-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {result}
          </span>
        ))}
      </div>
    );
  };

  const fetchTournamentRankings = async (tournamentId) => {
    try {
      setLoading(true);

      // Fetch tournament details
      const tournamentRef = doc(db, "tournaments", tournamentId);
      const tournamentDoc = await getDoc(tournamentRef);

      if (!tournamentDoc.exists()) {
        setError("Tournament not found");
        setLoading(false);
        return;
      }

      // Fetch matches for this tournament
      const matchesQuery = query(
        collection(db, "matches"),
        where("tournamentId", "==", tournamentId),
        where("status", "==", "finished")
      );

      const matchesSnapshot = await getDocs(matchesQuery);
      const matches = matchesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Calculate stats for each team
      const teamsMap = {};

      // Initialize with teams that have registered for the tournament
      const registeredTeamsQuery = query(
        collection(db, "tournamentTeams"),
        where("tournamentId", "==", tournamentId)
      );

      const registeredTeamsSnapshot = await getDocs(registeredTeamsQuery);

      // Get all registered team IDs to fetch their details later
      const teamIds = registeredTeamsSnapshot.docs.map(
        (doc) => doc.data().teamId
      );

      // Initialize team data with registration info
      registeredTeamsSnapshot.docs.forEach((doc) => {
        const teamData = doc.data();
        teamsMap[teamData.teamId] = {
          teamId: teamData.teamId,
          name: teamData.teamName,
          logo: null, // We'll update this later
          played: 0,
          won: 0,
          draw: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          points: 0,
        };
      });

      // Process match data
      matches.forEach((match) => {
        const homeTeamId = match.homeTeamId;
        const awayTeamId = match.awayTeamId;

        // Ensure both teams exist in the map
        if (!teamsMap[homeTeamId]) {
          teamsMap[homeTeamId] = {
            teamId: homeTeamId,
            name: match.homeTeamName,
            logo: null, // We'll update this later
            played: 0,
            won: 0,
            draw: 0,
            lost: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            points: 0,
          };
          // Add this team to the list to fetch
          if (!teamIds.includes(homeTeamId)) {
            teamIds.push(homeTeamId);
          }
        }

        if (!teamsMap[awayTeamId]) {
          teamsMap[awayTeamId] = {
            teamId: awayTeamId,
            name: match.awayTeamName,
            logo: null, // We'll update this later
            played: 0,
            won: 0,
            draw: 0,
            lost: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            points: 0,
          };
          // Add this team to the list to fetch
          if (!teamIds.includes(awayTeamId)) {
            teamIds.push(awayTeamId);
          }
        }

        // Update match statistics
        const homeTeam = teamsMap[homeTeamId];
        const awayTeam = teamsMap[awayTeamId];

        // Update games played
        homeTeam.played++;
        awayTeam.played++;

        // Update goals
        homeTeam.goalsFor += match.homeScore;
        homeTeam.goalsAgainst += match.awayScore;
        awayTeam.goalsFor += match.awayScore;
        awayTeam.goalsAgainst += match.homeScore;

        // Update wins, draws, losses and points
        if (match.homeScore > match.awayScore) {
          // Home team wins
          homeTeam.won++;
          homeTeam.points += 3;
          awayTeam.lost++;
        } else if (match.homeScore < match.awayScore) {
          // Away team wins
          awayTeam.won++;
          awayTeam.points += 3;
          homeTeam.lost++;
        } else {
          // Draw
          homeTeam.draw++;
          awayTeam.draw++;
          homeTeam.points += 1;
          awayTeam.points += 1;
        }
      }); // Fetch team logos and names from the teams collection
      for (const teamId of teamIds) {
        try {
          const teamRef = doc(db, "teams", teamId);
          const teamDoc = await getDoc(teamRef);

          if (teamDoc.exists() && teamsMap[teamId]) {
            const teamData = teamDoc.data();
            if (teamData.logo) {
              teamsMap[teamId].logo = teamData.logo;
            }
            // Update team name from the main teams collection to ensure accuracy
            if (teamData.name) {
              teamsMap[teamId].name = teamData.name;
            }
          }
        } catch (err) {
          console.error(`Error fetching data for team ${teamId}:`, err);
        }
      }

      // Convert to array and sort by points (and goal difference as tiebreaker)
      let teamsArray = Object.values(teamsMap);
      teamsArray.sort((a, b) => {
        if (b.points !== a.points) {
          return b.points - a.points; // Higher points first
        }
        // If points are equal, use goal difference
        const aGoalDiff = a.goalsFor - a.goalsAgainst;
        const bGoalDiff = b.goalsFor - b.goalsAgainst;
        return bGoalDiff - aGoalDiff;
      });

      // Add position to each team
      teamsArray = teamsArray.map((team, index) => ({
        ...team,
        position: index + 1,
      }));

      setTeamStats(teamsArray);
    } catch (err) {
      console.error("Error fetching rankings:", err);
      setError("Failed to load rankings");
    } finally {
      setLoading(false);
    }
  };

  const fetchUpcomingMatches = async (tournamentId) => {
    try {
      // Fetch upcoming matches (matches with status "scheduled")
      const upcomingMatchesQuery = query(
        collection(db, "matches"),
        where("tournamentId", "==", tournamentId),
        where("status", "==", "scheduled"),
        orderBy("scheduledTime"),
        limit(10)
      );

      const upcomingMatchesSnapshot = await getDocs(upcomingMatchesQuery);
      const matches = upcomingMatchesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setUpcomingMatches(matches);
    } catch (err) {
      console.error("Error fetching upcoming matches:", err);
    }
  };

  const fetchRecentResults = async (tournamentId) => {
    try {
      // Fetch recent completed matches
      const recentMatchesQuery = query(
        collection(db, "matches"),
        where("tournamentId", "==", tournamentId),
        where("status", "==", "finished"),
        orderBy("completedAt", "desc"),
        limit(10)
      );

      const recentMatchesSnapshot = await getDocs(recentMatchesQuery);
      const matches = recentMatchesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setRecentResults(matches);
    } catch (err) {
      console.error("Error fetching recent results:", err);
    }
  };
  const fetchPlayerStats = async (tournamentId) => {
    try {
      // Query player stats from the tournamentPlayerStats collection (correct collection)
      const statsQuery = query(
        collection(db, "tournamentPlayerStats"),
        where("tournamentId", "==", tournamentId)
      );

      const statsSnapshot = await getDocs(statsQuery);

      // Group statistics by player
      const statsMap = {};
      for (const statDoc of statsSnapshot.docs) {
        const stat = statDoc.data();
        const playerId = stat.playerId;

        if (!statsMap[playerId]) {
          // Get player information
          const playerDoc = await getDoc(doc(db, "users", playerId));
          const playerData = playerDoc.exists() ? playerDoc.data() : {}; // Get team information
          let teamName = "Unknown Team";
          let teamId = stat.teamId;

          if (teamId) {
            try {
              const teamDoc = await getDoc(doc(db, "teams", teamId));
              if (teamDoc.exists()) {
                const teamData = teamDoc.data();
                teamName = teamData.name || "Unknown Team";
              } else {
                console.warn(`Team document not found for teamId: ${teamId}`);
              }
            } catch (teamError) {
              console.error(`Error fetching team ${teamId}:`, teamError);
            }
          } else {
            console.warn(
              `No teamId found in player stats for player: ${playerId}`
            );
          }

          statsMap[playerId] = {
            playerId,
            playerName:
              playerData.firstName && playerData.lastName
                ? `${playerData.firstName} ${playerData.lastName}`
                : playerData.displayName ||
                  playerData.email ||
                  "Unknown Player",
            photoURL: playerData.photoURL || null,
            teamId: teamId,
            teamName: teamName,
            goals: 0,
            assists: 0,
            yellowCards: 0,
            redCards: 0,
            matchesPlayed: 0,
          };
        }

        // Accumulate statistics
        statsMap[playerId].goals += stat.goals || 0;
        statsMap[playerId].assists += stat.assists || 0;
        statsMap[playerId].yellowCards += stat.yellowCards || 0;
        statsMap[playerId].redCards += stat.redCards || 0;
        statsMap[playerId].matchesPlayed += stat.matchesPlayed || 0;
      }

      // Convert to array and sort based on current stat category
      const playerStatsArray = sortPlayerStats(
        Object.values(statsMap),
        statCategory
      );
      setPlayerStats(playerStatsArray);
    } catch (err) {
      console.error("Error fetching player statistics:", err);
    }
  };
  // Helper function to sort player stats by different categories with caching
  const sortPlayerStats = (players, category) => {
    // If we already have this category sorted in the cache, use it
    if (sortCache[category]) {
      return sortCache[category];
    }

    let sortedPlayers;
    switch (category) {
      case "goals":
        sortedPlayers = [...players].sort((a, b) => b.goals - a.goals);
        break;
      case "assists":
        sortedPlayers = [...players].sort((a, b) => b.assists - a.assists);
        break;
      case "yellowCards":
        sortedPlayers = [...players].sort(
          (a, b) => b.yellowCards - a.yellowCards
        );
        break;
      case "redCards":
        sortedPlayers = [...players].sort((a, b) => b.redCards - a.redCards);
        break;
      default:
        sortedPlayers = [...players].sort((a, b) => b.goals - a.goals);
    }

    // Update the cache
    setSortCache((prevCache) => ({
      ...prevCache,
      [category]: sortedPlayers,
    }));

    return sortedPlayers;
  };
  // Helper function to get top player in a specific category using cache
  const getTopPlayerInCategory = (category, players) => {
    if (!players || players.length === 0) {
      return null;
    }

    // Use cached sorted players if available
    let sortedPlayers;
    if (sortCache[category]) {
      sortedPlayers = sortCache[category];
    } else {
      // Otherwise sort and cache for later use
      sortedPlayers = [...players];
      switch (category) {
        case "goals":
          sortedPlayers.sort((a, b) => b.goals - a.goals);
          break;
        case "assists":
          sortedPlayers.sort((a, b) => b.assists - a.assists);
          break;
        case "yellowCards":
          sortedPlayers.sort((a, b) => b.yellowCards - a.yellowCards);
          break;
        case "redCards":
          sortedPlayers.sort((a, b) => b.redCards - a.redCards);
          break;
        default:
          return null;
      }

      // Cache the sorted players
      setSortCache((prevCache) => ({
        ...prevCache,
        [category]: sortedPlayers,
      }));
    }

    // Return the top player with the relevant stat > 0
    switch (category) {
      case "goals":
        return sortedPlayers.find((p) => p.goals > 0) || null;
      case "assists":
        return sortedPlayers.find((p) => p.assists > 0) || null;
      case "yellowCards":
        return sortedPlayers.find((p) => p.yellowCards > 0) || null;
      case "redCards":
        return sortedPlayers.find((p) => p.redCards > 0) || null;
      default:
        return null;
    }
  };

  const handleTournamentChange = (e) => {
    const tournamentId = e.target.value;
    setSelectedTournament(tournamentId);
    // Update URL if a specific tournament is selected
    if (tournamentId !== "all") {
      navigate(`/tournament/${tournamentId}/rankings`);
    } else {
      navigate("/ranking");
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Tournament Rankings
          </h1>
          <p className="text-lg text-gray-600">
            View current standings and statistics
          </p>
        </div>
        {/* Back button if viewing a specific tournament */}
        {tournamentId && (
          <div className="max-w-5xl mx-auto mb-4">
            <Link
              to="/ranking"
              className="inline-flex items-center text-blue-600 hover:text-blue-700"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                ></path>
              </svg>
              Back to All Rankings
            </Link>
          </div>
        )}
        {/* Error message */}
        {error && (
          <div className="max-w-5xl mx-auto mb-8 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        {/* Tournament Selector */}
        <div className="max-w-3xl mx-auto mb-8">
          <select
            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={selectedTournament}
            onChange={handleTournamentChange}
            disabled={loading}
          >
            <option value="all">Select Tournament</option>
            {tournaments.map((tournament) => (
              <option key={tournament.id} value={tournament.id}>
                {tournament.name}
              </option>
            ))}
          </select>
        </div>
        {/* Loading state */}
        {loading && (
          <div className="max-w-5xl mx-auto text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading rankings...</p>
          </div>
        )}
        {/* No tournament selected */}
        {!loading && selectedTournament === "all" && (
          <div className="max-w-5xl mx-auto text-center py-12 bg-white rounded-xl shadow-md">
            <svg
              className="w-16 h-16 mx-auto text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h2 className="text-xl font-medium text-gray-700 mb-2">
              Please Select a Tournament
            </h2>
            <p className="text-gray-500">
              Choose a tournament from the dropdown to view its rankings
            </p>
            <div className="mt-6">
              <Link
                to="/tournaments"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                Browse Tournaments
              </Link>
            </div>
          </div>
        )}
        {/* No rankings available */}{" "}
        {!loading && selectedTournament !== "all" && teamStats.length === 0 && (
          <div className="max-w-5xl mx-auto text-center py-12 bg-white rounded-xl shadow-md">
            <svg
              className="w-16 h-16 mx-auto text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h2 className="text-xl font-medium text-gray-700 mb-2">
              No Rankings Available
            </h2>
            <p className="text-gray-500 mb-4">
              This tournament doesn't have any completed matches yet
            </p>
            <div className="mt-4 text-sm text-gray-600 max-w-lg mx-auto">
              <p>
                Rankings are automatically calculated after matches are played.
                When teams play matches, they earn:
              </p>
              <ul className="list-disc list-inside mt-2 text-left">
                <li>3 points for a win</li>
                <li>1 point for a draw</li>
                <li>0 points for a loss</li>
              </ul>
              <p className="mt-2">
                Teams are ranked by total points, with goal difference as a
                tiebreaker.
              </p>
            </div>
          </div>
        )}
        {/* Tab Navigation */}
        {!loading && selectedTournament !== "all" && (
          <div className="max-w-5xl mx-auto mb-8">
            <div className="flex space-x-4">
              <button
                onClick={() => handleTabChange("rankings")}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center ${
                  activeTab === "rankings"
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Rankings
              </button>
              <button
                onClick={() => handleTabChange("matches")}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center ${
                  activeTab === "matches"
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Matches
              </button>
              <button
                onClick={() => handleTabChange("players")}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center ${
                  activeTab === "players"
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Players
              </button>
            </div>
          </div>
        )}
        {/* Rankings Table */}
        {!loading && selectedTournament !== "all" && (
          <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
            {/* Tab Navigation */}
            <div className="bg-gray-50 border-b border-gray-200">
              <div className="flex">
                <button
                  onClick={() => setActiveTab("rankings")}
                  className={`px-6 py-3 text-sm font-medium ${
                    activeTab === "rankings"
                      ? "text-blue-600 border-b-2 border-blue-500"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Team Rankings
                </button>
                <button
                  onClick={() => setActiveTab("upcoming")}
                  className={`px-6 py-3 text-sm font-medium ${
                    activeTab === "upcoming"
                      ? "text-blue-600 border-b-2 border-blue-500"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Upcoming Matches
                </button>
                <button
                  onClick={() => setActiveTab("results")}
                  className={`px-6 py-3 text-sm font-medium ${
                    activeTab === "results"
                      ? "text-blue-600 border-b-2 border-blue-500"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Recent Results
                </button>
                <button
                  onClick={() => setActiveTab("players")}
                  className={`px-6 py-3 text-sm font-medium ${
                    activeTab === "players"
                      ? "text-blue-600 border-b-2 border-blue-500"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Player Statistics
                </button>
              </div>
            </div>
            {/* Rankings Table - Original Content */}
            {activeTab === "rankings" && teamStats.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                        Position
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                        Team
                      </th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                        Played
                      </th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                        Won
                      </th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                        Draw
                      </th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                        Lost
                      </th>
                      <th
                        className="px-6 py-4 text-center text-sm font-semibold text-gray-900"
                        title="Goals For"
                      >
                        GF
                      </th>
                      <th
                        className="px-6 py-4 text-center text-sm font-semibold text-gray-900"
                        title="Goals Against"
                      >
                        GA
                      </th>
                      <th
                        className="px-6 py-4 text-center text-sm font-semibold text-gray-900"
                        title="Goal Difference"
                      >
                        GD
                      </th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                        Points
                      </th>
                    </tr>{" "}
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {teamStats.map((team) => (
                      <tr key={team.teamId} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full 
                            ${
                              team.position === 1
                                ? "bg-yellow-100 text-yellow-800"
                                : team.position === 2
                                ? "bg-gray-100 text-gray-800"
                                : team.position === 3
                                ? "bg-orange-100 text-orange-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {team.position}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          <div className="flex flex-col">
                            <div className="flex items-center">
                              {team.logo ? (
                                <img
                                  src={team.logo}
                                  alt={`${team.name} logo`}
                                  className="w-8 h-8 mr-3 rounded-full object-cover"
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                      team.name
                                    )}&background=0D8ABC&color=fff`;
                                  }}
                                />
                              ) : (
                                <div className="w-8 h-8 mr-3 rounded-full bg-blue-100 flex items-center justify-center">
                                  <span className="text-blue-800 font-semibold">
                                    {team.name ? team.name.charAt(0) : "?"}
                                  </span>
                                </div>
                              )}
                              {team.name || "Unknown Team"}
                            </div>
                            {/* Form indicators - last 5 matches */}
                            <div className="ml-11 mt-1">
                              {teamFormData[team.teamId] &&
                              teamFormData[team.teamId].length > 0 ? (
                                <div className="flex space-x-1">
                                  {teamFormData[team.teamId].map(
                                    (result, idx) => (
                                      <span
                                        key={idx}
                                        className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold
                                        ${
                                          result === "W"
                                            ? "bg-green-100 text-green-800"
                                            : result === "D"
                                            ? "bg-yellow-100 text-yellow-800"
                                            : "bg-red-100 text-red-800"
                                        }`}
                                      >
                                        {result}
                                      </span>
                                    )
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">
                                  No form data
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-gray-500">
                          {team.played}
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-gray-500">
                          {team.won}
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-gray-500">
                          {team.draw}
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-gray-500">
                          {team.lost}
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-gray-500">
                          {team.goalsFor}
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-gray-500">
                          {team.goalsAgainst}
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-gray-500">
                          {team.goalsFor - team.goalsAgainst}
                        </td>
                        <td className="px-6 py-4 text-center text-sm font-semibold text-blue-600">
                          {team.points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-4 text-xs text-gray-500 border-t">
                  <span className="inline-block mr-4">GF: Goals For</span>
                  <span className="inline-block mr-4">GA: Goals Against</span>
                  <span className="inline-block">GD: Goal Difference</span>
                </div>
              </div>
            )}
            {/* No Rankings */}
            {activeTab === "rankings" && teamStats.length === 0 && (
              <div className="text-center py-12">
                <svg
                  className="w-16 h-16 mx-auto text-gray-400 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <h2 className="text-xl font-medium text-gray-700 mb-2">
                  No Rankings Available
                </h2>
                <p className="text-gray-500 mb-4">
                  This tournament doesn't have any completed matches yet
                </p>
              </div>
            )}
            {/* Upcoming Matches Tab */}
            {activeTab === "upcoming" && (
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-800">
                    Upcoming Matches
                  </h2>
                  <div className="text-sm text-blue-600">
                    Next {upcomingMatches.length} scheduled matches
                  </div>
                </div>

                {upcomingMatches.length > 0 ? (
                  <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 pr-2">
                    <div className="grid gap-6 md:grid-cols-1">
                      {upcomingMatches.map((match) => {
                        // Calculate how many days until match
                        let daysUntil = "TBD";
                        let isToday = false;
                        let isTomorrow = false;

                        if (match.scheduledTime) {
                          const matchDate = new Date(
                            match.scheduledTime.seconds * 1000
                          );
                          const today = new Date();

                          // Reset hours to compare just the dates
                          today.setHours(0, 0, 0, 0);
                          const matchDateCopy = new Date(matchDate);
                          matchDateCopy.setHours(0, 0, 0, 0);

                          const timeDiff =
                            matchDateCopy.getTime() - today.getTime();
                          const dayDiff = Math.ceil(
                            timeDiff / (1000 * 3600 * 24)
                          );

                          if (dayDiff === 0) {
                            daysUntil = "Today";
                            isToday = true;
                          } else if (dayDiff === 1) {
                            daysUntil = "Tomorrow";
                            isTomorrow = true;
                          } else if (dayDiff > 1) {
                            daysUntil = `In ${dayDiff} days`;
                          }
                        }

                        return (
                          <div
                            key={match.id}
                            className={`border rounded-lg p-4 shadow-sm relative overflow-hidden
                            ${
                              isToday
                                ? "bg-blue-50 border-blue-200"
                                : isTomorrow
                                ? "bg-purple-50 border-purple-200"
                                : ""
                            }
                          `}
                          >
                            {isToday && (
                              <div className="absolute top-2 right-2">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  Today's Match
                                </span>
                              </div>
                            )}
                            {isTomorrow && (
                              <div className="absolute top-2 right-2">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                  Tomorrow
                                </span>
                              </div>
                            )}

                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center space-x-3">
                                {/* Home Team */}
                                <div className="text-right">
                                  <div className="font-medium">
                                    {match.homeTeamName}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    Home
                                  </div>
                                </div>
                                {/* Home Team Logo */}
                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                                  <span className="font-bold">
                                    {match.homeTeamName
                                      ? match.homeTeamName.charAt(0)
                                      : "H"}
                                  </span>
                                </div>
                              </div>

                              {/* Match Info */}
                              <div className="text-center px-4">
                                <div className="font-semibold text-gray-800">
                                  vs
                                </div>
                                <div className="text-sm text-gray-500">
                                  {match.scheduledTime
                                    ? new Date(
                                        match.scheduledTime.seconds * 1000
                                      ).toLocaleDateString()
                                    : "TBD"}
                                </div>
                                <div className="text-xs">
                                  {match.scheduledTime
                                    ? new Date(
                                        match.scheduledTime.seconds * 1000
                                      ).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    : ""}
                                </div>
                              </div>

                              {/* Away Team */}
                              <div className="flex items-center space-x-3">
                                {/* Away Team Logo */}
                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                                  <span className="font-bold">
                                    {match.awayTeamName
                                      ? match.awayTeamName.charAt(0)
                                      : "A"}
                                  </span>
                                </div>
                                <div>
                                  <div className="font-medium">
                                    {match.awayTeamName}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    Away
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Match details footer */}
                            <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
                              {/* Match location if available */}
                              <div className="text-sm text-gray-600">
                                <span className="inline-flex items-center">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4 mr-1"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                    />
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                  </svg>
                                  {match.location || "Venue TBD"}
                                </span>
                              </div>

                              {/* Days until match indicator */}
                              <div>
                                <span
                                  className={`text-xs font-medium px-2 py-1 rounded
                                ${
                                  isToday
                                    ? "bg-blue-100 text-blue-800"
                                    : isTomorrow
                                    ? "bg-purple-100 text-purple-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                                >
                                  {daysUntil}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}{" "}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                    <svg
                      className="w-12 h-12 mx-auto text-gray-400 mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="text-gray-500 mb-2">
                      No upcoming matches scheduled
                    </p>
                    <p className="text-sm text-gray-400">
                      Match schedules will appear here once they are announced
                    </p>
                  </div>
                )}
              </div>
            )}
            {/* Recent Results Tab */}
            {activeTab === "results" && (
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-800">
                    Recent Results
                  </h2>
                  {recentResults.length > 0 && (
                    <div className="text-sm text-blue-600">
                      Last {recentResults.length} matches
                    </div>
                  )}
                </div>

                {recentResults.length > 0 ? (
                  <div className="grid gap-6 md:grid-cols-2">
                    {recentResults.map((match) => {
                      // Determine match result presentation
                      const homeWin = match.homeScore > match.awayScore;
                      const awayWin = match.homeScore < match.awayScore;
                      const isDraw = match.homeScore === match.awayScore;

                      const getWinnerClass = (isWinner) => {
                        return isWinner
                          ? "font-bold text-green-700"
                          : isDraw
                          ? "font-medium text-yellow-700"
                          : "text-gray-600";
                      };

                      // Format match date
                      const matchDate = match.completedAt
                        ? new Date(match.completedAt.seconds * 1000)
                        : null;
                      const dateStr = matchDate
                        ? matchDate.toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })
                        : "";

                      return (
                        <div
                          key={match.id}
                          className="border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
                        >
                          <div className="text-sm text-gray-500 mb-2">
                            {dateStr}{" "}
                            {match.location ? `• ${match.location}` : ""}
                          </div>

                          <div className="flex items-center justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center">
                                {/* Home Team */}
                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mr-3">
                                  <span className="font-bold">
                                    {match.homeTeamName
                                      ? match.homeTeamName.charAt(0)
                                      : "H"}
                                  </span>
                                </div>
                                <div className={getWinnerClass(homeWin)}>
                                  {match.homeTeamName}
                                </div>
                              </div>
                            </div>

                            {/* Score */}
                            <div className="px-3 py-2 rounded-lg bg-gray-50">
                              <div className="flex items-baseline">
                                <span
                                  className={`text-xl font-bold ${
                                    homeWin ? "text-green-600" : ""
                                  }`}
                                >
                                  {match.homeScore}
                                </span>
                                <span className="mx-2 text-gray-400">-</span>
                                <span
                                  className={`text-xl font-bold ${
                                    awayWin ? "text-green-600" : ""
                                  }`}
                                >
                                  {match.awayScore}
                                </span>
                              </div>
                              <div className="text-xs text-center text-gray-500">
                                {isDraw
                                  ? "Draw"
                                  : homeWin
                                  ? "Home Win"
                                  : "Away Win"}
                              </div>
                            </div>

                            <div className="flex-1 text-right">
                              <div className="flex items-center justify-end">
                                <div className={getWinnerClass(awayWin)}>
                                  {match.awayTeamName}
                                </div>
                                {/* Away Team Logo */}
                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center ml-3">
                                  <span className="font-bold">
                                    {match.awayTeamName
                                      ? match.awayTeamName.charAt(0)
                                      : "A"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Match statistics if available */}
                          {match.stats && (
                            <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-xs text-gray-600">
                              <div className="text-center">
                                <p className="font-medium">Shots</p>
                                <p className="mt-1">
                                  {match.stats.homeShotsOnTarget || 0} -{" "}
                                  {match.stats.awayShotsOnTarget || 0}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="font-medium">Possession</p>
                                <p className="mt-1">
                                  {match.stats.homePossession || "50%"} -{" "}
                                  {match.stats.awayPossession || "50%"}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="font-medium">Cards</p>
                                <p className="mt-1">
                                  {(match.stats.homeYellowCards || 0) +
                                    (match.stats.homeRedCards || 0)}{" "}
                                  -{" "}
                                  {(match.stats.awayYellowCards || 0) +
                                    (match.stats.awayRedCards || 0)}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                    <svg
                      className="w-12 h-12 mx-auto text-gray-400 mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      ></path>
                    </svg>
                    <p className="text-gray-500 mb-2">
                      No completed matches yet
                    </p>
                    <p className="text-sm text-gray-400">
                      Match results will appear here after matches have been
                      played
                    </p>
                  </div>
                )}
              </div>
            )}{" "}
            {/* Player Statistics Tab */}
            {activeTab === "players" && (
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-800">
                    Player Statistics:{" "}
                    {statCategory === "goals"
                      ? "Top Scorers"
                      : statCategory === "assists"
                      ? "Top Assists"
                      : statCategory === "yellowCards"
                      ? "Yellow Cards"
                      : statCategory === "redCards"
                      ? "Red Cards"
                      : "Rankings"}
                  </h2>
                  {playerStats.length > 0 && (
                    <div className="text-sm text-blue-600">
                      {playerStats.length} players
                    </div>
                  )}
                </div>

                {playerStats.length === 0 ? (
                  <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-6 mb-6">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg
                          className="h-5 w-5 text-blue-400"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="font-medium text-blue-800 mb-2">
                          No Player Statistics
                        </h3>
                        <p>
                          No player data is available for this tournament yet.
                          Statistics will appear after matches have been played.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Stats summary cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      {/* Top scorer card */}
                      <div
                        className={`bg-white p-4 rounded-lg border shadow-sm ${
                          statCategory === "goals"
                            ? "border-blue-300 ring-1 ring-blue-300"
                            : "border-gray-200"
                        }`}
                      >
                        <div className="text-sm text-gray-500 mb-1">
                          Top Scorer
                        </div>
                        <div className="flex items-center">
                          {(() => {
                            const topScorer = getTopPlayerInCategory(
                              "goals",
                              playerStats
                            );
                            return topScorer ? (
                              <>
                                <div className="flex-shrink-0">
                                  {topScorer.photoURL ? (
                                    <img
                                      src={topScorer.photoURL}
                                      alt=""
                                      className="h-10 w-10 rounded-full mr-3"
                                    />
                                  ) : (
                                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                                      <span className="text-blue-800 font-medium">
                                        {topScorer.playerName.charAt(0)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {topScorer.playerName}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {topScorer.goals} goals
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="text-sm text-gray-500">
                                No goals scored yet
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      {/* Top assists card */}
                      <div
                        className={`bg-white p-4 rounded-lg border shadow-sm ${
                          statCategory === "assists"
                            ? "border-blue-300 ring-1 ring-blue-300"
                            : "border-gray-200"
                        }`}
                      >
                        <div className="text-sm text-gray-500 mb-1">
                          Most Assists
                        </div>
                        <div className="flex items-center">
                          {(() => {
                            const topAssister = getTopPlayerInCategory(
                              "assists",
                              playerStats
                            );
                            return topAssister ? (
                              <>
                                <div className="flex-shrink-0">
                                  {topAssister.photoURL ? (
                                    <img
                                      src={topAssister.photoURL}
                                      alt=""
                                      className="h-10 w-10 rounded-full mr-3"
                                    />
                                  ) : (
                                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                                      <span className="text-blue-800 font-medium">
                                        {topAssister.playerName.charAt(0)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {topAssister.playerName}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {topAssister.assists} assists
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="text-sm text-gray-500">
                                No assists recorded yet
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      {/* Most yellow cards */}
                      <div
                        className={`bg-white p-4 rounded-lg border shadow-sm ${
                          statCategory === "yellowCards"
                            ? "border-blue-300 ring-1 ring-blue-300"
                            : "border-gray-200"
                        }`}
                      >
                        <div className="text-sm text-gray-500 mb-1">
                          Most Yellow Cards
                        </div>
                        <div className="flex items-center">
                          {(() => {
                            const topYellowCards = getTopPlayerInCategory(
                              "yellowCards",
                              playerStats
                            );
                            return topYellowCards ? (
                              <>
                                <div className="flex-shrink-0">
                                  {topYellowCards.photoURL ? (
                                    <img
                                      src={topYellowCards.photoURL}
                                      alt=""
                                      className="h-10 w-10 rounded-full mr-3"
                                    />
                                  ) : (
                                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                                      <span className="text-blue-800 font-medium">
                                        {topYellowCards.playerName.charAt(0)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {topYellowCards.playerName}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {topYellowCards.yellowCards} yellow cards
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="text-sm text-gray-500">
                                No yellow cards issued yet
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      {/* Most red cards */}
                      <div
                        className={`bg-white p-4 rounded-lg border shadow-sm ${
                          statCategory === "redCards"
                            ? "border-blue-300 ring-1 ring-blue-300"
                            : "border-gray-200"
                        }`}
                      >
                        <div className="text-sm text-gray-500 mb-1">
                          Most Red Cards
                        </div>
                        <div className="flex items-center">
                          {(() => {
                            const topRedCards = getTopPlayerInCategory(
                              "redCards",
                              playerStats
                            );
                            return topRedCards ? (
                              <>
                                <div className="flex-shrink-0">
                                  {topRedCards.photoURL ? (
                                    <img
                                      src={topRedCards.photoURL}
                                      alt=""
                                      className="h-10 w-10 rounded-full mr-3"
                                    />
                                  ) : (
                                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                                      <span className="text-blue-800 font-medium">
                                        {topRedCards.playerName.charAt(0)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {topRedCards.playerName}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {topRedCards.redCards} red cards
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="text-sm text-gray-500">
                                No red cards issued yet
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                    {/* Stats categories */}
                    <div className="mb-6 flex flex-wrap gap-2">
                      <button
                        onClick={() => setStatCategory("goals")}
                        className={`px-4 py-2 rounded-full ${
                          statCategory === "goals"
                            ? "bg-blue-100 text-blue-800 font-medium"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        } text-sm transition-colors duration-200`}
                      >
                        Top Scorers
                      </button>
                      <button
                        onClick={() => setStatCategory("assists")}
                        className={`px-4 py-2 rounded-full ${
                          statCategory === "assists"
                            ? "bg-blue-100 text-blue-800 font-medium"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        } text-sm transition-colors duration-200`}
                      >
                        Top Assists
                      </button>
                      <button
                        onClick={() => setStatCategory("yellowCards")}
                        className={`px-4 py-2 rounded-full ${
                          statCategory === "yellowCards"
                            ? "bg-blue-100 text-blue-800 font-medium"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        } text-sm transition-colors duration-200`}
                      >
                        Yellow Cards
                      </button>
                      <button
                        onClick={() => setStatCategory("redCards")}
                        className={`px-4 py-2 rounded-full ${
                          statCategory === "redCards"
                            ? "bg-blue-100 text-blue-800 font-medium"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        } text-sm transition-colors duration-200`}
                      >
                        Red Cards
                      </button>
                    </div>
                    {/* Stats leaderboard */}{" "}
                    <div className="overflow-hidden bg-white shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                      <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50">
                          <tr>
                            <th
                              scope="col"
                              className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
                            >
                              Rank
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                            >
                              Player
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                            >
                              Team
                            </th>
                            <th
                              scope="col"
                              className={`px-3 py-3.5 text-center text-sm font-semibold ${
                                statCategory === "goals"
                                  ? "text-blue-700"
                                  : "text-gray-900"
                              }`}
                            >
                              {statCategory === "goals" && (
                                <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-1"></span>
                              )}
                              Goals
                            </th>
                            <th
                              scope="col"
                              className={`px-3 py-3.5 text-center text-sm font-semibold ${
                                statCategory === "assists"
                                  ? "text-blue-700"
                                  : "text-gray-900"
                              }`}
                            >
                              {statCategory === "assists" && (
                                <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-1"></span>
                              )}
                              Assists
                            </th>
                            <th
                              scope="col"
                              className={`px-3 py-3.5 text-center text-sm font-semibold ${
                                statCategory === "yellowCards" ||
                                statCategory === "redCards"
                                  ? "text-blue-700"
                                  : "text-gray-900"
                              }`}
                            >
                              {(statCategory === "yellowCards" ||
                                statCategory === "redCards") && (
                                <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-1"></span>
                              )}
                              {statCategory === "yellowCards"
                                ? "Yellow Cards"
                                : statCategory === "redCards"
                                ? "Red Cards"
                                : "Cards"}
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900"
                            >
                              Matches
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {playerStats.map((player, index) => (
                            <tr
                              key={player.playerId}
                              className={
                                index < 3 ? "bg-yellow-50" : "hover:bg-gray-50"
                              }
                            >
                              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                                {index === 0 ? (
                                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-100 text-yellow-800 font-bold">
                                    1
                                  </span>
                                ) : index === 1 ? (
                                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-200 text-gray-700 font-bold">
                                    2
                                  </span>
                                ) : index === 2 ? (
                                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-100 text-orange-800 font-bold">
                                    3
                                  </span>
                                ) : (
                                  <span className="pl-2">{index + 1}</span>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                                <div className="flex items-center">
                                  {player.photoURL ? (
                                    <img
                                      src={player.photoURL}
                                      alt=""
                                      className="h-8 w-8 rounded-full mr-3 object-cover"
                                    />
                                  ) : (
                                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                                      <span className="text-blue-800 font-medium text-sm">
                                        {player.playerName
                                          .charAt(0)
                                          .toUpperCase()}
                                      </span>
                                    </div>
                                  )}
                                  <div className="font-medium">
                                    {player.playerName}
                                  </div>
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                                {player.teamName}
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-center">
                                <div
                                  className={`font-semibold ${
                                    statCategory === "goals" && index < 3
                                      ? "text-blue-700"
                                      : statCategory === "goals"
                                      ? "text-blue-600"
                                      : "text-gray-900"
                                  }`}
                                >
                                  {player.goals}
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-center">
                                <div
                                  className={`${
                                    statCategory === "assists" && index < 3
                                      ? "font-semibold text-blue-700"
                                      : statCategory === "assists"
                                      ? "font-semibold text-blue-600"
                                      : "text-gray-900"
                                  }`}
                                >
                                  {player.assists}
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-center">
                                <div className="flex justify-center items-center space-x-1">
                                  {player.yellowCards > 0 && (
                                    <span
                                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${
                                        statCategory === "yellowCards"
                                          ? "bg-yellow-200 text-yellow-900 font-bold"
                                          : "bg-yellow-100 text-yellow-800"
                                      } text-xs ${
                                        statCategory === "yellowCards"
                                          ? "font-bold"
                                          : "font-medium"
                                      }`}
                                    >
                                      {player.yellowCards}
                                    </span>
                                  )}
                                  {player.redCards > 0 && (
                                    <span
                                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${
                                        statCategory === "redCards"
                                          ? "bg-red-200 text-red-900 font-bold"
                                          : "bg-red-100 text-red-800"
                                      } text-xs ${
                                        statCategory === "redCards"
                                          ? "font-bold"
                                          : "font-medium"
                                      }`}
                                    >
                                      {player.redCards}
                                    </span>
                                  )}
                                  {player.yellowCards === 0 &&
                                    player.redCards === 0 && (
                                      <span className="text-gray-400">-</span>
                                    )}
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-3 py-4 text-sm text-center text-gray-900">
                                {player.matchesPlayed}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {/* Legend */}
                      <div className="px-6 py-3 bg-gray-50 text-xs text-gray-500 flex items-center justify-center">
                        <span className="inline-flex items-center mr-4">
                          <span className="w-3 h-3 rounded-full bg-yellow-100 mr-1"></span>
                          Yellow Card
                        </span>
                        <span className="inline-flex items-center">
                          <span className="w-3 h-3 rounded-full bg-red-100 mr-1"></span>
                          Red Card
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        {/* Link to Tournaments */}
        <div className="text-center mt-8">
          <Link
            to="/tournaments"
            className="inline-flex items-center text-blue-600 hover:text-blue-700"
          >
            View All Tournaments
            <svg
              className="w-5 h-5 ml-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Ranking;
