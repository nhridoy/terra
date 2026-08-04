export type FileKind =
  | "code"
  | "markdown"
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "binary";

export type DualModeKind = "svg" | "markdown" | null;

export function dualModeFor(path: string): DualModeKind {
  const name = path.split(/[\\/]/).pop() ?? "";
  if (!name.includes(".")) return null;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "svg") return "svg";
  if (ext === "md" || ext === "markdown") return "markdown";
  return null;
}

export function isDualModePath(path: string): boolean {
  return dualModeFor(path) !== null;
}

const IMAGE_EXTS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp",
  "ico",
  "avif",
  "tiff",
  "tif",
]);

const VIDEO_EXTS = new Set([
  "mp4",
  "webm",
  "mkv",
  "mov",
  "avi",
  "m4v",
  "ogv",
  "wmv",
  "flv",
]);

const AUDIO_EXTS = new Set([
  "mp3",
  "wav",
  "ogg",
  "flac",
  "m4a",
  "aac",
  "opus",
  "wma",
]);

const BINARY_EXTS = new Set([
  "zip",
  "tar",
  "gz",
  "7z",
  "rar",
  "bz2",
  "xz",
  "exe",
  "msi",
  "dll",
  "so",
  "dylib",
  "iso",
  "bin",
  "dat",
  "dmg",
  "deb",
  "rpm",
  "apk",
  "jar",
  "class",
  "pyc",
  "obj",
  "o",
  "a",
  "lib",
  "pdf",
]);

export function classifyFilePath(filePath: string): FileKind {
  const name = filePath.split(/[\\/]/).pop() ?? "";
  if (!name.includes(".")) return "code";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (IMAGE_EXTS.has(ext)) return "image";
  if (VIDEO_EXTS.has(ext)) return "video";
  if (AUDIO_EXTS.has(ext)) return "audio";
  if (BINARY_EXTS.has(ext)) return "binary";
  return "code";
}
