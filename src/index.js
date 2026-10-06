import { calculateOutcomes } from "./outcomes.js";
import { calculateEvidence } from "./evidence.js";
import { calculateDiscovery } from "./discovery.js";
import { getDecisionFromEvidence } from "./decision.js";
import { runPaperTradeSelfTest } from "./paperTradeTest.js";
import { runPaperTradeIntegrationTest } from "./paperTradeIntegrationTest.js";

import {
  initPaperTradeDb,
  getActivePaperTrade,
  getPaperTrades,
  evaluatePaperTrade,
  processPaperTrade
} from "./paperTrade.js";


const DASHBOARD = `<!doctype html>
<html lang="en">

<head>

<meta charset="utf-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>

<title>SENSEX Signal Engine</title>

<style>

:root{
  --bg:#0b0e12;
  --panel:#11161c;
  --panel2:#0d1217;
  --line:#202832;
  --text:#edf2f7;
  --muted:#7f8b99;
  --accent:#5aa9ff;
  --green:#42d392;
  --red:#ff6573;
  --amber:#f4c95d;
  --cyan:#62d7e8;
  --shadow:0 12px 35px rgba(0,0,0,.22)
}

*{
  box-sizing:border-box
}

html{
  background:var(--bg)
}

body{
  margin:0;
  background:
    radial-gradient(
      circle at 15% 0%,
      #151d27 0,
      #0b0e12 35%
    );
  color:var(--text);
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
  letter-spacing:.01em
}

header{
  position:sticky;
  top:0;
  z-index:10;
  background:rgba(11,14,18,.9);
  backdrop-filter:blur(14px);
  border-bottom:1px solid var(--line)
}

.topbar{
  max-width:1500px;
  margin:auto;
  padding:17px 28px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:20px
}

.brand{
  display:flex;
  align-items:center;
  gap:13px
}

.logo{
  width:36px;
  height:36px;
  border:1px solid #2b3947;
  border-radius:10px;
  display:grid;
  place-items:center;
  background:#101923;
  color:var(--accent);
  font-weight:800
}

.brand h1{
  margin:0;
  font-size:17px;
  letter-spacing:.08em
}

.brand p{
  margin:3px 0 0;
  color:var(--muted);
  font-size:11px
}

.status{
  display:flex;
  align-items:center;
  gap:8px;
  color:var(--green);
  font-size:12px;
  font-weight:700
}

.dot{
  width:8px;
  height:8px;
  border-radius:50%;
  background:currentColor;
  box-shadow:0 0 12px currentColor
}

main{
  max-width:1500px;
  margin:auto;
  padding:25px 28px 50px
}

.eyebrow{
  color:var(--muted);
  font-size:11px;
  text-transform:uppercase;
  letter-spacing:.14em
}

.hero{
  display:flex;
  justify-content:space-between;
  align-items:flex-end;
  gap:20px;
  margin-bottom:20px
}

.hero h2{
  margin:6px 0 0;
  font-size:28px;
  letter-spacing:-.03em
}

.hero-right{
  text-align:right;
  color:var(--muted);
  font-size:12px
}

.hero-right strong{
  color:var(--text);
  font-size:14px
}

.cards{
  display:grid;
  grid-template-columns:1.45fr repeat(3,1fr);
  gap:13px
}

.card,
.panel,
.decision-panel,
.paper-panel{
  background:
    linear-gradient(
      180deg,
      rgba(20,26,33,.96),
      rgba(14,18,23,.96)
    );
  border:1px solid var(--line);
  border-radius:13px;
  box-shadow:var(--shadow)
}

.card{
  padding:17px 18px;
  min-height:112px
}

.card.primary{
  background:
    linear-gradient(
      135deg,
      #121c28,
      #10161d
    )
}

.card label{
  display:block;
  color:var(--muted);
  font-size:10px;
  text-transform:uppercase;
  letter-spacing:.14em
}

.big{
  font-size:31px;
  font-weight:800;
  letter-spacing:-.035em;
  margin-top:11px
}

.sub{
  margin-top:7px;
  color:var(--muted);
  font-size:11px
}

.metric{
  display:flex;
  justify-content:space-between;
  align-items:end;
  margin-top:11px
}

.metric strong{
  font-size:25px
}

.badge{
  display:inline-flex;
  align-items:center;
  padding:5px 8px;
  border-radius:7px;
  font-size:10px;
  font-weight:800;
  letter-spacing:.08em;
  border:1px solid var(--line);
  background:#10151b
}

.bull{
  color:var(--green)
}

.bear{
  color:var(--red)
}

.neutral{
  color:var(--amber)
}

.cyan{
  color:var(--cyan)
}

.muted{
  color:var(--muted)
}


/* --------------------------------------------------
   DECISION
-------------------------------------------------- */

.decision-panel{
  margin-top:16px;
  padding:20px
}

.decision-head{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:15px;
  margin-bottom:14px
}

.decision-title{
  font-size:13px;
  font-weight:750;
  text-transform:uppercase;
  letter-spacing:.12em
}

.decision-note{
  color:var(--muted);
  font-size:10px
}

.decision-body{
  display:grid;
  grid-template-columns:220px 1fr;
  gap:20px;
  align-items:center
}

.decision-main{
  min-height:105px;
  display:flex;
  flex-direction:column;
  justify-content:center;
  align-items:flex-start;
  padding:16px;
  border-radius:10px;
  background:var(--panel2);
  border:1px solid #1c242d
}

.decision-label{
  color:var(--muted);
  font-size:9px;
  text-transform:uppercase;
  letter-spacing:.14em
}

.decision-value{
  margin-top:7px;
  font-size:28px;
  font-weight:850;
  letter-spacing:.02em
}

.decision-value.call{
  color:var(--green)
}

.decision-value.put{
  color:var(--red)
}

.decision-value.no-trade{
  color:var(--amber)
}

.decision-value.waiting{
  color:var(--muted)
}

.decision-reason{
  color:var(--text);
  font-size:13px;
  line-height:1.5
}

.decision-meta{
  display:flex;
  gap:9px;
  margin-top:12px;
  flex-wrap:wrap
}

.decision-chip{
  background:#10151b;
  border:1px solid #222c36;
  border-radius:7px;
  padding:7px 9px;
  font-size:10px;
  color:var(--muted)
}

.decision-chip strong{
  color:var(--text);
  margin-left:4px
}


/* --------------------------------------------------
   PAPER TRADE
-------------------------------------------------- */

.paper-panel{
  margin-top:16px;
  padding:20px
}

.paper-head{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:15px;
  margin-bottom:14px
}

.paper-title{
  font-size:13px;
  font-weight:750;
  text-transform:uppercase;
  letter-spacing:.12em
}

.paper-note{
  color:var(--muted);
  font-size:10px
}

.paper-status{
  padding:18px;
  border-radius:10px;
  background:var(--panel2);
  border:1px solid #1c242d
}

.paper-empty{
  color:var(--muted);
  font-size:13px
}

.paper-grid{
  display:grid;
  grid-template-columns:repeat(6,1fr);
  gap:9px
}

.paper-item{
  background:var(--panel2);
  border:1px solid #1c242d;
  border-radius:9px;
  padding:12px
}

.paper-item span{
  display:block;
  color:var(--muted);
  font-size:9px;
  text-transform:uppercase;
  letter-spacing:.1em
}

.paper-item b{
  display:block;
  margin-top:7px;
  font-size:14px
}

.paper-call{
  color:var(--green)
}

.paper-put{
  color:var(--red)
}

.paper-win{
  color:var(--green)
}

.paper-loss{
  color:var(--red)
}

.paper-flat{
  color:var(--amber)
}

.paper-hold{
  color:var(--cyan)
}


/* --------------------------------------------------
   STATE
-------------------------------------------------- */

.panel{
  margin-top:16px;
  padding:18px
}

.panel-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  margin-bottom:14px
}

.panel-title{
  font-size:14px;
  font-weight:750
}

.panel-note{
  font-size:11px;
  color:var(--muted)
}

.state-grid{
  display:grid;
  grid-template-columns:repeat(6,1fr);
  gap:9px
}

.state{
  background:var(--panel2);
  border:1px solid #1c242d;
  border-radius:9px;
  padding:12px
}

.state span{
  display:block;
  color:var(--muted);
  font-size:10px;
  text-transform:uppercase;
  letter-spacing:.1em
}

.state b{
  display:block;
  margin-top:7px;
  font-size:13px
}

.state small{
  display:block;
  margin-top:4px;
  color:#596572;
  font-size:10px
}


/* --------------------------------------------------
   TABLES
-------------------------------------------------- */

.section-title{
  margin:24px 0 10px;
  color:var(--muted);
  font-size:10px;
  text-transform:uppercase;
  letter-spacing:.15em
}

.tablewrap{
  overflow:auto;
  border:1px solid var(--line);
  border-radius:10px
}

table{
  width:100%;
  border-collapse:collapse;
  min-width:1220px;
  background:#0e1318
}

th,
td{
  text-align:left;
  padding:11px 10px;
  border-bottom:1px solid #1b222a;
  font-size:11px;
  white-space:nowrap
}

th{
  position:sticky;
  top:0;
  background:#121820;
  color:#7f8b99;
  font-size:9px;
  text-transform:uppercase;
  letter-spacing:.11em;
  z-index:1
}

tr:last-child td{
  border-bottom:0
}

tbody tr:hover{
  background:#121920
}

.pill{
  display:inline-flex;
  padding:4px 7px;
  border-radius:6px;
  font-size:9px;
  font-weight:800;
  letter-spacing:.05em;
  background:#141a21;
  border:1px solid #222c36
}

.pill.green{
  color:var(--green);
  border-color:rgba(66,211,146,.22)
}

.pill.red{
  color:var(--red);
  border-color:rgba(255,101,115,.22)
}

.pill.amber{
  color:var(--amber);
  border-color:rgba(244,201,93,.22)
}

.pill.blue{
  color:var(--accent);
  border-color:rgba(90,169,255,.22)
}


/* --------------------------------------------------
   EVIDENCE
-------------------------------------------------- */

.evidence-summary{
  display:grid;
  grid-template-columns:1.3fr repeat(4,1fr);
  gap:9px;
  margin-bottom:14px
}

.evidence-card{
  background:var(--panel2);
  border:1px solid #1c242d;
  border-radius:9px;
  padding:13px
}

.evidence-card span{
  display:block;
  color:var(--muted);
  font-size:9px;
  text-transform:uppercase;
  letter-spacing:.1em
}

.evidence-card b{
  display:block;
  margin-top:7px;
  font-size:15px
}

.evidence-card small{
  display:block;
  margin-top:5px;
  color:#596572;
  font-size:10px
}

.evidence-good{
  color:var(--green)
}

.evidence-bad{
  color:var(--red)
}

.evidence-neutral{
  color:var(--amber)
}

.evidence-table{
  width:100%;
  border-collapse:collapse;
  min-width:900px;
  background:#0e1318
}

.evidence-table th,
.evidence-table td{
  text-align:left;
  padding:10px;
  border-bottom:1px solid #1b222a;
  font-size:11px;
  white-space:nowrap
}

.evidence-table th{
  background:#121820;
  color:#7f8b99;
  font-size:9px;
  text-transform:uppercase;
  letter-spacing:.1em
}

.evidence-table tr:last-child td{
  border-bottom:0
}

.evidence-table .positive{
  color:var(--green)
}

.evidence-table .negative{
  color:var(--red)
}

.evidence-table .neutral{
  color:var(--amber)
}

.evidence-warning{
  padding:13px;
  border:1px solid rgba(244,201,93,.22);
  border-radius:9px;
  background:rgba(244,201,93,.04);
  color:var(--amber);
  font-size:11px;
  margin-bottom:14px
}


/* --------------------------------------------------
   RESPONSIVE
-------------------------------------------------- */

@media(max-width:1150px){

  .evidence-summary{
    grid-template-columns:repeat(3,1fr)
  }

  .cards{
    grid-template-columns:repeat(2,1fr)
  }

  .state-grid{
    grid-template-columns:repeat(3,1fr)
  }

  .decision-body{
    grid-template-columns:1fr
  }

  .paper-grid{
    grid-template-columns:repeat(3,1fr)
  }
}

@media(max-width:700px){

  .evidence-summary{
    grid-template-columns:1fr 1fr
  }

  .topbar,
  main{
    padding-left:14px;
    padding-right:14px
  }

  .hero{
    align-items:flex-start;
    flex-direction:column
  }

  .hero-right{
    text-align:left
  }

  .cards{
    grid-template-columns:1fr
  }

  .state-grid{
    grid-template-columns:repeat(2,1fr)
  }

  .big{
    font-size:27px
  }

  .decision-body{
    grid-template-columns:1fr
  }

  .paper-grid{
    grid-template-columns:1fr 1fr
  }
}

.empty{
  text-align:center;
  padding:35px;
  color:var(--muted);
  font-size:12px
}

.footer{
  text-align:center;
  color:#4f5a66;
  font-size:10px;
  margin-top:22px
}

</style>

</head>


<body>


<header>

<div class="topbar">

<div class="brand">

<div class="logo">S</div>

<div>

<h1>SENSEX SIGNAL ENGINE</h1>

<p>
Live market-state intelligence · 1-minute snapshots
</p>

</div>

</div>

<div id="status" class="status">

<span class="dot"></span>

<span>CONNECTING</span>

</div>

</div>

</header>


<main>


<section class="hero">

<div>

<div class="eyebrow">
Market overview
</div>

<h2>
SENSEX <span class="muted">/ BSE</span>
</h2>

</div>

<div class="hero-right">

<div>
Last snapshot
</div>

<strong id="updated">—</strong>

<div id="age">—</div>

</div>

</section>


<section class="cards">


<div class="card primary">

<label>
Last price
</label>

<div id="price" class="big">
—
</div>

<div class="sub">
1-minute market snapshot
</div>

</div>


<div class="card">

<label>
RSI (14)
</label>

<div class="metric">

<strong id="rsi">
—
</strong>

<span id="rsiBadge" class="badge">
—
</span>

</div>

<div id="rsiHint" class="sub">
Momentum
</div>

</div>


<div class="card">

<label>
Trend
</label>

<div class="metric">

<strong id="trend">
—
</strong>

<span id="trendBadge" class="badge">
—
</span>

</div>

<div class="sub">
VPC mid + price structure
</div>

</div>


<div class="card">

<label>
Volume
</label>

<div class="metric">

<strong id="volumeState">
—
</strong>

<span id="volumeRatio" class="badge">
—
</span>

</div>

<div class="sub">
Relative to 20-period average
</div>

</div>


</section>


<!-- =====================================================
     CURRENT DECISION
===================================================== -->

<section class="decision-panel">

<div class="decision-head">

<div class="decision-title">
Current Decision
</div>

<div class="decision-note">
Historical evidence driven · no forced trade
</div>

</div>


<div class="decision-body">


<div class="decision-main">

<div class="decision-label">
Signal
</div>

<div
  id="decisionValue"
  class="decision-value waiting"
>
WAITING
</div>

</div>


<div>

<div
  id="decisionReason"
  class="decision-reason"
>
Waiting for decision engine...
</div>


<div class="decision-meta">

<div class="decision-chip">
Historical samples
<strong id="decisionSamples">—</strong>
</div>

<div class="decision-chip">
Required
<strong>20</strong>
</div>

<div class="decision-chip">
5m UP
<strong id="decision5mUp">—</strong>
</div>

<div class="decision-chip">
10m UP
<strong id="decision10mUp">—</strong>
</div>

<div class="decision-chip">
5m Avg
<strong id="decision5mMove">—</strong>
</div>

<div class="decision-chip">
10m Avg
<strong id="decision10mMove">—</strong>
</div>

</div>

</div>

</div>

</section>


<!-- =====================================================
     PAPER TRADING
===================================================== -->

<section class="paper-panel">

<div class="paper-head">

<div class="paper-title">
Paper Trading
</div>

<div class="paper-note">
SENSEX points · simulated only
</div>

</div>

<div id="paperTradeContent">

<div class="paper-status">

<div class="paper-empty">
Loading paper-trade state...
</div>

</div>

</div>

</section>


<!-- =====================================================
     CURRENT MARKET STATE
===================================================== -->

<section class="panel">

<div class="panel-head">

<div class="panel-title">
Current market state
</div>

<div class="panel-note">
Values are sourced directly from the TradingView snapshot
</div>

</div>

<div
  class="state-grid"
  id="stateGrid"
></div>

</section>


<!-- =====================================================
     HISTORICAL EVIDENCE
===================================================== -->

<section class="panel">

<div class="panel-head">

<div class="panel-title">
Historical Evidence
</div>

<div class="panel-note">
Historical SENSEX outcomes · minimum 20 samples for dashboard evidence
</div>

</div>

<div id="evidenceContent">

<div class="empty">
Loading historical evidence...
</div>

</div>

</section>


<!-- =====================================================
     SNAPSHOT HISTORY
===================================================== -->

<section class="panel">

<div class="panel-head">

<div class="panel-title">
Snapshot history
</div>

<div class="panel-note">
Latest 50 · auto-refresh 3 sec
</div>

</div>

<div class="tablewrap">

<table>

<thead>

<tr>

<th>Time</th>
<th>Price</th>
<th>RSI</th>
<th>Trend</th>
<th>Volume</th>
<th>Ratio</th>
<th>VWAP</th>
<th>VWAP Dist</th>
<th>OR State</th>
<th>VPC Zone</th>
<th>ADR</th>
<th>VIX</th>
<th>Session</th>
<th>ATM</th>

</tr>

</thead>

<tbody id="history"></tbody>

</table>

</div>

</section>


<!-- =====================================================
     SIGNAL EVENTS
===================================================== -->

<section class="panel">

<div class="panel-head">

<div class="panel-title">
Signal event log
</div>

<div class="panel-note">
Breakouts, retests and other TradingView events
</div>

</div>

<div class="tablewrap">

<table>

<thead>

<tr>

<th>Time</th>
<th>Event</th>
<th>Price</th>
<th>High</th>
<th>Low</th>
<th>Volume</th>
<th>Bias</th>

</tr>

</thead>

<tbody id="events"></tbody>

</table>

</div>

</section>


<div class="footer">

SENSEX Signal Engine · Data is informational and not a trading recommendation

</div>


</main>


<script>


const $=id=>
  document.getElementById(id);


const n=v=>

  v==null ||
  v==="" ||
  Number.isNaN(Number(v))

    ?"—"

    :Number(v).toLocaleString(
      "en-IN",
      {
        maximumFractionDigits:2
      }
    );


const t=v=>

  v
    ?new Date(v).toLocaleTimeString(
      "en-IN",
      {
        hour12:false
      }
    )
    :"—";


const txt=v=>

  v==null ||
  v===""

    ?"—"

    :String(v);


const cls=v=>
  String(v||"").toUpperCase();


const pill=(v,type="amber")=>

  '<span class="pill '+type+'">'+
  txt(v)+
  '</span>';


function tone(v){

  const x=
    String(v||"").toUpperCase();

  return

    x==="BULL" ||
    x==="HIGH" ||
    x==="ABOVE" ||
    x==="BULLISH"

      ?"green"

      :

    x==="BEAR" ||
    x==="LOW" ||
    x==="BELOW" ||
    x==="BEARISH"

      ?"red"

      :

    x==="NEUTRAL" ||
    x==="WATCH" ||
    x==="AT"

      ?"amber"

      :

      "blue";
}


function rsiTone(v){

  const x=Number(v);

  return Number.isFinite(x)

    ?(
        x>=60
          ?"green"
          :
        x<=40
          ?"red"
          :
          "amber"
      )

    :"amber";
}


function detail(
  label,
  value,
  sub,
  type
){

  return

    '<div class="state">'+

      '<span>'+
        label+
      '</span>'+

      '<b class="'+
        (type||tone(value))+
      '">' +
        txt(value)+
      '</b>'+

      (
        sub
          ?'<small>'+
             sub+
           '</small>'
          :""
      )+

    '</div>';
}


function renderState(s,p){

  $("stateGrid").innerHTML=[

    detail(
      "VWAP",
      p.vwap,
      "Distance: "+
        n(p.vwap_distance)+
        " pts",
      tone(p.vwap)
    ),

    detail(
      "Opening range",
      p.or_state,
      "High "+
        n(p.or_high)+
        " · Low "+
        n(p.or_low)
    ),

    detail(
      "VPC zone",
      p.vpc_zone,
      "Mid "+
        n(p.vpc_mid)
    ),

    detail(
      "ADR consumed",
      n(p.adr_used_pct)+"%",
      "Session range usage"
    ),

    detail(
      "India VIX",
      n(p.vix),
      "Volatility context"
    ),

    detail(
      "Session",
      p.session,
      "Market phase"
    ),

    detail(
      "ATM strike",
      n(p.atm_strike),
      "Current reference strike"
    ),

    detail(
      "1-minute price",
      n(s.price),
      "Current SENSEX level"
    ),

    detail(
      "Volume ratio",
      n(p.volume_ratio),
      "Relative volume"
    ),

    detail(
      "OR high",
      n(p.or_high),
      "Opening range ceiling"
    ),

    detail(
      "OR low",
      n(p.or_low),
      "Opening range floor"
    ),

    detail(
      "Event",
      s.event,
      "TradingView event"
    )

  ].join("");
}


function evidencePct(v){

  if(
    v==null ||
    Number.isNaN(Number(v))
  )
    return "—";

  return Number(v).toFixed(1)+"%";
}


function evidenceMove(v){

  if(
    v==null ||
    Number.isNaN(Number(v))
  )
    return "—";

  const x=Number(v);

  return(
    x>0
      ?"+"
      :""
  )+
  x.toFixed(2);
}


function evidenceClass(v){

  if(
    v==null ||
    Number.isNaN(Number(v))
  )
    return "neutral";

  const x=Number(v);

  if(x>0)
    return "positive";

  if(x<0)
    return "negative";

  return "neutral";
}


function evidenceStrength(samples){

  if(samples>=100)
    return "STRONGER";

  if(samples>=50)
    return "MODERATE";

  if(samples>=20)
    return "LOW";

  if(samples>=10)
    return "VERY LOW";

  return "INSUFFICIENT";
}


/* --------------------------------------------------
   DECISION RENDER
-------------------------------------------------- */

function renderDecision(data){

  const value=
    $("decisionValue");

  const reason=
    $("decisionReason");

  if(
    !data ||
    !data.decision
  ){

    value.textContent=
      "WAITING";

    value.className=
      "decision-value waiting";

    reason.textContent=
      "Decision engine data unavailable.";

    $("decisionSamples").textContent="—";
    $("decision5mUp").textContent="—";
    $("decision10mUp").textContent="—";
    $("decision5mMove").textContent="—";
    $("decision10mMove").textContent="—";

    return;
  }

  const decision=
    data.decision;

  const d=
    String(
      decision.decision||
      "NO TRADE"
    ).toUpperCase();

  value.textContent=d;

  if(d==="CALL"){

    value.className=
      "decision-value call";

  }else if(d==="PUT"){

    value.className=
      "decision-value put";

  }else{

    value.className=
      "decision-value no-trade";
  }

  reason.textContent=
    decision.reason||
    "No decision reason available.";

  const evidence=
    decision.evidence||{};

  $("decisionSamples").textContent=
    evidence.samples==null
      ?"—"
      :evidence.samples;

  $("decision5mUp").textContent=
    evidence.five_min_up_pct==null
      ?"—"
      :Number(
        evidence.five_min_up_pct
      ).toFixed(1)+"%";

  $("decision10mUp").textContent=
    evidence.ten_min_up_pct==null
      ?"—"
      :Number(
        evidence.ten_min_up_pct
      ).toFixed(1)+"%";

  $("decision5mMove").textContent=
    evidence.five_min_avg_move==null
      ?"—"
      :evidenceMove(
        evidence.five_min_avg_move
      )+
      " pts";

  $("decision10mMove").textContent=
    evidence.ten_min_avg_move==null
      ?"—"
      :evidenceMove(
        evidence.ten_min_avg_move
      )+
      " pts";
}


/* --------------------------------------------------
   PAPER TRADE RENDER
-------------------------------------------------- */

function renderPaperTrade(data){

  const container=
    $("paperTradeContent");

  if(!data){

    container.innerHTML=
      '<div class="paper-status">'+
      '<div class="paper-empty">'+
      'Paper-trade data unavailable.'+
      '</div>'+
      '</div>';

    return;
  }

  const active=
    data.active_trade;

  if(!active){

    container.innerHTML=
      '<div class="paper-status">'+
      '<div class="paper-empty">'+
      'NO ACTIVE TRADE</div>'+
      '<div class="sub">'+
      'Waiting for a qualified CALL or PUT decision.'+
      '</div>'+
      '</div>';

    return;
  }

  const direction=
    String(
      active.direction||""
    ).toUpperCase();

  const directionClass=
    direction==="CALL"
      ?"paper-call"
      :"paper-put";

  const unrealized=
    Number(
      data.unrealized_pnl_points
    );

  const pnlText=
    Number.isFinite(unrealized)
      ?(
        unrealized>=0
          ?"+"
          :""
       )+
       unrealized.toFixed(2)+
       " pts"
      :"—";

  const pnlClass=
    unrealized>0
      ?"paper-win"
      :
    unrealized<0
      ?"paper-loss"
      :
      "paper-flat";

  container.innerHTML=

    '<div class="paper-grid">'+

      '<div class="paper-item">'+
        '<span>Direction</span>'+
        '<b class="'+
          directionClass+
        '">'+
          txt(direction)+
        '</b>'+
      '</div>'+

      '<div class="paper-item">'+
        '<span>Entry</span>'+
        '<b>'+
          n(active.entry_price)+
        '</b>'+
      '</div>'+

      '<div class="paper-item">'+
        '<span>Stop loss</span>'+
        '<b class="paper-loss">'+
          n(active.stop_loss)+
        '</b>'+
      '</div>'+

      '<div class="paper-item">'+
        '<span>Target</span>'+
        '<b class="paper-win">'+
          n(active.target)+
        '</b>'+
      '</div>'+

      '<div class="paper-item">'+
        '<span>Current P&L</span>'+
        '<b class="'+
          pnlClass+
        '">'+
          pnlText+
        '</b>'+
      '</div>'+

      '<div class="paper-item">'+
        '<span>Samples</span>'+
        '<b>'+
          txt(active.evidence_samples)+
        '</b>'+
      '</div>'+

    '</div>'+

    '<div class="sub">'+
      'Opened: '+
      t(active.entry_time)+
      ' · Paper trade only'+
    '</div>';
}


/* --------------------------------------------------
   HISTORICAL EVIDENCE
-------------------------------------------------- */

function renderEvidence(data){

  const container=
    $("evidenceContent");

  if(
    !data ||
    !data.current_state
  ){

    container.innerHTML=
      '<div class="empty">'+
      'Historical evidence unavailable.'+
      '</div>';

    return;
  }

  const current=
    data.current_state;

  const currentEvidence=
    data.current_state_evidence;

  const currentMatches=
    currentEvidence
      ?Math.max(
        ...[
          "1m",
          "5m",
          "10m",
          "20m"
        ].map(
          h=>
            currentEvidence
              .outcomes[h]
              ?.samples||0
        )
      )
      :0;

  const strength=
    evidenceStrength(
      currentMatches
    );

  let html="";

  html+=
    '<div class="evidence-warning">';

  html+=
    "Current state: <strong>";

  html+=
    txt(current.rsi_bucket)+
    " · ";

  html+=
    txt(current.trend)+
    " · ";

  html+=
    txt(current.volume_state)+
    " · ";

  html+=
    txt(current.vwap)+
    " · ";

  html+=
    txt(current.or_state)+
    " · ";

  html+=
    txt(current.vpc_zone)+
    " · ";

  html+=
    txt(current.session);

  html+=
    "</strong><br>";

  html+=
    "Historical matches: <strong>"+
    currentMatches+
    "</strong> · ";

  html+=
    "Evidence strength: <strong>"+
    strength+
    "</strong>";

  html+=
    "</div>";


  html+=
    '<div class="evidence-summary">';


  for(
    const horizon of [
      "1m",
      "5m",
      "10m",
      "20m"
    ]
  ){

    const o=
      currentEvidence
        ?.outcomes?.[horizon];

    const samples=
      o?.samples||0;

    if(
      !o ||
      samples<20
    ){

      html+=
        '<div class="evidence-card">'+
        '<span>'+
          horizon+
        '</span>'+
        '<b class="evidence-neutral">'+
          'INSUFFICIENT'+
        '</b>'+
        '<small>'+
          samples+
          ' samples · 20 required'+
        '</small>'+
        '</div>';

      continue;
    }

    html+=
      '<div class="evidence-card">'+
      '<span>'+
        horizon+
      '</span>'+
      '<b class="'+
        evidenceClass(
          o.avg_move_points
        )+
      '">'+
        evidenceMove(
          o.avg_move_points
        )+
        ' pts'+
      '</b>'+
      '<small>'+
        evidencePct(o.up_pct)+
        ' UP · '+
        evidencePct(o.down_pct)+
        ' DOWN · '+
        o.samples+
        ' samples'+
      '</small>'+
      '</div>';
  }

  html+="</div>";


  html+=
    '<div class="section-title">'+
    'Factor Evidence'+
    '</div>';

  html+=
    '<div class="tablewrap">';

  html+=
    '<table class="evidence-table">';

  html+=
    "<thead><tr>";

  html+=
    "<th>Factor</th>";

  html+=
    "<th>Value</th>";

  html+=
    "<th>Samples</th>";

  html+=
    "<th>5m UP</th>";

  html+=
    "<th>5m Avg</th>";

  html+=
    "<th>10m UP</th>";

  html+=
    "<th>10m Avg</th>";

  html+=
    "<th>20m UP</th>";

  html+=
    "<th>20m Avg</th>";

  html+=
    "</tr></thead><tbody>";


  const factors=
    data.factors||[];


  for(
    const factorGroup of factors
  ){

    for(
      const item of factorGroup
    ){

      const o5=
        item.outcomes?.["5m"];

      const o10=
        item.outcomes?.["10m"];

      const o20=
        item.outcomes?.["20m"];

      const samples=
        Math.max(
          o5?.samples||0,
          o10?.samples||0,
          o20?.samples||0
        );

      if(samples<20)
        continue;

      html+="<tr>";

      html+=
        "<td>"+
        txt(item.factor)+
        "</td>";

      html+=
        "<td><strong>"+
        txt(item.value)+
        "</strong></td>";

      html+=
        "<td>"+
        samples+
        "</td>";

      html+=
        '<td class="'+
        evidenceClass(
          o5?.up_pct-50
        )+
        '">'+
        evidencePct(
          o5?.up_pct
        )+
        "</td>";

      html+=
        '<td class="'+
        evidenceClass(
          o5?.avg_move_points
        )+
        '">'+
        evidenceMove(
          o5?.avg_move_points
        )+
        "</td>";

      html+=
        '<td class="'+
        evidenceClass(
          o10?.up_pct-50
        )+
        '">'+
        evidencePct(
          o10?.up_pct
        )+
        "</td>";

      html+=
        '<td class="'+
        evidenceClass(
          o10?.avg_move_points
        )+
        '">'+
        evidenceMove(
          o10?.avg_move_points
        )+
        "</td>";

      html+=
        '<td class="'+
        evidenceClass(
          o20?.up_pct-50
        )+
        '">'+
        evidencePct(
          o20?.up_pct
        )+
        "</td>";

      html+=
        '<td class="'+
        evidenceClass(
          o20?.avg_move_points
        )+
        '">'+
        evidenceMove(
          o20?.avg_move_points
        )+
        "</td>";

      html+="</tr>";
    }
  }

  html+="</tbody></table></div>";


  html+=
    '<div class="section-title">'+
    'Historical Combinations'+
    '</div>';


  const combinations=
    data.combinations||[];


  const usableCombinations=
    combinations.filter(
      group=>{

        return [
          "1m",
          "5m",
          "10m",
          "20m"
        ].some(
          h=>
            (
              group
                .outcomes?.[h]
                ?.samples||0
            )>=20
        );
      }
    );


  if(
    !usableCombinations.length
  ){

    html+=
      '<div class="evidence-warning">'+
      "No exact market-state combination has "+
      "20+ historical samples yet. "+
      "Continue collecting data."+
      "</div>";

  }else{

    html+=
      '<div class="tablewrap">';

    html+=
      '<table class="evidence-table">';

    html+=
      "<thead><tr>";

    html+=
      "<th>Market State</th>";

    html+=
      "<th>Samples</th>";

    html+=
      "<th>5m UP</th>";

    html+=
      "<th>5m Avg</th>";

    html+=
      "<th>10m UP</th>";

    html+=
      "<th>10m Avg</th>";

    html+=
      "<th>20m UP</th>";

    html+=
      "<th>20m Avg</th>";

    html+=
      "</tr></thead><tbody>";


    for(
      const group of
      usableCombinations
    ){

      const o5=
        group.outcomes["5m"];

      const o10=
        group.outcomes["10m"];

      const o20=
        group.outcomes["20m"];


      html+="<tr>";

      html+=
        "<td>"+
        txt(group.signature)+
        "</td>";

      html+=
        "<td>"+
        Math.max(
          o5?.samples||0,
          o10?.samples||0,
          o20?.samples||0
        )+
        "</td>";

      html+=
        '<td class="'+
        evidenceClass(
          (o5?.up_pct??50)-50
        )+
        '">'+
        evidencePct(
          o5?.up_pct
        )+
        "</td>";

      html+=
        '<td class="'+
        evidenceClass(
          o5?.avg_move_points
        )+
        '">'+
        evidenceMove(
          o5?.avg_move_points
        )+
        "</td>";

      html+=
        '<td class="'+
        evidenceClass(
          (o10?.up_pct??50)-50
        )+
        '">'+
        evidencePct(
          o10?.up_pct
        )+
        "</td>";

      html+=
        '<td class="'+
        evidenceClass(
          o10?.avg_move_points
        )+
        '">'+
        evidenceMove(
          o10?.avg_move_points
        )+
        "</td>";

      html+=
        '<td class="'+
        evidenceClass(
          (o20?.up_pct??50)-50
        )+
        '">'+
        evidencePct(
          o20?.up_pct
        )+
        "</td>";

      html+=
        '<td class="'+
        evidenceClass(
          o20?.avg_move_points
        )+
        '">'+
        evidenceMove(
          o20?.avg_move_points
        )+
        "</td>";

      html+="</tr>";
    }

    html+="</tbody></table></div>";
  }

  container.innerHTML=
    html;
}


/* --------------------------------------------------
   MAIN REFRESH
-------------------------------------------------- */

async function refresh(){

  try{

    const response=
      await fetch(
        "/api/signals?limit=50",
        {
          cache:"no-store"
        }
      );

    if(!response.ok)
      throw new Error(
        "HTTP "+response.status
      );

    const d=
      await response.json();


    /* -----------------------------------------------
       Historical evidence
    ------------------------------------------------ */

    const evidenceResponse=
      await fetch(
        "/api/evidence?limit=5000&minSamples=20",
        {
          cache:"no-store"
        }
      );

    if(evidenceResponse.ok){

      const evidence=
        await evidenceResponse.json();

      renderEvidence(
        evidence
      );
    }


    /* -----------------------------------------------
       Decision
    ------------------------------------------------ */

    const decisionResponse=
      await fetch(
        "/api/decision?limit=5000",
        {
          cache:"no-store"
        }
      );

    if(decisionResponse.ok){

      const decision=
        await decisionResponse.json();

      renderDecision(
        decision
      );

    }else{

      renderDecision(null);
    }


    /* -----------------------------------------------
       Paper trade
    ------------------------------------------------ */

    const paperResponse=
      await fetch(
        "/api/paper-trade",
        {
          cache:"no-store"
        }
      );

    if(paperResponse.ok){

      const paper=
        await paperResponse.json();

      renderPaperTrade(
        paper
      );

    }else{

      renderPaperTrade(null);
    }


    /* -----------------------------------------------
       Signals
    ------------------------------------------------ */

    const rows=
      d.signals||[];

    const snapshots=
      rows.filter(
        r=>
          r.event===
          "MARKET_SNAPSHOT"
      );

    const s=
      snapshots[0]||
      rows[0];


    $("status").innerHTML=
      '<span class="dot"></span>'+
      '<span>'+
      (
        s
          ?"LIVE"
          :"WAITING"
      )+
      '</span>';

    $("status").style.color=
      s
        ?"var(--green)"
        :"var(--amber)";


    if(!s){

      $("stateGrid").innerHTML=
        '<div class="empty" '+
        'style="grid-column:1/-1">'+
        "Waiting for TradingView snapshot..."+
        "</div>";

      $("history").innerHTML="";
      $("events").innerHTML="";

      return;
    }


    const p=
      s.raw_payload||{};

    const trend=
      cls(p.trend);

    const vol=
      cls(p.volume_state);

    const rsi=
      Number(p.rsi);

    const previous=
      snapshots[1];

    const delta=
      previous
        ?Number(s.price)-
          Number(previous.price)
        :null;


    $("price").textContent=
      n(s.price);

    $("price").title=
      delta==null
        ?""
        :"1m change: "+
        (
          delta>=0
            ?"+"
            :""
        )+
        n(delta);


    $("rsi").textContent=
      n(p.rsi);

    $("rsiBadge").textContent=
      rsi>=60
        ?"HIGH"
        :
      rsi<=40
        ?"LOW"
        :
        "MID";

    $("rsiBadge").className=
      "badge "+
      rsiTone(rsi);

    $("rsiHint").textContent=
      rsi>=70
        ?"Overbought zone"
        :
      rsi<=30
        ?"Oversold zone"
        :
      rsi>=60
        ?"Positive momentum"
        :
      rsi<=40
        ?"Negative momentum"
        :
        "Neutral momentum";


    $("trend").textContent=
      txt(p.trend);

    $("trendBadge").textContent=
      txt(p.vpc_zone);

    $("trendBadge").className=
      "badge "+
      tone(p.trend);

    $("trend").className=
      trend==="BULL"
        ?"bull"
        :
      trend==="BEAR"
        ?"bear"
        :
        "neutral";


    $("volumeState").textContent=
      txt(p.volume_state);

    $("volumeState").className=
      vol==="HIGH"
        ?"bull"
        :
      vol==="LOW"
        ?"neutral"
        :
        "cyan";

    $("volumeRatio").textContent=
      n(p.volume_ratio)+
      "×";

    $("volumeRatio").className=
      "badge "+
      (
        Number(p.volume_ratio)>=1.5
          ?"green"
          :
        Number(p.volume_ratio)<.8
          ?"amber"
          :
          "blue"
      );


    $("updated").textContent=
      t(
        s.event_time||
        s.received_at
      );


    const ageSec=
      Math.max(
        0,
        Math.round(
          (
            Date.now()-
            new Date(
              s.event_time||
              s.received_at
            ).getTime()
          )/1000
        )
      );


    $("age").textContent=
      ageSec<90
        ?"Live · "+
          ageSec+
          "s ago"
        :
        "Stale · "+
        ageSec+
        "s ago";


    $("age").style.color=
      ageSec<90
        ?"var(--green)"
        :"var(--red)";


    renderState(
      s,
      p
    );


    $("history").innerHTML=
      snapshots.map(
        r=>{

          const q=
            r.raw_payload||{};

          return

            "<tr>"+

            "<td>"+
              t(
                r.event_time||
                r.received_at
              )+
            "</td>"+

            "<td><strong>"+
              n(r.price)+
            "</strong></td>"+

            "<td>"+
              n(q.rsi)+
            "</td>"+

            "<td>"+
              pill(
                q.trend,
                tone(q.trend)
              )+
            "</td>"+

            "<td>"+
              pill(
                q.volume_state,
                tone(q.volume_state)
              )+
            "</td>"+

            "<td>"+
              n(q.volume_ratio)+
              "×"+
            "</td>"+

            "<td>"+
              pill(
                q.vwap,
                tone(q.vwap)
              )+
            "</td>"+

            "<td>"+
              n(q.vwap_distance)+
            "</td>"+

            "<td>"+
              txt(q.or_state)+
            "</td>"+

            "<td>"+
              txt(q.vpc_zone)+
            "</td>"+

            "<td>"+
              n(q.adr_used_pct)+
              "%"+
            "</td>"+

            "<td>"+
              n(q.vix)+
            "</td>"+

            "<td>"+
              txt(q.session)+
            "</td>"+

            "<td>"+
              n(q.atm_strike)+
            "</td>"+

            "</tr>";

        }
      ).join("")

      ||

      '<tr>'+
      '<td colspan="14" class="empty">'+
      "No snapshots yet"+
      "</td>"+
      "</tr>";


    $("events").innerHTML=
      rows.map(
        r=>

          "<tr>"+

          "<td>"+
            t(
              r.event_time||
              r.received_at
            )+
          "</td>"+

          "<td>"+
            pill(
              r.event,
              tone(r.event)
            )+
          "</td>"+

          "<td>"+
            n(r.price)+
          "</td>"+

          "<td>"+
            n(r.high)+
          "</td>"+

          "<td>"+
            n(r.low)+
          "</td>"+

          "<td>"+
            n(r.volume)+
          "</td>"+

          "<td>"+
            pill(
              r.bias,
              tone(r.bias)
            )+
          "</td>"+

          "</tr>"

      ).join("")

      ||

      '<tr>'+
      '<td colspan="7" class="empty">'+
      "No events yet"+
      "</td>"+
      "</tr>";


  }catch(e){

    $("status").innerHTML=
      '<span class="dot"></span>'+
      '<span>OFFLINE</span>';

    $("status").style.color=
      "var(--red)";

    console.error(e);
  }
}


refresh();

setInterval(
  refresh,
  3000
);

</script>

</body>
</html>`;


