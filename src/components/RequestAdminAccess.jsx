import { useAuth } from "../contexts/AuthContext";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useState } from "react";

export default function RequestAdminAccess() {
  const { currentUser, userProfile } = useAuth();
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    motivation: "",
    experience: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    await setDoc(doc(db, "admin_requests", currentUser.uid), {
      uid: currentUser.uid,
      email: currentUser.email,
      requestedAt: Date.now(),
      status: "pending",
      ...formData,
    });

    setSubmitted(true);
  };

  if (userProfile?.role !== "user") return null;
  if (submitted) return <div>✅ Cererea ta a fost trimisă!</div>;

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md space-y-4 p-4 border rounded shadow"
    >
      <h2 className="text-xl font-bold">Cerere acces admin</h2>

      <div>
        <label className="block text-sm">Nume complet</label>
        <input
          name="fullName"
          type="text"
          value={formData.fullName}
          onChange={handleChange}
          required
          className="w-full border p-2 rounded"
        />
      </div>

      <div>
        <label className="block text-sm">Telefon (opțional)</label>
        <input
          name="phone"
          type="text"
          value={formData.phone}
          onChange={handleChange}
          className="w-full border p-2 rounded"
        />
      </div>

      <div>
        <label className="block text-sm">Experiență în organizare</label>
        <textarea
          name="experience"
          value={formData.experience}
          onChange={handleChange}
          rows="2"
          className="w-full border p-2 rounded"
        />
      </div>

      <div>
        <label className="block text-sm">Motivul cererii</label>
        <textarea
          name="motivation"
          value={formData.motivation}
          onChange={handleChange}
          required
          rows="3"
          className="w-full border p-2 rounded"
        />
      </div>

      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Trimite cererea
      </button>
    </form>
  );
}
