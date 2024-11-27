import React from "react";
import { Link } from "react-router-dom";
import logo from "../assets/logo.png";
const navbarPages = [
  { name: "Home", path: "/" },
  { name: "Tournaments", path: "/tournaments" },
  { name: "Ranking", path: "/ranking" },
  { name: "Login", path: "/login" },
  { name: "Register", path: "/register" },
];

function Navbar() {
  return (
    <div>
      <nav className="fixed w-full z-50 bg-primary-blue py-0">
        <div className="max-w-5x1 mx-auto flex flex-row jsutify between items-center">
          <a href="/" className="mr-8">
            <img src={logo} alt="logo" width={80} />
          </a>
          <ul className="flex space-x-6">
            {navbarPages.map((page, index) => (
              <li key={index}>
                <Link to={page.path} className="text-white hover:text-gray-200">
                  {page.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
      <div style={{ height: 120 }} />
    </div>
  );
}
export default Navbar;
