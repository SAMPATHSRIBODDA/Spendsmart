import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User, Budget, Expense, OTP } from "./db";
import { sendOTP, sendWelcomeEmail } from "./mailer";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "spendsmart_secret_key_for_jwt_tokens_123";

// Extend Request interface to include user
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

import { seedDemoDataForUser } from "./demoData";

// Seed Demo User
export async function seedDemoUser() {
  try {
    const demoEmail = "student@example.com";
    const existingUser = await User.findOne({ email: demoEmail });
    if (existingUser) {
      console.log("Demo user already exists. Skipping database seeding to preserve all data.");
      return;
    }

    console.log("No demo user found. Seeding pristine demo environment...");
    const passwordHash = await bcrypt.hash("Student@123", 10);
    const existing = await User.create({
      name: "Rahul Sharma",
      email: demoEmail,
      passwordHash,
    });
    console.log("Demo student Rahul Sharma seeded successfully (student@example.com / Student@123)");

    // Ensure the demo student has July 2026 budget and exact 41 expenses seeded
    await seedDemoDataForUser(existing._id);
  } catch (error) {
    console.error("Error seeding demo user:", error);
  }
}

// Authentication Middleware
export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Access denied. No token provided." });
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; name: string };
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token." });
  }
}

// Validation helpers
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isStrongPassword(password: string): boolean {
  if (password.length < 8) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/\d/.test(password)) return false;
  
  // Expanded special characters list
  const specialCharRegex = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`]/;
  return specialCharRegex.test(password);
}

// Helper to generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Request OTP for Login
router.post("/request-otp", async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;
  if (!email || !isValidEmail(email)) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(404).json({ error: "User not found. Please create an account first." });
      return;
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Clear old OTPs for this email
    await OTP.deleteMany({ email: email.toLowerCase() });

    await OTP.create({
      email: email.toLowerCase(),
      otp,
      type: "login",
      expiresAt,
    });

    await sendOTP(email.toLowerCase(), otp, "login");

    res.json({ message: "OTP sent successfully." });
  } catch (error) {
    console.error("Error requesting OTP:", error);
    res.status(500).json({ error: "An error occurred while requesting OTP." });
  }
});

// Request OTP for Signup
router.post("/signup-request", async (req: Request, res: Response): Promise<void> => {
  const { name, email, phone } = req.body;
  if (!name || !email || !isValidEmail(email)) {
    res.status(400).json({ error: "Name and a valid email are required." });
    return;
  }

  try {
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(400).json({ error: "An account with this email already exists." });
      return;
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Clear old OTPs for this email
    await OTP.deleteMany({ email: email.toLowerCase() });

    await OTP.create({
      email: email.toLowerCase(),
      otp,
      type: "signup",
      expiresAt,
      tempData: { name, phone },
    });

    await sendOTP(email.toLowerCase(), otp, "signup");

    res.json({ message: "OTP sent successfully." });
  } catch (error) {
    console.error("Error requesting signup OTP:", error);
    res.status(500).json({ error: "An error occurred while requesting OTP." });
  }
});

// Verify OTP (for both login and signup)
router.post("/verify-otp", async (req: Request, res: Response): Promise<void> => {
  const { email, otp, type } = req.body;
  if (!email || !otp || !type) {
    res.status(400).json({ error: "Email, OTP, and type are required." });
    return;
  }

  try {
    const otpRecord = await OTP.findOne({ email: email.toLowerCase(), otp, type });
    if (!otpRecord) {
      res.status(401).json({ error: "Invalid OTP." });
      return;
    }

    if (new Date(otpRecord.expiresAt) < new Date()) {
      res.status(401).json({ error: "OTP has expired. Please request a new one." });
      return;
    }

    let user;

    if (type === "signup") {
      // Create user
      const name = otpRecord.tempData?.name || "New User";
      const phone = otpRecord.tempData?.phone || "";
      
      user = await User.create({
        name,
        email: email.toLowerCase(),
        phone,
      });
      
      // Send welcome email in background
      sendWelcomeEmail(email.toLowerCase(), name).catch(err => console.error("Welcome email error:", err));
    } else {
      user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        res.status(404).json({ error: "User not found." });
        return;
      }
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Clean up used OTP
    await OTP.deleteOne({ _id: otpRecord._id });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ error: "An error occurred during verification." });
  }
});

// Get Me Route (token verification for persistence)
router.get("/me", authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({ user: req.user });
});

// Delete user account and all associated data
router.delete("/account", authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    // Delete all records linked to this user
    await Budget.deleteMany({ userId });
    await Expense.deleteMany({ userId });
    await User.deleteOne({ _id: userId });

    res.json({ message: "Account deleted successfully along with all transactions and budgets." });
  } catch (error) {
    console.error("Error deleting account:", error);
    res.status(500).json({ error: "An error occurred during account deletion." });
  }
});

export default router;