/* =========================================================
   SERVER HELPERS
========================================================= */

function biasFor(event){

  const e=
    String(event||"")
      .toUpperCase();

  if(
    [
      "BREAKOUT",
      "MOMENTUM",
      "LAUNCHPAD"
    ].some(
      x=>e.includes(x)
    )
  )
    return "BULLISH";

  if(
    [
      "BREAKDOWN",
      "EXHAUSTION"
    ].some(
      x=>e.includes(x)
    )
  )
    return "BEARISH";

  return "WATCH";
}


function num(v){

  if(
    v===undefined||
    v===null||
    v===""
  )
    return null;

  const n=
    Number(v);

  return Number.isFinite(n)
    ?n
    :null;
}


function parseTime(v){

  if(!v)
    return null;

  const d=
    new Date(v);

  return Number.isNaN(
    d.getTime()
  )
    ?null
    :d.toISOString();
}


async function initDb(db){

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      received_at TEXT NOT NULL,
      event_time TEXT,
      ticker TEXT NOT NULL,
      exchange TEXT,
      timeframe TEXT,
      event TEXT NOT NULL,
      price REAL,
      open REAL,
      high REAL,
      low REAL,
      volume REAL,
      raw_payload TEXT NOT NULL
    )
  `).run();
}


async function getSignals(
  db,
  limit
){

  const result=
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
        open,
        high,
        low,
        volume,
        raw_payload
      FROM signals
      ORDER BY id DESC
      LIMIT ?
    `)
    .bind(limit)
    .all();

  return(
    result.results||[]
  ).map(
    r=>({

      ...r,

      bias:
        biasFor(r.event),

      raw_payload:
        JSON.parse(
          r.raw_payload
        )

    })
  );
}


