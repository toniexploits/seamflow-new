// Backs the "Enquiries" tab in admin.html — contact-form enquiries saved by
// submit-enquiry.js. Same ADMIN_KEY gate as admin-submissions.js.
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

  const store = getBlobStore("enquiries", event);
  const { blobs = [] } = await store.list();
  const items = [];
  for (const blob of blobs) {
    const record = await store.get(blob.key, { type: "json" });
    if (record) items.push(record);
  }
  items.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  return { statusCode: 200, body: JSON.stringify({ items }) };
};
