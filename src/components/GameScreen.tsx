import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Crown,
  Clock,
  Users,
  LogOut,
  Eraser,
  Trash2,
  CheckCircle2,
  Play,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { Player, ChatMessage, Room, COLORS, BRUSH_SIZES, WORDS } from '../lib/types';
import { formatTime } from '../lib/utils';
import ScoreCard from './ScoreCard';

interface GameScreenProps {
  room: Room;
  players: Player[];
  messages: ChatMessage[];
  currentPlayerId: string;
  timeRemaining: number;
  onSendMessage: (content: string) => void;
  onDraw: (points: { x: number; y: number }[], color: string, brushSize: number) => void;
  onClearCanvas: () => void;
  onStartGame: () => void;
  onLeaveRoom: () => void;
  drawingData: { points: { x: number; y: number }[]; color: string; brushSize: number }[];
  onClearDrawingData: () => void;
}

export default function GameScreen({
  room,
  players,
  messages,
  currentPlayerId,
  timeRemaining,
  onSendMessage,
  onDraw,
  onClearCanvas,
  onStartGame,
  onLeaveRoom,
  drawingData,
  onClearDrawingData,
}: GameScreenProps) {
  const [messageInput, setMessageInput] = useState('');
  const [selectedColor, setSelectedColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(5);
  const [drawing, setDrawing] = useState(false);
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  const [lastPoints, setLastPoints] = useState<{ [playerId: string]: number }>({});
  const prevScoresRef = useRef<{ [playerId: string]: number }>({});

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const isDrawer = currentPlayer?.is_drawer ?? false;
  const canDraw = isDrawer && room.status === 'playing' && !room.round_ending;
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  useEffect(() => {
    const prevScores = prevScoresRef.current;
    const deltas: { [playerId: string]: number } = {};
    players.forEach((p) => {
      const prev = prevScores[p.id] ?? 0;
      if (p.score > prev) {
        deltas[p.id] = p.score - prev;
      }
    });
    if (Object.keys(deltas).length > 0) {
      setLastPoints(deltas);
    }
    prevScoresRef.current = Object.fromEntries(players.map((p) => [p.id, p.score]));
  }, [players]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    ctxRef.current = canvas.getContext('2d');
    const ctx = ctxRef.current;
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = rect.height;
        ctx.fillStyle = '#f1eff8';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.fillStyle = '#f1eff8';
    ctx.fillRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
    drawingData.forEach((stroke) => {
      drawPathOnCanvas(ctx, stroke.points, stroke.color, stroke.brushSize);
    });
  }, [drawingData]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const drawPathOnCanvas = (
    ctx: CanvasRenderingContext2D,
    points: { x: number; y: number }[],
    color: string,
    size: number
  ) => {
    if (points.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    const point = getCanvasCoords(e);
    setDrawing(true);
    setLastPoint(point);
    setCurrentPath([point]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing || !canDraw || !lastPoint) return;
    const point = getCanvasCoords(e);
    const ctx = ctxRef.current;
    if (!ctx) return;
    drawPathOnCanvas(ctx, [lastPoint, point], selectedColor, brushSize);
    setCurrentPath((prev) => [...prev, point]);
    setLastPoint(point);
  };

  const handleMouseUp = () => {
    if (drawing && currentPath.length > 1) {
      onDraw(currentPath, selectedColor, brushSize);
    }
    setDrawing(false);
    setLastPoint(null);
    setCurrentPath([]);
  };

  const hasGuessed = currentPlayer?.has_guessed_this_round ?? false;
  const canGuess = !isDrawer && !hasGuessed && room.status === 'playing' && !room.round_ending;

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !canGuess) return;
    onSendMessage(messageInput.trim());
    setMessageInput('');
  };

  const handleClearCanvas = () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.fillStyle = '#f1eff8';
    ctx.fillRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
    onClearCanvas();
    onClearDrawingData();
  };

  const getWordHint = () => {
    if (!room.current_word) return '';
    if (isDrawer || room.round_ending) return room.current_word;
    const hint = room.current_word.split('').map((char, i) => {
      if (i === 0 || i === room.current_word!.length - 1) return char.toUpperCase();
      return '_';
    }).join(' ');
    return hint;
  };

  const getTimerColor = () => {
    if (timeRemaining <= 10) return 'text-red-400';
    if (timeRemaining <= 30) return 'text-yellow-400';
    return 'text-accent-lavender';
  };

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col">
      {/* Header */}
      <header className="bg-dark-800 border-b border-dark-600 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-lavender to-accent-purple flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold gradient-text hidden sm:inline">SketchGuess</span>
            </div>
            <div className="flex items-center gap-2 bg-dark-700 px-3 py-1.5 rounded-lg">
              <span className="text-sm text-gray-400">Room:</span>
              <span className="font-mono font-bold text-accent-lavender">{room.code}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {room.status === 'playing' && (
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500">
                  Round {room.round_number} / {room.max_rounds}
                </span>
                <div className={`flex items-center gap-2 text-2xl font-bold ${getTimerColor()}`}>
                  <Clock className="w-6 h-6" />
                  <span>{formatTime(timeRemaining)}</span>
                </div>
              </div>
            )}
            <button onClick={onLeaveRoom} className="p-2 hover:bg-dark-700 rounded-lg transition-colors" title="Leave Room">
              <LogOut className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full p-4 gap-4">
        {/* Left Sidebar - Score Cards */}
        <aside className="lg:w-72 order-2 lg:order-1">
          <div className="card">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-dark-600">
              <Trophy className="w-5 h-5 text-accent-lavender" />
              <h3 className="font-semibold">Leaderboard</h3>
              <span className="text-sm text-gray-400 ml-auto">{players.length} players</span>
            </div>
            <div className="space-y-3">
              {sortedPlayers.map((player, index) => (
                <ScoreCard
                  key={player.id}
                  player={player}
                  rank={index + 1}
                  isCurrentPlayer={player.id === currentPlayerId}
                  isHost={player.is_host}
                  newPoints={lastPoints[player.id]}
                />
              ))}
            </div>
          </div>
        </aside>

        {/* Center - Canvas & Drawing Tools */}
        <main className="flex-1 order-1 lg:order-2 flex flex-col gap-4">
          {/* Word Display */}
          <div className="card text-center py-4">
            {room.status === 'waiting' ? (
              <div className="space-y-3">
                <p className="text-gray-400">Waiting for players...</p>
                <p className="text-sm text-gray-500">
                  {players.length} of {room.min_players} players joined
                </p>
                {currentPlayer?.is_host && (
                  <button onClick={onStartGame} className="btn-primary" disabled={players.length < room.min_players}>
                    <Play className="w-5 h-5 mr-2" />
                    Start Game
                  </button>
                )}
                {players.length < room.min_players && (
                  <p className="text-xs text-gray-500">
                    Need {room.min_players - players.length} more player{(room.min_players - players.length) !== 1 ? 's' : ''} to start
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-400">
                  {isDrawer ? 'Draw this word:' : 'Guess the drawing!'}
                </p>
                <p className="text-3xl font-bold tracking-wider">
                  {isDrawer ? (
                    <span className="text-accent-lavender">{room.current_word}</span>
                  ) : (
                    <span className="text-gray-100">{getWordHint()}</span>
                  )}
                </p>
                <p className="text-sm text-gray-500">
                  {room.current_word?.length || 0} letters
                </p>
              </div>
            )}
          </div>

          {/* Canvas */}
          <div className="card p-0 overflow-hidden flex-1 min-h-[300px] lg:min-h-[400px] relative">
            <canvas
              ref={canvasRef}
              className={`w-full h-full ${canDraw ? 'cursor-crosshair' : 'cursor-not-allowed'}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
            {room.round_ending && (
              <div className="absolute inset-0 bg-dark-900/80 flex items-center justify-center animate-fade-in">
                <div className="text-center">
                  <p className="text-gray-500 text-sm mb-1">The word was</p>
                  <p className="text-3xl font-bold gradient-text">{room.current_word}</p>
                </div>
              </div>
            )}
          </div>

          {/* Drawing Tools */}
          {canDraw && (
            <div className="card flex flex-wrap items-center gap-4">
              {/* Colors */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Color:</span>
                <div className="flex gap-1">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`w-8 h-8 rounded-lg border-2 transition-transform ${
                        selectedColor === color
                          ? 'border-accent-lavender scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Brush Size */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Size:</span>
                <div className="flex gap-1">
                  {BRUSH_SIZES.map((size) => (
                    <button
                      key={size}
                      onClick={() => setBrushSize(size)}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                        brushSize === size
                          ? 'bg-accent-lavender text-white'
                          : 'bg-dark-600 hover:bg-dark-500'
                      }`}
                    >
                      <div
                        className="rounded-full bg-white"
                        style={{ width: size, height: size }}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Tools */}
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setSelectedColor('#f1eff8')}
                  className="p-2 rounded-lg bg-dark-600 hover:bg-dark-500 transition-colors"
                  title="Eraser"
                >
                  <Eraser className="w-5 h-5" />
                </button>
                <button
                  onClick={handleClearCanvas}
                  className="p-2 rounded-lg bg-dark-600 hover:bg-red-500/20 text-red-400 transition-colors"
                  title="Clear Canvas"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Right Sidebar - Chat */}
        <aside className="lg:w-72 order-3">
          <div className="card h-full flex flex-col max-h-[calc(100vh-8rem)] lg:max-h-none">
            <h3 className="font-semibold mb-3 pb-3 border-b border-dark-600">Chat</h3>
            <div className="flex-1 overflow-y-auto space-y-2 mb-3 min-h-[200px]">
              {messages.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">
                  Guesses will appear here...
                </p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-2 rounded-lg animate-slide-up ${
                      msg.is_correct_guess
                        ? 'bg-accent-green/20 border border-accent-green/30'
                        : 'bg-dark-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-accent-lavender">{msg.player_nickname}</span>
                      {msg.is_correct_guess && <CheckCircle2 className="w-4 h-4 text-accent-green" />}
                    </div>
                    <p className={`text-sm ${msg.is_correct_guess ? 'text-accent-green' : 'text-gray-300'}`}>
                      {msg.is_correct_guess ? 'Guessed correctly!' : msg.content}
                    </p>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder={room.round_ending ? 'Round ending...' : hasGuessed ? 'You guessed correctly!' : isDrawer ? "You're drawing..." : 'Type your guess...'}
                disabled={!canGuess}
                className="input-field flex-1"
              />
              <button
                type="submit"
                disabled={!canGuess || !messageInput.trim()}
                className="btn-primary px-4"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}
