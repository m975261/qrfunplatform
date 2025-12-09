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
  const [unoMessage, setUnoMessage] = useState<string | null>(null);
  const [oneCardMessage, setOneCardMessage] = useState<string | null>(null);
  const [turnFinishedMessage, setTurnFinishedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (roomId && playerId && isConnected) {
      joinRoom(playerId, roomId);
    }
  }, [roomId, playerId, isConnected, joinRoom]);

  // Handle UNO message animation
  useEffect(() => {
    if (gameState?.unoMessage) {
      setUnoMessage(gameState.unoMessage);
      // Clear local message after animation
      setTimeout(() => {
        setUnoMessage(null);
      }, 3000);
    }
  }, [gameState?.unoMessage]);

  // Handle "1 card left" message
  useEffect(() => {
    if (gameState?.oneCardMessage) {
      setOneCardMessage(gameState.oneCardMessage);
      setTimeout(() => {
        setOneCardMessage(null);
      }, 2500);
    }
  }, [gameState?.oneCardMessageTimestamp]);

  // Handle "turn finished" message
  useEffect(() => {
    if (gameState?.turnFinishedMessage) {
      setTurnFinishedMessage(gameState.turnFinishedMessage);
      setTimeout(() => {
        setTurnFinishedMessage(null);
      }, 1500);
    }
  }, [gameState?.turnFinishedTimestamp]);



  useEffect(() => {
    console.log("🏆 Game state changed:", {
      roomStatus: gameState?.room?.status,
      hasGameEndData: !!gameState?.gameEndData,
      gameEndData: gameState?.gameEndData,
      showGameEnd,
      needsContinue: gameState?.needsContinue
    });
    
    if (gameState?.room?.status === "finished") {
      console.log("🏆 Room status is finished - setting showGameEnd to true");
      setShowGameEnd(true);
    }
    
    if (gameState?.gameEndData) {
      console.log("🏆 GameEndData found - setting modal data and show", gameState.gameEndData);
      setGameEndData(gameState.gameEndData);
      setShowGameEnd(true);
    }
    
    if (gameState?.needsContinue) {
      setShowContinuePrompt(true);
    }
  }, [gameState?.room?.status, gameState?.gameEndData, gameState?.needsContinue]);

  // Handle server color choice request to prevent double triggers
  useEffect(() => {
    if (gameState?.colorChoiceRequested || gameState?.showColorPicker) {
      setShowColorPicker(true);
    }
  }, [gameState?.colorChoiceRequested, gameState?.showColorPicker]);

  const handlePlayCard = (cardIndex: number) => {
    const player = gameState?.players?.find((p: any) => p.id === playerId);
    const card = player?.hand?.[cardIndex];
    
    if (card?.type === "wild" || card?.type === "wild4") {
      // For wild cards, play immediately and let server request color choice
      // This prevents double color picker trigger
      playCard(cardIndex);
    } else {
      playCard(cardIndex);
    }
  };

  const handleColorChoice = (color: string) => {
    chooseColor(color);
    // Clear local color picker state to prevent double trigger
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

  // Helper function for responsive card sizes
  const getCardSize = () => {
    return "md"; // Default medium size for Game.tsx
  };

  const handlePlayCardWithUnoCheck = (cardIndex: number) => {
    const player = gameState?.players?.find((p: any) => p.id === playerId);
    
    // UNO penalty is now handled server-side when playing cards
    // Normal card play
    handlePlayCard(cardIndex);
  };

  if (!gameState || !gameState.room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-uno-blue via-uno-purple to-uno-red flex items-center justify-center">
        <div className="text-white text-xl">Loading game...</div>
      </div>
    );
  }

  const room = gameState.room;
  const players = gameState.players || [];
  const gamePlayers = players.filter((p: any) => !p.isSpectator).sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
  const spectators = players.filter((p: any) => p.isSpectator && p.isOnline);
  const currentPlayer = players.find((p: any) => p.id === playerId);
  const currentGamePlayer = gamePlayers[room.currentPlayerIndex || 0];
  const isMyTurn = currentGamePlayer?.id === playerId;
  const topCard = room.discardPile?.[0];

  // Timer countdown - only for current player's turn
  useEffect(() => {
    if (gameState?.room?.status === "playing" && isMyTurn) {
      const interval = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            // Auto draw card and pass turn when timer expires
            drawCard();
            return 30;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(interval);
    } else if (!isMyTurn) {
      setTimer(30); // Reset timer when it's not your turn
    }
  }, [gameState?.room?.status, isMyTurn, drawCard]);

  // Arrange players for display (current player at bottom)
  const getPlayersArranged = () => {
    const currentPlayerIndex = gamePlayers.findIndex((p: any) => p.id === playerId);
    if (currentPlayerIndex === -1) return gamePlayers;
    
    const arranged = [...gamePlayers];
    const currentPlayerData = arranged.splice(currentPlayerIndex, 1)[0];
    arranged.push(currentPlayerData);
    
    return arranged;
  };

  const arrangedPlayers = getPlayersArranged();

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-red-500 to-red-600 relative overflow-hidden">
      {/* Floating Emojis */}
      <div className="absolute inset-0 pointer-events-none z-50">
        {floatingEmojis.map((emoji) => (
          <div
            key={emoji.id}
            className="absolute text-3xl animate-bounce-gentle"
            style={{ left: emoji.x, top: emoji.y }}
          >
            {emoji.emoji}
          </div>
        ))}
      </div>

      {/* UNO Call Animation - Enhanced for all players */}
      {(unoMessage || gameState?.unoMessage) && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          <div className="bg-gradient-to-r from-uno-red via-red-500 to-orange-500 text-white text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold px-6 py-4 rounded-full shadow-2xl border-4 border-white animate-bounce transform scale-110">
            <div className="flex items-center space-x-3">
              <span className="animate-pulse">🔥</span>
              <span className="animate-pulse">{unoMessage || gameState?.unoMessage} says UNO!</span>
              <span className="animate-pulse">🔥</span>
            </div>
          </div>
        </div>
      )}

      {/* False UNO Penalty Message */}
      {gameState?.falseUnoMessage && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          <div className="bg-gradient-to-r from-red-600 via-red-500 to-orange-500 text-white text-xl sm:text-2xl md:text-3xl font-bold px-6 py-4 rounded-2xl shadow-2xl border-4 border-white animate-bounce">
            <div className="flex items-center space-x-3">
              <span className="animate-pulse">❌</span>
              <span>{gameState.falseUnoMessage}</span>
              <span className="animate-pulse">❌</span>
            </div>
          </div>
        </div>
      )}

      {/* One Card Left Message */}
      {oneCardMessage && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 pointer-events-none z-40">
          <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-xl md:text-2xl font-bold px-6 py-3 rounded-full shadow-xl border-3 border-white animate-pulse">
            <div className="flex items-center space-x-2">
              <span>⚠️</span>
              <span>{oneCardMessage}</span>
              <span>⚠️</span>
            </div>
          </div>
        </div>
      )}

      {/* Turn Finished Message */}
      {turnFinishedMessage && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 pointer-events-none z-30">
          <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-lg font-medium px-4 py-2 rounded-lg shadow-lg animate-fade-in-out">
            <div className="flex items-center space-x-2">
              <span>✅</span>
              <span>{turnFinishedMessage}</span>
            </div>
          </div>
        </div>
      )}



      {/* Your Turn Message - Positioned above player hand cards */}
      {isMyTurn && (
        <div className="hidden md:flex fixed bottom-32 lg:bottom-36 xl:bottom-40 left-1/2 transform -translate-x-1/2 pointer-events-none z-30">
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white text-lg lg:text-xl font-bold px-6 py-3 rounded-full shadow-xl border-3 border-white animate-pulse">
            <div className="flex items-center space-x-2">
              <span>⭐</span>
              <span>YOUR TURN!</span>
              <span>⭐</span>
            </div>
          </div>
        </div>
      )}

      {/* Mobile/Desktop Responsive Header */}
      <div className="absolute top-2 md:top-4 left-2 md:left-4 right-2 md:right-4 z-10">
        <div className="flex items-center justify-between">
          <div className="bg-white/95 backdrop-blur-sm px-2 md:px-4 py-2 rounded-xl shadow-lg">
            <div className="text-xs md:text-sm font-medium text-gray-800">
              Room <span className="font-mono text-uno-blue">{room.code}</span>
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-sm px-2 md:px-4 py-2 rounded-xl shadow-lg">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full animate-pulse ${isMyTurn ? 'bg-green-500' : 'bg-orange-500'}`}></div>
              <span className="font-mono font-medium text-orange-600 text-xs md:text-sm">
                {timer}s
              </span>
            </div>
          </div>

          <div className="flex space-x-1">
            <Button
              variant="outline"
              size="sm"
              className="bg-white/95 backdrop-blur-sm p-2"
              onClick={() => setShowChat(!showChat)}
            >
              <Menu className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="bg-red-50 hover:bg-red-100 border-red-200 text-red-700 text-xs p-2"
              onClick={() => {
                if (confirm("Are you sure you want to exit the game? You will be ranked last.")) {
                  exitGame();
                }
              }}
            >
              Exit
            </Button>
          </div>
        </div>
      </div>

      {/* Responsive Player Areas Around Circle */}
      {/* Top Player */}
      {arrangedPlayers.length > 1 && (
        <div className="absolute top-16 md:top-20 left-1/2 transform -translate-x-1/2 z-20">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl p-2 md:p-3 shadow-lg max-w-xs">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs md:text-sm">
                {arrangedPlayers[arrangedPlayers.length - 2]?.nickname?.[0]?.toUpperCase()}
              </div>
              <div>
                <div className={`font-semibold text-xs md:text-sm text-gray-800 ${currentGamePlayer?.id === arrangedPlayers[arrangedPlayers.length - 2]?.id ? 'text-red-600 animate-pulse' : ''}`}>
                  {arrangedPlayers[arrangedPlayers.length - 2]?.nickname} {currentGamePlayer?.id === arrangedPlayers[arrangedPlayers.length - 2]?.id && '⭐'}
                </div>
                <div className="text-xs text-gray-500">{arrangedPlayers[arrangedPlayers.length - 2]?.hand?.length || 0} cards</div>
              </div>
            </div>
            <div className="flex justify-center space-x-1">
              {Array(Math.min(arrangedPlayers[arrangedPlayers.length - 2]?.hand?.length || 0, 10)).fill(null).map((_, i) => (
                <div key={i} className="w-3 h-4 md:w-4 md:h-6 bg-gradient-to-br from-gray-700 to-gray-900 rounded border border-white shadow-sm transform rotate-2 hover:rotate-0 transition-transform"></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Left Player */}
      {arrangedPlayers.length > 2 && (
        <div className="absolute left-2 md:left-4 top-1/2 transform -translate-y-1/2 z-20">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl p-2 md:p-3 shadow-lg max-w-xs">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white font-bold text-xs md:text-sm">
                {arrangedPlayers[arrangedPlayers.length - 3]?.nickname?.[0]?.toUpperCase()}
              </div>
              <div>
                <div className={`font-semibold text-xs md:text-sm text-gray-800 ${currentGamePlayer?.id === arrangedPlayers[arrangedPlayers.length - 3]?.id ? 'text-red-600 animate-pulse' : ''}`}>
                  {arrangedPlayers[arrangedPlayers.length - 3]?.nickname} {currentGamePlayer?.id === arrangedPlayers[arrangedPlayers.length - 3]?.id && '⭐'}
                </div>
                <div className="text-xs text-gray-500">{arrangedPlayers[arrangedPlayers.length - 3]?.hand?.length || 0} cards</div>
              </div>
            </div>
            <div className="flex flex-col items-center space-y-1">
              {Array(Math.min(arrangedPlayers[arrangedPlayers.length - 3]?.hand?.length || 0, 8)).fill(null).map((_, i) => (
                <div key={i} className="w-4 h-3 md:w-6 md:h-4 bg-gradient-to-br from-gray-700 to-gray-900 rounded border border-white shadow-sm transform rotate-90"></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Right Player */}
      {arrangedPlayers.length > 3 && (
        <div className="absolute right-2 md:right-4 top-1/2 transform -translate-y-1/2 z-20">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl p-2 md:p-3 shadow-lg max-w-xs">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center text-white font-bold text-xs md:text-sm">
                {arrangedPlayers[arrangedPlayers.length - 4]?.nickname?.[0]?.toUpperCase()}
              </div>
              <div>
                <div className={`font-semibold text-xs md:text-sm text-gray-800 ${currentGamePlayer?.id === arrangedPlayers[arrangedPlayers.length - 4]?.id ? 'text-red-600 animate-pulse' : ''}`}>
                  {arrangedPlayers[arrangedPlayers.length - 4]?.nickname} {currentGamePlayer?.id === arrangedPlayers[arrangedPlayers.length - 4]?.id && '⭐'}
                </div>
                <div className="text-xs text-gray-500">{arrangedPlayers[arrangedPlayers.length - 4]?.hand?.length || 0} cards</div>
              </div>
            </div>
            <div className="flex flex-col items-center space-y-1">
              {Array(Math.min(arrangedPlayers[arrangedPlayers.length - 4]?.hand?.length || 0, 8)).fill(null).map((_, i) => (
                <div key={i} className="w-4 h-3 md:w-6 md:h-4 bg-gradient-to-br from-gray-700 to-gray-900 rounded border border-white shadow-sm transform -rotate-90"></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Circular Game Area - Responsive */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          {/* Main Game Circle */}
          <div className="w-40 h-40 sm:w-48 sm:h-48 md:w-64 md:h-64 lg:w-80 lg:h-80 rounded-full bg-gradient-to-br from-yellow-300 via-orange-400 to-red-500 shadow-2xl flex items-center justify-center relative border-4 border-white/30">
            
            {/* Inner Circle */}
            <div className="w-28 h-28 sm:w-32 sm:h-32 md:w-40 md:h-40 lg:w-48 lg:h-48 rounded-full bg-gradient-to-br from-yellow-200 to-orange-300 shadow-inner flex items-center justify-center relative border-2 border-white/50">
              
              {/* Draw Pile - Left Side */}
              <div className="absolute -left-6 sm:-left-8 md:-left-12 top-1/2 transform -translate-y-1/2">
                <div className="relative cursor-pointer" onClick={drawCard}>
                  <div className="w-8 h-12 sm:w-10 sm:h-14 md:w-14 md:h-18 bg-gradient-to-br from-blue-800 to-blue-900 rounded-lg border-2 border-white shadow-xl"></div>
                  <div className="w-8 h-12 sm:w-10 sm:h-14 md:w-14 md:h-18 bg-gradient-to-br from-blue-700 to-blue-800 rounded-lg border-2 border-white shadow-xl absolute -top-0.5 -left-0.5"></div>
                  <div className="w-8 h-12 sm:w-10 sm:h-14 md:w-14 md:h-18 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg border-2 border-white shadow-xl absolute -top-1 -left-1"></div>
                </div>
                <div className="text-xs text-center mt-1 text-white font-bold">DRAW</div>
              </div>

              {/* Current Card - Center with compact size to prevent overlap */}
              <div className="flex flex-col items-center">
                {topCard && (
                  <GameCard 
                    card={topCard} 
                    size="small" 
                  />
                )}
                {/* Active Color Indicator - Compact and positioned to avoid overlap */}
                {room.currentColor && (topCard?.type === "wild" || topCard?.type === "wild4") && (
                  <div className="mt-1 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm">
                    <div className="text-xs font-bold text-gray-700">
                      Active: <span className={`${room.currentColor === 'red' ? 'text-red-500' : room.currentColor === 'blue' ? 'text-blue-500' : room.currentColor === 'green' ? 'text-green-500' : 'text-yellow-500'}`}>
                        {room.currentColor?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Direction Indicator - Right Side */}
              <div className="absolute -right-6 sm:-right-8 md:-right-12 top-1/2 transform -translate-y-1/2">
                <div className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full flex items-center justify-center shadow-lg">
                  {room.direction === "clockwise" ? (
                    <ArrowRight className="text-white h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 animate-pulse" />
                  ) : (
                    <ArrowLeft className="text-white h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 animate-pulse" />
                  )}
                </div>
                <div className="text-xs text-center mt-1 text-white font-bold">
                  {room.direction === "clockwise" ? "CW" : "CCW"}
                </div>
              </div>
            </div>

            {/* UNO Button - Always Available, Always Same Appearance */}
            <div className="absolute -bottom-12 sm:-bottom-16 md:-bottom-20 left-1/2 transform -translate-x-1/2">
              <Button
                onClick={handleUnoCall}
                className="transition-all shadow-lg text-white font-bold px-3 py-2 sm:px-4 sm:py-2 md:px-6 md:py-3 text-sm sm:text-base md:text-lg rounded-full bg-gradient-to-r from-uno-red to-red-500 hover:scale-110 animate-pulse"
              >
                🔥 UNO! 🔥
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Player (Current User) - Responsive */}
      {currentPlayer && !currentPlayer.isSpectator && (
        <div className="absolute bottom-2 sm:bottom-4 left-1/2 transform -translate-x-1/2 z-20 w-full max-w-xs sm:max-w-md md:max-w-lg lg:max-w-2xl px-2">
          <div className="bg-white/95 backdrop-blur-sm rounded-xl p-2 sm:p-3 md:p-4 shadow-xl">
            <div className="text-center mb-2 sm:mb-3 md:mb-4">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 bg-gradient-to-br from-uno-green to-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm md:text-base">
                  {currentPlayer.nickname[0].toUpperCase()}
                </div>
                <div>
                  <div className={`font-semibold text-xs sm:text-sm md:text-base text-gray-800 ${isMyTurn ? 'animate-pulse text-red-600' : ''}`}>
                    {currentPlayer.nickname} (You) {isMyTurn && '⭐'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {currentPlayer.hand?.length || 0} cards
                    {isMyTurn && (
                      <span className="ml-2 text-uno-red font-bold">
                        • Your Turn! ({timer}s)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* User's Cards - Responsive Grid Layout */}
            <div className="flex flex-wrap gap-1 sm:gap-2 justify-center max-h-24 sm:max-h-32 md:max-h-40 overflow-y-auto">
              {currentPlayer.hand?.map((card: any, index: number) => (
                <div key={index} className="flex-shrink-0">
                  <GameCard
                    card={card}
                    onClick={() => handlePlayCardWithUnoCheck(index)}
                    disabled={!isMyTurn}
                    interactive
                    size="small"
                  />
                </div>
              )) || []}
            </div>
          </div>
        </div>
      )}

      {/* Spectators Panel */}
      {spectators.length > 0 && (
        <div className="absolute top-20 right-4 z-20">
          <UICard className="bg-white/95 backdrop-blur-sm shadow-lg">
            <CardContent className="p-3">
              <div className="text-sm font-medium text-gray-700 mb-2">Spectators ({spectators.length})</div>
              <div className="space-y-2">
                {spectators.map((spectator: any) => (
                  <div key={spectator.id} className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {spectator.nickname[0].toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-600">{spectator.nickname}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </UICard>
        </div>
      )}

      {/* Chat Panel */}
      {showChat && (
        <ChatPanel
          messages={gameState.messages || []}
          players={players}
          onSendMessage={sendChatMessage}
          onSendEmoji={sendEmoji}
          onClose={() => setShowChat(false)}
        />
      )}

      {/* Modals - Only show when explicitly triggered */}
      {(showColorPicker || gameState?.colorChoiceRequested) && (
        <ColorPickerModal
          onChooseColor={handleColorChoice}
          onClose={() => {
            setShowColorPicker(false);
          }}
        />
      )}

      {showGameEnd && (
        <GameEndModal
          winner={gameEndData?.winner || gamePlayers.find((p: any) => (p.hand?.length || 0) === 0)?.nickname || "Someone"}
          rankings={gameEndData?.rankings}
          onPlayAgain={() => {
            // Call server-side play again to reset the room state
            playAgain();
            setShowGameEnd(false);
            setGameEndData(null);
            // Navigate back to lobby to see the reset room
            if (roomId) {
              window.location.href = `/room/${roomId}`;
            } else {
              window.location.href = `/`;
            }
          }}
          onBackToLobby={() => {
            window.location.href = "/";
          }}
        />
      )}

      {/* Continue Game Prompt */}
      {showContinuePrompt && room?.hostId === playerId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <UICard className="max-w-md w-full mx-4">
            <CardContent className="p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Player Left the Game</h3>
              <p className="text-gray-600 mb-6">
                A player has left the game. As the host, you can either continue with the remaining players or invite someone to replace them.
              </p>
              
              <div className="space-y-3">
                <Button
                  onClick={() => {
                    continueGame();
                    setShowContinuePrompt(false);
                  }}
                  className="w-full bg-gradient-to-r from-uno-green to-emerald-500"
                >
                  Continue Game
                </Button>
                
                {spectators.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">Or select a spectator to replace:</p>
                    {spectators.map((spectator: any) => (
                      <Button
                        key={spectator.id}
                        onClick={() => {
                          // Find the first available position (kicked player's position)
                          const kickedPlayers = gamePlayers.filter((p: any) => p.hasLeft);
                          const targetPosition = kickedPlayers.length > 0 ? kickedPlayers[0].position : 0;
                          replacePlayer(targetPosition); 
                          setShowContinuePrompt(false);
                        }}
                        variant="outline"
                        className="w-full"
                      >
                        Replace with {spectator.nickname}
                      </Button>
                    ))}
                  </div>
                )}
                
                <Button
                  onClick={() => setShowContinuePrompt(false)}
                  variant="outline"
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </UICard>
        </div>
      )}
    </div>
  );
}
