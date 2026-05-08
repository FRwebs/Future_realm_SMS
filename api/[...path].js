require("reflect-metadata");

let cachedServer = null;

module.exports = async function handler(req, res) {
  if (!cachedServer) {
    const { createNestVercelServer } = require("../dist/api/backend/src/bootstrap/create-app.js");
    cachedServer = await createNestVercelServer();
  }

  return cachedServer(req, res);
};
