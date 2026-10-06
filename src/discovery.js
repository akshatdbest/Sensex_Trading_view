const HORIZONS = [
  { key: "1m", minutes: 1, maxLagSeconds: 90 },
  { key: "5m", minutes: 5, maxLagSeconds: 120 },
  { key: "10m", minutes: 10, maxLagSeconds: 180 },
  { key: "20m", minutes: 20, maxLagSeconds: 300 }
];

const DISCOVERY_FACTORS = [
  "rsi_bucket",
  "trend",
  "volume_state",
  "vwap",
  "or_state",
  "vpc_zone",
  "session"
];

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

function num(v) {
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
 * ---------------------------------------------------------
 * REGIME CLASSIFICATION
 * ---------------------------------------------------------
 *
 * These are transparent descriptive classifications.
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
   * Strong upward momentum.
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
      (
        volumeRatio !== null &&
        volumeRatio >= 1.5
      )
    )
  ) {
    return "MOMENTUM_UP";
  }

  /*
   * Strong downward momentum.
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
      (
        volumeRatio !== null &&
        volumeRatio >= 1.5
      )
    )
  ) {
    return "MOMENTUM_DOWN";
  }

  /*
   * Potential upward mean reversion.
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
   * Potential downward/exhaustion environment.
   */
  if (
    rsi !== null &&
    rsi >= 70 &&
    (
      vpc === "EXTENDED_UP" ||
      (
        adr !== null &&
        adr >= 80
      )
    )
  ) {
    return "EXHAUSTION_UP";
  }

  /*
   * Low-volume sideways environment.
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
   * General bullish environment.
   */
  if (
    trend === "BULL" &&
    vwap === "ABOVE"
  ) {
    return "BULLISH_REGIME";
  }

  /*
   * General bearish environment.
   */
  if (
    trend === "BEAR" &&
    vwap === "BELOW"
  ) {
    return "BEARISH_REGIME";
  }

  return "NEUTRAL_REGIME";
}

/*
 * ---------------------------------------------------------
 * FUTURE OUTCOME
 * ---------------------------------------------------------
 */

