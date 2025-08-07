import { useCallback, useEffect, useRef, useState } from "react";

interface SocketMessage {
  type: string;
  data?: any;
  [key: string]: any;
}

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState<any>(null);
  const [floatingEmojis, setFloatingEmojis] = useState<any[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const hasJoinedRoomRef = useRef<string | null>(null);

  const connect = () => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log("Attempting WebSocket connection to:", wsUrl);
    socketRef.current = new WebSocket(wsUrl);
    
    socketRef.current.onopen = () => {
      setIsConnected(true);
      console.log("WebSocket connected successfully");
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
            break;
          case 'uno_called':
            // Handle UNO call
            console.log("UNO called by:", message.player);
            break;
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };
    
    socketRef.current.onclose = (event) => {
      setIsConnected(false);
      console.log("WebSocket closed:", event.code, event.reason);
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

  const joinRoom = useCallback((playerId: string, roomId: string) => {
    const joinKey = `${playerId}-${roomId}`;
    if (hasJoinedRoomRef.current === joinKey) {
      console.log("Already joined room, skipping:", { playerId, roomId });
      return;
    }
    
    console.log("Sending join_room message:", { playerId, roomId });
    hasJoinedRoomRef.current = joinKey;
    sendMessage({
      type: 'join_room',
      playerId,
      roomId
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

  useEffect(() => {
    connect();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

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
    sendEmoji
  };
}
