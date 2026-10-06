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

const DEFAULT_STOP_POINTS = 50;
const DEFAULT_TARGET_POINTS = 100;

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

  if(!value)
    return new Date().toISOString();

  const d = new Date(value);

  return Number.isNaN(d.getTime())
    ? new Date().toISOString()
    : d.toISOString();
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
    `).bind(safeLimit).all();

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
    stopPoints = DEFAULT_STOP_POINTS,
    targetPoints = DEFAULT_TARGET_POINTS
  }
){

  const normalizedDirection =
    normalizeDirection(direction);

  const price = num(entryPrice);

  if(!normalizedDirection){

    return {
      opened: false,
      reason: "Invalid trade direction."
    };
  }

  if(price === null){

    return {
      opened: false,
      reason: "Entry price is unavailable."
    };
  }

  const existing =
    await getActivePaperTrade(db);

  if(existing){

    return {
      opened: false,
      reason: "A paper trade is already open.",
      trade: existing
    };
  }

  const samples =
    Number(evidenceSamples || 0);

  if(samples < 20){

    return {
      opened: false,
      reason:
        `Insufficient evidence (${samples}/20 samples required).`
    };
  }

  const stop =
    Number(stopPoints);

  const target =
    Number(targetPoints);

  if(
    !Number.isFinite(stop) ||
    stop <= 0
  ){

    return {
      opened: false,
      reason: "Invalid stop-loss points."
    };
  }

  if(
    !Number.isFinite(target) ||
    target <= 0
  ){

    return {
      opened: false,
      reason: "Invalid target points."
    };
  }

  let stopLoss;
  let targetPrice;

  if(normalizedDirection === "CALL"){

    stopLoss = price - stop;
    targetPrice = price + target;

  }else{

    stopLoss = price + stop;
    targetPrice = price - target;
  }

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
    opened: true,

    trade: {
      id: tradeId,
      status: "OPEN",
      direction: normalizedDirection,
      entry_time: normalizedEntryTime,
      entry_price: price,
      stop_loss: stopLoss,
      target: targetPrice,
      evidence_samples: samples
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
      price - Number(trade.entry_price);

  }else{

    pnlPoints =
      Number(trade.entry_price) - price;
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
      exit_time: normalizedExitTime,
      exit_price: price,
      result,
      pnl_points: pnlPoints,
      exit_reason: exitReason || "MANUAL"
    }
  };
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
    snapshot.raw_payload || snapshot;

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
      reason: "Current price unavailable.",
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
      reason: "Waiting for a snapshot after entry.",
      trade
    };
  }

  const stop =
    Number(trade.stop_loss);

  const target =
    Number(trade.target);

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
      current_price: currentPrice,
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
      current_price: currentPrice,
      unrealized_pnl_points:
        Number(trade.entry_price) -
        currentPrice
    };
  }

  return {
    action: "WAIT",
    reason: "Unknown trade direction.",
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
    currentState
  }
){

  if(!decision){

    return {
      action: "NO_DECISION",
      reason: "Decision data unavailable."
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
    Number(evidence.samples || 0);

  const price =
    num(
      currentState?.price
    );

  if(price === null){

    return {
      action: "NO_ENTRY",
      reason:
        "Current SENSEX price is unavailable."
    };
  }

  return openPaperTrade(
    db,
    {
      direction,

      entryTime:
        currentState?.event_time ||
        new Date().toISOString(),

      entryPrice:
        price,

      decisionReason:
        decision.reason,

      evidenceSamples:
        samples,

      stopPoints:
        DEFAULT_STOP_POINTS,

      targetPoints:
        DEFAULT_TARGET_POINTS
    }
  );
}


// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------

export {
  DEFAULT_STOP_POINTS,
  DEFAULT_TARGET_POINTS,

  initPaperTradeDb,

  getActivePaperTrade,
  getPaperTrades,

  openPaperTrade,
  closePaperTrade,

  evaluatePaperTrade,
  processPaperTrade
};
