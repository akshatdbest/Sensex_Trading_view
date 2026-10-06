const HORIZONS = [
  { key: "1m", minutes: 1, maxLagSeconds: 90 },
  { key: "5m", minutes: 5, maxLagSeconds: 120 },
  { key: "10m", minutes: 10, maxLagSeconds: 180 },
  { key: "20m", minutes: 20, maxLagSeconds: 300 }
];

const RSI_BUCKETS = [
  { key: "OVERSOLD", min: -Infinity, max: 40 },
  { key: "WEAK", min: 40, max: 50 },
  { key: "MID", min: 50, max: 60 },
  { key: "STRONG", min: 60, max: 70 },
  { key: "OVERBOUGHT", min: 70, max: Infinity }
];

function toNumber(v) {
  if (v === undefined || v === null || v === "") {
    return null;
  }

  const n = Number(v);

  return Number.isFinite(n) ? n : null;
}

function parseDate(v) {
  if (!v) {
    return null;
  }

  const d = new Date(v);

  return Number.isNaN(d.getTime()) ? null : d;
}

function parsePayload(row) {
  try {
    return JSON.parse(row.raw_payload || "{}");
  } catch {
    return {};
  }
}

function parseRow(row) {
  const payload = parsePayload(row);

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

function rsiBucket(rsi) {
  if (!Number.isFinite(rsi)) {
    return "UNKNOWN";
  }

  for (const bucket of RSI_BUCKETS) {
    if (
      rsi >= bucket.min &&
      rsi < bucket.max
    ) {
      return bucket.key;
    }
  }

  return "UNKNOWN";
}

function stateFromRow(row) {
  const p = row.payload || {};

  const rsi = toNumber(p.rsi);

  return {
    rsi,
    rsi_bucket: rsiBucket(rsi),

    trend: p.trend ?? "UNKNOWN",

    volume_state:
      p.volume_state ?? "UNKNOWN",

    vwap:
      p.vwap ?? "UNKNOWN",

    or_state:
      p.or_state ?? "UNKNOWN",

    vpc_zone:
      p.vpc_zone ?? "UNKNOWN",

    session:
      p.session ?? "UNKNOWN"
  };
}

function stateSignature(state) {
  return [
    state.rsi_bucket,
    state.trend,
    state.volume_state,
    state.vwap,
    state.or_state,
    state.vpc_zone,
    state.session
  ].join("|");
}

function findFutureSnapshot(
  rows,
  targetTime,
  maxLagSeconds
) {
  /*
   * Binary search for the first snapshot
   * at or after targetTime.
   *
   * This is much faster than scanning the
   * entire historical dataset for every row.
   */

  let low = 0;
  let high = rows.length - 1;
  let candidate = -1;

  while (low <= high) {
    const mid =
      Math.floor((low + high) / 2);

    const rowTime =
      rows[mid].event_time.getTime();

    if (
      rowTime >= targetTime.getTime()
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

  const diffSeconds = Math.round(
    (
      row.event_time.getTime() -
      targetTime.getTime()
    ) / 1000
  );

  if (
    diffSeconds < 0 ||
    diffSeconds > maxLagSeconds
  ) {
    return null;
  }

  return {
    row,
    lag_seconds: diffSeconds
  };
}

function median(values) {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort(
    (a, b) => a - b
  );

  const middle =
    Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (
      (sorted[middle - 1] +
        sorted[middle]) /
      2
    );
  }

  return sorted[middle];
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

function addOutcome(stats, outcome) {
  if (!outcome) {
    return;
  }

  const move = Number(
    outcome.move_points
  );

  if (!Number.isFinite(move)) {
    return;
  }

  stats.samples++;

  if (move > 0) {
    stats.up++;
  } else if (move < 0) {
    stats.down++;
  } else {
    stats.flat++;
  }

  stats.moves.push(move);
}

function finalizeStats(stats) {
  if (!stats || stats.samples === 0) {
    return {
      samples: 0,
      up_pct: null,
      down_pct: null,
      flat_pct: null,
      avg_move_points: null,
      median_move_points: null
    };
  }

  const sum = stats.moves.reduce(
    (total, value) => total + value,
    0
  );

  return {
    samples: stats.samples,

    up_pct: Number(
      ((stats.up / stats.samples) * 100)
        .toFixed(2)
    ),

    down_pct: Number(
      ((stats.down / stats.samples) * 100)
        .toFixed(2)
    ),

    flat_pct: Number(
      ((stats.flat / stats.samples) * 100)
        .toFixed(2)
    ),

    avg_move_points: Number(
      (sum / stats.samples).toFixed(2)
    ),

    median_move_points: Number(
      median(stats.moves).toFixed(2)
    )
  };
}

function createEvidenceGroup(state) {
  return {
    signature: stateSignature(state),

    state: {
      rsi_bucket: state.rsi_bucket,
      trend: state.trend,
      volume_state: state.volume_state,
      vwap: state.vwap,
      or_state: state.or_state,
      vpc_zone: state.vpc_zone,
      session: state.session
    },

    outcomes: {
      "1m": createStats(),
      "5m": createStats(),
      "10m": createStats(),
      "20m": createStats()
    }
  };
}

function finalizeGroup(group) {
  return {
    signature: group.signature,

    state: group.state,

    outcomes: {
      "1m": finalizeStats(
        group.outcomes["1m"]
      ),

      "5m": finalizeStats(
        group.outcomes["5m"]
      ),

      "10m": finalizeStats(
        group.outcomes["10m"]
      ),

      "20m": finalizeStats(
        group.outcomes["20m"]
      )
    }
  };
}

function buildOutcomeForRow(
  source,
  rows
) {
  const result = {};

  for (const horizon of HORIZONS) {
    const targetTime = new Date(
      source.event_time.getTime() +
      horizon.minutes * 60 * 1000
    );

    const match =
      findFutureSnapshot(
        rows,
        targetTime,
        horizon.maxLagSeconds
      );

    if (!match) {
      result[horizon.key] = null;
      continue;
    }

    const future = match.row;

    const move =
      future.price - source.price;

    result[horizon.key] = {
      price: future.price,

      move_points:
        Number(move.toFixed(2)),

      direction:
        move > 0
          ? "UP"
          : move < 0
            ? "DOWN"
            : "FLAT",

      lag_seconds:
        match.lag_seconds
    };
  }

  return result;
}

function buildSingleFactorEvidence(
  rowsWithOutcomes,
  factor
) {
  const groups = new Map();

  for (const item of rowsWithOutcomes) {
    const value =
      item.state[factor];

    if (
      value === undefined ||
      value === null ||
      value === "UNKNOWN"
    ) {
      continue;
    }

    if (!groups.has(value)) {
      groups.set(value, {
        factor,
        value,
        outcomes: {
          "1m": createStats(),
          "5m": createStats(),
          "10m": createStats(),
          "20m": createStats()
        }
      });
    }

    const group = groups.get(value);

    for (const horizon of HORIZONS) {
      addOutcome(
        group.outcomes[horizon.key],
        item.outcomes[horizon.key]
      );
    }
  }

  return [...groups.values()]
    .map(group => ({
      factor: group.factor,

      value: group.value,

      outcomes: {
        "1m": finalizeStats(
          group.outcomes["1m"]
        ),

        "5m": finalizeStats(
          group.outcomes["5m"]
        ),

        "10m": finalizeStats(
          group.outcomes["10m"]
        ),

        "20m": finalizeStats(
          group.outcomes["20m"]
        )
      }
    }))
    .sort(
      (a, b) =>
        b.outcomes["5m"].samples -
        a.outcomes["5m"].samples
    );
}

export async function calculateEvidence(
  db,
  requestedLimit = 5000,
  minSamples = 5
) {
  const limit = Math.max(
    100,
    Math.min(
      Number(requestedLimit) || 5000,
      50000
    )
  );

  const minimumSamples = Math.max(
    1,
    Math.min(
      Number(minSamples) || 5,
      1000
    )
  );

  /*
   * Historical Evidence needs the historical
   * dataset, not only the latest 20 snapshots.
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
    .bind(limit)
    .all();

  /*
   * Convert newest -> oldest into
   * oldest -> newest.
   */
  const rows = (result.results || [])
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
        snapshots: 0,
        valid_snapshots: 0
      },

      current_state: null,

      current_state_evidence: null,

      combinations: [],

      factors: [],

      minimum_samples: minimumSamples,

      note:
        "No MARKET_SNAPSHOT history is available."
    };
  }

  /*
   * Build state + future outcomes for every
   * historical snapshot.
   */
  const rowsWithOutcomes = [];

  for (const row of rows) {
    const state =
      stateFromRow(row);

    const outcomes =
      buildOutcomeForRow(
        row,
        rows
      );

    rowsWithOutcomes.push({
      row,
      state,
      outcomes
    });
  }

  /*
   * Build exact state combinations.
   */
  const combinationMap =
    new Map();

  for (const item of rowsWithOutcomes) {
    const signature =
      stateSignature(item.state);

    if (
      !combinationMap.has(signature)
    ) {
      combinationMap.set(
        signature,
        createEvidenceGroup(
          item.state
        )
      );
    }

    const group =
      combinationMap.get(signature);

    for (const horizon of HORIZONS) {
      addOutcome(
        group.outcomes[horizon.key],
        item.outcomes[horizon.key]
      );
    }
  }

  /*
   * Only expose combinations with enough
   * observations to be useful.
   */
  const combinations =
    [...combinationMap.values()]
      .map(finalizeGroup)
      .filter(group => {
        return HORIZONS.some(
          horizon =>
            group.outcomes[horizon.key]
              .samples >= minimumSamples
        );
      })
      .sort(
        (a, b) =>
          b.outcomes["5m"].samples -
          a.outcomes["5m"].samples
      );

  /*
   * Current/latest market state.
   */
  const latest =
    rowsWithOutcomes[
      rowsWithOutcomes.length - 1
    ];

  const currentSignature =
    stateSignature(
      latest.state
    );

  const currentGroup =
    combinationMap.get(
      currentSignature
    );

  const currentEvidence =
    currentGroup
      ? finalizeGroup(currentGroup)
      : null;

  /*
   * Single-factor evidence.
   *
   * This is important because exact combinations
   * can remain sparse even after we accumulate
   * several days of data.
   */
  const factorNames = [
    "rsi_bucket",
    "trend",
    "volume_state",
    "vwap",
    "or_state",
    "vpc_zone",
    "session"
  ];

  const factors =
    factorNames.map(
      factor =>
        buildSingleFactorEvidence(
          rowsWithOutcomes,
          factor
        )
    );

  return {
    generated_at:
      new Date().toISOString(),

    dataset: {
      snapshots:
        result.results?.length || 0,

      valid_snapshots:
        rows.length,

      earliest:
        rows[0].event_time.toISOString(),

      latest:
        rows[rows.length - 1]
          .event_time.toISOString()
    },

    current_state: {
      event_time:
        latest.row.event_time.toISOString(),

      price:
        latest.row.price,

      rsi:
        latest.state.rsi,

      rsi_bucket:
        latest.state.rsi_bucket,

      trend:
        latest.state.trend,

      volume_state:
        latest.state.volume_state,

      vwap:
        latest.state.vwap,

      or_state:
        latest.state.or_state,

      vpc_zone:
        latest.state.vpc_zone,

      session:
        latest.state.session,

      signature:
        currentSignature
    },

    current_state_evidence:
      currentEvidence,

    combinations,

    factors,

    minimum_samples:
      minimumSamples,

    methodology: {
      rsi_buckets: [
        "<40 = OVERSOLD",
        "40-49.99 = WEAK",
        "50-59.99 = MID",
        "60-69.99 = STRONG",
        ">=70 = OVERBOUGHT"
      ],

      state_signature:
        "RSI bucket + Trend + Volume + VWAP + OR + VPC + Session",

      outcome_horizons: [
        "1m",
        "5m",
        "10m",
        "20m"
      ],

      direction:
        "UP if move > 0, DOWN if move < 0, FLAT if move = 0",

      future_matching:
        "First later MARKET_SNAPSHOT at or after target horizon within configured tolerance.",

      warning:
        "Statistics are descriptive historical evidence. They are not trading recommendations or probabilities of future returns."
    }
  };
}
