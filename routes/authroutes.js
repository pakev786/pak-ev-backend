import express from "express";
import nodemailer from "nodemailer";
import axios from "axios";
import User from "../models/User.js";

const router = express.Router();

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Helper to get user info from Google
const getGoogleUser = async (accessToken) => {
    try {
        const { data } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        return data;
    } catch (error) {
        console.error("Error fetching Google user:", error);
        throw new Error("Invalid access token");
    }
};

const sendEmailOTP = async (email, otp) => {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    console.error("❌ Email Error: Missing .env credentials (EMAIL_USER or EMAIL_PASS).");
    console.log(`>>> ⚠️ FALLBACK (Console OTP): ${otp} <<<`);
    return true; 
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: emailPass
    }
  });

  const mailOptions = {
    from: emailUser,
    to: email,
    subject: 'Pak EV - Verification Code',
    text: `Your verification code is: ${otp}. Do not share this code with anyone.`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${email}`);
    return true;
  } catch (error) {
    console.error("❌ Email Send Failed:", error.message);
    if (error.code === 'EAUTH') {
        console.error("   -> Hint: Check your Gmail App Password and ensure EMAIL_USER is correct.");
    }
    console.log(`>>> ⚠️ FALLBACK (Console OTP): ${otp} <<<`);
    return true;
  }
};

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    let user = await User.findOne({ email });
    
    if (user && user.isVerified) {
      return res.status(400).json({ message: "User already exists" });
    }

    const otp = generateOTP();
    await sendEmailOTP(email, otp);
    
    if (user && !user.isVerified) {
      user.name = name;
      user.password = password; 
      user.otp = otp;
      await user.save();
    } else {
      user = new User({ name, email, password, otp });
      await user.save();
    }

    res.status(201).json({ message: "OTP sent to your email" });

  } catch (error) {
    res.status(500).json({ message: "Registration failed", error: error.message });
  }
});

// POST /api/auth/verify-otp
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.otp !== otp) return res.status(400).json({ message: "Invalid OTP" });

    user.isVerified = true;
    user.otp = null; 
    await user.save();

    res.json({ 
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      token: "simulated-jwt-token" 
    });

  } catch (error) {
    res.status(500).json({ message: "Verification failed", error: error.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.isVerified) return res.status(400).json({ message: "Account not verified" });
    if (user.password !== password) return res.status(401).json({ message: "Invalid password" });

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      token: "simulated-jwt-token"
    });

  } catch (error) {
    res.status(500).json({ message: "Login failed", error: error.message });
  }
});

// POST: Forgot Password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: "Email not registered" });

    const otp = generateOTP();
    user.otp = otp;
    await user.save();

    await sendEmailOTP(email, otp);
    res.json({ message: "OTP sent to email" });

  } catch (error) {
    res.status(500).json({ message: "Failed to process request", error: error.message });
  }
});

// POST: Reset Password
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.otp !== otp) return res.status(400).json({ message: "Invalid OTP" });

    user.password = newPassword;
    user.otp = null;
    await user.save();

    res.json({ message: "Password reset successfully" });

  } catch (error) {
    res.status(500).json({ message: "Failed to reset password", error: error.message });
  }
});

// POST: Google Login
router.post("/google", async (req, res) => {
  try {
    const { access_token } = req.body;
    
    // Verify token with Google
    const googleUser = await getGoogleUser(access_token);
    const { name, email, sub } = googleUser; // sub is googleId

    let user = await User.findOne({ email });

    if (!user) {
      // Create new user (automatically verified)
      user = new User({
        name: name || "Google User",
        email,
        password: `google_${sub}`, // Dummy pass
        isVerified: true
      });
      await user.save();
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      token: "simulated-jwt-token"
    });

  } catch (error) {
    console.error("Google Auth Error:", error.response?.data || error.message);
    res.status(500).json({ message: "Google auth failed", error: error.message });
  }
});

export default router;