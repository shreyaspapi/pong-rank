import React from 'react';
import { Match, Player } from '../types';
import { Calendar, Users, TrendingUp } from 'lucide-react';

interface MatchHistoryProps {
  matches: Match[];
  players: Player[];
}

export const MatchHistory: React.FC<MatchHistoryProps> = ({ matches, players }) => {
  // Handle both string and number IDs for matching
  const getPlayerName = (id: string | number) => {
    const idStr = String(id);
    return players.find(p => String(p.id) === idStr)?.name || 'Unknown';
  };

  if (!matches || matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <Calendar className="w-12 h-12 text-gray-300 mb-3" />
        <h3 className="text-lg font-medium text-gray-900">No Matches Yet</h3>
        <p className="text-gray-500">Log your first match to see history here.</p>
      </div>
    );
  }

  // Reverse to show newest matches first
  const sortedMatches = [...matches].reverse();

  return (
    <div className="flex flex-col gap-4 pb-4">
      {sortedMatches.map((match) => {
        // Handle date - could be empty string or invalid
        let dateStr = 'No date';
        if (match.date) {
          const parsedDate = new Date(match.date);
          if (!isNaN(parsedDate.getTime())) {
            dateStr = parsedDate.toLocaleDateString(undefined, {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });
          }
        }

        // Handle both old format (winnerIds/loserIds) and new format (teamAIds/teamBIds + winnerTeam)
        let winnerIds: string[] = [];
        let loserIds: string[] = [];

        if (match.winnerIds?.length && match.loserIds?.length) {
          // Old format - has actual winner/loser IDs
          winnerIds = match.winnerIds;
          loserIds = match.loserIds;
        } else if (match.teamAIds?.length && match.teamBIds?.length) {
          // New format - determine winners based on winnerTeam
          const teamA = Array.isArray(match.teamAIds) ? match.teamAIds.map(String) : [];
          const teamB = Array.isArray(match.teamBIds) ? match.teamBIds.map(String) : [];
          if (match.winnerTeam === 'A') {
            winnerIds = teamA;
            loserIds = teamB;
          } else {
            winnerIds = teamB;
            loserIds = teamA;
          }
        }

        const winners = winnerIds.map(getPlayerName).join(' & ');
        const losers = loserIds.map(getPlayerName).join(' & ');

        // Handle score - could be string or sets array
        let scoreStr = match.score || '';
        if (!scoreStr && match.sets && Array.isArray(match.sets)) {
          scoreStr = match.sets.map((s: any) => `${s.teamAScore}-${s.teamBScore}`).join(', ');
        }

        // Handle eloChange - might not exist
        const eloChange = match.eloChange || 0;

        return (
          <div key={match.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-3">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                {dateStr}
              </div>
              <div className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                {match.type === 'DOUBLES' ? 'Doubles' : 'Singles'}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="font-semibold text-gray-900 truncate">{winners}</div>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="font-normal text-gray-500 truncate">{losers}</div>
                  <div className="w-2 h-2 rounded-full bg-red-400 shrink-0"></div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-lg font-bold text-gray-900">{scoreStr || '-'}</div>
                {eloChange > 0 && (
                  <div className="text-xs font-medium text-emerald-600 flex items-center justify-end gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {eloChange} Elo
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};