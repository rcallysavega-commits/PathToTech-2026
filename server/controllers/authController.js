const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { verifyGoogleToken } = require('../config/passport');
const { generateOTP, getOTPExpiry } = require('../utils/otp');
const { sendOTPEmail } = require('../config/mailer');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

const isCvsuEmail = (email = '') => email.toLowerCase().endsWith('@cvsu.edu.ph');

const sanitizeEmail = (value = '') => String(value).trim().toLowerCase();
const sanitizePassword = (value = '') => String(value).replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
const isStrongPassword = (value = '') => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(value);
const normalizeText = (value = '') => String(value).trim();
const normalizeStudentNumber = (value = '') => String(value).trim();
const normalizeOtp = (value = '') => String(value).replace(/\D/g, '').trim();
const ALLOWED_GENDERS = new Set(['Male', 'Female', 'Prefer not to say']);

const composeFullName = (firstName = '', middleName = '', lastName = '') =>
  [firstName, middleName, lastName].map((v) => normalizeText(v)).filter(Boolean).join(' ');

const ALLOWED_MAJORS = new Set(['Computer Science', 'Information Technology', 'Information Systems']);

const buildUserPayload = (user) => ({
  _id: user._id,
  fullName: user.fullName,
  email: user.email,
  profilePicture: user.profilePicture,
  role: user.role,
  studentNumber: user.studentNumber,
  major: user.major,
  gender: user.gender,
  firstLoginCompleted: user.firstLoginCompleted,
  emailVerified: user.emailVerified,
});

const isPlaceholder = (value = '') =>
  value.includes('your_email') ||
  value.includes('your_gmail_app_password') ||
  value.includes('your_email_password_here') ||
  value.includes('your_brevo_api_key_here');

const hasEmailConfig = () => {
  const hasBrevoConfig = Boolean(process.env.BREVO_API_KEY || process.env.BREVO_APIKEY || process.env.BREVO_KEY);
  if (hasBrevoConfig) return true;

  const hasGmailApiConfig = Boolean(
    process.env.GMAIL_API_CLIENT_ID &&
    process.env.GMAIL_API_CLIENT_SECRET &&
    process.env.GMAIL_API_REFRESH_TOKEN &&
    process.env.EMAIL_USER
  );
  if (hasGmailApiConfig) return true;

  const hasResendConfig = Boolean(process.env.RESEND_API_KEY);
  if (hasResendConfig) return true;

  const user = process.env.EMAIL_USER || '';
  const pass = process.env.EMAIL_PASS || '';
  return Boolean(user && pass && !isPlaceholder(user) && !isPlaceholder(pass));
};

const emailConfigGuidance =
  'Configure at least one email provider: BREVO_API_KEY, RESEND_API_KEY, Gmail API (GMAIL_API_CLIENT_ID/GMAIL_API_CLIENT_SECRET/GMAIL_API_REFRESH_TOKEN + EMAIL_USER), or SMTP (EMAIL_USER + EMAIL_PASS).';

