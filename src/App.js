//import logo from "./logo.svg";
import { Route, Routes } from "react-router-dom";
import "./App.css";
import ScrollToTop from "./helpers/ScrollToTop";
import Navbar from "./layouts/Navbar";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Ranking from "./pages/Ranking";
import Tournaments from "./pages/Tournaments";
import TournamentDetail from "./pages/TournamentDetail";
import Footer from "./components/Footer";
import Register from "./pages/Register";
import Contact from "./pages/Contact";
import { AuthProvider } from "./contexts/AuthContext";
import Profile from "./pages/Profile";
import AdminRequests from "./pages/AdminRequests";
import AdminDashboard from "./pages/AdminDashboard";
import AdminRoute from "./components/AdminRoute";
import PrivateRoute from "./components/PrivateRoute";
import TeamManagement from "./pages/TeamManagement";
import TeamInvitations from "./pages/TeamInvitations";
import MatchManagement from "./pages/MatchManagement";
import LiveMatch from "./pages/LiveMatch";
import MatchCreation from "./pages/MatchCreation";
function App() {
  return (
    <AuthProvider>
      <div className="App bg-white">
        <Navbar />

        <ScrollToTop />

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tournaments" element={<Tournaments />} />
          <Route
            path="/tournament/:tournamentId"
            element={<TournamentDetail />}
          />
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />{" "}
          <Route path="/profile" element={<Profile />} />
          <Route
            path="/team"
            element={
              <PrivateRoute>
                <TeamManagement />
              </PrivateRoute>
            }
          />
          <Route
            path="/team-invitations"
            element={
              <PrivateRoute>
                <TeamInvitations />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin-requests"
            element={
              <AdminRoute requireSuperAdmin={true}>
                <AdminRequests />
              </AdminRoute>
            }
          />{" "}
          <Route
            path="/admin/dashboard"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
          <Route
            path="/tournament/:tournamentId/matches"
            element={
              <AdminRoute>
                <MatchManagement />
              </AdminRoute>
            }
          />{" "}
          <Route
            path="/tournament/:tournamentId/rankings"
            element={<Ranking />}
          />
          <Route
            path="/match/:matchId"
            element={
              <PrivateRoute>
                <LiveMatch />
              </PrivateRoute>
            }
          />{" "}
          <Route
            path="/tournament/:tournamentId/matches/create"
            element={
              <AdminRoute>
                <MatchCreation />
              </AdminRoute>
            }
          />
        </Routes>
        <Footer />
      </div>
    </AuthProvider>
  );
}

export default App;
