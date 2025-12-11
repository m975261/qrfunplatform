import { useEffect, useState } from "react";
import { useRoute, useSearch, useLocation } from "wouter";
import { Card as UICard, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Menu, Users } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import StreamGameBoard from "@/components/game/StreamGameBoard";
import ChatPanel from "@/components/game/ChatPanel";
import GameEndModal from "@/components/game/GameEndModal";

export default function StreamPlayerPage() {
  const [, playerParams] = useRoute("/stream/:roomId/player/:slot");
  const [, hostParams] = useRoute("/stream/:roomId/host/game");
  const search = useSearch();
  const [, setLocation] = useLocation();
  
  const roomId = playerParams?.roomId || hostParams?.roomId;
  const slot = playerParams?.slot ? parseInt(playerParams.slot) : 1;
  const isHostGame = !!hostParams?.roomId;
  const roomCode = new URLSearchParams(search).get('code') || undefined;
  
  const { 
    gameState, 
    floatingEmojis,
    joinRoom, 
    playCard, 
    drawCard, 
    chooseColor,
    callUno,
    sendChatMessage,
    sendEmoji,
    exitGame,
    continueGame,
    replacePlayer,
    playAgain,
    isConnected 
  } = useSocket();

  const playerId = localStorage.getItem("playerId");
  
  // State matching normal Game.tsx
  const [showChat, setShowChat] = useState(false);
  const [showGameEnd, setShowGameEnd] = useState(false);
  const [gameEndData, setGameEndData] = useState<any>(null);
  const [timer, setTimer] = useState(30);
  const [unoMessage, setUnoMessage] = useState<string | null>(null);
  const [oneCardMessage, setOneCardMessage] = useState<string | null>(null);
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);

  useEffect(() => {
    if (isConnected && roomId && playerId) {
      joinRoom(playerId, roomId);
    }
  }, [isConnected, roomId, playerId, joinRoom]);

  const room = gameState?.room;
  const players = gameState?.players || [];
  
  const myPlayer = players.find((p: any) => p.id === playerId);
  const isSpectator = myPlayer?.isSpectator === true || myPlayer?.position == null;
  
  const gamePlayers = players.filter((p: any) => 
    !p.isSpectator && p.position !== null && p.position !== undefined
  ).sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
  
  const spectators = players.filter((p: any) => p.isSpectator && p.isOnline);
  
  const currentPlayerIndex = room?.currentPlayerIndex || 0;
  const currentPlayer = gamePlayers[currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === myPlayer?.id;

  // UNO message animation
  useEffect(() => {
    if (gameState?.unoMessage) {
      setUnoMessage(gameState.unoMessage);
      setTimeout(() => setUnoMessage(null), 3000);
    }
  }, [gameState?.unoMessage]);

  // One card left message
  useEffect(() => {
    if (gameState?.oneCardMessage) {
      setOneCardMessage(gameState.oneCardMessage);
      setTimeout(() => setOneCardMessage(null), 2500);
    }
  }, [gameState?.oneCardMessageTimestamp]);

  // Game end detection
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

  // Timer countdown
  useEffect(() => {
    if (room?.status === "playing" && isMyTurn) {
      const interval = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            // Timer expired - no auto-play, host can kick player if needed
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    } else if (!isMyTurn) {
      setTimer(30);
    }
  }, [room?.status, isMyTurn, drawCard]);

  const handlePlayCard = (cardIndex: number) => {
    playCard(cardIndex);
  };

  const handleColorChoice = (color: string) => {
    chooseColor(color as 'red' | 'yellow' | 'green' | 'blue');
  };

  const handleDrawCard = () => {
    if (isMyTurn) {
      drawCard();
    }
  };

  const handleCallUno = () => {
    if (!myPlayer?.hasCalledUno) {
      callUno();
    }
  };

  if (!room || room.status !== 'playing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-400 via-red-500 to-red-600 flex items-center justify-center p-4">
        <UICard className="bg-white/95 backdrop-blur-sm shadow-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Waiting for Game to Start</h2>
          <p className="text-gray-600">The host will start the game soon...</p>
        </UICard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-red-500 to-red-600 relative overflow-hidden">
      {/* Floating Emojis - Same as Game.tsx */}
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

      {/* UNO Call Animation - Same as Game.tsx */}
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

      {/* Header - Same style as Game.tsx */}
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

      {/* Spectators Panel - Same as Game.tsx */}
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

      {/* Game Board */}
      <StreamGameBoard
        room={room}
        players={players}
        currentPlayerId={playerId || undefined}
        onPlayCard={handlePlayCard}
        onDrawCard={handleDrawCard}
        onCallUno={handleCallUno}
        onChooseColor={handleColorChoice}
        isSpectator={isSpectator}
        colorChoiceRequested={gameState?.colorChoiceRequested || room?.waitingForColorChoice === playerId}
      />

      {/* Chat Panel - Same as Game.tsx */}
      {showChat && (
        <ChatPanel
          messages={gameState?.messages || []}
          players={players}
          onSendMessage={sendChatMessage}
          onSendEmoji={sendEmoji}
          onClose={() => setShowChat(false)}
        />
      )}

      {/* Game End Modal */}
      {showGameEnd && (
        <GameEndModal
          winner={gameEndData?.winner || gamePlayers.find((p: any) => (p.hand?.length || 0) === 0)?.nickname || "Someone"}
          rankings={gameEndData?.rankings}
          onPlayAgain={() => {
            playAgain();
            setShowGameEnd(false);
            setGameEndData(null);
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

      {/* Continue Game Prompt - Same as Game.tsx */}
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
