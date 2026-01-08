import { Match, Player } from '../types';
import { calculateEloChange, getNewPlayerStats } from './eloUtils';

const STORAGE_KEY = 'pongrank_api_url';

// API URL from environment variable (set at build time) or localStorage
const DEFAULT_API_URL = import.meta.env.VITE_API_URL || '';

// Load from storage or use default from env
let API_URL = localStorage.getItem(STORAGE_KEY) || DEFAULT_API_URL;

// Local memory cache for optimistic updates and read access
let cachedPlayers: Player[] = [];
let cachedMatches: Match[] = [];

// Check if API URL is available
export const hasApiUrl = () => !!API_URL;

// Get current API URL
export const getApiUrl = () => API_URL;

// Set API URL
export const setApiUrl = (url: string) => {
  API_URL = url;
  localStorage.setItem(STORAGE_KEY, url);
};

export const fetchData = async (): Promise<{players: Player[], matches: Match[]}> => {
  if (!API_URL) {
      throw new Error("API URL is not configured");
  }

  try {
    const res = await fetch(`${API_URL}?action=getData`);
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();
    
    // Validate and Clean Data
    const validPlayers = Array.isArray(data.players) ? data.players.map((p: any) => ({
      ...p,
      id: String(p.id),  // Convert numeric ID to string for consistent lookups
      elo: typeof p.elo === 'number' ? p.elo : Number(p.elo) || 1200,
      wins: typeof p.wins === 'number' ? p.wins : Number(p.wins) || 0,
      losses: typeof p.losses === 'number' ? p.losses : Number(p.losses) || 0,
    })) : [];

    const validMatches = Array.isArray(data.matches) ? data.matches.map((m: any) => ({
      ...m,
      winnerIds: Array.isArray(m.winnerIds) ? m.winnerIds : [],
      loserIds: Array.isArray(m.loserIds) ? m.loserIds : [],
      eloChange: typeof m.eloChange === 'number' ? m.eloChange : Number(m.eloChange) || 0,
    })) : [];
    
    // Update cache
    cachedPlayers = validPlayers;
    cachedMatches = validMatches;
    
    return { players: cachedPlayers, matches: cachedMatches };
  } catch (error) {
    console.error("Failed to fetch data:", error);
    throw error;
  }
};

// Helper for API calls
const apiCall = async (body: object) => {
  if (!API_URL) throw new Error("API URL is not configured");
  const res = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.json();
};

// Update multiple players (e.g., after a match)
const updatePlayers = async (players: Player[]) => {
  for (const player of players) {
    await apiCall({ action: 'updatePlayer', player });
  }
};

export const getPlayers = (): Player[] => {
  return cachedPlayers;
};

export const getMatches = (): Match[] => {
  return cachedMatches;
};

export const addPlayer = async (name: string): Promise<Player> => {
  const newPlayer: Player = {
    id: crypto.randomUUID(),
    name: name.trim(),
    elo: 1200,
    wins: 0,
    losses: 0,
    createdAt: new Date().toISOString(),
  };

  // Add to backend
  await apiCall({ action: 'addPlayer', player: newPlayer });

  // Update local cache
  cachedPlayers = [...cachedPlayers, newPlayer];

  return newPlayer;
};

