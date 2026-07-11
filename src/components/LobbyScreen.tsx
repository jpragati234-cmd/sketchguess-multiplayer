import { useState } from 'react';
import {
  Users,
  Crown,
  Settings,
  Play,
  LogOut,
  Copy,
  CheckCircle2,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { Room, Player, MIN_PLAYERS_OPTIONS, MAX_ROUNDS_OPTIONS } from '../lib/types';
import { getNickname } from '../lib/utils';

interface LobbyScreenProps {
  room: Room;
  players: Player[];
  currentPlayerId: string;
  onStartGame: () => void;
  onUpdateSettings: (minPlayers: number, maxRounds: number) => void;
  onLeaveRoom: () => void;
  isLoading?: boolean;
}

export default function LobbyScreen({
  room,
  players,
  currentPlayerId,
  onStartGame,
  onUpdateSettings,
  onLeaveRoom,
  isLoading,
}: LobbyScreenProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [showStartError, setShowStartError] = useState(false);

  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const isHost = currentPlayer?.is_host ?? false;
  const hostPlayer = players.find((p) => p.id === room.host_id);

  const canStart = players.length >= room.min_players;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleStartClick = () => {
    if (!canStart) {
      setShowStartError(true);
      setTimeout(() => setShowStartError(false), 3000);
      return;
    }
    onStartGame();
  };

  const handleMinPlayersChange = (value: number) => {
    if (isHost) {
      onUpdateSettings(value, room.max_rounds);
    }
  };

  const handleMaxRoundsChange = (value: number) => {
    if (isHost) {
      onUpdateSettings(room.min_players, value);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-accent-lavender/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent-pink/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent-purple/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold gradient-text mb-2">Game Lobby</h1>
          <p className="text-gray-400">Waiting for players to join...</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-accent-lavender" />
              Players ({players.length}/8)
            </h3>
            <div className="space-y-2">
              {players.map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    player.id === currentPlayerId
                      ? 'bg-dark-600 border border-accent-lavender/50'
                      : 'bg-dark-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-lavender to-accent-purple flex items-center justify-center text-gray-900 font-bold text-sm">
                      {player.nickname.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-100">
                      {player.nickname}
                      {player.id === currentPlayerId && (
                        <span className="text-accent-lavender text-sm ml-2">(you)</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {player.is_host && (
                      <span className="flex items-center gap-1 text-xs bg-accent-yellow/20 text-accent-yellow px-2 py-1 rounded-full">
                        <Crown className="w-3 h-3" />
                        Host
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-accent-lavender" />
              Room Info
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Room Code</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-dark-700 rounded-lg px-4 py-3 font-mono text-2xl text-center text-accent-lavender tracking-widest">
                    {room.code}
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="p-3 bg-dark-600 hover:bg-dark-500 rounded-lg transition-colors"
                    title="Copy room code"
                  >
                    {copiedCode ? (
                      <CheckCircle2 className="w-5 h-5 text-accent-green" />
                    ) : (
                      <Copy className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Host</label>
                  <div className="bg-dark-700 rounded-lg px-4 py-3 text-gray-100 flex items-center gap-2">
                    <Crown className="w-4 h-4 text-accent-yellow" />
                    {hostPlayer?.nickname || 'Unknown'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Your Name</label>
                  <div className="bg-dark-700 rounded-lg px-4 py-3 text-gray-100">
                    {getNickname() || currentPlayer?.nickname}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-accent-lavender" />
            Game Settings
            {!isHost && (
              <span className="text-xs font-normal text-gray-400 flex items-center gap-1 ml-2">
                <Lock className="w-3 h-3" />
                Host only
              </span>
            )}
          </h3>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-gray-400 mb-3">
                Minimum Players Required
              </label>
              <div className="flex flex-wrap gap-2">
                {MIN_PLAYERS_OPTIONS.map((num) => (
                  <button
                    key={num}
                    onClick={() => isHost && handleMinPlayersChange(num)}
                    disabled={!isHost}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      room.min_players === num
                        ? 'bg-accent-lavender text-gray-900'
                        : isHost
                        ? 'bg-dark-600 text-gray-100 hover:bg-dark-500'
                        : 'bg-dark-700 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Game cannot start until {room.min_players} players have joined
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-3">
                Number of Rounds
              </label>
              <div className="flex flex-wrap gap-2">
                {MAX_ROUNDS_OPTIONS.map((num) => (
                  <button
                    key={num}
                    onClick={() => isHost && handleMaxRoundsChange(num)}
                    disabled={!isHost}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      room.max_rounds === num
                        ? 'bg-accent-lavender text-gray-900'
                        : isHost
                        ? 'bg-dark-600 text-gray-100 hover:bg-dark-500'
                        : 'bg-dark-700 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Each player draws once per round
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-lg text-gray-100">
                  {players.length} of {room.min_players} players joined
                </span>
                {canStart && (
                  <span className="flex items-center gap-1 text-sm bg-accent-green/20 text-accent-green px-3 py-1 rounded-full">
                    <CheckCircle2 className="w-4 h-4" />
                    Ready to start
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400">
                {canStart
                  ? `Starting with ${room.max_rounds} rounds`
                  : `Need ${room.min_players - players.length} more player${room.min_players - players.length !== 1 ? 's' : ''} to start`}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onLeaveRoom}
                className="btn-secondary flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Leave
              </button>
              {isHost && (
                <button
                  onClick={handleStartClick}
                  disabled={isLoading || !canStart}
                  className={`btn-primary flex items-center gap-2 ${
                    !canStart ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <Play className="w-4 h-4" />
                  {isLoading ? 'Starting...' : 'Start Game'}
                </button>
              )}
            </div>
          </div>

          {showStartError && (
            <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-2 animate-slide-up">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-200 text-sm">
                Need at least {room.min_players} players to start the game.
                Currently have {players.length}.
              </span>
            </div>
          )}
        </div>

        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>Share the room code with friends to invite them to join!</p>
        </div>
      </div>
    </div>
  );
}
