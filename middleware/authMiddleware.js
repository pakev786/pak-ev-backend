import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Admin from "../models/Admin.js";
import { getJwtSecret, TOKEN_TYPES } from "../utils/generateToken.js";

const extractToken = (req) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    return null;
  }
};

/**
 * Tokens carry a "type" claim so a customer token can never be replayed against
 * an admin endpoint (and vice versa). Tokens issued before this claim existed are
 * still accepted, but they are always resolved against the collection the route
 * requires, so they cannot cross the privilege boundary either.
 */
const typeMatches = (decoded, expected) =>
  !decoded.type || decoded.type === expected;

export const protectUser = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ message: "Not authorized, no token" });

  const decoded = verifyToken(token);
  if (!decoded || !decoded.id || !typeMatches(decoded, TOKEN_TYPES.USER)) {
    return res.status(401).json({ message: "Not authorized, token failed" });
  }

  try {
    req.user = await User.findById(decoded.id).select("-password -otp");
    if (!req.user) {
      return res.status(401).json({ message: "Not authorized, user not found" });
    }
    return next();
  } catch {
    return res.status(401).json({ message: "Not authorized, token failed" });
  }
};

export const protectAdmin = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ message: "Not authorized, no token" });

  const decoded = verifyToken(token);
  if (!decoded || !decoded.id || !typeMatches(decoded, TOKEN_TYPES.ADMIN)) {
    return res.status(401).json({ message: "Not authorized as an admin" });
  }

  try {
    req.admin = await Admin.findById(decoded.id).select("-password");
    if (!req.admin) {
      return res.status(401).json({ message: "Not authorized as an admin" });
    }
    return next();
  } catch {
    return res.status(401).json({ message: "Not authorized, token failed" });
  }
};

export const superAdminOnly = (req, res, next) => {
  if (req.admin && req.admin.role === "superadmin") {
    return next();
  }
  return res.status(403).json({ message: "Not authorized, superadmin only" });
};

/**
 * Server side enforcement of the per-admin permission list. The React
 * <AdminRoute> guard only hides UI; without this check any admin account could
 * call any admin API directly.
 */
export const requirePermission = (...accepted) => (req, res, next) => {
  if (!req.admin) {
    return res.status(401).json({ message: "Not authorized as an admin" });
  }
  if (req.admin.role === "superadmin") return next();

  const permissions = Array.isArray(req.admin.permissions) ? req.admin.permissions : [];
  if (permissions.includes("all") || accepted.some((perm) => permissions.includes(perm))) {
    return next();
  }

  return res.status(403).json({ message: "Not authorized for this resource" });
};

export const protectUserOrAdmin = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ message: "Not authorized, no token" });

  const decoded = verifyToken(token);
  if (!decoded || !decoded.id) {
    return res.status(401).json({ message: "Not authorized, token failed" });
  }

  try {
    if (!decoded.type || decoded.type === TOKEN_TYPES.ADMIN) {
      req.admin = await Admin.findById(decoded.id).select("-password");
      if (req.admin) return next();
    }

    if (!decoded.type || decoded.type === TOKEN_TYPES.USER) {
      req.user = await User.findById(decoded.id).select("-password -otp");
      if (req.user) return next();
    }

    return res.status(401).json({ message: "Not authorized, account not found" });
  } catch {
    return res.status(401).json({ message: "Not authorized, token failed" });
  }
};

/** True when the authenticated caller owns the given user id (admins own everything). */
export const canAccessUserData = (req, userId) => {
  if (req.admin) return true;
  return Boolean(req.user && String(req.user._id) === String(userId));
};