const getEmailSendFailureMessage = (emailErr) => {
  const providerCode = emailErr?.code ? ` Code: ${emailErr.code}.` : '';

  const brevoKeyNotFound =
    String(emailErr?.response || '').toLowerCase().includes('key not found') ||
    (Array.isArray(emailErr?.providerErrors) && emailErr.providerErrors.some((item) =>
      item.provider === 'brevo' && String(item.response || '').toLowerCase().includes('key not found')
    ));

  if (brevoKeyNotFound) {
    return `Failed to send OTP email.${providerCode} Brevo rejected the API key ("Key not found"). Replace BREVO_API_KEY with a valid active API v3 key in your deployment environment.`;
  }

  if (emailErr?.code === 'EMAIL_ALL_PROVIDERS_FAILED' && Array.isArray(emailErr?.providerErrors)) {
    const providerSummaries = emailErr.providerErrors
      .map((item) => `${item.provider}${item.code ? `(${item.code})` : ''}${item.responseCode ? `:${item.responseCode}` : ''}`)
      .join(', ');

    const unauthorizedBrevo = emailErr.providerErrors.find((item) =>
      item.provider === 'brevo' &&
      item.responseCode === 401
    );

    if (unauthorizedBrevo) {
      return `Failed to send OTP email.${providerCode} Brevo returned 401 unauthorized. If IP restriction is enabled in Brevo, add this server IP to Authorized IPs. Providers tried: ${providerSummaries}.`;
    }

    return `Failed to send OTP email.${providerCode} Providers tried: ${providerSummaries}. Check email provider configuration and server logs.`;
  }

  if (emailErr?.code === 'BREVO_HTTP_ERROR' && emailErr?.responseCode === 401) {
    return `Failed to send OTP email.${providerCode} Brevo returned 401 unauthorized. If IP restriction is enabled in Brevo, add this server IP to Authorized IPs.`;
  }

  return `Failed to send OTP email.${providerCode} Check email provider configuration and server logs.`;
};

const sendOtpOrFail = async (user, otp, subject = 'Email Verification') => {
  if (!hasEmailConfig()) {
    const error = new Error(`OTP email service is not configured. ${emailConfigGuidance}`);
    error.statusCode = 500;
    throw error;
  }

  try {
    await sendOTPEmail(user.email, otp, user.fullName, subject);
    return { provider: 'email', otpSent: true };
  } catch (emailErr) {
    const error = new Error(getEmailSendFailureMessage(emailErr));
    error.code = emailErr?.code;
    error.responseCode = emailErr?.responseCode;
    error.response = emailErr?.response;
    error.providerErrors = emailErr?.providerErrors;
    error.statusCode = 500;
    throw error;
  }
};

const formatEmailError = (error) => ({
  message: error?.message,
  code: error?.code,
  command: error?.command,
  responseCode: error?.responseCode,
  response: error?.response,
  stack: error?.stack,
});

const logStudentRegisterRejection = (reason, meta = {}) => {
  console.warn('[student-register] Request rejected:', { reason, ...meta });
};

