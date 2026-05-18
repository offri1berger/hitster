const num = (key: string, fallback: number): number => {
  const raw = process.env[key]
  if (raw === undefined) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

/** Configuration values for the game, loaded from environment variables with fallbacks. 
 * These control various timing aspects of the game, such as how long the steal window is, how long to show placement results, etc.
 * All values are in milliseconds.
  * - `stealWindowMs`: How long the steal window stays open after a placement (default: 5000ms)
  * - `stealExtendedMs`: How long the steal window is extended if a steal is initiated (default: 10000ms)
  * - `cardRevealMs`: How long to show the correct/incorrect result after a placement (default: 3000ms)
  * - `reconnectGraceMs`: How long a player has to reconnect before they are kicked from the game (default: 30000ms)
  * - `starterTokens`: How many tokens each player starts with (default: 2)
  * `deezerTimeoutMs`: How long to wait for Deezer API responses before timing out (default: 4000ms)
  * `gameTtlSeconds`: How long to keep finished games in the database before deleting them (default: 7200s = 2 hours)
  * `sessionTtlSeconds`: How long to keep player sessions in the database before deleting them (default: 86400s = 24 hours) 
*/
export const config = {
  stealWindowMs: num('STEAL_WINDOW_MS', 5_000),
  stealExtendedMs: num('STEAL_EXTENDED_MS', 10_000),
  cardRevealMs: num('CARD_REVEAL_MS', 3_000),
  reconnectGraceMs: num('RECONNECT_GRACE_MS', 30_000),
  starterTokens: num('STARTER_TOKENS', 2),
  deezerTimeoutMs: num('DEEZER_TIMEOUT_MS', 4_000),
  gameTtlSeconds: num('GAME_TTL_SECONDS', 7_200),
  sessionTtlSeconds: num('SESSION_TTL_SECONDS', 86_400),
}
