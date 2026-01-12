# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PongRank is a ping pong leaderboard app that tracks matches and player ELO ratings. Data is stored in Google Sheets via a Google Apps Script backend.

Live at: https://pong.phuaky.com

## Commands

```bash
npm run dev      # Start dev server on port 3000
npm run build    # Build for production
npm run preview  # Preview production build
```

## Architecture

### Data Flow

```
React App → dataService.ts → Google Apps Script API → Google Sheets
```

- **Frontend**: React 19 + Vite + TypeScript
- **Backend**: Google Apps Script web app (deployed separately)
- **Storage**: Google Sheets as database
- **Styling**: Tailwind CSS (via CDN in index.html)

### Key Files

- `services/dataService.ts` - All API calls and local caching. Uses optimistic updates with in-memory cache (`cachedPlayers`, `cachedMatches`).
- `services/eloUtils.ts` - ELO calculation logic (K-factor = 32)
- `types.ts` - TypeScript interfaces for `Player`, `Match`, `MatchType`, `Tab`

### Data Models

**Player**: id, name, elo (starts at 1200), wins, losses, createdAt

**Match**: id, date, type (SINGLES/DOUBLES), winnerIds[], loserIds[], score, eloChange

### Google Sheets Schema

The backend uses two sheets in Google Sheets:

**Players Sheet**
| Column | Type | Description |
|--------|------|-------------|
| id | string | UUID |
| name | string | Player display name |
| elo | number | ELO rating (starts at 1200) |
| wins | number | Total wins |
| losses | number | Total losses |
| createdAt | string | ISO timestamp |

**Matches Sheet**
| Column | Type | Description |
|--------|------|-------------|
| id | string | UUID |
| date | string | ISO timestamp |
| type | string | "SINGLES" or "DOUBLES" |
| winnerIds | JSON | Array of winner player IDs, e.g. `["id1"]` or `["id1","id2"]` |
| loserIds | JSON | Array of loser player IDs |
| score | string | Score like "11-8" (winner-loser). Prefixed with `'` to prevent Sheets date interpretation |
| eloChange | number | ELO points exchanged |

**Note**: Scores like "11-8" get interpreted as dates by Google Sheets. The backend prefixes them with `'` when writing and handles Date objects when reading.

### Environment

Set `VITE_API_URL` to your Google Apps Script deployment URL. Users can also set the API URL at runtime via localStorage.

## Backend (Google Apps Script)

The backend lives in `backend/appscript.js`. To deploy changes:

1. Open the Google Apps Script editor for the project
2. Copy/paste the contents of `backend/appscript.js`
3. Deploy as web app (Execute as: Me, Access: Anyone)

### Google Sheets Menu

The script adds a **PongRank** menu to Google Sheets with:

- **Recalculate All Stats** - Rebuilds all player ELO/wins/losses from match history. Use when stats get out of sync.
- **Migrate to New Format** - Converts old match format (teamAIds/teamBIds/winnerTeam) to new format (winnerIds/loserIds/score/eloChange).

## Deployment

GitHub Pages via `.github/workflows/deploy.yml`. Pushes to `main` trigger automatic deployment.

## Contributing

Repo is public at https://github.com/phuaky/pong-rank - PRs welcome!
