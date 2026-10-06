// Backs admin.html. Gated by a shared secret (ADMIN_KEY) rather than a login
// system, since there's a single operator. Set ADMIN_KEY in Netlify's site
// environment variables (and in .env for local dev) — without it, this
// endpoint refuses every request.
const { getBlobStore } = require("./lib/blob-store");

exports.handler = async (event) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    return { statusCode: 503, body: JSON.stringify({ error: "Admin access not configured" }) };
  }

  const suppliedKey = event.headers["x-admin-key"] || event.queryStringParameters?.key;
  if (suppliedKey !== adminKey) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  const store = getBlobStore("audit-submissions", event);
  const id = event.queryStringParameters?.id;

  if (id) {
    let record;
    try {
      record = await store.get(id, { type: "json" });
    } catch {
      record = null;
    }
    if (!record) {
      return { statusCode: 404, body: JSON.stringify({ error: "Not found" }) };
    }
    return { statusCode: 200, body: JSON.stringify(record) };
  }

  const { blobs = [] } = await store.list();
  const items = [];
  for (const blob of blobs) {
    const record = await store.get(blob.key, { type: "json" });
    if (record) {
      items.push({
        id: record.id,
        facility: record.facility,
        role: record.role,
        email: record.email,
        type: record.type || "",
        deptNames: (record.deptScores || []).map(d => d.name),
        overall: record.overall,
        tierLabel: record.tierLabel,
        deptCount: record.selectedDepts?.length || 0,
        submittedAt: record.submittedAt
      });
    }
  }
  items.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  return { statusCode: 200, body: JSON.stringify({ items }) };
};
