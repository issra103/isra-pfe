import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

export function useSocket(onNewReading, onAnomalyDetected, onSimStatus, onConnect, onDisconnect) {
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL, { transports: ['websocket'] });

    socketRef.current.on('connect', () => {
      console.log('[Socket] Connecte :', socketRef.current.id);
      if (onConnect) onConnect();
    });

    socketRef.current.on('disconnect', () => {
      if (onDisconnect) onDisconnect();
    });

    socketRef.current.on('new_reading', (data) => {
      if (onNewReading) onNewReading(data);
    });

    socketRef.current.on('anomaly_detected', (data) => {
      if (onAnomalyDetected) onAnomalyDetected(data);
    });

    socketRef.current.on('simulator_status', (data) => {
      if (onSimStatus) onSimStatus(data);
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, []);
}
