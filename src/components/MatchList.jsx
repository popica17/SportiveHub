import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";

function MatchList({ tournamentId, tournamentName }) {
  const { isAdmin, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [matches, setMatches] = useState([]);
  const [filter, setFilter] = useState("all"); // all, scheduled, live, finished

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log("MatchList - Fetching matches for tournament:", tournamentId);
        
        if (!tournamentId) {
          console.error("MatchList - Missing tournamentId parameter");
          setError("Tournament ID is missing");
          setLoading(false);
          return;
        }

        let matchesQuery;
        
        if (filter === "all") {
          console.log("MatchList - Fetching all matches");
          matchesQuery = query(
            collection(db, "matches"),
            where("tournamentId", "==", tournamentId),
            orderBy("scheduledTime")
          );
        } else {
          console.log(`MatchList - Fetching matches with status: ${filter}`);
          matchesQuery = query(
            collection(db, "matches"),
            where("tournamentId", "==", tournamentId),
            where("status", "==", filter),
            orderBy("scheduledTime")
          );
        }

        console.log("MatchList - Executing query for matches");
        const matchesSnapshot = await getDocs(matchesQuery);
        console.log(`MatchList - Query returned ${matchesSnapshot.size} matches`);

        const matchesList = [];
        
        // Safely process each document
        matchesSnapshot.forEach(doc => {
          try {
            const data = doc.data();
            // Add some validation to prevent common issues
            if (data) {
              matchesList.push({
                id: doc.id,
                ...data
              });
            }
          } catch (docErr) {
            console.error("Error processing match document:", docErr);
          }
        });

        console.log("MatchList - Processed matches:", matchesList);
        setMatches(matchesList);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching matches:", err);
        console.error("Error details:", {
          message: err.message,
          stack: err.stack,
          tournamentId: tournamentId
        });
        setError(`Failed to load matches: ${err.message}`);
        setLoading(false);
      }
    };

    fetchMatches();
  }, [tournamentId, filter]);

  // Group matches by date
  const matchesByDate = useMemo(() => {
    const groupedMatches = {};

    matches.forEach(match => {
      try {
        // Use the date as key (without time)
        let matchDate = "Unscheduled";
        
        if (match.scheduledTime) {
          // Handle both Firestore timestamp and regular date formats
          if (match.scheduledTime.seconds) {
            matchDate = new Date(match.scheduledTime.seconds * 1000).toDateString();
          } else if (match.scheduledTime instanceof Date) {
            matchDate = match.scheduledTime.toDateString();
          } else if (typeof match.scheduledTime === 'string') {
            matchDate = new Date(match.scheduledTime).toDateString();
          }
        }
        
        if (!groupedMatches[matchDate]) {
          groupedMatches[matchDate] = [];
        }
        
        groupedMatches[matchDate].push(match);
      } catch (err) {
        console.error("Error processing match for date grouping:", err, match);
        // Add to Unscheduled group if there's an error
        if (!groupedMatches["Unscheduled"]) {
          groupedMatches["Unscheduled"] = [];
        }
        groupedMatches["Unscheduled"].push(match);
      }
    });

    return groupedMatches;
  }, [matches]);

  // Safe format functions
  const formatMatchTime = (timestamp) => {
    try {
      if (!timestamp) return "TBD";
      if (timestamp.seconds) {
        const date = new Date(timestamp.seconds * 1000);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (timestamp instanceof Date) {
        return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (typeof timestamp === 'string') {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return "TBD";
    } catch (err) {
      console.error("Error formatting match time:", err);
      return "TBD";
    }
  };

  const formatMatchDate = (timestamp) => {
    try {
      if (!timestamp) return "Unscheduled";
      if (timestamp.seconds) {
        const date = new Date(timestamp.seconds * 1000);
        return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      } else if (timestamp instanceof Date) {
        return timestamp.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      } else if (typeof timestamp === 'string') {
        return new Date(timestamp).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      }
      return "Unscheduled";
    } catch (err) {
      console.error("Error formatting match date:", err);
      return "Unscheduled";
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "scheduled":
        return (
          <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
            Upcoming
          </span>
        );
      case "live":
        return (
          <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 animate-pulse">
            LIVE
          </span>
        );
      case "halftime":
        return (
          <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
            Half Time
          </span>
        );
      case "finished":
        return (
          <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
            Completed
          </span>
        );
      default:
        return (
          <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
            {status || "Unknown"}
          </span>
        );
    }
  };

  // Loading state with tournament info
  if (loading && matches.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md overflow-hidden mt-8">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-800">Tournament Matches</h2>
          {tournamentName && <p className="text-sm text-gray-500">For: {tournamentName}</p>}
        </div>
        <div className="p-6 text-center">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-600 mb-3"></div>
          <p className="text-gray-600">Loading matches...</p>
          <p className="text-gray-500 text-xs mt-2">Tournament ID: {tournamentId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden mt-8">
      <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Tournament Matches</h2>
          {tournamentName && <p className="text-sm text-gray-500">For: {tournamentName}</p>}
        </div>
        {(isAdmin || isSuperAdmin) && (
          <Link
            to={`/tournament/${tournamentId}/matches/create`}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
          >
            Schedule Match
          </Link>
        )}
      </div>
      
      {/* Filter tabs */}
      <div className="bg-gray-50 px-6 py-3 flex border-b border-gray-100">
        <button
          onClick={() => setFilter("all")}
          className={`mr-4 px-3 py-1 rounded ${filter === "all" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
        >
          All
        </button>
        <button
          onClick={() => setFilter("scheduled")}
          className={`mr-4 px-3 py-1 rounded ${filter === "scheduled" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
        >
          Upcoming
        </button>
        <button
          onClick={() => setFilter("live")}
          className={`mr-4 px-3 py-1 rounded ${filter === "live" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
        >
          Live
        </button>
        <button
          onClick={() => setFilter("finished")}
          className={`mr-4 px-3 py-1 rounded ${filter === "finished" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
        >
          Completed
        </button>
      </div>

      {error && (
        <div className="p-6 bg-red-50 border-b border-red-100">
          <div className="flex items-center">
            <svg className="h-5 w-5 text-red-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-red-700 font-medium">{error}</p>
              <p className="text-red-500 text-sm">Tournament ID: {tournamentId}</p>
            </div>
          </div>
          <div className="mt-3">
            <button
              onClick={() => window.location.reload()}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
            >
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry
            </button>
          </div>
        </div>
      )}

      {!loading && matches.length === 0 ? (
        <div className="p-10 text-center">
          <div className="text-gray-400 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No Matches Available</h3>
          <p className="text-gray-500">
            {filter === "all" 
              ? "No matches have been scheduled for this tournament yet." 
              : `No ${filter} matches found for this tournament.`}
          </p>
          {(isAdmin || isSuperAdmin) && (
            <div className="mt-4">
              <Link
                to={`/tournament/${tournamentId}/matches/create`}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Schedule First Match
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div>
          {Object.keys(matchesByDate).map(date => (
            <div key={date} className="border-b border-gray-100 last:border-b-0">
              <div className="px-6 py-3 bg-gray-50">
                <h3 className="text-sm font-medium text-gray-600">
                  {date === "Unscheduled" ? "Unscheduled Matches" : 
                    matches.find(m => {
                      try {
                        if (!m.scheduledTime) return false;
                        if (m.scheduledTime.seconds) {
                          return new Date(m.scheduledTime.seconds * 1000).toDateString() === date;
                        }
                        return false;
                      } catch (err) {
                        return false;
                      }
                    })?.scheduledTime ? 
                      formatMatchDate(matches.find(m => {
                        try {
                          if (!m.scheduledTime) return false;
                          if (m.scheduledTime.seconds) {
                            return new Date(m.scheduledTime.seconds * 1000).toDateString() === date;
                          }
                          return false;
                        } catch (err) {
                          return false;
                        }
                      })?.scheduledTime) : date
                  }
                </h3>
              </div>
              
              <div className="divide-y divide-gray-100">
                {matchesByDate[date].map(match => (
                  <Link
                    key={match.id}
                    to={`/match/${match.id}`}
                    className="block px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center">
                      {/* Time and status */}
                      <div className="mb-2 md:mb-0 md:mr-4 md:w-1/6">
                        <div className="text-sm font-medium text-gray-900">
                          {formatMatchTime(match.scheduledTime)}
                        </div>
                        <div className="mt-1">
                          {getStatusBadge(match.status)}
                        </div>
                      </div>
                      
                      {/* Match details */}
                      <div className="flex flex-1 items-center">
                        {/* Home team */}
                        <div className="flex items-center flex-1 justify-end md:justify-end text-right">
                          <div>
                            <div className="font-medium text-gray-900">{match.homeTeamName || "Home Team"}</div>
                            {match.status === "finished" && (
                              <div className="font-bold text-lg text-gray-800">{match.homeScore || 0}</div>
                            )}
                          </div>
                          <div className="w-10 h-10 ml-3 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                            {match.homeTeamLogo ? (
                              <img
                                src={match.homeTeamLogo}
                                alt={match.homeTeamName || "Home Team"}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'%3E%3C/circle%3E%3Cpolyline points='21 15 16 10 5 21'%3E%3C/polyline%3E%3C/svg%3E";
                                }}
                              />
                            ) : (
                              <span className="text-lg font-bold text-gray-500">
                                {match.homeTeamName ? match.homeTeamName.charAt(0) : "H"}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Score or vs */}
                        <div className="mx-4 px-4 flex items-center">
                          {match.status === "finished" ? (
                            <div className="text-sm text-gray-500">FT</div>
                          ) : match.status === "live" ? (
                            <div className="font-bold text-red-500">{match.homeScore || 0} - {match.awayScore || 0}</div>
                          ) : (
                            <div className="text-sm text-gray-400">vs</div>
                          )}
                        </div>
                        
                        {/* Away team */}
                        <div className="flex items-center flex-1">
                          <div className="w-10 h-10 mr-3 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                            {match.awayTeamLogo ? (
                              <img
                                src={match.awayTeamLogo}
                                alt={match.awayTeamName || "Away Team"}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'%3E%3C/circle%3E%3Cpolyline points='21 15 16 10 5 21'%3E%3C/polyline%3E%3C/svg%3E";
                                }}
                              />
                            ) : (
                              <span className="text-lg font-bold text-gray-500">
                                {match.awayTeamName ? match.awayTeamName.charAt(0) : "A"}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{match.awayTeamName || "Away Team"}</div>
                            {match.status === "finished" && (
                              <div className="font-bold text-lg text-gray-800">{match.awayScore || 0}</div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Arrow indicator */}
                      <div className="hidden md:block md:ml-4">
                        <svg className="w-5 h-5 text-gray-400" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                          <path d="M9 5l7 7-7 7"></path>
                        </svg>
                      </div>
                    </div>
                    
                    {/* Match location */}
                    {match.location && (
                      <div className="mt-2 text-sm text-gray-500">
                        📍 {match.location}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MatchList;
