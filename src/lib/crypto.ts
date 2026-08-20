/**
 * Crypto Data Fetcher
 *
 * Fetches historical daily prices from CoinGecko's free API.
 * No API key required — subject to ~30 req/min rate limit.
 */

export interface Coin {
  id: string;
  symbol: string;
  name: string;
}

export const ALL_COINS: Coin[] = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "solana", symbol: "SOL", name: "Solana" },
  { id: "ripple", symbol: "XRP", name: "XRP" },
  { id: "hyperliquid", symbol: "HYPE", name: "Hyperliquid" },
];

export interface PriceData {
  coin: Coin;
  prices: number[];
  dates: string[];
}

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export async function fetchCoinHistory(
  coinId: string,
  days: number = 90,
): Promise<PriceData> {
  const url = `${COINGECKO_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`CoinGecko API error for ${coinId}: ${res.status}`);
  }

  const data = await res.json();
  const pricePoints: [number, number][] = data.prices;

  const prices = pricePoints.map((p) => p[1]);
  const dates = pricePoints.map((p) => {
    const d = new Date(p[0]);
    return d.toISOString().split("T")[0];
  });

  const coin = ALL_COINS.find((c) => c.id === coinId)!;

  return { coin, prices, dates };
}

export async function fetchCoins(
  coinIds: string[],
  days: number = 90,
): Promise<PriceData[]> {
  const results: PriceData[] = [];

  for (const coinId of coinIds) {
    try {
      const data = await fetchCoinHistory(coinId, days);
      results.push(data);
    } catch (err) {
      console.error(`Failed to fetch ${coinId}:`, err);
    }
  }

  return results;
}
