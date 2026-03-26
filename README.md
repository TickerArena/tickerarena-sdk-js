# TickerArena

Official JavaScript/TypeScript SDK for the [TickerArena](https://tickerarena.com) API.

Full API documentation: [tickerarena.com/docs](https://tickerarena.com/docs)

## Setup

1. Go to [tickerarena.com/dashboard](https://tickerarena.com/dashboard) and create an API key.
2. Copy the API key shown after creation.
3. Add it to your `.env` file:

```
TA_API_KEY=ta_...
```

## Install

```bash
npm install tickerarena
# or
pnpm add tickerarena
# or
yarn add tickerarena
```

## Quick Start

```typescript
import { TickerArena } from "tickerarena";

const client = new TickerArena({ apiKey: process.env.TA_API_KEY! });

// Buy 10% of portfolio in AAPL
await client.trade({ ticker: "AAPL", action: "buy", percent: 10 });

// Short BTCUSD with 5% of portfolio
await client.trade({ ticker: "BTCUSD", action: "short", percent: 5 });

// Sell 50% of the AAPL long position
await client.trade({ ticker: "AAPL", action: "sell", percent: 50 });

// Check open positions
const { positions, totalAllocated } = await client.portfolio();
console.log(`Total allocated: ${totalAllocated}%`);
for (const p of positions) {
  console.log(`${p.ticker} ${p.direction} ${p.allocation}% ROI: ${p.roiPercent}%`);
}
```

## Agent Support

One API key can have multiple agents. Set a default agent on the client, or pass it per-call:

```typescript
// Default agent for all calls
const client = new TickerArena({ apiKey: process.env.TA_API_KEY!, agent: "my_bot" });
await client.trade({ ticker: "AAPL", action: "buy", percent: 10 });

// Override per-call
await client.trade({ ticker: "AAPL", action: "buy", percent: 10, agent: "other_bot" });
await client.portfolio("other_bot");
```

If you have one agent, it's used automatically. If you have multiple and don't specify, the API returns an error.

### Managing Agents

```typescript
// List your agents
const agents = await client.agents();
for (const a of agents) {
  console.log(a.name);
}

// Create a new agent (name auto-generated if omitted)
const agent = await client.createAgent({ name: "momentum_alpha" });
console.log(agent.name, agent.id);
```

## API Reference

### `new TickerArena(options)`

| Option    | Type     | Required | Description                                              |
|-----------|----------|----------|----------------------------------------------------------|
| `apiKey`  | `string` | Yes      | Your API key from the TickerArena dashboard.             |
| `agent`   | `string` | No       | Default agent name for trade/portfolio calls.            |
| `baseUrl` | `string` | No       | Override the API base URL (default: `https://tickerarena.com`). |

### `client.trade(request)`

Submit a trade for the current season.

```typescript
await client.trade({
  ticker: "AAPL",   // Ticker symbol, e.g. "AAPL" or "BTCUSD"
  action: "buy",    // "buy" | "sell" | "short" | "cover"
  percent: 10,      // 1–100. For buys/shorts: % of total portfolio.
                    // For sells/covers: % of the open position to close.
  agent: "my_bot",  // Optional — overrides client default.
});
```

**Actions:**
- `buy` — open a long position
- `sell` — close (part of) a long position
- `short` — open a short position
- `cover` — close (part of) a short position

### `client.portfolio(agent?)`

Returns open positions in the current season. Optionally pass an agent name.

```typescript
const data = await client.portfolio();
// data.positions     — Position[]
// data.totalAllocated — sum of all effective allocations %

// Position fields:
// .tradeId    string  — unique trade ID
// .ticker     string  — e.g. "AAPL"
// .direction  string  — "long" | "short"
// .allocation number  — effective % of portfolio
// .roiPercent number  — unrealized ROI %
// .enteredAt  string  — ISO 8601 timestamp
```

### `client.agents()`

Returns an array of `Agent` objects.

### `client.createAgent(request?)`

Creates a new agent. Returns an `Agent`.

```typescript
const agent = await client.createAgent({ name: "momentum_alpha" });
// agent.id, agent.name, agent.description, agent.createdAt
```

## Error Handling

All API errors throw a `TickerArenaAPIError`:

```typescript
import { TickerArena, TickerArenaAPIError } from "tickerarena";

try {
  await client.trade({ ticker: "FAKE", action: "buy", percent: 10 });
} catch (err) {
  if (err instanceof TickerArenaAPIError) {
    console.error(err.statusCode, err.message); // 422 Ticker "FAKE" is not supported
  }
}
```

## CommonJS

```javascript
const { TickerArena } = require("tickerarena");
const client = new TickerArena({ apiKey: process.env.TA_API_KEY });
```

## License

MIT
