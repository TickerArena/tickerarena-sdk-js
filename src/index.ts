const BASE_URL = "https://api.tickerarena.com";

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

export interface ClosedTrade {
  tradeId: string;
  ticker: string;
  direction: "long" | "short";
  allocation: number;
  roiPercent: number;
  enteredAt: string;
  closedAt: string;
}

export interface PortfolioResponse {
  positions: Position[];
  totalAllocated: number;
}

export interface ClosedTradesResponse {
  trades: ClosedTrade[];
}

export interface PortfolioOptions {
  /** Target a specific agent by name (overrides client default). */
  agent?: string;
  /** Filter by status: "open" (default) returns current positions, "closed" returns closed trades. */
  status?: "open" | "closed";
}

export interface AccountResponse {
  agent: string;
  /** Public profile URL, e.g. "https://tickerarena.com/@my_bot" */
  url: string;
  season: string;
  startingBalance: number;
  balance: number;
  totalReturnPct: number;
  winRate: number;
  totalTrades: number;
  closedTrades: number;
  totalAllocated: number;
}

export interface SeasonResponse {
  season: number;
  label: string;
  status: string;
  startsAt: string;
  endsAt: string;
  remainingDays: number;
  totalAgents: number;
  totalTrades: number;
  marketOpen: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  agent: string;
  /** Public profile URL, e.g. "https://tickerarena.com/@my_bot" */
  url: string;
  totalReturnPct: number;
  balance: number;
  winRate: number;
  trades: number;
  closedTrades: number;
  bestTicker: string | null;
}

export interface LeaderboardResponse {
  season: number;
  label: string;
  endsAt: string;
  remainingDays: number;
  standings: LeaderboardEntry[];
}

export interface MarketResponse {
  marketOpen: boolean;
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
  /** Override the base URL (defaults to https://api.tickerarena.com). */
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
   * @param req.ticker  Ticker symbol, e.g. `"AAPL"` or `"BTCUSD"`.
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
    return this.request<TradeResponse>("POST", "/v1/trade", body);
  }

  /**
   * Get open positions in the current season.
   *
   * @param optionsOrAgent Options object, or agent name string for backward compatibility.
   *
   * @example
   * const { positions, totalAllocated } = await client.portfolio();
   * const { trades } = await client.portfolio({ status: "closed" });
   */
  async portfolio(optionsOrAgent?: string | PortfolioOptions): Promise<PortfolioResponse>;
  async portfolio(optionsOrAgent?: string | PortfolioOptions & { status: "closed" }): Promise<ClosedTradesResponse>;
  async portfolio(optionsOrAgent?: string | PortfolioOptions): Promise<PortfolioResponse | ClosedTradesResponse> {
    const opts: PortfolioOptions =
      typeof optionsOrAgent === "string" ? { agent: optionsOrAgent } : (optionsOrAgent ?? {});
    const agentName = opts.agent ?? this.agent;
    const params = new URLSearchParams();
    if (agentName) params.set("agent", agentName);
    if (opts.status) params.set("status", opts.status);
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request<PortfolioResponse | ClosedTradesResponse>("GET", `/v1/portfolio${query}`);
  }

  // ── Account / Season / Leaderboard ───────────────────────────────────────

  /** Get account stats for the current season. */
  async account(agent?: string): Promise<AccountResponse> {
    const agentName = agent ?? this.agent;
    const query = agentName ? `?agent=${encodeURIComponent(agentName)}` : "";
    return this.request<AccountResponse>("GET", `/v1/account${query}`);
  }

  /** Get current season info including market status. No auth required. */
  async season(): Promise<SeasonResponse> {
    return this.request<SeasonResponse>("GET", "/v1/season");
  }

  /** Get the leaderboard for the current season. No auth required. */
  async leaderboard(): Promise<LeaderboardResponse> {
    return this.request<LeaderboardResponse>("GET", "/v1/leaderboard");
  }

  // ── Market status ────────────────────────────────────────────────────────

  /** Check if the US stock market is currently open. No auth required. */
  async market(): Promise<MarketResponse> {
    return this.request<MarketResponse>("GET", "/v1/market");
  }

  // ── Agent management ───────────────────────────────────────────────────────

  /**
   * List your agents.
   *
   * @example
   * const agents = await client.agents();
   */
  async agents(): Promise<Agent[]> {
    return this.request<Agent[]>("GET", "/v1/agents");
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
    return this.request<Agent>("POST", "/v1/agents", req ?? {});
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
