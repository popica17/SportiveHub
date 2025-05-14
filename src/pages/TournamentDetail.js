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

function TournamentDetail() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const [tournament, setTournament] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [participants, setParticipants] = useState([]);

  useEffect(() => {
    fetchTournamentDetails();
  }, [tournamentId]);

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
        startDate: tournamentData.startDate
          ? new Date(tournamentData.startDate.seconds * 1000)
          : null,
        registrationDeadline: tournamentData.registrationDeadline
          ? new Date(tournamentData.registrationDeadline.seconds * 1000)
          : null,
        createdAt: tournamentData.createdAt
          ? new Date(tournamentData.createdAt.seconds * 1000)
          : null,
      };

      setTournament(formattedTournament);

      // Check if current user is registered
      if (currentUser) {
        const participantsQuery = query(
          collection(db, "tournamentParticipants"),
          where("tournamentId", "==", tournamentId),
          where("userId", "==", currentUser.uid)
        );

        const participantsSnapshot = await getDocs(participantsQuery);
        setIsRegistered(!participantsSnapshot.empty);
      }

      // Fetch all participants
      const allParticipantsQuery = query(
        collection(db, "tournamentParticipants"),
        where("tournamentId", "==", tournamentId)
      );

      const allParticipantsSnapshot = await getDocs(allParticipantsQuery);
      const participantsData = allParticipantsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setParticipants(participantsData);
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

      // Add user to participants collection
      await addDoc(collection(db, "tournamentParticipants"), {
        tournamentId,
        userId: currentUser.uid,
        displayName:
          currentUser.displayName ||
          userProfile?.firstName ||
          currentUser.email,
        photoURL: currentUser.photoURL || "",
        registeredAt: new Date(),
      });

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
    if (!currentUser) return;

    try {
      // Find user's registration
      const participantsQuery = query(
        collection(db, "tournamentParticipants"),
        where("tournamentId", "==", tournamentId),
        where("userId", "==", currentUser.uid)
      );

      const participantsSnapshot = await getDocs(participantsQuery);

      if (participantsSnapshot.empty) {
        setError("You are not registered for this tournament");
        return;
      }

      // Delete registration
      await deleteDoc(
        doc(db, "tournamentParticipants", participantsSnapshot.docs[0].id)
      );

      // Update tournament participants count
      await updateDoc(doc(db, "tournaments", tournamentId), {
        participants: participants.length - 1,
      });

      // Refresh data
      setIsRegistered(false);
      fetchTournamentDetails();
    } catch (err) {
      console.error("Error canceling tournament registration:", err);
      setError("Failed to cancel registration. Please try again.");
    }
  };

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
                    : "Cancel Registration"}
                </button>
              ) : (
                <button
                  onClick={handleRegister}
                  disabled={
                    registrationDeadlinePassed ||
                    participants.length >= tournament.maxParticipants
                  }
                  className={`w-full py-2 px-4 rounded-lg text-white text-center 
                    ${
                      registrationDeadlinePassed ||
                      participants.length >= tournament.maxParticipants
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700 transition-colors duration-200"
                    }`}
                >
                  {registrationDeadlinePassed
                    ? "Registration Closed"
                    : participants.length >= tournament.maxParticipants
                    ? "Tournament Full"
                    : "Register for Tournament"}
                </button>
              )
            ) : (
              <Link to="/login">
                <button className="w-full py-2 px-4 rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors duration-200 text-center">
                  Login to Register
                </button>
              </Link>
            )}
          </div>
        </div>

        {/* Participants section */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4">
              Participants ({participants.length})
            </h2>

            {participants.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No one has registered for this tournament yet.
              </div>
            ) : (
              <div className="space-y-4">
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center p-3 bg-gray-50 rounded-lg"
                  >
                    {participant.photoURL ? (
                      <img
                        src={participant.photoURL}
                        alt={participant.displayName}
                        className="w-10 h-10 rounded-full mr-3"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white mr-3">
                        {participant.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-medium">
                        {participant.displayName}
                      </div>
                      <div className="text-sm text-gray-500">
                        Joined{" "}
                        {new Date(
                          participant.registeredAt.seconds * 1000
                        ).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Admin actions section - only visible to creator */}
        {isCreator && (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Tournament Management</h2>
              <div className="space-y-4">
                <Link to={`/tournament/${tournamentId}/edit`}>
                  <button className="w-full py-2 px-4 rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors duration-200 text-center">
                    Edit Tournament
                  </button>
                </Link>

                {tournamentStarted && (
                  <Link to={`/tournament/${tournamentId}/matches`}>
                    <button className="w-full py-2 px-4 rounded-lg text-white bg-green-600 hover:bg-green-700 transition-colors duration-200 text-center">
                      Manage Matches
                    </button>
                  </Link>
                )}

                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        "Are you sure you want to delete this tournament? This action cannot be undone."
                      )
                    ) {
                      // Delete logic would go here
                    }
                  }}
                  className="w-full py-2 px-4 rounded-lg text-white bg-red-600 hover:bg-red-700 transition-colors duration-200 text-center"
                >
                  Delete Tournament
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TournamentDetail;
