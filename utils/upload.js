import multer from "multer";
import path from "path";
import crypto from "crypto";
import { UPLOADS_ROOT, ensureDir } from "./paths.js";

// Allowed uploads are keyed by MIME type; the extension we store is derived from
// this table and NEVER from the (attacker controlled) original filename. That
// prevents both path traversal through the filename and uploading executable /
// HTML / SVG content that would later be served back from our own origin.
const IMAGE_TYPES = {
  "image/jpeg": ".jpg",
  "image/pjpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};

const GIF_TYPE = { "image/gif": ".gif" };
const PDF_TYPE = { "application/pdf": ".pdf" };

const ALLOWED_SOURCE_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf"
]);

/**
 * Build a hardened multer instance.
 *
 * @param {object}  options
 * @param {string}  options.subDir   Sub directory of /uploads to store files in.
 * @param {string}  options.prefix   Filename prefix (must be a fixed literal).
 * @param {boolean} options.allowPdf Accept application/pdf as well as images.
 * @param {boolean} options.allowGif Accept image/gif as well.
 * @param {number}  options.maxFiles Maximum number of files per request.
 */
export const createUploader = ({
  subDir = "",
  prefix = "file",
  allowPdf = false,
  allowGif = false,
  maxFiles = 11,
  maxFileSize = 5 * 1024 * 1024
} = {}) => {
  const allowedTypes = {
    ...IMAGE_TYPES,
    ...(allowGif ? GIF_TYPE : {}),
    ...(allowPdf ? PDF_TYPE : {})
  };

  const destination = path.join(UPLOADS_ROOT, subDir);

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      try {
        ensureDir(destination);
        cb(null, destination);
      } catch (error) {
        cb(error);
      }
    },
    filename: (req, file, cb) => {
      const extension = allowedTypes[file.mimetype];
      if (!extension) return cb(new Error("Unsupported file type"));
      const unique = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
      cb(null, `${prefix}-${unique}${extension}`);
    }
  });

  return multer({
    storage,
    limits: {
      fileSize: maxFileSize,
      files: maxFiles,
      fields: 50,
      fieldSize: 100 * 1024
    },
    fileFilter: (req, file, cb) => {
      const mimetype = (file.mimetype || "").toLowerCase().trim();
      const extension = path.extname(file.originalname || "").toLowerCase();

      if (!Object.prototype.hasOwnProperty.call(allowedTypes, mimetype)) {
        return cb(new Error(allowPdf ? "Only images and PDFs are allowed" : "Only images are allowed"));
      }
      // The declared extension must also be a known-safe one; the stored name
      // still uses the extension derived from the MIME type above.
      if (!ALLOWED_SOURCE_EXTENSIONS.has(extension)) {
        return cb(new Error(allowPdf ? "Only images and PDFs are allowed" : "Only images are allowed"));
      }
      cb(null, true);
    }
  });
};

export default createUploader;
