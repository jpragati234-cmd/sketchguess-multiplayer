import { useEffect, useState } from 'react';
import { Trophy, Star, Zap } from 'lucide-react';
import { Player } from '../lib/types';

interface ScoreCardProps {
  player: Player;
  rank: number;
  isCurrentPlayer: boolean;
  isHost: boolean;
  newPoints?: number;
}

export default function ScoreCard({
  player,
  rank,
  isCurrentPlayer,
  isHost,
  newPoints,
}: ScoreCardProps) {
  const [showPointsAnimation, setShowPointsAnimation] = useState(false);
  const [animatedPoints, setAnimatedPoints] = useState(0);

  useEffect(() => {
    if (newPoints && newPoints > 0) {
      setShowPointsAnimation(true);
      setAnimatedPoints(newPoints);
      const timer = setTimeout(() => {
        setShowPointsAnimation(false);
        setAnimatedPoints(0);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [newPoints]);

  const getRankStyles = () => {
    if (rank === 1) {
      return {
        bg: 'from-yellow-500/20 to-yellow-600/10',
        border: 'border-yellow-500/50',
        text: 'text-yellow-400',
        icon: Trophy,
      };
    }
    if (rank === 2) {
      return {
        bg: 'from-gray-400/20 to-gray-500/10',
        border: 'border-gray-400/50',
        text: 'text-gray-300',
        icon: Trophy,
      };
    }
    if (rank === 3) {
      return {
        bg: 'from-amber-600/20 to-amber-700/10',
        border: 'border-amber-600/50',
        text: 'text-amber-500',
        icon: Trophy,
      };
    }
    return {
      bg: 'from-dark-700 to-dark-600',
      border: 'border-dark-500',
      text: 'text-gray-500',
      icon: null,
    };
  };

  const styles = getRankStyles();
  const RankIcon = styles.icon;

  return (
    <div
      className={`bg-gradient-to-br ${styles.bg} ${styles.border} rounded-xl p-4 transition-all duration-300 ${
        isCurrentPlayer ? 'ring-2 ring-accent-lavender/50 scale-[1.02]' : ''
      } ${showPointsAnimation ? 'animate-score-pop' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Rank */}
          <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${
            rank <= 3 ? 'bg-gradient-to-br from-accent-lavender/20 to-accent-purple/20' : 'bg-dark-600'
          }`}>
            {RankIcon ? (
              <RankIcon className={`w-5 h-5 ${styles.text}`} />
            ) : (
              <span className="text-sm font-bold text-gray-400">#{rank}</span>
            )}
          </div>

          {/* Avatar & Name */}
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${player.is_drawer ? 'from-accent-lavender to-accent-purple' : 'from-dark-500 to-dark-600'} flex items-center justify-center text-gray-900 font-bold text-sm`}>
              {player.nickname.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className={`font-semibold ${isCurrentPlayer ? 'text-accent-lavender' : 'text-gray-100'}`}>
                {player.nickname}
                {isCurrentPlayer && <span className="text-xs text-gray-400 ml-1">(you)</span>}
              </span>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                {isHost && (
                  <span className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-accent-yellow" />
                    Host
                  </span>
                )}
                {player.is_drawer && (
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-accent-lavender" />
                    Drawing
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Score */}
        <div className="text-right relative">
          <div className={`text-2xl font-bold ${rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-gray-300' : rank === 3 ? 'text-amber-500' : 'text-accent-lavender-light'}`}>
            {player.score}
          </div>
          {showPointsAnimation && (
            <div className="absolute -top-2 right-0 text-sm font-bold text-accent-green animate-bounce">
              +{animatedPoints}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
