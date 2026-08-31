/* =============================================================================
   NVR V9 CALIBRATION  —  real difficulty, taken from the v9 production bank
   -----------------------------------------------------------------------------
   The structural estimator ranks items poorly (it scored a triple-attribute
   matrix "Developing" and rated a count-controls-turn series as top-tier). The
   v9 production bank is human-reviewed and expert-banded, so its mechanism ->
   score/band mapping is a far better calibration. This module encodes that table
   and stamps generated items with the v9 score/band for the mechanism they
   implement — falling back to the structural estimate only where the generator
   produces a mechanism the bank has no anchor for (the perceptual family).

   Node:    const V9 = require('./nvr-v9-calibration.js');  V9.stamp(item, builderOrType);
   Browser: window.NVRV9  (same API)
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NVRV9 = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // v9 bank: mechanism -> { family, band, lo, hi, mean }  (scores are the bank's)
  const TABLE = {
    'cohesive-growth':          { family: 'Series',       band: 'Secure',        lo: 56, hi: 58, mean: 57 },
    'swap-positions':           { family: 'Analogy',      band: 'Secure',        lo: 60, hi: 63, mean: 62 },
    'growth-alternation':       { family: 'Series',       band: 'Secure',        lo: 60, hi: 64, mean: 62 },
    'inside-outside':           { family: 'Analogy',      band: 'Secure',        lo: 65, hi: 68, mean: 67 },
    'cube-opposites':           { family: 'Spatial / 3D', band: 'Secure',        lo: 67, hi: 70, mean: 69 },
    'count-controls-turn':      { family: 'Series',       band: 'Secure',        lo: 68, hi: 70, mean: 69 },
    'cube-fold':                { family: 'Spatial / 3D', band: 'Secure',        lo: 68, hi: 71, mean: 70 },
    'shape-count':              { family: 'Matrix',       band: 'Secure',        lo: 69, hi: 71, mean: 70 },
    'interwoven':               { family: 'Series',       band: 'Greater Depth', lo: 76, hi: 78, mean: 77 },
    'count-addition':           { family: 'Matrix',       band: 'Greater Depth', lo: 78, hi: 80, mean: 79 },
    'composite-analogy':        { family: 'Analogy',      band: 'Greater Depth', lo: 81, hi: 84, mean: 83 },
    'count-controls-sides':     { family: 'Series',       band: 'Greater Depth', lo: 82, hi: 84, mean: 83 },
    'second-order-count':       { family: 'Series',       band: 'Greater Depth', lo: 82, hi: 84, mean: 83 },
    'chirality':                { family: 'Series',       band: 'Greater Depth', lo: 83, hi: 85, mean: 84 },
    'diagonal-shading':         { family: 'Matrix',       band: 'Greater Depth', lo: 83, hi: 85, mean: 84 },
    'cube-corner':              { family: 'Spatial / 3D', band: 'Greater Depth', lo: 83, hi: 86, mean: 85 },
    'chirality-position':       { family: 'Series',       band: 'Greater Depth', lo: 84, hi: 86, mean: 85 },
    'interacting-movement':     { family: 'Matrix',       band: 'Greater Depth', lo: 84, hi: 86, mean: 85 },
    'second-order-position':    { family: 'Series',       band: 'Greater Depth', lo: 86, hi: 88, mean: 87 },
    'count-controls-two':       { family: 'Series',       band: 'Greater Depth', lo: 87, hi: 89, mean: 88 },
    'reflect-turn-alternation': { family: 'Series',       band: 'Greater Depth', lo: 88, hi: 90, mean: 89 },
    'xor':                      { family: 'Matrix',       band: 'Greater Depth', lo: 88, hi: 90, mean: 89 },
    'second-order-eighth-turn': { family: 'Series',       band: 'Greater Depth', lo: 89, hi: 91, mean: 90 },
    'triple-attribute':         { family: 'Matrix',       band: 'Greater Depth', lo: 90, hi: 92, mean: 91 }
  };

  // Crosswalk: generator builder-name AND playground type -> v9 mechanism.
  // `null` = a real generator mechanism the bank has NO anchor for (perceptual
  // family); undefined = below the bank's floor (trivial single-transform items).
  const CROSSWALK = {
    // matches to v9 mechanisms
    cohesiveSeries: 'cohesive-growth', seriesComposed: 'cohesive-growth',
    cubeNet: 'cube-fold',
    xorMatrix: 'xor', hardXor: 'xor',
    compoundOddOneOut: 'shape-count', hardOdd: 'shape-count',
    compositeAnalogy: 'composite-analogy', hardAnalogy: 'composite-analogy',
    chirality: 'chirality', hardChirality: 'chirality',
    interaction: 'count-controls-turn', hardInteraction: 'count-controls-turn',
    secondOrder: 'second-order-eighth-turn', hardSecondOrder: 'second-order-eighth-turn',
    tripleMatrix: 'triple-attribute', eliteTriple: 'triple-attribute',
    dependencySeries: 'count-controls-two', eliteDep: 'count-controls-two',
    interwoven: 'interwoven', eliteInterwoven: 'interwoven',
    interactingMovement: 'interacting-movement', eliteMovement: 'interacting-movement',
    // library-only mechanisms with no v9 anchor (perceptual / relational-conjunction)
    oddOneOutClear: 'inside-outside',
    conjunction: null, camoConjunction: null,
    embedded: null, embeddedHard: null, camoEmbedded: null,
    crossConjunction: null, eliteCross: null
    // (series/analogy/matrix/code/oddOneOut base builders: undefined -> structural)
  };

  function mechanismOf(builderOrType) { return CROSSWALK[builderOrType]; }

  // Stamp an item with v9 calibration. Keeps the structural score as
  // item.structuralScore for reference. `source` records provenance.
  function stamp(item, builderOrType) {
    const mech = CROSSWALK[builderOrType];
    item.structuralScore = item.difficulty;
    if (mech && TABLE[mech]) {
      item.mechanism = mech;
      item.score = TABLE[mech].mean;
      item.band = TABLE[mech].band;
      item.family = TABLE[mech].family;
      item.calibration = 'v9';
    } else if (mech === null) {
      // perceptual / relational family: no bank anchor. Keep structural score but
      // flag clearly and floor the band at Secure (these are demonstrably not easy).
      item.score = Math.max(item.difficulty, 70);
      item.band = item.score >= 72 ? 'Secure' : 'Secure';
      item.calibration = 'library-only (perceptual; no v9 anchor — trial before trusting)';
    } else {
      item.score = item.difficulty;
      item.calibration = 'structural (below bank floor / no mechanism match)';
    }
    return item;
  }

  const bandOrder = ['Foundation', 'Developing', 'Secure', 'Greater Depth'];
  return { TABLE, CROSSWALK, mechanismOf, stamp, bandOrder,
           mechanisms: Object.keys(TABLE), version: '1.0.0-v9cal' };
});
