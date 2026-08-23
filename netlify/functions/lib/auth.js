const jwt = require("jsonwebtoken");

// ---------------------------------------------------------------------------
// Hardcoded users - EDIT THESE before using the app for real.
// ---------------------------------------------------------------------------
const USERS = {
  "junia1.junia2.junia3@bertsch.com": "junia1.junia2.junia3",
  "testuser@bertsch.com": "testuser",
};

// Set a real secret via the JWT_SECRET environment variable in the Netlify
// UI (Site configuration -> Environment variables) before deploying.
// Falling back to a default locally is fine for testing only.
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me";

function checkCredentials(email, password) {
  return Object.prototype.hasOwnProperty.call(USERS, email) && USERS[email] === password;
}

function issueToken(email) {
  return jwt.sign({ email }, JWT_SECRET, { expiresIn: "12h" });
}

function verifyRequest(event) {
  const header = event.headers.authorization || event.headers.Authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

module.exports = { USERS, checkCredentials, issueToken, verifyRequest };
