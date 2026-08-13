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
  html { scroll-behavior: smooth; }
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
    overflow: hidden;
    isolation: isolate;
  }
  body::before {
    content: "";
    position: fixed;
    z-index: -2;
    inset: -25%;
    background:
      radial-gradient(circle at 28% 28%, rgba(199, 255, 22, .09), transparent 24%),
      radial-gradient(circle at 72% 68%, rgba(91, 117, 255, .07), transparent 27%);
    animation: ambient-shift 18s cubic-bezier(.45, 0, .55, 1) infinite alternate;
  }
  .binary-field {
    position: fixed;
    z-index: -1;
    inset: -10vh 0;
    display: flex;
    justify-content: space-around;
    overflow: hidden;
    pointer-events: none;
    user-select: none;
    opacity: .11;
    mask-image: linear-gradient(to bottom, transparent, #000 18%, #000 76%, transparent);
  }
  .binary-column {
    width: 1em;
    color: var(--acid);
    font: 500 clamp(9px, 1vw, 12px)/1.85 var(--mono);
    overflow-wrap: anywhere;
    text-shadow: 0 0 12px rgba(199, 255, 22, .28);
    animation: binary-drift 26s linear infinite;
  }
  .binary-column:nth-child(2n) { animation-direction: reverse; animation-duration: 34s; opacity: .45; }
  .binary-column:nth-child(3n) { animation-duration: 42s; opacity: .7; }
  .binary-column:nth-child(4n) { transform: translateY(12vh); }
  .mech {
    position: fixed;
    z-index: -1;
    right: clamp(-80px, 1vw, 20px);
    bottom: -65px;
    width: min(35vw, 430px);
    color: #83bfff;
    opacity: .2;
    pointer-events: none;
    filter: drop-shadow(0 0 24px rgba(71, 157, 255, .14));
    transform-origin: 50% 100%;
    animation: mech-idle 9s cubic-bezier(.45, 0, .55, 1) infinite alternate;
  }
  .mech .armor { fill: rgba(35, 82, 125, .28); stroke: currentColor; stroke-width: 2; }
  .mech .detail { fill: none; stroke: rgba(199, 255, 22, .7); stroke-width: 1.4; }
  .mech .reactor { fill: var(--acid); transform-origin: center; animation: reactor-pulse 3.5s ease-in-out infinite; }
  .mech .mark { fill: currentColor; font: 500 10px var(--mono); letter-spacing: .18em; }
  .mech .code { fill: var(--acid); font: 500 9px var(--mono); letter-spacing: .12em; opacity: .75; animation: mech-code 6s linear infinite; }
  @keyframes ambient-shift {
    to { transform: translate3d(5%, -4%, 0) rotate(2deg); }
  }
  @keyframes binary-drift {
    from { translate: 0 -14%; }
    to { translate: 0 14%; }
  }
  @keyframes mech-idle {
    from { transform: translate3d(0, 4px, 0) rotate(-.35deg); }
    to { transform: translate3d(-5px, -7px, 0) rotate(.35deg); }
  }
  @keyframes reactor-pulse { 50% { opacity: .35; transform: scale(.72); } }
  @keyframes mech-code {
    from { transform: translateY(-8px); }
    to { transform: translateY(8px); }
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
    animation: enter .8s .08s both cubic-bezier(.22, 1, .36, 1);
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
    animation: enter .9s .16s both cubic-bezier(.22, 1, .36, 1);
  }
  .sub {
    font: 12px var(--mono);
    letter-spacing: .05em;
    color: rgba(241,240,234,.55);
    margin-bottom: 44px;
    text-align: center;
    animation: enter .9s .24s both cubic-bezier(.22, 1, .36, 1);
  }
  form {
    width: 100%;
    max-width: 360px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    animation: enter .9s .32s both cubic-bezier(.22, 1, .36, 1);
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
    transition: border-color .35s ease, background-color .35s ease, box-shadow .35s ease;
  }
  input:focus {
    border-color: var(--acid);
    background: rgba(199, 255, 22, .025);
    box-shadow: 0 0 0 3px rgba(199, 255, 22, .08);
  }
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
    transition: transform .35s cubic-bezier(.22, 1, .36, 1), box-shadow .35s ease, filter .35s ease;
  }
  button:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(199, 255, 22, .14); filter: brightness(1.05); }
  button:active { transform: translateY(0) scale(.99); }
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
    animation: enter .9s .4s both cubic-bezier(.22, 1, .36, 1);
  }
  @keyframes enter {
    from { opacity: 0; transform: translateY(18px); filter: blur(5px); }
    to { opacity: 1; transform: translateY(0); filter: blur(0); }
  }
  @media (max-width: 600px) {
    body::before { animation: none; inset: 0; }
    .binary-field { position: absolute; inset: 0; height: 100svh; opacity: .075; mask-image: none; }
    .binary-column { animation: none; transform: none !important; font-size: 9px; }
    .binary-column:nth-child(n+7) { display: none; }
    .mech { position: absolute; top: 13svh; right: -65px; bottom: auto; width: 210px; opacity: .12; filter: none; animation: none; }
    .mech .reactor { animation: none; }
    .mech .code { animation-duration: 12s; opacity: .65; }
  }
  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
    *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; }
    .binary-column { translate: 0 0; }
  }
