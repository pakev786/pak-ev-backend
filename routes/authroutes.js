import express from "express";
import nodemailer from "nodemailer";
import axios from "axios";
import crypto from "crypto";
import User from "../models/User.js";
import generateToken, { TOKEN_TYPES } from "../utils/generateToken.js";
import { rateLimit } from "../middleware/rateLimit.js";
import {
  isNonEmptyString,
  isValidEmail,
  normalizeEmail,
  isAcceptablePassword,
  isValidOtpFormat,
  safeCompare,
  generateNumericOtp,
  MIN_PASSWORD_LENGTH
} from "../utils/validate.js";

const router = express.Router();

const OTP_TTL_MS = 10 * 60 * 1000; // codes are valid for 10 minutes
const MAX_OTP_ATTEMPTS = 5;

const hashOtp = (otp) => crypto.createHash("sha256").update(String(otp)).digest("hex");

const setOtp = (user) => {
  const otp = generateNumericOtp();
  user.otp = hashOtp(otp);
  user.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  user.otpAttempts = 0;
  return otp;
};

const clearOtp = (user) => {
  user.otp = null;
  user.otpExpiresAt = null;
  user.otpAttempts = 0;
};

/**
 * Validates a submitted OTP. A stored value of null (freshly created account,
 * already-consumed code) must never match, otherwise sending `"otp": null`
 * verifies or resets somebody else's account.
 */
const verifyOtp = async (user, submittedOtp) => {
  if (!isValidOtpFormat(submittedOtp)) return { ok: false, message: "Invalid or expired code" };
  if (!isNonEmptyString(user.otp) || !user.otpExpiresAt) {
    return { ok: false, message: "Invalid or expired code" };
  }
  if (user.otpExpiresAt.getTime() < Date.now()) {
    clearOtp(user);
    await user.save();
    return { ok: false, message: "Invalid or expired code" };
  }
  if ((user.otpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
    clearOtp(user);
    await user.save();
    return { ok: false, message: "Too many attempts. Request a new code." };
  }
  if (!safeCompare(hashOtp(submittedOtp), user.otp)) {
    user.otpAttempts = (user.otpAttempts || 0) + 1;
    await user.save();
    return { ok: false, message: "Invalid or expired code" };
  }
  return { ok: true };
};

// Fetch the Google profile AND confirm the access token was minted for *our*
// OAuth client. Without the audience check any site could take an access token
// issued to itself and use it to sign in as that user here.
const getGoogleUser = async (accessToken) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }

  const { data: tokenInfo } = await axios.get("https://oauth2.googleapis.com/tokeninfo", {
    params: { access_token: accessToken },
    timeout: 8000
  });

  if (tokenInfo.aud !== clientId) {
    throw new Error("Access token was not issued for this application");
  }

  const { data: profile } = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 8000
  });

  if (!profile.email || profile.email_verified === false) {
    throw new Error("Google account has no verified email address");
  }

  return profile;
};

