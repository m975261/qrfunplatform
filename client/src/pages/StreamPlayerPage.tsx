import { useEffect, useState } from "react";
import { useRoute, useSearch, useLocation } from "wouter";
import { Card as UICard, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Menu, Users, ChevronLeft, ChevronRight, Plus, X, Eye, EyeOff } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import StreamGameBoard from "@/components/game/StreamGameBoard";
import ChatPanel from "@/components/game/ChatPanel";
import GameEndModal from "@/components/game/GameEndModal";
import NicknameEditor from "@/components/NicknameEditor";

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
    avatarMessages,
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
    kickPlayer: kickPlayerWS,
    assignSpectator,
    assignHost,
    isConnected 
  } = useSocket();

  const playerId = localStorage.getItem("playerId");
  
  // State matching normal Game.tsx
  const [showChat, setShowChat] = useState(false);
  const [showGameEnd, setShowGameEnd] = useState(false);
  const [gameEndData, setGameEndData] = useState<any>(null);
  const [unoMessage, setUnoMessage] = useState<string | null>(null);
  const [oneCardMessage, setOneCardMessage] = useState<string | null>(null);
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);
  const [showSpectators, setShowSpectators] = useState(true);
  
  // Host controls state for editing nicknames
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingPlayerNickname, setEditingPlayerNickname] = useState<string>("");

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
  
  // Include all spectators for stream mode (not just online ones)
  const spectators = players.filter((p: any) => p.isSpectator);
  
  const currentPlayerIndex = room?.currentPlayerIndex || 0;
  const currentPlayer = gamePlayers[currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === myPlayer?.id;
  // Check host status - use both room.hostId and player.isHost for robustness
  const myPlayerData = players.find((p: any) => p.id === playerId);
  const isHost = room?.hostId === playerId || myPlayerData?.isHost === true;
  
  // Debug logging for host controls
  console.log('StreamPlayerPage - isHost check:', { 
    roomHostId: room?.hostId, 
    playerId, 
    isHost,
    myPlayerIsHost: myPlayerData?.isHost,
    roomStatus: room?.status,
    isHostGame,
    currentPath: window.location.pathname
  });
  
  // Get available positions for host controls
  const getAvailablePositions = () => {
    const occupied = gamePlayers.map((p: any) => p.position);
    return [0, 1, 2, 3].filter(pos => !occupied.includes(pos));
  };
  
  const handleKickPlayer = (targetPlayerId: string) => {
    console.log('handleKickPlayer called:', { targetPlayerId, isHost, playerId });
    if (isHost) {
      console.log('Kicking player via WebSocket:', targetPlayerId);
      kickPlayerWS(targetPlayerId);
    } else {
      console.log('Not host, cannot kick player');
    }
  };
  
  const handleAssignToSlot = (spectatorId: string, position: number) => {
    if (isHost) {
      assignSpectator(spectatorId, position);
    }
  };

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

  // Derive game end state from gameState directly for reliable rendering
  const shouldShowGameEnd = showGameEnd || gameState?.gameEndData || gameState?.room?.status === 'finished';
  
  if (!room || (room.status !== 'playing' && room.status !== 'finished' && !shouldShowGameEnd)) {
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

      {/* Turn Indicator - Shows YOUR TURN or {player}'s Turn - positioned below room code */}
      {room?.status === 'playing' && currentPlayer && !isSpectator && (
        <div className="fixed top-14 md:top-16 left-1/2 transform -translate-x-1/2 pointer-events-none z-30" data-testid="turn-indicator">
          {isMyTurn ? (
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm md:text-lg lg:text-xl font-bold px-4 md:px-6 py-2 md:py-3 rounded-full shadow-xl border-2 border-white animate-pulse">
              <div className="flex items-center space-x-1 md:space-x-2">
                <span>⭐</span>
                <span>YOUR TURN!</span>
                <span>⭐</span>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-sm md:text-lg lg:text-xl font-bold px-4 md:px-6 py-2 md:py-3 rounded-full shadow-xl border-2 border-white animate-pulse">
              <div className="flex items-center space-x-1 md:space-x-2">
                <span>🎯</span>
                <span>{currentPlayer.nickname}'s Turn</span>
                <span>🎯</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Header - Same style as Game.tsx with Chat on left */}
      <div className="absolute top-2 md:top-4 left-2 md:left-4 right-2 md:right-4 z-10">
        <div className="flex items-center justify-between">
          {/* Left side - Chat button */}
          <div className="flex space-x-1">
            <Button
              variant="outline"
              size="sm"
              className="bg-white/95 backdrop-blur-sm p-2"
              onClick={() => setShowChat(!showChat)}
              data-testid="chat-button"
            >
              <Menu className="h-3 w-3 md:h-4 md:w-4" />
              <span className="ml-1 text-xs">Chat</span>
            </Button>
          </div>

          {/* Center - Room code */}
          <div className="bg-white/95 backdrop-blur-sm px-2 md:px-4 py-2 rounded-xl shadow-lg">
            <div className="text-xs md:text-sm font-medium text-gray-800">
              Room <span className="font-mono text-uno-blue">{room?.code}</span>
            </div>
          </div>

          {/* Right side - Exit button */}
          <div className="flex space-x-1">
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

      {/* Collapsible Viewers Panel - Always shown, with host controls */}
      <div className="fixed top-20 right-0 z-20 flex items-start">
        {/* Toggle Button */}
        <button
          onClick={() => setShowSpectators(!showSpectators)}
          className="bg-white/95 backdrop-blur-sm shadow-lg rounded-l-lg p-2 hover:bg-gray-100 transition-colors border-r-0"
          data-testid="toggle-spectators"
        >
          {showSpectators ? (
            <ChevronRight className="w-4 h-4 text-gray-600" />
          ) : (
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4 text-gray-600" />
              <span className="text-xs font-medium text-gray-600">{spectators.length}</span>
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </div>
          )}
        </button>
        
        {/* Panel Content */}
        {showSpectators && (
          <UICard className="bg-white/95 backdrop-blur-sm shadow-lg rounded-l-lg rounded-r-none mr-0 max-w-xs">
            <CardContent className="p-3">
              <div className="text-sm font-medium text-gray-700 mb-2">
                Viewers ({spectators.length})
              </div>
              
              {spectators.length === 0 ? (
                <div className="text-sm text-gray-400 italic">No viewers yet</div>
              ) : (
                <div className="space-y-2">
                  {spectators.map((spectator: any) => (
                    <div key={spectator.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {spectator.nickname?.[0]?.toUpperCase()}
                        </div>
                        <span className="text-sm text-gray-600 truncate max-w-[80px]">{spectator.nickname}</span>
                      </div>
                      
                      {/* Host Controls */}
                      {isHost && (
                        <div className="flex items-center gap-1">
                          {getAvailablePositions().length > 0 && (
                            <select 
                              className="text-xs border rounded px-1 py-0.5 bg-green-50"
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleAssignToSlot(spectator.id, parseInt(e.target.value));
                                  e.target.value = '';
                                }
                              }}
                              defaultValue=""
                            >
                              <option value="" disabled>+ Add</option>
                              {getAvailablePositions().map((pos) => (
                                <option key={pos} value={pos}>Slot {pos + 1}</option>
                              ))}
                            </select>
                          )}
                          <button
                            onClick={() => handleKickPlayer(spectator.id)}
                            className="w-5 h-5 bg-red-500 rounded flex items-center justify-center text-white hover:bg-red-600"
                            title="Kick"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </UICard>
        )}
      </div>

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
        isHost={isHost}
        onKickPlayer={handleKickPlayer}
        onEditPlayer={(pid, nickname) => {
          setEditingPlayerId(pid);
          setEditingPlayerNickname(nickname);
        }}
        onMakeHost={(targetPlayerId) => {
          console.log('Make Host clicked in StreamPlayerPage:', targetPlayerId);
          assignHost(targetPlayerId);
        }}
        avatarMessages={avatarMessages}
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
      {shouldShowGameEnd && (
        <GameEndModal
          winner={gameEndData?.winner || gameState?.gameEndData?.winner || gamePlayers.find((p: any) => (p.hand?.length || 0) === 0)?.nickname || "Someone"}
          rankings={gameEndData?.rankings || gameState?.gameEndData?.rankings}
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

      {/* Nickname Editor Modal for host editing player names */}
      {editingPlayerId && (
        <NicknameEditor
          playerId={editingPlayerId}
          currentNickname={editingPlayerNickname}
          isOpen={!!editingPlayerId}
          onClose={() => {
            setEditingPlayerId(null);
            setEditingPlayerNickname("");
          }}
          onNicknameChanged={() => {
            setEditingPlayerId(null);
            setEditingPlayerNickname("");
          }}
        />
      )}
    </div>
  );
}
