// Sends the "someone completed the audit" email via Resend's HTTP API
// (https://resend.com/docs/api-reference/emails/send-email). No SDK — just a
// fetch call, so it costs nothing to load when RESEND_API_KEY isn't set yet.
// Callers should treat this as best-effort: a failed email must never block
// the actual submission from being saved.
// seamflowconsulting.com.ng is a verified sending domain in Resend.
const DEFAULT_FROM = "SeamFlow Website <website@seamflowconsulting.com.ng>";

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function sendAuditNotification(record) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // not configured yet — silently skip

  const from = process.env.RESEND_FROM || DEFAULT_FROM;
  const to = process.env.ADMIN_NOTIFY_EMAIL || "seamflowconsulting@gmail.com";

  const sorted = [...record.deptScores].sort((a, b) => a.score - b.score);
  const bottomThree = sorted.slice(0, 3);

  const html = `
    <div style="font-family:Calibri,Arial,sans-serif;max-width:520px;margin:0 auto;">
      <h2 style="color:#021D4B;margin:0 0 4px;">New Business Systems Assessment completed</h2>
      <p style="color:#6B7280;font-size:13.5px;margin:0 0 20px;">${new Date(record.submittedAt).toLocaleString()}</p>
      <table style="width:100%;font-size:14px;border-collapse:collapse;margin-bottom:20px;">
        <tr><td style="padding:4px 0;color:#6B7280;">Facility</td><td style="padding:4px 0;font-weight:700;">${record.facility || "—"}</td></tr>
        <tr><td style="padding:4px 0;color:#6B7280;">Role</td><td style="padding:4px 0;">${record.role || "—"}</td></tr>
        <tr><td style="padding:4px 0;color:#6B7280;">Email</td><td style="padding:4px 0;">${record.email || "—"}</td></tr>
        <tr><td style="padding:4px 0;color:#6B7280;">Assessment</td><td style="padding:4px 0;">${record.type === "focused" ? `Focused — ${record.deptScores[0].name}` : `Comprehensive — ${record.selectedDepts.length} departments`}</td></tr>
        <tr><td style="padding:4px 0;color:#6B7280;">Overall score</td><td style="padding:4px 0;font-weight:700;">${record.overall}/100 — ${record.tierLabel} (${record.tierStage})</td></tr>
      </table>
      ${record.deptScores.length > 1 ? `<p style="font-weight:700;color:#021D4B;margin:0 0 8px;">Top priority gaps</p>
      <ol style="margin:0 0 20px;padding-left:18px;font-size:13.5px;">
        ${bottomThree.map(d => `<li>${d.name} — ${d.score}/100</li>`).join("")}
      </ol>` : ""}
      <p style="font-size:13px;color:#6B7280;">Full report: log into <a href="https://seamflowconsulting.com.ng/admin.html">admin.html</a> and open this submission (id: ${record.id}).</p>
    </div>`;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to,
        subject: `New ${record.type === "focused" ? "focused" : "comprehensive"} assessment: ${record.facility || "Untitled facility"} — ${record.overall}/100`,
        html
      })
    });
  } catch {
    // best-effort — never throw out of here
  }
}

// Emails a contact-form enquiry to the admin. Returns true only if Resend
// accepted it, so submit-enquiry.js can tell whether the enquiry got through.
// Reply-To is the enquirer, so replying from the inbox goes straight to them.
async function sendEnquiryNotification(enquiry) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const from = process.env.RESEND_FROM || DEFAULT_FROM;
  const to = process.env.ADMIN_NOTIFY_EMAIL || "seamflowconsulting@gmail.com";

  const rows = [
    ["Name", enquiry.name],
    ["Job title / role", enquiry.role],
    ["Organization / facility", enquiry.facility],
    ["Email", enquiry.email],
    ["Phone / WhatsApp", enquiry.phone],
    ["Type of healthcare business", enquiry.business_type],
    ["Location", enquiry.location],
    ["Approx. employees", enquiry.employees],
    ["Needs help with", enquiry.interest]
  ];

  const html = `
    <div style="font-family:Calibri,Arial,sans-serif;max-width:560px;margin:0 auto;">
      <h2 style="color:#061B48;margin:0 0 4px;">New website enquiry</h2>
      <p style="color:#6B7280;font-size:13.5px;margin:0 0 20px;">${new Date(enquiry.submittedAt).toLocaleString("en-GB", { timeZone: "Africa/Lagos" })} (Lagos time)</p>
      <table style="width:100%;font-size:14px;border-collapse:collapse;margin-bottom:20px;">
        ${rows.map(([label, value]) => `<tr><td style="padding:5px 12px 5px 0;color:#6B7280;vertical-align:top;white-space:nowrap;">${label}</td><td style="padding:5px 0;font-weight:700;">${esc(value) || "—"}</td></tr>`).join("")}
      </table>
      <p style="font-weight:700;color:#061B48;margin:0 0 8px;">Message</p>
      <p style="font-size:14px;line-height:1.6;white-space:pre-wrap;margin:0 0 20px;">${esc(enquiry.message) || "—"}</p>
      <p style="font-size:13px;color:#6B7280;">Reply to this email to respond to ${esc(enquiry.name)} directly.</p>
    </div>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to,
        reply_to: enquiry.email,
        subject: `New enquiry: ${enquiry.name}${enquiry.facility ? " — " + enquiry.facility : ""}`,
        html
      })
    });
    return response.ok;
  } catch {
    return false;
  }
}

module.exports = { sendAuditNotification, sendEnquiryNotification };
