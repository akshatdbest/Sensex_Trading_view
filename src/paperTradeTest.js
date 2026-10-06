// Paper Trade Engine Self-Test
//
// Purpose:
// Validate the real paper-trade database lifecycle without
// waiting for a real CALL / PUT decision.
//
// The test:
// 1. Creates a temporary CALL trade.
// 2. Simulates its target being hit.
// 3. Verifies WIN.
// 4. Creates a temporary PUT trade.
// 5. Simulates its stop loss being hit.
// 6. Verifies LOSS.
// 7. Removes all temporary test trades.
//
// IMPORTANT:
// This test does NOT place real broker orders.
// Test trades are deleted after the test.

import {
  openPaperTrade,
  closePaperTrade,
  getActivePaperTrade
} from "./paperTrade.js";


async function deleteTestTrade(
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


async function runPaperTradeSelfTest(db){

  const testResults = [];

  let callTradeId = null;
  let putTradeId = null;

  try{

    /*
     * ------------------------------------------------------
     * TEST 1
     *
     * CALL
     *
     * Entry  : 73000
     * SL     : 72950
     * Target : 73100
     *
     * Simulate target hit at 73100.
     * Expected result: WIN
     * ------------------------------------------------------
     */

    const callOpen =
      await openPaperTrade(
        db,
        {
          direction: "CALL",

          entryTime:
            "2099-01-01T10:00:00.000Z",

          entryPrice:
            73000,

          decisionReason:
            "SELF TEST",

          evidenceSamples:
            20,

          stopPoints:
            50,

          targetPoints:
            100
        }
      );


    callTradeId =
      callOpen.trade?.id ??
      null;


    if(!callOpen.opened){

      testResults.push({
        test:
          "CALL target",

        passed:
          false,

        reason:
          callOpen.reason||
          "CALL trade failed to open."
      });

    }else{

      /*
       * closePaperTrade is the same function
       * used by the live paper-trade engine.
       */

      const callClose =
        await closePaperTrade(
          db,

          callOpen.trade,

          73100,

          "2099-01-01T10:05:00.000Z",

          "TARGET"
        );


      const passed =
        callClose.closed === true &&
        callClose.trade?.result === "WIN" &&
        Number(
          callClose.trade?.pnl_points
        ) === 100;


      testResults.push({
        test:
          "CALL target",

        passed,

        expected:{
          result:
            "WIN",

          pnl_points:
            100
        },

        actual:{
          result:
            callClose.trade?.result,

          pnl_points:
            callClose.trade?.pnl_points
        }
      });
    }


    /*
     * ------------------------------------------------------
     * TEST 2
     *
     * PUT
     *
     * Entry  : 73000
     * SL     : 73050
     * Target : 72900
     *
     * Simulate stop loss at 73050.
     * Expected result: LOSS
     * ------------------------------------------------------
     */

    const putOpen =
      await openPaperTrade(
        db,
        {
          direction: "PUT",

          entryTime:
            "2099-01-01T11:00:00.000Z",

          entryPrice:
            73000,

          decisionReason:
            "SELF TEST",

          evidenceSamples:
            20,

          stopPoints:
            50,

          targetPoints:
            100
        }
      );


    putTradeId =
      putOpen.trade?.id ??
      null;


    if(!putOpen.opened){

      testResults.push({
        test:
          "PUT stop loss",

        passed:
          false,

        reason:
          putOpen.reason||
          "PUT trade failed to open."
      });

    }else{

      const putClose =
        await closePaperTrade(
          db,

          putOpen.trade,

          73050,

          "2099-01-01T11:05:00.000Z",

          "STOP_LOSS"
        );


      const passed =
        putClose.closed === true &&
        putClose.trade?.result === "LOSS" &&
        Number(
          putClose.trade?.pnl_points
        ) === -50;


      testResults.push({
        test:
          "PUT stop loss",

        passed,

        expected:{
          result:
            "LOSS",

          pnl_points:
            -50
        },

        actual:{
          result:
            putClose.trade?.result,

          pnl_points:
            putClose.trade?.pnl_points
        }
      });
    }


    /*
     * ------------------------------------------------------
     * TEST 3
     *
     * Verify there is no leftover OPEN trade.
     * ------------------------------------------------------
     */

    const activeTrade =
      await getActivePaperTrade(
        db
      );


    const noActiveTrade =
      activeTrade === null;


    testResults.push({
      test:
        "No leftover open test trade",

      passed:
        noActiveTrade,

      actual:
        activeTrade
          ?{
              id:
                activeTrade.id,

              direction:
                activeTrade.direction,

              status:
                activeTrade.status
            }
          :null
    });


    const passedCount =
      testResults.filter(
        x=>x.passed
      ).length;


    const allPassed =
      testResults.length > 0 &&
      passedCount ===
      testResults.length;


    return {
      success:
        allPassed,

      summary:
        allPassed
          ?"Paper-trade engine self-test PASSED."
          :"Paper-trade engine self-test FAILED.",

      tests:
        testResults,

      passed:
        passedCount,

      total:
        testResults.length
    };


  }finally{

    /*
     * ALWAYS clean up the temporary trades.
     */

    await deleteTestTrade(
      db,
      callTradeId
    );

    await deleteTestTrade(
      db,
      putTradeId
    );
  }
}


export {
  runPaperTradeSelfTest
};
