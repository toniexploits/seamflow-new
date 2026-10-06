// Backs the "Grant Access" tab in admin.html. Nothing is paid through
// self-checkout: once a client's payment is confirmed manually, the admin
// issues an access token here against the client's email. Same x-admin-key
// gate as admin-submissions.js, and writes to the same "access-tokens" store
// that get-tool-content.js / submit-audit.js read.
//
// Clarity (the Business Systems Assessment) is granted either as
// "comprehensive" (all 22 departments) or "focused" (one or more individual
// department assessments) — see lib/clarity-access.js.
const crypto = require("crypto");
const { getBlobStore } = require("./lib/blob-store");
const { ALL_DEPT_KEYS, clarityCatalog } = require("./lib/clarity-access");

// The assessment is the only client-facing tool. (Structure and Growth work
// is delivered through private consulting, not through the website.)
const GRANTABLE_PLANS = ["clarity"];

exports.handler = async (event) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    return { statusCode: 503, body: JSON.stringify({ error: "Admin access not configured" }) };
  }

  const suppliedKey = event.headers["x-admin-key"] || event.queryStringParameters?.key;
  if (suppliedKey !== adminKey) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  // The grant form needs the department list to offer focused assessments.
  if (event.httpMethod === "GET") {
    return { statusCode: 200, body: JSON.stringify({ categories: clarityCatalog() }) };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { email, facility, plans } = body;
  const grants = Array.isArray(plans) ? GRANTABLE_PLANS.filter(p => plans.includes(p)) : [];
  if (!email || !email.includes("@") || grants.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing or invalid email/plans" }) };
  }

  let clarity;
  if (grants.includes("clarity")) {
    if (body.clarity?.scope === "comprehensive") {
      clarity = { scope: "comprehensive" };
    } else {
      const requested = Array.isArray(body.clarity?.depts) ? body.clarity.depts : [];
      const depts = ALL_DEPT_KEYS.filter(k => requested.includes(k));
      if (body.clarity?.scope !== "focused" || depts.length === 0) {
        return { statusCode: 400, body: JSON.stringify({ error: "Select the comprehensive assessment or at least one department" }) };
      }
      clarity = { scope: "focused", depts };
    }
  }

  const token = crypto.randomBytes(24).toString("hex");
  const store = getBlobStore("access-tokens", event);
  await store.setJSON(token, {
    plan: grants[0],
    grants,
    ...(clarity ? { clarity } : {}),
    email,
    facility: facility || "",
    issuedAt: new Date().toISOString(),
    issuedBy: "admin"
  });

  const links = grants.map(plan => ({
    plan,
    url: `/tools/${plan}-plan.html?token=${token}&plan=${plan}`
  }));

  return { statusCode: 200, body: JSON.stringify({ token, links }) };
};
