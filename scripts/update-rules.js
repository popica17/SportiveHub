const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const fs = require("fs");
const path = require("path");

// Initialize Firebase Admin
initializeApp();

async function updateRules() {
  try {
    // Read rules from file
    const rulesPath = path.join(__dirname, "..", "firestore.rules");
    const rules = fs.readFileSync(rulesPath, "utf8");

    // Get Firestore reference
    const db = getFirestore();

    console.log("Updating Firestore security rules...");

    // Use Security Rules API to update the rules
    await db.app.runtimeConfig.securityRules().updateRules({
      rules: rules,
      rulesetId: "firestore.rules",
    });

    console.log("Firestore security rules updated successfully!");
  } catch (error) {
    console.error("Error updating security rules:", error);
    process.exit(1);
  }
}

updateRules();