// POST /api/auth/student-register
const studentRegister = async (req, res) => {
  try {
    const { firstName, middleName, lastName, studentNumber, gender, major, email, password } = req.body;
    const normalizedFirstName = normalizeText(firstName);
    const normalizedMiddleName = normalizeText(middleName);
    const normalizedLastName = normalizeText(lastName);
    const normalizedStudentNumber = normalizeStudentNumber(studentNumber);
    const normalizedGender = normalizeText(gender);
    const normalizedMajor = normalizeText(major);
    const normalizedFullName = composeFullName(normalizedFirstName, normalizedMiddleName, normalizedLastName);
    const normalizedEmail = sanitizeEmail(email);
    const normalizedPassword = sanitizePassword(password);

    if (!normalizedFirstName || !normalizedLastName || !normalizedStudentNumber || !normalizedGender || !normalizedMajor || !normalizedEmail || !normalizedPassword) {
      logStudentRegisterRejection('missing_required_fields', {
        hasFirstName: Boolean(normalizedFirstName),
        hasLastName: Boolean(normalizedLastName),
        hasStudentNumber: Boolean(normalizedStudentNumber),
        hasGender: Boolean(normalizedGender),
        hasMajor: Boolean(normalizedMajor),
        hasEmail: Boolean(normalizedEmail),
        hasPassword: Boolean(normalizedPassword),
      });
      return res.status(400).json({ success: false, message: 'First name, last name, student number, gender, course, CvSU email, and password are required.' });
    }

    if (!ALLOWED_GENDERS.has(normalizedGender)) {
      logStudentRegisterRejection('invalid_gender', { gender: normalizedGender });
      return res.status(400).json({ success: false, message: 'Invalid gender value.' });
    }

    if (!ALLOWED_MAJORS.has(normalizedMajor)) {
      logStudentRegisterRejection('invalid_course', { major: normalizedMajor });
      return res.status(400).json({ success: false, message: 'Invalid course value.' });
    }

    if (!isCvsuEmail(normalizedEmail)) {
      logStudentRegisterRejection('invalid_email_domain', { email: normalizedEmail });
      return res.status(403).json({
        success: false,
        message: 'Only CvSU email accounts (@cvsu.edu.ph) are allowed.',
        code: 'INVALID_DOMAIN',
      });
    }

    if (normalizedPassword.length < 8) {
      logStudentRegisterRejection('password_too_short', { email: normalizedEmail });
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
    }

    if (!isStrongPassword(normalizedPassword)) {
      logStudentRegisterRejection('password_not_strong', { email: normalizedEmail });
      return res.status(400).json({
        success: false,
        message: 'Use at least 8 characters with uppercase, lowercase, number, and special character.',
      });
    }

    const existing = await User.findOne({ email: normalizedEmail }).select('+otpCode +otpExpiresAt');
    if (existing && existing.role === 'admin') {
      logStudentRegisterRejection('email_reserved_for_admin', { email: normalizedEmail });
      return res.status(403).json({ success: false, message: 'This email is reserved for admin access.' });
    }

    if (existing && existing.firstLoginCompleted) {
      logStudentRegisterRejection('account_already_exists', { email: normalizedEmail });
      return res.status(409).json({ success: false, message: 'Account already exists. Please login instead.' });
    }

    const duplicateStudentNumber = await User.findOne({
      studentNumber: normalizedStudentNumber,
      ...(existing ? { _id: { $ne: existing._id } } : {}),
    }).lean();
    if (duplicateStudentNumber) {
      logStudentRegisterRejection('student_number_already_registered', { studentNumber: normalizedStudentNumber });
      return res.status(409).json({ success: false, message: 'Student number is already registered.' });
    }

    const hashedPassword = await bcrypt.hash(normalizedPassword, 10);
    const otp = generateOTP();
    const otpExpiry = getOTPExpiry();

    let user = existing;
    if (!user) {
      user = await User.create({
        fullName: normalizedFullName,
        email: normalizedEmail,
        password: hashedPassword,
        role: 'student',
        studentNumber: normalizedStudentNumber,
        gender: normalizedGender,
        major: normalizedMajor,
        emailVerified: false,
        firstLoginCompleted: false,
        otpCode: otp,
        otpExpiresAt: otpExpiry,
      });
    } else {
      user.fullName = normalizedFullName;
      user.password = hashedPassword;
      user.studentNumber = normalizedStudentNumber;
      user.gender = normalizedGender;
      user.major = normalizedMajor;
      user.otpCode = otp;
      user.otpExpiresAt = otpExpiry;
      user.emailVerified = false;
      user.firstLoginCompleted = false;
      await user.save();
    }

    let delivery;
    try {
      delivery = await sendOtpOrFail(user, otp, 'Email Verification');
    } catch (emailErr) {
      console.error('Student register OTP email error:', formatEmailError(emailErr));
      return res.status(500).json({
        success: false,
        message: getEmailSendFailureMessage(emailErr),
      });
    }

    const tempToken = generateToken(user._id);
    return res.status(201).json({
      success: true,
      requiresOTP: true,
      message: 'Registration successful. OTP sent to your CvSU email.',
      token: tempToken,
      user: buildUserPayload(user),
    });
  } catch (error) {
    console.error('Student register error:', error);
    return res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
  }
};

