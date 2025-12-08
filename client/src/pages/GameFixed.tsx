import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Card as UICard, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Menu, ArrowRight, ArrowLeft, Users, MessageCircle, Share2 } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { useToast } from "@/hooks/use-toast";
import PlayerArea from "@/components/game/PlayerArea";
import GameCard from "@/components/game/Card";
import ChatPanel from "@/components/game/ChatPanel";
import GameEndModal from "@/components/game/GameEndModal";
import ColorPickerModal from "@/components/game/ColorPickerModal";
import NicknameEditor from "@/components/NicknameEditor";

import { WinnerModal } from "@/components/game/WinnerModal";
import GuruCardReplaceModal from "@/components/game/GuruCardReplaceModal";

export default function Game() {
  const [, params] = useRoute("/game/:roomId");
  const [, setLocation] = useLocation();
  const roomId = params?.roomId;
  const playerId = localStorage.getItem("playerId") || localStorage.getItem("userId");
  const { toast } = useToast();
  

  
  const {
    gameState,
    setGameState,
    floatingEmojis,
    joinRoom,
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
    playAgain,
    isConnected,
    refreshGameState
  } = useSocket();

  const [showChat, setShowChat] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showGameEnd, setShowGameEnd] = useState(false);
  const [gameEndData, setGameEndData] = useState<any>(null);
  const [pendingWildCard, setPendingWildCard] = useState<number | null>(null);
  const [timer, setTimer] = useState(30);
  const [hasCalledUno, setHasCalledUno] = useState(false);
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);
  const [showNicknameEditor, setShowNicknameEditor] = useState(false);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winnerData, setWinnerData] = useState<any>(null);
  const [showGuruReplaceModal, setShowGuruReplaceModal] = useState(false);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
  const [selectedAvatarPlayerId, setSelectedAvatarPlayerId] = useState<string | null>(null);
  const [unoPenaltyAnimation, setUnoPenaltyAnimation] = useState<{ playerName: string; show: boolean } | null>(null);
  const [handRefreshKey, setHandRefreshKey] = useState(0);
  const [showConnectionError, setShowConnectionError] = useState(false);

  // Debug logs for troubleshooting
  console.log("🚨 WHITE PAGE DEBUG:", {
    gameState: !!gameState,
    room: !!gameState?.room,
    isConnected,
    roomId,
    playerId,
    timestamp: new Date().toISOString()
  });

  useEffect(() => {
    // If no playerId exists, redirect to home to join properly
    if (!playerId && roomId) {
      console.log("No playerId found, redirecting to home");
      setLocation(`/?room=${roomId}`);
      return;
    }
    
    if (roomId && playerId && isConnected) {
      joinRoom(playerId, roomId);
    }
  }, [roomId, playerId, isConnected, joinRoom, setLocation]);

  useEffect(() => {
    if (gameState?.gameEndData) {
      // Map the server data to what the component expects
      const mappedData = {
        ...gameState.gameEndData,
        finalRankings: gameState.gameEndData.rankings || gameState.gameEndData.finalRankings || []
      };
      setWinnerData(mappedData);
      setShowWinnerModal(true);
      
      // Additional fix for disconnected players - force modal show after delay
      setTimeout(() => {
        if (mappedData && !showWinnerModal) {
          console.log("🏆 Force showing winner modal for potentially disconnected player");
          setShowWinnerModal(true);
        }
      }, 1000);
    }
    
    // CRITICAL FIX: Check if room is finished but no gameEndData (disconnected player case)
    if (gameState?.room?.status === 'finished' && !gameState?.gameEndData && !showWinnerModal) {
      console.log("🏆 Detected finished game without gameEndData - requesting game end data");
      // Request game end data from server for this specific case
      if (roomId) {
        fetch(`/api/rooms/${roomId}/game-end-data`, {
          headers: { 'Authorization': `Bearer ${playerId}` }
        })
        .then(res => res.json())
        .then(data => {
          if (data.winner && data.rankings) {
            console.log("🏆 Retrieved game end data for disconnected player:", data);
            setWinnerData({
              winner: data.winner,
              finalRankings: data.rankings,
              timestamp: Date.now()
            });
            setShowWinnerModal(true);
          }
        })
        .catch(err => console.error("Failed to fetch game end data:", err));
      }
    }
    
    if (gameState?.needsContinue) {
      setShowContinuePrompt(true);
    }
    
    // Handle UNO penalty animation
    if (gameState?.unoPenaltyAnimation?.show) {
      setUnoPenaltyAnimation({
        playerName: gameState.unoPenaltyAnimation.playerName,
        show: true
      });
      
      // Hide animation after 4 seconds
      setTimeout(() => {
        setUnoPenaltyAnimation(null);
      }, 4000);
    }
  }, [gameState?.gameEndData, gameState?.needsContinue, gameState?.room?.status, showWinnerModal, roomId, playerId, gameState?.unoPenaltyAnimation]);

  // Handle card replacement visual updates
  useEffect(() => {
    if (gameState?.cardReplacementTrigger) {
      setHandRefreshKey(prev => prev + 1);
    }
  }, [gameState?.cardReplacementTrigger]);

  // Handle server color choice request
  useEffect(() => {
    if (gameState?.colorChoiceRequested || (gameState?.room?.waitingForColorChoice === playerId)) {
      setShowColorPicker(true);
    }
  }, [gameState?.colorChoiceRequested, gameState?.room?.waitingForColorChoice, playerId]);

  // Handle active color updates for visual refresh
  useEffect(() => {
    if (gameState?.colorUpdate || gameState?.activeColorUpdate || gameState?.colorUpdateTimestamp) {
      console.log(`🎨 ACTIVE COLOR UPDATE DETECTED: ${gameState?.room?.currentColor}`);
      // Force component refresh when color changes
      setHandRefreshKey(prev => prev + 1);
    }
  }, [gameState?.colorUpdate, gameState?.activeColorUpdate, gameState?.colorUpdateTimestamp, gameState?.room?.currentColor]);

  const handlePlayCard = (cardIndex: number) => {
    const player = gameState?.players?.find((p: any) => p.id === playerId);
    const card = player?.hand?.[cardIndex];
    
    if (card?.type === "wild" || card?.type === "wild4") {
      // Play the wild card first, server will request color choice
      playCard(cardIndex);
    } else {
      playCard(cardIndex);
    }
  };

  const handleColorChoice = (color: string) => {
    const isGuruUserLocal = localStorage.getItem("isGuruUser") === "true";
    
    chooseColor(color);
    setShowColorPicker(false);
    
    // Clear the colorChoiceRequested flag immediately and update current color
    setGameState((prev: any) => ({
      ...prev,
      colorChoiceRequested: false,
      selectedColor: color,
      room: {
        ...prev?.room,
        currentColor: color, // Update the current color immediately for all players
        waitingForColorChoice: null // Clear waiting state
      },
      forceRefresh: Math.random(),
      colorUpdate: Date.now(), // Add color update trigger
      activeColorUpdate: Date.now() // Specific trigger for active color display
    }));
    
    // Force immediate visual refresh after color choice
    setHandRefreshKey(prev => prev + 1);
    
    // For guru/admin users - instant update, no delays
    // For regular users - use gradual refresh intervals
    if (!isGuruUserLocal) {
      setTimeout(() => setHandRefreshKey(prev => prev + 1), 1);
      setTimeout(() => setHandRefreshKey(prev => prev + 1), 5);
      setTimeout(() => setHandRefreshKey(prev => prev + 1), 10);
      setTimeout(() => setHandRefreshKey(prev => prev + 1), 20);
      setTimeout(() => setHandRefreshKey(prev => prev + 1), 30);
    }
  };

  const handleUnoCall = () => {
    const player = gameState?.players?.find((p: any) => p.id === playerId);
    if (!player?.hasCalledUno) {
      callUno();
      setHasCalledUno(true);
      // UNO call will be validated on the server and work only when playing second-to-last card
    }
  };

  // New unified end game handler - return all players to lobby as spectators
  const handleEndGameClose = async () => {
    setShowWinnerModal(false);
    setWinnerData(null);
    
    // First trigger the end-game reset on server
    if (roomId) {
      try {
        const response = await fetch(`/api/rooms/${roomId}/end-game-reset`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${playerId}`
          }
        });
        
        if (response.ok) {
          console.log("End-game reset completed - navigating to lobby");
        }
      } catch (error) {
        console.error("Failed to reset game:", error);
      }
      
      // Navigate back to room lobby
      window.location.href = `/room/${roomId}`;
    } else {
      setLocation("/");
    }
  };

  // Guru card replacement handlers
  const handleGuruCardReplace = (cardIndex: number) => {
    setSelectedCardIndex(cardIndex);
    setShowGuruReplaceModal(true);
  };

  // Host spectator assignment for active games - with robust player state handling
  const handleHostAssignSpectatorToGame = async (spectatorId: string) => {
    if (!isHost || !roomId) return;
    
    try {
      const spectator = players.find((p: any) => p.id === spectatorId);
      if (!spectator) {
        toast({
          title: "Error",
          description: "Spectator not found",
          variant: "destructive",
        });
        return;
      }
      
      console.log(`Host assigning spectator ${spectator.nickname} (${spectatorId}) to active game`);
      
      // Find available positions excluding left players and spectators
      const activeGamePlayers = players.filter((p: any) => 
        !p.isSpectator && 
        !p.hasLeft && 
        p.position !== null && 
        p.position !== undefined
      );
      const takenPositions = activeGamePlayers.map((p: any) => p.position).sort();
      
      let availablePosition = null;
      for (let i = 0; i < 4; i++) {
        if (!takenPositions.includes(i)) {
          availablePosition = i;
          break;
        }
      }
      
      if (availablePosition === null) {
        toast({
          title: "Error",
          description: "All player slots are taken",
          variant: "destructive",
        });
        return;
      }
      
      // Show assignment intent before API call
      toast({
        title: "Assigning Player",
        description: `Adding ${spectator.nickname} to position ${availablePosition + 1}...`,
      });
      
      // Use the correct endpoint based on room status
      const endpoint = room.status === 'playing' 
        ? `/api/rooms/${roomId}/assign-spectator-to-game`
        : `/api/rooms/${roomId}/assign-spectator`;
        
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${playerId}`
        },
        body: JSON.stringify({
          spectatorId,
          position: availablePosition
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        console.log(`Successfully assigned spectator ${spectator.nickname} to position ${availablePosition}`);
        toast({
          title: "Success",
          description: `${spectator.nickname} joined the game at position ${availablePosition + 1}`,
        });
      } else {
        console.error("Server error:", result.error);
        throw new Error(result.error || 'Failed to assign player');
      }
    } catch (error) {
      console.error("Error assigning spectator:", error);
      toast({
        title: "Assignment Failed", 
        description: error instanceof Error ? error.message : "Failed to assign player to game",
        variant: "destructive",
      });
    }
  };

  const handleGuruReplaceCard = async (newCard: any) => {
    if (selectedCardIndex === null || !currentPlayer) return;
    
    try {
      console.log("🔧 Guru replacing card:", {
        cardIndex: selectedCardIndex,
        newCard,
        roomId,
        playerId
      });
      
      const response = await fetch(`/api/rooms/${roomId}/guru-replace-card`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${playerId}`
        },
        body: JSON.stringify({
          cardIndex: selectedCardIndex,
          newCard: newCard
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        console.log("✅ Card replaced successfully");
        // Remove success notification as requested
        setShowGuruReplaceModal(false);
        setSelectedCardIndex(null);
        
        // Force immediate visual update - INSTANT (multiple immediate triggers)
        if (refreshGameState) {
          refreshGameState(); // Immediate refresh
          refreshGameState(); // Double immediate
          setTimeout(() => refreshGameState(), 1);
          setTimeout(() => refreshGameState(), 5);
          setTimeout(() => refreshGameState(), 10);
          setTimeout(() => refreshGameState(), 20);
          setTimeout(() => refreshGameState(), 30);
        }
        
        // Force hand re-render by updating key - INSTANT visual update (multiple immediate)
        setHandRefreshKey(prev => prev + 1);
        setHandRefreshKey(prev => prev + 1); // Double immediate
        setTimeout(() => setHandRefreshKey(prev => prev + 1), 1);
        setTimeout(() => setHandRefreshKey(prev => prev + 1), 5);
        setTimeout(() => setHandRefreshKey(prev => prev + 1), 10);
        setTimeout(() => setHandRefreshKey(prev => prev + 1), 20);
        
        // Force immediate component re-render triggers
        setHandRefreshKey(prev => prev + Math.random()); // Additional random trigger
      } else {
        console.error("❌ Server error:", result.error);
        throw new Error(result.error || 'Failed to replace card');
      }
    } catch (error) {
      console.error("❌ Error replacing card:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to replace card",
        variant: "destructive",
      });
    }
  };

  // Connection error timeout effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isConnected && (!gameState || !gameState.room)) {
        setShowConnectionError(true);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [isConnected, gameState]);

  // Enhanced loading state with connection debugging
  if (!playerId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-400 via-red-500 to-red-600 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-4">Redirecting...</div>
          <div className="text-white/80 text-sm mb-2">Please join the game properly</div>
        </div>
      </div>
    );
  }

  if (!gameState || !gameState.room) {
    console.log("🚨 WHITE PAGE DEBUG:", {
      gameState: !!gameState,
      room: !!gameState?.room,
      isConnected,
      roomId,
      playerId,
      timestamp: new Date().toISOString()
    });
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-400 via-red-500 to-red-600 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-4">Loading game...</div>
          {!isConnected && (
            <div className="text-white/80 text-sm mb-2">Connecting to server...</div>
          )}
          {showConnectionError && (
            <div className="text-white bg-red-600/80 px-4 py-2 rounded-lg">
              <div className="text-sm mb-2">Connection issue detected</div>
              <button 
                onClick={() => window.location.reload()} 
                className="bg-white text-red-600 px-3 py-1 rounded text-sm hover:bg-gray-100"
              >
                Refresh Page
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const room = gameState.room;
  const players = gameState.players || [];
  // CRITICAL: Sort by position to match server-side order for correct turn tracking
  const gamePlayers = players.filter((p: any) => !p.isSpectator).sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
  
  // Helper function for checking online status - MUST BE DEFINED BEFORE USAGE
  const isPlayerOnline = (player: any) => {
    if (!gameState?.players || !player) return false;
    // Find the player in gameState.players and check their isOnline property
    const playerData = gameState.players.find((p: any) => p.id === player.id);
    return playerData?.isOnline || false;
  };

  const currentPlayer = players.find((p: any) => p.id === playerId);
  const currentGamePlayer = gamePlayers[room.currentPlayerIndex || 0];
  const isMyTurn = currentGamePlayer?.id === playerId;
  const isPaused = room.status === "paused";
  const isHost = currentPlayer?.id === room?.hostId;
  const topCard = room.discardPile?.[0];
  const isGuruUser = localStorage.getItem("isGuruUser") === "true";
  
  // Helper function to get avatar emoji
  const getPlayerAvatar = (playerId: string, nickname: string) => {
    const savedAvatar = localStorage.getItem(`avatar_${playerId}`);
    if (savedAvatar === 'male') return '👨';
    if (savedAvatar === 'female') return '👩';
    return '👨'; // Default to male avatar instead of first letter
  };
  
  // Debug guru user status
  console.log("🔧 Guru Debug:", {
    isGuruUser,
    localStorage_isGuruUser: localStorage.getItem("isGuruUser"),
    currentPlayer: currentPlayer?.nickname,
    playerHand: currentPlayer?.hand?.length
  });
  
  // Debug spectator/viewer status
  const spectators = players.filter((p: any) => p.isSpectator);
  const onlineSpectators = spectators.filter((p: any) => isPlayerOnline(p));
  console.log("👥 Viewer Debug:", {
    totalPlayers: players.length,
    spectators: spectators.length,
    onlineSpectators: onlineSpectators.length,
    spectatorList: spectators.map((p: any) => ({
      nickname: p.nickname,
      isSpectator: p.isSpectator,
      isOnline: isPlayerOnline(p),
      hasLeft: p.hasLeft
    }))
  });
  const activePositions = room.activePositions || []; // Positions that were active when game started

  // Helper functions for circular avatar layout
  const getPlayerAtPosition = (position: number) => {
    return gamePlayers.find((player: any) => player.position === position) || null;
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden pt-16 sm:pt-20 md:pt-24">
      {/* Floating emojis */}
      {floatingEmojis.map((emoji) => (
        <div
          key={emoji.id}
          className="fixed z-50 pointer-events-none animate-bounce text-xl sm:text-2xl"
          style={{ left: emoji.x, top: emoji.y }}
        >
          {emoji.emoji}
        </div>
      ))}

      {/* Turn Indicator Banner - Shows whose turn it is to all players */}
      {room.status === "playing" && currentGamePlayer && (
        <div className={`fixed top-14 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full shadow-lg border-2 transition-all ${
          isMyTurn 
            ? 'bg-green-600 border-green-400 animate-pulse' 
            : 'bg-yellow-600 border-yellow-400'
        }`}>
          <div className="text-white font-bold text-sm text-center">
            {isMyTurn ? (
              <span>⭐ YOUR TURN - Play or Draw! ⭐</span>
            ) : (
              <span>🎮 {currentGamePlayer.nickname}'s turn</span>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="absolute top-2 left-2 right-2 sm:top-4 sm:left-4 sm:right-4 z-10">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="bg-slate-800/90 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-700/50 min-w-0">
            <div className="text-xs sm:text-sm font-medium text-white mb-1">
              Room <span className="font-mono text-blue-400">{room.code}</span>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2">
              <Users className="h-3 w-3 text-slate-400 flex-shrink-0" />
              <span className="text-xs text-slate-300">{players.length} players</span>
            </div>
          </div>

          <div className="flex space-x-1 sm:space-x-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="bg-green-900/50 border-green-700 text-green-300 hover:bg-green-800/50 p-2 sm:px-3"
              data-testid="button-share-game"
              onClick={() => {
                const baseUrl = window.location.origin;
                const joinUrl = `${baseUrl}?room=${room.code}`;
                navigator.clipboard.writeText(joinUrl).then(() => {
                  toast({
                    title: "Link Copied!",
                    description: "Room join link copied to clipboard",
                  });
                }).catch(() => {
                  toast({
                    title: "Copy Failed",
                    description: "Could not copy link",
                    variant: "destructive",
                  });
                });
              }}
            >
              <Share2 className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline sm:ml-2">Share</span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="bg-slate-800/90 border-slate-700 text-slate-300 hover:bg-slate-700 p-2 sm:px-3"
              onClick={() => setShowChat(!showChat)}
            >
              <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline sm:ml-2">Chat</span>
            </Button>
            
            <Button
              variant="outline" 
              size="sm"
              className="bg-blue-900/50 border-blue-700 text-blue-300 hover:bg-blue-800/50 px-2 sm:px-3"
              onClick={() => {
                // Direct navigation to home without confirmation
                localStorage.removeItem("currentRoomId");
                localStorage.removeItem("playerId");
                localStorage.removeItem("playerNickname");
                window.location.replace("/");
              }}
            >
              Home
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="bg-red-900/50 border-red-700 text-red-300 hover:bg-red-800/50 px-2 sm:px-3"
              onClick={() => {
                if (confirm("Are you sure you want to exit the game?")) {
                  try {
                    // Send exit message to server
                    exitGame();
                  } catch (error) {
                    console.log("Exit game message failed:", error);
                  }
                  // Clear all game-related storage
                  localStorage.removeItem("currentRoomId");
                  localStorage.removeItem("playerId");
                  localStorage.removeItem("playerNickname");
                  // Force navigation to main page
                  window.location.replace("/");
                }
              }}
            >
              Exit
            </Button>
          </div>
        </div>


      </div>







      {/* === UNO TABLE (Centered + Responsive) === */}
      <section className="relative w-full h-full flex items-center justify-center bg-transparent p-4 pb-32">
        {/* Responsive square board centered in viewport - Slightly left-shifted to prevent overlap */}
        <div
          className="relative aspect-square w-[min(80vmin,450px)] -ml-20 sm:-ml-12"
          style={{
            // Board ring radius - Attached to circle edge with proper spacing (center radius + avatar radius + gap)
            ['--r' as any]: 'calc(var(--center) / 2 + var(--avatar) / 2 + 8px)',
            // Avatar diameter (clamped for phone → desktop)
            ['--avatar' as any]: 'clamp(60px, 11vmin, 76px)',
            // Center play area size (the round table behind top card)
            ['--center' as any]: 'clamp(90px, 16vmin, 130px)',
            // Corner padding for draw pile / direction
            ['--gap' as any]: 'clamp(8px, 2vmin, 16px)',
          }}
        >
          {/* === CENTER AREA === */}
          <div className="absolute inset-0 grid place-items-center z-10">
            <div className="relative">
              {/* Circular background for center area */}
              <div
                className="absolute -z-10 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-slate-600 shadow-2xl bg-gradient-to-br from-slate-700 to-slate-800"
                style={{ width: 'var(--center)', height: 'var(--center)' }}
              />
              <div className="flex flex-col items-center space-y-2">
                {topCard ? (
                  <div className="flex flex-col items-center">
                    <GameCard card={topCard} size="small" interactive={false} onClick={() => {}} />
                    {room?.currentColor && (topCard.type === 'wild' || topCard.type === 'wild4') && (
                      <div className="flex flex-col items-center mt-2">
                        <div
                          className={`w-6 h-6 rounded-full border-2 border-white ${
                            room.currentColor === 'red'
                              ? 'bg-red-500'
                              : room.currentColor === 'yellow'
                              ? 'bg-yellow-500'
                              : room.currentColor === 'blue'
                              ? 'bg-blue-500'
                              : room.currentColor === 'green'
                              ? 'bg-green-500'
                              : 'bg-gray-500'
                          }`}
                        />
                        <span className="text-xs text-white font-bold mt-1">
                          Active: {room.currentColor}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-16 h-24 bg-gradient-to-br from-red-500 to-red-700 rounded-lg border-2 border-red-300 shadow-xl flex items-center justify-center">
                    <div className="text-white font-bold text-lg">UNO</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* === 4 AVATAR POSITIONS AROUND THE CIRCLE === */}
          {[0, 1, 2, 3].map((position) => {
            const player = getPlayerAtPosition(position);
            const isOnline = player ? isPlayerOnline(player) : false;
            const isPlayerTurn = currentGamePlayer?.id === player?.id;

            // Absolute positions using a single radius var --r - Equal distance for all avatars
            const posClass =
              position === 0
                ? 'top-[calc(50%-var(--r))] left-1/2 -translate-x-1/2 -translate-y-1/2'
                : position === 1
                ? 'left-[calc(50%+var(--r))] top-1/2 -translate-x-1/2 -translate-y-1/2'
                : position === 2
                ? 'top-[calc(50%+var(--r))] left-1/2 -translate-x-1/2 -translate-y-1/2'
                : 'left-[calc(50%-var(--r))] top-1/2 -translate-x-1/2 -translate-y-1/2';

            return (
              <div key={position} className={`absolute ${posClass} pointer-events-auto z-20`}>
                <div className="relative">
                  {player ? (
                    <div className="relative">
                      {/* Avatar Circle */}
                      <button
                        className={`rounded-full flex items-center justify-center text-white font-bold shadow-lg border-4 bg-gradient-to-br from-uno-blue to-uno-purple hover:scale-[1.04] transition-transform ${
                          isPlayerTurn ? 'border-green-400 ring-2 ring-green-400/50' : 'border-white/20'
                        }`}
                        style={{ width: 'var(--avatar)', height: 'var(--avatar)' }}
                        onClick={() => {
                          if (player.id === playerId || isHost) {
                            setSelectedAvatarPlayerId(player.id);
                            setShowAvatarSelector(true);
                          }
                        }}
                        aria-label={`${player.nickname} avatar`}
                        title={player.nickname}
                      >
                        <div className="text-2xl">{getPlayerAvatar(player.id, player.nickname)}</div>
                      </button>

                      {/* Nickname pill – position varies per slot */}
                      <div
                        className={`absolute text-xs font-semibold text-white bg-black/70 px-2 py-1 rounded-full whitespace-nowrap ${
                          position === 0 ? 'left-full top-1/2 -translate-y-1/2 ml-2'
                          : position === 1 ? 'top-full left-1/2 -translate-x-1/2 mt-2'
                          : position === 2 ? 'right-3/4 top-full mt-2'
                          : 'right-1/4 bottom-full -translate-x-1/2 mb-2'
                        }`}
                      >
                        {player.nickname}
                      </div>

                      {/* Online badge */}
                      <div
                        className={`absolute -top-1 -right-1 w-6 h-6 rounded-full border-2 border-white ${
                          isOnline ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />

                      {/* Host crown */}
                      {player.id === room?.hostId && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">👑</div>
                      )}

                      {/* Finish badge */}
                      {player.finishPosition && (
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-xs px-2 py-1 rounded-full font-bold shadow-lg">
                          {player.finishPosition === 1
                            ? '1ST'
                            : player.finishPosition === 2
                            ? '2ND'
                            : player.finishPosition === 3
                            ? '3RD'
                            : `${player.finishPosition}TH`}
                        </div>
                      )}

                      {/* Card count */}
                      {!player.finishPosition && (
                        <div className="absolute -left-2 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded-full font-bold shadow-lg">
                          {player.hand?.length || 0}
                        </div>
                      )}

                      {/* Controls */}
                      {player.id === playerId && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('Edit button clicked for player:', player.id);
                            setShowNicknameEditor(true);
                          }}
                          className={`absolute w-5 h-5 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-lg border border-white pointer-events-auto z-30 cursor-pointer ${
                            position === 0 ? '-top-7 left-1/2 -translate-x-1/2'
                            : position === 1 ? 'top-1/2 -right-7 -translate-y-1/2'
                            : position === 2 ? '-bottom-7 left-1/2 -translate-x-1/2'
                            : '-left-7 top-1/2 -translate-y-1/2'
                          }`}
                          title="Edit nickname"
                        >
                          E
                        </button>
                      )}

                      {isHost && player.id !== playerId && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('Kick button clicked for player:', player.id);
                            kickPlayer(player.id);
                          }}
                          className={`absolute w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-lg border border-white pointer-events-auto z-30 cursor-pointer ${
                            position === 0 ? '-top-7 left-1/2 -translate-x-1/2 translate-x-6'
                            : position === 1 ? 'top-1/2 -right-7 -translate-y-1/2 translate-y-6'
                            : position === 2 ? '-bottom-7 left-1/2 -translate-x-1/2 translate-x-6'
                            : '-left-7 top-1/2 -translate-y-1/2 translate-y-6'
                          }`}
                          title={isOnline ? 'Remove player' : 'Remove offline player'}
                        >
                          K
                        </button>
                      )}
                    </div>
                  ) : (
                    // Empty / joinable slot
                    <div
                      className={`rounded-full flex items-center justify-center border-4 border-white/20 ${
                        currentPlayer?.isSpectator && isPaused && activePositions.includes(position)
                          ? 'cursor-pointer hover:bg-gray-500/40 transition-colors'
                          : ''
                      } bg-gray-500/30`}
                      style={{ width: 'var(--avatar)', height: 'var(--avatar)' }}
                      onClick={() => {
                        if (currentPlayer?.isSpectator && isPaused && activePositions.includes(position)) {
                          replacePlayer(position);
                        } else if (!currentPlayer) {
                          const roomCode = room?.code;
                          if (roomCode) window.location.href = `/?room=${roomCode}&position=${position}`;
                        }
                      }}
                    >
                      <div className="text-center">
                        {(currentPlayer?.isSpectator && isPaused && activePositions.includes(position)) ||
                        (!currentPlayer && activePositions.includes(position)) ? (
                          <>
                            <div className="w-8 h-8 rounded-full bg-blue-400 mx-auto flex items-center justify-center">
                              <span className="text-white text-sm font-bold">+</span>
                            </div>
                            <div className="text-xs text-blue-400 mt-1">
                              {currentPlayer?.isSpectator ? 'Join' : 'Click to Join'}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-8 h-8 rounded-full bg-gray-400 mx-auto" />
                            <div className="text-xs text-gray-400 mt-1">Closed</div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* === DIRECTION INDICATOR (top-left of board) === */}
          {room?.direction && room?.status === 'playing' && (
            <div className="absolute z-20 top-2 left-2">
              <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full border-2 border-yellow-300 shadow-lg w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex items-center justify-center animate-pulse">
                <div className="text-white text-[9px] font-bold text-center leading-tight">
                  {room.direction === 'clockwise' ? (
                    <div className="flex flex-col items-center">
                      <span className="text-sm">↻</span>
                      <span>GAME</span>
                      <span>DIR</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <span className="text-sm">↺</span>
                      <span>GAME</span>
                      <span>DIR</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* === DRAW PILE (bottom-left of board) === */}
          <div className="absolute z-20 bottom-2 left-2">
            <div className="relative cursor-pointer group" onClick={drawCard}>
              <div className="bg-gradient-to-br from-blue-800 to-blue-900 rounded-lg border-2 border-blue-600 shadow-xl group-hover:shadow-blue-500/50 transition-all w-10 h-14 sm:w-11 sm:h-15 md:w-12 md:h-16"></div>
              <div className="bg-gradient-to-br from-blue-700 to-blue-800 rounded-lg border-2 border-blue-500 shadow-xl absolute -top-0.5 -left-0.5 w-10 h-14 sm:w-11 sm:h-15 md:w-12 md:h-16"></div>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-white font-bold text-xs">CARDS</div>
              </div>
            </div>
            <div className="text-center mt-1">
              <div className="text-blue-300 font-bold text-xs">DRAW</div>
            </div>
          </div>
        </div>
      </section>

      {/* Player Hand Area - Fixed at bottom with no space, horizontal cards for iPhone */}
      {currentPlayer && !currentPlayer.isSpectator && (
        <div className="fixed bottom-0 left-0 right-0 z-30">
          {/* Horizontal layout optimized for iPhone portrait - reserve space for R button */}
          <div className="bg-gradient-to-t from-slate-800/95 to-slate-800/90 backdrop-blur-md px-2 pb-10" style={{
            height: 'max(20vh, 120px)'
          }}>
            
            {/* Player Info Header - Horizontal layout */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm border-2 cursor-pointer hover:scale-105 transition-all ${
                    isMyTurn ? 'bg-gradient-to-br from-green-400 to-green-600 border-green-300' : 'bg-gradient-to-br from-blue-400 to-blue-600 border-blue-300'
                  }`}
                  onClick={() => {
                    setSelectedAvatarPlayerId(currentPlayer.id);
                    setShowAvatarSelector(true);
                  }}
                >
                  {getPlayerAvatar(currentPlayer.id, currentPlayer.nickname)}
                </div>
                <div className="ml-2">
                  <div className={`font-semibold text-white text-sm ${isMyTurn ? 'text-green-400' : ''}`}>
                    {currentPlayer.nickname}
                  </div>
                  <div className="text-xs text-slate-400">
                    {currentPlayer.hand?.length || 0} cards
                  </div>
                </div>
                {isMyTurn && (
                  <div className="ml-3">
                    <div className="bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs font-bold border border-green-500/30">
                      YOUR TURN ⭐
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* UNO Button - Positioned at top right for horizontal layout */}
            <div className="absolute top-2 right-2">
              <Button
                variant="outline"
                size="sm"
                className="font-bold border-2 transition-all bg-red-600 border-red-500 text-white hover:bg-red-700 animate-pulse text-xs px-2 py-1"
                onClick={handleUnoCall}
              >
                🔥 UNO! 🔥
              </Button>
            </div>

            {/* Player Cards - Horizontal layout centered at bottom */}
            <div className="overflow-x-auto overflow-y-visible px-1">
              {currentPlayer.hand && currentPlayer.hand.length > 0 ? (
                <div key={`hand-${handRefreshKey}-${gameState?.cardReplacementTrigger || 0}`} className="flex space-x-1 min-w-max h-full items-center py-1 justify-center">
                  {currentPlayer.hand.map((card: any, index: number) => (
                    <div 
                      key={index} 
                      className={`transition-all duration-200 flex-shrink-0 ${
                        isMyTurn ? 'hover:scale-105 hover:-translate-y-2 cursor-pointer' : 'opacity-60'
                      }`}
                      onClick={() => {
                        if (!isMyTurn) return;
                        handlePlayCard(index);
                      }}
                    >
                      <GameCard
                        card={card}
                        size="extra-small"
                        selected={false}
                        disabled={!isMyTurn}
                        isGuruUser={isGuruUser}
                        cardIndex={index}
                        onGuruReplace={isGuruUser ? () => {
                          setSelectedCardIndex(index);
                          setShowGuruReplaceModal(true);
                        } : undefined}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-slate-400 text-lg">No cards in hand</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Viewers Area - Extended height from home/exit buttons to 6 o'clock avatar line */}
      <div className="absolute z-20" style={{
        top: '4rem', // Start under home/exit buttons
        bottom: 'calc(50% - var(--r) + var(--avatar) / 2 + 8px)', // End at bottom edge of 6 o'clock avatar
        right: 'max(0.25rem, min(15vw, 0.75rem))', // Closer to edge on mobile
        width: 'min(18rem, 20vw)' // Original width restored
      }}>
        <div className="bg-white/90 backdrop-blur-sm rounded-xl p-3 shadow-lg h-full flex flex-col">
          <div className="text-xs font-semibold text-gray-700 mb-3 flex-shrink-0">
            Viewers ({players.filter((p: any) => p.isSpectator && isPlayerOnline(p)).length})
          </div>
          <div className="space-y-2 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {players.filter((p: any) => p.isSpectator && isPlayerOnline(p)).length > 0 ? (
              players.filter((p: any) => p.isSpectator && isPlayerOnline(p)).map((spectator: any, index: number, arr: any[]) => (
                <div key={spectator.id}>
                  <div 
                    className={`flex items-center space-x-2 p-2 rounded-lg transition-colors ${
                      isHost 
                        ? 'hover:bg-blue-50 cursor-pointer' 
                        : ''
                    }`}
                    onClick={
                      isHost
                        ? () => handleHostAssignSpectatorToGame(spectator.id)
                        : undefined
                    }
                    title={
                      isHost
                        ? "Click to assign to next available slot"
                        : ""
                    }
                  >
                    <span className="text-sm text-gray-700 truncate flex-1 font-medium">{spectator.nickname}</span>
                    {/* Show assignment indicator for host */}
                    {isHost && (
                      <div className="text-blue-600 text-sm font-bold bg-blue-100 rounded-full w-6 h-6 flex items-center justify-center">+</div>
                    )}
                  </div>
                  {/* Separator line between spectators */}
                  {index < arr.length - 1 && (
                    <hr className="border-gray-200 mx-1 my-1" />
                  )}
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-16 text-gray-400 text-xs">
                No viewers watching
              </div>
            )}
          </div>
          {/* Instructions for host - Always show if host */}
          {isHost && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="text-xs text-blue-600 text-center font-medium">
                Host Controls
              </div>
              <div className="text-xs text-gray-500 text-center mt-1">
                {players.filter((p: any) => p.isSpectator && isPlayerOnline(p)).length > 0 
                  ? "Click viewers to assign to empty slots"
                  : "Viewers will appear here when they join"
                }
              </div>
              <div className="text-xs text-gray-400 text-center">
                Available slots: {4 - players.filter((p: any) => !p.isSpectator && !p.hasLeft).length}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat Panel */}
      {showChat && (
        <ChatPanel
          messages={gameState?.messages || []}
          players={players}
          onSendMessage={sendChatMessage}
          onSendEmoji={sendEmoji}
          onClose={() => setShowChat(false)}
        />
      )}

      {/* Color Picker Modal */}
      {showColorPicker && (
        <ColorPickerModal
          onChooseColor={handleColorChoice}
          onClose={() => setShowColorPicker(false)}
        />
      )}


      


      {/* Spectator View */}
      {currentPlayer && currentPlayer.isSpectator && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-slate-800/95 to-slate-800/90 backdrop-blur-md">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-center">
              <div className="bg-slate-700/80 px-6 py-3 rounded-lg border border-slate-600">
                <div className="text-center">
                  <div className="text-slate-300 text-sm mb-2">You are watching as a spectator</div>
                  <div className="flex items-center justify-center space-x-4">
                    <div className="text-xs text-slate-400">
                      Current turn: <span className="text-green-400 font-medium">{currentGamePlayer?.nickname || 'Unknown'}</span>
                    </div>
                    {isPaused && (
                      <div className="text-xs text-orange-400 font-medium">Game Paused - Click empty slots to join!</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Host Continue Game Prompt - Only show to host */}
      {isPaused && currentPlayer?.isHost && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-40">
          <div className="bg-orange-600/90 backdrop-blur-sm px-6 py-3 rounded-lg border border-orange-500 shadow-lg">
            <div className="text-center">
              <div className="text-white text-sm font-medium mb-2">Game is paused</div>
              <div className="text-orange-200 text-xs mb-2">A player disconnected</div>
              <Button
                onClick={() => continueGame()}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm"
              >
                Continue Game
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Non-host pause message */}
      {isPaused && !currentPlayer?.isHost && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-40">
          <div className="bg-slate-600/90 backdrop-blur-sm px-6 py-3 rounded-lg border border-slate-500 shadow-lg">
            <div className="text-center">
              <div className="text-white text-sm font-medium mb-1">Game Paused</div>
              <div className="text-slate-300 text-xs">Waiting for host to continue...</div>
            </div>
          </div>
        </div>
      )}



      {/* Penalty Animation Overlay - Don't show during game end */}
      {gameState?.penaltyAnimation?.isActive && !gameState?.gameEndData && !showWinnerModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-slate-800 rounded-lg border border-slate-600 p-6 max-w-md mx-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400 mb-2 animate-pulse">⚠️ Penalty Cards</div>
              <div className="text-slate-300 mb-4 text-lg">
                {gameState.penaltyAnimation.drawnCards === 0 ? (
                  <>
                    <span className="font-semibold text-white">{gameState.penaltyAnimation.player}</span> must draw{' '}
                    <span className="text-red-400 font-bold text-2xl animate-pulse">{gameState.penaltyAnimation.totalCards}</span> cards!
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-white">{gameState.penaltyAnimation.player}</span> is drawing penalty cards...
                  </>
                )}
              </div>
              
              {/* Progress indicator */}
              <div className="bg-slate-700 rounded-full h-6 mb-4 relative overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-red-500 to-red-400 h-6 rounded-full transition-all duration-1000 ease-out relative"
                  style={{
                    width: `${(gameState.penaltyAnimation.drawnCards / gameState.penaltyAnimation.totalCards) * 100}%`
                  }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full"></div>
                </div>
              </div>
              
              <div className="text-lg font-medium text-white">
                {gameState.penaltyAnimation.drawnCards} / {gameState.penaltyAnimation.totalCards} cards
              </div>
              
              {/* Animated card stack */}
              <div className="flex justify-center mt-4">
                <div className="relative">
                  {Array.from({ length: gameState.penaltyAnimation.totalCards }, (_, i) => (
                    <div
                      key={i}
                      className={`absolute w-12 h-16 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg border border-slate-500 transition-all duration-300 ${
                        i < gameState.penaltyAnimation.drawnCards 
                          ? 'opacity-100 transform translate-y-0 scale-100' 
                          : 'opacity-30 transform translate-y-4 scale-95'
                      }`}
                      style={{
                        left: `${i * 4}px`,
                        zIndex: gameState.penaltyAnimation.totalCards - i,
                        animationDelay: `${i * 100}ms`
                      }}
                    >
                      {i < gameState.penaltyAnimation.drawnCards && (
                        <div className="w-full h-full bg-gradient-to-br from-red-400 to-red-600 rounded-lg flex items-center justify-center text-white text-xs font-bold animate-bounce">
                          <div className="animate-ping absolute w-2 h-2 bg-white rounded-full"></div>
                          ✓
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}




      {/* Winner Modal */}
      <WinnerModal
        isOpen={showWinnerModal}
        players={winnerData?.finalRankings || []}
        isSpectator={currentPlayer?.isSpectator || false}
        onClose={handleEndGameClose}
      />



      {/* Nickname Editor Modal */}
      {currentPlayer && (
        <NicknameEditor
          currentNickname={currentPlayer.nickname}
          playerId={playerId!}
          isOpen={showNicknameEditor}
          onClose={() => setShowNicknameEditor(false)}
          onNicknameChanged={(newNickname) => {
            console.log("Nickname updated to:", newNickname);
          }}
        />
      )}

      {/* Guru Card Replace Modal */}
      {showGuruReplaceModal && (
        <GuruCardReplaceModal
          isOpen={showGuruReplaceModal}
          currentCard={selectedCardIndex !== null && selectedCardIndex >= 0 ? currentPlayer?.hand?.[selectedCardIndex] : undefined}
          availableCards={room?.drawPile || []}
          onClose={() => {
            setShowGuruReplaceModal(false);
            setSelectedCardIndex(null);
          }}
          onReplaceCard={handleGuruReplaceCard}
        />
      )}

      {/* Avatar Selection Modal */}
      {showAvatarSelector && selectedAvatarPlayerId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold mb-4 text-center">Choose Avatar</h3>
            <div className="flex justify-center space-x-6">
              <button
                onClick={() => {
                  localStorage.setItem(`avatar_${selectedAvatarPlayerId}`, 'male');
                  // Broadcast avatar change to all players via WebSocket
                  sendAvatarChange(selectedAvatarPlayerId!, 'male');
                  setShowAvatarSelector(false);
                  setSelectedAvatarPlayerId(null);
                }}
                className="text-6xl hover:scale-110 transition-transform p-4 rounded-lg hover:bg-gray-100"
              >
                👨
              </button>
              <button
                onClick={() => {
                  localStorage.setItem(`avatar_${selectedAvatarPlayerId}`, 'female');
                  // Broadcast avatar change to all players via WebSocket
                  sendAvatarChange(selectedAvatarPlayerId!, 'female');
                  setShowAvatarSelector(false);
                  setSelectedAvatarPlayerId(null);
                }}
                className="text-6xl hover:scale-110 transition-transform p-4 rounded-lg hover:bg-gray-100"
              >
                👩
              </button>
            </div>
            <button
              onClick={() => {
                setShowAvatarSelector(false);
                setSelectedAvatarPlayerId(null);
              }}
              className="mt-4 w-full px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* UNO Penalty Animation */}
      {(gameState?.unoPenaltyAnimation?.show || unoPenaltyAnimation?.show) && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-red-500 to-red-700 text-white p-8 rounded-lg shadow-2xl animate-bounce max-w-lg mx-4 text-center">
            <div className="text-6xl mb-4">😱</div>
            <h2 className="text-2xl font-bold mb-2">UNO PENALTY!</h2>
            <p className="text-xl mb-4">
              {gameState?.unoPenaltyAnimation?.playerName || unoPenaltyAnimation?.playerName} forgot to call UNO!
            </p>
            <p className="text-lg opacity-90">
              Must draw 2 penalty cards for not calling UNO before playing second-to-last card
            </p>
          </div>
        </div>
      )}
    </div>
  );
}