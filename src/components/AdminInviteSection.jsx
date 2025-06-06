import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

import RequestAdminAccess from "./RequestAdminAccess";

export default function AdminInviteSection() {
  const [showForm, setShowForm] = useState(false);
  const { userProfile } = useAuth();

  // dacă userul nu e logat sau deja e admin, nu arătăm deloc secțiunea
  if (!userProfile || userProfile.role !== "user") return null;

  return (
    <div className="max-w-4xl mx-auto my-12 p-6 bg-white shadow-xl rounded-xl">
      <h2 className="text-2xl font-bold mb-4">
        🧑‍⚖️ Vrei să devii administrator?
      </h2>
      <p className="mb-4 text-gray-700">
        Dacă vrei să creezi și să gestionezi turnee pe platforma noastră, poți
        aplica pentru rolul de administrator.
      </p>

      <div className="mb-6">
        <h3 className="font-semibold">✔️ Beneficii:</h3>
        <ul className="list-disc pl-6 text-sm text-gray-600">
          <li>Creezi și administrezi turnee</li>
          <li>Programezi meciuri și gestionezi scoruri live</li>
          <li>Ai control asupra echipelor participante</li>
        </ul>
      </div>

      <div className="mb-6">
        <h3 className="font-semibold">⚠️ Responsabilități:</h3>
        <ul className="list-disc pl-6 text-sm text-gray-600">
          <li>Respecți regulamentul platformei</li>
          <li>Administrezi doar turneele create de tine</li>
        </ul>
      </div>

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          📩 Trimite o cerere de acces admin
        </button>
      ) : (
        <RequestAdminAccess />
      )}
    </div>
  );
}
