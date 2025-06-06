import React, { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { db } from "../firebase";
import {
  collection,
  doc,
  getDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";

function TeamRankings() {
  const { tournamentId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tournament, setTournament] = useState(null);
  const [teamStats, setTeamStats] = useState([]);

  useEffect(() => {
    if (tournamentId) {
      fetchTournamentAndRankings();
    }
  }, [tournamentId]);

  const fetchTournamentAndRankings = async () => {
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

      const tournamentData = tournamentDoc.data();
      setTournament({
        id: tournamentId,
        ...tournamentData,
      }); // Fetch matches for this tournament
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

      // Calculate team statistics based on matches
      await calculateTeamStats(matches);

      setLoading(false);
    } catch (err) {
      console.error("Error fetching tournament data:", err);
      setError("Failed to load tournament rankings");
      setLoading(false);
    }
  };

  const calculateTeamStats = async (matches) => {
    try {
      // Create a map to store team stats
      const teamsMap = {};

      // Process each match to calculate team stats
      for (const match of matches) {
        // Skip if team info is missing
        if (!match.team1Id || !match.team2Id) continue;

        // Get team info if not already fetched
        if (!teamsMap[match.team1Id]) {
          const teamDoc = await getDoc(doc(db, "teams", match.team1Id));
          if (teamDoc.exists()) {
            teamsMap[match.team1Id] = {
              id: match.team1Id,
              name: teamDoc.data().name,
              logo: teamDoc.data().logo || null,
              matches: 0,
              wins: 0,
              draws: 0,
              losses: 0,
              goalsFor: 0,
              goalsAgainst: 0,
              points: 0,
            };
          }
        }

        if (!teamsMap[match.team2Id]) {
          const teamDoc = await getDoc(doc(db, "teams", match.team2Id));
          if (teamDoc.exists()) {
            teamsMap[match.team2Id] = {
              id: match.team2Id,
              name: teamDoc.data().name,
              logo: teamDoc.data().logo || null,
              matches: 0,
              wins: 0,
              draws: 0,
              losses: 0,
              goalsFor: 0,
              goalsAgainst: 0,
              points: 0,
            };
          }
        }

        // Skip if team data couldn't be fetched
        if (!teamsMap[match.team1Id] || !teamsMap[match.team2Id]) continue;

        // Update match count
        teamsMap[match.team1Id].matches += 1;
        teamsMap[match.team2Id].matches += 1;

        // Update goals
        teamsMap[match.team1Id].goalsFor += match.team1Score || 0;
        teamsMap[match.team1Id].goalsAgainst += match.team2Score || 0;
        teamsMap[match.team2Id].goalsFor += match.team2Score || 0;
        teamsMap[match.team2Id].goalsAgainst += match.team1Score || 0;

        // Update wins, draws, losses and points
        if (match.team1Score > match.team2Score) {
          // Team 1 wins
          teamsMap[match.team1Id].wins += 1;
          teamsMap[match.team1Id].points += 3;
          teamsMap[match.team2Id].losses += 1;
        } else if (match.team2Score > match.team1Score) {
          // Team 2 wins
          teamsMap[match.team2Id].wins += 1;
          teamsMap[match.team2Id].points += 3;
          teamsMap[match.team1Id].losses += 1;
        } else {
          // Draw
          teamsMap[match.team1Id].draws += 1;
          teamsMap[match.team1Id].points += 1;
          teamsMap[match.team2Id].draws += 1;
          teamsMap[match.team2Id].points += 1;
        }
      }

      // Convert to array and sort by points
      const teamStatsArray = Object.values(teamsMap);

      // Sort teams by: points, goal difference, goals for
      teamStatsArray.sort((a, b) => {
        // First compare points
        if (b.points !== a.points) {
          return b.points - a.points;
        }

        // Then goal difference
        const aGoalDiff = a.goalsFor - a.goalsAgainst;
        const bGoalDiff = b.goalsFor - b.goalsAgainst;
        if (bGoalDiff !== aGoalDiff) {
          return bGoalDiff - aGoalDiff;
        }

        // Then goals scored
        if (b.goalsFor !== a.goalsFor) {
          return b.goalsFor - a.goalsFor;
        }

        // Alphabetical as last resort
        return a.name.localeCompare(b.name);
      });

      setTeamStats(teamStatsArray);
    } catch (err) {
      console.error("Error calculating team stats:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading tournament rankings...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !tournament) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-xl shadow p-6 text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
            <p className="text-gray-700 mb-4">{error}</p>
            <Link
              to="/tournaments"
              className="text-blue-600 hover:text-blue-800"
            >
              Go back to tournaments
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Back navigation */}
        <div className="mb-6">
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

        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
          <div className="bg-green-700 text-white p-6">
            <h1 className="text-3xl font-bold">Team Rankings</h1>
            {tournament && (
              <p className="text-green-100 mt-2">
                {tournament.name} - {tournament.sport}
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 m-6">
              <p>{error}</p>
            </div>
          )}

          <div className="p-6">
            {teamStats.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No team rankings available yet.</p>
                {tournament && tournament.status !== "Completed" && (
                  <p className="text-gray-500 mt-2">
                    Rankings will appear after matches have been played and
                    recorded.
                  </p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white table-auto">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="py-3 px-4 text-left font-medium text-gray-500 uppercase tracking-wider">
                        Position
                      </th>
                      <th className="py-3 px-4 text-left font-medium text-gray-500 uppercase tracking-wider">
                        Team
                      </th>
                      <th className="py-3 px-4 text-center font-medium text-gray-500 uppercase tracking-wider">
                        Played
                      </th>
                      <th className="py-3 px-4 text-center font-medium text-gray-500 uppercase tracking-wider">
                        Won
                      </th>
                      <th className="py-3 px-4 text-center font-medium text-gray-500 uppercase tracking-wider">
                        Drawn
                      </th>
                      <th className="py-3 px-4 text-center font-medium text-gray-500 uppercase tracking-wider">
                        Lost
                      </th>
                      <th className="py-3 px-4 text-center font-medium text-gray-500 uppercase tracking-wider">
                        GF
                      </th>
                      <th className="py-3 px-4 text-center font-medium text-gray-500 uppercase tracking-wider">
                        GA
                      </th>
                      <th className="py-3 px-4 text-center font-medium text-gray-500 uppercase tracking-wider">
                        GD
                      </th>
                      <th className="py-3 px-4 text-center font-medium text-gray-500 uppercase tracking-wider">
                        Points
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {teamStats.map((team, index) => (
                      <tr
                        key={team.id}
                        className={`hover:bg-gray-50 ${
                          index < 3 ? "bg-green-50" : ""
                        }`}
                      >
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-medium">{index + 1}</span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {team.logo && (
                              <img
                                src={team.logo}
                                alt={team.name}
                                className="w-8 h-8 rounded-full mr-2"
                              />
                            )}
                            <span className="font-medium">{team.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {team.matches}
                        </td>
                        <td className="py-3 px-4 text-center">{team.wins}</td>
                        <td className="py-3 px-4 text-center">{team.draws}</td>
                        <td className="py-3 px-4 text-center">{team.losses}</td>
                        <td className="py-3 px-4 text-center">
                          {team.goalsFor}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {team.goalsAgainst}
                        </td>
                        <td className="py-3 px-4 text-center font-medium">
                          {team.goalsFor - team.goalsAgainst > 0
                            ? `+${team.goalsFor - team.goalsAgainst}`
                            : team.goalsFor - team.goalsAgainst}
                        </td>
                        <td className="py-3 px-4 text-center font-bold">
                          {team.points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TeamRankings;
