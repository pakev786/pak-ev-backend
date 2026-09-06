/**
 * Strips MongoDB operator keys ($gt, $ne, $where, ...) and dotted paths out of
 * request payloads. Without this, a JSON body such as { "email": { "$ne": null } }
 * turns an equality lookup into "any document", which is the classic NoSQL
 * injection primitive against Mongoose queries.
 */
const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const sanitizeValue = (value, depth = 0) => {
  if (depth > 10) return undefined;

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry, depth + 1));
  }

  if (isPlainObject(value)) {
    for (const key of Object.keys(value)) {
      if (key.startsWith("$") || key.includes(".") || key === "__proto__" || key === "constructor" || key === "prototype") {
        delete value[key];
        continue;
      }
      const sanitized = sanitizeValue(value[key], depth + 1);
      if (sanitized === undefined && value[key] !== undefined) {
        delete value[key];
      } else {
        value[key] = sanitized;
      }
    }
    return value;
  }

  return value;
};

export const sanitizeRequest = (req, res, next) => {
  if (req.body) sanitizeValue(req.body);
  if (req.params) sanitizeValue(req.params);
  next();
};

export default sanitizeRequest;
