const express = require("express");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const { createProxyMiddleware } = require("http-proxy-middleware");
const { renderLogin } = require("./login-page");

const PORT = process.env.PORT || 8080;
const APP_USERNAME = process.env.APP_USERNAME || "opencode";
const APP_PASSWORD = process.env.APP_PASSWORD;
const OPENCODE_INTERNAL_URL = process.env.OPENCODE_INTERNAL_URL || "http://127.0.0.1:4096";
const COOKIE_NAME = "oc_session";
const COOKIE_SECRET = crypto
  .createHash("sha256")
  .update(APP_PASSWORD || "unsafe-default")
  .digest("hex");

if (!APP_PASSWORD) {
  console.warn("WARNING: APP_PASSWORD is not set. Refusing all access until it is configured.");
}

function makeSessionToken() {
  return crypto.createHmac("sha256", COOKIE_SECRET).update("authorized").digest("hex");
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function hasValidBasicAuth(req) {
  const header = req.headers["authorization"];
  if (!header || !header.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const idx = decoded.indexOf(":");
  if (idx === -1) return false;
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  return APP_PASSWORD && timingSafeEqual(user, APP_USERNAME) && timingSafeEqual(pass, APP_PASSWORD);
}

function hasValidSessionCookie(req) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  return APP_PASSWORD && token && timingSafeEqual(token, makeSessionToken());
}

const app = express();
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));

// Login page (GET) — themed to match iniharith.github.io
app.get("/login", (req, res) => {
  res.status(200).send(renderLogin({ next: req.query.next || "/" }));
});

// Login submit (POST)
app.post("/login", (req, res) => {
  const { password, next } = req.body;
  if (APP_PASSWORD && timingSafeEqual(password || "", APP_PASSWORD)) {
    res.cookie(COOKIE_NAME, makeSessionToken(), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
    return res.redirect(next && next.startsWith("/") ? next : "/");
  }
  res.status(401).send(renderLogin({ error: "Wrong password, try again.", next }));
});

// Everything else: allow if (a) valid Basic Auth header (OpenCode Mobile / API clients)
// or (b) valid session cookie (browser that logged in via the themed page).
// Otherwise: browsers get redirected to the themed login; non-browser clients get 401.
app.use((req, res, next) => {
  if (hasValidBasicAuth(req) || hasValidSessionCookie(req)) {
    return next();
  }
  const acceptsHtml = (req.headers.accept || "").includes("text/html");
  if (acceptsHtml) {
    return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
  }
  res.status(401).json({ error: "unauthorized" });
});

// Proxy through to the real opencode server, injecting the credentials it expects internally.
const internalAuthHeader =
  "Basic " + Buffer.from(`${APP_USERNAME}:${APP_PASSWORD || ""}`).toString("base64");

app.use(
  "/",
  createProxyMiddleware({
    target: OPENCODE_INTERNAL_URL,
    changeOrigin: true,
    ws: true,
    onProxyReq: (proxyReq) => {
      proxyReq.setHeader("authorization", internalAuthHeader);
    },
  })
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Gateway listening on 0.0.0.0:${PORT}, proxying to ${OPENCODE_INTERNAL_URL}`);
});
