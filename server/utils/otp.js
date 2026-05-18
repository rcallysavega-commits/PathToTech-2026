const crypto = require('crypto');

const generateOTP = () => {
  // Generate a 6-digit OTP
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const getOTPExpiry = () => {
  // OTP expires after 5 minutes
  return new Date(Date.now() + 5 * 60 * 1000);
};

module.exports = { generateOTP, getOTPExpiry };