// POST /api/auth/register
const register = studentRegister;

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = sanitizeEmail(email);
    const normalizedPassword = sanitizePassword(password);

    if (!normalizedEmail || !normalizedPassword) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    if (!isCvsuEmail(normalizedEmail)) {
      return res.status(403).json({
        success: false,
        message: 'Only CvSU email accounts (@cvsu.edu.ph) are allowed.',
        code: 'INVALID_DOMAIN',
      });
    }

    const user = await User.findOne({ email: normalizedEmail }).select('+password +otpCode +otpExpiresAt');
    if (!user || !user.password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(normalizedPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    if (user.role === 'admin') {
      const token = generateToken(user._id);
      return res.status(200).json({
        success: true,
        requiresOTP: false,
        message: 'Login successful.',
        token,
        user: buildUserPayload(user),
      });
    }

    if (!user.firstLoginCompleted) {
      const otp = generateOTP();
      const otpExpiry = getOTPExpiry();
      user.otpCode = otp;
      user.otpExpiresAt = otpExpiry;
      await user.save();

      let delivery;
      try {
        delivery = await sendOtpOrFail(user, otp, 'Email Verification');
      } catch (emailErr) {
        console.error('Student login OTP email error:', formatEmailError(emailErr));
        return res.status(500).json({
          success: false,
          message: getEmailSendFailureMessage(emailErr),
        });
      }

      const tempToken = generateToken(user._id);
      return res.status(200).json({
        success: true,
        requiresOTP: true,
        message: 'OTP sent to your email.',
        token: tempToken,
        user: buildUserPayload(user),
      });
    }

    const token = generateToken(user._id);
    return res.status(200).json({
      success: true,
      requiresOTP: false,
      message: 'Login successful.',
      token,
      user: buildUserPayload(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
};

// POST /api/auth/student-login
const studentLogin = login;

// POST /api/auth/google
const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, message: 'Google credential is required.' });
    }

    // Verify Google token
    const payload = await verifyGoogleToken(credential);
    const { sub: googleId, email, name, picture } = payload;

    // Domain restriction: only @cvsu.edu.ph
    if (!email.endsWith('@cvsu.edu.ph')) {
      return res.status(403).json({
        success: false,
        message: 'Only CvSU Gmail accounts are allowed.',
        code: 'INVALID_DOMAIN',
      });
    }

    // Find or create user
    let user = await User.findOne({ email }).select('+otpCode +otpExpiresAt');

    if (!user) {
      user = await User.create({
        fullName: name,
        email,
        googleId,
        profilePicture: picture,
        role: 'student',
        emailVerified: false,
        firstLoginCompleted: false,
      });
    } else {
      // Update profile picture if changed
      if (user.profilePicture !== picture) {
        user.profilePicture = picture;
        await user.save();
      }
    }

    // First login → send OTP
    if (!user.firstLoginCompleted) {
      const otp = generateOTP();
      const otpExpiry = getOTPExpiry();

      user.otpCode = otp;
      user.otpExpiresAt = otpExpiry;
      await user.save();

      let delivery;
      try {
        delivery = await sendOtpOrFail(user, otp, 'Email Verification');
      } catch (emailErr) {
        console.error('Google login OTP email error:', formatEmailError(emailErr));
        return res.status(500).json({
          success: false,
          message: getEmailSendFailureMessage(emailErr),
        });
      }

      const tempToken = generateToken(user._id);
      return res.status(200).json({
        success: true,
        requiresOTP: true,
        message: 'OTP sent to your CvSU email.',
        token: tempToken,
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          profilePicture: user.profilePicture,
          role: user.role,
          firstLoginCompleted: user.firstLoginCompleted,
        },
      });
    }

    // Returning user — direct login
    const token = generateToken(user._id);
    return res.status(200).json({
      success: true,
      requiresOTP: false,
      message: 'Login successful.',
      token,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        profilePicture: user.profilePicture,
        role: user.role,
        studentNumber: user.studentNumber,
        major: user.major,
        gender: user.gender,
        firstLoginCompleted: user.firstLoginCompleted,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    console.error('Google login error:', error);
    return res.status(500).json({ success: false, message: 'Google login failed. Please try again.' });
  }
};

// POST /api/auth/admin-login
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email, role: 'admin' }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const token = generateToken(user._id);
    return res.status(200).json({
      success: true,
      message: 'Admin login successful.',
      token,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({ success: false, message: 'Login failed.' });
  }
};