function findFuture(
  rows,
  targetTime,
  maxLagSeconds
) {
  let low = 0;
  let high = rows.length - 1;
  let candidate = -1;

  while (low <= high) {
    const mid =
      Math.floor(
        (low + high) / 2
      );

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

function outcomeFor(
  row,
  rows
) {
  const result = {};

  for (const horizon of HORIZONS) {
    const target =
      new Date(
        row.event_time.getTime() +
        horizon.minutes * 60000
      );

    const future =
      findFuture(
        rows,
        target,
        horizon.maxLagSeconds
      );

    if (!future) {
      result[horizon.key] = null;
      continue;
    }

    const move =
      future.price -
      row.price;

    result[horizon.key] = {
      move_points:
        Number(
          move.toFixed(2)
        ),

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

/*
 * ---------------------------------------------------------
 * STATISTICS
 * ---------------------------------------------------------
 */

function createStats() {
  return {
    samples: 0,
    up: 0,
    down: 0,
    flat: 0,
    moves: []
  };
}

function addOutcome(
  stats,
  outcome
) {
  if (!outcome) {
    return;
  }

  const move =
    Number(
      outcome.move_points
    );

  if (!Number.isFinite(move)) {
    return;
  }

  stats.samples++;

  stats.moves.push(
    move
  );

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

function finalizeStats(stats) {
  if (
    !stats ||
    stats.samples === 0
  ) {
    return {
      samples: 0,
      up_pct: null,
      down_pct: null,
      flat_pct: null,
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
    samples:
      stats.samples,

    up_pct:
      Number(
        (
          stats.up /
          stats.samples *
          100
        ).toFixed(2)
      ),

    down_pct:
      Number(
        (
          stats.down /
          stats.samples *
          100
        ).toFixed(2)
      ),

    flat_pct:
      Number(
        (
          stats.flat /
          stats.samples *
          100
        ).toFixed(2)
      ),

    avg_move_points:
      Number(
        (
          sum /
          stats.samples
        ).toFixed(2)
      ),

    median_move_points:
      Number(
        median(stats.moves)
          .toFixed(2)
      )
  };
}

function evidenceStrength(
  samples
) {
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

/*
 * ---------------------------------------------------------
 * STATE EXTRACTION
 * ---------------------------------------------------------
 */

function stateFor(row) {
  const p =
    row.payload || {};

  return {
    rsi_bucket:
      rsiBucket(
        num(p.rsi)
      ),

    trend:
      String(
        p.trend || "UNKNOWN"
      ).toUpperCase(),

    volume_state:
      String(
        p.volume_state ||
        "UNKNOWN"
      ).toUpperCase(),

    vwap:
      String(
        p.vwap || "UNKNOWN"
      ).toUpperCase(),

    or_state:
      String(
        p.or_state || "UNKNOWN"
      ).toUpperCase(),

    vpc_zone:
      String(
        p.vpc_zone || "UNKNOWN"
      ).toUpperCase(),

    session:
      String(
        p.session || "UNKNOWN"
      )
  };
}

/*
 * ---------------------------------------------------------
 * FACTOR COMBINATION HELPERS
 * ---------------------------------------------------------
 */

function validStateValue(
  value
) {
  return (
    value !== undefined &&
    value !== null &&
    value !== "" &&
    value !== "UNKNOWN"
  );
}

function combinationSignature(
  state,
  factors
) {
  return factors
    .map(
      factor =>
        factor +
        "=" +
        state[factor]
    )
    .join(" | ");
}

function createGroup(
  label,
  type,
  factors
) {
  return {
    label,
    type,
    factors,
    samples: 0,

    outcomes: {
      "1m": createStats(),
      "5m": createStats(),
      "10m": createStats(),
      "20m": createStats()
    }
  };
}

function addItemToGroup(
  group,
  item
) {
  group.samples++;

  for (const horizon of HORIZONS) {
    addOutcome(
      group.outcomes[
        horizon.key
      ],
      item.outcomes[
        horizon.key
      ]
    );
  }
}

function finalizeGroup(
  group
) {
  return {
    label:
      group.label,

    type:
      group.type,

    factors:
      group.factors,

    samples:
      group.samples,

    evidence_strength:
      evidenceStrength(
        group.samples
      ),

    outcomes: {
      "1m":
        finalizeStats(
          group.outcomes["1m"]
        ),

      "5m":
        finalizeStats(
          group.outcomes["5m"]
        ),

      "10m":
        finalizeStats(
          group.outcomes["10m"]
        ),

      "20m":
        finalizeStats(
          group.outcomes["20m"]
        )
    }
  };
}

/*
 * ---------------------------------------------------------
 * DISCOVERY SCORING
 * ---------------------------------------------------------
 *
 * This is NOT probability.
 *
 * It is simply a transparent ranking score
 * used to surface candidates for research.
 */
function candidateScore(
  group
) {
  const o5 =
    group.outcomes["5m"];

  const o10 =
    group.outcomes["10m"];

  const o20 =
    group.outcomes["20m"];

  if (
    !o5 ||
    !o10 ||
    !o20
  ) {
    return 0;
  }

  if (
    o5.samples < 20 ||
    o10.samples < 20 ||
    o20.samples < 20
  ) {
    return 0;
  }

  const directional5 =
    Math.abs(
      o5.up_pct - 50
    );

  const directional10 =
    Math.abs(
      o10.up_pct - 50
    );

  const directional20 =
    Math.abs(
      o20.up_pct - 50
    );

  const moveStrength =
    (
      Math.abs(
        o5.avg_move_points || 0
      ) +
      Math.abs(
        o10.avg_move_points || 0
      ) +
      Math.abs(
        o20.avg_move_points || 0
      )
    ) / 3;

  /*
   * Sample size helps ranking but does not
   * dominate the result.
   */
  const sampleFactor =
    Math.min(
      1,
      group.samples / 100
    );

  const directionalScore =
    (
      directional5 * 0.25 +
      directional10 * 0.35 +
      directional20 * 0.40
    );

  const score =
    (
      directionalScore *
      0.7
    ) +
    (
      Math.min(
        moveStrength,
        50
      ) *
      0.3
    );

  return Number(
    (
      score *
      (0.5 + sampleFactor * 0.5)
    ).toFixed(2)
  );
}

/*
 * ---------------------------------------------------------
 * REGIME AGGREGATION
 * ---------------------------------------------------------
 */

function buildRegimeGroups(
  items
) {
  const groups =
    new Map();

  for (const item of items) {
    const regime =
      item.regime;

    if (
      !groups.has(regime)
    ) {
      groups.set(
        regime,
        createGroup(
          regime,
          "REGIME",
          ["regime"]
        )
      );
    }

    addItemToGroup(
      groups.get(regime),
      item
    );
  }

  return [
    ...groups.values()
  ];
}

/*
 * ---------------------------------------------------------
 * TRANSITION DISCOVERY
 * ---------------------------------------------------------
 */

function buildTransitions(
  items
) {
  const groups =
    new Map();

  for (
    let i = 1;
    i < items.length;
    i++
  ) {
    const previous =
      items[i - 1];

    const current =
      items[i];

    if (
      previous.regime ===
      current.regime
    ) {
      continue;
    }

    const transition =
      previous.regime +
      " → " +
      current.regime;

    if (
      !groups.has(
        transition
      )
    ) {
      groups.set(
        transition,
        createGroup(
          transition,
          "TRANSITION",
          [
            "previous_regime",
            "current_regime"
          ]
        )
      );
    }

    const group =
      groups.get(
        transition
      );

    /*
     * The outcome starts from the NEW regime.
     */
    addItemToGroup(
      group,
      current
    );
  }

  return [
    ...groups.values()
  ];
}

/*
 * ---------------------------------------------------------
 * FACTOR DISCOVERY
 * ---------------------------------------------------------
 */

function buildFactorGroups(
  items,
  factorSets,
  type
) {
  const groups =
    new Map();

  for (const factors of factorSets) {
    for (const item of items) {
      const state =
        item.state;

      const valid =
        factors.every(
          factor =>
            validStateValue(
              state[factor]
            )
        );

      if (!valid) {
        continue;
      }

      const label =
        combinationSignature(
          state,
          factors
        );

      const key =
        type +
        "::" +
        label;

      if (
        !groups.has(key)
      ) {
        groups.set(
          key,
          createGroup(
            label,
            type,
            factors
          )
        );
      }

      addItemToGroup(
        groups.get(key),
        item
      );
    }
  }

  return [
    ...groups.values()
  ];
}

/*
 * ---------------------------------------------------------
 * TRANSITION + FACTOR DISCOVERY
 * ---------------------------------------------------------
 *
 * Example:
 *
 * CHOP → MOMENTUM_UP
 * + RSI MID
 * + HIGH volume
 *
 * The factors are taken from the NEW
 * regime snapshot.
 */
function buildTransitionFactorGroups(
  items,
  factorSets
) {
  const groups =
    new Map();

  for (
    let i = 1;
    i < items.length;
    i++
  ) {
    const previous =
      items[i - 1];

    const current =
      items[i];

    if (
      previous.regime ===
      current.regime
    ) {
      continue;
    }

    const transition =
      previous.regime +
      " → " +
      current.regime;

    for (
      const factors of factorSets
    ) {
      const state =
        current.state;

      const valid =
        factors.every(
          factor =>
            validStateValue(
              state[factor]
            )
        );

      if (!valid) {
        continue;
      }

      const factorLabel =
        combinationSignature(
          state,
          factors
        );

      const label =
        transition +
        " | " +
        factorLabel;

      const key =
        "TRANSITION_FACTOR::" +
        label;

      if (
        !groups.has(key)
      ) {
        groups.set(
          key,
          createGroup(
            label,
            "TRANSITION_FACTOR",
            [
              "transition",
              ...factors
            ]
          )
        );
      }

      addItemToGroup(
        groups.get(key),
        current
      );
    }
  }

  return [
    ...groups.values()
  ];
}

/*
 * ---------------------------------------------------------
 * RANKING / FILTERING
 * ---------------------------------------------------------
 */

function rankCandidates(
  groups,
  minimumSamples
) {
  return groups
    .map(group => ({
      ...finalizeGroup(group),

      research_score:
        candidateScore(group)
    }))
    .filter(
      candidate =>
        candidate.samples >=
        minimumSamples
    )
    .filter(
      candidate =>
        candidate.research_score > 0
    )
    .sort(
      (a, b) =>
        b.research_score -
        a.research_score
    );
}

/*
 * ---------------------------------------------------------
 * MAIN DISCOVERY ENGINE
 * ---------------------------------------------------------
 */

export async function calculateDiscovery(
  db,
  requestedLimit = 5000,
  minSamples = 20
) {
  const limit =
    Math.max(
      500,
      Math.min(
        Number(
          requestedLimit
        ) || 5000,
        50000
      )
    );

  const minimumSamples =
    Math.max(
      10,
      Math.min(
        Number(
          minSamples
        ) || 20,
        1000
      )
    );

  const result =
    await db
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

  const rows =
    (result.results || [])
      .map(parseRow)
      .filter(
        row =>
          row.event_time &&
          Number.isFinite(
            row.price
          )
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

      current_regime: null,

      regimes: [],

      transitions: [],

      factor_candidates: [],

      transition_factor_candidates: [],

      top_candidates: [],

      note:
        "Not enough MARKET_SNAPSHOT data."
    };
  }

  /*
   * Build complete research records.
   */
  const items =
    rows.map(row => ({
      row,

      state:
        stateFor(row),

      regime:
        classifyRegime(row),

      rsi_bucket:
        rsiBucket(
          num(
            row.payload?.rsi
          )
        ),

      outcomes:
        outcomeFor(
          row,
          rows
        )
    }));

  /*
   * Regime groups.
   */
  const regimeGroups =
    buildRegimeGroups(
      items
    );

  const regimes =
    regimeGroups
      .map(finalizeGroup)
      .sort(
        (a, b) =>
          b.samples -
          a.samples
      );

  /*
   * Transition groups.
   *
   * We expose ALL transitions here so the
   * research output can be inspected even
   * when there are fewer than minimumSamples.
   */
  const transitionGroups =
    buildTransitions(
      items
    );

  const allTransitions =
    transitionGroups
      .map(finalizeGroup)
      .sort(
        (a, b) =>
          b.samples -
          a.samples
      );

  const transitions =
    allTransitions.filter(
      item =>
        item.samples >=
        minimumSamples
    );

  /*
   * Two-factor discovery.
   */
  const twoFactorGroups =
    buildFactorGroups(
      items,
      TWO_FACTOR_PAIRS,
      "2_FACTOR"
    );

  const twoFactorCandidates =
    rankCandidates(
      twoFactorGroups,
      minimumSamples
    );

  /*
   * Three-factor discovery.
   */
  const threeFactorGroups =
    buildFactorGroups(
      items,
      THREE_FACTOR_TRIPLES,
      "3_FACTOR"
    );

  const threeFactorCandidates =
    rankCandidates(
      threeFactorGroups,
      minimumSamples
    );

  /*
   * Transition + factor discovery.
   *
   * We use the same selected 2-factor
   * combinations rather than exploding
   * the search space.
   */
  const transitionFactorGroups =
    buildTransitionFactorGroups(
      items,
      TWO_FACTOR_PAIRS
    );

  const transitionFactorCandidates =
    rankCandidates(
      transitionFactorGroups,
      minimumSamples
    );

  /*
   * Combine candidates and keep the best
   * research hypotheses.
   */
  const allCandidates = [
    ...twoFactorCandidates,
    ...threeFactorCandidates,
    ...transitionFactorCandidates
  ]
    .sort(
      (a, b) =>
        b.research_score -
        a.research_score
    )
    .slice(
      0,
      100
    );

  /*
   * Current market state.
   */
  const latest =
    items[
      items.length - 1
    ];

  /*
   * Candidate current state.
   */
  const currentState = {
    event_time:
      latest.row.event_time
        .toISOString(),

    price:
      latest.row.price,

    rsi:
      num(
        latest.row.payload?.rsi
      ),

    rsi_bucket:
      latest.rsi_bucket,

    trend:
      latest.state.trend,

    volume_state:
      latest.state.volume_state,

    volume_ratio:
      num(
        latest.row.payload
          ?.volume_ratio
      ),

    vwap:
      latest.state.vwap,

    or_state:
      latest.state.or_state,

    vpc_zone:
      latest.state.vpc_zone,

    session:
      latest.state.session,

    regime:
      latest.regime
  };

  /*
   * Determine which discovered candidates
   * match the current state.
   *
   * This is descriptive only.
   */
  const currentMatches =
    allCandidates
      .filter(candidate => {

        if (
          candidate.type ===
          "2_FACTOR" ||
          candidate.type ===
          "3_FACTOR"
        ) {
          return candidate.factors.every(
            factor => {

              if (
                factor ===
                "regime"
              ) {
                return (
                  candidate.label.includes(
                    "regime=" +
                    latest.regime
                  )
                );
              }

              return candidate.label.includes(
                factor +
                "=" +
                latest.state[factor]
              );
            }
          );
        }

        return false;
      })
      .slice(
        0,
        20
      );

  /*
   * Research warnings.
   */
  const warnings = [];

  if (
    rows.length < 5000
  ) {
    warnings.push(
      "Dataset contains fewer than 5000 snapshots. Discovery results are preliminary."
    );
  }

  if (
    regimes.length < 4
  ) {
    warnings.push(
      "Only a small number of distinct regimes have appeared in the collected data."
    );
  }

  if (
    transitions.length === 0
  ) {
    warnings.push(
      "No regime transitions currently meet the minimum sample threshold."
    );
  }

  warnings.push(
    "Candidate ranking is a research prioritization score, not a probability or trading signal."
  );

  warnings.push(
    "Candidates must be validated on unseen future data before being considered for trading."
  );

  return {
    generated_at:
      new Date().toISOString(),

    dataset: {
      snapshots:
        rows.length,

      valid_snapshots:
        rows.length,

      earliest:
        rows[0]
          .event_time
          .toISOString(),

      latest:
        rows[
          rows.length - 1
        ]
          .event_time
          .toISOString()
    },

    current_state:
      currentState,

    current_regime: {
      regime:
        latest.regime,

      evidence:
        regimes.find(
          item =>
            item.label ===
            latest.regime
        ) || null
    },

    regimes,

    transitions: allTransitions,

    qualified_transitions:
      transitions,

    factor_candidates: {
      two_factor:
        twoFactorCandidates,

      three_factor:
        threeFactorCandidates
    },

    transition_factor_candidates:
      transitionFactorCandidates,

    top_candidates:
      allCandidates,

    current_matching_candidates:
      currentMatches,

    configuration: {
      minimum_samples:
        minimumSamples,

      maximum_dataset:
        limit,

      two_factor_search_space:
        TWO_FACTOR_PAIRS,

      three_factor_search_space:
        THREE_FACTOR_TRIPLES,

      maximum_returned_candidates:
        100
    },

    methodology: {
      stage:
        "Stage 4 — Market Regime & Setup Discovery",

      purpose:
        "Discover recurring market regimes, regime transitions and historically interesting market-state combinations.",

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

      outcomes: [
        "1m",
        "5m",
        "10m",
        "20m"
      ],

      transition_definition:
        "A transition occurs when the classified regime changes between consecutive MARKET_SNAPSHOT observations.",

      transition_outcome_definition:
        "Outcomes are measured from the first snapshot belonging to the new regime.",

      candidate_definition:
        "Candidates are recurring 2-factor, 3-factor, or transition-plus-factor states with sufficient historical observations.",

      research_score:
        "A transparent ranking metric combining directional deviation from 50%, average movement magnitude and sample-size support.",

      important_warning:
        "Research score is NOT probability, confidence, expected return, or a trading recommendation.",

      validation_requirement:
        "Any candidate must be tested on unseen data before being considered for trading."
    },

    warnings
  };
}
