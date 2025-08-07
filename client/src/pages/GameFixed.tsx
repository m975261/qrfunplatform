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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative">
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
      <div className="absolute top-4 left-4 right-4 z-10">
        <div className="flex items-center justify-between">
          <div className="bg-slate-800/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-slate-700/50">
            <div className="text-sm font-medium text-white">
              Room <span className="font-mono text-blue-400">{room.code}</span>
            </div>
          </div>

          <div className="bg-slate-800/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-slate-700/50">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-300">{players.length} players</span>
            </div>
          </div>

          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              className="bg-slate-800/90 border-slate-700 text-slate-300 hover:bg-slate-700"
              onClick={() => setShowChat(!showChat)}
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="bg-red-900/50 border-red-700 text-red-300 hover:bg-red-800/50"
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

      {/* Central Game Area */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          {/* Game Circle */}
          <div className="w-64 h-64 md:w-80 md:h-80 lg:w-96 lg:h-96 rounded-full bg-gradient-to-br from-slate-700 via-slate-600 to-slate-700 shadow-2xl flex items-center justify-center relative border-4 border-slate-500/50">
            
            {/* Inner Circle */}
            <div className="w-48 h-48 md:w-56 md:h-56 lg:w-64 lg:h-64 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 shadow-inner flex items-center justify-center relative border-2 border-slate-400/30">
              
              {/* Draw Pile */}
              <div className="absolute -left-16 md:-left-20 top-1/2 transform -translate-y-1/2">
                <div className="relative cursor-pointer group" onClick={drawCard}>
                  <div className="w-12 h-16 md:w-16 md:h-20 bg-gradient-to-br from-blue-800 to-blue-900 rounded-lg border-2 border-blue-600 shadow-xl group-hover:shadow-blue-500/50 transition-all"></div>
                  <div className="w-12 h-16 md:w-16 md:h-20 bg-gradient-to-br from-blue-700 to-blue-800 rounded-lg border-2 border-blue-500 shadow-xl absolute -top-0.5 -left-0.5"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-white font-bold text-xs">UNO</div>
                  </div>
                </div>
                <div className="text-xs text-center mt-2 text-blue-300 font-bold">DRAW</div>
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
              <div className="absolute -right-16 md:-right-20 top-1/2 transform -translate-y-1/2">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full flex items-center justify-center shadow-lg border-2 border-purple-400">
                  {room.direction === 1 ? (
                    <ArrowRight className="text-white h-5 w-5 md:h-6 md:w-6" />
                  ) : (
                    <ArrowLeft className="text-white h-5 w-5 md:h-6 md:w-6" />
                  )}
                </div>
                <div className="text-xs text-center mt-2 text-purple-300 font-bold">
                  {room.direction === 1 ? "CW" : "CCW"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Other Players positioned at screen corners - completely away from circle */}
      {gamePlayers.filter((player: any) => player.id !== playerId && !player.isSpectator).map((player: any, index: number) => {
        const filteredIndex = gamePlayers.filter(p => p.id !== playerId && !p.isSpectator).indexOf(player);
        
        // Position players at corners: top-left, top-right, bottom-right
        const positions = [
          "top-20 left-4",      // Player 1: top-left
          "top-20 right-4",     // Player 2: top-right  
          "bottom-32 right-4"   // Player 3: bottom-right (above player hand)
        ];
        
        const positionClass = positions[filteredIndex] || "top-20 left-4";
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
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Player Hand Bar - Fixed at Bottom */}
      {currentPlayer && !currentPlayer.isSpectator && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-slate-800/95 to-slate-800/80 backdrop-blur-md border-t border-slate-700/50">
          <div className="container mx-auto px-4 py-4">
            {/* Player Info and UNO Button */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                  isMyTurn ? 'bg-gradient-to-br from-green-400 to-green-600 ring-2 ring-green-400 ring-offset-2 ring-offset-slate-800' : 'bg-gradient-to-br from-blue-400 to-blue-600'
                }`}>
                  {currentPlayer.nickname[0].toUpperCase()}
                </div>
                <div>
                  <div className={`font-semibold text-white ${isMyTurn ? 'text-green-400' : ''}`}>
                    {currentPlayer.nickname} {isMyTurn && '⭐'}
                  </div>
                  <div className="text-xs text-slate-400">
                    {currentPlayer.hand?.length || 0} cards
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {isMyTurn && (
                  <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-500/30">
                    YOUR TURN
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className={`font-bold border-2 transition-all ${
                    currentPlayer.hand?.length === 2 && !hasCalledUno 
                      ? 'bg-red-600 border-red-500 text-white hover:bg-red-700 animate-pulse' 
                      : hasCalledUno && currentPlayer.hand?.length === 1
                      ? 'bg-green-600 border-green-500 text-white hover:bg-green-700'
                      : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                  }`}
                  onClick={handleUnoCall}
                >
                  {hasCalledUno && currentPlayer.hand?.length === 1 ? 'UNO!' : 'CALL UNO'}
                </Button>
              </div>
            </div>
            
            {/* Player's Cards */}
            <div className="overflow-x-auto">
              {currentPlayer.hand && currentPlayer.hand.length > 0 ? (
                <div className="flex space-x-3 pb-2 min-w-max">
                  {currentPlayer.hand.map((card: any, index: number) => (
                    <div 
                      key={index} 
                      className={`transition-all duration-200 ${
                        isMyTurn ? 'hover:scale-105 hover:-translate-y-2 cursor-pointer' : 'opacity-60'
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
              ) : (
                <div className="text-center text-slate-400 text-sm py-4">No cards in hand</div>
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