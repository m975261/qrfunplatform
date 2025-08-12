import { useEffect, useState } from "react";
import { useRoute } from "wouter";
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
import { GameDirectionIndicator } from "@/components/game/GameDirectionIndicator";
import { WinnerModal } from "@/components/game/WinnerModal";

export default function Game() {
  const [, params] = useRoute("/game/:roomId");
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
    isConnected
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

  useEffect(() => {
    if (roomId && playerId && isConnected) {
      joinRoom(playerId, roomId);
    }
  }, [roomId, playerId, isConnected, joinRoom]);

  useEffect(() => {
    if (gameState?.gameEndData) {
      setWinnerData(gameState.gameEndData);
      setShowWinnerModal(true);
    }
    
    if (gameState?.needsContinue) {
      setShowContinuePrompt(true);
    }
  }, [gameState?.gameEndData, gameState?.needsContinue, playerId]);

  const handlePlayCard = (cardIndex: number) => {
    const player = gameState?.players?.find((p: any) => p.id === playerId);
    const card = player?.hand?.[cardIndex];
    
    if (card?.type === "wild" || card?.type === "wild4") {
      setPendingWildCard(cardIndex);
      setShowColorPicker(true);
    } else {
      playCard(cardIndex);
    }
  };

  const handleColorChoice = (color: string) => {
    chooseColor(color);
    if (pendingWildCard !== null) {
      playCard(pendingWildCard);
      setPendingWildCard(null);
    }
    setShowColorPicker(false);
  };

  const handleUnoCall = () => {
    const player = gameState?.players?.find((p: any) => p.id === playerId);
    if (!player?.hasCalledUno) {
      callUno();
      setHasCalledUno(true);
      // UNO call will be validated on the server and work only when playing second-to-last card
    }
  };

  const handlePlayAgain = () => {
    setShowWinnerModal(false);
    playAgain();
    localStorage.removeItem("currentRoomId");
    localStorage.removeItem("playerId");
    localStorage.removeItem("playerNickname");
    window.location.reload();
  };

  const handleGoHome = () => {
    setShowWinnerModal(false);
    localStorage.removeItem("currentRoomId");
    localStorage.removeItem("playerId");
    localStorage.removeItem("playerNickname");
    window.location.href = '/';
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

  const getPositionStyle = (position: number) => {
    // Calculate circular positions attached to main circle edge
    // Main circle radius + avatar radius for perfect attachment
    const mainCircleRadius = 'max(4.5rem, min(10vw, 10vh))'; // Half of main circle size
    const avatarRadius = 'max(2rem, min(4vw, 4vh))'; // Half of avatar size
    const totalRadius = `calc(${mainCircleRadius} + ${avatarRadius})`; // Distance from center to avatar center
    
    const positions = [
      { // 12 o'clock - top
        top: `calc(50% - ${totalRadius})`,
        left: '50%',
        transform: 'translate(-50%, -50%)'
      },
      { // 3 o'clock - right
        top: '50%',
        left: `calc(50% + ${totalRadius})`,
        transform: 'translate(-50%, -50%)'
      },
      { // 6 o'clock - bottom
        top: `calc(50% + ${totalRadius})`,
        left: '50%',
        transform: 'translate(-50%, -50%)'
      },
      { // 9 o'clock - left
        top: '50%',
        left: `calc(50% - ${totalRadius})`,
        transform: 'translate(-50%, -50%)'
      }
    ];
    return positions[position] || positions[0];
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

      {/* Central Game Area - Fully responsive with viewport units */}
      <div className="absolute inset-0 flex items-center justify-center" style={{
        paddingBottom: 'max(20vh, 160px)',  // Responsive bottom padding
        paddingTop: 'max(8vh, 64px)'        // Responsive top padding
      }}>
        <div className="relative">
          {/* Draw Pile - Viewport responsive positioning */}
          <div className="absolute z-10" style={{
            bottom: 'max(-3rem, -8vh)',
            right: 'max(-5rem, -12vw)',
          }}>
            <div className="relative cursor-pointer group" onClick={drawCard}>
              <div className="bg-gradient-to-br from-blue-800 to-blue-900 rounded-lg border-2 border-blue-600 shadow-xl group-hover:shadow-blue-500/50 transition-all" 
                   style={{
                     width: 'max(2rem, 6vw)',
                     height: 'max(3rem, 8vh)',
                     minWidth: '32px',
                     minHeight: '48px'
                   }}></div>
              <div className="bg-gradient-to-br from-blue-700 to-blue-800 rounded-lg border-2 border-blue-500 shadow-xl absolute -top-0.5 -left-0.5"
                   style={{
                     width: 'max(2rem, 6vw)',
                     height: 'max(3rem, 8vh)',
                     minWidth: '32px',
                     minHeight: '48px'
                   }}></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-white font-bold" style={{fontSize: 'min(0.75rem, 2.5vw)'}}>Cards</div>
              </div>
            </div>
            <div className="text-center mt-1 text-blue-300 font-bold" style={{fontSize: 'min(0.75rem, 2vw)'}}>DRAW</div>
          </div>

          {/* Game Circle - Fully viewport responsive */}
          <div className="rounded-full bg-gradient-to-br from-slate-700 via-slate-600 to-slate-700 shadow-2xl flex items-center justify-center relative border-4 border-slate-500/50" 
               style={{
                 width: 'max(9rem, min(20vw, 20vh))',
                 height: 'max(9rem, min(20vw, 20vh))',
                 minWidth: '144px',
                 minHeight: '144px'
               }}>
            
            {/* Inner Circle - Viewport responsive sizing */}
            <div className="rounded-full bg-gradient-to-br from-slate-600 to-slate-700 shadow-inner flex items-center justify-center relative border-2 border-slate-400/30"
                 style={{
                   width: 'max(6rem, min(14vw, 14vh))',
                   height: 'max(6rem, min(14vw, 14vh))',
                   minWidth: '96px',
                   minHeight: '96px'
                 }}>
              


              {/* Current Card */}
              <div className="flex flex-col items-center">
                {topCard ? (
                  <div className="flex flex-col items-center">
                    <GameCard 
                      card={topCard} 
                      size="small"
                      interactive={false}
                      onClick={() => {}}
                    />
                    {/* Current Color Indicator for Wild Cards - Responsive */}
                    {room.currentColor && (topCard?.type === 'wild' || topCard?.type === 'wild4') && (
                      <div className="mt-1 sm:mt-2 px-2 sm:px-3 py-1 bg-slate-800/90 rounded-full border border-slate-600">
                        <div className="flex items-center space-x-1 sm:space-x-2">
                          <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full border border-white shadow-lg ${
                            room.currentColor === 'red' ? 'bg-red-500' :
                            room.currentColor === 'blue' ? 'bg-blue-500' :
                            room.currentColor === 'green' ? 'bg-green-500' :
                            'bg-yellow-500'
                          }`}></div>
                          <span className="text-xs sm:text-xs text-white font-bold">Play {room.currentColor}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-10 h-14 md:w-12 md:h-16 bg-gradient-to-br from-red-500 to-red-700 rounded-lg border-2 border-white shadow-xl flex items-center justify-center">
                    <div className="text-white font-bold text-xs">?</div>
                  </div>
                )}
              </div>


            </div>
          </div>
        </div>
      </div>



      {/* Player Avatars in Circular Layout - Fully viewport responsive */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{
        paddingBottom: 'max(20vh, 160px)',
        paddingTop: 'max(8vh, 64px)'
      }}>
        <div className="relative" style={{
          width: 'max(20rem, min(40vw, 40vh))',
          height: 'max(25rem, min(50vw, 50vh))',
          minWidth: '320px',
          minHeight: '400px'
        }}>
          

          {/* 4 Fixed Avatar Positions */}
          {[0, 1, 2, 3].map((position) => {
            const player = getPlayerAtPosition(position);
            const isOnline = player ? isPlayerOnline(player) : false;
            const isPlayerTurn = currentGamePlayer?.id === player?.id;
            
            return (
              <div
                key={position}
                className="absolute pointer-events-auto"
                style={getPositionStyle(position)}
              >
                <div className="relative">
                  {player ? (
                    // Player Avatar - Viewport responsive sizing
                    <div className={`bg-gradient-to-br from-uno-blue to-uno-purple rounded-full flex flex-col items-center justify-center text-white font-bold shadow-lg border-4 ${
                      isPlayerTurn ? 'border-green-400 ring-2 ring-green-400/50' : 'border-white/20'
                    }`}
                    style={{
                      width: 'max(4rem, min(8vw, 8vh))',
                      height: 'max(4rem, min(8vw, 8vh))',
                      minWidth: '64px',
                      minHeight: '64px'
                    }}>
                      <div className="text-sm sm:text-lg">{player.nickname[0].toUpperCase()}</div>
                      <div className="text-xs font-semibold truncate max-w-full px-1 leading-tight">{player.nickname}</div>
                      {/* Online/Offline indicator - Responsive */}
                      <div className={`absolute -top-1 -right-1 w-4 h-4 sm:w-6 sm:h-6 rounded-full border-1 sm:border-2 border-white ${
                        isOnline ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      {/* Host crown - Responsive */}
                      {player.id === room?.hostId && (
                        <div className="absolute -top-2 sm:-top-3 left-1/2 -translate-x-1/2">
                          <div className="text-lg sm:text-xl text-yellow-400">👑</div>
                        </div>
                      )}
                      {/* Ranking badge for finished players */}
                      {player.finishPosition && (
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black text-xs px-2 py-1 rounded-full font-bold border-2 border-yellow-400 shadow-lg">
                          {player.finishPosition === 1 ? '1ST' : 
                           player.finishPosition === 2 ? '2ND' : 
                           player.finishPosition === 3 ? '3RD' : 
                           `${player.finishPosition}TH`}
                        </div>
                      )}
                      {/* Card count - Positioned on left side to avoid name overlap, only show if player hasn't finished */}
                      {!player.finishPosition && (
                        <div className="absolute -left-2 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-xs px-1 sm:px-2 py-0.5 sm:py-1 rounded-full font-bold border border-slate-600 shadow-lg">
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
        </div>
      </div>

      {/* Legacy player rendering - keeping for compatibility but hiding */}
      <div className="hidden">
        {gamePlayers.filter((player: any) => player.id !== playerId && !player.isSpectator).map((player: any, index: number) => {
        const filteredIndex = gamePlayers.filter((p: any) => p.id !== playerId && !p.isSpectator).indexOf(player);
        
        // Position players at clock positions: 12, 3, 6, 9 o'clock
        const positions = [
          "top-4 left-1/2 transform -translate-x-1/2",     // 12 o'clock
          "top-1/2 right-4 transform -translate-y-1/2",    // 3 o'clock  
          "bottom-20 left-1/2 transform -translate-x-1/2"  // 6 o'clock (above player hand)
        ];
        
        const positionClass = positions[filteredIndex] || "top-1/2 left-4 transform -translate-y-1/2"; // 9 o'clock fallback
        const isPlayerTurn = currentGamePlayer?.id === player.id;

        return (
          <div key={player.id} className={`absolute z-20 ${positionClass}`}>
            <div className={`bg-slate-800/95 backdrop-blur-sm rounded-lg p-2 shadow-lg border min-w-[120px] ${
              isPlayerTurn ? 'border-green-400 ring-1 ring-green-400/50' : 'border-slate-600'
            }`}>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${
                    isPlayerTurn ? 'bg-gradient-to-br from-green-400 to-green-600' : 'bg-gradient-to-br from-blue-400 to-blue-600'
                  }`}>
                    {player.nickname?.[0]?.toUpperCase()}
                  </div>
                  {/* Online/Offline status indicator */}
                  <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-800 ${
                    player.isOnline !== false ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  {isPlayerTurn && (
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-medium text-xs truncate ${
                    isPlayerTurn ? 'text-green-400' : 'text-white'
                  }`}>
                    {player.nickname}
                  </div>
                  <div className="text-xs text-slate-400">{player.hand?.length || 0} cards</div>
                  <div className="text-xs">
                    <span className={`${
                      player.isOnline !== false ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {player.isOnline !== false ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
        })}
      </div>

      {/* Player Hand Bar - Compact design at bottom */}
      {currentPlayer && !currentPlayer.isSpectator && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-slate-800/95 to-slate-800/90 backdrop-blur-md">
          <div className="container mx-auto px-2 sm:px-4 py-1.5 sm:py-2">
            {/* Compact Player Info and UNO Button */}
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <div className="flex items-center space-x-2">
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                  isMyTurn ? 'bg-gradient-to-br from-green-400 to-green-600 ring-1 ring-green-400' : 'bg-gradient-to-br from-blue-400 to-blue-600'
                }`}>
                  {currentPlayer.nickname[0].toUpperCase()}
                </div>
                <div>
                  <div className={`font-semibold text-white text-sm ${isMyTurn ? 'text-green-400' : ''}`}>
                    {currentPlayer.nickname} {isMyTurn && '⭐'}
                  </div>
                  <div className="text-xs text-slate-400">
                    {currentPlayer.hand?.length || 0} cards
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {isMyTurn && (
                  <div className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full text-xs font-bold border border-green-500/30">
                    YOUR TURN
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="font-bold border-2 transition-all bg-red-600 border-red-500 text-white hover:bg-red-700 animate-pulse text-xs px-2 py-1"
                  onClick={handleUnoCall}
                >
                  🔥 UNO! 🔥
                </Button>
              </div>
            </div>
            
            {/* Compact Card Display */}
            <div className="overflow-x-auto">
              {currentPlayer.hand && currentPlayer.hand.length > 0 ? (
                <div className="flex space-x-1 pb-1 min-w-max">
                  {currentPlayer.hand.map((card: any, index: number) => (
                    <div 
                      key={index} 
                      className={`transition-all duration-200 flex-shrink-0 ${
                        isMyTurn ? 'hover:scale-105 hover:-translate-y-1 cursor-pointer' : 'opacity-60'
                      }`}
                    >
                      <GameCard 
                        card={card}
                        size="extra-small"
                        interactive={isMyTurn}
                        disabled={!isMyTurn}
                        onClick={() => isMyTurn && handlePlayCard(index)}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-slate-400 text-sm py-2">No cards in hand</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Spectators Area - Responsive positioning */}
      {players.filter((p: any) => p.isSpectator && p.isOnline).length > 0 && (
        <div className="absolute top-16 sm:top-20 right-2 sm:right-4 z-20">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl p-2 sm:p-3 shadow-lg max-w-xs">
            <div className="text-xs font-semibold text-gray-700 mb-2">Spectators:</div>
            <div className="space-y-1">
              {players.filter((p: any) => p.isSpectator && p.isOnline).map((spectator: any) => (
                <div key={spectator.id} className="flex items-center space-x-2">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                    {spectator.nickname?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-xs text-gray-600 truncate">{spectator.nickname}</span>
                </div>
              ))}
            </div>
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

      {/* Host Continue Game Prompt */}
      {isPaused && isHost && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-40">
          <div className="bg-orange-600/90 backdrop-blur-sm px-6 py-3 rounded-lg border border-orange-500 shadow-lg">
            <div className="text-center">
              <div className="text-white text-sm font-medium mb-2">Game is paused</div>
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



      {/* Penalty Animation Overlay - Don't show during game end */}
      {gameState?.penaltyAnimation?.isActive && !gameState?.gameEndData && (
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

      {/* Game Direction Indicator */}
      <GameDirectionIndicator 
        direction={room?.direction || 'clockwise'}
        isVisible={!!room?.direction && room?.status === 'playing'}
      />

      {/* Winner Modal */}
      <WinnerModal
        isOpen={showWinnerModal}
        players={winnerData?.finalRankings || []}
        isSpectator={currentPlayer?.isSpectator || false}
        onPlayAgain={handlePlayAgain}
        onGoHome={handleGoHome}
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
    </div>
  );
}