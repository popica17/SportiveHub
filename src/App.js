//import logo from "./logo.svg";
import { Route, Routes } from "react-router-dom";
import "./App.css";
import ScrollToTop from "./helpers/ScrollToTop";
import Navbar from "./layouts/Navbar";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Ranking from "./pages/Ranking";
import Tournaments from "./pages/Tournaments";
import Footer from "./components/Footer";
import Register from "./pages/Register";
function App() {
  return (
    <div className="App bg-white">
      <Navbar />

      <ScrollToTop />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tournaments" element={<Tournaments />} />
        <Route path="/ranking" element={<Ranking />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
      <Footer />
    </div>
  );
}

export default App;
