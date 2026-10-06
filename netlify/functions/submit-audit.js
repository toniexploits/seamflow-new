// Called by tools/clarity-plan.html once an assessment is completed. This is
// the only place a completed assessment's answers/scores are captured — until
// this runs, results only ever existed in the client's browser. Read back via
// admin-submissions.js.
//
// The assessment is paid: every submission must carry a valid access token,
// and may only cover departments that token was granted (see
// lib/clarity-access.js). The client's email comes from the token record, and
// scores are computed here from the raw answers rather than trusted from the
// browser.
const crypto = require("crypto");
const { getBlobStore } = require("./lib/blob-store");
const { clarityAccessFor, ALL_DEPT_KEYS } = require("./lib/clarity-access");
const { sendAuditNotification } = require("./lib/notify");
const clarity = require("./clarity-content");

function tierFor(score) {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  return clarity.MATURITY_TIERS.find(t => s >= t.min && s <= t.max) || clarity.MATURITY_TIERS[0];
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { token, assessment, facility, role, answers } = body;
  if (!token || !assessment || !answers || typeof answers !== "object") {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing or invalid assessment data" }) };
  }

  const tokenStore = getBlobStore("access-tokens", event);
  let record;
  try {
    record = await tokenStore.get(token, { type: "json" });
  } catch {
    record = null;
  }
  const access = clarityAccessFor(record);
  if (!access) {
    return { statusCode: 403, body: JSON.stringify({ error: "Invalid or expired access token" }) };
  }

  // "comprehensive" covers all 22 departments; anything else is the key of a
  // single department (a focused assessment).
  let type, selectedDepts;
  if (assessment === "comprehensive") {
    if (access.scope !== "comprehensive") {
      return { statusCode: 403, body: JSON.stringify({ error: "Assessment not included in this access" }) };
    }
    type = "comprehensive";
    selectedDepts = ALL_DEPT_KEYS;
  } else {
    if (!access.deptKeys.includes(assessment)) {
      return { statusCode: 403, body: JSON.stringify({ error: "Assessment not included in this access" }) };
    }
    type = "focused";
    selectedDepts = [assessment];
  }

  const cleanAnswers = {};
  const deptScores = [];
  for (const key of selectedDepts) {
    const dept = clarity.DEPARTMENTS.find(d => d.key === key);
    let total = 0;
    for (let qi = 0; qi < dept.questions.length; qi++) {
      const value = answers[`${key}_${qi}`];
      if (!Number.isInteger(value) || value < 1 || value > 5) {
        return { statusCode: 400, body: JSON.stringify({ error: "Assessment is incomplete" }) };
      }
      cleanAnswers[`${key}_${qi}`] = value;
      total += value;
    }
    deptScores.push({ key, name: dept.name, score: Math.round((total / (dept.questions.length * 5)) * 100) });
  }
  const overall = Math.round(deptScores.reduce((sum, d) => sum + d.score, 0) / deptScores.length);
  const tier = tierFor(overall);

  const id = crypto.randomBytes(12).toString("hex");
  const submission = {
    id,
    email: record.email,
    plan: "clarity",
    type,
    facility: (typeof facility === "string" && facility.trim()) || record.facility || "",
    role: typeof role === "string" ? role : "",
    selectedDepts,
    answers: cleanAnswers,
    deptScores,
    overall,
    tierLabel: tier.label,
    tierStage: tier.stage,
    submittedAt: new Date().toISOString()
  };

  const submissionStore = getBlobStore("audit-submissions", event);
  await submissionStore.setJSON(id, submission);

  // Best-effort — a failed/unconfigured email must never fail the submission.
  await sendAuditNotification(submission);

  return { statusCode: 200, body: JSON.stringify({ ok: true, id }) };
};
