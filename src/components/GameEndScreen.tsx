import { Trophy, RotateCcw, LogOut, Crown, Medal, Target, Pencil, PartyPopper } from 'lucide-react';
import { Room, Player } from '../lib/types';

interface GameEndScreenProps {
  room: Room;
  players: Player[];
  currentPlayerId: string;
  onPlayAgain: () => void;
  onReturnToLobby: () => void;
  onLeaveRoom: () => void;
}

export default function GameEndScreen({
  room,
  players,
  currentPlayerId,
  onPlayAgain,
  onReturnToLobby,
  onLeaveRoom,
}: GameEndScreenProps) {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const winner = sortedPlayers[0];
  const isHost = players.find((p) => p.id === currentPlayerId)?.is_host ?? false;
  const isTie = sortedPlayers.length > 1 && sortedPlayers[0].score === sortedPlayers[1].score;

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4 py-8">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-accent-lavender/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent-pink/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent-purple/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-2xl w-full">
        {/* Winner Banner */}
        <div className="text-center mb-8 animate-slide-up">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/50 mb-4">
            <PartyPopper className="w-10 h-10 text-yellow-400" />
          </div>
          {winner && !isTie && (
            <h1 className="text-4xl font-bold mb-2">
              <span className="text-yellow-400">Congratulations!</span>
            </h1>
          )}
          {winner && !isTie && (
            <p className="text-2xl text-gray-100 mb-2">
              <span className="font-bold gradient-text">{winner.nickname}</span>
            </p>
          )}
          {winner && !isTie && (
            <p className="text-lg text-gray-400">
              You are the Winner!
            </p>
          )}
          {isTie && (
            <h1 className="text-4xl font-bold gradient-text mb-2">It's a Tie!</h1>
          )}
          {winner && (
            <p className="text-sm text-gray-400 mt-2">
              Final Score: <span className="font-bold text-accent-lavender">{winner.score}</span> points
            </p>
          )}
        </div>

        {/* Final Leaderboard */}
        <div className="card mb-6 animate-slide-up">
          <h2 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <Medal className="w-5 h-5 text-accent-lavender" />
            Final Leaderboard
          </h2>

          {/* Column headers */}
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-3 sm:gap-x-6 px-3 pb-2 mb-2 border-b border-dark-600 text-xs text-gray-400 uppercase tracking-wide">
            <span className="w-8 text-center">Rank</span>
            <span>Player</span>
            <span className="text-right w-16">Score</span>
            <span className="text-right w-14 hidden sm:block">Guesses</span>
            <span className="text-right w-14 hidden sm:block">Draws</span>
          </div>

          <div className="space-y-2">
            {sortedPlayers.map((player, index) => (
              <div
                key={player.id}
                className={`grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-3 sm:gap-x-6 items-center p-3 rounded-xl transition-all ${
                  index === 0
                    ? 'bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/50'
                    : index === 1
                    ? 'bg-gradient-to-br from-gray-400/20 to-gray-500/10 border border-gray-400/50'
                    : index === 2
                    ? 'bg-gradient-to-br from-amber-600/20 to-amber-700/10 border border-amber-600/50'
                    : 'bg-dark-700 border border-dark-500'
                } ${player.id === currentPlayerId ? 'ring-2 ring-accent-lavender/50' : ''}`}
              >
                {/* Rank */}
                <div className="flex items-center justify-center w-8">
                  {index < 3 ? (
                    <Trophy className={`w-5 h-5 ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : 'text-amber-500'}`} />
                  ) : (
                    <span className="text-sm font-bold text-gray-400">#{index + 1}</span>
                  )}
                </div>

                {/* Player Name */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    index === 0
                      ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-gray-900'
                      : 'bg-gradient-to-br from-accent-lavender to-accent-purple text-gray-900'
                  }`}>
                    {player.nickname.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <span className={`font-semibold truncate block ${player.id === currentPlayerId ? 'text-accent-lavender' : 'text-gray-100'}`}>
                      {player.nickname}
                      {player.id === currentPlayerId && <span className="text-xs text-gray-400 ml-1">(you)</span>}
                    </span>
                    {player.is_host && (
                      <span className="flex items-center gap-1 text-xs text-accent-yellow">
                        <Crown className="w-3 h-3" />
                        Host
                      </span>
                    )}
                  </div>
                </div>

                {/* Score */}
                <div className={`text-xl font-bold text-right w-16 ${index === 0 ? 'text-yellow-400' : 'text-gray-100'}`}>
                  {player.score}
                </div>

                {/* Correct Guesses */}
                <div className="text-right w-14 hidden sm:block">
                  <div className="flex items-center justify-end gap-1 text-gray-100">
                    <Target className="w-3 h-3 text-accent-green" />
                    <span className="text-sm font-medium">{player.correct_guesses}</span>
                  </div>
                </div>

                {/* Times as Drawer */}
                <div className="text-right w-14 hidden sm:block">
                  <div className="flex items-center justify-end gap-1 text-gray-100">
                    <Pencil className="w-3 h-3 text-accent-lavender" />
                    <span className="text-sm font-medium">{player.times_as_drawer}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile-only stats note */}
          <p className="text-xs text-gray-400 mt-3 sm:hidden text-center">
            Stats shown on desktop view
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center animate-fade-in">
          {isHost ? (
            <>
              <button onClick={onPlayAgain} className="btn-primary flex items-center gap-2 justify-center">
                <RotateCcw className="w-5 h-5" />
                Play Again
              </button>
              <button onClick={onReturnToLobby} className="btn-secondary flex items-center gap-2 justify-center">
                <LogOut className="w-5 h-5" />
                Return to Lobby
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center sm:self-center">
              Waiting for the host to start a new game...
            </p>
          )}
          <button onClick={onLeaveRoom} className="btn-secondary flex items-center gap-2 justify-center">
            <LogOut className="w-5 h-5" />
            Leave Room
          </button>
        </div>
      </div>
    </div>
  );
}
