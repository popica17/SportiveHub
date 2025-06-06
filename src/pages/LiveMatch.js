// filepath: c:\Users\Popi.DESKTOP-2PE5NIR\Desktop\proiect-licenta\src\pages\LiveMatch.js
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { db } from "../firebase";
import {
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  Timestamp,
  collection,
  query,
  where,
  getDocs,
  runTransaction,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";

// Constants for match configuration
const HALF_LENGTH_MINUTES = 20; // Each half is 20 minutes
const HALFTIME_LENGTH_MINUTES = 5; // 5 minute halftime break
const SECONDS_PER_MINUTE = 60;

function LiveMatch() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { currentUser, isAdmin, isSuperAdmin } = useAuth();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [homeTeam, setHomeTeam] = useState(null);
  const [awayTeam, setAwayTeam] = useState(null);
  const [homeTeamPlayers, setHomeTeamPlayers] = useState([]);
  const [awayTeamPlayers, setAwayTeamPlayers] = useState([]);
  const [selectedScorer, setSelectedScorer] = useState("");
  const [selectedAssist, setSelectedAssist] = useState("");
  const [eventType, setEventType] = useState("goal"); // Default event type
  const [showEventForm, setShowEventForm] = useState(false);
  const [isControlsEnabled, setIsControlsEnabled] = useState(false);

  // Timer state
  const [matchTime, setMatchTime] = useState({
    minutes: 0,
    seconds: 0,
    half: 0,
  });
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerInterval = useRef(null);
  const lastTickTimestamp = useRef(null);
  const lastSavedState = useRef({ minutes: 0, half: 1, timestamp: Date.now() });
  const currentTimerState = useRef({ minutes: 0, seconds: 0, half: 0 });

  // Function to save the current match time to the database
  const saveTimerStateToDatabase = useCallback(
    async (minutes, half) => {
      try {
        if (!matchId) return;

        // Don't save if we've saved recently (within last 5 seconds) and minutes haven't changed
        const now = Date.now();
        if (
          lastSavedState.current &&
          lastSavedState.current.minutes === minutes &&
          lastSavedState.current.half === half &&
          now - lastSavedState.current.timestamp < 5000
        ) {
          return;
        }

        console.log(
          `Saving match time to database: ${minutes} minutes, half: ${half}`
        );
        await updateDoc(doc(db, "matches", matchId), {
          currentMatchMinute: minutes,
          currentHalf: half,
          lastUpdated: new Date(),
        });

        // Update last saved state
        lastSavedState.current = {
          minutes,
          half,
          timestamp: now,
        };
      } catch (err) {
        console.error("Error saving timer state to database:", err);
        // Don't show error to user as this is a background operation
      }
    },
    [matchId]
  );

  // Reference to saveTimerStateToDatabase to use in cleanup function
  const saveTimerStateRef = useRef(null);
  // Update the reference whenever the component re-renders
  useEffect(() => {
    saveTimerStateRef.current = saveTimerStateToDatabase;
    currentTimerState.current = matchTime; // Keep ref updated with current timer state    // Set up periodic saving of match time (every 30 seconds)
    let saveInterval;
    if (isTimerRunning) {
      saveInterval = setInterval(() => {
        const currentTime = currentTimerState.current;
        saveTimerStateToDatabase(currentTime.minutes, currentTime.half);
      }, 30000); // Save every 30 seconds
    } // Add window beforeunload handler to save state when user closes/refreshes the page
    const handleBeforeUnload = () => {
      if (match && match.status === "live") {
        console.log("Page about to unload, saving timer state");
        const currentTime = currentTimerState.current;
        saveTimerStateToDatabase(currentTime.minutes, currentTime.half);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      if (saveInterval) clearInterval(saveInterval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [matchId, isTimerRunning, saveTimerStateToDatabase]); // Remove matchTime and match from dependencies// Cleanup effect to save timer state when component unmounts
  useEffect(() => {
    return () => {
      // Always save the current match time when leaving the page
      if (match && match.status === "live" && saveTimerStateRef.current) {
        // Get current timer state from the ref
        const currentTime = currentTimerState.current;
        console.log(
          "Component unmounting, saving timer state:",
          currentTime.minutes,
          currentTime.half
        );
        saveTimerStateRef.current(currentTime.minutes, currentTime.half);
      }
    };
  }, []); // Empty dependency array - only run on actual unmount

  // Check if the current user can manage this match
  const canManageMatch = useCallback(() => {
    if (!match || !currentUser) return false;
    if (isAdmin || isSuperAdmin) return true;

    // Check if user is a manager of either team
    return (
      (homeTeam && homeTeam.managerId === currentUser.uid) ||
      (awayTeam && awayTeam.managerId === currentUser.uid)
    );
  }, [match, currentUser, isAdmin, isSuperAdmin, homeTeam, awayTeam]);

  // Match control functions
  const handleHalfTime = useCallback(async () => {
    try {
      if (!match) return;

      stopTimer();

      await updateDoc(doc(db, "matches", matchId), {
        status: "halftime",
        currentMatchMinute: HALF_LENGTH_MINUTES,
        currentHalf: 1,
      });

      // You could implement a countdown for halftime here
      setTimeout(() => {
        startSecondHalf();
      }, HALFTIME_LENGTH_MINUTES * SECONDS_PER_MINUTE * 1000);
    } catch (err) {
      console.error("Error handling half time:", err);
      setError("Failed to update match for half time");
    }
  }, [match, matchId]);

  const handleFullTime = useCallback(async () => {
    try {
      if (!match) return;

      stopTimer();

      await updateDoc(doc(db, "matches", matchId), {
        status: "finished",
        completedAt: serverTimestamp(),
        currentMatchMinute: HALF_LENGTH_MINUTES,
        currentHalf: 2,
      });

      // Process match statistics
      await processMatchStatistics();
    } catch (err) {
      console.error("Error handling full time:", err);
      setError("Failed to finish match");
    }
  }, [match, matchId]);

  // Timer functions
  const stopTimer = useCallback(() => {
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
      timerInterval.current = null;
    }
    setIsTimerRunning(false); // Always save the current timer state when stopping the timer
    const currentTime = currentTimerState.current;
    console.log(
      `Timer stopped at minute ${currentTime.minutes}, half ${currentTime.half}`
    );
    saveTimerStateToDatabase(currentTime.minutes, currentTime.half);
  }, [saveTimerStateToDatabase]);

  const startSecondHalf = useCallback(async () => {
    try {
      if (!match) return;

      await updateDoc(doc(db, "matches", matchId), {
        status: "live",
        currentMatchMinute: 0,
        currentHalf: 2,
      });

      startTimer(0, 2);
    } catch (err) {
      console.error("Error starting second half:", err);
      setError("Failed to start second half");
    }
  }, [match, matchId]);

  const startTimer = useCallback(
    (startMinute = 0, startHalf = 1) => {
      // Clear any existing timer
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
        timerInterval.current = null;
      }

      // Set initial timer state
      setMatchTime({
        minutes: startMinute,
        seconds: 0,
        half: startHalf,
      });

      // Save initial state to database
      saveTimerStateToDatabase(startMinute, startHalf);

      // Initialize last tick timestamp
      lastTickTimestamp.current = Date.now();

      // Set up timer interval
      timerInterval.current = setInterval(() => {
        const now = Date.now();

        // Calculate elapsed time since last tick (handle tab being inactive)
        const deltaSeconds = Math.floor(
          (now - lastTickTimestamp.current) / 1000
        );

        // Guard against large time jumps (e.g. computer sleep)
        const maxDeltaSeconds = 10; // Cap at 10 seconds per tick
        const effectiveDelta = Math.min(deltaSeconds, maxDeltaSeconds);

        // Update timestamp for next tick
        lastTickTimestamp.current = now;

        // Update timer state
        setMatchTime((prev) => {
          let newSeconds = prev.seconds + effectiveDelta;
          let newMinutes = prev.minutes;
          let newHalf = prev.half;

          // Calculate minutes from seconds
          if (newSeconds >= 60) {
            const additionalMinutes = Math.floor(newSeconds / 60);
            newMinutes += additionalMinutes;
            newSeconds %= 60;
          }

          // Check for half time
          if (newHalf === 1 && newMinutes >= HALF_LENGTH_MINUTES) {
            // First half is over
            handleHalfTime();
            return { minutes: HALF_LENGTH_MINUTES, seconds: 0, half: 1 };
          }

          // Check for full time
          if (newHalf === 2 && newMinutes >= HALF_LENGTH_MINUTES) {
            // Match is over
            handleFullTime();
            return { minutes: HALF_LENGTH_MINUTES, seconds: 0, half: 2 };
          }

          // Save timer state to database when minutes change
          if (newMinutes > prev.minutes) {
            saveTimerStateToDatabase(newMinutes, newHalf);
          }

          return { minutes: newMinutes, seconds: newSeconds, half: newHalf };
        });
      }, 1000);

      setIsTimerRunning(true);
      console.log(`Timer started at minute ${startMinute}, half ${startHalf}`);
    },
    [handleHalfTime, handleFullTime, saveTimerStateToDatabase]
  );
  // Fetch match data and set up real-time listener
  useEffect(() => {
    if (!matchId) {
      setError("Match ID not found");
      setLoading(false);
      return;
    }

    setLoading(true);

    // Set up real-time listener for match updates
    const unsubscribe = onSnapshot(
      doc(db, "matches", matchId),
      async (matchDoc) => {
        try {
          if (matchDoc.exists()) {
            const matchData = { id: matchDoc.id, ...matchDoc.data() };
            setMatch(matchData);

            // Update timer state based on match data
            if (matchData.status === "live") {
              // Use the current match minute saved in the database
              const startMinute = matchData.currentMatchMinute || 0;
              const startHalf = matchData.currentHalf || 1;

              // Only start timer if it's not already running
              // This prevents the timer from restarting on every database update
              setMatchTime((prevTime) => {
                if (
                  !isTimerRunning &&
                  (prevTime.minutes !== startMinute ||
                    prevTime.half !== startHalf)
                ) {
                  console.log(
                    `Resuming match from minute ${startMinute}, half ${startHalf}`
                  );
                  // Start timer asynchronously to avoid state update conflicts
                  setTimeout(() => startTimer(startMinute, startHalf), 0);
                }
                return prevTime;
              });
            } else if (matchData.status === "halftime") {
              setIsTimerRunning(false);
              if (timerInterval.current) {
                clearInterval(timerInterval.current);
                timerInterval.current = null;
              }
              setMatchTime({
                minutes: HALF_LENGTH_MINUTES,
                seconds: 0,
                half: 1,
              });
            } else if (matchData.status === "finished") {
              setIsTimerRunning(false);
              if (timerInterval.current) {
                clearInterval(timerInterval.current);
                timerInterval.current = null;
              }
              setMatchTime({
                minutes: HALF_LENGTH_MINUTES * 2,
                seconds: 0,
                half: 2,
              });
            } // Fetch teams data
            if (matchData.homeTeamId) {
              const homeTeamDoc = await getDoc(
                doc(db, "teams", matchData.homeTeamId)
              );
              if (homeTeamDoc.exists()) {
                const homeTeamData = homeTeamDoc.data();
                setHomeTeam({ id: homeTeamDoc.id, ...homeTeamData });

                // Fetch home team players correctly using memberIds array
                if (
                  homeTeamData.memberIds &&
                  homeTeamData.memberIds.length > 0
                ) {
                  const homePlayers = [];
                  for (const playerId of homeTeamData.memberIds) {
                    try {
                      const playerDoc = await getDoc(
                        doc(db, "users", playerId)
                      );
                      if (playerDoc.exists()) {
                        const playerData = playerDoc.data();
                        homePlayers.push({
                          id: playerId,
                          ...playerData,
                          displayName:
                            playerData.firstName && playerData.lastName
                              ? `${playerData.firstName} ${playerData.lastName}`
                              : playerData.displayName || playerData.email,
                        });
                      }
                    } catch (playerErr) {
                      console.error(
                        `Error fetching player ${playerId}:`,
                        playerErr
                      );
                    }
                  }
                  setHomeTeamPlayers(homePlayers);
                } else {
                  console.log("No memberIds found for home team");
                  setHomeTeamPlayers([]);
                }
              }
            }

            if (matchData.awayTeamId) {
              const awayTeamDoc = await getDoc(
                doc(db, "teams", matchData.awayTeamId)
              );
              if (awayTeamDoc.exists()) {
                const awayTeamData = awayTeamDoc.data();
                setAwayTeam({ id: awayTeamDoc.id, ...awayTeamData });

                // Fetch away team players correctly using memberIds array
                if (
                  awayTeamData.memberIds &&
                  awayTeamData.memberIds.length > 0
                ) {
                  const awayPlayers = [];
                  for (const playerId of awayTeamData.memberIds) {
                    try {
                      const playerDoc = await getDoc(
                        doc(db, "users", playerId)
                      );
                      if (playerDoc.exists()) {
                        const playerData = playerDoc.data();
                        awayPlayers.push({
                          id: playerId,
                          ...playerData,
                          displayName:
                            playerData.firstName && playerData.lastName
                              ? `${playerData.firstName} ${playerData.lastName}`
                              : playerData.displayName || playerData.email,
                        });
                      }
                    } catch (playerErr) {
                      console.error(
                        `Error fetching player ${playerId}:`,
                        playerErr
                      );
                    }
                  }
                  setAwayTeamPlayers(awayPlayers);
                } else {
                  console.log("No memberIds found for away team");
                  setAwayTeamPlayers([]);
                }
              }
            }
          } else {
            setError("Match not found");
            navigate("/tournaments");
          }

          setLoading(false);
        } catch (err) {
          console.error("Error in match snapshot listener:", err);
          setError("Failed to load match data");
          setLoading(false);
        }
      },
      (error) => {
        console.error("Error setting up match listener:", error);
        setError("Failed to load match data");
        setLoading(false);
      }
    );

    // Clean up listener on unmount
    return () => {
      unsubscribe();
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
        timerInterval.current = null;
      }
    };
  }, [matchId, navigate]);
  // Process match statistics and update rankings
  const processMatchStatistics = async () => {
    try {
      if (!match) return;

      // Update team statistics in tournament
      await runTransaction(db, async (transaction) => {
        // PHASE 1: ALL READS FIRST (CRITICAL - no writes allowed until all reads are complete)

        // Read 1: Match data
        const matchDocRef = doc(db, "matches", matchId);
        const matchDoc = await transaction.get(matchDocRef);

        if (!matchDoc.exists()) {
          throw new Error("Match document not found");
        }

        const matchData = matchDoc.data();
        const { homeTeamId, awayTeamId, homeScore, awayScore, tournamentId } =
          matchData;

        if (!tournamentId) {
          throw new Error("Tournament ID not found in match data");
        }

        // Prepare player events data
        const playerEvents = {};
        const playerStatsRefs = [];
        const playerStatsDocs = [];

        if (matchData.events && matchData.events.length > 0) {
          // Group events by player
          matchData.events.forEach((event) => {
            if (!playerEvents[event.playerId]) {
              playerEvents[event.playerId] = {
                goals: 0,
                assists: 0,
                yellowCards: 0,
                redCards: 0,
              };
            }

            if (event.type === "goal") {
              playerEvents[event.playerId].goals += 1;
            } else if (event.type === "yellowCard") {
              playerEvents[event.playerId].yellowCards += 1;
            } else if (event.type === "redCard") {
              playerEvents[event.playerId].redCards += 1;
            }

            // Track assists
            if (event.assistPlayerId) {
              if (!playerEvents[event.assistPlayerId]) {
                playerEvents[event.assistPlayerId] = {
                  goals: 0,
                  assists: 0,
                  yellowCards: 0,
                  redCards: 0,
                };
              }

              playerEvents[event.assistPlayerId].assists += 1;
            }
          });

          // Read 2: All player stats documents
          for (const playerId of Object.keys(playerEvents)) {
            const playerStatsRef = doc(
              db,
              "tournamentPlayerStats",
              `${tournamentId}_${playerId}`
            );
            playerStatsRefs.push(playerStatsRef);
            const playerStatsDoc = await transaction.get(playerStatsRef);
            playerStatsDocs.push(playerStatsDoc);
          }
        } // Read 3: Home team stats
        const homeTeamTournamentRef = doc(
          db,
          "tournamentTeamStats",
          `${tournamentId}_${homeTeamId}_stats`
        );
        const homeTeamDoc = await transaction.get(homeTeamTournamentRef); // Read 4: Away team stats
        const awayTeamTournamentRef = doc(
          db,
          "tournamentTeamStats",
          `${tournamentId}_${awayTeamId}_stats`
        );
        const awayTeamDoc = await transaction.get(awayTeamTournamentRef);

        // Read 5: Home team details (needed if we have to create team stats)
        const homeTeamRef = doc(db, "teams", homeTeamId);
        const homeTeamDetailsDoc = await transaction.get(homeTeamRef);

        // Read 6: Away team details (needed if we have to create team stats)
        const awayTeamRef = doc(db, "teams", awayTeamId);
        const awayTeamDetailsDoc = await transaction.get(awayTeamRef);

        // PHASE 2: ALL WRITES AFTER ALL READS ARE COMPLETE

        // Write 1: Update player statistics
        if (playerStatsRefs.length > 0) {
          for (let i = 0; i < playerStatsRefs.length; i++) {
            const playerStatsRef = playerStatsRefs[i];
            const playerStatsDoc = playerStatsDocs[i];
            const playerId = Object.keys(playerEvents)[i];

            if (playerStatsDoc.exists()) {
              // Update existing stats
              const currentStats = playerStatsDoc.data();
              transaction.update(playerStatsRef, {
                goals: (currentStats.goals || 0) + playerEvents[playerId].goals,
                assists:
                  (currentStats.assists || 0) + playerEvents[playerId].assists,
                yellowCards:
                  (currentStats.yellowCards || 0) +
                  playerEvents[playerId].yellowCards,
                redCards:
                  (currentStats.redCards || 0) +
                  playerEvents[playerId].redCards,
                matchesPlayed: (currentStats.matchesPlayed || 0) + 1,
              });
            } else {
              // Create new stats document
              transaction.set(playerStatsRef, {
                tournamentId,
                playerId,
                goals: playerEvents[playerId].goals,
                assists: playerEvents[playerId].assists,
                yellowCards: playerEvents[playerId].yellowCards,
                redCards: playerEvents[playerId].redCards,
                matchesPlayed: 1,
              });
            }
          }
        } // Write 2: Update home team stats
        if (homeTeamDoc.exists()) {
          const homeTeamData = homeTeamDoc.data();
          const played = (homeTeamData.played || 0) + 1;
          let won = homeTeamData.won || 0;
          let draw = homeTeamData.draw || 0;
          let lost = homeTeamData.lost || 0;
          let points = homeTeamData.points || 0;

          if (homeScore > awayScore) {
            won += 1;
            points += 3;
          } else if (homeScore === awayScore) {
            draw += 1;
            points += 1;
          } else {
            lost += 1;
          }

          transaction.update(homeTeamTournamentRef, {
            played,
            won,
            draw,
            lost,
            goalsFor: (homeTeamData.goalsFor || 0) + homeScore,
            goalsAgainst: (homeTeamData.goalsAgainst || 0) + awayScore,
            points,
          });
        } else {
          // Create new team stats document - but only if team exists
          if (!homeTeamDetailsDoc.exists()) {
            console.error(
              `Home team ${homeTeamId} not found in teams collection`
            );
            throw new Error(`Home team ${homeTeamId} not found`);
          }

          const homeTeamData = homeTeamDetailsDoc.data();
          let won = 0;
          let draw = 0;
          let lost = 0;
          let points = 0;

          if (homeScore > awayScore) {
            won = 1;
            points = 3;
          } else if (homeScore === awayScore) {
            draw = 1;
            points = 1;
          } else {
            lost = 1;
          }

          transaction.set(homeTeamTournamentRef, {
            tournamentId,
            teamId: homeTeamId,
            teamName: homeTeamData.name || "Unknown Team",
            managerName: homeTeamData.managerName || "Unknown Manager",
            sport: homeTeamData.sport || "Football",
            memberCount: homeTeamData.memberIds
              ? homeTeamData.memberIds.length
              : 0,
            registeredAt: serverTimestamp(),
            played: 1,
            won,
            draw,
            lost,
            goalsFor: homeScore,
            goalsAgainst: awayScore,
            points,
          });
        } // Write 3: Update away team stats
        if (awayTeamDoc.exists()) {
          const awayTeamData = awayTeamDoc.data();
          const played = (awayTeamData.played || 0) + 1;
          let won = awayTeamData.won || 0;
          let draw = awayTeamData.draw || 0;
          let lost = awayTeamData.lost || 0;
          let points = awayTeamData.points || 0;

          if (awayScore > homeScore) {
            won += 1;
            points += 3;
          } else if (awayScore === homeScore) {
            draw += 1;
            points += 1;
          } else {
            lost += 1;
          }

          transaction.update(awayTeamTournamentRef, {
            played,
            won,
            draw,
            lost,
            goalsFor: (awayTeamData.goalsFor || 0) + awayScore,
            goalsAgainst: (awayTeamData.goalsAgainst || 0) + homeScore,
            points,
          });
        } else {
          // Create new team stats document - but only if team exists
          if (!awayTeamDetailsDoc.exists()) {
            console.error(
              `Away team ${awayTeamId} not found in teams collection`
            );
            throw new Error(`Away team ${awayTeamId} not found`);
          }

          const awayTeamData = awayTeamDetailsDoc.data();
          let won = 0;
          let draw = 0;
          let lost = 0;
          let points = 0;

          if (awayScore > homeScore) {
            won = 1;
            points = 3;
          } else if (awayScore === homeScore) {
            draw = 1;
            points = 1;
          } else {
            lost = 1;
          }

          transaction.set(awayTeamTournamentRef, {
            tournamentId,
            teamId: awayTeamId,
            teamName: awayTeamData.name || "Unknown Team",
            managerName: awayTeamData.managerName || "Unknown Manager",
            sport: awayTeamData.sport || "Football",
            memberCount: awayTeamData.memberIds
              ? awayTeamData.memberIds.length
              : 0,
            registeredAt: serverTimestamp(),
            played: 1,
            won,
            draw,
            lost,
            goalsFor: awayScore,
            goalsAgainst: homeScore,
            points,
          });
        }
      });

      console.log("Match statistics processed successfully");
    } catch (err) {
      console.error("Error processing match statistics:", err);
      setError("Failed to process match statistics");
    }
  };

  // Match control functions
  const startMatch = async () => {
    try {
      if (!match) return;

      await updateDoc(doc(db, "matches", matchId), {
        status: "live",
        startTime: serverTimestamp(),
        currentMatchMinute: 0,
        currentHalf: 1,
      });

      startTimer(0, 1);
    } catch (err) {
      console.error("Error starting match:", err);
      setError("Failed to start match");
    }
  };

  // Add events like goals, cards, etc.
  const recordEvent = async (type) => {
    try {
      if (!match || !selectedScorer) {
        setError("Please select a player");
        return;
      }

      // Find selected player
      const players = [...homeTeamPlayers, ...awayTeamPlayers];
      const scorer = players.find((player) => player.id === selectedScorer);

      if (!scorer) {
        setError("Selected player not found");
        return;
      }

      // Determine which team scored
      const isHomeTeamGoal = homeTeamPlayers.some(
        (player) => player.id === selectedScorer
      );
      const teamId = isHomeTeamGoal ? match.homeTeamId : match.awayTeamId;

      // Find assist player if set
      let assistPlayer = null;
      if (selectedAssist) {
        assistPlayer = players.find((player) => player.id === selectedAssist);
      }

      // Create event object
      const eventData = {
        id: `event_${Date.now()}`,
        type,
        teamId,
        playerId: selectedScorer,
        playerName: scorer.displayName || "Unknown Player",
        minute: matchTime.minutes,
        half: matchTime.half,
        timestamp: new Date(), // Use JavaScript Date instead of serverTimestamp for array operations
      };

      // Add assist info if present
      if (assistPlayer) {
        eventData.assistPlayerId = assistPlayer.id;
        eventData.assistPlayerName =
          assistPlayer.displayName || "Unknown Player";
      }

      // Update match document
      const matchRef = doc(db, "matches", matchId);

      // Update different fields based on event type
      if (type === "goal") {
        if (isHomeTeamGoal) {
          // Home team scored
          await updateDoc(matchRef, {
            homeScore: match.homeScore + 1,
            events: arrayUnion(eventData),
          });
        } else {
          // Away team scored
          await updateDoc(matchRef, {
            awayScore: match.awayScore + 1,
            events: arrayUnion(eventData),
          });
        }
      } else {
        // For other event types
        await updateDoc(matchRef, {
          events: arrayUnion(eventData),
        });
      }

      // Reset form
      setSelectedScorer("");
      setSelectedAssist("");
      setShowEventForm(false);
    } catch (err) {
      console.error("Error recording event:", err);
      console.error("Error details:", {
        matchId: match.id,
        eventType: type,
        scorerId: selectedScorer,
        assistId: selectedAssist,
      });
      setError(`Failed to record ${type}: ${err.message}`);
      setError("Failed to record event");
    }
  };

  // UI Helper functions
  const formatMatchTime = () => {
    const paddedMinutes = String(matchTime.minutes).padStart(2, "0");
    const paddedSeconds = String(matchTime.seconds).padStart(2, "0");
    return `${paddedMinutes}:${paddedSeconds}`;
  };

  const getMatchStatusDisplay = () => {
    if (!match) return "Loading...";

    switch (match.status) {
      case "scheduled":
        return "Scheduled";
      case "live":
        return matchTime.half === 1 ? "First Half" : "Second Half";
      case "halftime":
        return "Half Time";
      case "finished":
        return "Full Time";
      default:
        return match.status;
    }
  };

  const getEventIcon = (eventType) => {
    switch (eventType) {
      case "goal":
        return "⚽";
      case "yellowCard":
        return "🟨";
      case "redCard":
        return "🟥";
      case "substitution":
        return "🔄";
      default:
        return "📝";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading match data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <p>{error}</p>
            <div className="mt-4">
              <Link to="/tournaments" className="text-red-700 underline">
                Return to Tournaments
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-600">Match not found</p>
          <div className="mt-4">
            <Link to="/tournaments" className="text-blue-600 underline">
              Return to Tournaments
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* Back navigation */}
        <div className="max-w-6xl mx-auto mb-6">
          <Link
            to={`/tournament/${match.tournamentId}/rankings`}
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
            Back to Tournament
          </Link>
        </div>

        {/* Match header */}
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-md overflow-hidden mb-8">
          <div className="p-6 text-center">
            <div className="mb-4">
              <span
                className={`inline-block px-4 py-1 rounded-full text-sm font-medium ${
                  match.status === "live"
                    ? "bg-red-100 text-red-800"
                    : match.status === "finished"
                    ? "bg-gray-100 text-gray-800"
                    : match.status === "halftime"
                    ? "bg-orange-100 text-orange-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {getMatchStatusDisplay()}
              </span>
              {match.status === "live" && (
                <span className="ml-4 inline-block px-4 py-1 rounded-full bg-gray-100 text-gray-800 text-sm font-medium">
                  {formatMatchTime()}
                </span>
              )}
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between">
              {/* Home team */}
              <div className="flex flex-col items-center flex-1">
                <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-2 overflow-hidden">
                  {match.homeTeamLogo ? (
                    <img
                      src={match.homeTeamLogo}
                      alt={`${match.homeTeamName} logo`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl font-bold text-gray-400">
                      {match.homeTeamName ? match.homeTeamName.charAt(0) : "H"}
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {match.homeTeamName}
                </h2>
                <div className="text-sm text-gray-600">
                  {homeTeamPlayers.length} players
                </div>
              </div>

              {/* Score */}
              <div className="my-6 md:my-0">
                <div className="flex items-center">
                  <span className="text-5xl font-bold text-gray-800">
                    {match.homeScore}
                  </span>
                  <span className="mx-4 text-3xl text-gray-400">-</span>
                  <span className="text-5xl font-bold text-gray-800">
                    {match.awayScore}
                  </span>
                </div>
                {match.location && (
                  <div className="mt-2 text-gray-600 text-sm">
                    {match.location}
                  </div>
                )}
              </div>

              {/* Away team */}
              <div className="flex flex-col items-center flex-1">
                <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-2 overflow-hidden">
                  {match.awayTeamLogo ? (
                    <img
                      src={match.awayTeamLogo}
                      alt={`${match.awayTeamName} logo`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl font-bold text-gray-400">
                      {match.awayTeamName ? match.awayTeamName.charAt(0) : "A"}
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {match.awayTeamName}
                </h2>
                <div className="text-sm text-gray-600">
                  {awayTeamPlayers.length} players
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Match controls for admins/managers */}
        {canManageMatch() && (
          <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-md overflow-hidden mb-8">
            <div className="p-6 border-b">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                Match Controls
              </h3>
              <div className="flex flex-wrap gap-4">
                {match.status === "scheduled" && (
                  <button
                    onClick={startMatch}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    Start Match
                  </button>
                )}

                {match.status === "halftime" && (
                  <button
                    onClick={startSecondHalf}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    Start Second Half
                  </button>
                )}

                {match.status === "live" && (
                  <>
                    <button
                      onClick={() => setShowEventForm(!showEventForm)}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Record Event
                    </button>

                    {matchTime.half === 1 && (
                      <button
                        onClick={handleHalfTime}
                        className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
                      >
                        End First Half
                      </button>
                    )}

                    {matchTime.half === 2 && (
                      <button
                        onClick={handleFullTime}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                      >
                        End Match
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Event recording form */}
            {showEventForm && (
              <div className="p-6 bg-gray-50">
                <h4 className="text-lg font-medium text-gray-800 mb-4">
                  Record Event
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Event Type
                    </label>
                    <select
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="goal">Goal</option>
                      <option value="yellowCard">Yellow Card</option>
                      <option value="redCard">Red Card</option>
                      <option value="substitution">Substitution</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Player
                    </label>
                    <select
                      value={selectedScorer}
                      onChange={(e) => setSelectedScorer(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select Player</option>
                      <optgroup label={homeTeam?.name || "Home Team"}>
                        {homeTeamPlayers.map((player) => (
                          <option key={player.id} value={player.id}>
                            {player.displayName || player.email}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label={awayTeam?.name || "Away Team"}>
                        {awayTeamPlayers.map((player) => (
                          <option key={player.id} value={player.id}>
                            {player.displayName || player.email}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  {eventType === "goal" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Assist (Optional)
                      </label>
                      <select
                        value={selectedAssist}
                        onChange={(e) => setSelectedAssist(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">No Assist</option>
                        <optgroup label={homeTeam?.name || "Home Team"}>
                          {homeTeamPlayers
                            .filter((player) => player.id !== selectedScorer)
                            .map((player) => (
                              <option key={player.id} value={player.id}>
                                {player.displayName || player.email}
                              </option>
                            ))}
                        </optgroup>
                        <optgroup label={awayTeam?.name || "Away Team"}>
                          {awayTeamPlayers
                            .filter((player) => player.id !== selectedScorer)
                            .map((player) => (
                              <option key={player.id} value={player.id}>
                                {player.displayName || player.email}
                              </option>
                            ))}
                        </optgroup>
                      </select>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={() => setShowEventForm(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => recordEvent(eventType)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Record{" "}
                    {eventType === "goal"
                      ? "Goal"
                      : eventType === "yellowCard"
                      ? "Yellow Card"
                      : eventType === "redCard"
                      ? "Red Card"
                      : "Substitution"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Match timeline */}
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-md overflow-hidden mb-8">
          <div className="p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              Match Timeline
            </h3>

            {match.events && match.events.length > 0 ? (
              <div className="space-y-6">
                {[...match.events]
                  .sort((a, b) => {
                    if (a.half !== b.half) return a.half - b.half;
                    return a.minute - b.minute;
                  })
                  .map((event) => {
                    // Determine if home or away team event
                    const isHomeTeam = event.teamId === match.homeTeamId;

                    return (
                      <div key={event.id} className="flex items-start">
                        {/* Event time */}
                        <div className="flex-shrink-0 w-16 text-sm font-medium text-gray-600">
                          {event.half === 1 ? "" : "45' + "}
                          {event.minute}'
                        </div>

                        <div className="flex-shrink-0 w-8 mx-2 text-center">
                          {getEventIcon(event.type)}
                        </div>

                        {/* Event content */}
                        <div className="flex-grow">
                          <div className="font-medium text-gray-900">
                            {event.playerName}
                            {event.assistPlayerName && (
                              <span className="text-gray-600 ml-1">
                                (Assist: {event.assistPlayerName})
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            {isHomeTeam
                              ? match.homeTeamName
                              : match.awayTeamName}
                          </div>
                        </div>

                        {/* Score after event */}
                        {event.type === "goal" && (
                          <div className="flex-shrink-0 w-16 text-right">
                            <span className="text-sm font-medium">
                              {isHomeTeam
                                ? `${
                                    match.homeScore -
                                    match.events
                                      .filter(
                                        (e) =>
                                          e.id === event.id ||
                                          (e.timestamp &&
                                            event.timestamp &&
                                            e.timestamp.seconds <
                                              event.timestamp.seconds)
                                      )
                                      .filter(
                                        (e) =>
                                          e.type === "goal" &&
                                          e.teamId === match.homeTeamId
                                      ).length
                                  }-${
                                    match.awayScore -
                                    match.events
                                      .filter(
                                        (e) =>
                                          e.id === event.id ||
                                          (e.timestamp &&
                                            event.timestamp &&
                                            e.timestamp.seconds <
                                              event.timestamp.seconds)
                                      )
                                      .filter(
                                        (e) =>
                                          e.type === "goal" &&
                                          e.teamId === match.awayTeamId
                                      ).length
                                  }`
                                : `${
                                    match.homeScore -
                                    match.events
                                      .filter(
                                        (e) =>
                                          e.id !== event.id &&
                                          (!e.timestamp ||
                                            !event.timestamp ||
                                            e.timestamp.seconds >
                                              event.timestamp.seconds)
                                      )
                                      .filter(
                                        (e) =>
                                          e.type === "goal" &&
                                          e.teamId === match.homeTeamId
                                      ).length
                                  }-${
                                    match.awayScore -
                                    match.events
                                      .filter(
                                        (e) =>
                                          e.id !== event.id &&
                                          (!e.timestamp ||
                                            !event.timestamp ||
                                            e.timestamp.seconds >
                                              event.timestamp.seconds)
                                      )
                                      .filter(
                                        (e) =>
                                          e.type === "goal" &&
                                          e.teamId === match.awayTeamId
                                      ).length
                                  }`}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="py-10 text-center text-gray-500">
                No events recorded yet
              </div>
            )}
          </div>
        </div>

        {/* Team lineups */}
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Home team */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="px-6 py-4 bg-blue-50 border-b">
                <h3 className="text-lg font-semibold text-blue-800">
                  {match.homeTeamName} Lineup
                </h3>
              </div>
              {homeTeamPlayers.length > 0 ? (
                <ul className="divide-y divide-gray-100">
                  {homeTeamPlayers.map((player) => (
                    <li key={player.id} className="px-6 py-4 flex items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                        <span className="text-sm font-medium text-blue-800">
                          {player.displayName?.charAt(0) ||
                            player.email?.charAt(0) ||
                            "?"}
                        </span>
                      </div>
                      <div className="flex-grow">
                        <div className="text-sm font-medium text-gray-900">
                          {player.displayName || player.email}
                        </div>
                        {player.position && (
                          <div className="text-xs text-gray-500">
                            {player.position}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-6 py-10 text-center text-gray-500">
                  No player data available
                </div>
              )}
            </div>

            {/* Away team */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="px-6 py-4 bg-red-50 border-b">
                <h3 className="text-lg font-semibold text-red-800">
                  {match.awayTeamName} Lineup
                </h3>
              </div>
              {awayTeamPlayers.length > 0 ? (
                <ul className="divide-y divide-gray-100">
                  {awayTeamPlayers.map((player) => (
                    <li key={player.id} className="px-6 py-4 flex items-center">
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center mr-3">
                        <span className="text-sm font-medium text-red-800">
                          {player.displayName?.charAt(0) ||
                            player.email?.charAt(0) ||
                            "?"}
                        </span>
                      </div>
                      <div className="flex-grow">
                        <div className="text-sm font-medium text-gray-900">
                          {player.displayName || player.email}
                        </div>
                        {player.position && (
                          <div className="text-xs text-gray-500">
                            {player.position}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-6 py-10 text-center text-gray-500">
                  No player data available
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LiveMatch;
