// PongRank Google Apps Script Backend
// Version 2.1 - Added custom menu with Recalculate Stats
//
// Setup:
// 1. Open your Google Sheet
// 2. Extensions > Apps Script
// 3. Paste this code
// 4. Deploy > New Deployment > Web App
// 5. Execute as: "Me"
// 6. Who has access: "Anyone"
// 7. Copy the deployment URL and use it as VITE_API_URL
//
// Custom Menu:
// After setup, refresh the sheet to see "PongRank" menu
// Use "Recalculate All Stats" after deleting matches to fix player stats

// ============ Custom Menu ============
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('PongRank')
    .addItem('Recalculate All Stats', 'recalculateAllStats')
    .addToUi();
}

// ============ GET - Read Data ============
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pSheet = getOrCreateSheet(ss, 'Players');
  const mSheet = getOrCreateSheet(ss, 'Matches');

  const pData = pSheet.getDataRange().getValues();
  const players = pData.length > 1 ? parseData(pData) : [];

  const mData = mSheet.getDataRange().getValues();
  const matches = mData.length > 1 ? parseData(mData) : [];

  return jsonResponse({ players, matches });
}

// ============ POST - Write Data ============
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = body.action || 'fullSync'; // Default to fullSync for backwards compatibility

    switch (action) {
      case 'addPlayer':
        return handleAddPlayer(ss, body.player);

      case 'addMatch':
        return handleAddMatch(ss, body.match);

      case 'deleteMatch':
        return handleDeleteMatch(ss, body.matchId);

      case 'deletePlayer':
        return handleDeletePlayer(ss, body.playerId);

      case 'updatePlayer':
        return handleUpdatePlayer(ss, body.player);

      case 'fullSync':
      default:
        return handleFullSync(ss, body);
    }
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

// ============ Handlers ============

function handleAddPlayer(ss, player) {
  if (!player) return jsonResponse({ status: 'error', message: 'No player provided' });

  const sheet = getOrCreateSheet(ss, 'Players');
  const data = sheet.getDataRange().getValues();

  // Get existing headers or create from player
  let headers = data.length > 0 ? data[0] : [];

  // If sheet is empty, use player keys as headers
  if (headers.length === 0 || (headers.length === 1 && headers[0] === '')) {
    headers = Object.keys(player);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    // Find new fields in player that aren't in existing headers
    const playerKeys = Object.keys(player);
    const newHeaders = playerKeys.filter(k => !headers.includes(k));

    // Add new headers if any
    if (newHeaders.length > 0) {
      headers = [...headers, ...newHeaders];
      // Update header row with new columns
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }

  // Append new row
  const newRow = headers.map(h => {
    const val = player[h];
    return (typeof val === 'object') ? JSON.stringify(val) : (val ?? '');
  });
  sheet.appendRow(newRow);

  return jsonResponse({ status: 'success', player });
}

function handleAddMatch(ss, match) {
  if (!match) return jsonResponse({ status: 'error', message: 'No match provided' });

  const sheet = getOrCreateSheet(ss, 'Matches');
  const data = sheet.getDataRange().getValues();

  // Get existing headers or create from match
  let headers = data.length > 0 ? data[0] : [];

  // If sheet is empty, use match keys as headers
  if (headers.length === 0 || (headers.length === 1 && headers[0] === '')) {
    headers = Object.keys(match);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    // Find new fields in match that aren't in existing headers
    const matchKeys = Object.keys(match);
    const newHeaders = matchKeys.filter(k => !headers.includes(k));

    // Add new headers if any
    if (newHeaders.length > 0) {
      headers = [...headers, ...newHeaders];
      // Update header row with new columns
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }

  // Append new row at the END (newest last)
  const newRow = headers.map(h => {
    const val = match[h];
    return (typeof val === 'object') ? JSON.stringify(val) : (val ?? '');
  });
  sheet.appendRow(newRow);

  return jsonResponse({ status: 'success', match });
}

function handleDeleteMatch(ss, matchId) {
  if (!matchId) return jsonResponse({ status: 'error', message: 'No matchId provided' });

  const sheet = getOrCreateSheet(ss, 'Matches');
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) return jsonResponse({ status: 'error', message: 'No matches to delete' });

  const headers = data[0];
  const idIndex = headers.indexOf('id');
  if (idIndex === -1) return jsonResponse({ status: 'error', message: 'No id column found' });

  // Find and delete the row (search from bottom to top to handle row shifting)
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][idIndex]) === String(matchId)) {
      sheet.deleteRow(i + 1); // +1 because sheet rows are 1-indexed
      return jsonResponse({ status: 'success', deleted: matchId });
    }
  }

  return jsonResponse({ status: 'error', message: 'Match not found' });
}

function handleDeletePlayer(ss, playerId) {
  if (!playerId) return jsonResponse({ status: 'error', message: 'No playerId provided' });

  const sheet = getOrCreateSheet(ss, 'Players');
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) return jsonResponse({ status: 'error', message: 'No players to delete' });

  const headers = data[0];
  const idIndex = headers.indexOf('id');
  if (idIndex === -1) return jsonResponse({ status: 'error', message: 'No id column found' });

  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][idIndex]) === String(playerId)) {
      sheet.deleteRow(i + 1);
      return jsonResponse({ status: 'success', deleted: playerId });
    }
  }

  return jsonResponse({ status: 'error', message: 'Player not found' });
}

