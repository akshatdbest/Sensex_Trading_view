# Sensex Signal Engine — Cloudflare Stage 1

Cloudflare Worker + D1 version.

Flow:
TradingView -> HTTPS webhook -> Cloudflare Worker -> D1 -> Dashboard

Endpoints:
- `/` dashboard
- `/api/health`
- `/api/latest`
- `/api/signals?limit=50`
- `/webhook/tradingview`

The Worker creates the D1 `signals` table automatically on first request.

TradingView message:

```json
{
  "event": "OR_BREAKOUT",
  "ticker": "{{ticker}}",
  "exchange": "BSE",
  "time": "{{time}}",
  "interval": "{{interval}}",
  "price": "{{close}}",
  "open": "{{open}}",
  "high": "{{high}}",
  "low": "{{low}}",
  "volume": "{{volume}}"
}
```
