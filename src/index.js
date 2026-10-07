import { calculateOutcomes } from "./outcomes.js";
import { calculateEvidence } from "./evidence.js";
import { calculateDiscovery } from "./discovery.js";
import { getDecisionFromEvidence } from "./decision.js";
import {
  calculatePaperPerformance
} from "./paperPerformance.js";
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

  --text:#f2f2f2;
  --muted:#8a929c;

  /* UI / reference */
  --accent:#2196f3;

  /* Market semantics */
  --green:#00c853;
  --red:#ff3b30;
  --amber:#ffc107;

  /* Secondary technical information */
  --cyan:#00bcd4;
  --purple:#b84cff;
  --magenta:#ff00a8;

  --shadow:none;
}
*{box-sizing:border-box}
html{background:var(--bg)}
body{
  margin:0;
  background:var(--bg);
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
  width:7px;
  height:7px;
  border-radius:50%;
  background:currentColor;
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
  background:#0f1318;
  border:1px solid #20262d;
  border-radius:4px;
  box-shadow:none;
}
.card{
  padding:17px 18px;
  min-height:112px
}
.card.primary{
  background:#11161c;
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
.day-up{
  color:var(--green);
}

.day-down{
  color:var(--red);
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
  padding:3px 6px;
  border-radius:2px;
  font-size:10px;
  font-weight:700;
  letter-spacing:.06em;
  border:1px solid #252c34;
  background:transparent;
}
.bull{color:var(--green)}
.bear{color:var(--red)}
.neutral{color:var(--amber)}
.cyan{color:var(--cyan)}
.muted{color:var(--muted)}

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
.decision-value.call{color:var(--green)}
.decision-value.put{color:var(--red)}
.decision-value.no-trade{color:var(--amber)}
.decision-value.waiting{color:var(--muted)}
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
/* --------------------------------------------------
   PAPER TRADE HISTORY
-------------------------------------------------- */

.paper-history{
  margin-top:14px;
  border:1px solid #1c242d;
  border-radius:10px;
  background:var(--panel2);
  overflow:hidden
}

.paper-history summary{
  cursor:pointer;
  list-style:none;
  padding:13px 15px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  color:var(--text);
  font-size:11px;
  font-weight:750;
  text-transform:uppercase;
  letter-spacing:.08em
}

.paper-history summary::-webkit-details-marker{
  display:none
}

.paper-history summary::after{
  content:"▾";
  color:var(--muted);
  font-size:13px
}

.paper-history[open] summary::after{
  content:"▴"
}

.paper-history-count{
  color:var(--muted);
  font-size:10px;
  font-weight:600;
  text-transform:none;
  letter-spacing:0
}

.paper-history-list{
  border-top:1px solid #1c242d
}

.paper-trade-row{
  border-bottom:1px solid #1c242d
}

.paper-trade-row:last-child{
  border-bottom:none
}

.paper-trade-row summary{
  padding:12px 15px;
  text-transform:none;
  letter-spacing:0;
  font-weight:650
}

.paper-trade-summary{
  display:grid;
  grid-template-columns:55px 70px 70px 1fr auto;
  align-items:center;
  gap:10px;
  width:100%
}

.paper-trade-id{
  color:var(--muted);
  font-size:10px
}

.paper-trade-direction{
  font-weight:800;
  font-size:11px
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

.paper-open{
  color:var(--cyan)
}

.paper-trade-pnl{
  font-weight:800;
  text-align:right
}

.paper-trade-detail{
  padding:14px 15px;
  border-top:1px solid #1c242d;
  background:#0d1217
}

.paper-trade-grid{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:10px
}

.paper-trade-field{
  display:flex;
  flex-direction:column;
  gap:4px
}

.paper-trade-field span{
  color:var(--muted);
  font-size:9px;
  text-transform:uppercase;
  letter-spacing:.1em
}

.paper-trade-field b{
  color:var(--text);
  font-size:11px
}

.paper-trade-reason{
  margin-top:12px;
  padding:10px;
  border-radius:7px;
  background:#10151b;
  border:1px solid #202a34;
  color:var(--muted);
  font-size:10px;
  line-height:1.5
}

.paper-trade-reason strong{
  color:var(--text)
}

@media(max-width:700px){

  .paper-trade-summary{
    grid-template-columns:45px 60px 65px 1fr;
  }

  .paper-trade-pnl{
    grid-column:4;
  }

  .paper-trade-grid{
    grid-template-columns:repeat(2,1fr)
  }
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
.paper-call{color:var(--green)}
.paper-put{color:var(--red)}
.paper-win{color:var(--green)}
.paper-loss{color:var(--red)}
.paper-flat{color:var(--amber)}
.paper-hold{color:var(--cyan)}

.panel{
  margin-top:16px;
  padding:18px
}
.structure-grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:12px
}

.structure-card{
  background:var(--panel2);
  border:1px solid #1c242d;
  border-radius:9px;
  padding:14px
}

.structure-level{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:10px
}

.structure-level-label{
  color:var(--muted);
  font-size:9px;
  text-transform:uppercase;
  letter-spacing:.1em
}

.structure-level-value{
  margin-top:6px;
  font-size:20px;
  font-weight:800
}

.structure-level-type{
  margin-top:4px;
  color:var(--muted);
  font-size:10px
}

.structure-distance{
  text-align:right
}

.structure-distance span{
  display:block;
  color:var(--muted);
  font-size:9px;
  text-transform:uppercase;
  letter-spacing:.1em
}

.structure-distance b{
  display:block;
  margin-top:5px;
  font-size:14px
}

.structure-stats{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:7px;
  margin-top:12px
}

.structure-stat{
  background:#10151b;
  border:1px solid #222c36;
  border-radius:7px;
  padding:8px
}

.structure-stat span{
  display:block;
  color:var(--muted);
  font-size:8px;
  text-transform:uppercase;
  letter-spacing:.08em
}

.structure-stat b{
  display:block;
  margin-top:5px;
  font-size:12px
}

.structure-summary{
  margin-top:12px;
  padding:12px 13px;
  border-radius:8px;
  background:#10151b;
  border:1px solid #222c36
}

.structure-summary-label{
  color:var(--muted);
  font-size:9px;
  text-transform:uppercase;
  letter-spacing:.1em
}

.structure-summary-value{
  margin-top:5px;
  font-size:15px;
  font-weight:800
}

.structure-summary-note{
  margin-top:5px;
  color:var(--muted);
  font-size:10px;
  line-height:1.45
}

.structure-near{
  color:var(--amber)
}

.structure-bull{
  color:var(--green)
}

.structure-bear{
  color:var(--red)
}

.structure-neutral{
  color:var(--muted)
}

@media(max-width:700px){
  .structure-grid{
    grid-template-columns:1fr
  }

  .structure-stats{
    grid-template-columns:repeat(2,1fr)
  }
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
.evidence-good{color:var(--green)}
.evidence-bad{color:var(--red)}
.evidence-neutral{color:var(--amber)}
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
.evidence-table .positive{color:var(--green)}
.evidence-table .negative{color:var(--red)}
.evidence-table .neutral{color:var(--amber)}
.evidence-warning{
  padding:13px;
  border:1px solid rgba(244,201,93,.22);
  border-radius:9px;
  background:rgba(244,201,93,.04);
  color:var(--amber);
  font-size:11px;
  margin-bottom:14px
}

.performance-panel{
  margin-top:16px;
  padding:20px
}
.performance-head{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:15px;
  margin-bottom:14px
}
.performance-title{
  font-size:13px;
  font-weight:750;
  text-transform:uppercase;
  letter-spacing:.12em
}
.performance-note{
  color:var(--muted);
  font-size:10px
}
.performance-grid{
  display:grid;
  grid-template-columns:repeat(6,1fr);
  gap:9px
}
.performance-item{
  background:var(--panel2);
  border:1px solid #1c242d;
  border-radius:9px;
  padding:13px
}
.performance-item span{
  display:block;
  color:var(--muted);
  font-size:9px;
  text-transform:uppercase;
  letter-spacing:.1em
}
.performance-item b{
  display:block;
  margin-top:7px;
  font-size:18px
}
.performance-item small{
  display:block;
  margin-top:5px;
  color:#596572;
  font-size:10px
}
.performance-positive{color:var(--green)}
.performance-negative{color:var(--red)}
.performance-neutral{color:var(--amber)}
.performance-direction{
  margin-top:14px;
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:9px
}
.performance-direction-card{
  background:var(--panel2);
  border:1px solid #1c242d;
  border-radius:9px;
  padding:13px
}
.performance-direction-card h4{
  margin:0;
  font-size:11px;
  text-transform:uppercase;
  letter-spacing:.1em
}
.performance-direction-card .direction-grid{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:9px;
  margin-top:10px
}
.performance-direction-card .direction-stat{
  background:#10151b;
  border:1px solid #222c36;
  border-radius:7px;
  padding:9px
}
.performance-direction-card .direction-stat span{
  display:block;
  color:var(--muted);
  font-size:8px;
  text-transform:uppercase;
  letter-spacing:.08em
}
.performance-direction-card .direction-stat b{
  display:block;
  margin-top:5px;
  font-size:13px
}

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
  .performance-grid{
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
  .performance-grid{
    grid-template-columns:1fr 1fr
  }
  .performance-direction{
    grid-template-columns:1fr
  }
  .performance-direction-card .direction-grid{
    grid-template-columns:repeat(3,1fr)
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
  <label>SENSEX · LIVE</label>

  <div id="price" class="big">
    —
  </div>

  <div id="dayChange" class="sub">
    Day change —
  </div>

  <div id="dayOpen" class="sub">
    Day open —
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

<section class="performance-panel">

<div class="performance-head">
<div class="performance-title">
Paper Performance
</div>
<div class="performance-note">
Forward performance · simulated only
</div>
</div>

<div id="paperPerformanceContent">
<div class="paper-status">
<div class="paper-empty">
Loading paper-performance statistics...
</div>
</div>
</div>

</section>

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
<section class="panel">

<div class="panel-head">

<div class="panel-title">
Market Structure
</div>

<div class="panel-note">
Nearest TradingView support / resistance · level tests and pressure
</div>

</div>

<div id="structureContent">

<div class="empty">
Loading market structure...
</div>

</div>

</section>
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

  const x =
    String(v || "").toUpperCase();

  return
    x === "BULL" ||
    x === "HIGH" ||
    x === "ABOVE" ||
    x === "BULLISH"
      ? "green"
    :
    x === "BEAR" ||
    x === "BELOW" ||
    x === "BEARISH"
      ? "red"
    :
    x === "LOW" ||
    x === "NEUTRAL" ||
    x === "WATCH" ||
    x === "AT"
      ? "amber"
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
function structureStateClass(state){
  const value = String(state || "").toUpperCase();

  if(
    value.includes("TESTING") ||
    value.includes("APPROACHING")
  ){
    return "structure-near";
  }

  if(
    value.includes("BROKE") ||
    value.includes("BREAK")
  ){
    return "structure-bull";
  }

  return "structure-neutral";
}


function structureInterpretation(p){

  const supportState =
    String(p.support_state || "").toUpperCase();

  const resistanceState =
    String(p.resistance_state || "").toUpperCase();

  const supportDistance =
    Number(p.support_distance);

  const resistanceDistance =
    Number(p.resistance_distance);

  const supportPressure =
    Number(p.support_pressure || 0);

  const resistancePressure =
    Number(p.resistance_pressure || 0);

  const tolerance =
    Number(p.sr_tolerance || 0);

  if(supportState === "TESTING"){
    return {
      label:"TESTING SUPPORT",
      className:"structure-near",
      note:"Price is currently interacting with the nearest support level."
    };
  }

  if(resistanceState === "TESTING"){
    return {
      label:"TESTING RESISTANCE",
      className:"structure-near",
      note:"Price is currently interacting with the nearest resistance level."
    };
  }

  if(
    Number.isFinite(supportDistance) &&
    supportDistance <= Math.max(tolerance * 4, 50) &&
    supportPressure >= 3
  ){
    return {
      label:"APPROACHING SUPPORT",
      className:"structure-near",
      note:"Support is relatively close and has seen repeated recent tests."
    };
  }

  if(
    Number.isFinite(resistanceDistance) &&
    resistanceDistance <= Math.max(tolerance * 4, 50) &&
    resistancePressure >= 3
  ){
    return {
      label:"APPROACHING RESISTANCE",
      className:"structure-near",
      note:"Resistance is relatively close and has seen repeated recent tests."
    };
  }

  const rawState =
    String(p.structure_state || "BETWEEN_LEVELS")
      .replaceAll("_"," ");

  return {
    label:rawState,
    className:"structure-neutral",
    note:"Price is currently between the nearest detected structure levels."
  };
}


function renderStructure(p){

  const container = $("structureContent");

  if(!container){
    return;
  }

  const resistance =
    Number(p.nearest_resistance);

  const support =
    Number(p.nearest_support);

  const resistanceDistance =
    Number(p.resistance_distance);

  const supportDistance =
    Number(p.support_distance);

  const resistanceTests15 =
    Number(p.resistance_tests_15m || 0);

  const resistanceTests30 =
    Number(p.resistance_tests_30m || 0);

  const resistancePressure =
    Number(p.resistance_pressure || 0);

  const supportTests15 =
    Number(p.support_tests_15m || 0);

  const supportTests30 =
    Number(p.support_tests_30m || 0);

  const supportFailed15 =
    Number(p.support_failed_breaks_15m || 0);

  const supportFailed30 =
    Number(p.support_failed_breaks_30m || 0);

  const supportPressure =
    Number(p.support_pressure || 0);

  const interpretation =
    structureInterpretation(p);

  const resistanceState =
    String(p.resistance_state || "AWAY");

  const supportState =
    String(p.support_state || "AWAY");

  container.innerHTML = \`

<div class="structure-grid">

  <div class="structure-card">

    <div class="structure-level">

      <div>

        <div class="structure-level-label">
          Nearest Resistance
        </div>

        <div class="structure-level-value">
          \${
            Number.isFinite(resistance)
              ? n(resistance)
              : "—"
          }
        </div>

        <div class="structure-level-type">
          \${
            p.resistance_type || "—"
          }
        </div>

      </div>

      <div class="structure-distance">

        <span>Distance</span>

        <b>
          \${
            Number.isFinite(resistanceDistance)
              ? n(resistanceDistance) + " pts"
              : "—"
          }
        </b>

      </div>

    </div>

    <div class="structure-stats">

      <div class="structure-stat">
        <span>State</span>
        <b class="\${structureStateClass(resistanceState)}">
          \${resistanceState}
        </b>
      </div>

      <div class="structure-stat">
        <span>Tests 15m</span>
        <b>\${resistanceTests15}</b>
      </div>

      <div class="structure-stat">
        <span>Tests 30m</span>
        <b>\${resistanceTests30}</b>
      </div>

      <div class="structure-stat">
        <span>Pressure</span>
        <b>\${resistancePressure}</b>
      </div>

    </div>

  </div>


  <div class="structure-card">

    <div class="structure-level">

      <div>

        <div class="structure-level-label">
          Nearest Support
        </div>

        <div class="structure-level-value">
          \${
            Number.isFinite(support)
              ? n(support)
              : "—"
          }
        </div>

        <div class="structure-level-type">
          \${
            p.support_type || "—"
          }
        </div>

      </div>

      <div class="structure-distance">

        <span>Distance</span>

        <b>
          \${
            Number.isFinite(supportDistance)
              ? n(supportDistance) + " pts"
              : "—"
          }
        </b>

      </div>

    </div>

    <div class="structure-stats">

      <div class="structure-stat">
        <span>State</span>
        <b class="\${structureStateClass(supportState)}">
          \${supportState}
        </b>
      </div>

      <div class="structure-stat">
        <span>Tests 15m</span>
        <b>\${supportTests15}</b>
      </div>

      <div class="structure-stat">
        <span>Failed 15m</span>
        <b>\${supportFailed15}</b>
      </div>

      <div class="structure-stat">
        <span>Pressure</span>
        <b>\${supportPressure}</b>
      </div>

    </div>

    <div class="sub">
      30m tests: \${supportTests30}
      · 30m failed breaks: \${supportFailed30}
    </div>

  </div>

</div>


<div class="structure-summary">

  <div class="structure-summary-label">
    Structure interpretation
  </div>

  <div class="structure-summary-value \${interpretation.className}">
    \${interpretation.label}
  </div>

  <div class="structure-summary-note">
    \${interpretation.note}
  </div>

</div>

\`;
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

function renderDecision(
  data,
  activeTrade
){

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

  let decisionReason =
  decision.reason||
  "No decision reason available.";

  if(
    activeTrade &&
    d==="NO TRADE"
  ){
  
    decisionReason =
      "NO NEW TRADE — Existing "+
      String(
        activeTrade.direction||""
      ).toUpperCase()+
      " remains active.";
  }
  
  reason.textContent=
    decisionReason;

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

function renderPaperTrade(data){

  const container =
    $("paperTradeContent");
  const historyWasOpen =
    container
      .querySelector(
        ".paper-history > details"
      )
      ?.open || false;
  
  const openTradeIndexes =
    Array.from(
      container.querySelectorAll(
        ".paper-trade-row"
      )
    )
    .map(
      (row,index)=>
        row.open
          ? index
          : null
    )
    .filter(
      index=>index!==null
    );

  if(!data){

    container.innerHTML =
      '<div class="paper-status">'+
        '<div class="paper-empty">'+
          'Paper-trade data unavailable.'+
        '</div>'+
      '</div>';

    return;
  }


  const active =
    data.active_trade;


  const trades =
    Array.isArray(
      data.recent_trades
    )
      ?data.recent_trades
      :[];


  /*
   * --------------------------------------------------
   * ACTIVE TRADE
   * --------------------------------------------------
   */

  let activeHtml = "";


  if(active){

    const direction =
      String(
        active.direction||""
      ).toUpperCase();


    const directionClass =
      direction==="CALL"
        ?"paper-call"
        :"paper-put";


    const unrealized =
      Number(
        data.unrealized_pnl_points
      );


    const pnlText =
      Number.isFinite(unrealized)
        ?(
          unrealized>=0
            ?"+"
            :""
        )+
        unrealized.toFixed(2)+
        " pts"
        :"—";


    const pnlClass =
      unrealized>0
        ?"paper-win"
        :
      unrealized<0
        ?"paper-loss"
        :
        "paper-flat";


    activeHtml =

      '<div class="paper-status">'+

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
        '</div>'+

      '</div>';

  }else{

    activeHtml =

      '<div class="paper-status">'+
        '<div class="paper-empty">'+
          'NO ACTIVE TRADE'+
        '</div>'+
        '<div class="sub">'+
          'Waiting for a qualified CALL or PUT decision.'+
        '</div>'+
      '</div>';
  }


  /*
   * --------------------------------------------------
   * TRADE HISTORY
   * --------------------------------------------------
   */

  let historyHtml = "";


  if(trades.length === 0){

    historyHtml =
      '<div class="paper-history">'+

        '<details>'+

          '<summary>'+
            '<span>'+
              'Trade History '+
              '<span class="paper-history-count">'+
                '(0 trades)'+
              '</span>'+
            '</span>'+
          '</summary>'+

          '<div class="paper-trade-detail">'+
            '<div class="paper-empty">'+
              'No paper trades yet.'+
            '</div>'+
          '</div>'+

        '</details>'+

      '</div>';

  }else{


    const tradeRows =
      trades.map(
        trade => {

          const id =
            trade.id;


          const status =
            String(
              trade.status||""
            ).toUpperCase();


          const direction =
            String(
              trade.direction||""
            ).toUpperCase();


          const result =
            String(
              trade.result||""
            ).toUpperCase();


          const directionClass =
            direction==="CALL"
              ?"paper-call"
              :"paper-put";


          let resultClass =
            "paper-open";


          if(result==="WIN")
            resultClass="paper-win";

          if(result==="LOSS")
            resultClass="paper-loss";

          if(result==="FLAT")
            resultClass="paper-flat";


          let resultText =
            status==="OPEN"
              ?"OPEN"
              :result||"—";


          let pnlText =
            "—";


          if(
            trade.pnl_points !== null &&
            trade.pnl_points !== undefined &&
            Number.isFinite(
              Number(
                trade.pnl_points
              )
            )
          ){

            const pnl =
              Number(
                trade.pnl_points
              );

            pnlText =
              (
                pnl>=0
                  ?"+"
                  :""
              )+
              pnl.toFixed(2)+
              " pts";
          }


          const entry =
            n(
              trade.entry_price
            );


          const exit =
            trade.exit_price !== null &&
            trade.exit_price !== undefined
              ?n(trade.exit_price)
              :"OPEN";


          const exitReason =
            txt(
              trade.exit_reason
            );


          const decisionReason =
            txt(
              trade.decision_reason
            );


          const samples =
            txt(
              trade.evidence_samples
            );


          return (

            '<details class="paper-trade-row">'+

              '<summary>'+

                '<div class="paper-trade-summary">'+

                  '<span class="paper-trade-id">'+
                    '#'+
                    txt(id)+
                  '</span>'+

                  '<span class="paper-trade-direction '+directionClass+'">'+
                    txt(direction)+
                  '</span>'+

                  '<span class="'+
                    resultClass+
                  '">'+
                    resultText+
                  '</span>'+

                  '<span>'+
                    entry+
                    ' → '+
                    exit+
                  '</span>'+

                  '<span class="paper-trade-pnl '+resultClass+'">'+
                    pnlText+
                  '</span>'+

                '</div>'+

              '</summary>'+

              '<div class="paper-trade-detail">'+

                '<div class="paper-trade-grid">'+

                  '<div class="paper-trade-field">'+
                    '<span>Status</span>'+
                    '<b>'+
                      txt(status)+
                    '</b>'+
                  '</div>'+

                  '<div class="paper-trade-field">'+
                    '<span>Direction</span>'+
                    '<b class="'+
                      directionClass+
                    '">'+
                      txt(direction)+
                    '</b>'+
                  '</div>'+

                  '<div class="paper-trade-field">'+
                    '<span>Entry</span>'+
                    '<b>'+
                      entry+
                    '</b>'+
                  '</div>'+

                  '<div class="paper-trade-field">'+
                    '<span>Exit</span>'+
                    '<b>'+
                      exit+
                    '</b>'+
                  '</div>'+

                  '<div class="paper-trade-field">'+
                    '<span>Stop Loss</span>'+
                    '<b>'+
                      n(trade.stop_loss)+
                    '</b>'+
                  '</div>'+

                  '<div class="paper-trade-field">'+
                    '<span>Target</span>'+
                    '<b>'+
                      n(trade.target)+
                    '</b>'+
                  '</div>'+

                  '<div class="paper-trade-field">'+
                    '<span>P&L</span>'+
                    '<b class="'+
                      resultClass+
                    '">'+
                      pnlText+
                    '</b>'+
                  '</div>'+

                  '<div class="paper-trade-field">'+
                    '<span>Samples</span>'+
                    '<b>'+
                      samples+
                    '</b>'+
                  '</div>'+

                  '<div class="paper-trade-field">'+
                    '<span>Entry Time</span>'+
                    '<b>'+
                      t(trade.entry_time)+
                    '</b>'+
                  '</div>'+

                  '<div class="paper-trade-field">'+
                    '<span>Exit Time</span>'+
                    '<b>'+
                      t(trade.exit_time)+
                    '</b>'+
                  '</div>'+

                  '<div class="paper-trade-field">'+
                    '<span>Exit Reason</span>'+
                    '<b class="'+
                      resultClass+
                    '">'+
                      exitReason+
                    '</b>'+
                  '</div>'+

                '</div>'+

                '<div class="paper-trade-reason">'+
                  '<strong>Decision:</strong> '+
                  decisionReason+
                '</div>'+

              '</div>'+

            '</details>'

          );
        }
      ).join("");


    historyHtml =

      '<div class="paper-history">'+

        '<details>'+

          '<summary>'+
            '<span>'+
              'Trade History '+
              '<span class="paper-history-count">'+
                '('+
                trades.length+
                ' trades)'+
              '</span>'+
            '</span>'+
          '</summary>'+

          '<div class="paper-trade-list">'+
            tradeRows+
          '</div>'+

        '</details>'+

      '</div>';
  }


  /*
   * --------------------------------------------------
   * FINAL PAPER TRADE SECTION
   * --------------------------------------------------
   */

  container.innerHTML =
  activeHtml+
  historyHtml;


  /*
   * Restore Trade History state
   * after the 3-second refresh.
   */
  
  const historyDetails =
    container.querySelector(
      ".paper-history > details"
    );
  
  if(
    historyDetails &&
    historyWasOpen
  ){
  
    historyDetails.open=true;
  }
  
  
  /*
   * Restore individual trade
   * detail rows that were open.
   */
  
  const newTradeRows =
    Array.from(
      container.querySelectorAll(
        ".paper-trade-row"
      )
    );
  
  for(
    const index of
    openTradeIndexes
  ){
  
    if(
      newTradeRows[index]
    ){
  
      newTradeRows[index].open=true;
    }
  }
}

function performanceNumber(v, suffix=""){

  if(
    v==null ||
    Number.isNaN(Number(v))
  )
    return "—";

  return Number(v).toLocaleString(
    "en-IN",
    {
      maximumFractionDigits:2
    }
  )+
  suffix;
}

function performancePnl(v){

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
  x.toFixed(2)+
  " pts";
}

function performancePnlClass(v){

  if(
    v==null ||
    Number.isNaN(Number(v))
  )
    return "performance-neutral";

  const x=Number(v);

  if(x>0)
    return "performance-positive";

  if(x<0)
    return "performance-negative";

  return "performance-neutral";
}

function renderPaperPerformance(data){

  const container=
    $("paperPerformanceContent");

  if(!data){

    container.innerHTML=
      '<div class="paper-status">'+
      '<div class="paper-empty">'+
      'Paper-performance data unavailable.'+
      '</div>'+
      '</div>';

    return;
  }

  const total=
    Number(
      data.total_trades||0
    );

  const winRate=
    Number(
      data.win_rate||0
    );

  const totalPnl=
    Number(
      data.total_pnl_points||0
    );

  const expectancy=
    Number(
      data.expectancy||0
    );

  const profitFactor=
    data.profit_factor==null
      ?"—"
      :Number(
        data.profit_factor
      ).toFixed(2);

  let html="";

  html+=
    '<div class="performance-grid">'+

    '<div class="performance-item">'+
      '<span>Closed trades</span>'+
      '<b>'+
        performanceNumber(total)+
      '</b>'+
      '<small>'+
        performanceNumber(
          data.open_trades||0
        )+
        ' open'+
      '</small>'+
    '</div>'+

    '<div class="performance-item">'+
      '<span>Win rate</span>'+
      '<b class="'+
        (
          winRate>=60
            ?"performance-positive"
            :
          winRate>=50
            ?"performance-neutral"
            :
            "performance-negative"
        )+
      '">'+
        winRate.toFixed(1)+
        '%'+
      '</b>'+
      '<small>'+
        performanceNumber(data.wins||0)+
        ' wins · '+
        performanceNumber(data.losses||0)+
        ' losses'+
      '</small>'+
    '</div>'+

    '<div class="performance-item">'+
      '<span>Total P&L</span>'+
      '<b class="'+
        performancePnlClass(totalPnl)+
      '">'+
        performancePnl(totalPnl)+
      '</b>'+
      '<small>Cumulative SENSEX points</small>'+
    '</div>'+

    '<div class="performance-item">'+
      '<span>Expectancy</span>'+
      '<b class="'+
        performancePnlClass(expectancy)+
      '">'+
        performancePnl(expectancy)+
      '</b>'+
      '<small>Average points per closed trade</small>'+
    '</div>'+

    '<div class="performance-item">'+
      '<span>Profit factor</span>'+
      '<b>'+
        profitFactor+
      '</b>'+
      '<small>Gross profit ÷ gross loss</small>'+
    '</div>'+

    '<div class="performance-item">'+
      '<span>Max drawdown</span>'+
      '<b class="performance-negative">'+
        performancePnl(
          -Number(
            data.max_drawdown_points||0
          )
        )+
      '</b>'+
      '<small>'+
        performanceNumber(
          data.max_consecutive_losses||0
        )+
        ' max loss streak'+
      '</small>'+
    '</div>'+

    '<div class="performance-item">'+
      '<span>Average win</span>'+
      '<b class="performance-positive">'+
        performancePnl(
          data.average_win
        )+
      '</b>'+
      '<small>'+
        performanceNumber(
          data.wins||0
        )+
        ' winning trades'+
      '</small>'+
    '</div>'+

    '<div class="performance-item">'+
      '<span>Average loss</span>'+
      '<b class="performance-negative">'+
        performancePnl(
          data.average_loss
        )+
      '</b>'+
      '<small>'+
        performanceNumber(
          data.losses||0
        )+
        ' losing trades'+
      '</small>'+
    '</div>'+

    '<div class="performance-item">'+
      '<span>Best streak</span>'+
      '<b class="performance-positive">'+
        performanceNumber(
          data.max_consecutive_wins||0
        )+
      '</b>'+
      '<small>Consecutive wins</small>'+
    '</div>'+

    '<div class="performance-item">'+
      '<span>Worst streak</span>'+
      '<b class="performance-negative">'+
        performanceNumber(
          data.max_consecutive_losses||0
        )+
      '</b>'+
      '<small>Consecutive losses</small>'+
    '</div>'+

    '</div>';

  html+=
    '<div class="performance-direction">';

  const directions=[
    ["CALL",data.directions?.CALL],
    ["PUT",data.directions?.PUT]
  ];

  for(
    const [direction,stats]
    of directions
  ){

    const d=
      stats||{};

    html+=
      '<div class="performance-direction-card">'+

        '<h4 class="'+
          (
            direction==="CALL"
              ?"performance-positive"
              :"performance-negative"
          )+
        '">'+
          direction+
        '</h4>'+

        '<div class="direction-grid">'+

          '<div class="direction-stat">'+
            '<span>Trades</span>'+
            '<b>'+
              performanceNumber(
                d.trades||0
              )+
            '</b>'+
          '</div>'+

          '<div class="direction-stat">'+
            '<span>Win rate</span>'+
            '<b>'+
              performanceNumber(
                d.win_rate||0
              )+
              '%'+
            '</b>'+
          '</div>'+

          '<div class="direction-stat">'+
            '<span>P&L</span>'+
            '<b class="'+
              performancePnlClass(
                d.pnl_points
              )+
            '">'+
              performancePnl(
                d.pnl_points
              )+
            '</b>'+
          '</div>'+

        '</div>'+

      '</div>';
  }

  html+=
    '</div>';

  if(total<10){

    html+=
      '<div class="evidence-warning">'+
      '<strong>EARLY SAMPLE</strong> · '+
      'Only '+
      total+
      ' closed paper trades. '+
      'Do not evaluate or optimize the strategy yet. '+
      'Continue collecting forward trades.'+
      '</div>';

  }else if(total<30){

    html+=
      '<div class="evidence-warning">'+
      '<strong>BUILDING SAMPLE</strong> · '+
      total+
      ' closed trades collected. '+
      'Continue toward at least 30 trades before strategy evaluation.'+
      '</div>';

  }else{

    html+=
      '<div class="evidence-warning">'+
      '<strong>FORWARD SAMPLE</strong> · '+
      total+
      ' closed paper trades collected. '+
      'Use the statistics to evaluate the existing rules; '+
      'do not optimize on a small subset.'+
      '</div>';
  }

  container.innerHTML=
    html;
}

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

    const performanceResponse=
      await fetch(
        "/api/paper-performance?limit=500",
        {
          cache:"no-store"
        }
      );

    if(performanceResponse.ok){

      const performance=
        await performanceResponse.json();

      renderPaperPerformance(
        performance
      );

    }else{

      renderPaperPerformance(null);
    }

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
      $("structureContent").innerHTML =
        '<div class="empty">No market structure data available.</div>';
      $("stateGrid").innerHTML=
        '<div class="empty" '+
        'style="grid-column:1/-1">'+
        "Waiting for TradingView snapshot..."+
        "</div>";

      $("history").innerHTML="";

      return;
    }

    const p=
      s.raw_payload||{};

    const trend=
      cls(p.trend);

    const vol=
      cls(p.volume_state);

    const rsi =
      Number(p.rsi);
    
    const currentPrice =
      Number(s.price);
    
    const previous =
      snapshots[1];
    
    const previousPrice =
      previous
        ? Number(previous.price)
        : null;
    
    const liveMove =
      Number.isFinite(currentPrice) &&
      Number.isFinite(previousPrice)
        ? currentPrice - previousPrice
        : null;
    const dayOpen = Number(p.day_open);
    
    const dayChange =
      Number.isFinite(currentPrice) &&
      Number.isFinite(dayOpen)
        ? currentPrice - dayOpen
        : null;
    
    const dayChangePct =
      Number.isFinite(dayChange) &&
      Number.isFinite(dayOpen) &&
      dayOpen !== 0
        ? (dayChange / dayOpen) * 100
        : null;
    
    $("price").textContent =
      n(currentPrice);
    
    $("price").className =
      "big " +
      (
        liveMove > 0
          ? "day-up"
          : liveMove < 0
            ? "day-down"
            : ""
      );
    
    $("price").title =
      Number.isFinite(liveMove)
        ? "1m move: " +
          (liveMove >= 0 ? "+" : "") +
          n(liveMove)
        : "";
    
    $("dayOpen").textContent =
      Number.isFinite(dayOpen)
        ? "Day open " + n(dayOpen)
        : "Day open —";
    
    $("dayChange").textContent =
      Number.isFinite(dayChange)
        ? (
            dayChange >= 0 ? "▲ +" : "▼ "
          ) +
          n(dayChange) +
          (
            Number.isFinite(dayChangePct)
              ? " (" +
                (
                  dayChangePct >= 0 ? "+" : ""
                ) +
                dayChangePct.toFixed(2) +
                "%)"
              : ""
          )
        : "Day change —";
    
    $("dayChange").className =
      "sub " +
      (
        dayChange > 0
          ? "day-up"
          : dayChange < 0
            ? "day-down"
            : ""
      );

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
    renderStructure(p);
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
    samples:
      Math.min(
        Number(five?.samples||0),
        Number(ten?.samples||0)
      )
  };
}

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

async function processLatestPaperTrade(
  db,
  decisionData,
  snapshot
){

  const activeTrade =
    await getActivePaperTrade(
      db
    );

  /*
   * Existing trade always gets priority.
   *
   * The latest snapshot is used to determine
   * whether the trade should remain open,
   * hit stop-loss, or hit target.
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
   * Pass the COMPLETE decision object to
   * processPaperTrade.
   *
   * decisionData.decision contains:
   *
   * {
   *   decision: "CALL" / "PUT" / "NO TRADE",
   *   reason: "...",
   *   evidence: {...}
   * }
   */
  return processPaperTrade(
    db,
    {
      decision:
        decisionData.decision,
  
      currentState:
        decisionData.current_state,
  
      snapshot:
        snapshot
    }
  );
}

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

    if(
      url.pathname==="/api/paper-trade" &&
      method==="GET"
    ){

      const activeTrade =
        await getActivePaperTrade(
          env.DB
        );

      const trades =
        await getPaperTrades(
          env.DB,
          20
        );

      let unrealizedPnlPoints = null;

      if(activeTrade){

        const latestRows =
          await getSignals(
            env.DB,
            50
          );

        const latestSnapshot =
          latestRows.find(
            row =>
              row.event ===
              "MARKET_SNAPSHOT"
          );

        if(latestSnapshot){

          const currentPrice =
            Number(
              latestSnapshot.price
            );

          const entryPrice =
            Number(
              activeTrade.entry_price
            );

          if(
            Number.isFinite(
              currentPrice
            ) &&
            Number.isFinite(
              entryPrice
            )
          ){

            unrealizedPnlPoints =
              activeTrade.direction ===
              "CALL"

                ? currentPrice -
                  entryPrice

                : entryPrice -
                  currentPrice;
          }
        }
      }

      const closedTrades =
        trades.filter(
          trade =>
            String(
              trade.status||""
            ).toUpperCase() ===
            "CLOSED"
        );

      const wins =
        closedTrades.filter(
          trade =>
            String(
              trade.result||""
            ).toUpperCase() ===
            "WIN"
        );

      const losses =
        closedTrades.filter(
          trade =>
            String(
              trade.result||""
            ).toUpperCase() ===
            "LOSS"
        );

      const totalPnl =
        closedTrades.reduce(
          (sum,trade) =>
            sum +
            Number(
              trade.pnl_points||0
            ),
          0
        );

      const winRate =
        closedTrades.length > 0
          ? (
              wins.length /
              closedTrades.length
            ) * 100
          : 0;

      return Response.json(
        {
          active_trade:
            activeTrade||null,

          unrealized_pnl_points:
            unrealizedPnlPoints,

          recent_trades:
            trades,

          statistics:{
            closed_trades:
              closedTrades.length,

            wins:
              wins.length,

            losses:
              losses.length,

            win_rate:
              Number(
                winRate.toFixed(2)
              ),

            total_pnl_points:
              Number(
                totalPnl.toFixed(2)
              )
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

    if(
      url.pathname === "/api/paper-performance" &&
      method === "GET"
    ){

      const requested =
        Number(
          url.searchParams.get(
            "limit"
          ) || 500
        );

      const performance =
        await calculatePaperPerformance(
          env.DB,
          requested
        );

      return Response.json(
        performance,
        {
          headers:{
            "cache-control":
              "no-store"
          }
        }
      );
    }

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

      let paperTradeResult=null;

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
