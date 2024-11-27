import React, { useState } from "react";
import { Link } from "react-router-dom";

function Tournaments() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSport, setFilterSport] = useState("all");

  const tournaments = [
    {
      id: 1,
      name: "Summer Football Championship",
      sport: "Football",
      startDate: "2024-06-01",
      status: "Upcoming",
      participants: 8,
      location: "City Stadium",
      image: "https://source.unsplash.com/random/800x600/?football",
    },
    {
      id: 2,
      name: "Basketball League 2024",
      sport: "Basketball",
      startDate: "2024-05-15",
      status: "Registration Open",
      participants: 4,
      location: "Sports Arena",
      image: "https://source.unsplash.com/random/800x600/?basketball",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Tournaments</h1>
          <p className="text-lg text-gray-600 mb-8">
            Discover and join upcoming sports tournaments
          </p>
        </div>

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
            </select>
          </div>
        </div>

        {/* Tournament Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {tournaments.map((tournament) => (
            <div
              key={tournament.id}
              className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300"
            >
              <div className="relative h-48">
                <img
                  src={tournament.image}
                  alt={tournament.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-4 right-4">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium
                    ${
                      tournament.status === "Upcoming"
                        ? "bg-green-100 text-green-800"
                        : "bg-blue-100 text-blue-800"
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
                    {tournament.participants}
                  </p>
                </div>
                <button className="mt-6 w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors duration-200">
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Tournaments;