</style>
</head>
<body>
  <div class="binary-field" aria-hidden="true">
    <span class="binary-column">10100101101001011010100101101001010110100101</span>
    <span class="binary-column">01011010010110100101001011010110100101101010</span>
    <span class="binary-column">11001010110100101101010010110100101011010010</span>
    <span class="binary-column">00101101001010110100101101001011010100101101</span>
    <span class="binary-column">10110100101001011010010110101001011010010110</span>
    <span class="binary-column">01001011010110100101101001010110100101101001</span>
    <span class="binary-column">11010010110100101011010010110101001011010010</span>
    <span class="binary-column">00110100101101001011010100101101001010110100</span>
    <span class="binary-column">10100101101001010110100101101010010110100101</span>
    <span class="binary-column">01011010010110101001011010010100101101011010</span>
    <span class="binary-column">11001010110100101101001010110100101101010010</span>
    <span class="binary-column">00101101001011010100101101001010110100101101</span>
  </div>
  <svg class="mech" viewBox="0 0 320 540" aria-hidden="true">
    <g class="armor">
      <path d="M127 37 145 20h30l18 17-8 43-25 13-25-13z" />
      <path d="m91 104 42-22 27 17 27-17 42 22 31 56-24 24-27-44-12 123-37 31-37-31-12-123-27 44-24-24z" />
      <path d="m55 166 31 15-14 122-27 86-24-8 19-92z" />
      <path d="m265 166-31 15 14 122 27 86 24-8-19-92z" />
      <path d="m123 270 37 28 37-28 20 56-21 44h-72l-21-44z" />
      <path d="m127 367 31 8-12 139-42 6 4-73z" />
      <path d="m193 367-31 8 12 139 42 6-4-73z" />
    </g>
    <g class="detail">
      <path d="M140 48h40M151 69h18M111 125l49 30 49-30M126 205h68M120 326h80M116 407h35M169 407h35" />
      <path d="m91 104 35 101-3 58M229 104l-35 101 3 58M45 303h28M247 303h28M108 447h39M173 447h39" />
      <circle cx="160" cy="181" r="24" /><circle cx="160" cy="181" r="15" />
    </g>
    <circle class="reactor" cx="160" cy="181" r="7" />
    <g class="code">
      <text x="124" y="126">10101 00110</text><text x="118" y="143">01101 10101</text>
      <text x="124" y="218">11010 01011</text><text x="121" y="255">10101 11001</text>
      <text x="116" y="316">01011 10110</text><text x="113" y="343">10101 00101</text>
      <text x="109" y="401">10101</text><text x="174" y="401">01011</text>
      <text x="106" y="428">01101</text><text x="177" y="428">10101</text>
    </g>
    <text class="mark" x="136" y="238">GD-01</text>
  </svg>
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
