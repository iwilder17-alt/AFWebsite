/* =========================================================================
   arcade.js — PRO <-> ARCADE mode, boot screen, 8-bit sound, Tetris bg,
   Punch-Out scorer verdicts, Konami easter egg.
   Guards every element so it works on the home page and the article page.
   ========================================================================= */
(function () {
  "use strict";
  var root = document.documentElement;
  var MODE_KEY = "iw-mode", SND_KEY = "iw-sound";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function mode() { return root.getAttribute("data-mode") === "arcade" ? "arcade" : "pro"; }

  /* ---------- 8-bit sound (WebAudio, no files) ------------------------- */
  var actx = null, soundOn = false;
  try { soundOn = localStorage.getItem(SND_KEY) === "on"; } catch (e) {}

  function ac() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (actx && actx.state === "suspended") actx.resume();
    return actx;
  }
  function tone(freq, dur, type, delay, gainv) {
    if (!soundOn) return;
    var c = ac(); if (!c) return;
    var t0 = c.currentTime + (delay || 0);
    var osc = c.createOscillator(), g = c.createGain();
    osc.type = type || "square"; osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gainv || 0.05, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(c.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  var snd = {
    coin: function () { tone(988, 0.08, "square", 0); tone(1319, 0.18, "square", 0.08); },
    blip: function () { tone(660, 0.06); },
    ko:   function () { [523,659,784,1047].forEach(function (f, i) { tone(f, 0.1, "square", i * 0.07); }); },
    buzz: function () { tone(130, 0.18, "sawtooth", 0, 0.06); }
  };

  /* ---------- Boot / title screen -------------------------------------- */
  var boot = document.getElementById("bootScreen");
  var bootTimer = null;
  function showBoot() {
    if (!boot || reduce) return;
    boot.classList.remove("is-off");
    boot.classList.add("is-on");
    clearTimeout(bootTimer);
    bootTimer = setTimeout(hideBoot, 1700);
  }
  function hideBoot() {
    if (!boot || !boot.classList.contains("is-on")) return;
    boot.classList.add("is-off");
    setTimeout(function () { boot.classList.remove("is-on", "is-off"); }, 380);
  }
  if (boot) {
    boot.addEventListener("click", hideBoot);
    window.addEventListener("keydown", function (e) {
      if (boot.classList.contains("is-on")) { hideBoot(); }
    });
  }

  /* ---------- Mode toggle ---------------------------------------------- */
  var modeBtn = document.getElementById("modeToggle");
  function paintModeBtn() {
    if (!modeBtn) return;
    var arc = mode() === "arcade";
    var icon = modeBtn.querySelector(".mode-toggle__icon");
    var label = modeBtn.querySelector(".mode-toggle__label");
    if (icon) icon.textContent = arc ? "▸" : "🕹";
    if (label) label.textContent = arc ? "PRO" : "ARCADE";
  }

  function setMode(next, animate) {
    root.setAttribute("data-mode", next);
    try { localStorage.setItem(MODE_KEY, next); } catch (e) {}
    paintModeBtn();
    if (next === "arcade") {
      startTetris();
      if (animate) { snd.coin(); showBoot(); }
    } else {
      stopTetris();
    }
    // re-render the scorer so its verdict matches the active mode
    var ft = document.getElementById("f-title");
    if (ft) ft.dispatchEvent(new Event("input", { bubbles: true }));
  }
  if (modeBtn) {
    paintModeBtn();
    modeBtn.addEventListener("click", function () {
      setMode(mode() === "arcade" ? "pro" : "arcade", true);
    });
  }

  /* ---------- Sound toggle --------------------------------------------- */
  var sndBtn = document.getElementById("soundToggle");
  function paintSnd() { if (sndBtn) { sndBtn.textContent = soundOn ? "♪ ON" : "♪ OFF"; sndBtn.setAttribute("aria-pressed", soundOn ? "true" : "false"); } }
  if (sndBtn) {
    paintSnd();
    sndBtn.addEventListener("click", function () {
      soundOn = !soundOn;
      try { localStorage.setItem(SND_KEY, soundOn ? "on" : "off"); } catch (e) {}
      paintSnd();
      if (soundOn) snd.blip();
    });
  }

  /* ---------- Tetris background canvas --------------------------------- */
  var cv = document.getElementById("tetrisBg"), ctx2, raf = null, blocks = [];
  var COLORS = ["#46b5ff","#ffd53d","#b57bff","#49e08a","#ff4757","#ff5aa8","#ff9f43","#45e6d5"];
  function sizeCanvas() {
    if (!cv) return;
    cv.width = window.innerWidth; cv.height = window.innerHeight;
  }
  function seedBlocks() {
    blocks = [];
    var n = Math.max(8, Math.min(16, Math.round(window.innerWidth / 90)));
    for (var i = 0; i < n; i++) blocks.push(newBlock(true));
  }
  function newBlock(anywhere) {
    var s = 16 + Math.floor(Math.random() * 4) * 8;
    return {
      x: Math.random() * (window.innerWidth - s),
      y: anywhere ? Math.random() * window.innerHeight : -s * 2,
      s: s, vy: 0.25 + Math.random() * 0.55,
      c: COLORS[(Math.random() * COLORS.length) | 0]
    };
  }
  function drawBlock(b) {
    ctx2.fillStyle = b.c; ctx2.fillRect(b.x, b.y, b.s, b.s);
    ctx2.fillStyle = "rgba(255,255,255,0.35)"; ctx2.fillRect(b.x, b.y, b.s, b.s * 0.22);
    ctx2.fillStyle = "rgba(0,0,0,0.30)"; ctx2.fillRect(b.x, b.y + b.s * 0.78, b.s, b.s * 0.22);
    ctx2.strokeStyle = "rgba(0,0,0,0.5)"; ctx2.lineWidth = 2; ctx2.strokeRect(b.x, b.y, b.s, b.s);
  }
  function frame() {
    if (!ctx2) return;
    ctx2.clearRect(0, 0, cv.width, cv.height);
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i]; b.y += b.vy; drawBlock(b);
      if (b.y > window.innerHeight + b.s) blocks[i] = newBlock(false);
    }
    raf = requestAnimationFrame(frame);
  }
  function startTetris() {
    if (!cv || reduce) return;
    if (!ctx2) ctx2 = cv.getContext("2d");
    sizeCanvas(); seedBlocks();
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function stopTetris() {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    if (ctx2 && cv) ctx2.clearRect(0, 0, cv.width, cv.height);
  }
  window.addEventListener("resize", function () { if (mode() === "arcade") { sizeCanvas(); seedBlocks(); } });

  /* ---------- Punch-Out scorer verdicts -------------------------------- */
  var result = document.getElementById("scorerResult");
  var BOX = {
    high: "K.O.! — SEND IT",
    mid:  "TRAIN MORE",
    low:  "DODGE — SKIP"
  };
  var lastTier = null;
  function enhanceScorer() {
    if (!result) return;
    if (mode() !== "arcade") return;               // pro mode: leave as-is
    var tier = result.classList.contains("result--high") ? "high"
             : result.classList.contains("result--low") ? "low" : "mid";
    var verdict = result.querySelector(".result__verdict");
    if (verdict && BOX[tier]) verdict.textContent = BOX[tier];
    if (!result.querySelector(".result__vs")) {
      var vs = document.createElement("span");
      vs.className = "result__vs";
      vs.textContent = "◄ SCOUTING REPORT ►";
      result.insertBefore(vs, result.firstChild);
    }
    if (tier !== lastTier) {
      if (tier === "high") snd.ko(); else if (tier === "low") snd.buzz(); else snd.blip();
      lastTier = tier;
    }
  }
  if (result) {
    ["f-title","f-statement","f-email","f-gdpr","f-incumbent"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.addEventListener("input", enhanceScorer); el.addEventListener("change", enhanceScorer); }
    });
  }

  /* ---------- Konami code easter egg ----------------------------------- */
  var seq = [38,38,40,40,37,39,37,39,66,65], pos = 0;
  window.addEventListener("keydown", function (e) {
    pos = (e.keyCode === seq[pos]) ? pos + 1 : (e.keyCode === seq[0] ? 1 : 0);
    if (pos === seq.length) { pos = 0; cheat(); }
  });
  function cheat() {
    if (mode() !== "arcade") setMode("arcade", true);
    snd.ko();
    var toast = document.createElement("div");
    toast.setAttribute("style",
      "position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:300;" +
      "font-family:'Press Start 2P',monospace;font-size:0.7rem;line-height:1.8;text-align:center;" +
      "color:#ffd53d;background:#05060f;border:3px solid #ff5aa8;box-shadow:6px 6px 0 rgba(0,0,0,0.6);" +
      "padding:1rem 1.2rem;max-width:90vw;");
    toast.innerHTML = "30 LIVES UNLOCKED<br><span style='color:#46b5ff'>&nbsp;</span><br>" +
      "<span style='font-size:0.55rem;color:#c3cbf5'>there is no cheat code.<br>it's called doing the reps.</span>";
    document.body.appendChild(toast);
    confetti();
    setTimeout(function () { toast.style.transition = "opacity .4s"; toast.style.opacity = "0";
      setTimeout(function () { toast.remove(); }, 420); }, 3200);
  }
  function confetti() {
    if (reduce) return;
    var C = document.createElement("canvas");
    C.setAttribute("style", "position:fixed;inset:0;z-index:299;pointer-events:none;");
    C.width = window.innerWidth; C.height = window.innerHeight;
    document.body.appendChild(C);
    var x = C.getContext("2d"), P = [], t = 0;
    for (var i = 0; i < 90; i++) P.push({ x: Math.random()*C.width, y: -20-Math.random()*C.height,
      s: 8+Math.random()*8, vy: 2+Math.random()*4, vx: -1+Math.random()*2,
      c: COLORS[(Math.random()*COLORS.length)|0] });
    (function run() {
      x.clearRect(0,0,C.width,C.height);
      P.forEach(function (p) { p.x+=p.vx; p.y+=p.vy; x.fillStyle=p.c; x.fillRect(p.x,p.y,p.s,p.s); });
      if (++t < 150) requestAnimationFrame(run); else C.remove();
    })();
  }

  /* ---------- Init ----------------------------------------------------- */
  // data-mode was set pre-paint by an inline <head> script to avoid FOUC.
  if (mode() === "arcade") { startTetris(); showBoot(); }
  enhanceScorer();
})();
