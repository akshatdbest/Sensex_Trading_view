// src/discovery.js
//
// Stage 4D
// ---------
// Market regime + transition + candidate discovery engine.
//
// Purpose:
//   Discover statistically interesting market states before introducing
//   actual CALL / PUT trading signals.
//
// Important:
//   This module is research-only.
//   It does NOT generate trading recommendations.
//
// Added in Stage 4D:
//   - Symmetric bullish / bearish regime classification
//   - 2-factor candidate discovery
//   - 3-factor candidate discovery
//   - Regime transition discovery
//   - MFE / MAE calculation
//   - Evidence classification
//   - EDGE / NO_EDGE / INSUFFICIENT classification
//   - Candidate ranking
//
// Data source:
//   signals table
//   event = MARKET_SNAPSHOT
//
// Expected raw_payload fields:
//   price
//   rsi
//   trend
//   volume_state
//   volume_ratio
//   vwap
//   vwap_distance
//   or_state
//   or_high
//   or_low
//   vpc_zone
//   vpc_mid
//   adr_used_pct
//   vix
//   session
//   atm_strike
//

const HORIZONS = [
  {
    key: "1m",
    minutes: 1,
    toleranceMs: 75 * 1000
  },
  {
    key: "5m",
    minutes: 5,
    toleranceMs: 90 * 1000
  },
  {
    key: "10m",
    minutes: 10,
    toleranceMs: 90 * 1000
  },
  {
    key: "20m",
    minutes: 20,
    toleranceMs: 120 * 1000
  }
];

const FACTOR_LABELS = {
  rsi_bucket: "RSI",
  trend: "Trend",
  volume_state: "Volume",
  vwap: "VWAP",
  or_state: "OR",
  vpc_zone: "VPC",
  session: "Session",
  regime: "Regime"
};

// Controlled combinations.
// We intentionally do NOT brute-force every possible combination.
// That would create a large multiple-testing / overfitting problem.

const TWO_FACTOR_PAIRS = [
  ["rsi_bucket", "trend"],
  ["rsi_bucket", "vwap"],
  ["rsi_bucket", "volume_state"],
  ["trend", "vwap"],
  ["trend", "volume_state"],
  ["trend", "vpc_zone"],
  ["volume_state", "vwap"],
  ["volume_state", "or_state"],
  ["vwap", "or_state"],
  ["vwap", "vpc_zone"],
  ["or_state", "vpc_zone"],
  ["vpc_zone", "session"]
];

const THREE_FACTOR_TRIPLES = [
  ["rsi_bucket", "trend", "vwap"],
  ["rsi_bucket", "trend", "volume_state"],
  ["rsi_bucket", "vwap", "volume_state"],
  ["trend", "vwap", "volume_state"],
  ["trend", "vwap", "or_state"],
  ["trend", "vwap", "vpc_zone"],
  ["trend", "or_state", "vpc_zone"],
  ["volume_state", "vwap", "or_state"],
  ["volume_state", "vwap", "vpc_zone"],
  ["vwap", "or_state", "vpc_zone"],
  ["vwap", "vpc_zone", "session"]
];

const MIN_EDGE_SAMPLES = 50;
const MIN_MODERATE_SAMPLES = 50;
const MIN_LOW_SAMPLES = 20;

const MIN_DIRECTIONAL_EDGE_PCT = 60;
const MIN_AVG_MOVE_POINTS = 3;

const MAX_TOP_CANDIDATES = 100;


