import mongoose from "mongoose";
import crypto from "crypto";

/** Only plain, non-empty strings pass. Rejects objects such as { "$ne": null }. */
export const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

export const asString = (value) => (typeof value === "string" ? value.trim() : "");

export const isValidObjectId = (value) =>
  typeof value === "string" && mongoose.Types.ObjectId.isValid(value) && String(new mongoose.Types.ObjectId(value)) === value;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const isValidEmail = (value) =>
  isNonEmptyString(value) && value.trim().length <= 254 && EMAIL_REGEX.test(value.trim());

export const normalizeEmail = (value) => asString(value).toLowerCase();

export const MIN_PASSWORD_LENGTH = 8;

export const isAcceptablePassword = (value) =>
  typeof value === "string" && value.length >= MIN_PASSWORD_LENGTH && value.length <= 128;

/** Six digit numeric one time codes only. */
export const isValidOtpFormat = (value) =>
  typeof value === "string" && /^\d{6}$/.test(value);

/** Constant time comparison that never throws on odd input. */
export const safeCompare = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

/** Cryptographically strong six digit code (Math.random is predictable). */
export const generateNumericOtp = () => String(crypto.randomInt(0, 1000000)).padStart(6, "0");

export const toFiniteNumber = (value) => {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
};

/** Escape a user supplied string before embedding it in a RegExp. */
export const escapeRegex = (value) => asString(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
