/* V1.4 Candidate r1 — pure shadow engine. Never writes Production inputs/results. */
(function (root) {
  'use strict';
  const VERSION = 'V1.4-Candidate-r1-2026-09-21';
  const number = v => v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v);
  const down = n => n >= 1 ? 0.5 : n >= 0.5 ? 0.25 : 0;
  const yes = b => b ? 'Yes' : 'No';
  const round = n => Math.round((n + Number.EPSILON) * 1e8) / 1e8;

  function classify(main, secondary, direction) {
    const m = main || {}, s = secondary || {};
    const bias = direction === 'Short' ? 'down' : 'up';
    if (!m.type || !s.type) return 'noRoute';
    if (m.type === 'healthy' && s.type === 'healthy' && m.bias !== s.bias) return 'hardConflict';
    if (m.type === 'transition' && s.type === 'transition') {
      if (!m.bias || !s.bias) return 'neutralTransition';
      if (m.bias === s.bias) return bias === m.bias ? 'alignedTransition' : 'noRoute';
      return bias === m.bias ? 'mixedTransition' : 'noRoute';
    }
    if (m.bias && bias !== m.bias && m.type !== 'transition') return m.type === 'healthy' ? 'reverseHealthyMain' : 'reverseWeakMain';
    if (!m.bias || !s.bias) {
      const directional = m.bias || s.bias;
      return bias === directional ? 'directionalNeutral' : 'noRoute';
    }
    if (m.bias === s.bias) {
      if (bias !== m.bias) return 'noRoute';
      if (m.type === 'transition' || s.type === 'transition') return 'transitionConfirmed';
      return m.type === 'healthy' && s.type === 'healthy' ? 'healthyAligned' : 'weakAligned';
    }
    return m.type === 'transition' ? 'transitionVsConfirmedConflict' : 'conflictMain';
  }

  function negative(input) {
    const tags = new Set(input.q2Codes || []);
    if ((tags.has('R') && tags.has('S') && input.structured) || (tags.has('F') && tags.has('S'))) return 'High';
    if ((tags.has('S') && input.structured) || (tags.has('F') && input.closeThrough)) return 'Medium';
    return 'None';
  }

  function calculate(input) {
    const i = {...input};
    let route = i.main && i.secondary ? classify(i.main, i.secondary, i.direction) : i.route;
    if (route === 'neutralMainConfirmed') route = 'directionalNeutral';
    if (i.hardConflict || (route === 'mixedTransition' && i.counterMain)) route = 'noRoute';
    const p = i.executionP, raw = i.rawP, q = i.q;
    const p12 = p === 'P1' || p === 'P2';
    const e = raw === 'P3' && p === 'P2' && i.positionTreatment === 'p2Effective';
    const neg = negative(i);
    const reasons = [], trace = [];
    let size = 0, cap = 0, noUpgrade = 0;
    const meaningful = i.boundary === true;
    const q3 = q === 'Q3', q2 = q === 'Q2';

    // Route permissions are decided before any E, Q or risk modifier.
    switch (route) {
      case 'healthyAligned':
        cap = 1;
        size = p12 ? (q3 ? 1 : q2 ? 0.5 : 0) : p === 'P3' ? (q3 ? 0.5 : q2 ? 0.25 : 0) : 0;
        noUpgrade = e && q2 ? 0.25 : size;
        if (e && q3) { size = Math.min(size, 0.5); reasons.push('P3-origin cap 0.5'); }
        if (e && q2) reasons.push('Dual Healthy P3→P2-E Q2 Upgrade');
        break;
      case 'weakAligned':
      case 'transitionConfirmed':
      case 'directionalNeutral':
        cap = 0.5;
        size = p12 ? (q3 ? 0.5 : q2 ? 0.25 : 0) : p === 'P3' && q3 && (route !== 'directionalNeutral' || meaningful) ? 0.25 : 0;
        noUpgrade = size;
        break;
      case 'alignedTransition':
        cap = 0.25;
        size = q3 && (p12 || (p === 'P3' && meaningful)) ? 0.25 : 0;
        noUpgrade = size;
        reasons.push('Aligned Transition cap 0.25 / Q2 No');
        break;
      case 'neutralTransition':
        cap = 0.5;
        size = p === 'P1' && meaningful ? (q3 ? 0.5 : q2 ? 0.25 : 0) : p === 'P2' && q3 ? 0.25 : p === 'P3' && q3 && meaningful ? 0.25 : 0;
        noUpgrade = size;
        if (p === 'P1' && !meaningful) reasons.push('True Boundary not confirmed');
        break;
      case 'mixedTransition':
        cap = 0.5;
        size = p12 && q3 ? 0.5 : p12 && q2 && meaningful && neg === 'None' ? 0.25 : p === 'P3' && q3 && meaningful ? 0.25 : 0;
        noUpgrade = p === 'P1' ? size : p === 'P2' && q3 ? 0.25 : p === 'P3' ? size : 0;
        if (p12 && q3) reasons.push('Mixed Transition Q3 Upgrade');
        if (p12 && q2 && size) reasons.push('Mixed Transition clean boundary Q2 route');
        break;
      case 'conflictMain':
      case 'transitionVsConfirmedConflict':
        cap = 0.25;
        size = p12 && q3 ? 0.25 : p12 && q2 && meaningful && neg === 'None' ? 0.25 : p === 'P3' && q3 && meaningful ? 0.25 : 0;
        noUpgrade = size;
        reasons.push('Conflict cap 0.25');
        break;
      case 'reverseWeakMain':
        cap = 0.25;
        size = ['P1','P2'].includes(raw) && q3 && i.activeHtf && i.controlTransfer && i.weakCounterEligible ? 0.25 : 0;
        noUpgrade = size;
        reasons.push('Counter Weak: Raw P1/P2 + active HTF + control transfer + Route A/B');
        break;
      case 'reverseHealthyMain':
      case 'alignedReverse':
        cap = 0.25;
        size = raw === 'P1' && q3 && i.activeHtf && i.clearSweepReclaim ? 0.25 : 0;
        noUpgrade = size;
        reasons.push('Counter Healthy: active HTF Raw P1 reversal only');
        break;
      default:
        reasons.push(route === 'hardConflict' ? 'Hard Direction Conflict' : 'Direction Permission = 0');
    }
    trace.push({stage:'Route matrix', size, cap});
    // Zero cannot be revived by any later stage.
    const blockUpgrade = neg === 'Medium' || (raw === 'P3' && i.p3Context === 'MID' && i.structured);
    if (blockUpgrade) {
      size = Math.min(size, noUpgrade);
      reasons.push(neg === 'Medium' ? 'Q2 Medium Negative: block upgrade' : 'MID + Structured: block upgrade');
    }
    if (raw === 'P3' && (e || i.p3Context === 'EXT')) {
      size = Math.min(size, 0.5);
      if (i.p3Context === 'EXT') reasons.push('P3-EXT conservative cap 0.5');
    }
    if (neg === 'High') { size = down(size); reasons.push('Q2 High Negative: one-step downgrade'); }
    trace.push({stage:'Location / Negative', size});
    size = Math.min(size, cap, number(i.setupCap) ?? 1);
    if (i.rangeState === 'outside') { size = down(size); reasons.push('Range outside favorable 25%'); }
    if (i.obstacleState === 'inside') { size = down(size); reasons.push('HTF obstacle: one-step downgrade'); }
    const rr = number(i.firstObstacleR);
    if (raw === 'P4' || p === 'P4' || q === 'Q1' || !['Q2','Q3'].includes(q) || i.rangeMiddle || i.rangeState === 'middle' || i.controlNegated || (i.hardVetoes || []).length || ['pending','veto'].includes(i.obstacleState) || (rr !== null && rr < 1.5)) {
      size = 0;
      reasons.push('Location / Control / RR / Hard Veto');
    }
    trace.push({stage:'Final Candidate', size});
    const clean = !['inside','rfManaged','pending','veto'].includes(i.obstacleState) && (rr === null || rr >= 2);
    let objective = 'N/A';
    if (size > 0) {
      objective = route === 'healthyAligned' && q3 && clean && i.p3Context !== 'EXT' ? 'Expansion'
        : ['healthyAligned','weakAligned','transitionConfirmed','directionalNeutral'].includes(route) && q3 && clean ? 'Reaction-first' : 'Reaction';
    }
    const counter = ['reverseWeakMain','reverseHealthyMain','alignedReverse'].includes(route);
    const runner = size > 0 && q3 && clean && !counter && !i.controlNegated && !i.strongOppositeAcceptance && !(raw === 'P3' && i.p3Context === 'MID' && i.structured);
    return {version:VERSION, route, routeCap:cap, size, valid:yes(size > 0), objective, runnerEligibility:runner ? 'Conditional' : 'No', negative:neg, reasons:[...new Set(reasons)], trace};
  }

  function management(snapshot, outcome = {}) {
    const o = outcome, c = snapshot?.candidate;
    const entered = o.shadowTrade === 'Yes';
    const reached = o.reached2R === 'Yes';
    const all = ['break','acceptance','hold','extend'].every(k => o[k] === true);
    const gateRecorded = o.gateRecorded === 'Yes';
    const weakMainChanged = c?.route === 'reverseWeakMain' && c.size > 0 && o.mainTransitionConfirmed === true && !snapshot?.candidateInputs?.strongOppositeAcceptance && !snapshot?.candidateInputs?.controlNegated && (number(snapshot?.candidateInputs?.firstObstacleR) === null || number(snapshot?.candidateInputs?.firstObstacleR) >= 2) && !['inside','rfManaged','pending','veto'].includes(snapshot?.candidateInputs?.obstacleState);
    const conditional = c?.runnerEligibility === 'Conditional' || weakMainChanged;
    const active = entered && reached && conditional && gateRecorded && all;
    // MFE never determines path, SL chronology, gate, or the runner fill.
    const exit = number(o.runnerExitR), manual = number(o.managementUnitR);
    let unitR = null;
    if (entered && c?.size > 0) {
      if (!reached) unitR = manual;
      else if (!conditional) unitR = manual;
      else if (gateRecorded) unitR = active ? (exit === null ? null : round(1.6 + 0.2 * exit)) : 2;
    }
    return {runnerAllowedAt2R:yes(conditional), initiativeConfirmed:yes(reached && gateRecorded && all), runnerActivated:yes(active), unitR, weightedR:unitR === null ? null : round(unitR * c.size)};
  }

  function normalizeRecord(record) {
    const r = {...record};
    if (r.dualTrackSnapshot?.production) {
      r.finalSize = r.dualTrackSnapshot.production.size;
      r.v13Objective = r.dualTrackSnapshot.production.objective;
      r.objectiveAtEntry = r.v13Objective;
    }
    r.validCandidate = yes((number(r.finalSize) ?? 0) > 0);
    r.reachedTP2 = yes((number(r.mfeR) ?? -Infinity) > 3.9);
    r.v13ProductionSize = number(r.finalSize) ?? 0;
    r.v13ProductionValidCandidate = r.validCandidate;
    r.productionEntry = yes(r.entryStatus === 'Entry' && r.v13ProductionSize > 0);
    r.v13ActualR = r.productionEntry === 'Yes' ? number(r.actualR ?? r.profitR) : null;
    const snap = r.dualTrackSnapshot;
    if (!snap?.candidate || !snap?.production) return r; // Never backfill a prospective V1.4 decision for old trades.
    const c = snap.candidate, o = r.v14Outcome || {};
    r.v14CandidateSize = c.size;
    r.v14CandidateValid = c.valid;
    r.v14Objective = c.objective;
    r.v14RunnerEligibility = c.runnerEligibility;
    r.v14SizeChangeReason = c.reasons.join(' | ');
    r.v14ShadowTrade = yes(o.shadowTrade === 'Yes' && c.size > 0);
    const m = management(snap, o);
    r.v14ShadowManagementR = m.unitR;
    r.v14ShadowR = m.weightedR;
    r.v14RunnerActivated = m.runnerActivated;
    const actual = r.v13ActualR;
    const unit = actual !== null && r.v13ProductionSize > 0 ? actual / r.v13ProductionSize : null;
    r.v14SizeOnlyR = r.productionEntry === 'Yes' ? (c.size === 0 ? 0 : unit === null ? null : round(unit * c.size)) : null;
    // Runner-only must also be measured when V1.4 size rules veto a V1.3 trade.
    // In that case the Candidate runner is No, so unchanged Production management is used.
    r.v14RunnerOnlyR = r.productionEntry === 'Yes' ? (m.runnerAllowedAt2R === 'No' ? actual : m.unitR === null ? null : round(m.unitR * r.v13ProductionSize)) : null;
    r.v14FullR = c.size === 0 ? 0 : m.weightedR;
    r.v14CandidateOnly = yes(r.v13ProductionSize === 0 && c.size > 0);
    r.v14CandidateOnlyBaseR = r.v14CandidateOnly === 'Yes' && number(o.baseUnitR) !== null && r.v14ShadowTrade === 'Yes' ? round(number(o.baseUnitR) * c.size) : null;
    r.v14SizeChanged = yes(c.size !== snap.production.size);
    r.v14DecisionChanged = yes(c.size !== snap.production.size || c.objective !== snap.production.objective || m.runnerActivated === 'Yes');
    r.v14DeltaR = r.productionEntry === 'Yes' && actual !== null && r.v14FullR !== null ? round(r.v14FullR - actual) : null;
    return r;
  }

  const api = {VERSION, number, down, classify, negative, calculate, management, normalizeRecord};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MasterTradeShadow = Object.freeze(api);
})(typeof globalThis === 'object' ? globalThis : this);
