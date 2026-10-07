const MIN_SAMPLES = 20;

const MIN_DIRECTION_PCT = 60;

function num(v){
  const n = Number(v);

  return Number.isFinite(n)
    ? n
    : null;
}

function getOutcome(
  evidence,
  horizon
){
  return (
    evidence
      ?.outcomes
      ?. [horizon] || null
  );
}

function buildEvidenceSummary(
  evidence
){
  const five =
    getOutcome(
      evidence,
      "5m"
    );

  const ten =
    getOutcome(
      evidence,
      "10m"
    );

  return {
    samples:
      Number(
        evidence?.samples || 0
      ),

    five_min_up_pct:
      num(five?.up_pct),

    ten_min_up_pct:
      num(ten?.up_pct),

    five_min_down_pct:
      num(five?.down_pct),

    ten_min_down_pct:
      num(ten?.down_pct),

    five_min_avg_move:
      num(five?.avg_move_points),

    ten_min_avg_move:
      num(ten?.avg_move_points)
  };
}


function getDecisionFromEvidence(
  evidence
){

  if(!evidence){

    return {
      decision:"NO TRADE",

      reason:
        "Historical evidence is unavailable.",

      evidence:{}
    };
  }


  const summary =
    buildEvidenceSummary(
      evidence
    );


  const trend =
    String(
      evidence?.state?.trend ||
      evidence?.trend ||
      "NEUTRAL"
    ).toUpperCase();


  /*
   * --------------------------------------------------
   * Minimum evidence
   * --------------------------------------------------
   */

  if(
    summary.samples <
    MIN_SAMPLES
  ){

    return {
      decision:"NO TRADE",

      reason:
        "Insufficient historical evidence.",

      evidence:summary
    };
  }


  /*
   * --------------------------------------------------
   * CALL setup
   * --------------------------------------------------
   */

  const callEvidence =
    summary.five_min_up_pct !== null &&
    summary.ten_min_up_pct !== null &&
    summary.five_min_avg_move !== null &&
    summary.ten_min_avg_move !== null &&

    summary.five_min_up_pct >=
      MIN_DIRECTION_PCT &&

    summary.ten_min_up_pct >=
      MIN_DIRECTION_PCT &&

    summary.five_min_avg_move > 0 &&

    summary.ten_min_avg_move > 0;


  /*
   * --------------------------------------------------
   * PUT setup
   * --------------------------------------------------
   */

  const putEvidence =
    summary.five_min_down_pct !== null &&
    summary.ten_min_down_pct !== null &&
    summary.five_min_avg_move !== null &&
    summary.ten_min_avg_move !== null &&

    summary.five_min_down_pct >=
      MIN_DIRECTION_PCT &&

    summary.ten_min_down_pct >=
      MIN_DIRECTION_PCT &&

    summary.five_min_avg_move < 0 &&

    summary.ten_min_avg_move < 0;


  /*
   * --------------------------------------------------
   * Directional sanity filter
   *
   * BULL -> CALL only
   * BEAR -> PUT only
   * NEUTRAL -> either direction
   * --------------------------------------------------
   */

  if(
    trend === "BEAR" &&
    callEvidence
  ){

    return {
      decision:"NO TRADE",

      reason:
        "Historical evidence favors CALL, but the current market trend is BEAR. Directional conflict.",

      evidence:summary
    };
  }


  if(
    trend === "BULL" &&
    putEvidence
  ){

    return {
      decision:"NO TRADE",

      reason:
        "Historical evidence favors PUT, but the current market trend is BULL. Directional conflict.",

      evidence:summary
    };
  }


  /*
   * --------------------------------------------------
   * Qualified CALL
   * --------------------------------------------------
   */

  if(
    callEvidence &&
    (
      trend === "BULL" ||
      trend === "NEUTRAL"
    )
  ){

    return {
      decision:"CALL",

      reason:
        "Historical evidence favors upward movement.",

      evidence:summary
    };
  }


  /*
   * --------------------------------------------------
   * Qualified PUT
   * --------------------------------------------------
   */

  if(
    putEvidence &&
    (
      trend === "BEAR" ||
      trend === "NEUTRAL"
    )
  ){

    return {
      decision:"PUT",

      reason:
        "Historical evidence favors downward movement.",

      evidence:summary
    };
  }


  /*
   * --------------------------------------------------
   * Nothing qualifies
   * --------------------------------------------------
   */

  return {
    decision:"NO TRADE",

    reason:
      "Historical evidence does not show a sufficiently consistent direction.",

    evidence:summary
  };
}


export {
  getDecisionFromEvidence
};
