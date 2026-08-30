/* =============================================================================
   NVR CALIBRATE  —  turn response data into real difficulty
   -----------------------------------------------------------------------------
   Input: a MANIFEST (from the assembler) + a wide response table exported from
   your Google Sheet: one row per pupil, one column per question, each cell the
   chosen letter A-E (blank = omitted). The manifest gives the correct answer
   per question, so scoring, discrimination and distractor analysis are all
   self-contained — no separate mark scheme needed.

   Produces, per item:
     facility        proportion correct (is a "hard" item actually hard?)
     discrimination  corrected point-biserial: does the item sort pupils by
                     ability? Low/negative = a broken or ambiguous item.
     distractors     who chose each wrong option, split by ability group; a
                     wrong option that pulls the TOP group is flagged (a likely
                     second-defensible-reading or a real misconception to teach)
   And across the paper:
     refit           regression of observed facility on the prior difficulty
                     score, so the priors can be corrected to the cohort.

   Node module. Pure functions; no I/O here (calibrate.js does the I/O).
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NVRCalibrate = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const LETTERS = 'ABCDE';

  // ---- CSV / TSV parsing (wide format) ------------------------------------
  function parseTable(text) {
    const rows = text.replace(/\r/g, '').split('\n').filter(r => r.trim().length);
    const delim = rows[0].includes('\t') ? '\t' : ',';
    const header = rows[0].split(delim).map(h => h.trim());
    return rows.slice(1).map(r => {
      const cells = r.split(delim);
      const obj = {};
      header.forEach((h, i) => obj[h] = (cells[i] || '').trim());
      return obj;
    });
  }

  // Map each response row to { pupil, answers: {qn -> letter} } using the
  // manifest. Column matching is lenient: a column named "Q3", "q3", "3" or
  // containing the item id all map to question 3.
  function alignResponses(rows, manifest) {
    const byN = new Map(manifest.map(m => [m.n, m]));
    const idToN = new Map(manifest.map(m => [m.id, m.n]));
    return rows.map(row => {
      const keys = Object.keys(row);
      const pupilKey = keys.find(k => /pupil|name|id|student/i.test(k)) || keys[0];
      const answers = {};
      keys.forEach(k => {
        if (k === pupilKey) return;
        let n = null;
        const mID = idToN.get(k.trim());
        if (mID) n = mID;
        else { const m = k.match(/(\d+)/); if (m) n = parseInt(m[1], 10); }
        if (n && byN.has(n)) {
          const v = (row[k] || '').trim().toUpperCase();
          if (LETTERS.includes(v)) answers[n] = v;
          else if (/^[0-4]$/.test(v)) answers[n] = LETTERS[+v];  // tolerate 0-based indices
        }
      });
      return { pupil: row[pupilKey], answers };
    });
  }

  // ---- scoring ------------------------------------------------------------
  function score(aligned, manifest) {
    const key = new Map(manifest.map(m => [m.n, m.answer]));
    return aligned.map(r => {
      let correct = 0, attempted = 0;
      manifest.forEach(m => {
        const a = r.answers[m.n];
        if (a) { attempted++; if (a === key.get(m.n)) correct++; }
      });
      return Object.assign({}, r, { total: correct, attempted });
    });
  }

  const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
  const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };

  // ---- per-item statistics -----------------------------------------------
  function itemStats(scored, manifest) {
    const key = new Map(manifest.map(m => [m.n, m.answer]));
    // group thirds by total score for distractor analysis
    const ranked = [...scored].sort((a, b) => b.total - a.total);
    const cut = Math.max(1, Math.floor(ranked.length / 3));
    const topSet = new Set(ranked.slice(0, cut).map(r => r.pupil));
    const botSet = new Set(ranked.slice(-cut).map(r => r.pupil));

    return manifest.map(m => {
      const resp = scored.map(r => ({ pupil: r.pupil, total: r.total, a: r.answers[m.n] }))
        .filter(r => r.a);                                   // attempted only
      const nAtt = resp.length;
      const nCorrect = resp.filter(r => r.a === key.get(m.n)).length;
      const facility = nAtt ? nCorrect / nAtt : null;

      // corrected point-biserial: correlate item-correct with REST score
      const restOf = (r) => r.total - (r.a === key.get(m.n) ? 1 : 0);
      const rest = resp.map(restOf);
      const flags = resp.map(r => r.a === key.get(m.n) ? 1 : 0);
      const disc = pointBiserial(flags, rest);

      // option distribution overall + by ability group
      const dist = {};
      resp.forEach(r => {
        dist[r.a] = dist[r.a] || { n: 0, top: 0, bot: 0 };
        dist[r.a].n++;
        if (topSet.has(r.pupil)) dist[r.a].top++;
        if (botSet.has(r.pupil)) dist[r.a].bot++;
      });
      // flag wrong options that attract the top group
      const topN = Math.max(1, cut);
      const flaggedDistractors = Object.entries(dist)
        .filter(([L]) => L !== m.answer)
        .filter(([, d]) => d.top / topN >= 0.15)
        .map(([L, d]) => ({ option: L, topRate: +(d.top / topN).toFixed(2), n: d.n }));

      return {
        n: m.n, id: m.id, type: m.type, band: m.band, difficultyPrior: m.difficultyPrior,
        attempted: nAtt, facility: facility == null ? null : +facility.toFixed(3),
        discrimination: disc == null ? null : +disc.toFixed(3),
        optionDist: dist, flaggedDistractors,
        quality: quality(facility, disc, flaggedDistractors)
      };
    });
  }

  function pointBiserial(flags, cont) {
    // r_pb between a 0/1 vector (flags) and a continuous vector (cont)
    const n = flags.length; if (n < 3) return null;
    const p = mean(flags); if (p === 0 || p === 1) return null;
    const c1 = cont.filter((_, i) => flags[i] === 1);
    const c0 = cont.filter((_, i) => flags[i] === 0);
    const s = sd(cont); if (s === 0) return null;
    return ((mean(c1) - mean(c0)) / s) * Math.sqrt(p * (1 - p));
  }

  function quality(facility, disc, flagged) {
    if (facility == null || disc == null) return 'insufficient data';
    const notes = [];
    if (disc < 0.1) notes.push('poor discrimination');
    if (disc < 0) notes.push('NEGATIVE discrimination — review/replace');
    if (flagged.length) notes.push('distractor pulls able pupils');
    if (facility > 0.95) notes.push('too easy');
    if (facility < 0.15) notes.push('too hard / possibly mis-keyed');
    return notes.length ? notes.join('; ') : 'sound';
  }

  // ---- refit: observed facility vs prior difficulty score -----------------
  function refit(stats) {
    const pts = stats.filter(s => s.facility != null && s.difficultyPrior != null)
      .map(s => [s.difficultyPrior, s.facility]);
    if (pts.length < 3) return null;
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const mx = mean(xs), my = mean(ys);
    let sxy = 0, sxx = 0, syy = 0;
    pts.forEach(([x, y]) => { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; });
    const slope = sxx ? sxy / sxx : 0;
    const intercept = my - slope * mx;
    const r = (sxx && syy) ? sxy / Math.sqrt(sxx * syy) : 0;
    return {
      n: pts.length, slope: +slope.toFixed(5), intercept: +intercept.toFixed(4),
      r: +r.toFixed(3), r2: +(r * r).toFixed(3),
      predictFacility: (prior) => +(intercept + slope * prior).toFixed(3),
      note: 'facility ≈ intercept + slope × difficultyPrior; a strong negative slope means the prior tracks real difficulty'
    };
  }

  return { parseTable, alignResponses, score, itemStats, pointBiserial, refit, quality, mean, sd };
});
