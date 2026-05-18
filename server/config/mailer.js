const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');

const SMTP_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.EMAIL_PORT, 10) || 587;
const SMTP_SECURE = String(process.env.EMAIL_SECURE || '').toLowerCase() === 'true' || SMTP_PORT === 465;
const BREVO_API_KEY = String(process.env.BREVO_API_KEY || process.env.BREVO_APIKEY || process.env.BREVO_KEY || '')
  .trim()
  .replace(/^['"]|['"]$/g, '')
  .trim();
const HAS_GMAIL_API_CONFIG = Boolean(
  process.env.GMAIL_API_CLIENT_ID &&
  process.env.GMAIL_API_CLIENT_SECRET &&
  process.env.GMAIL_API_REFRESH_TOKEN &&
  process.env.EMAIL_USER
);
const HAS_BREVO_API_KEY = Boolean(BREVO_API_KEY);
const HAS_RESEND_API_KEY = Boolean(process.env.RESEND_API_KEY);
const DEFAULT_RESEND_FROM = 'PathToTech <onboarding@resend.dev>';

const stripOuterQuotes = (value = '') => {
  const trimmed = String(value).trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
};

const normalizeAuthSecret = (value = '') => stripOuterQuotes(value).replace(/\s+/g, '');
const isPlaceholderSecret = (value = '') => {
  const normalized = stripOuterQuotes(value).toLowerCase();
  return (
    !normalized ||
    normalized.includes('your_email_password_here') ||
    normalized.includes('your_gmail_app_password') ||
    normalized.includes('your_email')
  );
};

const isPlainEmail = (value = '') => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
const isNameEmailFormat = (value = '') => /^.+<[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>$/.test(value);

const resolveEmailFrom = () => {
  const configured = stripOuterQuotes(process.env.EMAIL_FROM || '');
  if (isPlainEmail(configured) || isNameEmailFormat(configured)) return configured;

  const userEmail = stripOuterQuotes(process.env.EMAIL_USER || '');
  if (isPlainEmail(userEmail)) return `PathToTech <${userEmail}>`;

  return DEFAULT_RESEND_FROM;
};

const EMAIL_FROM = resolveEmailFrom();

const getDomainFromEmailFrom = (value = '') => {
  const normalized = String(value).trim();
  const extracted = normalized.includes('<')
    ? normalized.slice(normalized.lastIndexOf('<') + 1, normalized.lastIndexOf('>'))
    : normalized;
  const atIndex = extracted.lastIndexOf('@');
  if (atIndex === -1) return '';
  return extracted.slice(atIndex + 1).toLowerCase();
};

const CONSUMER_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
]);

const EMAIL_FROM_DOMAIN = getDomainFromEmailFrom(EMAIL_FROM);
const RESEND_FROM = CONSUMER_EMAIL_DOMAINS.has(EMAIL_FROM_DOMAIN) ? DEFAULT_RESEND_FROM : EMAIL_FROM;

const createTransporter = ({ host, port, secure }) => nodemailer.createTransport({
  host,
  port,
  secure,
  auth: {
    user: stripOuterQuotes(process.env.EMAIL_USER || ''),
    pass: normalizeAuthSecret(process.env.EMAIL_PASS || ''),
  },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 20000,
  tls: {
    rejectUnauthorized: false,
  },
});

const transporter = createTransporter({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
});

const gmailSslFallbackTransporter = createTransporter({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
});

const sanitizeEmailError = (error) => ({
  message: error?.message,
  code: error?.code,
  command: error?.command,
  responseCode: error?.responseCode,
  response: error?.response,
  stack: error?.stack,
});

if (!HAS_RESEND_API_KEY && !HAS_GMAIL_API_CONFIG && !HAS_BREVO_API_KEY && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter.verify((error, success) => {
    if (error) {
      console.error('SMTP connection verify failed:', sanitizeEmailError(error));
      return;
    }

    if (success) {
      console.log('SMTP connection verified successfully.');
    }
  });
} else {
  console.warn('SMTP verify skipped: API provider is enabled or SMTP credentials are missing.');
}

if (HAS_RESEND_API_KEY) {
  console.log('Email delivery provider enabled: Resend API (HTTPS).');
  if (RESEND_FROM !== EMAIL_FROM) {
    console.warn(`Resend sender adjusted to ${DEFAULT_RESEND_FROM} because domain ${EMAIL_FROM_DOMAIN} is typically unverified.`);
  }
}

if (HAS_BREVO_API_KEY) {
  console.log('Email delivery provider enabled: Brevo API (HTTPS).');
}

if (HAS_GMAIL_API_CONFIG) {
  console.log('Email delivery provider enabled: Gmail API (HTTPS).');
}

const toBase64Url = (value) =>
  Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const buildRawMimeMessage = ({ from, to, subject, html }) => [
  `From: ${from}`,
  `To: ${to}`,
  `Subject: ${subject}`,
  'MIME-Version: 1.0',
  'Content-Type: text/html; charset=UTF-8',
  '',
  html,
].join('\r\n');

const sendViaGmailApi = async ({ to, subject, html }) => {
  const oauth2Client = new OAuth2Client(
    process.env.GMAIL_API_CLIENT_ID,
    process.env.GMAIL_API_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_API_REFRESH_TOKEN,
  });

  const tokenResponse = await oauth2Client.getAccessToken();
  const accessToken = tokenResponse?.token;

  if (!accessToken) {
    const tokenError = new Error('Gmail API access token is missing.');
    tokenError.code = 'GMAIL_API_TOKEN_MISSING';
    throw tokenError;
  }

  const rawMimeMessage = buildRawMimeMessage({
    from: `PathToTech <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: toBase64Url(rawMimeMessage),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const bodyText = await response.text();
      const error = new Error(`Gmail API request failed: ${response.status}`);
      error.code = 'GMAIL_API_HTTP_ERROR';
      error.responseCode = response.status;
      error.response = bodyText;
      throw error;
    }

    const payload = await response.json();
    return { provider: 'gmail_api', id: payload?.id };
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Gmail API timeout');
      timeoutError.code = 'ETIMEDOUT';
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const splitFromHeader = (fromHeader = '') => {
  const normalized = String(fromHeader || '').trim();
  const nameEmailMatch = normalized.match(/^(.*)<([^<>\s@]+@[^<>\s@]+\.[^<>\s@]+)>$/);

  if (nameEmailMatch) {
    const name = String(nameEmailMatch[1] || '').replace(/^"|"$/g, '').trim() || 'PathToTech';
    const email = String(nameEmailMatch[2] || '').trim();
    return { name, email };
  }

  if (isPlainEmail(normalized)) {
    return { name: 'PathToTech', email: normalized };
  }

  const fallbackEmail = isPlainEmail(stripOuterQuotes(process.env.EMAIL_USER || ''))
    ? stripOuterQuotes(process.env.EMAIL_USER || '')
    : 'no-reply@example.com';

  return { name: 'PathToTech', email: fallbackEmail };
};

const sendViaBrevo = async ({ to, subject, html }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const senderFromEnv = process.env.BREVO_SENDER_EMAIL
      ? `${process.env.BREVO_SENDER_NAME || 'PathToTech'} <${process.env.BREVO_SENDER_EMAIL}>`
      : EMAIL_FROM;
    const sender = splitFromHeader(senderFromEnv);

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender,
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const bodyText = await response.text();
      const error = new Error(`Brevo API request failed: ${response.status}`);
      error.code = 'BREVO_HTTP_ERROR';
      error.responseCode = response.status;
      error.response = bodyText;
      throw error;
    }

    const payload = await response.json();
    return { provider: 'brevo', id: payload?.messageId };
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Brevo API timeout');
      timeoutError.code = 'ETIMEDOUT';
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const sendViaResendRequest = async ({ from, to, subject, html, signal }) => {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
    }),
    signal,
  });

  if (!response.ok) {
    const bodyText = await response.text();
    const error = new Error(`Resend API request failed: ${response.status}`);
    error.code = 'RESEND_HTTP_ERROR';
    error.responseCode = response.status;
    error.response = bodyText;
    throw error;
  }

  return response.json();
};

const shouldRetryWithDefaultResendSender = (error, fromUsed) => {
  if (!error || error.code !== 'RESEND_HTTP_ERROR' || error.responseCode !== 403) return false;
  if (fromUsed === DEFAULT_RESEND_FROM) return false;

  const responseText = String(error.response || '').toLowerCase();
  return responseText.includes('domain is not verified');
};

const sendViaResend = async ({ to, subject, html }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    let payload;
    try {
      payload = await sendViaResendRequest({
        from: RESEND_FROM,
        to,
        subject,
        html,
        signal: controller.signal,
      });
    } catch (error) {
      if (!shouldRetryWithDefaultResendSender(error, RESEND_FROM)) throw error;

      console.warn('Resend rejected sender domain; retrying with default Resend sender.', {
        previousFrom: RESEND_FROM,
        fallbackFrom: DEFAULT_RESEND_FROM,
        responseCode: error.responseCode,
      });

      payload = await sendViaResendRequest({
        from: DEFAULT_RESEND_FROM,
        to,
        subject,
        html,
        signal: controller.signal,
      });
    }

    return { provider: 'resend', id: payload?.id };
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Resend API timeout');
      timeoutError.code = 'ETIMEDOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const sendOTPEmail = async (to, otp, fullName, subject = 'Email Verification') => {
  const mailOptions = {
    from: EMAIL_FROM,
    to,
    subject: `PathToTech - ${subject} OTP`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #800000; padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; letter-spacing: 2px;">PathToTech</h1>
          <p style="color: #ffcdd2; margin: 5px 0 0; font-size: 14px;">Employability Prediction System</p>
        </div>
        <div style="padding: 40px 30px; background-color: #ffffff;">
          <h2 style="color: #800000; margin-top: 0;">${subject}</h2>
          <p style="color: #444;">Hello <strong>${fullName}</strong>,</p>
          <p style="color: #444;">Use the OTP below to continue your request in PathToTech:</p>
          <div style="background-color: #fff8f8; border: 2px solid #800000; border-radius: 8px; padding: 25px; text-align: center; margin: 25px 0;">
            <p style="color: #800000; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 10px;">Your One-Time Password</p>
            <h1 style="color: #800000; letter-spacing: 14px; font-size: 40px; margin: 0; font-family: monospace;">${otp}</h1>
          </div>
          <p style="color: #666; font-size: 14px;">This OTP will expire in <strong>5 minutes</strong>.</p>
          <p style="color: #666; font-size: 14px;">If you did not initiate this login, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;" />
          <p style="color: #999; font-size: 12px; margin: 0;">Do not share this OTP with anyone. PathToTech staff will never ask for your OTP.</p>
        </div>
        <div style="background-color: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #eee;">
          <p style="color: #aaa; font-size: 12px; margin: 0;">PathToTech — Employability Prediction System</p>
          <p style="color: #aaa; font-size: 12px; margin: 5px 0 0;">Cavite State University • Computer Studies Department</p>
        </div>
      </div>
    `,
  };

  const hasSmtpCredentials =
    Boolean(stripOuterQuotes(process.env.EMAIL_USER || '')) &&
    !isPlaceholderSecret(process.env.EMAIL_PASS || '');
  const providerAttempts = [];

  if (HAS_GMAIL_API_CONFIG) {
    providerAttempts.push({
      name: 'gmail_api',
      send: () => sendViaGmailApi({
        to: mailOptions.to,
        subject: mailOptions.subject,
        html: mailOptions.html,
      }),
    });
  }

  if (HAS_BREVO_API_KEY) {
    providerAttempts.push({
      name: 'brevo',
      send: () => sendViaBrevo({
        to: mailOptions.to,
        subject: mailOptions.subject,
        html: mailOptions.html,
      }),
    });
  }

  if (HAS_RESEND_API_KEY) {
    providerAttempts.push({
      name: 'resend',
      send: () => sendViaResend({
        to: mailOptions.to,
        subject: mailOptions.subject,
        html: mailOptions.html,
      }),
    });
  }

  if (hasSmtpCredentials) {
    providerAttempts.push({
      name: 'smtp',
      send: async () => {
        try {
          return await transporter.sendMail(mailOptions);
        } catch (error) {
          const shouldRetryViaGmailSsl =
            error?.code === 'ETIMEDOUT' &&
            SMTP_HOST === 'smtp.gmail.com' &&
            SMTP_PORT !== 465;

          if (!shouldRetryViaGmailSsl) throw error;

          console.warn('Primary SMTP timed out. Retrying via Gmail SSL (465).', {
            code: error?.code,
            command: error?.command,
            host: SMTP_HOST,
            port: SMTP_PORT,
          });

          return gmailSslFallbackTransporter.sendMail(mailOptions);
        }
      },
    });
  }

  if (providerAttempts.length === 0) {
    const noProviderError = new Error('No configured email provider is available to send OTP.');
    noProviderError.code = 'EMAIL_PROVIDER_NOT_CONFIGURED';
    throw noProviderError;
  }

  const providerErrors = [];
  for (const attempt of providerAttempts) {
    try {
      const result = await attempt.send();
      if (result && typeof result === 'object' && !result.provider) {
        return { ...result, provider: attempt.name };
      }
      return result;
    } catch (error) {
      console.error(`[mailer] Provider ${attempt.name} failed`, sanitizeEmailError(error));
      providerErrors.push({
        provider: attempt.name,
        message: error?.message,
        code: error?.code,
        responseCode: error?.responseCode,
        response: error?.response,
      });
    }
  }

  const finalError = new Error('All configured email providers failed to send OTP.');
  finalError.code = 'EMAIL_ALL_PROVIDERS_FAILED';
  finalError.providerErrors = providerErrors;
  throw finalError;
};

module.exports = { transporter, sendOTPEmail };
