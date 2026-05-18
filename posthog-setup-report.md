<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Backspin Maestro server. A `posthog-node` client was created in `server/src/lib/posthog.ts` and wired into the application's Socket.IO handlers, BullMQ job processor, and process-level error handlers. User identification is called on room create and join so that server-side events are correlated with client-side `posthog-js` events. Exception autocapture is enabled, and `posthog.shutdown()` is called on graceful exit to flush the event queue.

| Event | Description | File |
|---|---|---|
| `game_completed` | Fires when a game ends and a winner is declared. Includes room code, player count, and winner's timeline length. | `server/src/lib/jobs.ts` |
| `song_skipped` | Fires when the active player spends a token to skip the current song. Includes room code and tokens remaining. | `server/src/socket/gameHandlers.ts` |
| `player_kicked` | Fires when the Conductor kicks a player from the lobby. Includes room code and the kicked player's ID. | `server/src/socket/roomHandlers.ts` |
| `game_reset` | Fires when the host starts a rematch. Includes room code and player count. | `server/src/socket/roomHandlers.ts` |
| `player_left_permanent` | Fires when a player's disconnect grace period expires and they are fully removed. Includes room code and room status at time of departure. | `server/src/socket/disconnectHandler.ts` |

User identification (`posthog.identify`) is called in `server/src/socket/roomHandlers.ts` after both `room:create` and `room:join` succeed, setting the player's display name as a person property. This matches the `posthog.identify(playerId)` call already in `client/src/pages/LobbyPage.tsx` so server and client events are correlated on the same distinct ID.

Exception tracking (`posthog.captureException`) is wired to `process.on('unhandledRejection')` and `process.on('uncaughtException')` in `server/src/index.ts`.

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](/dashboard/1600481)
- [Game Conversion Funnel](/insights/9OymMgu8) — room created → game started → game completed
- [Games Completed Per Week](/insights/VEUy6HXp) — weekly trend of completed games
- [Player Churn (Permanent Disconnects)](/insights/a2XNyB9c) — daily count of players who left permanently
- [Song Skip Rate vs Card Placements](/insights/jKQIZUAG) — engagement signal: token spend vs gameplay activity
- [New Players Per Week](/insights/IlWT8z5x) — unique hosts and joiners per week

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
