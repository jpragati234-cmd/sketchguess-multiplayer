import { useEffect } from 'react';
import HomePage from './components/HomePage';
import LobbyScreen from './components/LobbyScreen';
import GameScreen from './components/GameScreen';
import GameEndScreen from './components/GameEndScreen';
import { useGame } from './hooks/useGame';

export default function App() {
  const {
    room,
    players,
    messages,
    drawingData,
    isLoading,
    error,
    currentPlayerId,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    playAgain,
    returnToLobby,
    updateSettings,
    sendMessage,
    sendDraw,
    clearCanvas,
    clearDrawingData,
  } = useGame();

  useEffect(() => {
    if (error) {
      console.error('Game error:', error);
    }
  }, [error]);

  if (!room) {
    return (
      <HomePage
        onCreateRoom={createRoom}
        onJoinRoom={joinRoom}
        isLoading={isLoading}
        error={error}
      />
    );
  }

  if (room.status === 'waiting') {
    return (
      <LobbyScreen
        room={room}
        players={players}
        currentPlayerId={currentPlayerId}
        onStartGame={startGame}
        onUpdateSettings={updateSettings}
        onLeaveRoom={leaveRoom}
        isLoading={isLoading}
      />
    );
  }

  if (room.status === 'ended') {
    return (
      <GameEndScreen
        room={room}
        players={players}
        currentPlayerId={currentPlayerId}
        onPlayAgain={playAgain}
        onReturnToLobby={returnToLobby}
        onLeaveRoom={leaveRoom}
      />
    );
  }

  return (
    <GameScreen
      room={room}
      players={players}
      messages={messages}
      currentPlayerId={currentPlayerId}
      timeRemaining={room.time_remaining}
      onSendMessage={sendMessage}
      onDraw={sendDraw}
      onClearCanvas={clearCanvas}
      onStartGame={startGame}
      onLeaveRoom={leaveRoom}
      drawingData={drawingData}
      onClearDrawingData={clearDrawingData}
    />
  );
}
