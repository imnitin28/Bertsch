const { verifyRequest } = require("./lib/auth");
const { createInputTemplateBuffer } = require("./lib/excel-engine");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const user = verifyRequest(event);
  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ error: "Not authenticated." }) };
  }

  try {
    const buffer = await createInputTemplateBuffer();
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: "expenses_input_template.xlsx",
        dataBase64: Buffer.from(buffer).toString("base64"),
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
