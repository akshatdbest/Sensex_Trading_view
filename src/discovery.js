const HORIZONS = [
  { key: "1m", minutes: 1, maxLagSeconds: 90 },
  { key: "5m", minutes: 5, maxLagSeconds: 120 },
  { key: "10m", minutes: 10, maxLagSeconds: 180 },
  { key: "20m", minutes: 20, maxLagSeconds: 300 }
];

function num(v) {
  if (v === undefined || v === null || v === "") {
    return null;
  }

  const n = Number(v);

  return Number.isFinite(n) ? n : null;
}

function parseDate(v) {
  if (!v) return null;

  const d = new Date(v);

  return Number.isNaN(d.getTime())
    ? null
    : d;
}

function parseRow(row) {
  let payload = {};

  try {
    payload = JSON.parse(
      row.raw_payload || "{}"
    );
  } catch {
    payload = {};
  }

  return {
    id: row.id,

    event_time: parseDate(
      row.event_time || row.received_at
    ),

    price: num(
      row.price ?? payload.price
    ),

    payload
  };
}

function findFuture(rows, targetTime, maxLagSeconds) {
  let low = 0;
  let high = rows.length - 1;
  let candidate = -1;

  while (low <= high) {
    const mid =
      Math.floor((low + high) / 2);

    if (
      rows[mid].event_time.getTime() >=
      targetTime.getTime()
    ) {
      candidate = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  if (candidate === -1) {
    return null;
  }

  const row = rows[candidate];

  const lag =
    (
      row.event_time.getTime() -
      targetTime.getTime()
    ) / 1000;

  if (
    lag < 0 ||
    lag > maxLagSeconds
  ) {
    return null;
  }

  return row;
}

function outcomeFor(row, rows) {
  const result = {};

  for (const horizon of HORIZONS) {
    const target = new Date(
      row.event_time.getTime() +
      horizon.minutes * 60000
    );

    const future = findFuture(
      rows,
      target,
      horizon.maxLagSeconds
    );

    if (!future) {
      result[horizon.key] = null;
      continue;
    }

    const move =
      future.price - row.price;

    result[horizon.key] = {
      move_points:
        Number(move.toFixed(2)),

      direction:
        move > 0
          ? "UP"
          : move < 0
            ? "DOWN"
            : "FLAT"
    };
  }

  return result;
}

function rsiBucket(rsi) {
  if (!Number.isFinite(rsi)) {
    return "UNKNOWN";
  }

  if (rsi < 40) return "OVERSOLD";
  if (rsi < 50) return "WEAK";
  if (rsi < 60) return "MID";
  if (rsi < 70) return "STRONG";

  return "OVERBOUGHT";
}

/*
 * Transparent regime classifier.
 *
 * IMPORTANT:
 * These are descriptive market regimes.
 * They are NOT trading signals.
 */
function classifyRegime(row) {
  const p = row.payload || {};

  const rsi = num(p.rsi);
  const volumeRatio = num(
    p.volume_ratio
  );

  const trend =
    String(p.trend || "UNKNOWN")
      .toUpperCase();

  const volume =
    String(p.volume_state || "UNKNOWN")
      .toUpperCase();

  const vwap =
    String(p.vwap || "UNKNOWN")
      .toUpperCase();

  const orState =
    String(p.or_state || "UNKNOWN")
      .toUpperCase();

  const vpc =
    String(p.vpc_zone || "UNKNOWN")
      .toUpperCase();

  const adr = num(
    p.adr_used_pct
  );

  /*
   * BREAKOUT / MOMENTUM UP
   */
  if (
    (
      orState === "BROKE_UP" ||
      vpc === "BULL_ZONE" ||
      vpc === "EXTENDED_UP"
    ) &&
    vwap === "ABOVE" &&
    (
      trend === "BULL" ||
      (rsi !== null && rsi >= 55)
    ) &&
    (
      volume === "HIGH" ||
      (volumeRatio !== null &&
       volumeRatio >= 1.5)
    )
  ) {
    return "MOMENTUM_UP";
  }

  /*
   * BREAKOUT / MOMENTUM DOWN
   */
  if (
    (
      orState === "BROKE_DOWN" ||
      vpc === "BEAR_ZONE" ||
      vpc === "EXTENDED_DOWN"
    ) &&
    vwap === "BELOW" &&
    (
      trend === "BEAR" ||
      (rsi !== null && rsi <= 45)
    ) &&
    (
      volume === "HIGH" ||
      (volumeRatio !== null &&
       volumeRatio >= 1.5)
    )
  ) {
    return "MOMENTUM_DOWN";
  }

  /*
   * OVERSOLD / POSSIBLE MEAN REVERSION
   */
  if (
    rsi !== null &&
    rsi < 40 &&
    (
      vpc === "BEAR_ZONE" ||
      vpc === "EXTENDED_DOWN"
    )
  ) {
    return "MEAN_REVERSION_UP";
  }

  /*
   * OVERBOUGHT / POSSIBLE EXHAUSTION
   */
  if (
    rsi !== null &&
    rsi >= 70 &&
    (
      vpc === "EXTENDED_UP" ||
      adr !== null && adr >= 80
    )
  ) {
    return "EXHAUSTION_UP";
  }

  /*
   * LOW-VOLUME / NEUTRAL ENVIRONMENT
   */
  if (
    volume === "LOW" &&
    rsi !== null &&
    rsi >= 45 &&
    rsi < 60 &&
    (
      vwap === "ABOVE" ||
      vwap === "BELOW"
    )
  ) {
    return "CHOP";
  }

  /*
   * General bullish environment
   */
  if (
    trend === "BULL" &&
    vwap === "ABOVE"
  ) {
    return "BULLISH_REGIME";
  }

  /*
   * General bearish environment
   */
  if (
    trend === "BEAR" &&
    vwap === "BELOW"
  ) {
    return "BEARISH_REGIME";
  }

  return "NEUTRAL_REGIME";
}

function createStats() {
  return {
    samples: 0,
    up: 0,
    down: 0,
    flat: 0,
    moves: []
  };
}

function add(stats, outcome) {
  if (!outcome) return;

  const move =
    Number(outcome.move_points);

  if (!Number.isFinite(move)) {
    return;
  }

  stats.samples++;
  stats.moves.push(move);

  if (move > 0) {
    stats.up++;
  } else if (move < 0) {
    stats.down++;
  } else {
    stats.flat++;
  }
}

function median(values) {
  if (!values.length) {
    return null;
  }

  const sorted =
    [...values].sort(
      (a, b) => a - b
    );

  const middle =
    Math.floor(
      sorted.length / 2
    );

  if (
    sorted.length % 2 === 0
  ) {
    return (
      (
        sorted[middle - 1] +
        sorted[middle]
      ) / 2
    );
  }

  return sorted[middle];
}

function finalize(stats) {
  if (
    !stats ||
    stats.samples === 0
  ) {
    return {
      samples: 0,
      up_pct: null,
      down_pct: null,
      avg_move_points: null,
      median_move_points: null
    };
  }

  const sum =
    stats.moves.reduce(
      (a, b) => a + b,
      0
    );

  return {
    samples: stats.samples,

    up_pct: Number(
      (
        stats.up /
        stats.samples *
        100
      ).toFixed(2)
    ),

    down_pct: Number(
      (
        stats.down /
        stats.samples *
        100
      ).toFixed(2)
    ),

    avg_move_points: Number(
      (
        sum /
        stats.samples
      ).toFixed(2)
    ),

    median_move_points: Number(
      median(stats.moves)
        .toFixed(2)
    )
  };
}

function strength(samples) {
  if (samples >= 100) {
    return "STRONGER";
  }

  if (samples >= 50) {
    return "MODERATE";
  }

  if (samples >= 20) {
    return "LOW";
  }

  if (samples >= 10) {
    return "VERY_LOW";
  }

  return "INSUFFICIENT";
}

function summarizeRegime(group) {
  return {
    regime: group.regime,

    samples: group.samples,

    evidence_strength:
      strength(group.samples),

    outcomes: {
      "1m": finalize(
        group.outcomes["1m"]
      ),

      "5m": finalize(
        group.outcomes["5m"]
      ),

      "10m": finalize(
        group.outcomes["10m"]
      ),

      "20m": finalize(
        group.outcomes["20m"]
      )
    }
  };
}

/*
 * Detect transitions between consecutive
 * market regimes.
 */
function buildTransitions(items) {
  const groups = new Map();

  for (
    let i = 1;
    i < items.length;
    i++
  ) {
    const previous =
      items[i - 1].regime;

    const current =
      items[i].regime;

    if (
      previous === current
    ) {
      continue;
    }

    const key =
      previous +
      " → " +
      current;

    if (!groups.has(key)) {
      groups.set(key, {
        transition: key,
        samples: 0,

        outcomes: {
          "1m": createStats(),
          "5m": createStats(),
          "10m": createStats(),
          "20m": createStats()
        }
      });
    }

    const group =
      groups.get(key);

    group.samples++;

    for (const horizon of HORIZONS) {
      add(
        group.outcomes[
          horizon.key
        ],
        items[i].outcomes[
          horizon.key
        ]
      );
    }
  }

  return [...groups.values()]
    .map(group => ({
      transition:
        group.transition,

      samples:
        group.samples,

      evidence_strength:
        strength(group.samples),

      outcomes: {
        "1m": finalize(
          group.outcomes["1m"]
        ),

        "5m": finalize(
          group.outcomes["5m"]
        ),

        "10m": finalize(
          group.outcomes["10m"]
        ),

        "20m": finalize(
          group.outcomes["20m"]
        )
      }
    }))
    .sort(
      (a, b) =>
        b.samples -
        a.samples
    );
}

export async function calculateDiscovery(
  db,
  requestedLimit = 5000,
  minSamples = 20
) {
  const limit = Math.max(
    500,
    Math.min(
      Number(requestedLimit) || 5000,
      50000
    )
  );

  const minimumSamples =
    Math.max(
      10,
      Math.min(
        Number(minSamples) || 20,
        1000
      )
    );

  const result =
    await db.prepare(`
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
    .bind(limit)
    .all();

  const rows =
    (result.results || [])
      .map(parseRow)
      .filter(
        row =>
          row.event_time &&
          Number.isFinite(row.price)
      )
      .reverse();

  if (!rows.length) {
    return {
      generated_at:
        new Date().toISOString(),

      dataset: {
        snapshots: 0
      },

      current_regime: null,

      regimes: [],

      transitions: [],

      note:
        "Not enough MARKET_SNAPSHOT data."
    };
  }

  /*
   * Build regime + future outcomes.
   */
  const items = rows.map(row => ({
    row,

    regime:
      classifyRegime(row),

    rsi_bucket:
      rsiBucket(
        num(row.payload?.rsi)
      ),

    outcomes:
      outcomeFor(
        row,
        rows
      )
  }));

  /*
   * Regime aggregation.
   */
  const regimeMap =
    new Map();

  for (const item of items) {
    if (
      !regimeMap.has(
        item.regime
      )
    ) {
      regimeMap.set(
        item.regime,
        {
          regime:
            item.regime,

          samples: 0,

          outcomes: {
            "1m": createStats(),
            "5m": createStats(),
            "10m": createStats(),
            "20m": createStats()
          }
        }
      );
    }

    const group =
      regimeMap.get(
        item.regime
      );

    group.samples++;

    for (const horizon of HORIZONS) {
      add(
        group.outcomes[
          horizon.key
        ],
        item.outcomes[
          horizon.key
        ]
      );
    }
  }

  const regimes =
    [...regimeMap.values()]
      .map(summarizeRegime)
      .sort(
        (a, b) =>
          b.samples -
          a.samples
      );

  /*
   * Current state.
   */
  const latest =
    items[items.length - 1];

  /*
   * Transitions.
   */
  const transitions =
    buildTransitions(items)
      .filter(
        item =>
          item.samples >=
          minimumSamples
      );

  /*
   * Candidate regimes with enough
   * observations.
   */
  const usableRegimes =
    regimes.filter(
      regime =>
        regime.samples >=
        minimumSamples
    );

  return {
    generated_at:
      new Date().toISOString(),

    dataset: {
      snapshots:
        rows.length,

      earliest:
        rows[0]
          .event_time
          .toISOString(),

      latest:
        rows[rows.length - 1]
          .event_time
          .toISOString()
    },

    current_regime: {
      event_time:
        latest.row.event_time
          .toISOString(),

      price:
        latest.row.price,

      regime:
        latest.regime,

      rsi:
        num(
          latest.row.payload?.rsi
        ),

      rsi_bucket:
        latest.rsi_bucket,

      trend:
        latest.row.payload?.trend ??
        "UNKNOWN",

      volume_state:
        latest.row.payload?.volume_state ??
        "UNKNOWN",

      volume_ratio:
        num(
          latest.row.payload?.volume_ratio
        ),

      vwap:
        latest.row.payload?.vwap ??
        "UNKNOWN",

      or_state:
        latest.row.payload?.or_state ??
        "UNKNOWN",

      vpc_zone:
        latest.row.payload?.vpc_zone ??
        "UNKNOWN",

      session:
        latest.row.payload?.session ??
        "UNKNOWN"
    },

    regimes: usableRegimes,

    all_regimes: regimes,

    transitions,

    methodology: {
      purpose:
        "Discover recurring market regimes and regime transitions before introducing trading signals.",

      regime_types: [
        "MOMENTUM_UP",
        "MOMENTUM_DOWN",
        "MEAN_REVERSION_UP",
        "EXHAUSTION_UP",
        "CHOP",
        "BULLISH_REGIME",
        "BEARISH_REGIME",
        "NEUTRAL_REGIME"
      ],

      minimum_samples:
        minimumSamples,

      outcomes: [
        "1m",
        "5m",
        "10m",
        "20m"
      ],

      warning:
        "Regimes are descriptive research classifications, not trading recommendations. Historical statistics do not guarantee future performance."
    }
  };
}
