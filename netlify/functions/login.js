const { checkCredentials, issueToken } = require("./lib/auth");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body." }) };
  }

  const email = (body.email || "").trim();
  const password = body.password || "";

  if (!checkCredentials(email, password)) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Invalid email or password." }),
    };
  }

  const token = issueToken(email);
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, email }),
  };
};
