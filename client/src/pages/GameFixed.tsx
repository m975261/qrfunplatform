import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Card as UICard, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Menu, ArrowRight, ArrowLeft, Users, MessageCircle } from "lucide-react";
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
  const playerId = localStorage.getItem("playerId");
  const { toast } = useToast();
  
  const {
    gameState,
    floatingEmojis,
    joinRoom,
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

  useEffect(() => {
    if (roomId && playerId && isConnected) {
      joinRoom(playerId, roomId);
    }
  }, [roomId, playerId, isConnected, joinRoom]);

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
    if (gameState?.colorChoiceRequested) {
      setShowColorPicker(true);
    }
  }, [gameState?.colorChoiceRequested]);

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
    chooseColor(color);
    setShowColorPicker(false);
    setPendingWildCard(null);
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

  if (!gameState || !gameState.room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-400 via-red-500 to-red-600 flex items-center justify-center">
        <div className="text-white text-xl">Loading game...</div>
      </div>
    );
  }

  const room = gameState.room;
  const players = gameState.players || [];
  const gamePlayers = players.filter((p: any) => !p.isSpectator);
  

  const currentPlayer = players.find((p: any) => p.id === playerId);
  const currentGamePlayer = gamePlayers[room.currentPlayerIndex || 0];
  const isMyTurn = currentGamePlayer?.id === playerId;
  const isPaused = room.status === "paused";
  const isHost = currentPlayer?.id === room?.hostId;
  const topCard = room.discardPile?.[0];
  const isGuruUser = localStorage.getItem("isGuruUser") === "true";
  
  // Debug guru user status
  console.log("🔧 Guru Debug:", {
    isGuruUser,
    localStorage_isGuruUser: localStorage.getItem("isGuruUser"),
    currentPlayer: currentPlayer?.nickname,
    playerHand: currentPlayer?.hand?.length
  });
  const activePositions = room.activePositions || []; // Positions that were active when game started

  // Helper functions for circular avatar layout
  const getPlayerAtPosition = (position: number) => {
    return gamePlayers.find((player: any) => player.position === position) || null;
  };

  const isPlayerOnline = (player: any) => {
    if (!gameState?.players || !player) return false;
    // Find the player in gameState.players and check their isOnline property
    const playerData = gameState.players.find((p: any) => p.id === player.id);
    return playerData?.isOnline || false;
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
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







      {/* Player Avatars - Clean Layout (No Duplicate Background) */}
      <div className="relative w-96 h-96 mx-auto mb-8">
        {/* Direction Indicator Button - Positioned between 12 and 9 o'clock */}
        {room?.direction && room?.status === 'playing' && (
          <div className="absolute top-12 left-12 z-10">
            <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full w-16 h-16 flex items-center justify-center shadow-lg border-2 border-yellow-300 animate-pulse">
              <div className="text-white text-xs font-bold text-center leading-tight">
                {room.direction === 'clockwise' ? (
                  <div className="flex flex-col items-center">
                    <span className="text-lg">↻</span>
                    <span>GAME</span>
                    <span>DIRECTION</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <span className="text-lg">↺</span>
                    <span>GAME</span>
                    <span>DIRECTION</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Center Card Play Area */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">

          <div className="flex flex-col items-center space-y-2 relative z-20">
            {topCard ? (
              <div className="flex flex-col items-center">
                <GameCard 
                  card={topCard} 
                  size="medium"
                  interactive={false}
                  onClick={() => {}}
                />
                {room?.currentColor && (topCard.type === 'wild' || topCard.type === 'draw_four') && (
                  <div className="flex flex-col items-center mt-2">
                    <div className={`w-6 h-6 rounded-full border-2 border-white ${
                      room.currentColor === 'red' ? 'bg-red-500' :
                      room.currentColor === 'yellow' ? 'bg-yellow-500' :
                      room.currentColor === 'blue' ? 'bg-blue-500' :
                      room.currentColor === 'green' ? 'bg-green-500' :
                      'bg-gray-500'
                    }`}></div>
                    <span className="text-xs text-white font-bold mt-1">Active: {room.currentColor}</span>
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

        {/* 4 Fixed Avatar Positions - Exact Lobby Layout */}
        {[0, 1, 2, 3].map((position) => {
          const player = getPlayerAtPosition(position);
          const isOnline = player ? isPlayerOnline(player) : false;
          const isPlayerTurn = currentGamePlayer?.id === player?.id;
          
          // Get position class for avatar placement - Optimized spacing for larger container
          const getPositionClass = (pos: number) => {
            const positions = [
              'top-6 left-1/2 -translate-x-1/2', // 12 o'clock - more spacing
              'right-6 top-1/2 -translate-y-1/2', // 3 o'clock - more spacing  
              'bottom-6 left-1/2 -translate-x-1/2', // 6 o'clock - more spacing
              'left-6 top-1/2 -translate-y-1/2' // 9 o'clock - more spacing
            ];
            return positions[pos] || positions[0];
          };
          
          return (
            <div
              key={position}
              className={`absolute ${getPositionClass(position)} w-20 h-20 pointer-events-auto`}
            >
                <div className="relative">
                  {player ? (
                    // Player Avatar - Simplified like lobby but with essential game features
                    <div className={`w-20 h-20 bg-gradient-to-br from-uno-blue to-uno-purple rounded-full flex flex-col items-center justify-center text-white font-bold shadow-lg border-4 cursor-pointer hover:scale-105 transition-all ${
                      isPlayerTurn ? 'border-green-400 ring-2 ring-green-400/50' : 'border-white/20'
                    }`}
                    onClick={() => {
                      setSelectedAvatarPlayerId(player.id);
                      setShowAvatarSelector(true);
                    }}
                    >
                      {/* Simplified Avatar Content - Like Lobby */}
                      <div className="text-lg">{player.nickname[0].toUpperCase()}</div>
                      <div className="text-xs font-semibold truncate max-w-full px-1 leading-tight">{player.nickname}</div>
                      
                      {/* Essential Indicators Only */}
                      <div className={`absolute -top-1 -right-1 w-6 h-6 rounded-full border-2 border-white ${
                        isOnline ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      
                      {/* Host crown */}
                      {player.id === room?.hostId && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <div className="w-6 h-6 text-yellow-400 fill-yellow-400">👑</div>
                        </div>
                      )}
                      
                      {/* Ranking badge for finished players - Simplified */}
                      {player.finishPosition && (
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-xs px-2 py-1 rounded-full font-bold shadow-lg">
                          {player.finishPosition === 1 ? '1ST' : 
                           player.finishPosition === 2 ? '2ND' : 
                           player.finishPosition === 3 ? '3RD' : 
                           `${player.finishPosition}TH`}
                        </div>
                      )}
                      
                      {/* Card count - Only if not finished */}
                      {!player.finishPosition && (
                        <div className="absolute -left-2 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded-full font-bold shadow-lg">
                          {player.hand?.length || 0}
                        </div>
                      )}
                    </div>
                  ) : (
                    // Empty Slot or Joinable Slot for Spectators - Smaller size to reduce overlap
                    <div 
                      className={`w-16 h-16 sm:w-20 sm:h-20 bg-gray-500/30 rounded-full flex items-center justify-center border-4 border-white/20 ${
                        currentPlayer?.isSpectator && isPaused && activePositions.includes(position) ? 'cursor-pointer hover:bg-gray-500/50 transition-colors' : ''
                      }`}
                      onClick={() => {
                        if (currentPlayer?.isSpectator && isPaused && activePositions.includes(position)) {
                          replacePlayer(position);
                        } else if (!currentPlayer) {
                          // External user - redirect to join flow
                          const roomCode = room?.code;
                          if (roomCode) {
                            window.location.href = `/?room=${roomCode}&position=${position}`;
                          }
                        }
                      }}
                    >
                      <div className="text-center">
                        {(currentPlayer?.isSpectator && isPaused && activePositions.includes(position)) || (!currentPlayer && activePositions.includes(position)) ? (
                          <>
                            <div className="w-8 h-8 rounded-full bg-blue-400 mx-auto flex items-center justify-center">
                              <span className="text-white text-sm font-bold">+</span>
                            </div>
                            <div className="text-xs text-blue-400 mt-1">
                              {currentPlayer?.isSpectator ? "Join" : "Click to Join"}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gray-400 mx-auto" />
                            <div className="text-xs text-gray-400 mt-1">Closed</div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  

                  
                  {/* Control Buttons Attached to Avatar */}
                  {player && (
                    <>
                      {/* Edit Button for Current Player - Bottom Right of Avatar */}
                      {player.id === playerId && (
                        <button
                          onClick={() => setShowNicknameEditor(true)}
                          className="absolute bottom-1 right-1 w-4 h-4 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-lg transition-colors border border-white"
                          title="Edit nickname"
                        >
                          E
                        </button>
                      )}
                      
                      {/* Kick Button for Host - Bottom Left of Avatar */}
                      {isHost && player.id !== playerId && (
                        <button
                          onClick={() => kickPlayer(player.id)}
                          className="absolute bottom-1 left-1 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-lg transition-colors border border-white"
                          title={isOnline ? "Remove player" : "Remove offline player"}
                        >
                          K
                        </button>
                      )}
                    </>
                  )}
                </div>
            </div>
          );
        })}

        {/* Draw Pile - Positioned outside circle but attached to it */}
        <div className="absolute bottom-4 right-4 z-20">
          <div className="relative cursor-pointer group" onClick={drawCard}>
            <div className="bg-gradient-to-br from-blue-800 to-blue-900 rounded-lg border-2 border-blue-600 shadow-xl group-hover:shadow-blue-500/50 transition-all w-12 h-16"></div>
            <div className="bg-gradient-to-br from-blue-700 to-blue-800 rounded-lg border-2 border-blue-500 shadow-xl absolute -top-0.5 -left-0.5 w-12 h-16"></div>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-white font-bold text-xs">CARDS</div>
            </div>
          </div>
          <div className="text-center mt-1">
            <div className="text-blue-300 font-bold text-xs">DRAW</div>
          </div>
        </div>
      </div>

      {/* Player Hand Area - Centered for all window sizes */}
      {currentPlayer && !currentPlayer.isSpectator && (
        <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 z-30 w-full max-w-7xl">
          {/* Use same 12x12 grid system as main game area */}
          <div className="grid grid-cols-12 grid-rows-12 gap-1 p-4 bg-gradient-to-t from-slate-800/95 to-slate-800/90 backdrop-blur-md mx-4" style={{
            height: 'max(30vh, 240px)'
          }}>
            
            {/* Player Avatar - Grid positioned */}
            <div className="col-start-1 col-end-3 row-start-1 row-end-4 flex items-center justify-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg border-3 ${
                isMyTurn ? 'bg-gradient-to-br from-green-400 to-green-600 border-green-300' : 'bg-gradient-to-br from-blue-400 to-blue-600 border-blue-300'
              }`}>
                {currentPlayer.nickname[0].toUpperCase()}
              </div>
            </div>

            {/* Player Name - Grid positioned */}
            <div className="col-start-3 col-end-7 row-start-1 row-end-3 flex items-center">
              <div>
                <div className={`font-semibold text-white text-lg ${isMyTurn ? 'text-green-400' : ''}`}>
                  {currentPlayer.nickname}
                </div>
                <div className="text-sm text-slate-400">
                  {currentPlayer.hand?.length || 0} cards
                </div>
              </div>
            </div>

            {/* YOUR TURN Indicator - Grid positioned */}
            {isMyTurn && (
              <div className="col-start-7 col-end-10 row-start-1 row-end-3 flex items-center">
                <div className="bg-green-500/20 text-green-400 px-3 py-2 rounded-full text-sm font-bold border border-green-500/30">
                  YOUR TURN ⭐
                </div>
              </div>
            )}

            {/* UNO Button - Grid positioned */}
            <div className="col-start-10 col-end-13 row-start-1 row-end-4 flex items-center justify-center">
              <Button
                variant="outline"
                size="lg"
                className="font-bold border-2 transition-all bg-red-600 border-red-500 text-white hover:bg-red-700 animate-pulse text-sm px-4 py-3 w-full h-full"
                onClick={handleUnoCall}
              >
                🔥 UNO! 🔥
              </Button>
            </div>

            {/* Player Cards - Centered under YOUR TURN indicator */}
            <div className="col-start-1 col-end-13 row-start-4 row-end-13 overflow-x-auto overflow-y-visible px-2 py-4">
              {currentPlayer.hand && currentPlayer.hand.length > 0 ? (
                <div key={`hand-${handRefreshKey}-${gameState?.cardReplacementTrigger || 0}`} className="flex space-x-3 min-w-max h-full items-start pt-2 justify-center">
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
                        size="medium"
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

      {/* Spectators Area - Dynamic positioning to prevent overlap */}
      {players.filter((p: any) => p.isSpectator && p.isOnline).length > 0 && (
        <div className="absolute top-16 sm:top-20 z-20" style={{
          right: 'max(0.5rem, min(20vw, 1rem))', // Dynamic right positioning
          maxWidth: 'min(20rem, 25vw)' // Dynamic max width
        }}>
          <div className="bg-white/90 backdrop-blur-sm rounded-xl p-2 sm:p-3 shadow-lg">
            <div className="text-xs font-semibold text-gray-700 mb-2">
              Spectators ({players.filter((p: any) => p.isSpectator && p.isOnline).length})
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {players.filter((p: any) => p.isSpectator && p.isOnline).map((spectator: any, index: number, arr: any[]) => (
                <div key={spectator.id}>
                  <div 
                    className={`flex items-center space-x-2 p-1.5 rounded transition-colors ${
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
                    <div className="w-3 h-3 sm:w-4 sm:h-4 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                      {spectator.nickname?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-xs text-gray-600 truncate flex-1">{spectator.nickname}</span>
                    {/* Show assignment indicator for host */}
                    {isHost && (
                      <div className="text-blue-600 text-xs font-medium">+</div>
                    )}
                  </div>
                  {/* Separator line between spectators */}
                  {index < arr.length - 1 && (
                    <hr className="border-gray-200 mx-1 my-1" />
                  )}
                </div>
              ))}
            </div>
            {/* Instructions for host */}
            {isHost && players.filter((p: any) => p.isSpectator && p.isOnline).length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <div className="text-xs text-blue-600 text-center font-medium">
                  Host Controls
                </div>
                <div className="text-xs text-gray-500 text-center mt-1">
                  Click spectators to assign to empty slots
                </div>
                <div className="text-xs text-gray-400 text-center">
                  Available slots: {4 - players.filter((p: any) => !p.isSpectator && !p.hasLeft).length}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
                  if (gameState?.room?.id) {
                    fetch(`/api/rooms/${gameState.room.id}/avatar`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ playerId: selectedAvatarPlayerId, gender: 'male' })
                    });
                  }
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
                  if (gameState?.room?.id) {
                    fetch(`/api/rooms/${gameState.room.id}/avatar`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ playerId: selectedAvatarPlayerId, gender: 'female' })
                    });
                  }
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