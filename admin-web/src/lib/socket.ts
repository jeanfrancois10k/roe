import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getAdminSocket(): Socket {
  if (!socket) {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    // Si sur Vercel (URL contenant vercel.app), désactiver WebSocket persistant
    // car Vercel Serverless Functions ne supporte pas les connexions WebSocket stateful bidirectionnelles
    const isVercelServerless = API_BASE_URL.includes('vercel.app');

    socket = io(`${API_BASE_URL}/realtime`, {
      query: { role: 'ADMIN' },
      transports: isVercelServerless ? ['polling'] : ['websocket', 'polling'],
      autoConnect: !isVercelServerless, // Ne pas tenter de reconnecter en boucle sur Vercel
      reconnectionAttempts: 2,
      timeout: 5000,
    });

    socket.on('connect', () => {
      console.log('⚡ Connecté au flux temps réel ROE BOLET (Admin)');
    });

    socket.on('connect_error', (err) => {
      // Ignorer silencieusement si Vercel Serverless
      if (!isVercelServerless) {
        console.warn('Flux temps réel indisponible:', err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log('🔌 Déconnecté du flux temps réel ROE BOLET');
    });
  }

  return socket;
}

