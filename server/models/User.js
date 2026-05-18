const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    googleId: { type: String, sparse: true },
    profilePicture: { type: String, default: '' },
    password: { type: String, select: false },
    role: { type: String, enum: ['student', 'admin'], default: 'student' },
    studentNumber: { type: String, trim: true, default: '' },
    gender: { type: String, enum: ['Male', 'Female', 'Prefer not to say', ''], default: '' },
    major: { type: String, default: '' },
    emailVerified: { type: Boolean, default: false },
    firstLoginCompleted: { type: Boolean, default: false },
    otpCode: { type: String, select: false },
    otpExpiresAt: { type: Date, select: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Remove password and OTP from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.otpCode;
  delete obj.otpExpiresAt;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