// POST /api/auth/verify-otp
const verifyOTP = async (req, res) => {
  try {
    const { otp } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId).select('+otpCode +otpExpiresAt');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (!user.otpCode || !user.otpExpiresAt) {
      return res.status(400).json({ success: false, message: 'No OTP found. Please request a new OTP.' });
    }

    if (new Date() > user.otpExpiresAt) {
      user.otpCode = undefined;
      user.otpExpiresAt = undefined;
      await user.save();
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new OTP.', code: 'OTP_EXPIRED' });
    }

    if (user.otpCode !== otp.trim()) {
      return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
    }

    // OTP correct
    user.emailVerified = true;
    user.firstLoginCompleted = true;
    user.otpCode = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    const token = generateToken(user._id);
    return res.status(200).json({
      success: true,
      message: 'Email verified successfully. Welcome to PathToTech!',
      token,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        profilePicture: user.profilePicture,
        role: user.role,
        studentNumber: user.studentNumber,
        major: user.major,
        gender: user.gender,
        firstLoginCompleted: true,
        emailVerified: true,
      },
    });
  } catch (error) {
    console.error('OTP verify error:', error);
    return res.status(500).json({ success: false, message: 'OTP verification failed.' });
  }
};

// POST /api/auth/resend-otp
const resendOTP = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select('+otpCode +otpExpiresAt');

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (user.firstLoginCompleted) {
      return res.status(400).json({ success: false, message: 'Email already verified.' });
    }

    const otp = generateOTP();
    const otpExpiry = getOTPExpiry();
    user.otpCode = otp;
    user.otpExpiresAt = otpExpiry;
    await user.save();

    let delivery;
    try {
      delivery = await sendOtpOrFail(user, otp, 'Email Verification');
    } catch (emailErr) {
      console.error('Resend OTP email error:', formatEmailError(emailErr));
      return res.status(500).json({
        success: false,
        message: getEmailSendFailureMessage(emailErr),
      });
    }

    return res.status(200).json({
      success: true,
      message: 'A new OTP has been sent to your CvSU email.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Resend OTP failed.' });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    return res.status(200).json({ success: true, user });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch user.' });
  }
};

// POST /api/auth/change-password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const normalizedCurrent = sanitizePassword(currentPassword);
    const normalizedNew = sanitizePassword(newPassword);

    if (!normalizedCurrent || !normalizedNew) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required.' });
    }

    if (!isStrongPassword(normalizedNew)) {
      return res.status(400).json({ success: false, message: 'Use at least 8 characters with uppercase, lowercase, number, and special character.' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user || !user.password) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(normalizedCurrent, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    user.password = await bcrypt.hash(normalizedNew, 10);
    await user.save();
    return res.status(200).json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update password.' });
  }
};

// POST /api/auth/request-password-change-otp
const requestPasswordChangeOtp = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+otpCode +otpExpiresAt');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const otp = generateOTP();
    user.otpCode = otp;
    user.otpExpiresAt = getOTPExpiry();
    await user.save();

    await sendOtpOrFail(user, otp, 'Password Change Verification');
    return res.status(200).json({ success: true, message: 'OTP sent to your registered email.' });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to send OTP.' });
  }
};

