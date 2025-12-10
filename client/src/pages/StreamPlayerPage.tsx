import { useEffect, useState } from "react";
import { useRoute, useSearch, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tv, Home, AlertTriangle } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { useToast } from "@/hooks/use-toast";
import GameCard from "@/components/game/Card";
import ColorPickerModal from "@/components/game/ColorPickerModal";

// Host disconnect countdown component for streaming mode
function StreamingHostDisconnectBanner({ deadlineMs, hostName }: { deadlineMs: number, hostName: string }) {
  const [secondsLeft, setSecondsLeft] = useState(30);
  
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
      setSecondsLeft(remaining);
    }, 100);
    return () => clearInterval(interval);
  }, [deadlineMs]);
  
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white p-4 shadow-lg animate-pulse">
      <div className="max-w-4xl mx-auto flex items-center justify-center gap-3">
        <AlertTriangle className="w-6 h-6" />
        <span className="font-bold text-lg">
          Host "{hostName}" disconnected! Redirecting in {secondsLeft}s...
        </span>
      </div>
    </div>
  );
}

export default function StreamPlayerPage() {
  const [, playerParams] = useRoute("/stream/:roomId/player/:slot");
  const [, hostParams] = useRoute("/stream/:roomId/host/game");
  const search = useSearch();
  const [, setLocation] = useLocation();
  
  const roomId = playerParams?.roomId || hostParams?.roomId;
  const slot = playerParams?.slot ? parseInt(playerParams.slot) : 1;
  const isHostGame = !!hostParams?.roomId;
  const roomCode = new URLSearchParams(search).get('code') || undefined;
  
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [handRefreshKey, setHandRefreshKey] = useState(0);
  const { toast } = useToast();
  
  const { 
    gameState, 
    setGameState,
    joinRoom, 
    playCard, 
    drawCard, 
    chooseColor,
    callUno,
    isConnected 
  } = useSocket();

  const playerId = localStorage.getItem("playerId");

  useEffect(() => {
    if (isConnected && roomId && playerId) {
      joinRoom(playerId, roomId);
    }
  }, [isConnected, roomId, playerId, joinRoom]);

  useEffect(() => {
    if (gameState?.colorChoiceRequested || (gameState?.room?.waitingForColorChoice === playerId)) {
      setShowColorPicker(true);
    }
  }, [gameState?.colorChoiceRequested, gameState?.room?.waitingForColorChoice, playerId]);

  const room = gameState?.room;
  const players = gameState?.players || [];
  
  const myPlayer = players.find((p: any) => p.id === playerId);
  const myHand = myPlayer?.hand || [];
  const isMyTurn = room?.currentPlayerIndex === myPlayer?.position;
  
  const gamePlayers = players.filter((p: any) => 
    !p.isSpectator && p.position !== null && p.position !== undefined
  );

  const topCard = room?.topCard || room?.discardPile?.[room?.discardPile?.length - 1];
  const currentColor = room?.currentColor;

  const canPlayCard = (card: any) => {
    if (!topCard || !isMyTurn) return false;
    if (card.type === 'wild' || card.type === 'wild4') return true;
    if (card.color === currentColor) return true;
    if (card.color === topCard.color) return true;
    if (card.type === 'number' && topCard.type === 'number' && card.number === topCard.number) return true;
    if (card.type === topCard.type && card.type !== 'number') return true;
    return false;
  };

  const handlePlayCard = (cardIndex: number) => {
    const card = myHand[cardIndex];
    if (!card || !canPlayCard(card)) return;
    playCard(cardIndex);
  };

  const handleColorChoice = (color: string) => {
    chooseColor(color as 'red' | 'yellow' | 'green' | 'blue');
    setShowColorPicker(false);
    
    setGameState((prev: any) => ({
      ...prev,
      colorChoiceRequested: false,
      selectedColor: color,
      room: {
        ...prev?.room,
        currentColor: color,
        waitingForColorChoice: null
      },
      forceRefresh: Math.random(),
    }));
    
    setHandRefreshKey(prev => prev + 1);
    setTimeout(() => setHandRefreshKey(prev => prev + 1), 1);
    setTimeout(() => setHandRefreshKey(prev => prev + 1), 5);
    setTimeout(() => setHandRefreshKey(prev => prev + 1), 10);
  };

  const handleDrawCard = () => {
    if (isMyTurn) {
      drawCard();
    }
  };

  const handleCallUno = () => {
    if (!myPlayer?.hasCalledUno) {
      callUno();
      toast({ title: "UNO!", duration: 1500 });
    }
  };

  const getPlayerAvatar = (id: string, nickname: string) => {
    const avatarKey = `avatar_${id}`;
    const savedAvatar = localStorage.getItem(avatarKey);
    if (savedAvatar) return savedAvatar;
    return nickname?.[0]?.toUpperCase() || '?';
  };

  if (!room || room.status !== 'playing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-uno-blue via-uno-purple to-uno-red flex items-center justify-center p-4">
        <Card className="bg-white/95 backdrop-blur-sm shadow-xl p-8 text-center">
          <Tv className="w-16 h-16 mx-auto mb-4 text-purple-600" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Waiting for Game to Start</h2>
          <p className="text-gray-600">You are {isHostGame ? 'the Host' : `Player ${slot}`}</p>
          <p className="text-sm text-gray-500 mt-2">The host will start the game soon...</p>
        </Card>
      </div>
    );
  }

  const currentPlayerIndex = room.currentPlayerIndex;
  const currentGamePlayer = gamePlayers.find((p: any) => p.position === currentPlayerIndex);

  const getColorClass = (color: string) => {
    switch (color) {
      case 'red': return 'bg-uno-red';
      case 'yellow': return 'bg-uno-yellow';
      case 'green': return 'bg-uno-green';
      case 'blue': return 'bg-uno-blue';
      default: return 'bg-gray-500';
    }
  };

  // Handle streaming host disconnect
  const streamingHostDisconnected = gameState?.streamingHostDisconnected;
  const streamingHostDeadlineMs = gameState?.streamingHostDeadlineMs;
  const streamingHostName = gameState?.streamingHostName;

  return (
    <div className="min-h-screen bg-gradient-to-br from-uno-blue via-uno-purple to-uno-red relative overflow-hidden">
      {streamingHostDisconnected && streamingHostDeadlineMs && (
        <StreamingHostDisconnectBanner 
          deadlineMs={streamingHostDeadlineMs} 
          hostName={streamingHostName || "Host"} 
        />
      )}
      <style>{`
        :root {
          --r: min(35vw, 35vh, 180px);
          --avatar: clamp(48px, 8vw, 80px);
        }
      `}</style>
      
      {/* Header - Same style as GameFixed */}
      <div className={`fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-sm shadow-lg ${streamingHostDisconnected ? 'top-16' : ''}`}>
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/")}
              className="text-gray-600 hover:text-gray-800"
            >
              <Home className="w-5 h-5" />
            </Button>
            <div className="bg-gradient-to-r from-uno-red to-uno-purple px-3 py-1 rounded-full flex items-center gap-2">
              <Tv className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-bold">{isHostGame ? 'HOST' : `PLAYER ${slot}`}</span>
            </div>
            <span className="font-mono text-gray-700 font-bold">{room?.code}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
              isMyTurn 
                ? 'bg-green-500 text-white animate-pulse' 
                : 'bg-gray-200 text-gray-600'
            }`}>
              {isMyTurn ? "YOUR TURN" : `${currentGamePlayer?.nickname}'s Turn`}
            </span>
          </div>
        </div>
      </div>

      {/* Turn Banner */}
      {isMyTurn && (
        <div className="fixed top-14 left-0 right-0 z-30 flex justify-center pointer-events-none">
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-2 rounded-full shadow-lg animate-pulse">
            <span className="font-bold">It's Your Turn! Play a card or draw</span>
          </div>
        </div>
      )}

      {/* Main Game Area - 12x12 CSS Grid like GameFixed */}
      <section 
        className="relative w-full min-h-screen pt-20 pb-40"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gridTemplateRows: 'repeat(12, 1fr)',
          gap: '0.5rem',
          padding: '1rem'
        }}
      >
        {/* Center Circle with Discard Pile */}
        <div 
          className="flex items-center justify-center"
          style={{
            gridColumn: '5 / 9',
            gridRow: '4 / 8'
          }}
        >
          <div className="relative">
            <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-sm border-4 border-white/40 shadow-2xl flex items-center justify-center">
              {topCard ? (
                <GameCard card={topCard} size="medium" interactive={false} />
              ) : (
                <div className="w-16 h-24 bg-gradient-to-br from-uno-red to-red-700 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-lg">UNO</span>
                </div>
              )}
            </div>
            
            {/* Current Color Indicator */}
            {currentColor && (
              <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/90 px-4 py-2 rounded-full shadow-lg">
                <div className={`w-6 h-6 rounded-full border-2 border-white shadow-md ${getColorClass(currentColor)}`} />
                <span className="text-sm font-bold text-gray-700 uppercase">{currentColor}</span>
              </div>
            )}

            {/* Direction Indicator */}
            <div className="absolute -top-2 -left-2 w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center border-2 border-white shadow-lg">
              <span className="text-xl">{room.direction === 'clockwise' ? '↻' : '↺'}</span>
            </div>
          </div>
        </div>

        {/* Draw Button */}
        {isMyTurn && (
          <div 
            className="flex items-center justify-center"
            style={{
              gridColumn: '10 / 12',
              gridRow: '5 / 7'
            }}
          >
            <div className="relative cursor-pointer group" onClick={handleDrawCard}>
              <div className="bg-gradient-to-br from-blue-700 to-blue-900 rounded-xl border-4 border-blue-500 shadow-xl group-hover:shadow-blue-500/50 transition-all w-16 h-24">
                <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg border-2 border-blue-400 shadow-lg absolute -top-1 -left-1 w-16 h-24"></div>
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-white font-bold text-xs">DRAW</span>
              </div>
            </div>
          </div>
        )}

        {/* Other Players Display */}
        <div 
          className="flex flex-wrap items-center justify-center gap-3"
          style={{
            gridColumn: '2 / 12',
            gridRow: '2 / 4'
          }}
        >
          {gamePlayers.filter((p: any) => p.id !== playerId).map((player: any) => {
            const isPlayerTurn = currentPlayerIndex === player.position;
            const cardCount = player.cardCount || player.hand?.length || 0;
            return (
              <Card
                key={player.id}
                className={`bg-white/95 backdrop-blur-sm shadow-lg transition-all ${
                  isPlayerTurn ? 'ring-4 ring-green-500 scale-105' : ''
                }`}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                    isPlayerTurn 
                      ? 'bg-gradient-to-br from-green-400 to-green-600' 
                      : 'bg-gradient-to-br from-uno-blue to-uno-purple'
                  }`}>
                    {getPlayerAvatar(player.id, player.nickname)}
                  </div>
                  <div>
                    <div className={`font-semibold ${isPlayerTurn ? 'text-green-600' : 'text-gray-800'}`}>
                      {player.nickname} {isPlayerTurn && '⭐'}
                    </div>
                    <div className="text-xs text-gray-500">{cardCount} cards</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Player Hand Area - Fixed at bottom, same style as GameFixed */}
      {myPlayer && !myPlayer.isSpectator && (
        <div className="fixed bottom-0 left-0 right-0 z-30">
          <div className="bg-gradient-to-t from-slate-800/95 to-slate-800/90 backdrop-blur-md px-2 pb-10" style={{
            height: 'max(22vh, 140px)'
          }}>
            
            {/* Player Info Header */}
            <div className="flex items-center justify-between mb-2 px-2">
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm border-2 ${
                  isMyTurn ? 'bg-gradient-to-br from-green-400 to-green-600 border-green-300' : 'bg-gradient-to-br from-blue-400 to-blue-600 border-blue-300'
                }`}>
                  {getPlayerAvatar(myPlayer.id, myPlayer.nickname)}
                </div>
                <div className="ml-2">
                  <div className={`font-semibold text-white text-sm ${isMyTurn ? 'text-green-400' : ''}`}>
                    {myPlayer.nickname}
                  </div>
                  <div className="text-xs text-slate-400">
                    {myHand.length} cards
                  </div>
                </div>
                {isMyTurn && (
                  <div className="ml-3">
                    <div className="bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs font-bold border border-green-500/30">
                      YOUR TURN ⭐
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* UNO Button */}
            {myHand.length <= 2 && (
              <div className="absolute top-2 right-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="font-bold border-2 transition-all bg-red-600 border-red-500 text-white hover:bg-red-700 animate-pulse text-xs px-3 py-1"
                  onClick={handleCallUno}
                >
                  🔥 UNO! 🔥
                </Button>
              </div>
            )}

            {/* Player Cards */}
            <div className="overflow-x-auto overflow-y-visible px-1">
              {myHand && myHand.length > 0 ? (
                <div key={`hand-${handRefreshKey}`} className="flex space-x-1 min-w-max h-full items-center py-1 justify-center">
                  {myHand.map((card: any, index: number) => {
                    const isPlayable = canPlayCard(card);
                    return (
                      <div 
                        key={index} 
                        className={`transition-all duration-200 flex-shrink-0 ${
                          isMyTurn && isPlayable 
                            ? 'hover:scale-110 hover:-translate-y-3 cursor-pointer' 
                            : 'opacity-60'
                        }`}
                        onClick={() => {
                          if (!isMyTurn || !isPlayable) return;
                          handlePlayCard(index);
                        }}
                      >
                        <GameCard
                          card={card}
                          size="extra-small"
                          selected={false}
                          disabled={!isMyTurn || !isPlayable}
                        />
                      </div>
                    );
                  })}
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

      {/* Spectator View */}
      {myPlayer && myPlayer.isSpectator && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-slate-800/95 to-slate-800/90 backdrop-blur-md">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-center">
              <div className="bg-slate-700/80 px-6 py-3 rounded-lg border border-slate-600">
                <div className="text-center">
                  <div className="text-slate-300 text-sm mb-2">You are watching as a spectator</div>
                  <div className="text-xs text-slate-400">
                    Current turn: <span className="text-green-400 font-medium">{currentGamePlayer?.nickname || 'Unknown'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Color Picker Modal */}
      {showColorPicker && (
        <ColorPickerModal
          onChooseColor={handleColorChoice}
          onClose={() => setShowColorPicker(false)}
        />
      )}
    </div>
  );
}
