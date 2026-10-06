import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getAdminSocket(): Socket {
  if (!socket) {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    socket = io(`${API_BASE_URL}/realtime`, {
      query: { role: 'ADMIN' },
      transports: ['websocket'],
      autoConnect: true,
    });

    socket.on('connect', () => {
      console.log('⚡ Connecté au flux temps réel ROE BOLET (Admin)');
    });

    socket.on('disconnect', () => {
      console.log('🔌 Déconnecté du flux temps réel ROE BOLET');
    });
  }

  return socket;
}
