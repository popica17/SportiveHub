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
          <Route path="/register" element={<Register />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
        <Footer />
      </div>
    </AuthProvider>
  );
}

export default App;
