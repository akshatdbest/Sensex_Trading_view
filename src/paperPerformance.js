/* =========================================================
   PAPER TRADING PERFORMANCE
   ---------------------------------------------------------
   Simple performance statistics for closed paper trades.

   This module does NOT change trading decisions.
   It only measures how the existing paper-trade strategy
   has performed.
========================================================= */


/* ---------------------------------------------------------
   Helpers
--------------------------------------------------------- */

function toNumber(value){

  const n =
    Number(value);

  return Number.isFinite(n)
    ? n
    : 0;
}


/* ---------------------------------------------------------
   Calculate performance
--------------------------------------------------------- */

export async function calculatePaperPerformance(
  db,
  limit=500
){

  const result =
    await db.prepare(`
      SELECT
        *
      FROM paper_trades
      ORDER BY
        id DESC
      LIMIT ?
    `)
    .bind(limit)
    .all();


  const trades =
    result.results || [];


  const closedTrades =
    trades.filter(
      trade =>
        String(
          trade.status || ""
        ).toUpperCase()
        === "CLOSED"
    );


  const wins =
    closedTrades.filter(
      trade =>
        String(
          trade.result || ""
        ).toUpperCase()
        === "WIN"
    );


  const losses =
    closedTrades.filter(
      trade =>
        String(
          trade.result || ""
        ).toUpperCase()
        === "LOSS"
    );


  const flats =
    closedTrades.filter(
      trade =>
        String(
          trade.result || ""
        ).toUpperCase()
        === "FLAT"
    );


  const totalPnl =
    closedTrades.reduce(
      (sum,trade) =>
        sum +
        toNumber(
          trade.pnl_points
        ),
      0
    );


  const grossProfit =
    wins.reduce(
      (sum,trade) =>
        sum +
        Math.max(
          0,
          toNumber(
            trade.pnl_points
          )
        ),
      0
    );


  const grossLoss =
    losses.reduce(
      (sum,trade) =>
        sum +
        Math.abs(
          Math.min(
            0,
            toNumber(
              trade.pnl_points
            )
          )
        ),
      0
    );


  const averageWin =
    wins.length > 0

      ? wins.reduce(
          (sum,trade) =>
            sum +
            toNumber(
              trade.pnl_points
            ),
          0
        ) /
        wins.length

      : 0;


  const averageLoss =
    losses.length > 0

      ? losses.reduce(
          (sum,trade) =>
            sum +
            toNumber(
              trade.pnl_points
            ),
          0
        ) /
        losses.length

      : 0;


  const winRate =
    closedTrades.length > 0

      ? (
          wins.length /
          closedTrades.length
        ) * 100

      : 0;


  const lossRate =
    closedTrades.length > 0

      ? (
          losses.length /
          closedTrades.length
        ) * 100

      : 0;


  /*
   * Profit Factor
   *
   * Gross profit / gross loss
   */
  const profitFactor =
    grossLoss > 0
      ? grossProfit / grossLoss
      : (
          grossProfit > 0
            ? Infinity
            : 0
        );


  /*
   * Expectancy per trade
   *
   * Average points gained/lost
   * per closed trade.
   */
  const expectancy =
    closedTrades.length > 0

      ? totalPnl /
        closedTrades.length

      : 0;


  /*
   * Maximum drawdown based on
   * cumulative paper-trade points.
   */

  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;


  /*
   * The query is newest-first, so reverse it
   * to calculate equity chronologically.
   */
  const chronological =
    [...closedTrades]
      .sort(
        (a,b) =>
          Number(a.id||0) -
          Number(b.id||0)
      );


  for(
    const trade of chronological
  ){

    equity +=
      toNumber(
        trade.pnl_points
      );


    peak =
      Math.max(
        peak,
        equity
      );


    const drawdown =
      peak -
      equity;


    maxDrawdown =
      Math.max(
        maxDrawdown,
        drawdown
      );
  }


  /*
   * Maximum consecutive wins/losses.
   */

  let currentWins = 0;
  let currentLosses = 0;

  let maxWins = 0;
  let maxLosses = 0;


  for(
    const trade of chronological
  ){

    const result =
      String(
        trade.result || ""
      ).toUpperCase();


    if(result === "WIN"){

      currentWins++;
      currentLosses=0;

      maxWins =
        Math.max(
          maxWins,
          currentWins
        );

    }else if(result === "LOSS"){

      currentLosses++;
      currentWins=0;

      maxLosses =
        Math.max(
          maxLosses,
          currentLosses
        );

    }else{

      currentWins=0;
      currentLosses=0;
    }
  }


  /*
   * Direction breakdown
   */

  const callTrades =
    closedTrades.filter(
      trade =>
        String(
          trade.direction || ""
        ).toUpperCase()
        === "CALL"
    );


  const putTrades =
    closedTrades.filter(
      trade =>
        String(
          trade.direction || ""
        ).toUpperCase()
        === "PUT"
    );


  function directionStats(
    directionTrades
  ){

    const directionWins =
      directionTrades.filter(
        trade =>
          String(
            trade.result || ""
          ).toUpperCase()
          === "WIN"
      );


    const directionPnl =
      directionTrades.reduce(
        (sum,trade) =>
          sum +
          toNumber(
            trade.pnl_points
          ),
        0
      );


    return {

      trades:
        directionTrades.length,

      wins:
        directionWins.length,

      win_rate:
        directionTrades.length > 0
          ? Number(
              (
                directionWins.length /
                directionTrades.length *
                100
              ).toFixed(2)
            )
          : 0,

      pnl_points:
        Number(
          directionPnl.toFixed(2)
        )
    };
  }


  return {

    generated_at:
      new Date().toISOString(),

    total_trades:
      closedTrades.length,

    open_trades:
      trades.filter(
        trade =>
          String(
            trade.status || ""
          ).toUpperCase()
          === "OPEN"
      ).length,

    wins:
      wins.length,

    losses:
      losses.length,

    flats:
      flats.length,

    win_rate:
      Number(
        winRate.toFixed(2)
      ),

    loss_rate:
      Number(
        lossRate.toFixed(2)
      ),

    total_pnl_points:
      Number(
        totalPnl.toFixed(2)
      ),

    gross_profit:
      Number(
        grossProfit.toFixed(2)
      ),

    gross_loss:
      Number(
        grossLoss.toFixed(2)
      ),

    average_win:
      Number(
        averageWin.toFixed(2)
      ),

    average_loss:
      Number(
        averageLoss.toFixed(2)
      ),

    profit_factor:
      Number.isFinite(
        profitFactor
      )
        ? Number(
            profitFactor.toFixed(2)
          )
        : null,

    expectancy:
      Number(
        expectancy.toFixed(2)
      ),

    max_drawdown_points:
      Number(
        maxDrawdown.toFixed(2)
      ),

    max_consecutive_wins:
      maxWins,

    max_consecutive_losses:
      maxLosses,

    directions:{

      CALL:
        directionStats(
          callTrades
        ),

      PUT:
        directionStats(
          putTrades
        )
    }
  };
}
