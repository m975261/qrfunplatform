import { useEffect, useState, useRef } from "react";
import { useRoute, useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, QrCode, Tv, X, GripVertical, Link2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useSocket } from "@/hooks/useSocket";
import { useToast } from "@/hooks/use-toast";
import GameCard from "@/components/game/Card";

export default function StreamGamePage() {
  const [, params] = useRoute("/stream/:roomId/game");
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
      console.log("📺 StreamGamePage: Subscribing to room", roomId);
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
      const joinLink = `${baseUrl}/?room=${room.code}`;
      navigator.clipboard.writeText(joinLink);
      toast({ title: "Join link copied!", duration: 2000 });
    }
  };

  const getPlayerAtPosition = (position: number) => {
    return gamePlayers.find((player: any) => player.position === position) || null;
  };

  const getPlayerAvatar = (id: string, nickname: string) => {
    const savedAvatar = localStorage.getItem(`avatar_${id}`);
    if (savedAvatar === 'male') return '👨';
    if (savedAvatar === 'female') return '👩';
    return '👨';
  };

  const isPlayerOnline = (player: any) => {
    if (!player) return false;
    const playerData = players.find((p: any) => p.id === player.id);
    return playerData?.isOnline !== false;
  };

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 text-white p-8">
          <div className="text-center">
            <Tv className="w-16 h-16 mx-auto mb-4 text-purple-400" />
            <h2 className="text-2xl font-bold mb-2">Stream Game Loading...</h2>
            <p className="text-gray-400">Connecting to game...</p>
          </div>
        </Card>
      </div>
    );
  }

  const topCard = room?.topCard || room?.discardPile?.[room?.discardPile?.length - 1];
  const currentPlayerIndex = room?.currentPlayerIndex;
  const currentGamePlayer = gamePlayers.find((p: any) => p.position === currentPlayerIndex);
  const currentColor = room?.currentColor;
  const pendingDraw = room?.pendingDraw ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      <div className="fixed top-0 left-0 right-0 z-40 bg-slate-900/90 backdrop-blur-sm border-b border-slate-700">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600 px-3 py-1 rounded-full flex items-center gap-2">
              <Tv className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-bold">OBS VIEW</span>
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

      {currentGamePlayer && (
        <div className={`fixed top-14 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full shadow-lg border-2 transition-all ${
          pendingDraw > 0 ? 'bg-red-600 border-red-400 animate-pulse' : 'bg-green-600 border-green-400 animate-pulse'
        }`}>
          <div className="text-white font-bold text-sm text-center flex items-center gap-2">
            {pendingDraw > 0 ? (
              <span>⚠️ {currentGamePlayer.nickname} must draw {pendingDraw} cards</span>
            ) : (
              <span>🎮 {currentGamePlayer.nickname}'s turn</span>
            )}
          </div>
        </div>
      )}

      <section className="relative w-full h-full flex items-center justify-center bg-transparent p-4 pt-24 pb-16">
        <div
          className="relative aspect-square w-[min(80vmin,500px)]"
          style={{
            ['--r' as any]: 'calc(var(--center) / 2 + var(--avatar) / 2 + 12px)',
            ['--avatar' as any]: 'clamp(70px, 12vmin, 90px)',
            ['--center' as any]: 'clamp(120px, 22vmin, 180px)',
            ['--gap' as any]: 'clamp(8px, 2vmin, 16px)',
          }}
        >
          <div className="absolute inset-0 grid place-items-center z-10">
            <div className="relative">
              <div
                className="absolute -z-10 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-slate-600 shadow-2xl bg-gradient-to-br from-slate-700 to-slate-800"
                style={{ width: 'var(--center)', height: 'var(--center)' }}
              />
              <div className="flex flex-col items-center space-y-2">
                {topCard ? (
                  <div className="flex flex-col items-center">
                    <div className="transform scale-125">
                      <GameCard card={topCard} size="large" interactive={false} onClick={() => {}} />
                    </div>
                    {currentColor && (topCard.type === 'wild' || topCard.type === 'wild4') && (
                      <div className="flex flex-col items-center mt-4">
                        <div
                          className={`w-8 h-8 rounded-full border-3 border-white ${
                            currentColor === 'red'
                              ? 'bg-red-500'
                              : currentColor === 'yellow'
                              ? 'bg-yellow-500'
                              : currentColor === 'blue'
                              ? 'bg-blue-500'
                              : currentColor === 'green'
                              ? 'bg-green-500'
                              : 'bg-gray-500'
                          }`}
                        />
                        <span className="text-sm text-white font-bold mt-1 uppercase">
                          {currentColor}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-20 h-28 bg-gradient-to-br from-red-500 to-red-700 rounded-xl border-3 border-red-300 shadow-xl flex items-center justify-center">
                    <div className="text-white font-bold text-xl">UNO</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {[0, 1, 2, 3].map((position) => {
            const player = getPlayerAtPosition(position);
            const isOnline = player ? isPlayerOnline(player) : false;
            const isPlayerTurn = currentGamePlayer?.id === player?.id;

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
                      <div
                        className={`rounded-full flex items-center justify-center text-white font-bold shadow-lg border-4 bg-gradient-to-br from-uno-blue to-uno-purple transition-all ${
                          isPlayerTurn ? 'border-green-400 ring-4 ring-green-400/50 scale-110' : 'border-white/20'
                        }`}
                        style={{ width: 'var(--avatar)', height: 'var(--avatar)' }}
                        title={player.nickname}
                      >
                        <div className="text-3xl">{getPlayerAvatar(player.id, player.nickname)}</div>
                      </div>

                      <div
                        className={`absolute text-sm font-bold text-white bg-black/80 px-3 py-1.5 rounded-full whitespace-nowrap shadow-lg ${
                          position === 0 ? 'left-full top-1/2 -translate-y-1/2 ml-3'
                          : position === 1 ? 'top-full left-1/2 -translate-x-1/2 mt-3'
                          : position === 2 ? 'right-3/4 top-full mt-3'
                          : 'right-1/4 bottom-full -translate-x-1/2 mb-3'
                        } ${isPlayerTurn ? 'bg-green-600' : ''}`}
                      >
                        {player.nickname} {isPlayerTurn && '⭐'}
                      </div>

                      <div
                        className={`absolute -top-1 -right-1 w-7 h-7 rounded-full border-2 border-white ${
                          isOnline ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />

                      {player.id === room?.hostId && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-xl">👑</div>
                      )}

                      {player.finishPosition && (
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-sm px-3 py-1 rounded-full font-bold shadow-lg">
                          {player.finishPosition === 1
                            ? '1ST'
                            : player.finishPosition === 2
                            ? '2ND'
                            : player.finishPosition === 3
                            ? '3RD'
                            : `${player.finishPosition}TH`}
                        </div>
                      )}

                      {!player.finishPosition && (
                        <div className="absolute -left-3 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-sm px-3 py-1.5 rounded-full font-bold shadow-lg border-2 border-slate-600">
                          {player.hand?.length || player.cardCount || 0}
                        </div>
                      )}

                      {player.hasCalledUno && (
                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-red-500 text-white text-sm px-3 py-1 rounded-full font-bold shadow-lg animate-pulse">
                          UNO!
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className="rounded-full flex items-center justify-center border-4 border-white/20 bg-gray-500/30"
                      style={{ width: 'var(--avatar)', height: 'var(--avatar)' }}
                    >
                      <div className="text-center">
                        <div className="w-10 h-10 rounded-full bg-gray-400 mx-auto" />
                        <div className="text-xs text-gray-400 mt-1">Empty</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {room?.direction && room?.status === 'playing' && (
            <div className="absolute z-20 top-4 left-4">
              <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full border-3 border-yellow-300 shadow-lg w-16 h-16 flex items-center justify-center animate-pulse">
                <div className="text-white text-[10px] font-bold text-center leading-tight">
                  {room.direction === 'clockwise' ? (
                    <div className="flex flex-col items-center">
                      <span className="text-lg">↻</span>
                      <span>GAME</span>
                      <span>DIR</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <span className="text-lg">↺</span>
                      <span>GAME</span>
                      <span>DIR</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-slate-900/95 to-slate-900/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-center">
            <div className="bg-purple-700/80 px-6 py-3 rounded-lg border border-purple-500">
              <div className="text-center">
                <div className="text-white text-sm font-semibold mb-1">📺 OBS Streaming View</div>
                <div className="text-purple-200 text-xs">
                  Current turn: <span className="text-green-400 font-medium">{currentGamePlayer?.nickname || 'Unknown'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
              <div className="mt-2 text-center">
                <a 
                  href="https://qrfun.net" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 text-sm font-medium underline"
                >
                  qrfun.net
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
