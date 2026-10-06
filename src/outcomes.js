const HORIZONS = [
  { key: "1m", minutes: 1, maxLagSeconds: 90 },
  { key: "5m", minutes: 5, maxLagSeconds: 120 },
  { key: "10m", minutes: 10, maxLagSeconds: 180 },
  { key: "20m", minutes: 20, maxLagSeconds: 300 }
];

function toNumber(v) {
  if (v === undefined || v === null || v === "") return null;

  const n = Number(v);

  return Number.isFinite(n) ? n : null;
}

function parseDate(v) {
  if (!v) return null;

  const d = new Date(v);

  return Number.isNaN(d.getTime()) ? null : d;
}

function pctMove(from, to) {
  if (
    !Number.isFinite(from) ||
    !Number.isFinite(to) ||
    from === 0
  ) {
    return null;
  }

  return ((to - from) / from) * 100;
}

function snapshotState(payload) {
  return {
    rsi: toNumber(payload.rsi),

    trend: payload.trend ?? null,

    volume_state: payload.volume_state ?? null,

    volume_ratio: toNumber(payload.volume_ratio),

    vwap: payload.vwap ?? null,

    vwap_distance: toNumber(payload.vwap_distance),

    or_state: payload.or_state ?? null,

    or_high: toNumber(payload.or_high),

    or_low: toNumber(payload.or_low),

    vpc_zone: payload.vpc_zone ?? null,

    vpc_mid: toNumber(payload.vpc_mid),

    adr_used_pct: toNumber(payload.adr_used_pct),

    vix: toNumber(payload.vix),

    session: payload.session ?? null,

    atm_strike: toNumber(payload.atm_strike)
  };
}

function parseRow(row) {
  let payload = {};

  try {
    payload = JSON.parse(row.raw_payload || "{}");
  } catch {
    payload = {};
  }

  const eventTime = parseDate(
    row.event_time || row.received_at
  );

  const price = toNumber(
    row.price ?? payload.price
  );

  return {
    id: row.id,

    event_time: eventTime,

    price,

    ticker: row.ticker,

    exchange: row.exchange,

    timeframe: row.timeframe,

    event: row.event,

    payload
  };
}

function findFutureSnapshot(
  rows,
  targetTime,
  maxLagSeconds
) {
  for (const row of rows) {
    if (!row.event_time) continue;

    const diffSeconds = Math.round(
      (
        row.event_time.getTime() -
        targetTime.getTime()
      ) / 1000
    );

    // Snapshot is before the required target time.
    if (diffSeconds < 0) {
      continue;
    }

    // First snapshot at or after the target time
    // and within the allowed tolerance.
    if (diffSeconds <= maxLagSeconds) {
      return {
        row,
        lag_seconds: diffSeconds
      };
    }

    // Rows are sorted ascending.
    // Once we are beyond the tolerance, there
    // cannot be a valid match for this target.
    break;
  }

  return null;
}

export async function calculateOutcomes(
  db,
  requestedLimit = 500
) {
  const limit = Math.max(
    1,
    Math.min(
      Number(requestedLimit) || 500,
      2000
    )
  );

  /*
   * Pull extra rows because every source snapshot
   * needs future observations up to 20 minutes later.
   */
  const fetchLimit = Math.min(
    limit + 50,
    2050
  );

  /*
   * IMPORTANT:
   *
   * We fetch the LATEST snapshots first.
   *
   * The previous version used ASC + LIMIT, which
   * selected the oldest snapshots in the database.
   *
   * We then reverse the result so that the outcome
   * calculation operates chronologically.
   */
  const result = await db
    .prepare(`
      SELECT
        id,
        received_at,
        event_time,
        ticker,
        exchange,
        timeframe,
        event,
        price,
        raw_payload
      FROM signals
      WHERE event = 'MARKET_SNAPSHOT'
        AND event_time IS NOT NULL
      ORDER BY event_time DESC, id DESC
      LIMIT ?
    `)
    .bind(fetchLimit)
    .all();

  /*
   * D1 returns newest → oldest.
   *
   * Reverse it so the rest of the algorithm has:
   *
   * oldest → newest
   */
  const rows = (result.results || [])
    .map(parseRow)
    .filter(
      r =>
        r.event_time &&
        Number.isFinite(r.price)
    )
    .reverse();

  /*
   * Because we already selected the latest
   * snapshots from D1, the rows themselves are
   * the relevant recent dataset.
   *
   * Keep only the requested number of SOURCE
   * snapshots.
   *
   * We intentionally keep the extra rows in
   * `rows` because they are needed as future
   * observations for 20-minute outcomes.
   */
  const sourceRows = rows.slice(
    Math.max(0, rows.length - limit)
  );

  const output = [];

  for (const source of sourceRows) {
    const outcomes = {};

    for (const horizon of HORIZONS) {
      /*
       * Exact theoretical target time.
       *
       * Example:
       * source = 10:30
       * 5m target = 10:35
       */
      const targetTime = new Date(
        source.event_time.getTime() +
        horizon.minutes * 60 * 1000
      );

      /*
       * Find the first actual TradingView
       * snapshot at or after the target time.
       *
       * This protects us against small delivery
       * delays or missing individual minutes.
       */
      const match = findFutureSnapshot(
        rows,
        targetTime,
        horizon.maxLagSeconds
      );

      /*
       * No valid future snapshot yet.
       *
       * This is normal for the latest snapshots,
       * especially for 10m / 20m horizons.
       */
      if (!match) {
        outcomes[horizon.key] = null;
        continue;
      }

      const future = match.row;

      /*
       * SENSEX movement in points.
       */
      const move =
        future.price - source.price;

      /*
       * SENSEX movement in percentage.
       */
      const movePct = pctMove(
        source.price,
        future.price
      );

      outcomes[horizon.key] = {
        target_time:
          targetTime.toISOString(),

        actual_time:
          future.event_time.toISOString(),

        lag_seconds:
          match.lag_seconds,

        price:
          future.price,

        move_points:
          Number(move.toFixed(2)),

        move_pct:
          movePct == null
            ? null
            : Number(movePct.toFixed(4)),

        direction:
          move > 0
            ? "UP"
            : move < 0
              ? "DOWN"
              : "FLAT"
      };
    }

    output.push({
      id: source.id,

      event_time:
        source.event_time.toISOString(),

      ticker:
        source.ticker,

      exchange:
        source.exchange,

      timeframe:
        source.timeframe,

      price:
        source.price,

      state:
        snapshotState(source.payload),

      outcomes
    });
  }

  return {
    generated_at:
      new Date().toISOString(),

    count:
      output.length,

    horizons:
      HORIZONS.map(h => h.key),

    note:
      "Outcomes use the first later MARKET_SNAPSHOT at or after the target horizon, within the configured tolerance.",

    outcomes:
      output
  };
}
