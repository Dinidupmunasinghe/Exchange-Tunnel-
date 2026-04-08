const express = require("express");
const { body, query } = require("express-validator");
const {
  connectFacebook,
  getMyFacebookPosts,
  getPostPreview,
  getManagedPages,
  selectManagedPage,
  clearSelectedPage
} = require("../controllers/facebookController");
const validateRequest = require("../middleware/validateRequest");

const router = express.Router();

router.get(
  "/post-preview",
  [
    query("url")
      .isString()
      .isLength({ min: 12, max: 2048 })
      .custom((value) => {
        let u;
        try {
          u = new URL(value);
        } catch {
          throw new Error("Invalid URL");
        }
        if (!/^https?:$/i.test(u.protocol)) {
          throw new Error("Only http(s) URLs");
        }
        const h = u.hostname.replace(/^www\./, "").toLowerCase();
        const ok =
          h === "facebook.com" ||
          h === "m.facebook.com" ||
          h === "fb.com" ||
          h === "fb.watch" ||
          h.endsWith(".facebook.com");
        if (!ok) throw new Error("Only Facebook post URLs are allowed");
        return true;
      })
  ],
  validateRequest,
  getPostPreview
);

router.post(
  "/connect",
  [
    body("accessToken").optional().isString().isLength({ min: 20 }),
    body("code").optional().isString().isLength({ min: 10 }),
    body("redirectUri").optional().isString().isLength({ min: 8 })
  ],
  validateRequest,
  connectFacebook
);
router.get("/pages", getManagedPages);
router.post(
  "/pages/select",
  [body("pageId").isString().isLength({ min: 1 }).withMessage("Managed Page ID is required")],
  validateRequest,
  selectManagedPage
);
router.delete("/pages/select", clearSelectedPage);
router.get("/posts", getMyFacebookPosts);

module.exports = router;
