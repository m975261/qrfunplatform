import { useEffect, useState, useRef } from "react";
import { useRoute, useSearch, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, QrCode, Tv, X, GripVertical, Link2, Crown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useSocket } from "@/hooks/useSocket";
import GameCard from "@/components/game/Card";
import GameEndModal from "@/components/game/GameEndModal";

interface FlyingCard {
  id: string;
  card: any;
  fromPosition: number;
  type: 'play' | 'draw';
  animating: boolean;
}

export default function StreamPage() {
  const [, params] = useRoute("/stream/:roomId");
  const search = useSearch();
  const roomId = params?.roomId;
  const roomCode = new URLSearchParams(search).get('code') || undefined;
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeData, setQRCodeData] = useState<string | null>(null);
  const [qrPosition, setQrPosition] = useState({ x: 20, y: 100 });
  const [isDraggingQR, setIsDraggingQR] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [hasSubscribed, setHasSubscribed] = useState(false);
  const [flyingCards, setFlyingCards] = useState<FlyingCard[]>([]);
  const [prevTopCardId, setPrevTopCardId] = useState<string | null>(null);
  const [prevPlayerCards, setPrevPlayerCards] = useState<{[key: string]: number}>({});
  const [prevCurrentPlayerIndex, setPrevCurrentPlayerIndex] = useState<number | null>(null);
  const [showGameEnd, setShowGameEnd] = useState(false);
  const [gameEndData, setGameEndData] = useState<{ winner: string; rankings?: any[] } | null>(null);
  const qrPanelRef = useRef<HTMLDivElement>(null);
  const qrButtonRef = useRef<HTMLButtonElement>(null);
  const [, setLocation] = useLocation();
  
  const { gameState, isConnected, streamSubscribe } = useSocket();

  useEffect(() => {
    if (isConnected && roomId && !hasSubscribed) {
      console.log("📺 StreamPage: Subscribing to room", roomId);
      streamSubscribe(roomId, roomCode);
      setHasSubscribed(true);
    }
  }, [isConnected, roomId, roomCode, hasSubscribed, streamSubscribe]);

  const { data: roomData } = useQuery({
    queryKey: ["/api/rooms", roomId],
    enabled: !!roomId,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (roomData && typeof roomData === 'object' && 'qrCode' in roomData) {
      setQRCodeData(roomData.qrCode as string);
    }
  }, [roomData]);

  const room = gameState?.room || (roomData as any)?.room;
  const players = gameState?.players || [];
  
  const gamePlayers = players.filter((p: any) => 
    !p.isSpectator && p.position !== null && p.position !== undefined
  ).sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
  
  const spectators = players.filter((p: any) => p.isSpectator && p.isOnline);

  const isPlayerOnline = (player: any): boolean => {
    return player?.isOnline || false;
  };

  const getPlayerAtPosition = (position: number) => {
    return gamePlayers.find((p: any) => p.position === position);
  };

  const getPlayerAvatar = (id: string) => {
    const savedAvatar = localStorage.getItem(`avatar_${id}`);
    if (savedAvatar === 'male') return '👨';
    if (savedAvatar === 'female') return '👩';
    return '👨';
  };

  const getCardFanStyle = (pos: number, cardIndex: number, totalCards: number) => {
    const fanSpread = totalCards > 1 ? 8 : 0;
    const centerOffset = (totalCards - 1) / 2;
    const rotation = (cardIndex - centerOffset) * fanSpread;
    
    if (pos === 0) {
      return { transform: `rotate(${rotation}deg) translateY(-2px)`, marginLeft: cardIndex > 0 ? '-8px' : '0' };
    } else if (pos === 1) {
      return { transform: `rotate(${rotation + 90}deg)`, marginTop: cardIndex > 0 ? '-8px' : '0' };
    } else if (pos === 2) {
      return { transform: `rotate(${rotation + 180}deg) translateY(2px)`, marginLeft: cardIndex > 0 ? '-8px' : '0' };
    } else {
      return { transform: `rotate(${rotation - 90}deg)`, marginTop: cardIndex > 0 ? '-8px' : '0' };
    }
  };

  const getContainerLayout = (pos: number) => {
    if (pos === 0 || pos === 2) return "flex flex-row items-center";
    return "flex flex-col items-center";
  };

  const getSlotLayout = (pos: number) => {
    if (pos === 0) return "flex flex-col items-center";
    if (pos === 1) return "flex flex-row items-center gap-1";
    if (pos === 2) return "flex flex-col-reverse items-center";
    return "flex flex-row-reverse items-center gap-1";
  };

  // Detect card plays and draws to trigger animations
  const topCard = room?.topCard || room?.discardPile?.[0];
  const topCardId = topCard ? `${topCard.color}-${topCard.type}-${topCard.number}` : null;

  useEffect(() => {
    if (!room || room.status !== 'playing') return;

    const currentIdx = room.currentPlayerIndex ?? 0;

    // Detect card played (top card changed)
    if (topCardId && prevTopCardId && topCardId !== prevTopCardId) {
      // Use the previous player index to know who played the card
      const playingPlayerIdx = prevCurrentPlayerIndex ?? currentIdx;
      const playingPlayer = gamePlayers[playingPlayerIdx];
      const playerPosition = playingPlayer?.position ?? 0;
      
      const cardId = `play-${Date.now()}`;
      setFlyingCards(prev => [...prev, {
        id: cardId,
        card: topCard,
        fromPosition: playerPosition,
        type: 'play',
        animating: false
      }]);
      
      requestAnimationFrame(() => {
        setFlyingCards(prev => prev.map(c => c.id === cardId ? { ...c, animating: true } : c));
      });
      
      setTimeout(() => {
        setFlyingCards(prev => prev.filter(c => c.id !== cardId));
      }, 400);
    }
    setPrevTopCardId(topCardId);
    setPrevCurrentPlayerIndex(currentIdx);

    // Detect card draws (player card count increased)
    const newPlayerCards: {[key: string]: number} = {};
    gamePlayers.forEach((p: any) => {
      const count = p.cardCount || p.hand?.length || 0;
      newPlayerCards[p.id] = count;
      
      if (prevPlayerCards[p.id] !== undefined && count > prevPlayerCards[p.id]) {
        const cardId = `draw-${Date.now()}-${p.id}`;
        setFlyingCards(prev => [...prev, {
          id: cardId,
          card: { color: 'back', type: 'back' },
          fromPosition: p.position,
          type: 'draw',
          animating: false
        }]);
        
        requestAnimationFrame(() => {
          setFlyingCards(prev => prev.map(c => c.id === cardId ? { ...c, animating: true } : c));
        });
        
        setTimeout(() => {
          setFlyingCards(prev => prev.filter(c => c.id !== cardId));
        }, 400);
      }
    });
    setPrevPlayerCards(newPlayerCards);
  }, [topCardId, gamePlayers, room?.status, prevTopCardId, prevPlayerCards, topCard, prevCurrentPlayerIndex, room?.currentPlayerIndex]);

  // Position helpers for flying card animations
  const getPositionCoords = (pos: number) => {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const radius = Math.min(window.innerWidth, window.innerHeight) * 0.25;
    
    switch (pos) {
      case 0: return { x: centerX, y: centerY - radius };
      case 1: return { x: centerX + radius, y: centerY };
      case 2: return { x: centerX, y: centerY + radius };
      case 3: return { x: centerX - radius, y: centerY };
      default: return { x: centerX, y: centerY };
    }
  };

  const handleQRDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDraggingQR(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragStartPos({ x: clientX - qrPosition.x, y: clientY - qrPosition.y });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!isDraggingQR) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      setQrPosition({
        x: Math.max(0, Math.min(window.innerWidth - 256, clientX - dragStartPos.x)),
        y: Math.max(0, Math.min(window.innerHeight - 300, clientY - dragStartPos.y))
      });
    };

    const handleMouseUp = () => setIsDraggingQR(false);

    if (isDraggingQR) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleMouseMove);
      document.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDraggingQR, dragStartPos]);

  // Game end detection - same logic as normal mode
  useEffect(() => {
    if (room?.status === "finished") {
      setShowGameEnd(true);
    }
    
    if (gameState?.gameEndData) {
      setGameEndData(gameState.gameEndData);
      setShowGameEnd(true);
    }
  }, [room?.status, gameState?.gameEndData]);

  const handlePlayAgain = () => {
    setShowGameEnd(false);
    setGameEndData(null);
    // Stream page goes back to lobby view
    if (roomId) {
      setLocation(`/stream/${roomId}/lobby?code=${room?.code}`);
    }
  };

  const handleBackToLobby = () => {
    setShowGameEnd(false);
    setGameEndData(null);
    setLocation('/');
  };

  const handleCopyCode = () => {
    if (room?.code) {
      navigator.clipboard.writeText(room.code);
    }
  };

  const handleCopyLink = () => {
    if (room?.code) {
      const baseUrl = window.location.origin;
      const joinLink = `${baseUrl}?room=${room.code}`;
      navigator.clipboard.writeText(joinLink);
    }
  };

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 text-white p-8">
          <div className="text-center">
            <Tv className="w-16 h-16 mx-auto mb-4 text-purple-400" />
            <h2 className="text-2xl font-bold mb-2">Stream Page Loading...</h2>
            <p className="text-gray-400">Connecting to room...</p>
          </div>
        </Card>
      </div>
    );
  }

  const isPlaying = room.status === 'playing';
  const currentPlayerIndex = room.currentPlayerIndex;
  const currentGamePlayer = gamePlayers[currentPlayerIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Flying Cards Animation Overlay */}
      {flyingCards.map((fc) => {
        const playerCoords = getPositionCoords(fc.fromPosition);
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2 - 50;
        
        const startX = fc.type === 'play' ? playerCoords.x : centerX;
        const startY = fc.type === 'play' ? playerCoords.y : centerY;
        const endX = fc.type === 'play' ? centerX : playerCoords.x;
        const endY = fc.type === 'play' ? centerY : playerCoords.y;
        
        const x = fc.animating ? endX : startX;
        const y = fc.animating ? endY : startY;
        const scale = fc.animating ? 0.9 : 0.6;
        
        return (
          <div
            key={fc.id}
            className="fixed pointer-events-none z-[100]"
            style={{
              left: x,
              top: y,
              transform: `translate(-50%, -50%) scale(${scale})`,
              opacity: fc.animating ? 1 : 0.7,
              transition: 'all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            }}
          >
            {fc.type === 'play' && fc.card ? (
              <GameCard card={fc.card} size="medium" interactive={false} />
            ) : (
              <div className="w-12 h-16 bg-gradient-to-br from-red-600 to-red-800 rounded-lg border-2 border-red-400 shadow-xl flex items-center justify-center">
                <span className="text-yellow-300 text-[8px] font-bold">UNO</span>
              </div>
            )}
          </div>
        );
      })}

      {/* Header Bar - Similar to GameFixed */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-slate-900/90 backdrop-blur-sm border-b border-slate-700">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600 px-3 py-1 rounded-full flex items-center gap-2">
              <Tv className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-bold">STREAM</span>
            </div>
            {isConnected && (
              <div className="bg-green-500 px-3 py-1 rounded-full animate-pulse">
                <span className="text-white text-sm font-bold">LIVE</span>
              </div>
            )}
            <span className="text-white font-mono text-lg">{room?.code}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              onClick={handleCopyLink}
              variant="outline"
              size="sm"
              className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
            >
              <Link2 className="mr-1 h-4 w-4" />
              Link
            </Button>
            <Button
              ref={qrButtonRef}
              onClick={() => {
                if (!showQRCode && qrButtonRef.current) {
                  const rect = qrButtonRef.current.getBoundingClientRect();
                  setQrPosition({ x: rect.left - 200, y: rect.bottom + 8 });
                }
                setShowQRCode(!showQRCode);
              }}
              variant="outline"
              size="sm"
              className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
            >
              <QrCode className="mr-1 h-4 w-4" />
              QR
            </Button>
          </div>
        </div>
      </div>

      {/* Turn Indicator Banner */}
      {isPlaying && currentGamePlayer && (
        <div className="fixed top-14 left-0 right-0 z-30 flex justify-center pointer-events-none">
          <div className="bg-gradient-to-r from-green-500/90 to-emerald-500/90 text-white px-6 py-2 rounded-full shadow-lg">
            <span className="font-bold">{currentGamePlayer.nickname}'s Turn</span>
          </div>
        </div>
      )}

      {/* === UNO TABLE (Centered + Responsive) - Same as GameFixed === */}
      <section className="relative w-full h-screen flex items-center justify-center bg-transparent pt-16">
        <div
          className="relative aspect-square w-[min(80vmin,450px)]"
          style={{
            ['--r' as any]: 'calc(var(--center) / 2 + var(--avatar) / 2 + 8px)',
            ['--avatar' as any]: 'clamp(60px, 11vmin, 76px)',
            ['--center' as any]: 'clamp(90px, 16vmin, 130px)',
            ['--gap' as any]: 'clamp(8px, 2vmin, 16px)',
          }}
        >
          {/* === CENTER CIRCLE BACKGROUND - Same as StreamGameBoard === */}
          <div className="absolute inset-[20%] rounded-full bg-gradient-to-br from-slate-700 to-slate-800 shadow-2xl border-4 border-slate-600" />

          {/* === CENTER CONTENT (Draw Pile + Played Card) === */}
          <div className="absolute inset-0 flex items-center justify-center z-30">
            <div className="flex items-center gap-2 md:gap-3">
              {/* Draw Pile */}
              <div className="w-10 h-14 md:w-14 md:h-20 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg border-2 border-blue-400 shadow-xl flex items-center justify-center">
                <div className="text-white text-[8px] md:text-xs font-bold text-center">
                  DRAW
                </div>
              </div>

              {/* Played Card */}
              {topCard ? (
                <div className="transform scale-75 md:scale-100">
                  <GameCard card={topCard} size="large" interactive={false} />
                </div>
              ) : (
                <div className="w-14 h-20 md:w-20 md:h-28 bg-gradient-to-br from-red-500 to-red-700 rounded-xl border-2 border-white shadow-xl flex items-center justify-center">
                  <div className="text-white font-bold text-lg">UNO</div>
                </div>
              )}
            </div>

            {/* Current color indicator for wild cards */}
            {room?.currentColor && topCard && (topCard.type === 'wild' || topCard.type === 'wild4') && (
              <div className="absolute -bottom-6 md:-bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center">
                <div
                  className={`w-5 h-5 md:w-6 md:h-6 rounded-full border-2 border-white shadow-lg ${
                    room.currentColor === 'red' ? 'bg-red-500'
                    : room.currentColor === 'yellow' ? 'bg-yellow-500'
                    : room.currentColor === 'blue' ? 'bg-blue-500'
                    : room.currentColor === 'green' ? 'bg-green-500'
                    : 'bg-gray-500'
                  }`}
                />
                <span className="text-[8px] md:text-[10px] text-white font-bold mt-0.5 uppercase">{room.currentColor}</span>
              </div>
            )}
          </div>

          {/* === 4 AVATAR POSITIONS AROUND THE CIRCLE === */}
          {[0, 1, 2, 3].map((position) => {
            const player = getPlayerAtPosition(position);
            const isOnline = player ? isPlayerOnline(player) : false;
            const isPlayerTurn = currentGamePlayer?.id === player?.id;
            const cardCount = player ? (player.cardCount || player.hand?.length || 0) : 0;

            const posClass =
              position === 0
                ? 'top-[calc(50%-var(--r))] left-1/2 -translate-x-1/2 -translate-y-1/2'
                : position === 1
                ? 'left-[calc(50%+var(--r))] top-1/2 -translate-x-1/2 -translate-y-1/2'
                : position === 2
                ? 'top-[calc(50%+var(--r))] left-1/2 -translate-x-1/2 -translate-y-1/2'
                : 'left-[calc(50%-var(--r))] top-1/2 -translate-x-1/2 -translate-y-1/2';

            const displayCardCount = Math.min(cardCount, 10);

            const renderCardFan = () => {
              if (!isPlaying || cardCount === 0) return null;
              return (
                <div className={`relative ${getContainerLayout(position)}`}>
                  {Array.from({ length: displayCardCount }).map((_, i) => (
                    <div
                      key={i}
                      className="w-4 h-6 md:w-5 md:h-7 bg-gradient-to-br from-red-600 to-red-800 rounded-sm border border-red-400 shadow-md"
                      style={{
                        ...getCardFanStyle(position, i, displayCardCount),
                        zIndex: i,
                      }}
                    >
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-yellow-300 text-[4px] md:text-[5px] font-bold">UNO</span>
                      </div>
                    </div>
                  ))}
                  {cardCount > 10 && (
                    <div className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[6px] px-1 rounded-full font-bold z-20">
                      +{cardCount - 10}
                    </div>
                  )}
                </div>
              );
            };

            const renderAvatar = () => (
              <div className="relative flex flex-col items-center">
                <div
                  className={`rounded-full flex items-center justify-center text-white font-bold shadow-lg border-3 bg-gradient-to-br from-uno-blue to-uno-purple transition-all ${
                    isPlayerTurn ? 'border-green-400 ring-2 ring-green-400/50 scale-105' : 'border-white/20'
                  }`}
                  style={{ width: 'clamp(50px, 10vmin, 70px)', height: 'clamp(50px, 10vmin, 70px)' }}
                >
                  <div className="text-2xl md:text-3xl">{player ? getPlayerAvatar(player.id) : ''}</div>
                </div>
                {player && (
                  <>
                    <div
                      className={`mt-0.5 px-1.5 py-0.5 rounded-full text-[8px] md:text-[10px] font-bold shadow-lg max-w-[60px] truncate ${
                        isPlayerTurn ? 'bg-green-500 text-white' : 'bg-black/70 text-white'
                      }`}
                    >
                      {player.nickname} {isPlayerTurn && '⭐'}
                    </div>
                    <div
                      className={`absolute top-0 -right-0.5 w-2.5 h-2.5 md:w-3 md:h-3 rounded-full border border-white ${
                        isOnline ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                    {player.id === room?.hostId && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                        <Crown className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      </div>
                    )}
                    <div className="absolute -bottom-1 -left-1 bg-slate-800 text-white text-[7px] md:text-[8px] px-1 py-0.5 rounded-full font-bold shadow border border-slate-600">
                      {cardCount}
                    </div>
                    {player.hasCalledUno && cardCount <= 1 && (
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[6px] px-1 py-0.5 rounded-full font-bold animate-pulse whitespace-nowrap">
                        UNO!
                      </div>
                    )}
                  </>
                )}
              </div>
            );

            return (
              <div key={position} className={`absolute ${posClass} z-20`}>
                {player ? (
                  <div className={`${getSlotLayout(position)} transition-all duration-300 ${isPlayerTurn ? 'scale-105' : ''}`}>
                    {(position === 0 || position === 3) && renderCardFan()}
                    {renderAvatar()}
                    {(position === 1 || position === 2) && renderCardFan()}
                  </div>
                ) : (
                  <div
                    className="rounded-full flex items-center justify-center border-4 bg-slate-700/50 border-slate-600"
                    style={{ width: 'clamp(50px, 10vmin, 70px)', height: 'clamp(50px, 10vmin, 70px)' }}
                  >
                    <div className="text-slate-500 text-xs font-medium">Empty</div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Direction Indicator */}
          {isPlaying && (
            <div className="absolute top-12 left-12 z-20">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex flex-col items-center justify-center border-2 border-yellow-300 shadow-lg">
                <span className="text-xl">{room.direction === 'clockwise' ? '↻' : '↺'}</span>
                <span className="text-[8px] font-bold text-black">DIR</span>
              </div>
            </div>
          )}

          {/* Draw Pile (Read-only, no interaction) */}
          <div className="absolute z-20 bottom-2 left-2">
            <div className="w-14 h-20 bg-gradient-to-br from-red-600 via-red-500 to-red-700 rounded-xl border-3 border-red-800 shadow-2xl flex items-center justify-center cursor-default">
              <span className="text-white font-bold text-sm transform -rotate-12">UNO</span>
            </div>
            <div className="text-center text-xs text-slate-400 mt-1">DECK</div>
          </div>
        </div>
      </section>

      {/* Viewers Area - Right Side */}
      <div className="fixed z-20" style={{
        top: '5rem',
        bottom: '2rem',
        right: '0.5rem',
        width: 'min(16rem, 20vw)'
      }}>
        <div className="bg-slate-800/90 backdrop-blur-sm rounded-xl p-3 shadow-lg h-full flex flex-col border border-slate-700">
          <div className="text-xs font-semibold text-gray-300 mb-3 flex-shrink-0">
            Viewers ({spectators.length})
          </div>
          <div className="space-y-2 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
            {spectators.length > 0 ? (
              spectators.map((spectator: any) => (
                <div key={spectator.id} className="flex items-center space-x-2 p-2 rounded-lg bg-slate-700/50">
                  <div className="w-6 h-6 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                    {spectator.nickname?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-xs text-gray-300 truncate flex-1">{spectator.nickname}</span>
                  <div className={`w-2 h-2 rounded-full ${spectator.isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-500 text-center py-4">
                Waiting for viewers...
              </div>
            )}
          </div>
          <div className="text-[10px] text-slate-500 text-center mt-2 pt-2 border-t border-slate-700">
            {gamePlayers.length}/4 Players • {room.status === 'playing' ? 'Game Active' : 'Waiting'}
          </div>
        </div>
      </div>

      {/* QR Code Floating Panel */}
      {showQRCode && qrCodeData && (
        <div
          ref={qrPanelRef}
          className="fixed z-50 select-none"
          style={{
            left: qrPosition.x,
            top: qrPosition.y,
            cursor: isDraggingQR ? 'grabbing' : 'default'
          }}
        >
          <Card className="w-64 shadow-2xl border-2 border-purple-500/50 bg-slate-800/98 backdrop-blur-sm">
            <CardContent className="p-4">
              <div
                className="flex items-center justify-between mb-3 cursor-grab active:cursor-grabbing"
                onMouseDown={handleQRDragStart}
                onTouchStart={handleQRDragStart}
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-white">Scan to Join</span>
                </div>
                <button
                  onClick={() => setShowQRCode(false)}
                  className="p-1 hover:bg-slate-700 rounded"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <div className="bg-white p-3 rounded-lg flex justify-center">
                <img src={qrCodeData} alt="QR Code" className="w-full h-auto" />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="font-mono text-lg font-bold text-white">{room?.code}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyCode}
                  className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Game End Modal - Same as normal mode */}
      {showGameEnd && gameEndData && (
        <GameEndModal
          winner={gameEndData.winner}
          rankings={gameEndData.rankings}
          onPlayAgain={handlePlayAgain}
          onBackToLobby={handleBackToLobby}
        />
      )}
    </div>
  );
}