function handleUpdatePlayer(ss, player) {
  if (!player || !player.id) return jsonResponse({ status: 'error', message: 'No player or id provided' });

  const sheet = getOrCreateSheet(ss, 'Players');
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) return jsonResponse({ status: 'error', message: 'No players to update' });

  const headers = data[0];
  const idIndex = headers.indexOf('id');
  if (idIndex === -1) return jsonResponse({ status: 'error', message: 'No id column found' });

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIndex]) === String(player.id)) {
      const updatedRow = headers.map(h => {
        const val = player[h];
        return (typeof val === 'object') ? JSON.stringify(val) : (val ?? data[i][headers.indexOf(h)]);
      });
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([updatedRow]);
      return jsonResponse({ status: 'success', player });
    }
  }

  return jsonResponse({ status: 'error', message: 'Player not found' });
}

function handleFullSync(ss, body) {
  // WARNING: This replaces ALL data - use with caution
  if (body.players) {
    const pSheet = getOrCreateSheet(ss, 'Players');
    pSheet.clear();
    if (body.players.length > 0) {
      const headers = Object.keys(body.players[0]);
      const rows = [headers, ...body.players.map(p => headers.map(h => {
        const val = p[h];
        return (typeof val === 'object') ? JSON.stringify(val) : val;
      }))];
      pSheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
    }
  }

  if (body.matches) {
    const mSheet = getOrCreateSheet(ss, 'Matches');
    mSheet.clear();
    if (body.matches.length > 0) {
      const headers = Object.keys(body.matches[0]);
      const rows = [headers, ...body.matches.map(m => headers.map(h => {
        const val = m[h];
        return (typeof val === 'object') ? JSON.stringify(val) : val;
      }))];
      mSheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
    }
  }

  return jsonResponse({ status: 'success' });
}

// ============ Helpers ============

function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function parseData(values) {
  const headers = values[0];
  return values.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => {
      try {
        obj[h] = JSON.parse(row[i]);
      } catch (e) {
        obj[h] = row[i];
      }
    });
    return obj;
  });
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============ Recalculate Stats (Menu Action) ============
// Use this after deleting matches to fix player Elo/wins/losses
function recalculateAllStats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pSheet = getOrCreateSheet(ss, 'Players');
  const mSheet = getOrCreateSheet(ss, 'Matches');

  // Read all players and matches
  const pData = pSheet.getDataRange().getValues();
  const mData = mSheet.getDataRange().getValues();

  if (pData.length <= 1) {
    SpreadsheetApp.getUi().alert('No players found!');
    return;
  }

  const pHeaders = pData[0];
  const players = parseData(pData);

  // Reset all players to base stats
  players.forEach(p => {
    p.elo = 1200;
    p.wins = 0;
    p.losses = 0;
  });

  // Create lookup map
  const playerMap = new Map();
  players.forEach(p => playerMap.set(String(p.id), p));

  // Parse and sort matches by date/id (oldest first)
  const matches = mData.length > 1 ? parseData(mData) : [];
  matches.sort((a, b) => String(a.id).localeCompare(String(b.id)));

  // Replay each match
  for (const match of matches) {
    // Determine winners/losers (handle both formats)
    let winnerIds = [];
    let loserIds = [];

    if (match.winnerIds && match.winnerIds.length && match.loserIds && match.loserIds.length) {
      winnerIds = match.winnerIds.map(String);
      loserIds = match.loserIds.map(String);
    } else if (match.teamAIds && match.teamAIds.length && match.teamBIds && match.teamBIds.length) {
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
      continue; // Skip invalid match
    }

    // Get players
    const winners = winnerIds.map(id => playerMap.get(id)).filter(Boolean);
    const losers = loserIds.map(id => playerMap.get(id)).filter(Boolean);
    if (!winners.length || !losers.length) continue;

    // Calculate Elo change
    const avgWinnerElo = winners.reduce((s, p) => s + p.elo, 0) / winners.length;
    const avgLoserElo = losers.reduce((s, p) => s + p.elo, 0) / losers.length;
    const expectedWin = 1 / (1 + Math.pow(10, (avgLoserElo - avgWinnerElo) / 400));
    const eloChange = Math.round(32 * (1 - expectedWin));

    // Apply changes
    winnerIds.forEach(id => {
      const p = playerMap.get(id);
      if (p) {
        p.elo += eloChange;
        p.wins++;
      }
    });
    loserIds.forEach(id => {
      const p = playerMap.get(id);
      if (p) {
        p.elo -= eloChange;
        p.losses++;
      }
    });
  }

  // Write updated players back to sheet
  const updatedPlayers = Array.from(playerMap.values());
  const rows = [pHeaders, ...updatedPlayers.map(p =>
    pHeaders.map(h => {
      const val = p[h];
      return (typeof val === 'object') ? JSON.stringify(val) : val;
    })
  )];
  pSheet.clear();
  pSheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);

  SpreadsheetApp.getUi().alert('Stats recalculated for ' + updatedPlayers.length + ' players from ' + matches.length + ' matches!');
}
