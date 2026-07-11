import { useState, useEffect } from 'react';
import { Palette, Users, Zap, Trophy, ArrowRight, Gamepad2, Sparkles } from 'lucide-react';
import { getNickname, setNickname } from '../lib/utils';

interface HomePageProps {
  onCreateRoom: (nickname: string) => void;
  onJoinRoom: (nickname: string, roomCode: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

export default function HomePage({ onCreateRoom, onJoinRoom, isLoading, error }: HomePageProps) {
  const [nickname, setNicknameState] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [animateCards, setAnimateCards] = useState(false);

  useEffect(() => {
    const saved = getNickname();
    if (saved) setNicknameState(saved);
    setTimeout(() => setAnimateCards(true), 100);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    setNickname(nickname.trim());
    if (showJoinModal && roomCode.trim()) {
      onJoinRoom(nickname.trim(), roomCode.trim().toUpperCase());
    } else {
      onCreateRoom(nickname.trim());
    }
  };

  const features = [
    { icon: Palette, title: 'Draw Together', desc: 'Real-time collaborative canvas' },
    { icon: Users, title: 'Play with Friends', desc: 'Up to 8 players per room' },
    { icon: Zap, title: 'Fast-Paced Fun', desc: '60-second rounds keep it exciting' },
    { icon: Trophy, title: 'Climb the Leaderboard', desc: 'Compete for the top score' },
  ];

  return (
    <div className="min-h-screen bg-dark-900 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-accent-lavender/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent-pink/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent-purple/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-accent-lavender blur-lg opacity-50 rounded-lg" />
              <Gamepad2 className="w-8 h-8 text-accent-lavender relative z-10" />
            </div>
            <span className="text-2xl font-bold gradient-text">SketchGuess</span>
          </div>
        </header>

        {/* Hero Section */}
        <main className="max-w-7xl mx-auto px-6 pt-12 pb-20">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-dark-700 rounded-full px-4 py-2 mb-6 border border-dark-600">
              <Sparkles className="w-4 h-4 text-accent-yellow" />
              <span className="text-sm text-gray-400">Multiplayer Drawing Game</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold mb-6">
              <span className="text-gray-100">Draw. Guess.</span>
              <br />
              <span className="gradient-text">Win Together.</span>
            </h1>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-8">
              Challenge your friends in real-time drawing battles. One draws, everyone guesses.
              Can you guess the word before time runs out?
            </p>

            {/* Main Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <button
                onClick={() => {
                  if (nickname.trim()) {
                    setNickname(nickname.trim());
                    onCreateRoom(nickname.trim());
                  } else {
                    setShowJoinModal(false);
                  }
                }}
                disabled={isLoading}
                className="btn-primary flex items-center gap-2 text-lg px-8 py-4 min-w-[200px]"
              >
                Create Room
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowJoinModal(true)}
                disabled={isLoading}
                className="btn-secondary flex items-center gap-2 text-lg px-8 py-4 min-w-[200px]"
              >
                Join Room
              </button>
            </div>
          </div>

          {/* Nickname Input Section */}
          <div className="max-w-md mx-auto mb-16">
            {error && (
              <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 animate-fade-in">
                {error}
              </div>
            )}
            <div className="card-hover">
              <label className="block text-sm font-medium text-gray-400 mb-3">
                Your Nickname
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNicknameState(e.target.value)}
                placeholder="Enter your nickname..."
                maxLength={20}
                className="input-field text-center text-lg"
              />
              <p className="text-xs text-gray-500 mt-2 text-center">
                This will be saved for your next visit
              </p>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className={`card-hover text-center transform transition-all duration-500 ${
                  animateCards ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gradient-to-br from-dark-600 to-dark-700 flex items-center justify-center border border-dark-500">
                  <feature.icon className="w-7 h-7 text-accent-lavender" />
                </div>
                <h3 className="text-lg font-semibold text-gray-100 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-500">{feature.desc}</p>
              </div>
            ))}
          </div>
        </main>

        {/* Footer */}
        <footer className="text-center py-8 text-gray-400 text-sm">
          <p>Made with creativity and collaboration</p>
        </footer>
      </div>

      {/* Join Room Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-6 animate-fade-in">
          <div className="card max-w-md w-full animate-bounce-in">
            <h2 className="text-2xl font-bold text-gray-100 mb-6 text-center">Join a Room</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Your Nickname
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNicknameState(e.target.value)}
                  placeholder="Enter your nickname..."
                  maxLength={20}
                  className="input-field"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Room Code
                </label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="Enter 6-character code..."
                  maxLength={6}
                  className="input-field text-center text-xl tracking-widest"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!nickname.trim() || roomCode.length !== 6 || isLoading}
                  className="btn-primary flex-1"
                >
                  {isLoading ? 'Joining...' : 'Join'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
