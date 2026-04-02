const crypto = require('crypto');

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute
const MAX_VERIFY_ATTEMPTS = 5;

const otpStore = new Map();
const resetTokenStore = new Map();

const hashOtp = (otp) =>
  crypto.createHash('sha256').update(String(otp)).digest('hex');

const cleanupExpired = () => {
  const now = Date.now();

  for (const [email, record] of otpStore.entries()) {
    if (!record || record.expiresAt <= now) {
      otpStore.delete(email);
    }
  }

  for (const [token, record] of resetTokenStore.entries()) {
    if (!record || record.expiresAt <= now) {
      resetTokenStore.delete(token);
    }
  }
};

setInterval(cleanupExpired, 60 * 1000).unref();

const normalizeEmail = (email = '') => String(email).trim().toLowerCase();

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const canResendOtp = (email) => {
  const normalizedEmail = normalizeEmail(email);
  const record = otpStore.get(normalizedEmail);

  if (!record) {
    return { allowed: true, retryAfterMs: 0 };
  }

  const waitMs = record.lastSentAt + RESEND_COOLDOWN_MS - Date.now();
  if (waitMs > 0) {
    return { allowed: false, retryAfterMs: waitMs };
  }

  return { allowed: true, retryAfterMs: 0 };
};

const createOtp = (email) => {
  const normalizedEmail = normalizeEmail(email);
  const otp = generateOtp();
  const now = Date.now();

  otpStore.set(normalizedEmail, {
    otpHash: hashOtp(otp),
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    lastSentAt: now,
  });

  return {
    otp,
    expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
  };
};

const clearOtp = (email) => {
  const normalizedEmail = normalizeEmail(email);
  otpStore.delete(normalizedEmail);
};

const verifyOtp = (email, otp) => {
  const normalizedEmail = normalizeEmail(email);
  const record = otpStore.get(normalizedEmail);

  if (!record) {
    return { valid: false, reason: 'OTP_NOT_FOUND' };
  }

  if (record.expiresAt <= Date.now()) {
    otpStore.delete(normalizedEmail);
    return { valid: false, reason: 'OTP_EXPIRED' };
  }

  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    otpStore.delete(normalizedEmail);
    return { valid: false, reason: 'TOO_MANY_ATTEMPTS' };
  }

  if (record.otpHash !== hashOtp(otp)) {
    record.attempts += 1;
    otpStore.set(normalizedEmail, record);
    return { valid: false, reason: 'OTP_INVALID' };
  }

  const resetToken = crypto.randomBytes(24).toString('hex');
  resetTokenStore.set(resetToken, {
    email: normalizedEmail,
    expiresAt: Date.now() + RESET_TOKEN_TTL_MS,
  });

  otpStore.delete(normalizedEmail);

  return {
    valid: true,
    resetToken,
    resetTokenExpiresInSeconds: Math.floor(RESET_TOKEN_TTL_MS / 1000),
  };
};

const consumeResetToken = (email, resetToken) => {
  const normalizedEmail = normalizeEmail(email);
  const token = String(resetToken || '');
  const record = resetTokenStore.get(token);

  if (!record) {
    return { valid: false, reason: 'TOKEN_NOT_FOUND' };
  }

  if (record.expiresAt <= Date.now()) {
    resetTokenStore.delete(token);
    return { valid: false, reason: 'TOKEN_EXPIRED' };
  }

  if (record.email !== normalizedEmail) {
    return { valid: false, reason: 'TOKEN_EMAIL_MISMATCH' };
  }

  resetTokenStore.delete(token);
  return { valid: true };
};

module.exports = {
  canResendOtp,
  createOtp,
  clearOtp,
  verifyOtp,
  consumeResetToken,
  normalizeEmail,
};