export const logMatch = async (
  type: 'SINGLES' | 'DOUBLES',
  winnerIds: string[],
  loserIds: string[],
  score: string
): Promise<Match> => {
  // 1. Get current stats from cache
  const currentPlayers = [...cachedPlayers];
  const winners = currentPlayers.filter(p => winnerIds.includes(p.id));
  const losers = currentPlayers.filter(p => loserIds.includes(p.id));

  if (winners.length === 0 || losers.length === 0) {
    throw new Error("Invalid players selected");
  }

  // 2. Calculate Elo
  const winnerElos = winners.map(p => p.elo);
  const loserElos = losers.map(p => p.elo);
  const eloChange = calculateEloChange(winnerElos, loserElos);

  // 3. Create Match
  const newMatch: Match = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    type,
    winnerIds,
    loserIds,
    score,
    eloChange,
  };

  // 4. Update Players
  const updatedPlayers = currentPlayers.map(p => {
    if (winnerIds.includes(p.id)) {
      return getNewPlayerStats(p, true, eloChange);
    }
    if (loserIds.includes(p.id)) {
      return getNewPlayerStats(p, false, eloChange);
    }
    return p;
  });

  // 5. Add match to backend (appends to end)
  await apiCall({ action: 'addMatch', match: newMatch });

  // 6. Update player stats in backend
  const playersToUpdate = updatedPlayers.filter(p =>
    winnerIds.includes(p.id) || loserIds.includes(p.id)
  );
  await updatePlayers(playersToUpdate);

  // 7. Update local cache
  cachedMatches = [...cachedMatches, newMatch]; // Append to end (newest last)
  cachedPlayers = updatedPlayers;

  return newMatch;
};

// Soft delete a match by ID (marks as deleted, doesn't remove)
export const deleteMatch = async (matchId: string): Promise<void> => {
  // For now, hard delete - can change to soft delete later
  await apiCall({ action: 'deleteMatch', matchId });
  cachedMatches = cachedMatches.filter(m => m.id !== matchId);
};

// Recalculate all player stats from match history
// Use this after deleting matches to fix stats
export const recalculateAllStats = async (): Promise<void> => {
  // 1. Reset all players to base stats
  const resetPlayers = cachedPlayers.map(p => ({
    ...p,
    elo: 1200,
    wins: 0,
    losses: 0,
  }));

  // 2. Create a map for easy lookup
  const playerMap = new Map<string, Player>();
  resetPlayers.forEach(p => playerMap.set(p.id, { ...p }));

  // 3. Sort matches by ID (assuming IDs are timestamp-based, oldest first)
  const sortedMatches = [...cachedMatches].sort((a, b) => {
    const idA = typeof a.id === 'string' ? a.id : String(a.id);
    const idB = typeof b.id === 'string' ? b.id : String(b.id);
    return idA.localeCompare(idB);
  });

  // 4. Replay each match
  for (const match of sortedMatches) {
    // Determine winners and losers (handle both formats)
    let winnerIds: string[] = [];
    let loserIds: string[] = [];

    if (match.winnerIds?.length && match.loserIds?.length) {
      winnerIds = match.winnerIds.map(String);
      loserIds = match.loserIds.map(String);
    } else if (match.teamAIds?.length && match.teamBIds?.length) {
      const teamA = match.teamAIds.map(String);
      const teamB = match.teamBIds.map(String);
      if (match.winnerTeam === 'A') {
        winnerIds = teamA;
        loserIds = teamB;
      } else {
        winnerIds = teamB;
        loserIds = teamA;
      }
    } else {
      continue; // Skip invalid matches
    }

    // Get current elos
    const winners = winnerIds.map(id => playerMap.get(id)).filter(Boolean) as Player[];
    const losers = loserIds.map(id => playerMap.get(id)).filter(Boolean) as Player[];

    if (winners.length === 0 || losers.length === 0) continue;

    // Calculate elo change
    const winnerElos = winners.map(p => p.elo);
    const loserElos = losers.map(p => p.elo);
    const eloChange = calculateEloChange(winnerElos, loserElos);

    // Update players
    winnerIds.forEach(id => {
      const p = playerMap.get(id);
      if (p) {
        p.elo += eloChange;
        p.wins += 1;
      }
    });
    loserIds.forEach(id => {
      const p = playerMap.get(id);
      if (p) {
        p.elo -= eloChange;
        p.losses += 1;
      }
    });
  }

  // 5. Update all players in backend
  const updatedPlayers = Array.from(playerMap.values());
  await updatePlayers(updatedPlayers);

  // 6. Update local cache
  cachedPlayers = updatedPlayers;
};