/* =========================================================
   DECISION NORMALIZATION
========================================================= */

function normalizeDecisionEvidence(
  currentEvidence
){

  if(!currentEvidence)
    return null;

  const five=
    currentEvidence
      ?.outcomes?.["5m"];

  const ten=
    currentEvidence
      ?.outcomes?.["10m"];

  return {

    ...currentEvidence,

    /*
     * Both horizons are required by the
     * decision engine.
     *
     * Therefore use the smaller sample count.
     */
    samples:
      Math.min(
        Number(five?.samples||0),
        Number(ten?.samples||0)
      )
  };
}


/* =========================================================
   GET CURRENT DECISION
========================================================= */

async function calculateCurrentDecision(
  db,
  requested=5000
){

  const evidence=
    await calculateEvidence(
      db,
      requested,
      20
    );

  const normalizedEvidence=
    normalizeDecisionEvidence(
      evidence.current_state_evidence
    );

  const decision=
    getDecisionFromEvidence(
      normalizedEvidence
    );

  return {

    current_state:
      evidence.current_state||
      null,

    decision,

    evidence:
      normalizedEvidence
  };
}


/* =========================================================
   PAPER TRADE PROCESSING
========================================================= */

async function processLatestPaperTrade(
  db,
  decisionData,
  snapshot
){

  const activeTrade=
    await getActivePaperTrade(
      db
    );


  /*
   * Existing trade gets priority.
   *
   * Evaluate the new snapshot against
   * the open trade.
   */
  if(activeTrade){

    return evaluatePaperTrade(
      db,
      activeTrade,
      snapshot
    );
  }


  /*
   * No active trade.
   *
   * Allow the decision engine to open
   * a new paper trade if it qualifies.
   */
  return processPaperTrade(
    db,
    {
      decision:
        decisionData.decision,

      currentState:
        decisionData.current_state
    }
  );
}


