import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Resolve everything relative to the backend package root instead of process.cwd(),
// so uploads always land in (and are served from) the same directory regardless of
// where the process was started from.
const __filename = fileURLToPath(import.meta.url);
export const ROOT_DIR = path.dirname(path.dirname(__filename));
export const UPLOADS_ROOT = path.join(ROOT_DIR, "uploads");

export const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

/**
 * Turn a stored public path such as "/uploads/orders/foo.jpg" into an absolute
 * path, guaranteeing the result stays inside UPLOADS_ROOT. Returns null when the
 * value is not a safe path inside the uploads directory.
 */
export const resolveUploadPath = (publicPath) => {
  if (!publicPath || typeof publicPath !== "string") return null;

  let relative = publicPath.split("?")[0].split("#")[0];
  try {
    relative = decodeURIComponent(relative);
  } catch {
    return null;
  }
  relative = relative.split("\\").join("/");
  if (relative.startsWith("/")) relative = relative.slice(1);
  if (relative.startsWith("uploads/")) relative = relative.slice("uploads/".length);

  const fullPath = path.resolve(UPLOADS_ROOT, relative);
  const containedIn = UPLOADS_ROOT.endsWith(path.sep) ? UPLOADS_ROOT : UPLOADS_ROOT + path.sep;
  if (fullPath !== UPLOADS_ROOT && !fullPath.startsWith(containedIn)) return null;

  return fullPath;
};

/** Delete a stored upload, ignoring anything that escapes the uploads directory. */
export const safeDeleteUpload = (publicPath) => {
  const fullPath = resolveUploadPath(publicPath);
  if (!fullPath) return false;
  try {
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      fs.unlinkSync(fullPath);
      return true;
    }
  } catch (error) {
    console.error("Failed to delete upload:", error.message);
  }
  return false;
};

/** Best-effort cleanup for a freshly uploaded multer file (never throws). */
export const removeTempFile = (file) => {
  if (!file || !file.path) return;
  try {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
  } catch (error) {
    console.error("Failed to remove temp upload:", error.message);
  }
};
