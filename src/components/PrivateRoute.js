import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// A wrapper component for routes that require user authentication
const PrivateRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();

  // While still checking auth status, show a loading spinner
  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If not authenticated, redirect to login
  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  // If all checks pass, render the children
  return children;
};

export default PrivateRoute;
