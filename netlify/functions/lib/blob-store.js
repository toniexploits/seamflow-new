// These are classic `exports.handler` functions ("Lambda compatibility
// mode"), and in that mode Netlify does NOT set up the Blobs environment
// automatically — getStore() throws MissingBlobsEnvironmentError unless the
// function first calls connectLambda(event), which reads the Blobs context
// Netlify attaches to each invocation. So every caller passes its `event`.
//
// Netlify Dev doesn't always attach that context locally, so there we fall
// back to the site id / auth token already present in .env for `netlify dev`.
const { getStore, connectLambda } = require("@netlify/blobs");

function getBlobStore(name, event) {
  if (process.env.NETLIFY_DEV === "true" && process.env.NETLIFY_SITE_ID && process.env.NETLIFY_AUTH_TOKEN) {
    return getStore({
      name,
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_AUTH_TOKEN
    });
  }
  if (event?.blobs) connectLambda(event);
  return getStore(name);
}

module.exports = { getBlobStore };