// POST /api/auth/confirm-password-change
const confirmPasswordChange = async (req, res) => {
  try {
    const { currentPassword, newPassword, otp } = req.body;
    const normalizedCurrent = sanitizePassword(currentPassword);
    const normalizedNew = sanitizePassword(newPassword);
    const normalizedOtp = String(otp || '').trim();

    if (!normalizedCurrent || !normalizedNew || !normalizedOtp) {
      return res.status(400).json({ success: false, message: 'Current password, new password, and OTP are required.' });
    }

    if (!isStrongPassword(normalizedNew)) {
      return res.status(400).json({ success: false, message: 'Use at least 8 characters with uppercase, lowercase, number, and special character.' });
    }

    const user = await User.findById(req.user._id).select('+password +otpCode +otpExpiresAt');
    if (!user || !user.password) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(normalizedCurrent, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    if (!user.otpCode || !user.otpExpiresAt) {
      return res.status(400).json({ success: false, message: 'No OTP found. Please request a new OTP.' });
    }

    if (new Date() > user.otpExpiresAt) {
      user.otpCode = undefined;
      user.otpExpiresAt = undefined;
      await user.save();
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new OTP.' });
    }

    if (user.otpCode !== normalizedOtp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
    }

    user.password = await bcrypt.hash(normalizedNew, 10);
    user.otpCode = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    return res.status(200).json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update password.' });
  }
};

// POST /api/auth/request-password-reset-otp
const requestPasswordResetOtp = async (req, res) => {
  try {
    const normalizedEmail = sanitizeEmail(req.body?.email);

    if (!normalizedEmail) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    if (!isCvsuEmail(normalizedEmail)) {
      return res.status(403).json({
        success: false,
        message: 'Only CvSU email accounts (@cvsu.edu.ph) are allowed.',
        code: 'INVALID_DOMAIN',
      });
    }

    const user = await User.findOne({ email: normalizedEmail }).select('+otpCode +otpExpiresAt');
    if (!user || user.role === 'admin') {
      return res.status(404).json({ success: false, message: 'No registered account found for this email.' });
    }

    const otp = generateOTP();
    const otpExpiry = getOTPExpiry();
    user.otpCode = otp;
    user.otpExpiresAt = otpExpiry;
    await user.save();

    const delivery = await sendOtpOrFail(user, otp, 'Password Reset Verification');

    return res.status(200).json({
      success: true,
      message: 'OTP sent to your registered email.',
      email: user.email,
    });
  } catch (error) {
    console.error('Password reset OTP email error:', formatEmailError(error));
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to send OTP.' });
  }
};

// POST /api/auth/reset-password-with-otp
const resetPasswordWithOtp = async (req, res) => {
  try {
    const normalizedEmail = sanitizeEmail(req.body?.email);
    const normalizedOtp = normalizeOtp(req.body?.otp);
    const normalizedNewPassword = sanitizePassword(req.body?.newPassword);

    if (!normalizedEmail || !normalizedOtp || !normalizedNewPassword) {
      return res.status(400).json({ success: false, message: 'Email, OTP, and new password are required.' });
    }

    if (!isCvsuEmail(normalizedEmail)) {
      return res.status(403).json({
        success: false,
        message: 'Only CvSU email accounts (@cvsu.edu.ph) are allowed.',
        code: 'INVALID_DOMAIN',
      });
    }

    if (!isStrongPassword(normalizedNewPassword)) {
      return res.status(400).json({ success: false, message: 'Use at least 8 characters with uppercase, lowercase, number, and special character.' });
    }

    const user = await User.findOne({ email: normalizedEmail }).select('+password +otpCode +otpExpiresAt');
    if (!user || !user.password) {
      return res.status(404).json({ success: false, message: 'No registered account found for this email.' });
    }

    if (!user.otpCode || !user.otpExpiresAt) {
      return res.status(400).json({ success: false, message: 'No OTP found. Please request a new OTP.' });
    }

    if (new Date() > user.otpExpiresAt) {
      user.otpCode = undefined;
      user.otpExpiresAt = undefined;
      await user.save();
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new OTP.', code: 'OTP_EXPIRED' });
    }

    if (user.otpCode !== normalizedOtp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
    }

    user.password = await bcrypt.hash(normalizedNewPassword, 10);
    user.otpCode = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    return res.status(200).json({ success: true, message: 'Password reset successfully. You may now login.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to reset password.' });
  }
};

// POST /api/auth/logout
const logout = (req, res) => {
  return res.status(200).json({ success: true, message: 'Logged out successfully.' });
};

module.exports = {
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
};
