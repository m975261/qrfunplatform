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

  useEffect(() => {
    if (roomId && playerId && isConnected) {
      joinRoom(playerId, roomId);
    }
  }, [roomId, playerId, isConnected, joinRoom]);

  useEffect(() => {
    if (gameState?.room?.status === "finished") {
      setShowGameEnd(true);
    }
    
    if (gameState?.gameEndData) {
      setGameEndData(gameState.gameEndData);
      setShowGameEnd(true);
    }
    
    if (gameState?.needsContinue) {
      setShowContinuePrompt(true);
    }
  }, [gameState?.room?.status, gameState?.gameEndData, gameState?.needsContinue]);

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
    if (player?.hand?.length === 2 && !hasCalledUno) {
      callUno();
      setHasCalledUno(true);
      toast({
        title: "UNO!",
        description: "You called UNO! Now play your second-to-last card.",
      });
    } else if (hasCalledUno) {
      toast({
        title: "Already Called",
        description: "You've already called UNO for this hand.",
      });
    } else {
      toast({
        title: "UNO Available",
        description: "Call UNO when you have exactly 2 cards before playing your second-to-last card.",
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
  const topCard = room.discardPile?.[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-red-500 to-red-600 relative overflow-hidden">
      {/* Floating emojis */}
      {floatingEmojis.map((emoji) => (
        <div
          key={emoji.id}
          className="fixed z-50 pointer-events-none animate-bounce text-2xl"
          style={{ left: emoji.x, top: emoji.y }}
        >
          {emoji.emoji}
        </div>
      ))}

      {/* Header */}
      <div className="absolute top-2 md:top-4 left-2 md:left-4 right-2 md:right-4 z-10">
        <div className="flex items-center justify-between">
          <div className="bg-white/95 backdrop-blur-sm px-2 md:px-4 py-2 rounded-xl shadow-lg">
            <div className="text-xs md:text-sm font-medium text-gray-800">
              Room <span className="font-mono text-red-600">{room.code}</span>
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-sm px-2 md:px-4 py-2 rounded-xl shadow-lg">
            <div className="flex items-center space-x-2">
              <Users className="h-3 w-3 md:h-4 md:w-4 text-gray-600" />
              <span className="text-xs md:text-sm text-gray-600">{players.length} players</span>
              {isMyTurn && <span className="text-xs text-red-600 font-bold">YOUR TURN</span>}
            </div>
          </div>

          <div className="flex space-x-1">
            <Button
              variant="outline"
              size="sm"
              className="bg-white/95 backdrop-blur-sm p-2"
              onClick={() => setShowChat(!showChat)}
            >
              <MessageCircle className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="bg-red-50 hover:bg-red-100 border-red-200 text-red-700 text-xs p-2"
              onClick={() => {
                if (confirm("Are you sure you want to exit the game?")) {
                  exitGame();
                }
              }}
            >
              Exit
            </Button>
          </div>
        </div>
      </div>

      {/* Circular Game Area */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          {/* Main Game Circle */}
          <div className="w-40 h-40 sm:w-48 sm:h-48 md:w-64 md:h-64 lg:w-80 lg:h-80 rounded-full bg-gradient-to-br from-yellow-300 via-orange-400 to-red-500 shadow-2xl flex items-center justify-center relative border-4 border-white/30">
            
            {/* Inner Circle */}
            <div className="w-28 h-28 sm:w-32 sm:h-32 md:w-40 md:h-40 lg:w-48 lg:h-48 rounded-full bg-gradient-to-br from-yellow-200 to-orange-300 shadow-inner flex items-center justify-center relative border-2 border-white/50">
              
              {/* Draw Pile */}
              <div className="absolute -left-6 sm:-left-8 md:-left-12 top-1/2 transform -translate-y-1/2">
                <div className="relative cursor-pointer" onClick={drawCard}>
                  <div className="w-8 h-12 sm:w-10 sm:h-14 md:w-14 md:h-18 bg-gradient-to-br from-blue-800 to-blue-900 rounded-lg border-2 border-white shadow-xl"></div>
                  <div className="w-8 h-12 sm:w-10 sm:h-14 md:w-14 md:h-18 bg-gradient-to-br from-blue-700 to-blue-800 rounded-lg border-2 border-white shadow-xl absolute -top-0.5 -left-0.5"></div>
                </div>
                <div className="text-xs text-center mt-1 text-white font-bold">DRAW</div>
              </div>

              {/* Current Card */}
              <div className="flex flex-col items-center">
                {topCard ? (
                  <GameCard 
                    card={topCard} 
                    size="medium"
                    interactive={false}
                    onClick={() => {}}
                  />
                ) : (
                  <div className="w-12 h-16 sm:w-16 sm:h-20 md:w-20 md:h-28 bg-gradient-to-br from-red-500 to-red-700 rounded-lg border-2 border-white shadow-xl flex items-center justify-center">
                    <div className="text-white font-bold text-xs sm:text-sm md:text-base">?</div>
                  </div>
                )}
              </div>

              {/* Direction Indicator */}
              <div className="absolute -right-6 sm:-right-8 md:-right-12 top-1/2 transform -translate-y-1/2">
                <div className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full flex items-center justify-center shadow-lg">
                  {room.direction === 1 ? (
                    <ArrowRight className="text-white h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                  ) : (
                    <ArrowLeft className="text-white h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                  )}
                </div>
                <div className="text-xs text-center mt-1 text-white font-bold">
                  {room.direction === 1 ? "CW" : "CCW"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Players around circle */}
      {gamePlayers.map((player: any, index: number) => {
        if (player.id === playerId) return null; // Skip current player
        
        const position = index === 0 ? "top" : index === 1 ? "left" : "right";
        const positionClass = 
          position === "top" ? "top-16 md:top-20 left-1/2 transform -translate-x-1/2" :
          position === "left" ? "left-2 md:left-4 top-1/2 transform -translate-y-1/2" :
          "right-2 md:right-4 top-1/2 transform -translate-y-1/2";

        const isPlayerTurn = currentGamePlayer?.id === player.id;

        return (
          <div key={player.id} className={`absolute z-20 ${positionClass}`}>
            <div className={`bg-white/90 backdrop-blur-sm rounded-xl p-2 md:p-3 shadow-lg max-w-xs relative ${isPlayerTurn ? 'ring-2 ring-red-500 animate-pulse' : ''}`}>
              {isPlayerTurn && (
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold animate-bounce">
                  YOUR TURN
                </div>
              )}
              <div className="flex items-center space-x-2 mb-2">
                {/* Player Avatar */}
                <div className="relative">
                  <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center text-white font-bold text-xs md:text-sm ${
                    isPlayerTurn ? 'bg-gradient-to-br from-red-400 to-red-600 animate-pulse' : 'bg-gradient-to-br from-blue-400 to-blue-600'
                  }`}>
                    {player.nickname?.[0]?.toUpperCase()}
                  </div>
                  {isPlayerTurn && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
                  )}
                </div>
                <div>
                  <div className={`font-semibold text-xs md:text-sm text-gray-800 ${isPlayerTurn ? 'text-red-600 animate-pulse' : ''}`}>
                    {player.nickname} {isPlayerTurn && '⭐'}
                  </div>
                  <div className="text-xs text-gray-500">{player.hand?.length || 0} cards</div>
                </div>
              </div>
              <div className="flex justify-center space-x-1">
                {Array(Math.min(player.hand?.length || 0, 8)).fill(null).map((_, i) => (
                  <div key={i} className="w-3 h-4 md:w-4 md:h-6 bg-gradient-to-br from-gray-700 to-gray-900 rounded border border-white shadow-sm"></div>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {/* Current Player at Bottom */}
      {currentPlayer && !currentPlayer.isSpectator && (
        <div className="absolute bottom-2 sm:bottom-4 left-1/2 transform -translate-x-1/2 z-20 w-full max-w-4xl px-2">
          <div className={`bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-xl ${isMyTurn ? 'ring-2 ring-green-500' : ''}`}>
            <div className="text-center mb-2 sm:mb-3 md:mb-4 relative">
              {isMyTurn && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold animate-bounce">
                  YOUR TURN
                </div>
              )}
              <div className="flex items-center justify-center space-x-2">
                {/* Player Avatar */}
                <div className="relative">
                  <div className={`w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm md:text-base ${
                    isMyTurn ? 'bg-gradient-to-br from-green-400 to-green-600 animate-pulse' : 'bg-gradient-to-br from-green-400 to-green-600'
                  }`}>
                    {currentPlayer.nickname[0].toUpperCase()}
                  </div>
                  {isMyTurn && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
                  )}
                </div>
                <div className="flex-1">
                  <div className={`font-semibold text-xs sm:text-sm md:text-base text-gray-800 ${isMyTurn ? 'text-green-600 animate-pulse' : ''}`}>
                    {currentPlayer.nickname} (You) {isMyTurn && '⭐'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {currentPlayer.hand?.length || 0} cards
                  </div>
                </div>
              </div>

              {/* UNO Button - Always available */}
              <div className="mt-3">
                <Button
                  size="lg"
                  className={`text-white font-bold shadow-lg ${
                    currentPlayer.hand?.length === 2 && !hasCalledUno 
                      ? 'bg-red-600 hover:bg-red-700 animate-bounce' 
                      : hasCalledUno && currentPlayer.hand?.length === 1
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-gray-600 hover:bg-gray-700'
                  }`}
                  onClick={handleUnoCall}
                >
                  {hasCalledUno && currentPlayer.hand?.length === 1 ? '✅ UNO CALLED' : '🎯 CALL UNO!'}
                </Button>
              </div>
            </div>
            
            {/* Player's Cards */}
            <div className="mt-4">
              {currentPlayer.hand && currentPlayer.hand.length > 0 ? (
                <div className="flex justify-center">
                  <div className="flex flex-wrap gap-3 justify-center max-w-5xl">
                    {currentPlayer.hand.map((card: any, index: number) => (
                      <div 
                        key={index} 
                        className={`transition-all duration-200 ${
                          isMyTurn ? 'hover:scale-110 hover:-translate-y-3 cursor-pointer' : 'opacity-75'
                        }`}
                      >
                        <GameCard 
                          card={card}
                          size="medium"
                          interactive={isMyTurn}
                          disabled={!isMyTurn}
                          onClick={() => isMyTurn && handlePlayCard(index)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 text-sm">No cards in hand</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Spectators Area */}
      {players.filter((p: any) => p.isSpectator).length > 0 && (
        <div className="absolute top-20 right-2 md:right-4 z-20">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl p-2 md:p-3 shadow-lg max-w-xs">
            <div className="text-xs font-semibold text-gray-700 mb-2">Spectators:</div>
            <div className="space-y-1">
              {players.filter((p: any) => p.isSpectator).map((spectator: any) => (
                <div key={spectator.id} className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                    {spectator.nickname?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-xs text-gray-600">{spectator.nickname}</span>
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

      {/* Game End Modal */}
      {showGameEnd && gameEndData && (
        <GameEndModal
          winner={gameEndData.winner}
          rankings={gameEndData.rankings}
          onPlayAgain={() => {
            setShowGameEnd(false);
            setGameEndData(null);
            continueGame();
          }}
          onBackToLobby={() => {
            setShowGameEnd(false);
            setGameEndData(null);
            exitGame();
          }}
        />
      )}
    </div>
  );
}