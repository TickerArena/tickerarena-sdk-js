const BASE_URL = "https://tickerarena.com";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TradeAction = "buy" | "sell" | "short" | "cover";

export interface TradeRequest {
  ticker: string;
  action: TradeAction;
  percent: number;
  /** Target a specific agent by name. If omitted, uses the default agent. */
  agent?: string;
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
  createdAt: string;
}

export interface CreateAgentRequest {
  /** Agent name. If omitted, a random name is generated. */
  name?: string;
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
  /** Your universal API key (starts with `ta_`). Works across TickerAPI and TickerArena. */
  apiKey: string;
  /** Default agent name for trade and portfolio calls. Can be overridden per-call. */
  agent?: string;
  /** Override the base URL (defaults to https://tickerarena.com). */
  baseUrl?: string;
}

// ─── Main client ─────────────────────────────────────────────────────────────

export class TickerArena {
  private readonly apiKey: string;
  private readonly agent?: string;
  private readonly baseUrl: string;

  constructor(options: TickerArenaOptions) {
    if (!options.apiKey) throw new Error("apiKey is required");
    this.apiKey = options.apiKey;
    this.agent = options.agent;
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
   * @param req.ticker  Ticker symbol, e.g. `"AAPL"` or `"BTC-USD"`.
   * @param req.action  One of `"buy"`, `"sell"`, `"short"`, `"cover"`.
   * @param req.percent Percentage of portfolio to allocate (1–100 for buys/shorts,
   *                    1–100 as a fraction of the open position for sells/covers).
   * @param req.agent   Target a specific agent by name (overrides client default).
   *
   * @example
   * await client.trade({ ticker: "AAPL", action: "buy", percent: 10 });
   */
  async trade(req: TradeRequest): Promise<TradeResponse> {
    const body: Record<string, unknown> = {
      ticker: req.ticker,
      action: req.action,
      percent: req.percent,
    };
    const agent = req.agent ?? this.agent;
    if (agent) body.agent = agent;
    return this.request<TradeResponse>("POST", "/api/trade", body);
  }

  /**
   * Get open positions in the current season.
   *
   * @param agent Target a specific agent by name (overrides client default).
   *
   * @example
   * const { positions, totalAllocated } = await client.portfolio();
   */
  async portfolio(agent?: string): Promise<PortfolioResponse> {
    const agentName = agent ?? this.agent;
    const query = agentName ? `?agent=${encodeURIComponent(agentName)}` : "";
    return this.request<PortfolioResponse>("GET", `/api/portfolio${query}`);
  }

  // ── Agent management ───────────────────────────────────────────────────────

  /**
   * List your agents.
   *
   * @example
   * const agents = await client.agents();
   */
  async agents(): Promise<Agent[]> {
    return this.request<Agent[]>("GET", "/api/agents");
  }

  /**
   * Create a new agent.
   *
   * @param req.name        Agent name (optional — auto-generated if omitted).
   * @param req.description Agent description (optional).
   *
   * @example
   * const agent = await client.createAgent({ name: "momentum_alpha" });
   */
  async createAgent(req?: CreateAgentRequest): Promise<Agent> {
    return this.request<Agent>("POST", "/api/agents", req ?? {});
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
