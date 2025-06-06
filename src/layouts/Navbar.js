import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import { signOutUser } from "../firebaseAuth";
import { useAuth } from "../contexts/AuthContext";

const publicPages = [
  { name: "Home", path: "/" },
  { name: "Tournaments", path: "/tournaments" },
  { name: "Ranking", path: "/ranking" },
  { name: "Contact", path: "/contact" },
];

const authPages = [
  { name: "Log in", path: "/login" },
  { name: "Register", path: "/register" },
];

function Navbar() {
  const navigate = useNavigate();
  const { currentUser, userProfile, isAdmin, isSuperAdmin } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      navigate("/");
      setDropdownOpen(false);
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div>
      <nav className="fixed w-full z-50 bg-primary-blue py-0">
        <div className="max-w-5x1 mx-auto px-4 flex flex-row justify-between items-center">
          <div className="flex items-center">
            <Link to="/" className="mr-8">
              <img src={logo} alt="logo" width={80} />
            </Link>
            <ul className="flex space-x-6">
              {publicPages.map((page, index) => (
                <li key={index}>
                  <Link
                    to={page.path}
                    className="text-white hover:text-gray-200"
                  >
                    {page.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <ul className="flex space-x-6 items-center">
              {currentUser ? (
                <li className="relative" ref={dropdownRef}>
                  <button
                    onClick={toggleDropdown}
                    className="flex items-center text-white hover:text-gray-200 focus:outline-none"
                  >
                    <span className="mr-2">
                      {currentUser.displayName ||
                        (userProfile &&
                          (userProfile.firstName || userProfile.email)) ||
                        currentUser.email}
                    </span>
                    {currentUser.photoURL ? (
                      <img
                        src={currentUser.photoURL}
                        alt="User"
                        className="h-8 w-8 rounded-full"
                      />
                    ) : (
                      <div className="h-8 w-8 bg-blue-400 rounded-full flex items-center justify-center text-white">
                        {(
                          currentUser.displayName ||
                          userProfile?.firstName ||
                          currentUser.email ||
                          ""
                        )
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                    )}
                    <svg
                      className={`ml-1 h-5 w-5 text-white transition-transform duration-200 ${
                        dropdownOpen ? "transform rotate-180" : ""
                      }`}
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                      <Link
                        to="/profile"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setDropdownOpen(false)}
                      >
                        My Account
                      </Link>{" "}
                      <Link
                        to="/team"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setDropdownOpen(false)}
                      >
                        Team Management
                      </Link>
                      {!isAdmin && (
                        <Link
                          to="/team-invitations"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setDropdownOpen(false)}
                        >
                          Team Invitations
                        </Link>
                      )}
                      <Link
                        to="/my-tournaments"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setDropdownOpen(false)}
                      >
                        My Tournaments
                      </Link>{" "}
                      {/* SuperAdmin links - Only SuperAdmin can access the dashboard */}
                      {isSuperAdmin && (
                        <Link
                          to="/admin/dashboard"
                          className="block px-4 py-2 text-sm text-blue-600 hover:bg-gray-100"
                          onClick={() => setDropdownOpen(false)}
                        >
                          Admin Dashboard
                        </Link>
                      )}
                      {/* SuperAdmin specific links */}
                      {isSuperAdmin && (
                        <Link
                          to="/admin-requests"
                          className="block px-4 py-2 text-sm text-blue-600 hover:bg-gray-100"
                          onClick={() => setDropdownOpen(false)}
                        >
                          Admin Requests
                        </Link>
                      )}
                      <button
                        onClick={handleSignOut}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Sign Out
                      </button>
                    </div>
                  )}
                </li>
              ) : (
                authPages.map((page, index) => (
                  <li key={index}>
                    <Link
                      to={page.path}
                      className="text-white hover:text-gray-200"
                    >
                      {page.name}
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </nav>
      <div style={{ height: 120 }} />
    </div>
  );
}
export default Navbar;
