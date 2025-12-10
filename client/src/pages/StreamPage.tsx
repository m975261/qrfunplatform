import { useEffect, useState, useRef } from "react";
import { useRoute, useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, QrCode, Tv, X, GripVertical, Link2, Crown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useSocket } from "@/hooks/useSocket";
import { useToast } from "@/hooks/use-toast";
import GameCard from "@/components/game/Card";

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
  const qrPanelRef = useRef<HTMLDivElement>(null);
  const qrButtonRef = useRef<HTMLButtonElement>(null);
  const { toast } = useToast();
  
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
  );
  
  const spectators = players.filter((p: any) => p.isSpectator && p.isOnline);

  const isPlayerOnline = (player: any): boolean => {
    return player?.isOnline || false;
  };

  const getPlayerAtPosition = (position: number) => {
    return gamePlayers.find((p: any) => p.position === position);
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

  const handleCopyCode = () => {
    if (room?.code) {
      navigator.clipboard.writeText(room.code);
      toast({ title: "Room code copied!", duration: 1500 });
    }
  };

  const handleCopyLink = () => {
    if (room?.code) {
      const baseUrl = window.location.origin;
      const joinLink = `${baseUrl}?room=${room.code}`;
      navigator.clipboard.writeText(joinLink);
      toast({ title: "Join link copied!", description: "Share this link with players", duration: 2000 });
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
  const topCard = room.topCard || room.discardPile?.[room.discardPile?.length - 1];
  const currentPlayerIndex = room.currentPlayerIndex;
  const currentGamePlayer = gamePlayers.find((p: any) => p.position === currentPlayerIndex);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
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
          {/* === CENTER AREA === */}
          <div className="absolute inset-0 grid place-items-center z-10">
            <div className="relative">
              <div
                className="absolute -z-10 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-slate-600 shadow-2xl bg-gradient-to-br from-slate-700 to-slate-800"
                style={{ width: 'var(--center)', height: 'var(--center)' }}
              />
              <div className="flex flex-col items-center space-y-2">
                {topCard ? (
                  <div className="flex flex-col items-center">
                    <GameCard card={topCard} size="small" interactive={false} />
                    {room?.currentColor && (topCard.type === 'wild' || topCard.type === 'wild4') && (
                      <div className="flex flex-col items-center mt-2">
                        <div
                          className={`w-6 h-6 rounded-full border-2 border-white ${
                            room.currentColor === 'red'
                              ? 'bg-red-500'
                              : room.currentColor === 'yellow'
                              ? 'bg-yellow-500'
                              : room.currentColor === 'blue'
                              ? 'bg-blue-500'
                              : room.currentColor === 'green'
                              ? 'bg-green-500'
                              : 'bg-gray-500'
                          }`}
                        />
                        <span className="text-xs text-white font-bold mt-1">
                          Active: {room.currentColor}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-16 h-24 bg-gradient-to-br from-red-500 to-red-700 rounded-lg border-2 border-red-300 shadow-xl flex items-center justify-center">
                    <div className="text-white font-bold text-lg">UNO</div>
                  </div>
                )}
              </div>
            </div>
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

            return (
              <div key={position} className={`absolute ${posClass} z-20`}>
                <div className="relative">
                  {player ? (
                    <div className="relative">
                      {/* Avatar Circle */}
                      <div
                        className={`rounded-full flex items-center justify-center text-white font-bold shadow-lg border-4 bg-gradient-to-br from-uno-blue to-uno-purple ${
                          isPlayerTurn ? 'border-green-400 ring-2 ring-green-400/50' : 'border-white/20'
                        }`}
                        style={{ width: 'var(--avatar)', height: 'var(--avatar)' }}
                      >
                        <div className="text-2xl">{player.nickname[0].toUpperCase()}</div>
                      </div>

                      {/* Nickname pill */}
                      <div
                        className={`absolute text-xs font-semibold text-white bg-black/70 px-2 py-1 rounded-full whitespace-nowrap ${
                          position === 0 ? 'left-full top-1/2 -translate-y-1/2 ml-2'
                          : position === 1 ? 'top-full left-1/2 -translate-x-1/2 mt-2'
                          : position === 2 ? 'right-3/4 top-full mt-2'
                          : 'right-1/4 bottom-full -translate-x-1/2 mb-2'
                        }`}
                      >
                        {player.nickname}
                      </div>

                      {/* Online badge */}
                      <div
                        className={`absolute -top-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${
                          isOnline ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />

                      {/* Host crown */}
                      {player.id === room?.hostId && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <Crown className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                        </div>
                      )}

                      {/* Card count during game - HIDDEN CARDS (just show count) */}
                      {isPlaying && (
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gray-800 px-2 py-0.5 rounded text-xs text-white flex items-center gap-1">
                          <span>🎴</span>
                          <span>{cardCount}</span>
                        </div>
                      )}

                      {/* Current turn indicator */}
                      {isPlayerTurn && (
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-bounce">
                          TURN
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Empty Slot */
                    <div
                      className="rounded-full flex items-center justify-center border-4 bg-slate-700/50 border-slate-600"
                      style={{ width: 'var(--avatar)', height: 'var(--avatar)' }}
                    >
                      <div className="text-slate-500 text-xs font-medium">Empty</div>
                    </div>
                  )}
                </div>
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
    </div>
  );
}
