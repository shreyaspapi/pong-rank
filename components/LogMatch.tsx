import React, { useState } from 'react';
import { Player, MatchType } from '../types';
import { Button } from './Button';
import { Input } from './Input';
import { UserPlus, UserMinus, Trophy, XCircle, Loader2 } from 'lucide-react';
import { logMatch } from '../services/dataService';

interface LogMatchProps {
  players: Player[];
  onMatchLogged: () => void;
  onCancel: () => void;
}

export const LogMatch: React.FC<LogMatchProps> = ({ players, onMatchLogged, onCancel }) => {
  const [matchType, setMatchType] = useState<MatchType>('SINGLES');
  const [winnerIds, setWinnerIds] = useState<string[]>([]);
  const [loserIds, setLoserIds] = useState<string[]>([]);
  const [score, setScore] = useState('');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePlayerSelect = (id: string, isWinner: boolean) => {
    // Clear selection if already selected in the other group
    if (isWinner && loserIds.includes(id)) setLoserIds(prev => prev.filter(pid => pid !== id));
    if (!isWinner && winnerIds.includes(id)) setWinnerIds(prev => prev.filter(pid => pid !== id));

    const targetSet = isWinner ? setWinnerIds : setLoserIds;
    const targetState = isWinner ? winnerIds : loserIds;

    // Toggle logic
    if (targetState.includes(id)) {
      targetSet(prev => prev.filter(pid => pid !== id));
    } else {
      // Limit selection based on match type
      const limit = matchType === 'SINGLES' ? 1 : 2;
      if (targetState.length < limit) {
        targetSet(prev => [...prev, id]);
      }
    }
  };

  const validatePlayers = () => {
    const required = matchType === 'SINGLES' ? 1 : 2;
    if (winnerIds.length !== required || loserIds.length !== required) {
      setError(`Select ${required} winner${required > 1 ? 's' : ''} and ${required} loser${required > 1 ? 's' : ''}.`);
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = async () => {
    if (!score.trim()) {
      setError('Please enter a valid score (e.g., 11-9)');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await logMatch(matchType, winnerIds, loserIds, score);
      onMatchLogged();
    } catch (e) {
      setError('Failed to log match. Check connection.');
      setIsSubmitting(false);
    }
  };

  if (players.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-2xl shadow-sm">
        <UserPlus className="w-12 h-12 text-gray-300 mb-4" />
        <p className="text-gray-600 mb-4">You need at least 2 players to log a match.</p>
        <Button onClick={onCancel}>Go Back</Button>
      </div>
    );
  }

  // STEP 1: Select Type
  if (step === 1) {
    return (
      <div className="flex flex-col h-full">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Select Match Type</h2>
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => setMatchType('SINGLES')}
            className={`p-6 rounded-2xl border-2 text-center transition-all ${
              matchType === 'SINGLES' 
              ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            <div className="text-3xl mb-2">👤</div>
            <div className="font-semibold">Singles</div>
          </button>
          <button 
             onClick={() => setMatchType('DOUBLES')}
             className={`p-6 rounded-2xl border-2 text-center transition-all ${
              matchType === 'DOUBLES' 
              ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            <div className="text-3xl mb-2">👥</div>
            <div className="font-semibold">Doubles</div>
          </button>
        </div>
        <div className="mt-auto pt-6 flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button className="flex-1" onClick={() => setStep(2)}>Next</Button>
        </div>
      </div>
    );
  }

  // STEP 2: Select Players
  if (step === 2) {
    return (
      <div className="flex flex-col h-full pb-20 overflow-hidden">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Who played?</h2>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 min-h-0">
          {/* Winners Section */}
          <div>
            <div className="flex items-center gap-2 mb-3 text-emerald-700 font-medium">
              <Trophy className="w-4 h-4" />
              <span>Select Winners ({winnerIds.length}/{matchType === 'SINGLES' ? 1 : 2})</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {players.map(p => {
                const isSelected = winnerIds.includes(p.id);
                const isDisabled = loserIds.includes(p.id);
                return (
                  <button
                    key={`win-${p.id}`}
                    disabled={isDisabled}
                    onClick={() => handlePlayerSelect(p.id, true)}
                    className={`p-3 text-sm rounded-xl border text-left truncate transition-all ${
                      isSelected 
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' 
                        : isDisabled 
                          ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-emerald-200'
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Losers Section */}
          <div>
            <div className="flex items-center gap-2 mb-3 text-red-500 font-medium">
              <UserMinus className="w-4 h-4" />
              <span>Select Losers ({loserIds.length}/{matchType === 'SINGLES' ? 1 : 2})</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {players.map(p => {
                const isSelected = loserIds.includes(p.id);
                const isDisabled = winnerIds.includes(p.id);
                return (
                  <button
                    key={`lose-${p.id}`}
                    disabled={isDisabled}
                    onClick={() => handlePlayerSelect(p.id, false)}
                    className={`p-3 text-sm rounded-xl border text-left truncate transition-all ${
                      isSelected 
                        ? 'bg-red-500 border-red-500 text-white shadow-md' 
                        : isDisabled 
                          ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-red-200'
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setStep(1)}>Back</Button>
          <Button className="flex-1" onClick={() => validatePlayers() && setStep(3)}>Next</Button>
        </div>
      </div>
    );
  }

  // STEP 3: Enter Score
  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Final Score</h2>
      
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 flex items-center gap-2">
          <XCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mb-6">
        <Input 
          autoFocus
          label="Score (e.g. 11-7, 11-9)"
          placeholder="11-7, 11-9"
          value={score}
          onChange={(e) => setScore(e.target.value)}
          disabled={isSubmitting}
        />
        <p className="text-xs text-gray-400 mt-2">
          Tip: You can enter anything descriptive, like "3-0" or "Won by knockout".
        </p>
      </div>

      <div className="bg-gray-50 p-4 rounded-xl mb-6">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Summary</div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-emerald-700 font-medium">Winners</span>
          <span className="text-gray-900">{winnerIds.map(id => players.find(p => p.id === id)?.name).join(', ')}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-red-500 font-medium">Losers</span>
          <span className="text-gray-900">{loserIds.map(id => players.find(p => p.id === id)?.name).join(', ')}</span>
        </div>
      </div>

      <div className="mt-auto flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={() => setStep(2)} disabled={isSubmitting}>Back</Button>
        <Button className="flex-1 flex items-center justify-center gap-2" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {isSubmitting ? 'Confirming...' : 'Confirm Match'}
        </Button>
      </div>
    </div>
  );
};