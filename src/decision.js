// Stage 5 MVP — Simple Market Decision Engine
//
// Purpose:
// Convert current market state + historical evidence
// into a simple CALL / PUT / NO TRADE decision.
//
// This is intentionally simple.
// Do NOT add ML, scoring, options logic, or complex
// regime logic at this stage.

const MIN_SAMPLES = 20;

const MIN_DIRECTION_PCT = 60;

function getDecisionFromEvidence(evidence) {
  if (!evidence) {
    return {
      decision: "NO TRADE",
      reason: "No historical evidence available."
    };
  }

  const samples = Number(evidence.samples || 0);

  if (samples < MIN_SAMPLES) {
    return {
      decision: "NO TRADE",
      reason: `Insufficient historical samples (${samples}/${MIN_SAMPLES}).`
    };
  }

  const five = evidence.outcomes?.["5m"];
  const ten = evidence.outcomes?.["10m"];

  if (!five || !ten) {
    return {
      decision: "NO TRADE",
      reason: "Required 5m/10m historical outcomes are unavailable."
    };
  }

  const fiveUp = Number(five.up_pct || 0);
  const tenUp = Number(ten.up_pct || 0);

  const fiveDown = Number(five.down_pct || 0);
  const tenDown = Number(ten.down_pct || 0);

  const fiveMove = Number(five.avg_move_points || 0);
  const tenMove = Number(ten.avg_move_points || 0);

  // CALL condition
  if (
    fiveUp >= MIN_DIRECTION_PCT &&
    tenUp >= MIN_DIRECTION_PCT &&
    fiveMove > 0 &&
    tenMove > 0
  ) {
    return {
      decision: "CALL",
      reason: "Historical evidence favors upward movement.",
      evidence: {
        samples,
        five_min_up_pct: fiveUp,
        ten_min_up_pct: tenUp,
        five_min_avg_move: fiveMove,
        ten_min_avg_move: tenMove
      }
    };
  }

  // PUT condition
  if (
    fiveDown >= MIN_DIRECTION_PCT &&
    tenDown >= MIN_DIRECTION_PCT &&
    fiveMove < 0 &&
    tenMove < 0
  ) {
    return {
      decision: "PUT",
      reason: "Historical evidence favors downward movement.",
      evidence: {
        samples,
        five_min_down_pct: fiveDown,
        ten_min_down_pct: tenDown,
        five_min_avg_move: fiveMove,
        ten_min_avg_move: tenMove
      }
    };
  }

  return {
    decision: "NO TRADE",
    reason: "Historical evidence does not show a sufficiently consistent direction.",
    evidence: {
      samples,
      five_min_up_pct: fiveUp,
      ten_min_up_pct: tenUp,
      five_min_avg_move: fiveMove,
      ten_min_avg_move: tenMove
    }
  };
}

export {
  getDecisionFromEvidence
};
