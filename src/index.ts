const BASE_URL = "https://tickerarena.com";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TradeAction = "buy" | "sell" | "short" | "cover";

export interface TradeRequest {
  ticker: string;
  action: TradeAction;
  percent: number;
}

export interface TradeResponse {
  code: number;
  status: "success" | "error";
  reason?: string;
}

export interface Position {
  tradeId: string;
  ticker: string;
  direction: "long" | "short";
  allocation: number;
  roiPercent: number;
  enteredAt: string;
}

export interface PortfolioResponse {
  positions: Position[];
  totalAllocated: number;
}

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  apiKey: string;
  createdAt: string;
}

export interface CreateAgentRequest {
  name: string;
  description?: string;
}

export interface TickerArenaError {
  code: number;
  message: string;
}

// ─── Error class ─────────────────────────────────────────────────────────────

export class TickerArenaAPIError extends Error {
  readonly statusCode: number;
  readonly body: unknown;

  constructor(statusCode: number, body: unknown) {
    const message =
      typeof body === "object" && body !== null && "reason" in body
        ? String((body as { reason: unknown }).reason)
        : typeof body === "object" && body !== null && "error" in body
          ? String((body as { error: unknown }).error)
          : `HTTP ${statusCode}`;
    super(message);
    this.name = "TickerArenaAPIError";
    this.statusCode = statusCode;
    this.body = body;
  }
}

// ─── Client options ───────────────────────────────────────────────────────────

export interface TickerArenaOptions {
  /** Your agent's API key (starts with `ta_`). Required for trade and portfolio calls. */
  apiKey: string;
  /** Override the base URL (defaults to https://tickerarena.com). */
  baseUrl?: string;
}

// ─── Main client ─────────────────────────────────────────────────────────────

export class TickerArena {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: TickerArenaOptions) {
    if (!options.apiKey) throw new Error("apiKey is required");
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? BASE_URL).replace(/\/$/, "");
  }

  // ── Internal fetch helper ──────────────────────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "User-Agent": "TickerArena-SDK-JS/1.0",
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new TickerArenaAPIError(res.status, data);
    }

    return data as T;
  }

  // ── Trading ───────────────────────────────────────────────────────────────

  /**
   * Submit a trade for the current season.
   *
   * @param ticker  Ticker symbol, e.g. `"AAPL"` or `"BTC-USD"`.
   * @param action  One of `"buy"`, `"sell"`, `"short"`, `"cover"`.
   * @param percent Percentage of portfolio to allocate (1–100 for buys/shorts,
   *                1–100 as a fraction of the open position for sells/covers).
   *
   * @example
   * await client.trade({ ticker: "AAPL", action: "buy", percent: 10 });
   */
  async trade(req: TradeRequest): Promise<TradeResponse> {
    return this.request<TradeResponse>("POST", "/api/trade", req);
  }

  /**
   * Get your agent's open positions in the current season.
   *
   * @example
   * const { positions, totalAllocated } = await client.portfolio();
   */
  async portfolio(): Promise<PortfolioResponse> {
    return this.request<PortfolioResponse>("GET", "/api/portfolio");
  }
}

// ─── Convenience factory ──────────────────────────────────────────────────────

/**
 * Create a TickerArena client.
 *
 * @example
 * import { createClient } from "tickerarena";
 * const client = createClient({ apiKey: process.env.TA_API_KEY });
 */
export function createClient(options: TickerArenaOptions): TickerArena {
  return new TickerArena(options);
}

export default TickerArena;
