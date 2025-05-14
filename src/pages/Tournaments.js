import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";

function Tournaments() {
  const { currentUser, userProfile } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSport, setFilterSport] = useState("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tournament form state
  const [formData, setFormData] = useState({
    name: "",
    sport: "Football",
    location: "",
    startDate: "",
    registrationDeadline: "",
    maxParticipants: 8,
    description: "",
    image: "https://source.unsplash.com/random/800x600/?sport",
  });

  const [tournaments, setTournaments] = useState([]);

  // Fetch tournaments on component mount
  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    setIsLoading(true);
    try {
      const q = query(
        collection(db, "tournaments"),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const tournamentData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate
          ? new Date(doc.data().startDate.seconds * 1000)
              .toISOString()
              .split("T")[0]
          : "",
        createdAt: doc.data().createdAt
          ? new Date(doc.data().createdAt.seconds * 1000)
          : new Date(),
      }));
      setTournaments(tournamentData);
    } catch (err) {
      console.error("Error fetching tournaments:", err);
      setError("Failed to load tournaments. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentUser) {
      setError("You must be logged in to create a tournament");
      return;
    }

    try {
      const tournamentData = {
        ...formData,
        status: "Registration Open",
        participants: 0,
        maxParticipants: parseInt(formData.maxParticipants),
        createdBy: currentUser.uid,
        creatorName:
          currentUser.displayName ||
          userProfile?.firstName ||
          currentUser.email,
        createdAt: Timestamp.now(),
        startDate: new Date(formData.startDate),
        registrationDeadline: new Date(formData.registrationDeadline),
      };

      await addDoc(collection(db, "tournaments"), tournamentData);

      // Reset form and close it
      setFormData({
        name: "",
        sport: "Football",
        location: "",
        startDate: "",
        registrationDeadline: "",
        maxParticipants: 8,
        description: "",
        image: "https://source.unsplash.com/random/800x600/?sport",
      });
      setIsFormOpen(false);

      // Refresh tournaments
      fetchTournaments();
    } catch (error) {
      console.error("Error creating tournament:", error);
      setError("Failed to create tournament. Please try again.");
    }
  };

  // Filter tournaments based on search and sport filter
  const filteredTournaments = tournaments.filter((tournament) => {
    const matchesSearch =
      tournament.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tournament.location.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSport =
      filterSport === "all" ||
      tournament.sport.toLowerCase() === filterSport.toLowerCase();

    return matchesSearch && matchesSport;
  });

  // Generate image URL based on sport
  const getSportImage = (sport) => {
    return `https://source.unsplash.com/random/800x600/?${sport.toLowerCase()}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Tournaments</h1>
          <p className="text-lg text-gray-600 mb-4">
            Discover and join upcoming sports tournaments
          </p>

          {currentUser && (
            <button
              onClick={() => setIsFormOpen(!isFormOpen)}
              className="bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              {isFormOpen ? "Cancel" : "Create New Tournament"}
            </button>
          )}
        </div>

        {/* Tournament Creation Form */}
        {isFormOpen && (
          <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-md mb-12">
            <h2 className="text-2xl font-bold mb-4">Create New Tournament</h2>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-700 mb-1">
                  Tournament Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 mb-1">Sport</label>
                  <select
                    name="sport"
                    value={formData.sport}
                    onChange={handleInputChange}
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
                    value={formData.location}
                    onChange={handleInputChange}
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
                    value={formData.startDate}
                    onChange={handleInputChange}
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
                    value={formData.registrationDeadline}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 mb-1">
                  Maximum Participants
                </label>
                <input
                  type="number"
                  name="maxParticipants"
                  value={formData.maxParticipants}
                  onChange={handleInputChange}
                  min="2"
                  max="64"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                ></textarea>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  Create Tournament
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search and Filters */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              placeholder="Search tournaments..."
              className="flex-1 px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filterSport}
              onChange={(e) => setFilterSport(e.target.value)}
            >
              <option value="all">All Sports</option>
              <option value="football">Football</option>
              <option value="basketball">Basketball</option>
              <option value="tennis">Tennis</option>
              <option value="volleyball">Volleyball</option>
              <option value="swimming">Swimming</option>
              <option value="athletics">Athletics</option>
            </select>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading tournaments...</p>
          </div>
        )}

        {/* No Tournaments Message */}
        {!isLoading && filteredTournaments.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <h3 className="text-xl font-medium text-gray-900 mb-2">
              No tournaments found
            </h3>
            <p className="text-gray-600 mb-4">
              {searchQuery || filterSport !== "all"
                ? "No tournaments match your search criteria."
                : "There are no tournaments yet."}
            </p>
            {currentUser && (
              <button
                onClick={() => setIsFormOpen(true)}
                className="bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                Create the first tournament
              </button>
            )}
          </div>
        )}

        {/* Tournament Cards Grid */}
        {!isLoading && filteredTournaments.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredTournaments.map((tournament) => (
              <div
                key={tournament.id}
                className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300"
              >
                <div className="relative h-48">
                  <img
                    src={tournament.image || getSportImage(tournament.sport)}
                    alt={tournament.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-4 right-4">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium
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
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {tournament.name}
                  </h3>
                  <div className="space-y-2 text-gray-600">
                    <p>
                      <span className="font-medium">Sport:</span>{" "}
                      {tournament.sport}
                    </p>
                    <p>
                      <span className="font-medium">Date:</span>{" "}
                      {tournament.startDate}
                    </p>
                    <p>
                      <span className="font-medium">Location:</span>{" "}
                      {tournament.location}
                    </p>
                    <p>
                      <span className="font-medium">Participants:</span>{" "}
                      {tournament.participants} / {tournament.maxParticipants}
                    </p>
                  </div>
                  <Link to={`/tournament/${tournament.id}`}>
                    <button className="mt-6 w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors duration-200">
                      View Details
                    </button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Tournaments;
