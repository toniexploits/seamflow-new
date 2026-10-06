// The Business Systems Assessment (tools/clarity-plan.html) is a paid tool:
// an admin issues an access token once payment is confirmed (see
// admin-grant-access.js). A token's Clarity access is either "comprehensive"
// (all 22 departments, taken as one assessment) or "focused" (one or more
// individual department assessments, each taken and scored on its own).
// This is the single place that decides what a token may see and submit.
const clarity = require("../clarity-content");

const ALL_DEPT_KEYS = clarity.DEPARTMENTS.map(d => d.key);

// Returns { scope, deptKeys } for a token record, or null if it has no
// Clarity access.
function clarityAccessFor(record) {
  const granted = record && (record.plan === "clarity" || record.grants?.includes("clarity"));
  if (!granted) return null;

  const scope = record.clarity?.scope;
  if (scope === "comprehensive") {
    return { scope, deptKeys: ALL_DEPT_KEYS };
  }
  const allowed = Array.isArray(record.clarity?.depts) ? record.clarity.depts : [];
  const deptKeys = ALL_DEPT_KEYS.filter(k => allowed.includes(k));
  return deptKeys.length ? { scope: "focused", deptKeys } : null;
}

// Only the departments the token paid for ever leave the server.
function clarityContentFor(record) {
  const access = clarityAccessFor(record);
  if (!access) return null;
  return {
    ACCESS: { scope: access.scope, email: record.email, facility: record.facility || "" },
    DEPARTMENTS: clarity.DEPARTMENTS.filter(d => access.deptKeys.includes(d.key)),
    CATEGORIES: clarity.CATEGORIES
      .map(c => ({ ...c, deptKeys: c.deptKeys.filter(k => access.deptKeys.includes(k)) }))
      .filter(c => c.deptKeys.length),
    SCALE_OPTIONS: clarity.SCALE_OPTIONS,
    MATURITY_TIERS: clarity.MATURITY_TIERS
  };
}

// Department list for the admin "Grant Access" form.
function clarityCatalog() {
  return clarity.CATEGORIES.map(c => ({
    key: c.key,
    title: c.title,
    depts: c.deptKeys.map(k => ({ key: k, name: clarity.DEPARTMENTS.find(d => d.key === k).name }))
  }));
}

module.exports = { ALL_DEPT_KEYS, clarityAccessFor, clarityContentFor, clarityCatalog };
