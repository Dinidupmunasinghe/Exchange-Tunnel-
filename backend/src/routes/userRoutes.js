const express = require("express");
const { getProfile, getDashboard } = require("../controllers/userController");

const router = express.Router();

router.get("/me", getProfile);
router.get("/dashboard", getDashboard);

module.exports = router;
