const { verifyRequest } = require("./lib/auth");
const { generateOutputBuffer } = require("./lib/excel-engine");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const user = verifyRequest(event);
  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ error: "Not authenticated." }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body." }) };
  }

  const { filename, dataBase64 } = body;
  if (!dataBase64) {
    return { statusCode: 400, body: JSON.stringify({ error: "No file data received." }) };
  }
  if (filename && !filename.toLowerCase().endsWith(".xlsx")) {
    return { statusCode: 400, body: JSON.stringify({ error: "Only .xlsx files are supported." }) };
  }

  try {
    const inputBuffer = Buffer.from(dataBase64, "base64");
    const outputBuffer = await generateOutputBuffer(inputBuffer);
    const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "_");

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: `output_finances_${timestamp}.xlsx`,
        dataBase64: Buffer.from(outputBuffer).toString("base64"),
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Could not process that file: ${err.message}` }),
    };
  }
};