// ------------------------------------------------------------
// Utility
// ------------------------------------------------------------

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return null;
  }

  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function median(values) {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

function pct(part, total) {
  if (!total) {
    return 0;
  }

  return (part / total) * 100;
}


// ------------------------------------------------------------
// RSI bucket
// ------------------------------------------------------------

function getRsiBucket(rsi) {
  if (!Number.isFinite(rsi)) {
    return "UNKNOWN";
  }

  if (rsi < 40) {
    return "WEAK";
  }

  if (rsi < 60) {
    return "MID";
  }

  if (rsi < 70) {
    return "STRONG";
  }

  return "OVERBOUGHT";
}


// ------------------------------------------------------------
// Regime classifier
//
// IMPORTANT:
// These are descriptive research classifications.
// They are NOT trading rules.
// ------------------------------------------------------------

function classifyRegime(snapshot) {
  const rsi = safeNumber(snapshot.rsi);
  const volumeRatio = safeNumber(snapshot.volume_ratio);
  const adrPct = safeNumber(snapshot.adr_used_pct);

  const trend = String(snapshot.trend || "").toUpperCase();
  const volumeState = String(snapshot.volume_state || "").toUpperCase();
  const vwap = String(snapshot.vwap || "").toUpperCase();
  const orState = String(snapshot.or_state || "").toUpperCase();
  const vpcZone = String(snapshot.vpc_zone || "").toUpperCase();

  const breakoutUp =
    orState === "BROKE_UP" ||
    vpcZone === "BULL_ZONE" ||
    vpcZone === "EXTENDED_UP";

  const breakoutDown =
    orState === "BROKE_DOWN" ||
    vpcZone === "BEAR_ZONE" ||
    vpcZone === "EXTENDED_DOWN";

  const highVolume =
    volumeState === "HIGH" ||
    (Number.isFinite(volumeRatio) && volumeRatio >= 1.5);

  const lowVolume =
    volumeState === "LOW" ||
    (Number.isFinite(volumeRatio) && volumeRatio < 0.8);

  // ----------------------------------------------------------
  // Strong directional momentum
  // ----------------------------------------------------------

  if (
    breakoutUp &&
    vwap === "ABOVE" &&
    (trend === "BULL" || (Number.isFinite(rsi) && rsi >= 55)) &&
    highVolume
  ) {
    return "MOMENTUM_UP";
  }

  if (
    breakoutDown &&
    vwap === "BELOW" &&
    (trend === "BEAR" || (Number.isFinite(rsi) && rsi <= 45)) &&
    highVolume
  ) {
    return "MOMENTUM_DOWN";
  }

  // ----------------------------------------------------------
  // Mean reversion
  // ----------------------------------------------------------

  if (
    Number.isFinite(rsi) &&
    rsi < 40 &&
    (
      vpcZone === "BEAR_ZONE" ||
      vpcZone === "EXTENDED_DOWN"
    )
  ) {
    return "MEAN_REVERSION_UP";
  }

  if (
    Number.isFinite(rsi) &&
    rsi > 60 &&
    (
      vpcZone === "BULL_ZONE" ||
      vpcZone === "EXTENDED_UP"
    )
  ) {
    return "MEAN_REVERSION_DOWN";
  }

  // ----------------------------------------------------------
  // Exhaustion
  // ----------------------------------------------------------

  if (
    Number.isFinite(rsi) &&
    rsi >= 70 &&
    (
      vpcZone === "EXTENDED_UP" ||
      (Number.isFinite(adrPct) && adrPct >= 80)
    )
  ) {
    return "EXHAUSTION_UP";
  }

  if (
    Number.isFinite(rsi) &&
    rsi <= 30 &&
    (
      vpcZone === "EXTENDED_DOWN" ||
      (Number.isFinite(adrPct) && adrPct >= 80)
    )
  ) {
    return "EXHAUSTION_DOWN";
  }

  // ----------------------------------------------------------
  // CHOP
  // ----------------------------------------------------------

  if (
    lowVolume &&
    Number.isFinite(rsi) &&
    rsi >= 45 &&
    rsi < 60 &&
    (
      vwap === "ABOVE" ||
      vwap === "BELOW"
    )
  ) {
    return "CHOP";
  }

  // ----------------------------------------------------------
  // General directional regimes
  // ----------------------------------------------------------

  if (
    trend === "BULL" &&
    vwap === "ABOVE"
  ) {
    return "BULLISH_REGIME";
  }

  if (
    trend === "BEAR" &&
    vwap === "BELOW"
  ) {
    return "BEARISH_REGIME";
  }

  return "NEUTRAL_REGIME";
}


// ------------------------------------------------------------
// Snapshot normalization
// ------------------------------------------------------------

function normalizeSnapshot(row) {
  let payload = {};

  try {
    payload = JSON.parse(row.raw_payload || "{}");
  } catch {
    payload = {};
  }

  const price = safeNumber(
    payload.price !== undefined
      ? payload.price
      : row.price
  );

  const rsi = safeNumber(payload.rsi);

  const snapshot = {
    id: row.id,
    event_time: row.event_time,
    received_at: row.received_at,

    ticker: row.ticker,
    exchange: row.exchange,
    timeframe: row.timeframe,

    price,

    rsi,

    trend: String(
      payload.trend || "UNKNOWN"
    ).toUpperCase(),

    volume_state: String(
      payload.volume_state || "UNKNOWN"
    ).toUpperCase(),

    volume_ratio: safeNumber(
      payload.volume_ratio
    ),

    vwap: String(
      payload.vwap || "UNKNOWN"
    ).toUpperCase(),

    vwap_distance: safeNumber(
      payload.vwap_distance
    ),

    or_state: String(
      payload.or_state || "UNKNOWN"
    ).toUpperCase(),

    or_high: safeNumber(
      payload.or_high
    ),

    or_low: safeNumber(
      payload.or_low
    ),

    vpc_zone: String(
      payload.vpc_zone || "UNKNOWN"
    ).toUpperCase(),

    vpc_mid: safeNumber(
      payload.vpc_mid
    ),

    adr_used_pct: safeNumber(
      payload.adr_used_pct
    ),

    vix: safeNumber(
      payload.vix
    ),

    session: String(
      payload.session || "UNKNOWN"
    ),

    atm_strike: safeNumber(
      payload.atm_strike
    )
  };

  snapshot.rsi_bucket = getRsiBucket(
    snapshot.rsi
  );

  snapshot.regime = classifyRegime(
    snapshot
  );

  return snapshot;
}


// ------------------------------------------------------------
// Binary search for future snapshot
// ------------------------------------------------------------

function findFuture(
  snapshots,
  startIndex,
  targetMs,
  toleranceMs
) {
  let left = startIndex + 1;
  let right = snapshots.length - 1;

  let best = null;
  let bestDistance = Infinity;

  while (left <= right) {
    const mid = Math.floor(
      (left + right) / 2
    );

    const time = Date.parse(
      snapshots[mid].event_time
    );

    const distance = Math.abs(
      time - targetMs
    );

    if (distance < bestDistance) {
      best = snapshots[mid];
      bestDistance = distance;
    }

    if (time < targetMs) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  if (
    best &&
    bestDistance <= toleranceMs
  ) {
    return best;
  }

  return null;
}


// ------------------------------------------------------------
// Outcome calculation
//
// Endpoint move:
//   future.price - entry.price
//
// MFE:
//   maximum favorable excursion between entry
//   and horizon.
//
// MAE:
//   maximum adverse excursion between entry
//   and horizon.
//
// For a positive move:
//   MFE = highest price - entry
//   MAE = lowest price - entry
//
// For a negative move the same raw excursion values are retained.
// This makes the statistics transparent.
// ------------------------------------------------------------

function calculateOutcome(
  snapshots,
  index,
  horizon
) {
  const entry = snapshots[index];

  if (!entry || !Number.isFinite(entry.price)) {
    return null;
  }

  const entryTime = Date.parse(
    entry.event_time
  );

  if (!Number.isFinite(entryTime)) {
    return null;
  }

  const targetMs =
    entryTime +
    horizon.minutes * 60 * 1000;

  const future = findFuture(
    snapshots,
    index,
    targetMs,
    horizon.toleranceMs
  );

  if (!future || !Number.isFinite(future.price)) {
    return null;
  }

  const futureTime = Date.parse(
    future.event_time
  );

  if (!Number.isFinite(futureTime)) {
    return null;
  }

  const move =
    future.price -
    entry.price;

  let maxPrice = entry.price;
  let minPrice = entry.price;

  // Walk through snapshots between entry and
  // the selected future endpoint.
  for (
    let i = index + 1;
    i < snapshots.length;
    i++
  ) {
    const current = snapshots[i];

    const currentTime = Date.parse(
      current.event_time
    );

    if (
      !Number.isFinite(currentTime) ||
      currentTime > futureTime
    ) {
      break;
    }

    if (Number.isFinite(current.price)) {
      maxPrice = Math.max(
        maxPrice,
        current.price
      );

      minPrice = Math.min(
        minPrice,
        current.price
      );
    }
  }

  const mfe =
    maxPrice -
    entry.price;

  const mae =
    minPrice -
    entry.price;

  let direction = "FLAT";

  if (move > 0) {
    direction = "UP";
  } else if (move < 0) {
    direction = "DOWN";
  }

  return {
    target_time: future.event_time,
    actual_time: future.event_time,
    move_points: move,
    direction,
    mfe_points: mfe,
    mae_points: mae
  };
}


// ------------------------------------------------------------
// Aggregate statistics
// ------------------------------------------------------------

function createEmptyStats() {
  return {
    samples: 0,

    up: 0,
    down: 0,
    flat: 0,

    moves: [],
    mfe: [],
    mae: []
  };
}

function addOutcome(
  stats,
  outcome
) {
  if (!outcome) {
    return;
  }

  stats.samples++;

  if (outcome.direction === "UP") {
    stats.up++;
  } else if (outcome.direction === "DOWN") {
    stats.down++;
  } else {
    stats.flat++;
  }

  stats.moves.push(
    outcome.move_points
  );

  stats.mfe.push(
    outcome.mfe_points
  );

  stats.mae.push(
    outcome.mae_points
  );
}

function evidenceStrength(samples) {
  if (samples >= 100) {
    return "STRONG";
  }

  if (samples >= 50) {
    return "MODERATE";
  }

  if (samples >= 20) {
    return "LOW";
  }

  return "VERY_LOW";
}

function classifyEvidence(
  stats
) {
  const samples = stats.samples;

  if (samples < MIN_LOW_SAMPLES) {
    return "INSUFFICIENT";
  }

  if (!samples) {
    return "INSUFFICIENT";
  }

  const upPct =
    pct(stats.up, samples);

  const downPct =
    pct(stats.down, samples);

  const avgMove =
    stats.moves.length
      ? stats.moves.reduce(
          (sum, value) => sum + value,
          0
        ) / stats.moves.length
      : 0;

  const directionalPct =
    Math.max(
      upPct,
      downPct
    );

  const directionalMove =
    Math.abs(avgMove);

  if (
    samples >= MIN_EDGE_SAMPLES &&
    directionalPct >= MIN_DIRECTIONAL_EDGE_PCT &&
    directionalMove >= MIN_AVG_MOVE_POINTS
  ) {
    return "EDGE";
  }

  if (
    samples >= MIN_MODERATE_SAMPLES &&
    (
      directionalPct >= 55 ||
      directionalMove >= 2
    )
  ) {
    return "WATCH";
  }

  return "NO_EDGE";
}

function finalizeStats(stats) {
  if (!stats.samples) {
    return {
      samples: 0,
      up_pct: 0,
      down_pct: 0,
      flat_pct: 0,
      avg_move_points: null,
      median_move_points: null,
      avg_mfe_points: null,
      median_mfe_points: null,
      avg_mae_points: null,
      median_mae_points: null,
      evidence_strength: "VERY_LOW",
      classification: "INSUFFICIENT"
    };
  }

  const avgMove =
    stats.moves.reduce(
      (sum, value) => sum + value,
      0
    ) / stats.moves.length;

  const avgMfe =
    stats.mfe.reduce(
      (sum, value) => sum + value,
      0
    ) / stats.mfe.length;

  const avgMae =
    stats.mae.reduce(
      (sum, value) => sum + value,
      0
    ) / stats.mae.length;

  return {
    samples: stats.samples,

    up_pct: round(
      pct(stats.up, stats.samples),
      2
    ),

    down_pct: round(
      pct(stats.down, stats.samples),
      2
    ),

    flat_pct: round(
      pct(stats.flat, stats.samples),
      2
    ),

    avg_move_points: round(
      avgMove,
      2
    ),

    median_move_points: round(
      median(stats.moves),
      2
    ),

    avg_mfe_points: round(
      avgMfe,
      2
    ),

    median_mfe_points: round(
      median(stats.mfe),
      2
    ),

    avg_mae_points: round(
      avgMae,
      2
    ),

    median_mae_points: round(
      median(stats.mae),
      2
    ),

    evidence_strength:
      evidenceStrength(stats.samples),

    classification:
      classifyEvidence(stats)
  };
}


// ------------------------------------------------------------
// Build horizon statistics for a group
// ------------------------------------------------------------

function buildGroupOutcomes(
  snapshots,
  indices
) {
  const result = {};

  for (const horizon of HORIZONS) {
    const stats =
      createEmptyStats();

    for (const index of indices) {
      const outcome =
        calculateOutcome(
          snapshots,
          index,
          horizon
        );

      addOutcome(
        stats,
        outcome
      );
    }

    result[horizon.key] =
      finalizeStats(stats);
  }

  return result;
}


// ------------------------------------------------------------
// Factor state
// ------------------------------------------------------------

function getFactorValue(
  snapshot,
  factor
) {
  if (factor === "rsi_bucket") {
    return snapshot.rsi_bucket;
  }

  if (factor === "trend") {
    return snapshot.trend;
  }

  if (factor === "volume_state") {
    return snapshot.volume_state;
  }

  if (factor === "vwap") {
    return snapshot.vwap;
  }

  if (factor === "or_state") {
    return snapshot.or_state;
  }

  if (factor === "vpc_zone") {
    return snapshot.vpc_zone;
  }

  if (factor === "session") {
    return snapshot.session;
  }

  if (factor === "regime") {
    return snapshot.regime;
  }

  return "UNKNOWN";
}

function buildLabel(
  factors,
  snapshot
) {
  return factors
    .map(
      factor =>
        `${FACTOR_LABELS[factor] || factor}=${getFactorValue(snapshot, factor)}`
    )
    .join(" + ");
}

function buildKey(
  factors,
  snapshot
) {
  return factors
    .map(
      factor =>
        `${factor}=${getFactorValue(snapshot, factor)}`
    )
    .join("|");
}


// ------------------------------------------------------------
// Candidate discovery
// ------------------------------------------------------------

function discoverCandidates(
  snapshots,
  combinations,
  minSamples
) {
  const candidates = [];

  for (const factors of combinations) {
    const groups =
      new Map();

    for (
      let index = 0;
      index < snapshots.length;
      index++
    ) {
      const snapshot =
        snapshots[index];

      const values =
        factors.map(
          factor =>
            getFactorValue(
              snapshot,
              factor
            )
        );

      if (
        values.some(
          value =>
            !value ||
            value === "UNKNOWN"
        )
      ) {
        continue;
      }

      const key =
        values.join("|");

      if (!groups.has(key)) {
        groups.set(
          key,
          {
            factors,
            values,
            indices: []
          }
        );
      }

      groups
        .get(key)
        .indices
        .push(index);
    }

    for (const group of groups.values()) {
      if (
        group.indices.length <
        minSamples
      ) {
        continue;
      }

      const outcomes =
        buildGroupOutcomes(
          snapshots,
          group.indices
        );

      const label =
        factors
          .map(
            (factor, i) =>
              `${FACTOR_LABELS[factor] || factor}=${group.values[i]}`
          )
          .join(" + ");

      const candidate = {
        type:
          factors.length === 2
            ? "TWO_FACTOR"
            : "THREE_FACTOR",

        factors,

        label,

        key:
          group.values.join("|"),

        samples:
          group.indices.length,

        outcomes
      };

      candidate.score =
        calculateCandidateScore(
          candidate
        );

      candidate.best_horizon =
        selectBestHorizon(
          candidate.outcomes
        );

      candidate.overall_classification =
        classifyCandidate(
          candidate
        );

      candidates.push(
        candidate
      );
    }
  }

  return candidates;
}


// ------------------------------------------------------------
// Candidate score
//
// This is NOT probability.
//
// It is only a research-prioritization score.
//
// Higher:
//   - directional consistency
//   - movement magnitude
//   - sample size
//
// Lower:
//   - weak direction
//   - small movement
// ------------------------------------------------------------

function calculateCandidateScore(
  candidate
) {
  const horizonKeys = [
    "5m",
    "10m",
    "20m"
  ];

  let bestScore = 0;

  for (const key of horizonKeys) {
    const outcome =
      candidate.outcomes[key];

    if (!outcome) {
      continue;
    }

    if (
      outcome.samples <
      MIN_LOW_SAMPLES
    ) {
      continue;
    }

    const directional =
      Math.max(
        outcome.up_pct,
        outcome.down_pct
      );

    const deviation =
      Math.abs(
        directional - 50
      );

    const movement =
      Math.abs(
        outcome.avg_move_points || 0
      );

    const sampleFactor =
      Math.min(
        outcome.samples / 100,
        1
      );

    const score =
      (
        deviation * 1.5 +
        Math.min(movement, 50) * 0.5
      ) *
      sampleFactor;

    bestScore =
      Math.max(
        bestScore,
        score
      );
  }

  return round(
    bestScore,
    2
  );
}


function selectBestHorizon(
  outcomes
) {
  let best = null;

  for (const key of [
    "5m",
    "10m",
    "20m"
  ]) {
    const outcome =
      outcomes[key];

    if (
      !outcome ||
      outcome.samples <
      MIN_LOW_SAMPLES
    ) {
      continue;
    }

    const directional =
      Math.max(
        outcome.up_pct,
        outcome.down_pct
      );

    const movement =
      Math.abs(
        outcome.avg_move_points || 0
      );

    const strength =
      Math.abs(
        directional - 50
      ) +
      movement * 0.25;

    if (
      !best ||
      strength > best.strength
    ) {
      best = {
        horizon: key,
        direction:
          outcome.up_pct >
          outcome.down_pct
            ? "UP"
            : outcome.down_pct >
              outcome.up_pct
              ? "DOWN"
              : "FLAT",

        directional_pct:
          round(
            directional,
            2
          ),

        avg_move_points:
          outcome.avg_move_points,

        strength:
          round(
            strength,
            2
          )
      };
    }
  }

  return best;
}


function classifyCandidate(
  candidate
) {
  const meaningful =
    ["5m", "10m", "20m"]
      .map(
        key =>
          candidate.outcomes[key]
      )
      .filter(
        outcome =>
          outcome &&
          outcome.samples >=
            MIN_LOW_SAMPLES
      );

  if (!meaningful.length) {
    return "INSUFFICIENT";
  }

  const edgeCount =
    meaningful.filter(
      outcome =>
        outcome.classification ===
        "EDGE"
    ).length;

  if (edgeCount >= 2) {
    return "EDGE";
  }

  const watchCount =
    meaningful.filter(
      outcome =>
        outcome.classification ===
        "WATCH"
    ).length;

  if (
    edgeCount >= 1 ||
    watchCount >= 2
  ) {
    return "WATCH";
  }

  return "NO_EDGE";
}


// ------------------------------------------------------------
// Regime discovery
// ------------------------------------------------------------

function discoverRegimes(
  snapshots
) {
  const groups =
    new Map();

  snapshots.forEach(
    (snapshot, index) => {
      const regime =
        snapshot.regime;

      if (!groups.has(regime)) {
        groups.set(
          regime,
          []
        );
      }

      groups
        .get(regime)
        .push(index);
    }
  );

  const result = [];

  for (
    const [regime, indices]
    of groups.entries()
  ) {
    result.push({
      regime,
      samples: indices.length,
      evidence_strength:
        evidenceStrength(
          indices.length
        ),
      outcomes:
        buildGroupOutcomes(
          snapshots,
          indices
        )
    });
  }

  result.sort(
    (a, b) =>
      b.samples -
      a.samples
  );

  return result;
}


// ------------------------------------------------------------
// Regime transitions
// ------------------------------------------------------------

function discoverTransitions(
  snapshots,
  minSamples
) {
  const groups =
    new Map();

  for (
    let i = 1;
    i < snapshots.length;
    i++
  ) {
    const previous =
      snapshots[i - 1];

    const current =
      snapshots[i];

    if (
      previous.regime ===
      current.regime
    ) {
      continue;
    }

    const key =
      `${previous.regime} -> ${current.regime}`;

    if (!groups.has(key)) {
      groups.set(
        key,
        {
          from:
            previous.regime,

          to:
            current.regime,

          indices: []
        }
      );
    }

    groups
      .get(key)
      .indices
      .push(i);
  }

  const transitions = [];

  for (
    const group of groups.values()
  ) {
    const outcomes =
      buildGroupOutcomes(
        snapshots,
        group.indices
      );

    transitions.push({
      type: "REGIME_TRANSITION",

      from: group.from,

      to: group.to,

      label:
        `${group.from} -> ${group.to}`,

      samples:
        group.indices.length,

      evidence_strength:
        evidenceStrength(
          group.indices.length
        ),

      qualified:
        group.indices.length >=
        minSamples,

      outcomes
    });
  }

  transitions.sort(
    (a, b) =>
      b.samples -
      a.samples
  );

  return transitions;
}


// ------------------------------------------------------------
// Transition + factor discovery
//
// Example:
//
// CHOP -> MOMENTUM_UP
// + RSI=STRONG
// + Volume=HIGH
//
// This helps identify what conditions accompany
// a regime transition.
//
// It is intentionally limited to the selected
// factor combinations.
// ------------------------------------------------------------

function discoverTransitionFactors(
  snapshots,
  minSamples
) {
  const groups =
    new Map();

  for (
    let i = 1;
    i < snapshots.length;
    i++
  ) {
    const previous =
      snapshots[i - 1];

    const current =
      snapshots[i];

    if (
      previous.regime ===
      current.regime
    ) {
      continue;
    }

    for (
      const factors
      of TWO_FACTOR_PAIRS
    ) {
      const values =
        factors.map(
          factor =>
            getFactorValue(
              current,
              factor
            )
        );

      if (
        values.some(
          value =>
            !value ||
            value === "UNKNOWN"
        )
      ) {
        continue;
      }

      const key =
        [
          previous.regime,
          current.regime,
          ...values
        ].join("|");

      if (!groups.has(key)) {
        groups.set(
          key,
          {
            from:
              previous.regime,

            to:
              current.regime,

            factors,

            values,

            indices: []
          }
        );
      }

      groups
        .get(key)
        .indices
        .push(i);
    }
  }

  const results = [];

  for (
    const group of groups.values()
  ) {
    if (
      group.indices.length <
      minSamples
    ) {
      continue;
    }

    const outcomes =
      buildGroupOutcomes(
        snapshots,
        group.indices
      );

    const label =
      `${group.from} -> ${group.to} + ` +
      group.factors
        .map(
          (factor, i) =>
            `${FACTOR_LABELS[factor] || factor}=${group.values[i]}`
        )
        .join(" + ");

    results.push({
      type:
        "TRANSITION_FACTOR",

      from:
        group.from,

      to:
        group.to,

      factors:
        group.factors,

      label,

      samples:
        group.indices.length,

      evidence_strength:
        evidenceStrength(
          group.indices.length
        ),

      outcomes,

      score:
        calculateCandidateScore({
          outcomes
        }),

      qualified: true
    });
  }

  results.sort(
    (a, b) =>
      (b.score || 0) -
      (a.score || 0)
  );

  return results;
}


// ------------------------------------------------------------
// Current matching candidates
// ------------------------------------------------------------

function findCurrentMatches(
  candidates,
  currentSnapshot
) {
  if (!currentSnapshot) {
    return [];
  }

  const matches = [];

  for (const candidate of candidates) {
    let matchesCurrent =
      true;

    for (
      const factor
      of candidate.factors
    ) {
      const expected =
        candidate.label
          .split(" + ")
          .find(
            item =>
              item.startsWith(
                `${FACTOR_LABELS[factor] || factor}=`
              )
          );

      if (!expected) {
        matchesCurrent = false;
        break;
      }

      const expectedValue =
        expected.substring(
          expected.indexOf("=") + 1
        );

      const actualValue =
        getFactorValue(
          currentSnapshot,
          factor
        );

      if (
        expectedValue !==
        actualValue
      ) {
        matchesCurrent = false;
        break;
      }
    }

    if (matchesCurrent) {
      matches.push(
        candidate
      );
    }
  }

  matches.sort(
    (a, b) =>
      (b.score || 0) -
      (a.score || 0)
  );

  return matches;
}


// ------------------------------------------------------------
// Main API calculation
// ------------------------------------------------------------

export async function calculateDiscovery(
  db,
  requestedLimit = 5000,
  minSamples = 20
) {
  const limit = Math.min(
    Math.max(
      Number(requestedLimit) || 5000,
      100
    ),
    10000
  );

  const minimumSamples =
    Math.max(
      Number(minSamples) || 20,
      10
    );

  const query = `
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
  `;

  const result =
    await db
      .prepare(query)
      .bind(limit)
      .all();

  const rows =
    result.results || [];

  const snapshots =
    rows
      .map(normalizeSnapshot)
      .filter(
        snapshot =>
          snapshot.event_time &&
          Number.isFinite(
            snapshot.price
          )
      )
      .reverse();

  const current =
    snapshots.length
      ? snapshots[
          snapshots.length - 1
        ]
      : null;

  if (!snapshots.length) {
    return {
      generated_at:
        new Date().toISOString(),

      dataset: {
        snapshots: 0,
        earliest: null,
        latest: null
      },

      current_state: null,

      current_regime: null,

      regimes: [],

      all_regimes: [],

      transitions: [],

      qualified_transitions: [],

      factor_candidates: {
        two_factor: [],
        three_factor: []
      },

      transition_factor_candidates: [],

      top_candidates: [],

      current_matching_candidates: [],

      configuration: {
        requested_limit: limit,
        minimum_samples:
          minimumSamples,

        minimum_edge_samples:
          MIN_EDGE_SAMPLES,

        minimum_directional_edge_pct:
          MIN_DIRECTIONAL_EDGE_PCT,

        minimum_average_move_points:
          MIN_AVG_MOVE_POINTS
      },

      methodology: {
        purpose:
          "Discover recurring market states, combinations and transitions before introducing trading signals.",

        outcomes: [
          "1m",
          "5m",
          "10m",
          "20m"
        ],

        metrics: [
          "UP %",
          "DOWN %",
          "Average move",
          "Median move",
          "MFE",
          "MAE"
        ],

        classifications: [
          "EDGE",
          "WATCH",
          "NO_EDGE",
          "INSUFFICIENT"
        ],

        warning:
          "Historical statistics are descriptive research evidence and do not guarantee future performance."
      },

      warnings: [
        "No MARKET_SNAPSHOT data available."
      ]
    };
  }

  // ----------------------------------------------------------
  // Regimes
  // ----------------------------------------------------------

  const allRegimes =
    discoverRegimes(
      snapshots
    );

  // Keep the legacy "regimes" field.
  // It contains regimes with at least minSamples.
  const qualifiedRegimes =
    allRegimes.filter(
      regime =>
        regime.samples >=
        minimumSamples
    );

  // ----------------------------------------------------------
  // Transitions
  // ----------------------------------------------------------

  const transitions =
    discoverTransitions(
      snapshots,
      minimumSamples
    );

  const qualifiedTransitions =
    transitions.filter(
      transition =>
        transition.qualified
    );

  // ----------------------------------------------------------
  // Static factor candidates
  // ----------------------------------------------------------

  const twoFactor =
    discoverCandidates(
      snapshots,
      TWO_FACTOR_PAIRS,
      minimumSamples
    );

  const threeFactor =
    discoverCandidates(
      snapshots,
      THREE_FACTOR_TRIPLES,
      minimumSamples
    );

  // ----------------------------------------------------------
  // Transition + factor candidates
  // ----------------------------------------------------------

  const transitionFactors =
    discoverTransitionFactors(
      snapshots,
      minimumSamples
    );

  // ----------------------------------------------------------
  // Rank all static candidates
  // ----------------------------------------------------------

  const allCandidates = [
    ...twoFactor,
    ...threeFactor
  ];

  allCandidates.sort(
    (a, b) =>
      (b.score || 0) -
      (a.score || 0)
  );

  const topCandidates =
    allCandidates.slice(
      0,
      MAX_TOP_CANDIDATES
    );

  const currentMatches =
    findCurrentMatches(
      allCandidates,
      current
    );

  // ----------------------------------------------------------
  // Current state
  // ----------------------------------------------------------

  const currentState =
    current
      ? {
          event_time:
            current.event_time,

          price:
            current.price,

          rsi:
            current.rsi,

          rsi_bucket:
            current.rsi_bucket,

          trend:
            current.trend,

          volume_state:
            current.volume_state,

          volume_ratio:
            current.volume_ratio,

          vwap:
            current.vwap,

          vwap_distance:
            current.vwap_distance,

          or_state:
            current.or_state,

          or_high:
            current.or_high,

          or_low:
            current.or_low,

          vpc_zone:
            current.vpc_zone,

          vpc_mid:
            current.vpc_mid,

          adr_used_pct:
            current.adr_used_pct,

          vix:
            current.vix,

          session:
            current.session,

          atm_strike:
            current.atm_strike
        }
      : null;

  // ----------------------------------------------------------
  // Warnings
  // ----------------------------------------------------------

  const warnings = [];

  if (snapshots.length < 5000) {
    warnings.push(
      `Dataset contains only ${snapshots.length} snapshots. More history is required for robust statistical conclusions.`
    );
  }

  if (qualifiedRegimes.length < 3) {
    warnings.push(
      "Only a small number of regimes currently have enough samples for analysis."
    );
  }

  if (!qualifiedTransitions.length) {
    warnings.push(
      `No regime transitions currently meet the ${minimumSamples}-sample qualification threshold.`
    );
  }

  if (!topCandidates.length) {
    warnings.push(
      `No factor combinations currently meet the ${minimumSamples}-sample threshold.`
    );
  }

  warnings.push(
    "EDGE/WATCH classifications are research classifications, not trading signals."
  );

  warnings.push(
    "Candidate scores are ranking metrics, not probabilities."
  );

  warnings.push(
    "One trading session is not sufficient to establish a durable market edge."
  );

  warnings.push(
    "Candidates must be validated on unseen future data before being considered for trading."
  );

  return {
    generated_at:
      new Date().toISOString(),

    dataset: {
      snapshots:
        snapshots.length,

      earliest:
        snapshots[0]?.event_time ||
        null,

      latest:
        snapshots[
          snapshots.length - 1
        ]?.event_time ||
        null
    },

    current_state:
      currentState,

    current_regime:
      current
        ? {
            event_time:
              current.event_time,

            price:
              current.price,

            regime:
              current.regime,

            rsi:
              current.rsi,

            rsi_bucket:
              current.rsi_bucket,

            trend:
              current.trend,

            volume_state:
              current.volume_state,

            volume_ratio:
              current.volume_ratio,

            vwap:
              current.vwap,

            vwap_distance:
              current.vwap_distance,

            or_state:
              current.or_state,

            vpc_zone:
              current.vpc_zone,

            session:
              current.session
          }
        : null,

    // Only regimes meeting minimum sample threshold.
    regimes:
      qualifiedRegimes,

    // All regimes, including low-sample regimes.
    all_regimes:
      allRegimes,

    transitions,

    qualified_transitions:
      qualifiedTransitions,

    factor_candidates: {
      two_factor:
        twoFactor,

      three_factor:
        threeFactor
    },

    transition_factor_candidates:
      transitionFactors,

    top_candidates:
      topCandidates,

    current_matching_candidates:
      currentMatches,

    configuration: {
      requested_limit:
        limit,

      minimum_samples:
        minimumSamples,

      minimum_low_samples:
        MIN_LOW_SAMPLES,

      minimum_edge_samples:
        MIN_EDGE_SAMPLES,

      minimum_directional_edge_pct:
        MIN_DIRECTIONAL_EDGE_PCT,

      minimum_average_move_points:
        MIN_AVG_MOVE_POINTS,

      horizons: HORIZONS.map(
        horizon => ({
          key:
            horizon.key,

          minutes:
            horizon.minutes,

          tolerance_seconds:
            horizon.toleranceMs /
            1000
        })
      )
    },

    methodology: {
      purpose:
        "Discover recurring market regimes, factor combinations and regime transitions before introducing trading signals.",

      regime_types: [
        "MOMENTUM_UP",
        "MOMENTUM_DOWN",
        "MEAN_REVERSION_UP",
        "MEAN_REVERSION_DOWN",
        "EXHAUSTION_UP",
        "EXHAUSTION_DOWN",
        "BULLISH_REGIME",
        "BEARISH_REGIME",
        "CHOP",
        "NEUTRAL_REGIME"
      ],

      factor_combinations: {
        two_factor:
          TWO_FACTOR_PAIRS,

        three_factor:
          THREE_FACTOR_TRIPLES
      },

      outcomes: [
        "1m",
        "5m",
        "10m",
        "20m"
      ],

      metrics: [
        "UP %",
        "DOWN %",
        "FLAT %",
        "Average move",
        "Median move",
        "Average MFE",
        "Median MFE",
        "Average MAE",
        "Median MAE"
      ],

      classifications: [
        "EDGE",
        "WATCH",
        "NO_EDGE",
        "INSUFFICIENT"
      ],

      evidence_thresholds: {
        insufficient:
          `< ${MIN_LOW_SAMPLES} samples`,

        low:
          `${MIN_LOW_SAMPLES}-${MIN_MODERATE_SAMPLES - 1} samples`,

        moderate:
          `${MIN_MODERATE_SAMPLES}-${99} samples`,

        strong:
          "100+ samples"
      },

      edge_definition: {
        minimum_samples:
          MIN_EDGE_SAMPLES,

        minimum_directional_percentage:
          MIN_DIRECTIONAL_EDGE_PCT,

        minimum_average_move_points:
          MIN_AVG_MOVE_POINTS,

        note:
          "These thresholds are research filters only and do not imply profitability."
      },

      mfe_definition:
        "Maximum favorable price excursion from entry to the selected horizon.",

      mae_definition:
        "Maximum adverse price excursion from entry to the selected horizon.",

      warning:
        "Historical statistics do not guarantee future performance."
    },

    warnings
  };
}
