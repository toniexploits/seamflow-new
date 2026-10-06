// Receives the contact form on contact.html. The enquiry is saved to the
// "enquiries" store (read back in admin.html via admin-enquiries.js) and
// emailed to the admin through Resend, so the visitor never leaves the site
// and no third-party form service or inbox address is exposed in the page.
//
// Normally called with JSON by the page's script. A plain HTML form post
// (JavaScript unavailable) is also accepted and answered with a redirect.
const crypto = require("crypto");
const { getBlobStore } = require("./lib/blob-store");
const { sendEnquiryNotification } = require("./lib/notify");

const FIELDS = {
  name: 120, role: 120, facility: 160, email: 160, phone: 40,
  business_type: 80, location: 120, employees: 40, interest: 40, message: 4000
};

function parseBody(event) {
  const raw = event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : (event.body || "");
  const type = (event.headers["content-type"] || "").toLowerCase();
  if (type.includes("application/json")) {
    return { data: JSON.parse(raw || "{}"), isForm: false };
  }
  return { data: Object.fromEntries(new URLSearchParams(raw)), isForm: true };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  let data, isForm;
  try {
    ({ data, isForm } = parseBody(event));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request" }) };
  }

  const done = () => isForm
    ? { statusCode: 303, headers: { Location: "/thank-you.html" }, body: "" }
    : { statusCode: 200, body: JSON.stringify({ ok: true }) };
  const fail = (statusCode, error) => isForm
    ? { statusCode, headers: { "Content-Type": "text/plain; charset=utf-8" }, body: `${error} Please go back and try again.` }
    : { statusCode, body: JSON.stringify({ error }) };

  // Honeypot: real visitors never fill the hidden "company_website" field.
  // Pretend it worked so bots get no signal.
  if (data.company_website) return done();

  const enquiry = {};
  for (const [field, max] of Object.entries(FIELDS)) {
    const value = typeof data[field] === "string" ? data[field].trim() : "";
    enquiry[field] = value.slice(0, max);
  }
  if (!enquiry.name) return fail(400, "Please enter your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(enquiry.email)) return fail(400, "Please enter a valid email address.");

  enquiry.id = crypto.randomBytes(12).toString("hex");
  enquiry.submittedAt = new Date().toISOString();

  // The enquiry counts as received if it reached the admin by either route.
  let stored = false;
  try {
    await getBlobStore("enquiries", event).setJSON(enquiry.id, enquiry);
    stored = true;
  } catch {
    stored = false;
  }
  const emailed = await sendEnquiryNotification(enquiry);

  if (!stored && !emailed) {
    return fail(502, "We could not send your enquiry.");
  }
  return done();
};
