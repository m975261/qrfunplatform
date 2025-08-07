import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Card as UICard, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Menu, ArrowRight, ArrowLeft } from "lucide-react";
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

  // Timer countdown will be set up after variables are declared

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
    if (player?.hand?.length === 2) {
      callUno();
      setHasCalledUno(true);
      toast({
        title: "UNO!",
        description: "You called UNO! Now play your second-to-last card.",
      });
    } else {
      toast({
        title: "Invalid UNO Call",
        description: "You can only call UNO when you have exactly two cards.",
        variant: "destructive",
      });
    }
  };

  const handlePlayCardWithUnoCheck = (cardIndex: number) => {
    const player = gameState?.players?.find((p: any) => p.id === playerId);
    
    // Check if player should have called UNO (playing second-to-last card without calling UNO)
    if (player?.hand?.length === 2 && !hasCalledUno) {
      toast({
        title: "UNO Penalty!",
        description: "You didn't call UNO! Draw 2 cards as penalty.",
        variant: "destructive",
      });
      // Draw 2 penalty cards
      drawCard();
      drawCard();
      return;
    }
    
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
  const spectators = players.filter((p: any) => p.isSpectator);
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
    <div className="min-h-screen bg-gradient-to-br from-uno-blue via-uno-purple to-uno-red relative overflow-hidden">
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

      {/* Game Header */}
      <div className="absolute top-4 left-4 right-4 z-10">
        <div className="flex items-center justify-between">
          <div className="bg-white/95 backdrop-blur-sm px-4 py-2 rounded-xl shadow-lg">
            <div className="text-sm font-medium text-gray-800">
              Room <span className="font-mono text-uno-blue">{room.code}</span>
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-sm px-4 py-2 rounded-xl shadow-lg">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full animate-pulse ${isMyTurn ? 'bg-green-500' : 'bg-orange-500'}`}></div>
              <span className="font-mono font-medium text-orange-600">
                {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </div>

          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              className="bg-white/95 backdrop-blur-sm"
              onClick={() => setShowChat(!showChat)}
            >
              <Menu className="h-4 w-4" />
            </Button>
            
            {/* Exit Game Button */}
            <Button
              variant="outline"
              size="sm"
              className="bg-red-50 hover:bg-red-100 border-red-200 text-red-700"
              onClick={() => {
                if (confirm("Are you sure you want to exit the game? You will be ranked last.")) {
                  exitGame();
                }
              }}
            >
              Exit Game
            </Button>
          </div>
        </div>
      </div>

      {/* Player Areas */}
      {arrangedPlayers.length > 1 && (
        <PlayerArea
          player={arrangedPlayers[arrangedPlayers.length - 2]}
          position="top"
          isCurrentTurn={currentGamePlayer?.id === arrangedPlayers[arrangedPlayers.length - 2]?.id}
        />
      )}
      
      {arrangedPlayers.length > 2 && (
        <PlayerArea
          player={arrangedPlayers[arrangedPlayers.length - 3]}
          position="left"
          isCurrentTurn={currentGamePlayer?.id === arrangedPlayers[arrangedPlayers.length - 3]?.id}
        />
      )}
      
      {arrangedPlayers.length > 3 && (
        <PlayerArea
          player={arrangedPlayers[arrangedPlayers.length - 4]}
          position="right"
          isCurrentTurn={currentGamePlayer?.id === arrangedPlayers[arrangedPlayers.length - 4]?.id}
        />
      )}

      {/* Center Game Area */}
      <div className="absolute inset-0 flex items-center justify-center">
        <UICard className="bg-white/95 backdrop-blur-sm shadow-2xl">
          <CardContent className="p-8">
            <div className="flex items-center space-x-8">
              {/* Draw Pile */}
              <div className="text-center">
                <div className="relative">
                  <div className="w-20 h-28 bg-gradient-to-br from-blue-800 to-blue-900 rounded-lg border-4 border-white shadow-xl"></div>
                  <div className="w-20 h-28 bg-gradient-to-br from-blue-700 to-blue-800 rounded-lg border-4 border-white shadow-xl absolute -top-1 -left-1"></div>
                  <div className="w-20 h-28 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg border-4 border-white shadow-xl absolute -top-2 -left-2"></div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={drawCard}
                  disabled={!isMyTurn}
                  className="mt-2 text-sm text-gray-600 hover:text-uno-blue"
                >
                  Draw Card
                </Button>
              </div>

              {/* Current Card */}
              <div className="text-center">
                {topCard && (
                  <GameCard card={topCard} size="large" />
                )}
                <div className="mt-2 text-sm text-gray-600">Current Card</div>
              </div>

              {/* Direction Indicator */}
              <div className="text-center">
                <div className="w-12 h-12 bg-uno-yellow rounded-full flex items-center justify-center shadow-lg">
                  {room.direction === "clockwise" ? (
                    <ArrowRight className="text-white animate-pulse-slow" />
                  ) : (
                    <ArrowLeft className="text-white animate-pulse-slow" />
                  )}
                </div>
                <div className="mt-2 text-xs text-gray-600">
                  {room.direction === "clockwise" ? "Clockwise" : "Counter"}
                </div>
              </div>
            </div>

            {/* UNO Button - Show when player has 2 cards */}
            {currentPlayer?.hand?.length === 2 && isMyTurn && (
              <div className="mt-6 text-center">
                <Button
                  onClick={handleUnoCall}
                  className="bg-gradient-to-r from-uno-red to-red-500 hover:scale-110 transition-all shadow-lg animate-pulse text-white font-bold text-xl px-8 py-3"
                >
                  🔥 UNO! 🔥
                </Button>
                <p className="text-xs text-gray-600 mt-1">Click before playing your second-to-last card!</p>
              </div>
            )}
          </CardContent>
        </UICard>
      </div>

      {/* Bottom Player (Current User) */}
      {currentPlayer && !currentPlayer.isSpectator && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
          <UICard className="bg-white/95 backdrop-blur-sm shadow-xl">
            <CardContent className="p-4">
              <div className="text-center mb-4">
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-uno-green to-emerald-500 rounded-full flex items-center justify-center text-white font-bold">
                    {currentPlayer.nickname[0].toUpperCase()}
                  </div>
                  <div>
                    <div className={`font-semibold text-gray-800 ${isMyTurn ? 'animate-pulse' : ''}`}>
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
              
              {/* User's Cards */}
              <div className="flex space-x-2 justify-center">
                {currentPlayer.hand?.map((card: any, index: number) => (
                  <GameCard
                    key={index}
                    card={card}
                    onClick={() => handlePlayCardWithUnoCheck(index)}
                    disabled={!isMyTurn}
                    interactive
                  />
                )) || []}
              </div>
            </CardContent>
          </UICard>
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

      {/* Modals */}
      {showColorPicker && (
        <ColorPickerModal
          onChooseColor={handleColorChoice}
          onClose={() => setShowColorPicker(false)}
        />
      )}

      {showGameEnd && (
        <GameEndModal
          winner={gameEndData?.winner || gamePlayers.find((p: any) => (p.hand?.length || 0) === 0)?.nickname || "Someone"}
          rankings={gameEndData?.rankings}
          onPlayAgain={() => {
            // Host can restart the game
            if (room?.hostId === playerId) {
              // TODO: Add restart game functionality to socket hook
            }
            setShowGameEnd(false);
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
                          replacePlayer(spectator.id, 0); // Replace with position logic
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
