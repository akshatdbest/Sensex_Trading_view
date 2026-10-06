# Sensex Signal Engine — Stage 2

Dashboard now displays the MARKET_SNAPSHOT fields already present in `raw_payload`:
RSI, trend, volume state/ratio, VWAP, VWAP distance, OR state/high/low, VPC zone/mid,
ADR used %, VIX, session, and ATM strike.

Existing D1 data is preserved. No schema migration is required for this dashboard upgrade.

Deploy with Wrangler from this folder.
