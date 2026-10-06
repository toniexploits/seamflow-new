// Serves the Business Systems Assessment content for tools/clarity-plan.html.
// What comes back depends on what the access token paid for (comprehensive,
// or specific focused department assessments), so it's built per-token — see
// lib/clarity-access.js.
const { getBlobStore } = require("./lib/blob-store");
const { clarityContentFor } = require("./lib/clarity-access");

exports.handler = async (event) => {
  const token = event.queryStringParameters?.token;
  const plan = event.queryStringParameters?.plan;

  if (!token || plan !== "clarity") {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing or invalid token/plan" }) };
  }

  const store = getBlobStore("access-tokens", event);
  let record;
  try {
    record = await store.get(token, { type: "json" });
  } catch {
    record = null;
  }

  const content = clarityContentFor(record);
  if (!content) {
    return { statusCode: 403, body: JSON.stringify({ error: "Invalid or expired access token" }) };
  }
  return { statusCode: 200, body: JSON.stringify(content) };
};
