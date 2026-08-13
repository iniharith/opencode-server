const archiver = require("archiver");
const express = require("express");
const fs = require("fs");
const fsp = require("fs/promises");
const multer = require("multer");
const os = require("os");
const path = require("path");
const { Transform } = require("stream");
const { pipeline } = require("stream/promises");
const unzipper = require("unzipper");

const PROJECTS_DIR = path.resolve(process.env.PROJECTS_DIR || os.homedir());
const MAX_UPLOAD_BYTES = Number(process.env.MAX_PROJECT_UPLOAD_MB || 100) * 1024 * 1024;
const MAX_EXTRACTED_BYTES = Number(process.env.MAX_PROJECT_EXTRACTED_MB || 500) * 1024 * 1024;
const MAX_FILES = Number(process.env.MAX_PROJECT_FILES || 10000);
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    callback(null, file.originalname.toLowerCase().endsWith(".zip"));
  },
});

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function validProjectName(value) {
  const name = String(value || "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(name)) return null;
  return name;
}

function safeProjectPath(name) {
  const valid = validProjectName(name);
  if (!valid) return null;
  const target = path.resolve(PROJECTS_DIR, valid);
  if (path.dirname(target) !== PROJECTS_DIR) return null;
  return target;
}

async function listProjects() {
  const entries = await fsp.readdir(PROJECTS_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function zipEntryPath(entryPath) {
  const normalized = entryPath.replaceAll("\\", "/").replace(/^\.\//, "");
  if (!normalized || normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized)) return null;
  const segments = normalized.split("/").filter(Boolean);
  if (!segments.length || segments.some((segment) => segment === ".." || segment.includes("\0"))) return null;
  return segments;
}

function isSymlink(entry) {
  const mode = (entry.externalFileAttributes >>> 16) & 0o170000;
  return mode === 0o120000;
}

async function extractProject(zipPath, projectName) {
  const destination = safeProjectPath(projectName);
  if (!destination) throw new Error("Use only letters, numbers, dots, dashes, or underscores in the project name.");

  try {
    await fsp.access(destination);
    throw new Error("A project with that name already exists. Choose another name.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const archive = await unzipper.Open.file(zipPath);
  if (!archive.files.length) throw new Error("The ZIP archive is empty.");
  if (archive.files.length > MAX_FILES) throw new Error(`The ZIP contains more than ${MAX_FILES} entries.`);

  let extractedBytes = 0;
  const entries = archive.files.map((entry) => {
    const segments = zipEntryPath(entry.path);
    if (!segments) throw new Error(`Unsafe ZIP path: ${entry.path}`);
    if (isSymlink(entry)) throw new Error(`Symbolic links are not allowed: ${entry.path}`);
    extractedBytes += Number(entry.uncompressedSize || 0);
    return { entry, segments };
  });
  if (extractedBytes > MAX_EXTRACTED_BYTES) {
    throw new Error(`Extracted project exceeds ${Math.floor(MAX_EXTRACTED_BYTES / 1024 / 1024)} MB.`);
  }

  const roots = new Set(entries.map(({ segments }) => segments[0]));
  const stripRoot = roots.size === 1 && entries.some(({ segments }) => segments.length > 1);
  await fsp.mkdir(destination, { recursive: false });

  try {
    let streamedBytes = 0;
    for (const { entry, segments } of entries) {
      const relative = (stripRoot ? segments.slice(1) : segments).join(path.sep);
      if (!relative) continue;
      const outputPath = path.resolve(destination, relative);
      if (!outputPath.startsWith(destination + path.sep)) throw new Error(`Unsafe ZIP path: ${entry.path}`);
      if (entry.type === "Directory") {
        await fsp.mkdir(outputPath, { recursive: true });
        continue;
      }
      if (entry.type !== "File") throw new Error(`Unsupported ZIP entry: ${entry.path}`);
      await fsp.mkdir(path.dirname(outputPath), { recursive: true });
      const limit = new Transform({
        transform(chunk, _encoding, callback) {
          streamedBytes += chunk.length;
          if (streamedBytes > MAX_EXTRACTED_BYTES) {
            return callback(new Error(`Extracted project exceeds ${Math.floor(MAX_EXTRACTED_BYTES / 1024 / 1024)} MB.`));
          }
          callback(null, chunk);
        },
      });
      await pipeline(entry.stream(), limit, fs.createWriteStream(outputPath, { flags: "wx", mode: 0o644 }));
    }
  } catch (error) {
    await fsp.rm(destination, { recursive: true, force: true });
    throw error;
  }
}

function renderPage({ projects, message = "", error = "" }) {
  const rows = projects.length
    ? projects.map((name) => `<li><span>${escapeHtml(name)}</span><a href="/mobile-projects/${encodeURIComponent(name)}.zip">DOWNLOAD ZIP ↓</a></li>`).join("")
    : "<li class=empty>No projects available yet.</li>";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#c7ff16"><title>Mobile Projects — OpenCode</title><style>
:root{--ink:#0a0a0a;--acid:#c7ff16;--paper:#f1f0ea;--muted:#999}*{box-sizing:border-box}body{margin:0;background:var(--ink);color:var(--paper);font-family:Arial,sans-serif;padding:24px;min-height:100svh}main{max-width:880px;margin:auto}header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #444;padding:10px 0 24px;font:12px monospace;letter-spacing:.08em;color:var(--acid)}h1{font-size:clamp(52px,14vw,130px);line-height:.8;letter-spacing:-.08em;margin:70px 0 30px}p{max-width:620px;font-size:17px;line-height:1.5;color:#bbb}.panel{margin:60px 0;padding:22px;border:1px solid #555;background:#171717}.panel h2{margin:0 0 24px;font-size:28px;letter-spacing:-.04em}label{display:block;margin:18px 0 7px;font:11px monospace;letter-spacing:.08em}input{width:100%;padding:14px;border:1px solid #555;background:var(--ink);color:white;font-size:16px}input:focus{outline:1px solid var(--acid)}button{width:100%;margin-top:22px;padding:16px;border:0;background:var(--acid);font-weight:bold;font-size:15px}.notice{padding:14px;margin-top:20px;font:13px monospace}.success{color:var(--acid);border:1px solid var(--acid)}.error{color:#ff7777;border:1px solid #ff7777}h2.list-title{margin-top:80px;font-size:13px;font-family:monospace;letter-spacing:.08em}ul{padding:0;list-style:none;border-top:1px solid #555}li{display:flex;justify-content:space-between;align-items:center;gap:20px;min-height:72px;border-bottom:1px solid #555}li span{font-size:clamp(21px,5vw,34px);letter-spacing:-.04em}li a{color:var(--acid);font:11px monospace;white-space:nowrap}.empty{color:var(--muted);font:14px monospace}.back{display:inline-block;margin:65px 0 30px;color:var(--acid);font:12px monospace}@media(max-width:550px){body{padding:16px}.panel{margin-top:45px;padding:16px}li{align-items:flex-start;flex-direction:column;padding:18px 0;gap:10px}}
</style></head><body><main><header><span>OPENCODE / ANDROID</span><span>PRIVATE WORKSPACE</span></header><h1>MOBILE<br>PROJECTS</h1><p>Upload a project ZIP from Android Documents or Downloads. Open it by name in OpenCode Mobile, make your changes, then return here to download the updated ZIP.</p><section class="panel"><h2>Upload a project</h2><form method="post" action="/mobile-projects/upload" enctype="multipart/form-data"><label for="name">PROJECT NAME</label><input id="name" name="name" maxlength="80" pattern="[A-Za-z0-9][A-Za-z0-9._-]*" placeholder="my-project" required><label for="project">ZIP FILE</label><input id="project" name="project" type="file" accept=".zip,application/zip" required><button type="submit">UPLOAD & EXTRACT</button></form>${message ? `<div class="notice success">${escapeHtml(message)}</div>` : ""}${error ? `<div class="notice error">${escapeHtml(error)}</div>` : ""}</section><h2 class="list-title">AVAILABLE PROJECTS / ${projects.length}</h2><ul>${rows}</ul><a class="back" href="/">← BACK TO OPENCODE</a></main></body></html>`;
}

function registerProjectManager(app) {
  const router = express.Router();

  router.get("/", async (req, res, next) => {
    try {
      res.send(renderPage({ projects: await listProjects(), message: req.query.message, error: req.query.error }));
    } catch (error) {
      next(error);
    }
  });

  router.post("/upload", upload.single("project"), async (req, res) => {
    try {
      if (!req.file) throw new Error("Select a valid ZIP file.");
      await extractProject(req.file.path, req.body.name);
      res.redirect(`/mobile-projects?message=${encodeURIComponent(`${req.body.name} is ready in OpenCode.`)}`);
    } catch (error) {
      res.redirect(`/mobile-projects?error=${encodeURIComponent(error.message || "Upload failed.")}`);
    } finally {
      if (req.file) await fsp.rm(req.file.path, { force: true }).catch(() => {});
    }
  });

  router.get("/:name.zip", async (req, res, next) => {
    const source = safeProjectPath(req.params.name);
    if (!source) return res.status(400).send("Invalid project name.");
    try {
      if (!(await fsp.stat(source)).isDirectory()) return res.status(404).send("Project not found.");
      res.attachment(`${req.params.name}.zip`);
      const archive = archiver("zip", { zlib: { level: 6 } });
      archive.on("warning", (error) => console.warn("Archive warning:", error.message));
      archive.on("error", next);
      archive.pipe(res);
      archive.glob("**/*", {
        cwd: source,
        dot: true,
        ignore: [
          "**/.git/**",
          "**/node_modules/**",
          "**/.next/**",
          "**/.cache/**",
          "**/dist/**",
          "**/build/**",
          "**/coverage/**",
          "**/.env",
          "**/.env.*",
          "**/*.zip",
        ],
      });
      archive.finalize();
    } catch (error) {
      if (error.code === "ENOENT") return res.status(404).send("Project not found.");
      next(error);
    }
  });

  app.use("/mobile-projects", router);
}

module.exports = { extractProject, listProjects, registerProjectManager, safeProjectPath };
