// Stage 6 MVP — Paper Trade Engine
//
// Purpose:
// Track hypothetical CALL / PUT trades using SENSEX price movement.
//
// IMPORTANT:
// - This is NOT real trading.
// - This does NOT place broker orders.
// - This does NOT use option premiums yet.
// - P&L is measured in SENSEX points.
// - Keep this intentionally simple for the first end-to-end model.


const DEFAULT_RISK_REWARD = 2.0;

const MIN_RISK_REWARD = 1.5;

const MIN_STRUCTURE_BUFFER = 10;


const VALID_DIRECTIONS = new Set([
  "CALL",
  "PUT"
]);


// ------------------------------------------------------------
// Database
// ------------------------------------------------------------

async function initPaperTradeDb(db){

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS paper_trades (

      id INTEGER PRIMARY KEY AUTOINCREMENT,

      status TEXT NOT NULL,

      direction TEXT NOT NULL,

      entry_time TEXT NOT NULL,
      entry_price REAL NOT NULL,

      stop_loss REAL NOT NULL,
      target REAL NOT NULL,

      exit_time TEXT,
      exit_price REAL,

      result TEXT,

      pnl_points REAL,

      exit_reason TEXT,

      decision_reason TEXT,

      evidence_samples INTEGER,

      created_at TEXT NOT NULL

    )
  `).run();
}


// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function num(v){

  if(
    v === undefined ||
    v === null ||
    v === ""
  ){
    return null;
  }

  const n = Number(v);

  return Number.isFinite(n)
    ? n
    : null;
}


function normalizeDirection(value){

  const direction =
    String(value || "")
      .trim()
      .toUpperCase();

  return VALID_DIRECTIONS.has(direction)
    ? direction
    : null;
}


function normalizeTime(value){

  if(!value){
    return new Date().toISOString();
  }

  const d = new Date(value);

  return Number.isNaN(d.getTime())
    ? new Date().toISOString()
    : d.toISOString();
}

function calculateDynamicTradeLevels(
  direction,
  entryPrice,
  marketData
){

  const payload =
    marketData?.raw_payload ||
    marketData ||
    {};


  const price =
    Number(entryPrice);


  if(
    !Number.isFinite(price)
  ){

    return {
      valid:false,
      reason:
        "Entry price is unavailable."
    };
  }


  const support =
    num(
      payload.nearest_support
    );

  const resistance =
    num(
      payload.nearest_resistance
    );

  const tolerance =
    Math.max(
      num(payload.sr_tolerance) || 0,
      0
    );

  const breakBuffer =
    Math.max(
      num(payload.sr_break_buffer) || 0,
      0
    );


  /*
   * Structural buffer.
   *
   * The stop must sit beyond the
   * actual invalidation zone.
   */

  const buffer =
    Math.max(
      breakBuffer,
      tolerance,
      MIN_STRUCTURE_BUFFER
    );


  let stopLoss;
  let targetPrice;


  /*
   * --------------------------------------------------
   * CALL
   * --------------------------------------------------
   */

  if(
    direction === "CALL"
  ){

    if(
      support === null ||
      support >= price
    ){

      return {
        valid:false,
        reason:
          "No valid support exists below CALL entry."
      };
    }


    stopLoss =
      support -
      buffer;


    const risk =
      price -
      stopLoss;


    if(
      !Number.isFinite(risk) ||
      risk <= 0
    ){

      return {
        valid:false,
        reason:
          "Invalid structural risk for CALL."
      };
    }


    /*
     * Prefer the nearest resistance
     * as the first structural target.
     */

    if(
      resistance !== null &&
      resistance > price
    ){

      targetPrice =
        resistance -
        buffer;

    }else{

      targetPrice =
        price +
        (
          risk *
          DEFAULT_RISK_REWARD
        );
    }


    const reward =
      targetPrice -
      price;


    /*
     * If resistance is too close,
     * the trade is not attractive.
     */

    if(
      reward <= 0 ||
      reward <
        risk * MIN_RISK_REWARD
    ){

      return {
        valid:false,
        reason:
          "CALL rejected because the next resistance does not provide enough reward for the structural risk."
      };
    }


    return {

      valid:true,

      stopLoss,

      targetPrice,

      riskPoints:risk,

      rewardPoints:reward,

      stopReason:
        "Below nearest support + structural break buffer.",

      targetReason:
        resistance !== null &&
        resistance > price
          ? "Before nearest resistance."
          : "Dynamic 2R target because no usable resistance is available."
    };
  }


  /*
   * --------------------------------------------------
   * PUT
   * --------------------------------------------------
   */

  if(
    direction === "PUT"
  ){

    if(
      resistance === null ||
      resistance <= price
    ){

      return {
        valid:false,
        reason:
          "No valid resistance exists above PUT entry."
      };
    }


    stopLoss =
      resistance +
      buffer;


    const risk =
      stopLoss -
      price;


    if(
      !Number.isFinite(risk) ||
      risk <= 0
    ){

      return {
        valid:false,
        reason:
          "Invalid structural risk for PUT."
      };
    }


    /*
     * Prefer nearest support
     * as the first structural target.
     */

    if(
      support !== null &&
      support < price
    ){

      targetPrice =
        support +
        buffer;

    }else{

      targetPrice =
        price -
        (
          risk *
          DEFAULT_RISK_REWARD
        );
    }


    const reward =
      price -
      targetPrice;


    if(
      reward <= 0 ||
      reward <
        risk * MIN_RISK_REWARD
    ){

      return {
        valid:false,
        reason:
          "PUT rejected because the next support does not provide enough reward for the structural risk."
      };
    }


    return {

      valid:true,

      stopLoss,

      targetPrice,

      riskPoints:risk,

      rewardPoints:reward,

      stopReason:
        "Above nearest resistance + structural break buffer.",

      targetReason:
        support !== null &&
        support < price
          ? "Before nearest support."
          : "Dynamic 2R target because no usable support is available."
    };
  }


  return {
    valid:false,
    reason:
      "Unknown trade direction."
  };
}
// ------------------------------------------------------------
// Get active trade
// ------------------------------------------------------------

async function getActivePaperTrade(db){

  const result =
    await db.prepare(`
      SELECT
        id,
        status,
        direction,
        entry_time,
        entry_price,
        stop_loss,
        target,
        exit_time,
        exit_price,
        result,
        pnl_points,
        exit_reason,
        decision_reason,
        evidence_samples,
        created_at
      FROM paper_trades
      WHERE status = 'OPEN'
      ORDER BY id DESC
      LIMIT 1
    `).all();

  return result.results?.[0] || null;
}


// ------------------------------------------------------------
// Get recent trades
// ------------------------------------------------------------
//
// Returns both OPEN and CLOSED trades.
//
// The dashboard can use this list for the
// collapsible Trade History section.
//
// The most recent trade is returned first.
//

async function getPaperTrades(db, limit = 50){

  const safeLimit =
    Math.max(
      1,
      Math.min(
        Number(limit) || 50,
        200
      )
    );

  const result =
    await db.prepare(`
      SELECT
        id,
        status,
        direction,
        entry_time,
        entry_price,
        stop_loss,
        target,
        exit_time,
        exit_price,
        result,
        pnl_points,
        exit_reason,
        decision_reason,
        evidence_samples,
        created_at
      FROM paper_trades
      ORDER BY id DESC
      LIMIT ?
    `)
    .bind(safeLimit)
    .all();

  return result.results || [];
}


// ------------------------------------------------------------
// Open a new paper trade
// ------------------------------------------------------------

async function openPaperTrade(
  db,
  {
    direction,
    entryTime,
    entryPrice,
    decisionReason,
    evidenceSamples,
    snapshot
  }
){

  const normalizedDirection =
    normalizeDirection(direction);

  const price =
    num(entryPrice);

  if(!normalizedDirection){

    return {
      opened:false,
      reason:"Invalid trade direction."
    };
  }

  if(price === null){

    return {
      opened:false,
      reason:"Entry price is unavailable."
    };
  }


  // Never allow more than one active paper trade.

  const existing =
    await getActivePaperTrade(db);

  if(existing){

    return {
      opened:false,
      reason:"A paper trade is already open.",
      trade:existing
    };
  }


  const samples =
    Number(evidenceSamples || 0);

  if(samples < 20){

    return {
      opened:false,
      reason:
        `Insufficient evidence (${samples}/20 samples required).`
    };
  }


  /*
   * ----------------------------------------------------------
   * Dynamic structural SL / target
   * ----------------------------------------------------------
   */

  const levels =
    calculateDynamicTradeLevels(
      normalizedDirection,
      price,
      snapshot
    );


  if(!levels.valid){

    return {
      opened:false,
      reason:
        levels.reason ||
        "Dynamic risk engine rejected the trade."
    };
  }


  const stopLoss =
    levels.stopLoss;

  const targetPrice =
    levels.targetPrice;


  const createdAt =
    new Date().toISOString();

  const normalizedEntryTime =
    normalizeTime(entryTime);


  const result =
    await db.prepare(`
      INSERT INTO paper_trades
      (
        status,
        direction,
        entry_time,
        entry_price,
        stop_loss,
        target,
        exit_time,
        exit_price,
        result,
        pnl_points,
        exit_reason,
        decision_reason,
        evidence_samples,
        created_at
      )
      VALUES (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        ?,
        ?,
        ?
      )
    `)
    .bind(
      "OPEN",
      normalizedDirection,
      normalizedEntryTime,
      price,
      stopLoss,
      targetPrice,
      decisionReason || "",
      samples,
      createdAt
    )
    .run();


  const tradeId =
    result.meta?.last_row_id ?? null;


  return {
    opened:true,

    trade:{
      id:tradeId,
      status:"OPEN",
      direction:normalizedDirection,
      entry_time:normalizedEntryTime,
      entry_price:price,
      stop_loss:stopLoss,
      target:targetPrice,

      risk_points:
        levels.riskPoints,

      reward_points:
        levels.rewardPoints,

      risk_reward:
        levels.rewardPoints /
        levels.riskPoints,

      stop_reason:
        levels.stopReason,

      target_reason:
        levels.targetReason,

      evidence_samples:samples
    }
  };
}

// ------------------------------------------------------------
// Close a paper trade
// ------------------------------------------------------------

async function closePaperTrade(
  db,
  trade,
  exitPrice,
  exitTime,
  exitReason
){

  const price =
    num(exitPrice);

  if(price === null){

    return {
      closed: false,
      reason: "Exit price is unavailable."
    };
  }


  let pnlPoints;


  if(trade.direction === "CALL"){

    pnlPoints =
      price -
      Number(trade.entry_price);

  }else{

    pnlPoints =
      Number(trade.entry_price) -
      price;
  }


  const result =
    pnlPoints > 0
      ? "WIN"
      : pnlPoints < 0
        ? "LOSS"
        : "FLAT";


  const normalizedExitTime =
    normalizeTime(exitTime);


  await db.prepare(`
    UPDATE paper_trades
    SET
      status = 'CLOSED',
      exit_time = ?,
      exit_price = ?,
      result = ?,
      pnl_points = ?,
      exit_reason = ?
    WHERE id = ?
      AND status = 'OPEN'
  `)
  .bind(
    normalizedExitTime,
    price,
    result,
    pnlPoints,
    exitReason || "MANUAL",
    trade.id
  )
  .run();


  return {
    closed: true,

    trade: {
      ...trade,

      status: "CLOSED",

      exit_time:
        normalizedExitTime,

      exit_price:
        price,

      result,

      pnl_points:
        pnlPoints,

      exit_reason:
        exitReason || "MANUAL"
    }
  };
}

function calculateTrailingStop(
  trade,
  payload,
  currentPrice
){

  const entry =
    Number(
      trade.entry_price
    );

  const currentStop =
    Number(
      trade.stop_loss
    );

  const target =
    Number(
      trade.target
    );


  if(
    !Number.isFinite(entry) ||
    !Number.isFinite(currentStop) ||
    !Number.isFinite(target) ||
    !Number.isFinite(currentPrice)
  ){

    return null;
  }


  const totalMove =
    Math.abs(
      target-entry
    );


  if(
    totalMove <= 0
  ){

    return null;
  }


  let favorableMove;


  if(
    trade.direction === "CALL"
  ){

    favorableMove =
      currentPrice-entry;

  }else{

    favorableMove =
      entry-currentPrice;
  }


  if(
    favorableMove <= 0
  ){

    return null;
  }


  const progress =
    favorableMove /
    totalMove;


  let proposedStop =
    currentStop;


  /*
   * --------------------------------------------------
   * 40% progress
   * Move to breakeven.
   * --------------------------------------------------
   */

  if(
    progress >= 0.40
  ){

    if(
      trade.direction === "CALL"
    ){

      proposedStop =
        Math.max(
          proposedStop,
          entry
        );

    }else{

      proposedStop =
        Math.min(
          proposedStop,
          entry
        );
    }
  }


  /*
   * --------------------------------------------------
   * 70% progress
   * Lock approximately 25% of
   * the achieved move.
   * --------------------------------------------------
   */

  if(
    progress >= 0.70
  ){

    const locked =
      favorableMove *
      0.25;


    if(
      trade.direction === "CALL"
    ){

      proposedStop =
        Math.max(
          proposedStop,
          entry + locked
        );

    }else{

      proposedStop =
        Math.min(
          proposedStop,
          entry - locked
        );
    }
  }


  /*
   * --------------------------------------------------
   * Structural trailing
   *
   * If a new support/resistance has
   * moved in our favour, use it.
   * --------------------------------------------------
   */

  const support =
    num(
      payload.nearest_support
    );

  const resistance =
    num(
      payload.nearest_resistance
    );

  const tolerance =
    Math.max(
      num(payload.sr_tolerance) || 0,
      0
    );

  const breakBuffer =
    Math.max(
      num(payload.sr_break_buffer) || 0,
      0
    );

  const buffer =
    Math.max(
      tolerance,
      breakBuffer,
      MIN_STRUCTURE_BUFFER
    );


  if(
    trade.direction === "CALL" &&
    support !== null &&
    support < currentPrice
  ){

    const structuralStop =
      support-buffer;

    proposedStop =
      Math.max(
        proposedStop,
        structuralStop
      );
  }


  if(
    trade.direction === "PUT" &&
    resistance !== null &&
    resistance > currentPrice
  ){

    const structuralStop =
      resistance+buffer;

    proposedStop =
      Math.min(
        proposedStop,
        structuralStop
      );
  }


  /*
   * Never widen risk.
   */

  if(
    trade.direction === "CALL"
  ){

    if(
      proposedStop >
      currentStop
    ){

      return proposedStop;
    }

  }else{

    if(
      proposedStop <
      currentStop
    ){

      return proposedStop;
    }
  }


  return null;
}
// ------------------------------------------------------------
// Evaluate an open trade against a new market snapshot
// ------------------------------------------------------------
//
// We intentionally use the snapshot HIGH / LOW when available.
// This gives the paper engine a better chance of detecting
// whether SL or target was reached during the minute.
//
// If both SL and target are touched in the same 1-minute
// candle, the exact sequence is unknown.
//
// For MVP we use the conservative assumption:
// SL is considered hit first.
// ------------------------------------------------------------

async function evaluatePaperTrade(
  db,
  trade,
  snapshot
){

  if(!trade){

    return {
      action: "NO_ACTIVE_TRADE"
    };
  }


  const payload =
    snapshot.raw_payload ||
    snapshot;


  const eventTime =
    snapshot.event_time ||
    payload.time;


  const currentPrice =
    num(
      snapshot.price ??
      payload.price ??
      payload.close
    );


  const high =
    num(
      snapshot.high ??
      payload.high
    );


  const low =
    num(
      snapshot.low ??
      payload.low
    );


  if(currentPrice === null){

    return {
      action: "WAIT",
      reason:
        "Current price unavailable.",
      trade
    };
  }


  /*
   * Never evaluate the same snapshot that opened
   * the trade.
   */

  if(
    eventTime &&
    new Date(eventTime).getTime() <=
      new Date(trade.entry_time).getTime()
  ){

    return {
      action: "WAIT",
      reason:
        "Waiting for a snapshot after entry.",
      trade
    };
  }


  let stop =
    Number(trade.stop_loss);
  
  const target =
    Number(trade.target);
  const trailingStop =
    calculateTrailingStop(
      trade,
      payload,
      currentPrice
    );
  
  
  if(
    trailingStop !== null
  ){
  
    await db.prepare(`
      UPDATE paper_trades
      SET stop_loss = ?
      WHERE id = ?
        AND status = 'OPEN'
    `)
    .bind(
      trailingStop,
      trade.id
    )
    .run();
  
    trade = {
      ...trade,
      stop_loss:
        trailingStop
    };
    stop =
      trailingStop;
}

  /*
   * CALL:
   *
   * target -> high reaches target
   * stop   -> low reaches stop
   */

  if(trade.direction === "CALL"){

    const stopHit =
      low !== null
        ? low <= stop
        : currentPrice <= stop;


    const targetHit =
      high !== null
        ? high >= target
        : currentPrice >= target;


    /*
     * Conservative rule when both happen in
     * the same minute.
     */

    if(stopHit){

      return closePaperTrade(
        db,
        trade,
        stop,
        eventTime,
        "STOP_LOSS"
      );
    }


    if(targetHit){

      return closePaperTrade(
        db,
        trade,
        target,
        eventTime,
        "TARGET"
      );
    }


    return {
      action: "HOLD",

      trade,

      current_price:
        currentPrice,

      unrealized_pnl_points:
        currentPrice -
        Number(trade.entry_price)
    };
  }


  /*
   * PUT:
   *
   * target -> low reaches target
   * stop   -> high reaches stop
   */

  if(trade.direction === "PUT"){

    const stopHit =
      high !== null
        ? high >= stop
        : currentPrice >= stop;


    const targetHit =
      low !== null
        ? low <= target
        : currentPrice <= target;


    /*
     * Conservative rule when both happen in
     * the same minute.
     */

    if(stopHit){

      return closePaperTrade(
        db,
        trade,
        stop,
        eventTime,
        "STOP_LOSS"
      );
    }


    if(targetHit){

      return closePaperTrade(
        db,
        trade,
        target,
        eventTime,
        "TARGET"
      );
    }


    return {
      action: "HOLD",

      trade,

      current_price:
        currentPrice,

      unrealized_pnl_points:
        Number(trade.entry_price) -
        currentPrice
    };
  }


  return {
    action: "WAIT",
    reason:
      "Unknown trade direction.",
    trade
  };
}


// ------------------------------------------------------------
// Main paper-trade processor
// ------------------------------------------------------------
//
// Flow:
//
// 1. Check whether an existing trade is open.
// 2. If yes, evaluate it against the latest snapshot.
// 3. If no trade is open:
//      - CALL -> open CALL
//      - PUT  -> open PUT
//      - NO TRADE -> do nothing
//
// This function is deliberately simple.
// ------------------------------------------------------------

async function processPaperTrade(
  db,
  {
    decision,
    currentState,
    snapshot
  }
){

  if(!decision){

    return {
      action: "NO_DECISION",
      reason:
        "Decision data unavailable."
    };
  }


  const activeTrade =
    await getActivePaperTrade(db);


  /*
   * An existing trade always gets priority.
   */

  if(activeTrade){

    return {
      action: "ACTIVE_TRADE",
      trade: activeTrade
    };
  }


  const direction =
    normalizeDirection(
      decision.decision
    );


  if(!direction){

    return {
      action: "NO_TRADE",
      reason:
        decision.reason ||
        "Decision is not CALL or PUT."
    };
  }


  const evidence =
    decision.evidence || {};


  const samples =
    Number(
      evidence.samples || 0
    );


const price =
  num(
    currentState?.price ??
    snapshot?.price
  );


  if(price === null){

    return {
      action: "NO_ENTRY",
      reason:
        "Current SENSEX price is unavailable."
    };
  }


  const levels =
    calculateDynamicTradeLevels(
      direction,
      price,
      snapshot
    );
  
  
  if(!levels.valid){
  
    return {
      action:"NO_ENTRY",
  
      reason:
        levels.reason ||
        "Dynamic risk engine rejected the trade."
    };
  }
  
  
  const dynamicReason =
    [
      decision.reason,
      levels.stopReason,
      levels.targetReason,
      `Risk ${levels.riskPoints.toFixed(2)} points`,
      `Reward ${levels.rewardPoints.toFixed(2)} points`,
      `R:R ${(levels.rewardPoints / levels.riskPoints).toFixed(2)}`
    ].join(" | ");
  
  return openPaperTrade(
    db,
    {
      direction,
  
      entryTime:
        currentState?.event_time ||
        snapshot?.event_time ||
        new Date().toISOString(),
  
      entryPrice:
        price,
  
      decisionReason:
        dynamicReason,
  
      evidenceSamples:
        samples,
  
      snapshot
    }
  );
}


// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------

export {
  initPaperTradeDb,

  getActivePaperTrade,
  getPaperTrades,

  openPaperTrade,
  closePaperTrade,

  evaluatePaperTrade,
  processPaperTrade
};
