const express = require("express");
const router = express.Router();
const controller = require("../controllers/auth.controller");

// كل الـ routes دي public — مش محتاجة token
router.post("/check-student", controller.checkStudent);
router.post("/send-otp", controller.sendOtp);
router.post("/verify-otp", controller.verifyOtp);
router.post("/register", controller.register);
router.post("/login", controller.login);

module.exports = router;