/* =========================================================
   MAIN WORKER
========================================================= */

export default{

  async fetch(
    request,
    env
  ){

    const url=
      new URL(
        request.url
      );

    const method=
      request.method.toUpperCase();


    if(!env.DB){

      return Response.json(
        {
          error:
            "D1 binding DB is missing"
        },
        {
          status:500
        }
      );
    }


    await initDb(
      env.DB
    );

    await initPaperTradeDb(
      env.DB
    );


    /* -----------------------------------------------------
       Dashboard
    ----------------------------------------------------- */

    if(
      url.pathname==="/" &&
      method==="GET"
    ){

      return new Response(
        DASHBOARD,
        {
          headers:{
            "content-type":
              "text/html;charset=UTF-8"
          }
        }
      );
    }


    /* -----------------------------------------------------
       Health
    ----------------------------------------------------- */

    if(
      url.pathname==="/api/health" &&
      method==="GET"
    ){

      return Response.json({

        status:"ok",

        service:
          "sensex-signal-engine",

        stage:6

      });
    }


    /* -----------------------------------------------------
       Outcomes
    ----------------------------------------------------- */

    if(
      url.pathname==="/api/outcomes" &&
      method==="GET"
    ){

      const requested=
        Number(
          url.searchParams.get(
            "limit"
          )||100
        );

      const result=
        await calculateOutcomes(
          env.DB,
          requested
        );

      return Response.json(
        result,
        {
          headers:{
            "cache-control":
              "no-store"
          }
        }
      );
    }


    /* -----------------------------------------------------
       Evidence
    ----------------------------------------------------- */

    if(
      url.pathname==="/api/evidence" &&
      method==="GET"
    ){

      const requested=
        Number(
          url.searchParams.get(
            "limit"
          )||5000
        );

      const minSamples=
        Number(
          url.searchParams.get(
            "minSamples"
          )||5
        );

      const result=
        await calculateEvidence(
          env.DB,
          requested,
          minSamples
        );

      return Response.json(
        result,
        {
          headers:{
            "cache-control":
              "no-store"
          }
        }
      );
    }


    /* -----------------------------------------------------
       Discovery
    ----------------------------------------------------- */

    if(
      url.pathname==="/api/discovery" &&
      method==="GET"
    ){

      const requested=
        Number(
          url.searchParams.get(
            "limit"
          )||5000
        );

      const minSamples=
        Number(
          url.searchParams.get(
            "minSamples"
          )||20
        );

      const result=
        await calculateDiscovery(
          env.DB,
          requested,
          minSamples
        );

      return Response.json(
        result,
        {
          headers:{
            "cache-control":
              "no-store"
          }
        }
      );
    }


    /* -----------------------------------------------------
       Decision
    ----------------------------------------------------- */

    if(
      url.pathname==="/api/decision" &&
      method==="GET"
    ){

      const requested=
        Number(
          url.searchParams.get(
            "limit"
          )||5000
        );

      const result=
        await calculateCurrentDecision(
          env.DB,
          requested
        );

      return Response.json(
        {
          generated_at:
            new Date().toISOString(),

          current_state:
            result.current_state,

          decision:
            result.decision
        },
        {
          headers:{
            "cache-control":
              "no-store"
          }
        }
      );
    }


    /* -----------------------------------------------------
       Paper Trade API
    ----------------------------------------------------- */
/* -----------------------------------------------------
   Paper Trade Self-Test
----------------------------------------------------- */

    if(
      url.pathname==="/api/paper-trade/test" &&
      method==="GET"
    ){
    
      const result =
        await runPaperTradeSelfTest(
          env.DB
        );
    
      return Response.json(
        result,
        {
          headers:{
            "cache-control":
              "no-store"
          }
        }
      );
    }
    if(
      url.pathname==="/api/paper-trade" &&
      method==="GET"
    ){

      const activeTrade=
        await getActivePaperTrade(
          env.DB
        );

      const trades=
        await getPaperTrades(
          env.DB,
          50
        );


      let unrealizedPnl=null;

      if(activeTrade){

        const latest=
          await getSignals(
            env.DB,
            1
          );

        const latestSnapshot=
          latest.find(
            r=>
              r.event===
              "MARKET_SNAPSHOT"
          );

        if(latestSnapshot){

          const currentPrice=
            Number(
              latestSnapshot.price
            );

          if(
            Number.isFinite(
              currentPrice
            )
          ){

            if(
              activeTrade.direction===
              "CALL"
            ){

              unrealizedPnl=
                currentPrice-
                Number(
                  activeTrade.entry_price
                );

            }else{

              unrealizedPnl=
                Number(
                  activeTrade.entry_price
                )-
                currentPrice;
            }
          }
        }
      }


      const closedTrades=
        trades.filter(
          t=>
            t.status===
            "CLOSED"
        );

      const wins=
        closedTrades.filter(
          t=>
            t.result===
            "WIN"
        ).length;

      const losses=
        closedTrades.filter(
          t=>
            t.result===
            "LOSS"
        ).length;

      const totalPnl=
        closedTrades.reduce(
          (sum,t)=>
            sum+
            Number(
              t.pnl_points||0
            ),
          0
        );


      return Response.json(
        {

          active_trade:
            activeTrade,

          unrealized_pnl_points:
            unrealizedPnl,

          recent_trades:
            trades,

          statistics:{
            closed_trades:
              closedTrades.length,

            wins,

            losses,

            win_rate:
              closedTrades.length
                ?(
                  wins/
                  closedTrades.length
                )*100
                :0,

            total_pnl_points:
              totalPnl
          }

        },
        {
          headers:{
            "cache-control":
              "no-store"
          }
        }
      );
    }

    /* -----------------------------------------------------
       Paper Trade Integration Test
    ----------------------------------------------------- */
    
    if(
      url.pathname==="/api/paper-trade/integration-test" &&
      method==="GET"
    ){
    
      const result =
        await runPaperTradeIntegrationTest(
          env.DB
        );
    
      return Response.json(
        result,
        {
          headers:{
            "cache-control":
              "no-store"
          }
        }
      );
    }
    /* -----------------------------------------------------
       Latest
    ----------------------------------------------------- */

    if(
      url.pathname==="/api/latest" &&
      method==="GET"
    ){

      const rows=
        await getSignals(
          env.DB,
          1
        );

      return Response.json({
        signal:
          rows[0]||
          null
      });
    }


    /* -----------------------------------------------------
       Signals
    ----------------------------------------------------- */

    if(
      url.pathname==="/api/signals" &&
      method==="GET"
    ){

      const requested=
        Number(
          url.searchParams.get(
            "limit"
          )||50
        );

      const limit=
        Math.max(
          1,
          Math.min(
            Number.isFinite(
              requested
            )
              ?requested
              :50,
            200
          )
        );

      return Response.json({

        signals:
          await getSignals(
            env.DB,
            limit
          )

      });
    }


    /* -----------------------------------------------------
       TradingView Webhook
    ----------------------------------------------------- */

    if(
      url.pathname===
      "/webhook/tradingview" &&
      method==="POST"
    ){

      let payload;


      try{

        payload=
          await request.json();

      }catch{

        return Response.json(
          {
            error:
              "Webhook body must be valid JSON"
          },
          {
            status:400
          }
        );
      }


      const ticker=
        String(
          payload.ticker||
          payload.symbol||
          ""
        );

      const event=
        String(
          payload.event||
          ""
        );


      if(
        !ticker||
        !event
      ){

        return Response.json(
          {
            error:
              "ticker/symbol and event are required"
          },
          {
            status:400
          }
        );
      }


      /* -----------------------------------------------
         Save TradingView snapshot first
      ------------------------------------------------ */

      const result=
        await env.DB.prepare(`
          INSERT INTO signals
          (
            received_at,
            event_time,
            ticker,
            exchange,
            timeframe,
            event,
            price,
            open,
            high,
            low,
            volume,
            raw_payload
          )
          VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?
          )
        `)
        .bind(

          new Date()
            .toISOString(),

          parseTime(
            payload.time
          ),

          ticker,

          String(
            payload.exchange||
            ""
          ),

          String(
            payload.interval||
            payload.timeframe||
            ""
          ),

          event,

          num(
            payload.price??
            payload.close
          ),

          num(
            payload.open
          ),

          num(
            payload.high
          ),

          num(
            payload.low
          ),

          num(
            payload.volume
          ),

          JSON.stringify(
            payload
          )

        )
        .run();


      /* -----------------------------------------------
         Paper-trade processing
      ------------------------------------------------ */

      let paperTradeResult=null;

      /*
       * Only MARKET_SNAPSHOT events should drive
       * the paper-trade lifecycle.
       */
      if(
        event===
        "MARKET_SNAPSHOT"
      ){

        try{

          const decisionData=
            await calculateCurrentDecision(
              env.DB,
              5000
            );


          const insertedSignal={

            event:
              "MARKET_SNAPSHOT",

            event_time:
              parseTime(
                payload.time
              ),

            price:
              num(
                payload.price??
                payload.close
              ),

            high:
              num(
                payload.high
              ),

            low:
              num(
                payload.low
              ),

            raw_payload:
              payload

          };


          paperTradeResult=
            await processLatestPaperTrade(
              env.DB,
              decisionData,
              insertedSignal
            );

        }catch(error){

          /*
           * Paper-trade errors must NOT reject
           * the TradingView webhook.
           *
           * The market snapshot has already been
           * safely stored in D1.
           */
          paperTradeResult={
            action:
              "ERROR",

            error:
              String(
                error?.message||
                error
              )
          };
        }
      }


      return Response.json({

        status:
          "accepted",

        signal_id:
          result.meta?.last_row_id??
          null,

        bias:
          biasFor(event),

        paper_trade:
          paperTradeResult

      });
    }


    /* -----------------------------------------------------
       Not found
    ----------------------------------------------------- */

    return Response.json(
      {
        error:
          "Not found"
      },
      {
        status:404
      }
    );
  }
};
