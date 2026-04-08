const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../models");
const env = require("../config/env");
const {
  fetchFacebookProfileByAccessToken,
  exchangeFacebookCodeForUserAccessToken
} = require("../services/facebookService");

function createToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn
  });
}

async function register(req, res) {
  const { email, password, name } = req.body;
  const existing = await db.User.findOne({ where: { email } });
  if (existing) {
    return res.status(409).json({ message: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await db.User.create({
    email,
    passwordHash,
    name: name || null,
    credits: 500
  });
  const token = createToken(user);
  return res.status(201).json({
    message: "Registered successfully",
    token,
    user: { id: user.id, email: user.email, name: user.name, credits: user.credits }
  });
}

async function login(req, res) {
  const { email, password } = req.body;
  const user = await db.User.findOne({ where: { email } });
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: "Invalid credentials" });
  }
  const token = createToken(user);
  return res.json({
    message: "Login successful",
    token,
    user: { id: user.id, email: user.email, name: user.name, credits: user.credits }
  });
}

/**
 * Login or register via Facebook user access token (Facebook Login on the client).
 * Verifies the token with Graph API (and optionally debug_token when Meta app secret is set).
 */
async function facebookLogin(req, res) {
  let accessToken = req.body.accessToken;
  const { code, redirectUri } = req.body;

  if (!accessToken && code && redirectUri) {
    try {
      accessToken = await exchangeFacebookCodeForUserAccessToken(code, redirectUri, "login");
    } catch (err) {
      return res.status(401).json({ message: err.message || "Facebook code exchange failed" });
    }
  }

  if (!accessToken || typeof accessToken !== "string" || accessToken.length < 20) {
    return res.status(400).json({
      message: "Send Facebook accessToken, or code plus redirectUri (same URL you used in the OAuth dialog)."
    });
  }

  let profile;
  try {
    profile = await fetchFacebookProfileByAccessToken(accessToken, "login");
  } catch (err) {
    return res.status(401).json({ message: err.message || "Invalid Facebook token" });
  }

  if (!profile || !profile.id) {
    return res.status(401).json({ message: "Could not read Facebook profile" });
  }

  const fbId = String(profile.id);
  const email =
    profile.email && String(profile.email).includes("@")
      ? String(profile.email).toLowerCase()
      : `fb_${fbId}@users.facebook.exchange`;

  let user = await db.User.findOne({ where: { facebookUserId: fbId } });
  if (!user) {
    user = await db.User.findOne({ where: { email } });
  }

  if (!user) {
    // Random password hash — sign-in is via Facebook only for this account.
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
    user = await db.User.create({
      email,
      passwordHash,
      name: profile.name || null,
      facebookUserId: fbId,
      credits: 500
    });
  } else {
    user.facebookUserId = fbId;
    if (profile.name && !user.name) {
      user.name = profile.name;
    }
  }

  user.setFacebookToken(accessToken);
  await user.save();

  const token = createToken(user);
  return res.json({
    message: "Facebook login successful",
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      credits: user.credits,
      facebookUserId: user.facebookUserId
    }
  });
}

module.exports = { register, login, facebookLogin };
