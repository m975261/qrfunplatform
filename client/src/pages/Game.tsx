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
    isConnected
  } = useSocket();

  const [showChat, setShowChat] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showGameEnd, setShowGameEnd] = useState(false);
  const [pendingWildCard, setPendingWildCard] = useState<number | null>(null);
  const [timer, setTimer] = useState(30);

  useEffect(() => {
    if (roomId && playerId && isConnected) {
      joinRoom(playerId, roomId);
    }
  }, [roomId, playerId, isConnected, joinRoom]);

  useEffect(() => {
    if (gameState?.room?.status === "finished") {
      setShowGameEnd(true);
    }
  }, [gameState?.room?.status]);

  // Timer countdown
  useEffect(() => {
    if (gameState?.room?.status === "playing") {
      const interval = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            return 30; // Reset timer
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [gameState?.room?.status]);

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
    if (player?.hand?.length === 1) {
      callUno();
      toast({
        title: "UNO!",
        description: "You called UNO!",
      });
    } else {
      toast({
        title: "Invalid UNO Call",
        description: "You can only call UNO when you have exactly one card.",
        variant: "destructive",
      });
    }
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

          <Button
            variant="outline"
            size="sm"
            className="bg-white/95 backdrop-blur-sm"
            onClick={() => setShowChat(!showChat)}
          >
            <Menu className="h-4 w-4" />
          </Button>
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

            {/* UNO Button */}
            <div className="mt-6 text-center">
              <Button
                onClick={handleUnoCall}
                disabled={currentPlayer?.hand?.length !== 1}
                className="bg-gradient-to-r from-uno-red to-red-500 hover:scale-110 transition-all shadow-lg animate-bounce-gentle"
              >
                UNO!
              </Button>
            </div>
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
                    <div className="font-semibold text-gray-800">{currentPlayer.nickname} (You)</div>
                    <div className="text-xs text-gray-500">{currentPlayer.hand?.length || 0} cards</div>
                  </div>
                </div>
              </div>
              
              {/* User's Cards */}
              <div className="flex space-x-2 justify-center">
                {currentPlayer.hand?.map((card: any, index: number) => (
                  <GameCard
                    key={index}
                    card={card}
                    onClick={() => handlePlayCard(index)}
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
          winner={gamePlayers.find((p: any) => (p.hand?.length || 0) === 0)?.nickname || "Someone"}
          onPlayAgain={() => setShowGameEnd(false)}
          onBackToLobby={() => window.location.href = "/"}
        />
      )}
    </div>
  );
}