const sendEmailOTP = async (email, otp) => {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    console.error("❌ Email Error: Missing .env credentials (EMAIL_USER or EMAIL_PASS).");
    // Never print the code outside development: server logs are frequently
    // readable by more people than the mailbox owner.
    if (process.env.NODE_ENV !== "production") {
      console.log(`>>> ⚠️ FALLBACK (Console OTP): ${otp} <<<`);
    }
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: emailUser, pass: emailPass }
  });

  const mailOptions = {
    from: emailUser,
    to: email,
    subject: "Pak EV - Verification Code",
    text: `Your verification code is: ${otp}. It expires in 10 minutes. Do not share this code with anyone.`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${email}`);
    return true;
  } catch (error) {
    console.error("❌ Email Send Failed:", error.message);
    if (error.code === "EAUTH") {
      console.error("   -> Hint: Check your Gmail App Password and ensure EMAIL_USER is correct.");
    }
    if (process.env.NODE_ENV !== "production") {
      console.log(`>>> ⚠️ FALLBACK (Console OTP): ${otp} <<<`);
    }
    return false;
  }
};

const errorPayload = (error) =>
  process.env.NODE_ENV === "production" ? "Internal Server Error" : error.message;

// Brute force / mail bomb protection. Each endpoint is limited twice: a roomy
// per-IP budget (so a shared office/NAT address is not locked out by one user)
// and a tight per-account budget (so a single account cannot be hammered).
const TOO_MANY = "Too many attempts. Please try again in a few minutes.";
const byEmail = (req) => normalizeEmail(req.body?.email) || "unknown";

const authLimiter = [
  rateLimit({ name: "auth-login-ip", windowMs: 15 * 60 * 1000, max: 40, message: TOO_MANY }),
  rateLimit({ name: "auth-login-account", windowMs: 15 * 60 * 1000, max: 10, message: TOO_MANY, keyGenerator: byEmail })
];
const otpRequestLimiter = [
  rateLimit({ name: "auth-otp-request-ip", windowMs: 15 * 60 * 1000, max: 20, message: "Too many verification codes requested. Please try again later." }),
  rateLimit({ name: "auth-otp-request-account", windowMs: 15 * 60 * 1000, max: 5, message: "Too many verification codes requested. Please try again later.", keyGenerator: byEmail })
];
const otpVerifyLimiter = [
  rateLimit({ name: "auth-otp-verify-ip", windowMs: 15 * 60 * 1000, max: 40, message: TOO_MANY }),
  rateLimit({ name: "auth-otp-verify-account", windowMs: 15 * 60 * 1000, max: 10, message: TOO_MANY, keyGenerator: byEmail })
];

// POST /api/auth/register
router.post("/register", otpRequestLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!isNonEmptyString(name) || !isValidEmail(email) || typeof password !== "string") {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (name.trim().length > 80) {
      return res.status(400).json({ message: "Name is too long" });
    }
    if (!isAcceptablePassword(password)) {
      return res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    const normalizedEmail = normalizeEmail(email);
    let user = await User.findOne({ email: normalizedEmail });

    if (user && user.isVerified) {
      return res.status(400).json({ message: "User already exists" });
    }

    if (user && !user.isVerified) {
      user.name = name.trim();
      user.password = password;
    } else {
      user = new User({ name: name.trim(), email: normalizedEmail, password });
    }

    const otp = setOtp(user);
    await user.save();
    await sendEmailOTP(normalizedEmail, otp);

    res.status(201).json({ message: "OTP sent to your email" });
  } catch (error) {
    res.status(500).json({ message: "Registration failed", error: errorPayload(error) });
  }
});

// POST /api/auth/verify-otp
router.post("/verify-otp", otpVerifyLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!isValidEmail(email) || !isValidOtpFormat(otp)) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user) return res.status(400).json({ message: "Invalid or expired code" });

    const result = await verifyOtp(user, otp);
    if (!result.ok) return res.status(400).json({ message: result.message });

    user.isVerified = true;
    clearOtp(user);
    await user.save();

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      token: generateToken(user._id, TOKEN_TYPES.USER)
    });
  } catch (error) {
    res.status(500).json({ message: "Verification failed", error: errorPayload(error) });
  }
});

// POST /api/auth/login
router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!isValidEmail(email) || typeof password !== "string" || password.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = await User.findOne({ email: normalizeEmail(email) });
    // Same response for "no such user" and "wrong password" so the endpoint
    // cannot be used to enumerate registered accounts.
    if (!user || typeof user.password !== "string") {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    if (!user.isVerified) return res.status(400).json({ message: "Account not verified" });

    let isMatch = false;
    if (user.password.startsWith("$2a$") || user.password.startsWith("$2b$") || user.password.startsWith("$2y$")) {
      isMatch = await user.matchPassword(password);
    } else {
      // Legacy plaintext record: verify in constant time, then migrate to bcrypt.
      isMatch = safeCompare(user.password, password);
      if (isMatch) {
        user.password = password;
        await user.save();
      }
    }

    if (!isMatch) return res.status(401).json({ message: "Invalid email or password" });

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      token: generateToken(user._id, TOKEN_TYPES.USER)
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: errorPayload(error) });
  }
});

// POST: Forgot Password
router.post("/forgot-password", otpRequestLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "A valid email address is required" });
    }

    const user = await User.findOne({ email: normalizeEmail(email) });

    // Always answer the same way, so this endpoint does not disclose which
    // addresses are registered.
    if (user) {
      const otp = setOtp(user);
      await user.save();
      await sendEmailOTP(user.email, otp);
    }

    res.json({ message: "If that email is registered, a verification code has been sent." });
  } catch (error) {
    res.status(500).json({ message: "Failed to process request", error: errorPayload(error) });
  }
});

// POST: Reset Password
router.post("/reset-password", otpVerifyLimiter, async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!isValidEmail(email) || !isValidOtpFormat(otp)) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }
    if (!isAcceptablePassword(newPassword)) {
      return res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user) return res.status(400).json({ message: "Invalid or expired code" });

    const result = await verifyOtp(user, otp);
    if (!result.ok) return res.status(400).json({ message: result.message });

    user.password = newPassword;
    user.isVerified = true;
    clearOtp(user);
    await user.save();

    res.json({ message: "Password reset successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to reset password", error: errorPayload(error) });
  }
});

// POST: Google Login
router.post("/google", authLimiter, async (req, res) => {
  try {
    const { access_token } = req.body;
    if (!isNonEmptyString(access_token)) {
      return res.status(400).json({ message: "Access token is required" });
    }

    const googleUser = await getGoogleUser(access_token);
    const { name, email, sub } = googleUser;
    const normalizedEmail = normalizeEmail(email);

    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      // Google users never sign in with this password; make it unguessable.
      const randomPassword = crypto.randomBytes(32).toString("hex") + String(sub).slice(-6);
      user = new User({
        name: isNonEmptyString(name) ? name.trim().slice(0, 80) : "Google User",
        email: normalizedEmail,
        password: randomPassword,
        isVerified: true
      });
      await user.save();
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      token: generateToken(user._id, TOKEN_TYPES.USER)
    });
  } catch (error) {
    console.error("Google Auth Error:", error.response?.data || error.message);
    res.status(401).json({ message: "Google auth failed" });
  }
});

export default router;
