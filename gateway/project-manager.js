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

function renderBasePage({ projects, message = "", error = "" }) {
  const rows = projects.length
    ? projects.map((name) => `<li><span>${escapeHtml(name)}</span><a href="/mobile-projects/${encodeURIComponent(name)}.zip">DOWNLOAD ZIP ↓</a></li>`).join("")
    : "<li class=empty>No projects available yet.</li>";
  const mech = `<svg class="mech" viewBox="0 0 320 540" aria-hidden="true"><g class="armor"><path d="M127 37 145 20h30l18 17-8 43-25 13-25-13z"/><path d="m91 104 42-22 27 17 27-17 42 22 31 56-24 24-27-44-12 123-37 31-37-31-12-123-27 44-24-24z"/><path d="m55 166 31 15-14 122-27 86-24-8 19-92z"/><path d="m265 166-31 15 14 122 27 86 24-8-19-92z"/><path d="m123 270 37 28 37-28 20 56-21 44h-72l-21-44z"/><path d="m127 367 31 8-12 139-42 6 4-73z"/><path d="m193 367-31 8 12 139 42 6-4-73z"/></g><g class="detail"><path d="M140 48h40M151 69h18M111 125l49 30 49-30M126 205h68M120 326h80M116 407h35M169 407h35"/><path d="m91 104 35 101-3 58M229 104l-35 101 3 58M45 303h28M247 303h28M108 447h39M173 447h39"/><circle cx="160" cy="181" r="24"/><circle cx="160" cy="181" r="15"/></g><circle class="reactor" cx="160" cy="181" r="7"/><g class="code"><text x="124" y="126">10101 00110</text><text x="118" y="143">01101 10101</text><text x="124" y="218">11010 01011</text><text x="121" y="255">10101 11001</text><text x="116" y="316">01011 10110</text><text x="113" y="343">10101 00101</text><text x="109" y="401">10101</text><text x="174" y="401">01011</text><text x="106" y="428">01101</text><text x="177" y="428">10101</text></g><text class="mark" x="136" y="238">GD-01</text></svg>`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#c7ff16"><title>Mobile Projects — OpenCode</title><style>
:root{--ink:#0a0a0a;--acid:#c7ff16;--paper:#f1f0ea;--muted:#999;--ease:cubic-bezier(.22,1,.36,1)}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--ink);color:var(--paper);font-family:Arial,sans-serif;padding:24px;min-height:100svh;overflow-x:hidden;isolation:isolate}body:before{content:"";position:fixed;z-index:-2;inset:-25%;background:radial-gradient(circle at 22% 24%,rgba(199,255,22,.08),transparent 22%),radial-gradient(circle at 78% 72%,rgba(84,108,255,.07),transparent 25%);animation:ambient-shift 20s ease-in-out infinite alternate}.binary-field{position:fixed;z-index:-1;inset:-12vh 0;display:flex;justify-content:space-around;overflow:hidden;pointer-events:none;user-select:none;opacity:.1;mask-image:linear-gradient(to bottom,transparent,#000 15%,#000 80%,transparent)}.binary-column{width:1em;color:var(--acid);font:11px/1.9 monospace;overflow-wrap:anywhere;text-shadow:0 0 12px rgba(199,255,22,.25);animation:binary-drift 28s linear infinite}.binary-column:nth-child(2n){animation-direction:reverse;animation-duration:37s;opacity:.45}.binary-column:nth-child(3n){animation-duration:44s;opacity:.7}.binary-column:nth-child(4n){transform:translateY(12vh)}@keyframes ambient-shift{to{transform:translate3d(5%,-4%,0) rotate(2deg)}}@keyframes binary-drift{from{translate:0 -14%}to{translate:0 14%}}main{max-width:880px;margin:auto}header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #444;padding:10px 0 24px;font:12px monospace;letter-spacing:.08em;color:var(--acid)}h1{font-size:clamp(52px,14vw,130px);line-height:.8;letter-spacing:-.08em;margin:70px 0 30px}p{max-width:620px;font-size:17px;line-height:1.5;color:#bbb}.panel{margin:60px 0;padding:22px;border:1px solid #555;background:rgba(23,23,23,.9);backdrop-filter:blur(12px);transition:border-color .5s ease,transform .5s var(--ease)}.panel:hover{border-color:#777;transform:translateY(-2px)}.panel h2{margin:0 0 24px;font-size:28px;letter-spacing:-.04em}label{display:block;margin:18px 0 7px;font:11px monospace;letter-spacing:.08em}input{width:100%;padding:14px;border:1px solid #555;background:var(--ink);color:white;font-size:16px;transition:border-color .35s ease,box-shadow .35s ease}input:focus{outline:0;border-color:var(--acid);box-shadow:0 0 0 3px rgba(199,255,22,.08)}button{width:100%;margin-top:22px;padding:16px;border:0;background:var(--acid);font-weight:bold;font-size:15px;cursor:pointer;transition:transform .35s var(--ease),box-shadow .35s ease,filter .35s ease}button:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(199,255,22,.14);filter:brightness(1.05)}button:active{transform:translateY(0) scale(.995)}.notice{padding:14px;margin-top:20px;font:13px monospace}.success{color:var(--acid);border:1px solid var(--acid)}.error{color:#ff7777;border:1px solid #ff7777}h2.list-title{margin-top:80px;font-size:13px;font-family:monospace;letter-spacing:.08em}ul{padding:0;list-style:none;border-top:1px solid #555}li{display:flex;justify-content:space-between;align-items:center;gap:20px;min-height:72px;border-bottom:1px solid #555;transition:background-color .35s ease,padding .35s var(--ease)}li:hover{background:rgba(199,255,22,.025);padding-inline:10px}li span{font-size:clamp(21px,5vw,34px);letter-spacing:-.04em}li a,.back{color:var(--acid);font:11px monospace;text-underline-offset:4px;transition:opacity .3s ease}li a{white-space:nowrap}li a:hover,.back:hover{opacity:.65}.empty{color:var(--muted);font:14px monospace}.back{display:inline-block;margin:65px 0 30px}.motion-ready .reveal{opacity:0;transform:translateY(24px);filter:blur(5px);transition:opacity .85s var(--ease),transform .85s var(--ease),filter .85s var(--ease)}.motion-ready .reveal.visible{opacity:1;transform:none;filter:none}h1.reveal{transition-delay:.08s}.intro.reveal{transition-delay:.14s}@media(max-width:550px){body{padding:16px}.binary-column:nth-child(even){display:none}.binary-field{opacity:.08}.panel{margin-top:45px;padding:16px;backdrop-filter:none}li{align-items:flex-start;flex-direction:column;padding:18px 0;gap:10px}li:hover{padding-inline:8px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*:before,*:after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}.motion-ready .reveal{opacity:1;transform:none;filter:none}.binary-column{translate:0 0}}
</style></head><body><div class="binary-field" aria-hidden="true"><span class="binary-column">10100101101001011010100101101001010110100101</span><span class="binary-column">01011010010110100101001011010110100101101010</span><span class="binary-column">11001010110100101101010010110100101011010010</span><span class="binary-column">00101101001010110100101101001011010100101101</span><span class="binary-column">10110100101001011010010110101001011010010110</span><span class="binary-column">01001011010110100101101001010110100101101001</span><span class="binary-column">11010010110100101011010010110101001011010010</span><span class="binary-column">00110100101101001011010100101101001010110100</span><span class="binary-column">10100101101001010110100101101010010110100101</span><span class="binary-column">01011010010110101001011010010100101101011010</span><span class="binary-column">11001010110100101101001010110100101101010010</span><span class="binary-column">00101101001011010100101101001010110100101101</span></div><main><header class="reveal"><span>OPENCODE / ANDROID</span><span>PRIVATE WORKSPACE</span></header><h1 class="reveal">MOBILE<br>PROJECTS</h1><p class="intro reveal">Upload a project ZIP from Android Documents or Downloads. Open it by name in OpenCode Mobile, make your changes, then return here to download the updated ZIP.</p><section class="panel reveal"><h2>Upload a project</h2><form method="post" action="/mobile-projects/upload" enctype="multipart/form-data"><label for="name">PROJECT NAME</label><input id="name" name="name" maxlength="80" pattern="[A-Za-z0-9][A-Za-z0-9._-]*" placeholder="my-project" required><label for="project">ZIP FILE</label><input id="project" name="project" type="file" accept=".zip,application/zip" required><button type="submit">UPLOAD & EXTRACT</button></form>${message ? `<div class="notice success">${escapeHtml(message)}</div>` : ""}${error ? `<div class="notice error">${escapeHtml(error)}</div>` : ""}</section><h2 class="list-title reveal">AVAILABLE PROJECTS / ${projects.length}</h2><ul class="reveal">${rows}</ul><a class="back reveal" href="/">← BACK TO OPENCODE</a></main><script>document.documentElement.classList.add("motion-ready");const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;const reveals=document.querySelectorAll(".reveal");if(reduced){reveals.forEach((element)=>element.classList.add("visible"))}else{const observer=new IntersectionObserver((entries)=>{entries.forEach((entry)=>{if(entry.isIntersecting){entry.target.classList.add("visible");observer.unobserve(entry.target)}})},{threshold:.12,rootMargin:"0px 0px -4%"});reveals.forEach((element)=>observer.observe(element))}</script></body></html>`;
}

function renderPage(options) {
  const html = renderBasePage(options);
  const mech = `<svg class="mech" viewBox="0 0 320 540" aria-hidden="true"><g class="armor"><path d="M127 37 145 20h30l18 17-8 43-25 13-25-13z"/><path d="m91 104 42-22 27 17 27-17 42 22 31 56-24 24-27-44-12 123-37 31-37-31-12-123-27 44-24-24z"/><path d="m55 166 31 15-14 122-27 86-24-8 19-92z"/><path d="m265 166-31 15 14 122 27 86 24-8-19-92z"/><path d="m123 270 37 28 37-28 20 56-21 44h-72l-21-44z"/><path d="m127 367 31 8-12 139-42 6 4-73z"/><path d="m193 367-31 8 12 139 42 6-4-73z"/></g><g class="detail"><circle cx="160" cy="181" r="24"/><circle cx="160" cy="181" r="15"/><path d="M111 125l49 30 49-30M126 205h68M120 326h80M116 407h35M169 407h35"/></g><circle class="reactor" cx="160" cy="181" r="7"/><g class="code"><text x="124" y="126">10101 00110</text><text x="118" y="143">01101 10101</text><text x="124" y="218">11010 01011</text><text x="121" y="255">10101 11001</text><text x="116" y="316">01011 10110</text><text x="113" y="343">10101 00101</text><text x="109" y="401">10101</text><text x="174" y="401">01011</text><text x="106" y="428">01101</text><text x="177" y="428">10101</text></g><text class="mark" x="136" y="238">GD-01</text></svg>`;
  const mechStyles = `.mech{position:fixed;z-index:-1;right:max(-45px,calc((100vw - 1180px)/2));bottom:-65px;width:min(32vw,390px);color:#83bfff;opacity:.18;pointer-events:none;filter:drop-shadow(0 0 24px rgba(71,157,255,.14));transform-origin:50% 100%;animation:mech-idle 9s ease-in-out infinite alternate}.mech .armor{fill:rgba(35,82,125,.28);stroke:currentColor;stroke-width:2}.mech .detail{fill:none;stroke:rgba(199,255,22,.7);stroke-width:1.4}.mech .reactor{fill:var(--acid);transform-origin:center;animation:reactor-pulse 3.5s ease-in-out infinite}.mech .code{fill:var(--acid);font:500 9px monospace;letter-spacing:.12em;opacity:.75;animation:mech-code 6s linear infinite}.mech .mark{fill:currentColor;font:500 10px monospace;letter-spacing:.18em}@keyframes mech-idle{from{transform:translate3d(0,4px,0) rotate(-.35deg)}to{transform:translate3d(-5px,-7px,0) rotate(.35deg)}}@keyframes reactor-pulse{50%{opacity:.35;transform:scale(.72)}}@keyframes mech-code{from{transform:translateY(-8px)}to{transform:translateY(8px)}}@media(max-width:550px){html{scroll-behavior:auto}body:before{position:absolute;inset:0;height:100svh;animation:none}.binary-field{position:absolute;inset:0;height:100svh;opacity:.065;mask-image:none}.binary-column{animation:none!important;transform:none!important;font-size:9px;text-shadow:none}.binary-column:nth-child(n+7){display:none}.mech{position:absolute;top:18svh;right:-70px;bottom:auto;width:220px;opacity:.1;filter:none;animation:none}.mech .reactor{animation:none}.mech .code{animation-duration:12s;opacity:.65}.panel{background:#171717}.motion-ready .reveal{filter:none;transition:opacity .45s ease,transform .45s var(--ease)}}`;
  const headerStyles = `header{position:sticky;top:12px;z-index:10;margin-inline:-14px;padding:16px 14px 18px!important;border:1px solid rgba(241,240,234,.13)!important;border-radius:10px;background:rgba(10,10,10,.68);-webkit-backdrop-filter:blur(14px) saturate(135%);backdrop-filter:blur(14px) saturate(135%);box-shadow:0 12px 35px rgba(0,0,0,.18)}@media(max-width:550px){header{top:8px;margin-inline:-6px;padding:13px 10px 15px!important;background:rgba(10,10,10,.82);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:0 8px 24px rgba(0,0,0,.16)}}`;
  return html.replace("</style>", `${mechStyles}${headerStyles}</style>`).replace("<main>", `${mech}<main>`);
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

module.exports = { extractProject, listProjects, registerProjectManager, renderPage, safeProjectPath };
