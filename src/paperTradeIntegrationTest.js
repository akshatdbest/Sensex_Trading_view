// Stage 6B — Paper Trade Integration Test
//
// Purpose:
// Validate the real decision -> paper trade -> exit flow.
//
// This test:
// 1. Checks that no real paper trade is currently open.
// 2. Forces a qualified CALL decision.
// 3. Opens a paper trade through the same process used by
//    the live webhook.
// 4. Sends a simulated later snapshot.
// 5. Simulates the CALL target being reached.
// 6. Verifies the trade closes as WIN.
// 7. Deletes the temporary trade.
//
// IMPORTANT:
// - This is TEST ONLY.
// - No broker order is placed.
// - No real trading occurs.
// - Temporary test data is removed at the end.

import {
  getActivePaperTrade,
  processPaperTrade,
  evaluatePaperTrade
} from "./paperTrade.js";


async function deleteTrade(
  db,
  tradeId
){

  if(!tradeId)
    return;

  await db.prepare(`
    DELETE FROM paper_trades
    WHERE id = ?
  `)
  .bind(tradeId)
  .run();
}


async function runPaperTradeIntegrationTest(db){

  let testTradeId = null;

  const tests = [];

  try{

    /*
     * ------------------------------------------------------
     * TEST 1
     *
     * Make sure we are not interfering with a real
     * paper trade.
     * ------------------------------------------------------
     */

    const existingTrade =
      await getActivePaperTrade(db);

    if(existingTrade){

      return {
        success:false,

        summary:
          "Integration test aborted because a real paper trade is already open.",

        active_trade:{
          id:
            existingTrade.id,

          direction:
            existingTrade.direction,

          entry_price:
            existingTrade.entry_price
        },

        tests:[]
      };
    }


    tests.push({
      test:
        "No existing active paper trade",

      passed:
        true
    });


    /*
     * ------------------------------------------------------
     * TEST 2
     *
     * Force a qualified CALL decision.
     *
     * This has the same structure produced by
     * decision.js when a real CALL is generated.
     * ------------------------------------------------------
     */

    const forcedDecision = {

      decision:
        "CALL",

      reason:
        "INTEGRATION TEST — simulated qualified CALL",

      evidence:{
        samples:
          20,

        five_min_up_pct:
          65,

        ten_min_up_pct:
          62,

        five_min_avg_move:
          8,

        ten_min_avg_move:
          15
      }
    };


    const currentState = {

      event_time:
        "2099-01-01T10:00:00.000Z",

      price:
        73000
    };


    /*
     * This is the SAME function used by the live
     * webhook when there is no active trade.
     */

    const openResult =
      await processPaperTrade(
        db,
        {
          decision:
            forcedDecision,

          currentState
        }
      );


    const openedCorrectly =
      openResult?.opened === true &&
      openResult?.trade?.direction === "CALL" &&
      Number(
        openResult?.trade?.entry_price
      ) === 73000;


    tests.push({

      test:
        "Qualified CALL opens paper trade",

      passed:
        openedCorrectly,

      actual:
        openResult
    });


    if(!openedCorrectly){

      return {

        success:false,

        summary:
          "Integration test failed while opening the simulated CALL.",

        tests

      };
    }


    testTradeId =
      openResult.trade.id;


    /*
     * ------------------------------------------------------
     * TEST 3
     *
     * Verify the database actually contains the
     * OPEN trade.
     * ------------------------------------------------------
     */

    const activeAfterOpen =
      await getActivePaperTrade(db);


    const storedCorrectly =
      activeAfterOpen !== null &&
      Number(
        activeAfterOpen.id
      ) === Number(
        testTradeId
      ) &&
      activeAfterOpen.status === "OPEN";


    tests.push({

      test:
        "Paper trade stored as OPEN",

      passed:
        storedCorrectly,

      actual:
        activeAfterOpen
          ?{
              id:
                activeAfterOpen.id,

              status:
                activeAfterOpen.status,

              direction:
                activeAfterOpen.direction,

              entry_price:
                activeAfterOpen.entry_price,

              stop_loss:
                activeAfterOpen.stop_loss,

              target:
                activeAfterOpen.target
            }
          :null
    });


    /*
     * ------------------------------------------------------
     * TEST 4
     *
     * Simulate the NEXT TradingView snapshot.
     *
     * Price has moved upward.
     *
     * High reaches 73100.
     *
     * This should trigger the target.
     * ------------------------------------------------------
     */

    const nextSnapshot = {

      event:
        "MARKET_SNAPSHOT",

      event_time:
        "2099-01-01T10:05:00.000Z",

      price:
        73080,

      high:
        73120,

      low:
        73040,

      raw_payload:{
        price:
          73080,

        high:
          73120,

        low:
          73040,

        time:
          "2099-01-01T10:05:00.000Z"
      }
    };


    /*
     * This is the SAME evaluation function used by
     * the live webhook when a trade is already open.
     */

    const closeResult =
      await evaluatePaperTrade(
        db,
        activeAfterOpen,
        nextSnapshot
      );


    const closedCorrectly =
      closeResult?.closed === true &&
      closeResult?.trade?.status === "CLOSED" &&
      closeResult?.trade?.result === "WIN" &&
      Number(
        closeResult?.trade?.pnl_points
      ) === 100 &&
      closeResult?.trade?.exit_reason === "TARGET";


    tests.push({

      test:
        "Next snapshot closes CALL at target",

      passed:
        closedCorrectly,

      expected:{
        status:
          "CLOSED",

        result:
          "WIN",

        pnl_points:
          100,

        exit_reason:
          "TARGET"
      },

      actual:
        closeResult?.trade
          ?{
              status:
                closeResult.trade.status,

              result:
                closeResult.trade.result,

              pnl_points:
                closeResult.trade.pnl_points,

              exit_reason:
                closeResult.trade.exit_reason
            }
          :null
    });


    /*
     * ------------------------------------------------------
     * TEST 5
     *
     * Verify there is no active trade left.
     * ------------------------------------------------------
     */

    const activeAfterClose =
      await getActivePaperTrade(db);


    const fullyClosed =
      activeAfterClose === null;


    tests.push({

      test:
        "No active trade remains after exit",

      passed:
        fullyClosed,

      actual:
        activeAfterClose
          ?{
              id:
                activeAfterClose.id,

              status:
                activeAfterClose.status
            }
          :null
    });


    const passed =
      tests.filter(
        t=>t.passed
      ).length;


    const success =
      passed ===
      tests.length;


    return {

      success,

      summary:
        success
          ?"Paper-trade integration test PASSED."
          :"Paper-trade integration test FAILED.",

      tests,

      passed,

      total:
        tests.length
    };


  }finally{

    /*
     * Always remove the temporary test trade.
     *
     * This keeps real paper-trading statistics clean.
     */

    await deleteTrade(
      db,
      testTradeId
    );
  }
}


export {
  runPaperTradeIntegrationTest
};
