const express = require('express');
const router = express.Router();
const {
	googleLogin,
	register,
	login,
	studentRegister,
	studentLogin,
	adminLogin,
	verifyOTP,
	resendOTP,
	getMe,
	changePassword,
	requestPasswordChangeOtp,
	confirmPasswordChange,
	requestPasswordResetOtp,
	resetPasswordWithOtp,
	logout,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/google', googleLogin);
router.post('/register', register);
router.post('/login', login);
router.post('/student-register', studentRegister);
router.post('/student-login', studentLogin);
router.post('/admin-login', adminLogin);
router.post('/verify-otp', protect, verifyOTP);
router.post('/resend-otp', protect, resendOTP);
router.get('/me', protect, getMe);
router.post('/change-password', protect, changePassword);
router.post('/request-password-change-otp', protect, requestPasswordChangeOtp);
router.post('/confirm-password-change', protect, confirmPasswordChange);

router.post('/request-password-reset-otp', requestPasswordResetOtp);
router.post('/reset-password-with-otp', resetPasswordWithOtp);

router.post('/logout', protect, logout);

module.exports = router;
