const DASHBOARD = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sensex Signal Engine</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#101214;color:#e8eaed;font-family:Arial,sans-serif}
header{display:flex;justify-content:space-between;align-items:center;padding:22px 28px;background:#15181b;border-bottom:1px solid #292d32}
h1{margin:0;font-size:22px}header p{margin:5px 0 0;color:#8d96a0;font-size:13px}#status{color:#65d18a}
main{max-width:1400px;margin:auto;padding:24px 28px}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.card,.panel{background:#171a1e;border:1px solid #292d32;border-radius:10px}.card{padding:18px;min-height:110px}
label{display:block;color:#8d96a0;font-size:12px;letter-spacing:1px}.value{display:block;margin-top:14px;font-size:26px;font-weight:700}
.panel{margin-top:18px;padding:18px}.panel h2{font-size:16px;margin:0 0 15px}.small{float:right;color:#8d96a0;font-weight:normal;font-size:12px}
#details{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.detail{background:#111417;padding:12px;border-radius:7px}.detail b{display:block;margin-top:5px}
.tablewrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:850px}th,td{text-align:left;padding:11px 9px;border-bottom:1px solid #292d32;font-size:13px}th{color:#8d96a0;font-weight:500}
.bullish{color:#65d18a}.bearish{color:#ff7070}.watch{color:#f0c674}
@media(max-width:800px){.cards{grid-template-columns:repeat(2,1fr)}#details{grid-template-columns:repeat(2,1fr)}}
</style>
</head>
<body>
<header><div><h1>SENSEX SIGNAL ENGINE</h1><p>Stage 1 · TradingView webhook monitor</p></div><span id="status">Connecting...</span></header>
<main>
<section class="cards">
<div class="card"><label>PRICE</label><strong id="price" class="value">—</strong></div>
<div class="card"><label>EVENT</label><strong id="event" class="value">—</strong></div>
<div class="card"><label>TIMEFRAME</label><strong id="tf" class="value">—</strong></div>
<div class="card"><label>BIAS</label><strong id="bias" class="value">—</strong></div>
</section>
<section class="panel"><h2>Latest Signal <span id="updated" class="small"></span></h2><div id="details">Waiting for TradingView webhook...</div></section>
<section class="panel"><h2>Signal History <span class="small">Auto-refresh: 3 sec</span></h2>
<div class="tablewrap"><table><thead><tr><th>Time</th><th>Event</th><th>Price</th><th>High</th><th>Low</th><th>Volume</th><th>Bias</th></tr></thead>
<tbody id="history"></tbody></table></div></section>
</main>
<script>
const n=v=>v==null||v===""?"—":Number(v).toLocaleString("en-IN",{maximumFractionDigits:2});
const t=v=>v?new Date(v).toLocaleTimeString("en-IN",{hour12:false}):"—";
async function refresh(){
 try{
  const d=await (await fetch("/api/signals?limit=50",{cache:"no-store"})).json(), rows=d.signals||[];
  status.textContent="● LIVE";status.style.color="#65d18a";
  if(!rows.length){details.textContent="Waiting for TradingView webhook...";history.innerHTML="";return}
  const s=rows[0],cls=(s.bias||"").toLowerCase();
  price.textContent=n(s.price);event.textContent=s.event;tf.textContent=s.timeframe?s.timeframe+" min":"—";
  bias.textContent=s.bias;bias.className="value "+cls;updated.textContent="Received "+t(s.received_at);
  details.innerHTML=[
   ["Ticker",s.ticker],["Exchange",s.exchange],["Open",n(s.open)],["High",n(s.high)],
   ["Low",n(s.low)],["Volume",n(s.volume)],["Event time",t(s.event_time)],["Basic bias",s.bias]
  ].map(x=>'<div class="detail">'+x[0]+'<b class="'+(x[0]=="Basic bias"?cls:"")+'">'+(x[1]??"—")+'</b></div>').join("");
  history.innerHTML=rows.map(r=>'<tr><td>'+t(r.event_time||r.received_at)+'</td><td>'+r.event+'</td><td>'+n(r.price)+'</td><td>'+n(r.high)+'</td><td>'+n(r.low)+'</td><td>'+n(r.volume)+'</td><td class="'+(r.bias||"").toLowerCase()+'">'+r.bias+'</td></tr>').join("");
 }catch(e){status.textContent="● OFFLINE";status.style.color="#ff7070"}
}
refresh();setInterval(refresh,3000);
</script>
</body></html>`;

function biasFor(event) {
  const e = String(event || "").toUpperCase();
  if (["BREAKOUT","MOMENTUM","LAUNCHPAD"].some(x => e.includes(x))) return "BULLISH";
  if (["BREAKDOWN","EXHAUSTION"].some(x => e.includes(x))) return "BEARISH";
  return "WATCH";
}

function num(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseTime(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function initDb(db) {
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

async function getSignals(db, limit) {
  const result = await db.prepare(
    `SELECT id, received_at, event_time, ticker, exchange, timeframe, event,
            price, open, high, low, volume, raw_payload
     FROM signals ORDER BY id DESC LIMIT ?`
  ).bind(limit).all();

  return (result.results || []).map(r => ({
    ...r,
    bias: biasFor(r.event),
    raw_payload: JSON.parse(r.raw_payload)
  }));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (!env.DB) {
      return Response.json({error:"D1 binding DB is missing"}, {status:500});
    }

    await initDb(env.DB);

    if (url.pathname === "/" && method === "GET") {
      return new Response(DASHBOARD, {
        headers: {"content-type":"text/html;charset=UTF-8"}
      });
    }

    if (url.pathname === "/api/health" && method === "GET") {
      return Response.json({status:"ok", service:"sensex-signal-engine", stage:1});
    }

    if (url.pathname === "/api/latest" && method === "GET") {
      const rows = await getSignals(env.DB, 1);
      return Response.json({signal: rows[0] || null});
    }

    if (url.pathname === "/api/signals" && method === "GET") {
      const requested = Number(url.searchParams.get("limit") || 50);
      const limit = Math.max(1, Math.min(Number.isFinite(requested) ? requested : 50, 200));
      return Response.json({signals: await getSignals(env.DB, limit)});
    }

    if (url.pathname === "/webhook/tradingview" && method === "POST") {
      let payload;
      try {
        payload = await request.json();
      } catch {
        return Response.json({error:"Webhook body must be valid JSON"}, {status:400});
      }

      const ticker = String(payload.ticker || payload.symbol || "");
      const event = String(payload.event || "");

      if (!ticker || !event) {
        return Response.json({error:"ticker/symbol and event are required"}, {status:400});
      }

      const receivedAt = new Date().toISOString();
      const eventTime = parseTime(payload.time);
      const price = num(payload.price ?? payload.close);

      const result = await env.DB.prepare(`
        INSERT INTO signals
        (received_at,event_time,ticker,exchange,timeframe,event,price,open,high,low,volume,raw_payload)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        receivedAt,
        eventTime,
        ticker,
        String(payload.exchange || ""),
        String(payload.interval || payload.timeframe || ""),
        event,
        price,
        num(payload.open),
        num(payload.high),
        num(payload.low),
        num(payload.volume),
        JSON.stringify(payload)
      ).run();

      return Response.json({
        status:"accepted",
        signal_id: result.meta?.last_row_id ?? null,
        bias: biasFor(event)
      });
    }

    return Response.json({error:"Not found"}, {status:404});
  }
};
