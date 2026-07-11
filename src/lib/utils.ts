export function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function getNickname(): string | null {
  return localStorage.getItem('sketchguess_nickname');
}

export function setNickname(nickname: string): void {
  localStorage.setItem('sketchguess_nickname', nickname);
}

export function getPlayerId(): string {
  let id = localStorage.getItem('sketchguess_player_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('sketchguess_player_id', id);
  }
  return id;
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
