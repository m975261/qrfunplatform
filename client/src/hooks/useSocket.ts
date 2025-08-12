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
    console.log("Current location:", window.location.href);
    console.log("Protocol:", protocol, "Host:", window.location.host);
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
            // Enhanced Safari debugging for game end
            const isSafariAgent = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
            console.log("🏆 GAME END MESSAGE RECEIVED - Safari Debug:", {
              winner: message.winner,
              rankings: message.rankings,
              timestamp: new Date().toISOString(),
              wsState: socketRef.current?.readyState,
              isSafari: isSafariAgent,
              userAgent: navigator.userAgent.substring(0, 80),
              documentReady: document.readyState,
              windowLoaded: document.readyState === 'complete'
            });
            
            // Force state update with additional Safari debugging
            setGameState((prev: any) => {
              const newState = {
                ...prev,
                room: { 
                  ...prev.room, 
                  status: 'finished' 
                },
                gameEndData: {
                  winner: message.winner,
                  rankings: message.rankings,
                  timestamp: Date.now(),
                  debugInfo: {
                    receivedAt: new Date().toISOString(),
                    isSafari: isSafariAgent,
                    windowSize: `${window.innerWidth}x${window.innerHeight}`
                  }
                }
              };
              console.log("🏆 Safari Debug - Updated game state:", {
                hasGameEndData: !!newState.gameEndData,
                winner: newState.gameEndData?.winner,
                rankingCount: newState.gameEndData?.rankings?.length,
                roomStatus: newState.room?.status
              });
              return newState;
            });
            
            // Monitor connection stability after game end
            setTimeout(() => {
              const wsState = socketRef.current?.readyState;
              if (wsState !== WebSocket.OPEN) {
                console.warn("⚠️ WebSocket connection lost after game_end message, state:", wsState);
                if (wsState === WebSocket.CLOSED || wsState === WebSocket.CLOSING) {
                  console.log("🔄 Attempting to reconnect after game end disconnect...");
                  connect();
                }
              } else {
                console.log("✅ WebSocket connection stable after game_end processing");
              }
            }, 1000);
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
          case 'uno_called_success':
            // Show success feedback when UNO is called
            console.log("UNO successfully called by:", message.player);
            
            // Play voice saying "UNO"
            if ('speechSynthesis' in window) {
              const utterance = new SpeechSynthesisUtterance('UNO!');
              utterance.rate = 1.2;
              utterance.pitch = 1.3;
              utterance.volume = 0.8;
              window.speechSynthesis.speak(utterance);
            }
            
            // Set UNO message for animated display
            setGameState((prev: any) => ({
              ...prev,
              unoMessage: message.player
            }));
            // Clear message after animation
            setTimeout(() => {
              setGameState((prev: any) => ({
                ...prev,
                unoMessage: null
              }));
            }, 3000);
            break;
          case 'kicked':
            // Player was kicked - they become a spectator but stay in the room
            console.log("You have been converted to a spectator");
            // Don't redirect - let them stay as spectator
            break;
          case 'game_continued':
            // Handle game continuation - refresh state
            console.log("Game continued");
            setGameState((prev: any) => ({
              ...prev,
              needsContinue: false
            }));
            break;
          case 'room_reset':
            // Handle room reset after play again
            console.log("Room reset for new game");
            setGameState((prev: any) => ({
              ...prev,
              gameEndData: null,
              needsContinue: false
            }));
            break;
          case 'penalty_animation_start':
            console.log(`${message.player} is drawing ${message.totalCards} penalty cards...`);
            // Show penalty drawing notification
            setGameState((prev: any) => ({
              ...prev,
              penaltyAnimation: {
                player: message.player,
                totalCards: message.totalCards,
                drawnCards: 0,
                isActive: true
              }
            }));
            break;
          case 'penalty_card_drawn':
            console.log(`${message.player} drew card ${message.cardNumber} of ${message.totalCards}`);
            // Update penalty drawing progress
            setGameState((prev: any) => ({
              ...prev,
              penaltyAnimation: prev.penaltyAnimation ? {
                ...prev.penaltyAnimation,
                drawnCards: message.cardNumber
              } : null
            }));
            break;
          case 'penalty_animation_end':
            console.log(`${message.player} finished drawing ${message.totalCards} penalty cards`);
            // Clear penalty animation
            setGameState((prev: any) => ({
              ...prev,
              penaltyAnimation: null
            }));
            break;
          case 'clear_penalty_animation':
            console.log("Clearing penalty animation on server request");
            // Clear penalty animation immediately
            setGameState((prev: any) => ({
              ...prev,
              penaltyAnimation: null
            }));
            break;
          case 'host_left_redirect':
            // Host left during play again flow - redirect to main page
            console.log("Host left game:", message.message);
            localStorage.removeItem("currentRoomId");
            localStorage.removeItem("playerId");
            // Show brief message before redirect
            alert(message.message || "Host has left the game. Redirecting to main page...");
            window.location.href = "/";
            break;
          case 'host_changed':
            // New host assigned
            console.log("Host changed:", message.message);
            console.log("New host:", message.newHost);
            break;
          case 'error':
            // Handle server errors (like room not found)
            console.log("WebSocket error:", message.message);
            if (message.message?.includes('Room not found') || message.message?.includes('session expired')) {
              localStorage.removeItem("currentRoomId");
              localStorage.removeItem("playerId");
              window.location.href = "/";
            }
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
      console.log(`WebSocket closed: code=${event.code}, reason="${event.reason}", wasClean=${event.wasClean}`);
      
      // Log additional context for game end related disconnections
      if (event.code === 1006) {
        console.log("WebSocket closed abnormally (1006) - possible network issue or server termination");
      }
      
      // Clear heartbeat
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      
      // Don't reconnect automatically on code 1006 (abnormal closure) if it's due to HMR
      // But do reconnect for other close codes or if not HMR related
      const shouldReconnect = event.code !== 1006 || !event.reason?.includes('HMR');
      
      if (shouldReconnect) {
        console.log("Attempting to reconnect in 3 seconds...");
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      } else {
        console.log("Skipping reconnect - appears to be HMR related");
      }
    };
    
    socketRef.current.onerror = (error) => {
      console.error("WebSocket error:", error);
      console.error("WebSocket readyState:", socketRef.current?.readyState);
      console.error("WebSocket URL was:", wsUrl);
      console.error("Error timestamp:", new Date().toISOString());
      
      // Check if this error happens around game end time
      const gameEndRecent = gameState?.gameEndData && 
        gameState.gameEndData.timestamp && 
        (Date.now() - gameState.gameEndData.timestamp < 10000);
      
      if (gameEndRecent) {
        console.error("⚠️ WebSocket error occurred shortly after game end - possible connection issue");
      }
      
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
      (navigator as any).deviceMemory || 0
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

  const playAgain = () => {
    sendMessage({ type: 'play_again' });
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

  const replacePlayer = (targetPosition: number) => {
    sendMessage({
      type: 'replace_player',
      targetPosition
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
    playAgain,
    connect: manualConnect
  };
}
