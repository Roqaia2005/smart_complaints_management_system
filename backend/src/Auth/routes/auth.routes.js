const express = require("express");
const router = express.Router();
const controller = require("../controllers/auth.controller");

// Student signup (self-service, active immediately — must exist in Students table + OTP)
router.post("/check-student", controller.checkStudent);
router.post("/send-otp", controller.sendOtp);
router.post("/verify-otp", controller.verifyOtp);
router.post("/register", controller.registerStudent);

// Officer signup (pending admin approval before login)
router.post("/officer/send-otp", controller.sendOfficerOtp);
router.post("/officer/verify-otp", controller.verifyOfficerOtp);
router.post("/register/officer", controller.registerOfficer);

// Manager signup (pending admin approval before login)
router.post("/manager/send-otp", controller.sendManagerOtp);
router.post("/manager/verify-otp", controller.verifyManagerOtp);
router.post("/register/manager", controller.registerManager);

router.post("/login", controller.login);

module.exports = router;
