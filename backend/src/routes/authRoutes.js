const express = require("express");
const { body } = require("express-validator");
const { register, login, facebookLogin } = require("../controllers/authController");
const validateRequest = require("../middleware/validateRequest");
const { authLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

router.post(
  "/register",
  authLimiter,
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
    body("name").optional().isString().isLength({ min: 2, max: 120 })
  ],
  validateRequest,
  register
);

router.post(
  "/login",
  authLimiter,
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
  ],
  validateRequest,
  login
);

router.post(
  "/facebook",
  authLimiter,
  [
    body("accessToken").optional().isString().isLength({ min: 20 }),
    body("code").optional().isString().isLength({ min: 10 }),
    body("redirectUri").optional().isString().isLength({ min: 8 })
  ],
  validateRequest,
  facebookLogin
);

module.exports = router;
