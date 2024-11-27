import React, { useState } from "react";
import { Link } from "react-router-dom";

function Ranking() {
  const [selectedTournament, setSelectedTournament] = useState("all");

  // Mock data - to be replaced with API calls
  const tournaments = [
    { id: 1, name: " Basketball League 2024" },
    { id: 2, name: "Summer Football Championship" },
  ];

  const rankings = [
    {
      tournamentId: 1,
      teams: [
        {
          position: 1,
          name: "Chicago Bulls",
          played: 10,
          won: 8,
          draw: 1,
          lost: 1,
          points: 25,
        },
        {
          position: 2,
          name: "Toronto Raptors",
          played: 10,
          won: 7,
          draw: 2,
          lost: 1,
          points: 23,
        },
        {
          position: 3,
          name: "Boston Celtics",
          played: 10,
          won: 6,
          draw: 2,
          lost: 2,
          points: 20,
        },
        {
          position: 4,
          name: "Miami Heat",
          played: 10,
          won: 5,
          draw: 3,
          lost: 2,
          points: 18,
        },
      ],
    },
    {
      tournamentId: 2,
      teams: [
        {
          position: 1,
          name: "Real Madrid",
          played: 8,
          won: 7,
          draw: 0,
          lost: 1,
          points: 21,
        },
        {
          position: 2,
          name: "Barcelona",
          played: 8,
          won: 6,
          draw: 1,
          lost: 1,
          points: 19,
        },
        {
          position: 3,
          name: "Atletico Madrid",
          played: 8,
          won: 5,
          draw: 0,
          lost: 3,
          points: 15,
        },
        {
          position: 4,
          name: "Sevilla",
          played: 8,
          won: 4,
          draw: 1,
          lost: 3,
          points: 13,
        },
        {
          position: 5,
          name: "Real Sociedad",
          played: 8,
          won: 4,
          draw: 0,
          lost: 4,
          points: 12,
        },
        {
          position: 6,
          name: "Villareal",
          played: 8,
          won: 3,
          draw: 2,
          lost: 3,
          points: 11,
        },
        {
          position: 7,
          name: "Valencia",
          played: 8,
          won: 2,
          draw: 3,
          lost: 3,
          points: 9,
        },
        {
          position: 8,
          name: "Athletic Bilbao",
          played: 8,
          won: 2,
          draw: 2,
          lost: 4,
          points: 8,
        },
      ],
    },
  ];

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

        {/* Tournament Selector */}
        <div className="max-w-3xl mx-auto mb-8">
          <select
            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={selectedTournament}
            onChange={(e) => setSelectedTournament(e.target.value)}
          >
            <option value="all">Select Tournament</option>
            {tournaments.map((tournament) => (
              <option key={tournament.id} value={tournament.id}>
                {tournament.name}
              </option>
            ))}
          </select>
        </div>

        {/* Rankings Table */}
        <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
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
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                    Points
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rankings
                  .find((r) => r.tournamentId === Number(selectedTournament))
                  ?.teams?.map((team) => (
                    <tr key={team.name} className="hover:bg-gray-50">
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
                        {team.name}
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
                      <td className="px-6 py-4 text-center text-sm font-semibold text-blue-600">
                        {team.points}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

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
