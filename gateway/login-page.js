function renderLogin({ error, next } = {}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Sign in — OpenCode</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --ink: #0a0a0a;
    --acid: #c7ff16;
    --paper: #f1f0ea;
    --line: rgba(241, 240, 234, 0.25);
    --mono: "DM Mono", monospace;
    --sans: "Manrope", Arial, sans-serif;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100svh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background: var(--ink);
    color: var(--paper);
    font-family: var(--sans);
    padding: 24px;
  }
  .kicker {
    font: 11px var(--mono);
    letter-spacing: .08em;
    color: var(--acid);
    text-transform: uppercase;
    margin-bottom: 18px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .status-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--acid);
    box-shadow: 0 0 15px var(--acid);
    animation: pulse 2s infinite;
  }
  @keyframes pulse { 50% { opacity: .35; } }
  h1 {
    font-size: clamp(38px, 6vw, 64px);
    font-weight: 600;
    letter-spacing: -.06em;
    line-height: .95;
    margin: 0 0 8px;
    text-align: center;
  }
  .sub {
    font: 12px var(--mono);
    letter-spacing: .05em;
    color: rgba(241,240,234,.55);
    margin-bottom: 44px;
    text-align: center;
  }
  form {
    width: 100%;
    max-width: 360px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  label {
    font: 11px var(--mono);
    letter-spacing: .08em;
    text-transform: uppercase;
    color: rgba(241,240,234,.7);
  }
  input {
    width: 100%;
    padding: 14px 16px;
    background: transparent;
    border: 1px solid var(--line);
    border-radius: 4px;
    color: var(--paper);
    font-family: var(--sans);
    font-size: 15px;
    outline: none;
    transition: border-color .2s ease;
  }
  input:focus { border-color: var(--acid); }
  button {
    margin-top: 10px;
    padding: 15px 16px;
    border: 0;
    border-radius: 4px;
    background: var(--acid);
    color: var(--ink);
    font-family: var(--sans);
    font-weight: 700;
    font-size: 14px;
    letter-spacing: .02em;
    cursor: pointer;
    transition: transform .15s ease;
  }
  button:hover { transform: translateY(-1px); }
  .error {
    font: 12px var(--mono);
    color: #ff6b6b;
    text-align: center;
    margin-top: -4px;
  }
  .foot {
    margin-top: 40px;
    font: 11px var(--mono);
    letter-spacing: .07em;
    color: rgba(241,240,234,.4);
  }
</style>
</head>
<body>
  <div class="kicker"><span class="status-dot"></span>opencode / private server</div>
  <h1>Sign in</h1>
  <div class="sub">Authorized access only</div>
  <form method="POST" action="/login">
    <input type="hidden" name="next" value="${next ? String(next).replace(/"/g, '&quot;') : '/'}" />
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autofocus required />
    ${error ? `<div class="error">${error}</div>` : ""}
    <button type="submit">Enter</button>
  </form>
  <div class="foot">iniharith / opencode</div>
</body>
</html>`;
}

module.exports = { renderLogin };
