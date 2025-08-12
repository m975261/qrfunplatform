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
import ColorPickerModal from "@/components/game/ColorPickerModal";
import NicknameEditor from "@/components/NicknameEditor";

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
  const [pendingWildCard, setPendingWildCard] = useState<number | null>(null);
  const [timer, setTimer] = useState(30);
  const [hasCalledUno, setHasCalledUno] = useState(false);
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);
  const [showNicknameEditor, setShowNicknameEditor] = useState(false);

  useEffect(() => {
    if (roomId && playerId && isConnected) {
      joinRoom(playerId, roomId);
    }
  }, [roomId, playerId, isConnected, joinRoom]);

  // Winner modal system completely removed - games end silently
  useEffect(() => {
    if (gameState?.needsContinue) {
      setShowContinuePrompt(true);
    }
  }, [gameState?.needsContinue]);

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

  if (!gameState || !gameState.room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-400 via-red-500 to-red-600 flex items-center justify-center">
        <div className="text-white text-xl">Loading game...</div>
      </div>
    );
  }

  const { room, players, spectators, messages, currentTurn, topCard, direction, needsColorChoice } = gameState;
  const currentPlayer = players?.find((p: any) => p.id === playerId);
  const currentGamePlayer = players?.find((p: any) => p.position === currentTurn);
  const isMyTurn = currentPlayer && currentGamePlayer && currentPlayer.id === currentGamePlayer.id;
  const isHost = currentPlayer?.id === room.hostId;
  const isSpectator = spectators?.some((s: any) => s.id === playerId) || (!currentPlayer && players?.length >= 4);

  // Get player at specific position
  const getPlayerAtPosition = (position: number) => {
    return players?.find((p: any) => p.position === position);
  };

  // Check if player is online
  const isPlayerOnline = (player: any) => {
    if (!player) return false;
    // In waiting rooms, show all players as online by default
    if (room.status === "waiting") return true;
    // Use heartbeat data for online status during games
    return room.onlineStatus?.includes(`${player.nickname}: online`);
  };

  // Position styles for circular layout
  const getPositionStyle = (position: number) => {
    const positions = [
      // Position 0: Bottom (current player)
      { bottom: 0, left: '50%', transform: 'translateX(-50%)' },
      // Position 1: Right
      { top: '50%', right: 0, transform: 'translateY(-50%)' },
      // Position 2: Top
      { top: 0, left: '50%', transform: 'translateX(-50%)' },
      // Position 3: Left
      { top: '50%', left: 0, transform: 'translateY(-50%)' }
    ];
    
    return positions[position] || positions[0];
  };

  const handleExitRoom = () => {
    if (confirm("Are you sure you want to leave the room?")) {
      // Clean up local storage
      localStorage.removeItem("roomId");
      localStorage.removeItem("playerId");
      
      // Call exit game function if available
      if (exitGame) {
        exitGame();
      }
      
      // Redirect to main page
      window.location.href = "/";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-uno-orange via-uno-red to-uno-purple relative overflow-hidden">
      {/* Background patterns */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-20 h-20 bg-white rounded-full"></div>
        <div className="absolute top-32 right-20 w-16 h-16 bg-white rounded-full"></div>
        <div className="absolute bottom-20 left-32 w-12 h-12 bg-white rounded-full"></div>
        <div className="absolute bottom-32 right-16 w-24 h-24 bg-white rounded-full"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-white font-fredoka">
              UNO Game
            </h1>
            <div className="bg-white/20 px-3 py-1 rounded-full">
              <span className="text-white font-bold">Room: {room.code}</span>
            </div>
            <div className={`px-3 py-1 rounded-full ${
              isConnected ? 'bg-green-500/20 text-green-100' : 'bg-red-500/20 text-red-100'
            }`}>
              <span className="text-sm font-medium">
                {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Chat Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowChat(!showChat)}
              className="text-white hover:bg-white/20"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Chat
            </Button>
            
            {/* Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExitRoom}
              className="text-white hover:bg-white/20"
            >
              <Menu className="w-4 h-4 mr-2" />
              Exit
            </Button>
          </div>
        </div>

        {/* Game Status Bar */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-white text-sm">
          <div>Status: <span className="font-bold">{room.status}</span></div>
          <div>Players: <span className="font-bold">{players?.length || 0}/4</span></div>
          {spectators?.length > 0 && (
            <div>Spectators: <span className="font-bold">{spectators.length}</span></div>
          )}
          {room.status === "playing" && currentGamePlayer && (
            <div>Current Turn: <span className="font-bold">{currentGamePlayer.nickname}</span></div>
          )}
        </div>
      </div>

      {/* Main Game Area */}
      <div className="relative flex-1 px-4 sm:px-6 pb-4">
        {/* Game Status Messages */}
        {room.status === "waiting" && (
          <div className="text-center mb-6">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 inline-block">
              <p className="text-white text-lg">Waiting for players...</p>
              {isHost && players?.length >= 2 && (
                <div className="mt-4">
                  <Button
                    onClick={() => fetch(`/api/rooms/${room.code}/start`, { method: 'POST' })}
                    className="bg-green-500 hover:bg-green-600 text-white font-bold"
                  >
                    Start Game
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Continue Game Prompt */}
        {showContinuePrompt && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md mx-4">
              <h3 className="text-lg font-bold mb-4">Continue Playing?</h3>
              <p className="text-gray-600 mb-6">The game has ended. Would you like to continue with the same players?</p>
              <div className="flex space-x-4">
                <Button
                  onClick={() => {
                    continueGame();
                    setShowContinuePrompt(false);
                  }}
                  className="flex-1"
                >
                  Continue
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowContinuePrompt(false);
                    window.location.href = "/";
                  }}
                  className="flex-1"
                >
                  Exit
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Main Game Circle */}
        <div className="flex justify-center items-center" style={{ minHeight: 'max(60vh, 400px)' }}>
          <div className="relative bg-white/10 backdrop-blur-sm rounded-full border-4 border-white/30 shadow-2xl" style={{
            width: 'max(16rem, min(40vw, 40vh))',
            height: 'max(16rem, min(40vw, 40vh))',
            minWidth: '256px',
            minHeight: '256px'
          }}>
            
            {/* Center Game Info */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
              {/* Draw Pile */}
              <div className="absolute" style={{
                top: '50%',
                right: 'max(-6rem, -15vw)',
                transform: 'translateY(-50%)',
                minWidth: '80px'
              }}>
                <div 
                  className="bg-gray-800 rounded-lg border-2 border-gray-600 cursor-pointer hover:bg-gray-700 transition-colors flex flex-col items-center justify-center text-white shadow-lg"
                  style={{
                    width: 'max(5rem, min(12vw, 12vh))',
                    height: 'max(7rem, min(17vw, 17vh))',
                    minWidth: '80px',
                    minHeight: '112px'
                  }}
                  onClick={() => isMyTurn && !needsColorChoice && drawCard()}
                >
                  <div className="text-xl sm:text-2xl font-bold mb-1">📚</div>
                  <div className="text-xs sm:text-sm font-medium text-center">Cards</div>
                </div>
              </div>

              {/* Top Card Display */}
              <div className="mb-4">
                {topCard && <GameCard card={topCard} />}
              </div>
              
              {/* Game Direction and Info */}
              <div className="text-center">
                {room.status === "playing" && (
                  <div className="flex items-center space-x-2 text-sm">
                    <span>Direction:</span>
                    <div className="text-xl">
                      {direction === 'clockwise' ? '↻' : '↺'}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* UNO Button - Bottom right of center circle */}
            {!isSpectator && room.status === "playing" && (
              <div className="absolute" style={{
                bottom: 'max(-2.5rem, -8vh)',
                right: 'max(-4rem, -10vw)',
                minWidth: '64px'
              }}>
                <Button
                  onClick={handleUnoCall}
                  disabled={hasCalledUno || currentPlayer?.hasCalledUno}
                  className={`font-bold text-sm px-4 py-2 rounded-full shadow-lg transition-all ${
                    hasCalledUno || currentPlayer?.hasCalledUno
                      ? 'bg-green-500 text-white cursor-not-allowed'
                      : 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                  }`}
                  style={{
                    minWidth: 'max(4rem, 8vw)',
                    minHeight: 'max(2.5rem, 5vh)'
                  }}
                >
                  {hasCalledUno || currentPlayer?.hasCalledUno ? '✅ UNO CALLED' : '🔥 UNO! 🔥'}
                </Button>
              </div>
            )}

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
          
          {/* Game Direction Indicator - Always show if game exists */}
          {gameState && gameState.room && (
            <div className="absolute z-20 pointer-events-none" style={{
              top: 'max(-4rem, -12vh)',
              left: '50%',
              transform: 'translateX(-50%)',
              minHeight: '32px'
            }}>
              <div className="bg-purple-600 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg border border-purple-500 flex items-center space-x-2">
                <span>Status: {gameState?.room?.status || 'none'}</span>
                <span>Dir: {gameState?.room?.direction || 'none'}</span>
                <div className="flex items-center text-lg">
                  {gameState?.room?.direction === 'clockwise' ? (
                    <span className="text-white font-bold">↻</span>
                  ) : (
                    <span className="text-white font-bold">↺</span>
                  )}
                </div>
              </div>
            </div>
          )}
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
                        <div className="absolute -left-2 top-1/2 -translate-y-1/2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold min-w-[20px] text-center">
                          {player.hand?.length || 0}
                        </div>
                      )}
                    </div>
                  ) : (
                    // Empty Slot - Responsive sizing
                    <div className="bg-white/20 rounded-full flex items-center justify-center text-white/60 border-2 border-dashed border-white/40"
                    style={{
                      width: 'max(4rem, min(8vw, 8vh))',
                      height: 'max(4rem, min(8vw, 8vh))',
                      minWidth: '64px',
                      minHeight: '64px'
                    }}>
                      <span className="text-xs sm:text-sm font-medium">Closed</span>
                    </div>
                  )}
                  
                  {/* Host Controls for Kicking Players */}
                  {isHost && player && player.id !== playerId && room.status === "waiting" && (
                    <button
                      onClick={() => kickPlayer(player.id)}
                      className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1 rounded font-bold transition-colors"
                    >
                      Kick
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </div>

      {/* Player Hand - Bottom of screen with responsive sizing */}
      {!isSpectator && currentPlayer?.hand && (
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent" style={{
          height: 'max(12vh, 96px)',
          paddingTop: 'max(2vh, 16px)',
          paddingBottom: 'max(2vh, 16px)'
        }}>
          <div className="px-4 h-full">
            <div className="flex space-x-2 overflow-x-auto pb-2 h-full items-center" style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}>
              {currentPlayer.hand.map((card: any, index: number) => (
                <div 
                  key={index} 
                  className="flex-shrink-0 cursor-pointer transform hover:scale-110 transition-transform"
                  onClick={() => isMyTurn && !needsColorChoice && handlePlayCard(index)}
                  style={{
                    opacity: (!isMyTurn || needsColorChoice) ? 0.6 : 1,
                    minWidth: 'max(3.5rem, 8vw)',
                    maxWidth: '4rem'
                  }}
                >
                  <GameCard card={card} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Floating Emojis */}
      {floatingEmojis.map((emoji: any) => (
        <div
          key={emoji.id}
          className="fixed pointer-events-none text-2xl animate-bounce z-30"
          style={{
            left: emoji.x,
            top: emoji.y,
            animation: 'float 3s ease-out forwards'
          }}
        >
          {emoji.emoji}
        </div>
      ))}

      {/* Chat Panel */}
      {showChat && (
        <ChatPanel
          messages={messages || []}
          players={players || []}
          onSendMessage={sendChatMessage}
          onSendEmoji={sendEmoji}
          onClose={() => setShowChat(false)}
        />
      )}

      {/* Color Picker Modal */}
      {showColorPicker && (
        <ColorPickerModal
          onColorChoice={handleColorChoice}
          onClose={() => {
            setShowColorPicker(false);
            setPendingWildCard(null);
          }}
        />
      )}

      {/* Nickname Editor */}
      {showNicknameEditor && (
        <NicknameEditor
          onClose={() => setShowNicknameEditor(false)}
          onNicknameChange={() => {
            setShowNicknameEditor(false);
            // Refresh game state after nickname change
            if (roomId && playerId) {
              joinRoom(playerId, roomId);
            }
          }}
        />
      )}
    </div>
  );
}