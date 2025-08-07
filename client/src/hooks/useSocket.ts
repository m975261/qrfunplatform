import { useCallback, useEffect, useRef, useState } from "react";

interface SocketMessage {
  type: string;
  data?: any;
  [key: string]: any;
}

export function useSocket(autoConnect: boolean = true) {
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState<any>(null);
  const [floatingEmojis, setFloatingEmojis] = useState<any[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
  const hasJoinedRoomRef = useRef<string | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const connect = () => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log("Attempting WebSocket connection to:", wsUrl);
    socketRef.current = new WebSocket(wsUrl);
    
    socketRef.current.onopen = () => {
      setIsConnected(true);
      console.log("WebSocket connected successfully");
      
      // Start heartbeat - more frequent to handle tab switching
      heartbeatIntervalRef.current = setInterval(() => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          lastActivityRef.current = Date.now();
          socketRef.current.send(JSON.stringify({ 
            type: 'heartbeat',
            timestamp: lastActivityRef.current,
            tabVisible: !document.hidden // Track if tab is currently visible
          }));
        }
      }, 15000); // Send heartbeat every 15 seconds
    };
    
    socketRef.current.onmessage = (event) => {
      try {
        const message: SocketMessage = JSON.parse(event.data);
        
        switch (message.type) {
          case 'room_state':
            setGameState(message.data);
            break;
          case 'floating_emoji':
            handleFloatingEmoji(message);
            break;
          case 'game_end':
            // Handle game end
            console.log("Game ended, winner:", message.winner);
            setGameState((prev: any) => ({
              ...prev,
              gameEndData: message
            }));
            break;
          case 'player_left':
            console.log("Player left:", message.player);
            if (message.needsContinue) {
              setGameState((prev: any) => ({
                ...prev,
                needsContinue: true
              }));
            }
            break;
          case 'uno_called':
            // Remove notification - just log silently
            console.log("UNO called by:", message.player);
            break;
          case 'heartbeat_ack':
            // Server acknowledged our heartbeat - connection is stable
            break;
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };
    
    socketRef.current.onclose = (event) => {
      setIsConnected(false);
      console.log("WebSocket closed:", event.code, event.reason);
      
      // Clear heartbeat
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      
      // Don't reconnect automatically on code 1006 (abnormal closure) if it's due to HMR
      if (event.code !== 1006 || !event.reason.includes('HMR')) {
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      }
    };
    
    socketRef.current.onerror = (error) => {
      console.error("WebSocket error:", error);
      setIsConnected(false);
    };
  };

  const handleFloatingEmoji = (message: any) => {
    const emojiId = Math.random().toString(36).substring(7);
    const emoji = {
      id: emojiId,
      emoji: message.emoji,
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      playerId: message.playerId
    };
    
    setFloatingEmojis(prev => [...prev, emoji]);
    
    // Remove emoji after 2 seconds
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => e.id !== emojiId));
    }, 2000);
  };

  const sendMessage = (message: SocketMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  };

  const generateUserFingerprint = () => {
    // Create a unique fingerprint based on browser and system characteristics
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Browser fingerprint', 2, 2);
    }
    
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL(),
      navigator.hardwareConcurrency || 0,
      navigator.deviceMemory || 0
    ].join('|');
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  };

  const joinRoom = useCallback((playerId: string, roomId: string) => {
    const joinKey = `${playerId}-${roomId}`;
    if (hasJoinedRoomRef.current === joinKey) {
      console.log("Already joined room, skipping:", { playerId, roomId });
      return;
    }
    
    const userFingerprint = generateUserFingerprint();
    const sessionId = Math.random().toString(36).substring(7);
    
    console.log("Sending join_room message:", { playerId, roomId, userFingerprint, sessionId });
    hasJoinedRoomRef.current = joinKey;
    sendMessage({
      type: 'join_room',
      playerId,
      roomId,
      userFingerprint,
      sessionId
    });
  }, []);

  const startGame = () => {
    sendMessage({ type: 'start_game' });
  };

  const playCard = (cardIndex: number) => {
    sendMessage({
      type: 'play_card',
      cardIndex
    });
  };

  const drawCard = () => {
    sendMessage({ type: 'draw_card' });
  };

  const callUno = () => {
    sendMessage({ type: 'call_uno' });
  };

  const chooseColor = (color: string) => {
    sendMessage({
      type: 'choose_color',
      color
    });
  };

  const sendChatMessage = (text: string) => {
    sendMessage({
      type: 'send_message',
      text
    });
  };

  const sendEmoji = (emoji: string) => {
    sendMessage({
      type: 'send_emoji',
      emoji
    });
  };

  const exitGame = () => {
    sendMessage({ type: 'exit_game' });
  };

  const kickPlayer = (targetPlayerId: string) => {
    sendMessage({
      type: 'kick_player',
      targetPlayerId
    });
  };

  const continueGame = () => {
    sendMessage({ type: 'continue_game' });
  };

  const replacePlayer = (spectatorId: string, leftPlayerPosition: number) => {
    sendMessage({
      type: 'replace_player',
      spectatorId,
      leftPlayerPosition
    });
  };

  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    
    // Handle tab visibility changes
    const handleVisibilityChange = () => {
      if (!document.hidden && socketRef.current?.readyState === WebSocket.OPEN) {
        // Tab became visible - send immediate heartbeat
        lastActivityRef.current = Date.now();
        socketRef.current.send(JSON.stringify({ 
          type: 'heartbeat',
          timestamp: lastActivityRef.current,
          tabVisible: true
        }));
      }
    };
    
    // Handle user activity to maintain connection
    const handleUserActivity = () => {
      lastActivityRef.current = Date.now();
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('mousemove', handleUserActivity);
    document.addEventListener('keydown', handleUserActivity);
    document.addEventListener('click', handleUserActivity);
    document.addEventListener('scroll', handleUserActivity);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('mousemove', handleUserActivity);
      document.removeEventListener('keydown', handleUserActivity);
      document.removeEventListener('click', handleUserActivity);
      document.removeEventListener('scroll', handleUserActivity);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [autoConnect]);

  const manualConnect = () => {
    if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED) {
      connect();
    }
  };

  return {
    isConnected,
    gameState,
    floatingEmojis,
    joinRoom,
    startGame,
    playCard,
    drawCard,
    callUno,
    chooseColor,
    sendChatMessage,
    sendEmoji,
    exitGame,
    kickPlayer,
    continueGame,
    replacePlayer,
    connect: manualConnect
  };
}
