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
  const [avatarMessages, setAvatarMessages] = useState<any[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
  const hasJoinedRoomRef = useRef<string | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const connect = () => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const hostname = window.location.hostname;
    const port = window.location.port;
    
    // Build proper WebSocket URL - always use current hostname
    let wsHost;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      wsHost = 'localhost:5000';
    } else {
      // For production/Replit, use the current hostname without port (defaults to 443/80)
      wsHost = hostname;
    }
    
    const wsUrl = `${protocol}//${wsHost}/ws`;
    
    console.log("Attempting WebSocket connection to:", wsUrl);
    console.log("Current location:", window.location.href);
    console.log("Protocol:", protocol, "Host:", wsHost);
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
            // Only preserve election state if it's actively in progress (not after host returns)
            setGameState((prev: any) => {
              const shouldPreserveElectionState = prev?.hostElectionActive === true && prev?.hostDisconnectedWarning;
              return {
                ...message.data,
                // Only preserve election states if election is still active
                hostDisconnectedWarning: shouldPreserveElectionState ? prev?.hostDisconnectedWarning : message.data.hostDisconnectedWarning,
                electionStartsIn: shouldPreserveElectionState ? prev?.electionStartsIn : message.data.electionStartsIn,
                hostElectionActive: shouldPreserveElectionState ? prev?.hostElectionActive : message.data.hostElectionActive,
                electionCandidates: shouldPreserveElectionState ? prev?.electionCandidates : message.data.electionCandidates,
                electionVotes: shouldPreserveElectionState ? prev?.electionVotes : message.data.electionVotes,
                votingDuration: shouldPreserveElectionState ? prev?.votingDuration : message.data.votingDuration,
                newHostName: prev?.newHostName,
                hostAssignedMessage: prev?.hostAssignedMessage
              };
            });
            break;
          case 'floating_emoji':
            handleFloatingEmoji(message);
            break;
          case 'avatar_message':
            handleAvatarMessage(message);
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
          case 'host_disconnected_warning':
            console.log("Host disconnected warning:", message);
            setGameState((prev: any) => ({
              ...prev,
              hostDisconnectedWarning: message.message,
              electionStartsIn: message.electionStartsIn,
              electionCandidates: message.candidates || [],
              eligibleVoterIds: message.eligibleVoterIds || [],
              canVoteNow: message.canVoteNow || false,
              hostCanReturn: message.hostCanReturn ?? true,
              disconnectedHostId: message.hostId || null,
              disconnectedHostPosition: message.hostPreviousPosition ?? null,
              hostElectionActive: true,
              electionVotes: {}
            }));
            break;
          case 'no_host_mode_enabled':
            console.log("No host mode enabled:", message);
            setGameState((prev: any) => ({
              ...prev,
              hostDisconnectedWarning: null,
              hostElectionActive: false,
              electionCandidates: [],
              noHostMode: true,
              room: {
                ...prev?.room,
                noHostMode: true,
                hostId: null,
                hostElectionActive: false
              }
            }));
            break;
          case 'host_reconnected':
            console.log("🟢 HOST RECONNECTED MESSAGE RECEIVED - Clearing all voting state", message);
            setGameState((prev: any) => {
              const newState = {
                ...prev,
                hostDisconnectedWarning: null,
                hostElectionActive: false,
                electionCandidates: [],
                electionVotes: {},
                votesSubmitted: undefined,
                totalVoters: undefined,
                votingDuration: undefined,
                room: {
                  ...prev?.room,
                  hostElectionActive: false,
                  hostElectionVotes: {},
                  hostDisconnectedAt: null
                }
              };
              console.log("🟢 New gameState after host_reconnected:", {
                hostDisconnectedWarning: newState.hostDisconnectedWarning,
                hostElectionActive: newState.hostElectionActive,
                electionCandidates: newState.electionCandidates
              });
              return newState;
            });
            break;
          case 'host_election_started':
            console.log("Host election started:", message);
            setGameState((prev: any) => ({
              ...prev,
              // Keep hostDisconnectedWarning so voting banner stays visible
              hostElectionActive: true,
              electionCandidates: message.candidates,
              votingDuration: message.votingDuration
            }));
            break;
          case 'host_vote_update':
            console.log("Host vote update:", message);
            setGameState((prev: any) => ({
              ...prev,
              electionVotes: message.votes,
              votesSubmitted: message.votesSubmitted,
              totalVoters: message.totalVoters
            }));
            break;
          case 'host_elected':
            console.log("New host elected:", message);
            setGameState((prev: any) => ({
              ...prev,
              hostElectionActive: false,
              hostDisconnectedWarning: null,
              electionCandidates: [],
              electionVotes: {},
              newHostName: message.newHostName,
              room: {
                ...prev?.room,
                hostId: message.newHostId,
                hostElectionActive: false,
                hostElectionVotes: {},
                hostDisconnectedAt: null
              }
            }));
            break;
          case 'host_assigned':
            console.log("Host manually assigned:", message);
            setGameState((prev: any) => ({
              ...prev,
              hostElectionActive: false,
              hostDisconnectedWarning: null,
              electionCandidates: [],
              electionVotes: {},
              newHostName: message.newHostName,
              hostAssignedMessage: message.message,
              room: {
                ...prev?.room,
                hostId: message.newHostId,
                hostElectionActive: false,
                hostElectionVotes: {},
                hostDisconnectedAt: null
              }
            }));
            break;
          // STREAMING MODE - Host disconnect/reconnect events
          case 'streaming_host_disconnected':
            console.log("[Streaming] Host disconnected:", message);
            setGameState((prev: any) => ({
              ...prev,
              streamingHostDisconnected: true,
              streamingHostDeadlineMs: message.deadlineMs,
              streamingHostName: message.hostName,
              streamingHostMessage: message.message
            }));
            break;
          case 'streaming_host_reconnected':
            console.log("[Streaming] Host reconnected:", message);
            setGameState((prev: any) => ({
              ...prev,
              streamingHostDisconnected: false,
              streamingHostDeadlineMs: null,
              streamingHostName: null,
              streamingHostMessage: null,
              streamingHostTimeout: false // Clear timeout flag on reconnection
            }));
            break;
          case 'streaming_host_timeout':
            console.log("[Streaming] Host timeout - redirecting:", message);
            setGameState((prev: any) => ({
              ...prev,
              streamingHostTimeout: true,
              streamingHostMessage: message.message
            }));
            // Redirect to home after brief delay
            setTimeout(() => {
              window.location.href = '/';
            }, 1500);
            break;
          case 'uno_called':
            // Remove notification - just log silently
            console.log("UNO called by:", message.player);
            break;
          case 'uno_called_success':
            // Show success feedback when UNO is called - Enhanced for all players
            console.log("UNO successfully called by:", message.player);
            
            // Play voice saying "UNO" for all players - Enhanced iOS Safari compatibility
            if ('speechSynthesis' in window) {
              // Create audio context for iOS Safari compatibility
              try {
                const utterance = new SpeechSynthesisUtterance('UNO!');
                utterance.rate = 1.2;
                utterance.pitch = 1.3;
                utterance.volume = 0.8;
                
                // iOS Safari specific workaround
                if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
                  // For iOS, ensure speech synthesis is initialized with user interaction
                  utterance.onstart = () => {
                    console.log('UNO audio started on iOS');
                  };
                  utterance.onerror = (event) => {
                    console.log('UNO audio error on iOS:', event);
                    // iOS fallback: Create HTML5 audio element with UNO sound
                    try {
                      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                      audioContext.resume().then(() => {
                        // Alternative: Show more prominent visual feedback for iOS
                        console.log('iOS audio context resumed for UNO');
                      });
                    } catch (audioError) {
                      console.log('iOS audio context failed:', audioError);
                    }
                  };
                }
                
                window.speechSynthesis.speak(utterance);
              } catch (error) {
                console.log('UNO audio failed:', error);
                // Fallback: Show visual indicator only
              }
            }
            
            // Set UNO message for animated display - Force update for all players
            setGameState((prev: any) => ({
              ...prev,
              unoMessage: message.player,
              lastUnoCall: Date.now() // Add timestamp to force re-render
            }));
            
            // Clear message after animation with extended time
            setTimeout(() => {
              setGameState((prev: any) => ({
                ...prev,
                unoMessage: null
              }));
            }, 4000); // Extended from 3000 to 4000ms
            break;
          case 'false_uno_penalty':
            console.log(`❌ FALSE UNO: ${message.player} drew ${message.cardsDrawn} penalty cards`);
            // Show penalty message for false UNO call
            setGameState((prev: any) => ({
              ...prev,
              falseUnoMessage: `${message.player} made a false UNO call! Drew ${message.cardsDrawn} cards!`,
              falseUnoTimestamp: Date.now(),
              forceRefresh: Math.random()
            }));
            // Clear message after animation
            setTimeout(() => {
              setGameState((prev: any) => ({
                ...prev,
                falseUnoMessage: null
              }));
            }, 3000);
            break;
          case 'one_card_left':
            console.log(`🃏 ${message.player} has 1 card left!`);
            // Show notification message for 1 card left
            setGameState((prev: any) => ({
              ...prev,
              oneCardMessage: message.message,
              oneCardMessagePlayer: message.player,
              oneCardMessageTimestamp: Date.now(),
              forceRefresh: Math.random()
            }));
            break;
          case 'turn_finished':
            console.log(`✅ ${message.player} finished their turn`);
            // Show brief notification for turn completion
            setGameState((prev: any) => ({
              ...prev,
              turnFinishedMessage: message.message,
              turnFinishedPlayer: message.player,
              turnFinishedTimestamp: Date.now(),
              forceRefresh: Math.random()
            }));
            break;
          case 'player_finished':
            console.log(`🏁 ${message.player} finished the game! Position: ${message.position}`);
            // No UI notification needed - winner modal will show instead
            // Just refresh game state to update player positions
            setGameState((prev: any) => ({
              ...prev,
              forceRefresh: Math.random()
            }));
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
          case 'new_room_created':
            // noHostMode game ended - redirect to new room
            console.log("New room created:", message);
            localStorage.removeItem("currentRoomId");
            localStorage.removeItem("playerId");
            // Redirect to join the new room
            window.location.href = `/?room=${message.newRoomCode}`;
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
          case 'card_replaced':
            console.log(`Card replaced by ${message.playerId}:`, message.message);
            // Force immediate game state refresh for card replacement - INSTANT (multiple immediate)
            if (typeof refreshGameState === 'function') {
              refreshGameState();
              refreshGameState(); // Double immediate
              setTimeout(() => refreshGameState(), 1);
              setTimeout(() => refreshGameState(), 5);
              setTimeout(() => refreshGameState(), 10);
              setTimeout(() => refreshGameState(), 20);
              setTimeout(() => refreshGameState(), 30);
            }
            // Force component re-render with multiple triggers for INSTANT visual update
            setGameState((prev: any) => ({
              ...prev,
              lastCardReplacedAt: Date.now(),
              forceRefresh: Math.random(),
              cardReplacementTrigger: Date.now(),
              handUpdateForce: Math.random(),
              instantUpdate: Math.random(),
              ultraFastUpdate: Date.now()
            }));
            break;
          case 'avatar_changed':
            console.log(`Avatar changed for player ${message.playerId}: ${message.gender}`);
            // Update localStorage for all clients
            localStorage.setItem(`avatar_${message.playerId}`, message.gender);
            // Force re-render to show updated avatar
            setGameState((prev: any) => ({
              ...prev,
              avatarUpdate: Date.now(),
              forceRefresh: Math.random()
            }));
            break;
          case 'choose_color_request':
            console.log('Color choice request received for wild card');
            // Set flag to show color picker
            setGameState((prev: any) => ({
              ...prev,
              showColorPicker: true,
              colorChoiceRequested: true
            }));
            break;
          case 'color_chosen':
            console.log(`🎨 COLOR RECEIVED: ${message.color} - updating all players`);
            // Update the current color for all players immediately with error handling
            try {
              setGameState((prev: any) => ({
                ...prev,
                room: {
                  ...prev?.room,
                  currentColor: message.color,
                  waitingForColorChoice: null // Clear waiting state
                },
                colorUpdate: Date.now(),
                forceRefresh: Math.random(),
                colorUpdateTimestamp: Date.now() // Additional trigger for color display
              }));
              console.log(`🎨 COLOR STATE UPDATED: ${message.color} applied successfully`);
            } catch (error) {
              console.error(`🚨 COLOR UPDATE ERROR:`, error);
              // Fallback: Try to update after a brief delay
              setTimeout(() => {
                try {
                  setGameState((prev: any) => ({
                    ...prev,
                    room: {
                      ...prev?.room,
                      currentColor: message.color,
                      waitingForColorChoice: null
                    },
                    colorUpdate: Date.now(),
                    forceRefresh: Math.random()
                  }));
                  console.log(`🎨 COLOR FALLBACK SUCCESS: ${message.color}`);
                } catch (fallbackError) {
                  console.error(`🚨 COLOR FALLBACK FAILED:`, fallbackError);
                }
              }, 10);
            }
            break;
          case 'uno_penalty':
            console.log(`UNO penalty for player: ${message.playerName}`);
            // Show penalty animation to all players
            if (typeof setGameState === 'function') {
              setGameState((prev: any) => ({
                ...prev,
                unoPenaltyAnimation: {
                  playerName: message.playerName,
                  show: true,
                  timestamp: Date.now()
                }
              }));
            }
            break;
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };
    
    socketRef.current.onclose = (event) => {
      setIsConnected(false);
      console.log(`WebSocket closed: code=${event.code}, reason="${event.reason}", wasClean=${event.wasClean}`);
      
      // CRITICAL: Reset hasJoinedRoomRef so we can re-join on reconnect
      // Each new WebSocket connection needs to send join_room again
      hasJoinedRoomRef.current = null;
      console.log("Reset join state for reconnection");
      
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

  const handleAvatarMessage = (message: any) => {
    const msgId = Math.random().toString(36).substring(7);
    const avatarMsg = {
      id: msgId,
      content: message.content,
      contentType: message.contentType,
      playerId: message.playerId,
      playerNickname: message.playerNickname,
      playerPosition: message.playerPosition
    };
    
    setAvatarMessages(prev => [...prev, avatarMsg]);
    
    // Remove message after 4 seconds
    setTimeout(() => {
      setAvatarMessages(prev => prev.filter(m => m.id !== msgId));
    }, 4000);
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

  const sendAvatarChange = (playerId: string, gender: 'male' | 'female') => {
    sendMessage({
      type: 'avatar_changed',
      playerId,
      gender
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
      position: targetPosition
    });
  };

  const assignSpectator = (spectatorId: string, position: number) => {
    sendMessage({
      type: 'assign_spectator',
      spectatorId,
      position
    });
  };

  const submitHostVote = (candidateId: string) => {
    sendMessage({
      type: 'submit_host_vote',
      candidateId
    });
  };

  const assignHost = (targetPlayerId: string) => {
    sendMessage({
      type: 'assign_host',
      targetPlayerId
    });
  };

  const hostEndGame = () => {
    sendMessage({ type: 'host_end_game' });
  };

  const hostExitRoom = () => {
    sendMessage({ type: 'host_exit_room' });
  };

  const voteNoHost = () => {
    sendMessage({ 
      type: 'submit_host_vote',
      candidateId: 'NO_HOST'
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

  const refreshGameState = useCallback(() => {
    // Force refresh the game state by triggering a re-render
    setGameState((prev: any) => ({
      ...prev,
      forceRefresh: Math.random(),
      lastRefreshed: Date.now()
    }));
  }, []);

  // Stream subscribe - for read-only stream viewers (no player needed)
  const streamSubscribe = useCallback((roomId: string, roomCode?: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      console.log("📺 Subscribing to room stream:", { roomId, roomCode });
      socketRef.current.send(JSON.stringify({
        type: 'stream_subscribe',
        roomId,
        roomCode
      }));
    } else {
      console.log("📺 WebSocket not ready, will subscribe when connected");
      // Try again when connected
      const checkConnection = setInterval(() => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          clearInterval(checkConnection);
          socketRef.current.send(JSON.stringify({
            type: 'stream_subscribe',
            roomId,
            roomCode
          }));
        }
      }, 500);
      // Clean up after 10 seconds
      setTimeout(() => clearInterval(checkConnection), 10000);
    }
  }, []);

  return {
    isConnected,
    gameState,
    setGameState,
    floatingEmojis,
    avatarMessages,
    joinRoom,
    startGame,
    playCard,
    drawCard,
    callUno,
    chooseColor,
    sendChatMessage,
    sendEmoji,
    sendAvatarChange,
    exitGame,
    kickPlayer,
    continueGame,
    replacePlayer,
    assignSpectator,
    playAgain,
    submitHostVote,
    assignHost,
    hostEndGame,
    hostExitRoom,
    voteNoHost,
    connect: manualConnect,
    refreshGameState,
    streamSubscribe
  };
}
