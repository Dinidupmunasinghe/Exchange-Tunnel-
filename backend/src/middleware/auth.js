const jwt = require("jsonwebtoken");
const env = require("../config/env");
const db = require("../models");

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Missing authentication token" });
  }

  try {
    const payload = jwt.verify(token, env.jwt.secret);
    const user = await db.User.findByPk(payload.sub);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid authentication token" });
    }
    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid authentication token" });
  }
}

module.exports = authMiddleware;
