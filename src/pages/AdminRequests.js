import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";

export default function AdminRequests() {
  const [requests, setRequests] = useState([]);
  const { userProfile } = useAuth();

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const q = query(
          collection(db, "admin_requests"),
          where("status", "==", "pending")
        );
        const snapshot = await getDocs(q);
        const fetchedRequests = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setRequests(fetchedRequests);
      } catch (error) {
        console.error("Eroare la aducerea cererilor:", error);
      }
    };

    fetchRequests();
  }, []);

  const handleApprove = async (request) => {
    try {
      // Update user role
      const userRef = doc(db, "users", request.uid);
      await updateDoc(userRef, { role: "admin" }); // Update request status
      const requestRef = doc(db, "admin_requests", request.id);
      await updateDoc(requestRef, { status: "approved" });

      // Remove from UI
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
    } catch (error) {
      console.error("Eroare la aprobare:", error);
    }
  };
  const handleReject = async (request) => {
    try {
      const requestRef = doc(db, "admin_requests", request.id);
      await updateDoc(requestRef, { status: "rejected" });
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
    } catch (error) {
      console.error("Eroare la respingere:", error);
    }
  };

  if (!userProfile || userProfile.role !== "superadmin") {
    return <p style={{ padding: "2rem" }}>⛔ Acces interzis.</p>;
  }

  return (
    <div style={{ maxWidth: "800px", margin: "2rem auto", padding: "1rem" }}>
      <h2
        style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1rem" }}
      >
        Cereri pentru admin
      </h2>
      {requests.length === 0 ? (
        <p>Nu există cereri în așteptare.</p>
      ) : (
        <ul style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {requests.map((req) => (
            <li
              key={req.id}
              style={{
                border: "1px solid #ccc",
                padding: "1rem",
                borderRadius: "8px",
                boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
              }}
            >
              <p>
                <strong>Email:</strong> {req.email}
              </p>
              <p>
                <strong>Motivație:</strong> {req.motivation}
              </p>
              <div style={{ marginTop: "0.5rem" }}>
                <button
                  onClick={() => handleApprove(req)}
                  style={{
                    backgroundColor: "#16a34a",
                    color: "white",
                    padding: "0.5rem 1rem",
                    borderRadius: "6px",
                    marginRight: "0.5rem",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  ✅ Acceptă
                </button>
                <button
                  onClick={() => handleReject(req)}
                  style={{
                    backgroundColor: "#dc2626",
                    color: "white",
                    padding: "0.5rem 1rem",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  ❌ Respinge
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
