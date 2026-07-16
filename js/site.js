/* =========================================================================
   site.js — theme toggle + live ICP / persona scorer
   Models the Harvey persona-segmentation gate from Case 01.
   ========================================================================= */
(function () {
  "use strict";

  /* ---- Theme toggle --------------------------------------------------- */
  var root = document.documentElement;
  var toggle = document.getElementById("themeToggle");
  var KEY = "iw-theme";

  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);

  if (toggle) {
    toggle.addEventListener("click", function () {
      var current = root.getAttribute("data-theme");
      if (!current) {
        current = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
      var next = current === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem(KEY, next); } catch (e) {}
    });
  }

  /* ---- Persona scorer ------------------------------------------------- */
  var scorer = document.getElementById("icpScorer");
  if (!scorer) return;

  var fTitle = document.getElementById("f-title");
  var oTitle = document.getElementById("o-title");
  var fStatement = document.getElementById("f-statement");
  var fEmail = document.getElementById("f-email");
  var fGdpr = document.getElementById("f-gdpr");
  var fIncumbent = document.getElementById("f-incumbent");
  var out = document.getElementById("scorerResult");

  function clamp(n) { return Math.max(0, Math.min(100, Math.round(n))); }

  function evaluate() {
    var titleFit = parseInt(fTitle.value, 10);
    var statement = fStatement.value;      // specific | generic | none
    var emailOk = fEmail.checked;
    var gdpr = fGdpr.checked;
    var incumbent = fIncumbent.checked;

    if (oTitle) oTitle.textContent = titleFit;

    var reasons = [];
    var tier, verdict, score;

    // --- Hard SKIP rule: thin research kills the send -------------------
    if (statement === "none") {
      score = clamp(titleFit * 0.25);
      tier = "low";
      verdict = "SKIP";
      reasons.push("No specific public statement found — the SKIP rule fires. Thin research kills the send rather than shipping fake personalization (name + title isn't personalization).");
      return render(score, tier, verdict, reasons, gdpr, incumbent);
    }

    // --- Weighted score -------------------------------------------------
    score = titleFit;
    var stmtMult = statement === "specific" ? 1.0 : 0.62;
    score = score * stmtMult;
    if (statement === "specific") {
      reasons.push("Specific, recent statement on legal AI — I can anchor a message to their own words.");
    } else {
      reasons.push("Statement is generic or dated — nothing sharp to anchor to, so the message risks being name + title in disguise.");
    }

    if (!emailOk) {
      score = score * 0.72;
      reasons.push("Work email unverified — deliverability risk before the message even lands.");
    }

    if (incumbent) {
      score = score - 12;
      reasons.push("Active advocate of the incumbent (Legora) — legitimate to contact, but the bar for a clear, transparent 'why' is higher. Personalize harder or don't send.");
    }

    score = clamp(score);

    if (score >= 70) { tier = "high"; verdict = "SEND — approved"; }
    else if (score >= 45) { tier = "mid"; verdict = "Personalize harder"; }
    else { tier = "low"; verdict = "SKIP / blocklist review"; }

    render(score, tier, verdict, reasons, gdpr, incumbent);
  }

  function render(score, tier, verdict, reasons, gdpr, incumbent) {
    if (gdpr) {
      reasons.push("GDPR / LGPD jurisdiction → single-touch only, one effortless opt-out, no chase. Silence is an answer.");
    }

    var colorVar = tier === "high" ? "--fit-high" : tier === "mid" ? "--fit-mid" : "--fit-low";

    out.className = "scorer__result result--" + tier;
    out.innerHTML =
      '<div class="result__verdict">' + verdict + '</div>' +
      '<div class="result__score">match score &middot; ' + score + ' / 100</div>' +
      '<div class="result__bar"><span style="width:' + score + '%;background:var(' + colorVar + ')"></span></div>' +
      '<div class="result__reason">' + reasons.map(esc).join(" ") + '</div>';
  }

  function esc(s) {
    return String(s).replace(/[&<>]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
    });
  }

  [fTitle, fStatement, fEmail, fGdpr, fIncumbent].forEach(function (el) {
    el.addEventListener("input", evaluate);
    el.addEventListener("change", evaluate);
  });

  evaluate();
})();
