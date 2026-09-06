import jwt from "jsonwebtoken";

/**
 * The signing secret must be supplied by the environment. A hard coded fallback
 * would let anyone who has read the source mint valid admin tokens.
 */
export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET is missing or too short (min 32 characters). Set it in the environment before starting the server."
    );
  }
  return secret;
};

export const TOKEN_TYPES = { USER: "user", ADMIN: "admin" };

const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

const generateToken = (id, type = TOKEN_TYPES.USER) => {
  return jwt.sign({ id: String(id), type }, getJwtSecret(), {
    expiresIn: EXPIRES_IN
  });
};

export default generateToken;
