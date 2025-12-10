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
  );

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

  const topCard = room.topCard || room.discardPile?.[room.discardPile?.length - 1];
  const currentPlayerIndex = room.currentPlayerIndex;
  const currentGamePlayer = gamePlayers.find((p: any) => p.position === currentPlayerIndex);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Header Bar */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-slate-900/90 backdrop-blur-sm border-b border-slate-700">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600 px-3 py-1 rounded-full flex items-center gap-2">
              <Tv className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-bold">STREAM GAME</span>
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
      {currentGamePlayer && (
        <div className="fixed top-14 left-0 right-0 z-30 flex justify-center pointer-events-none">
          <div className="bg-gradient-to-r from-green-500/90 to-emerald-500/90 text-white px-6 py-2 rounded-full shadow-lg">
            <span className="font-bold">{currentGamePlayer.nickname}'s Turn</span>
          </div>
        </div>
      )}

      {/* === STREAM GAME VIEW - ONLY DISCARD PILE VISIBLE === */}
      <section className="relative w-full h-screen flex items-center justify-center bg-transparent pt-16">
        <div className="relative flex flex-col items-center justify-center">
          {/* Large Center Play Area - ONLY the discard pile card */}
          <div className="relative">
            {/* Background Circle */}
            <div className="w-64 h-64 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border-4 border-slate-600 shadow-2xl flex items-center justify-center">
              {topCard ? (
                <div className="flex flex-col items-center">
                  {/* Large Played Card */}
                  <div className="transform scale-150">
                    <GameCard card={topCard} size="large" interactive={false} />
                  </div>
                  {/* Current Color Indicator for Wild Cards */}
                  {room?.currentColor && (topCard.type === 'wild' || topCard.type === 'wild4') && (
                    <div className="flex items-center gap-2 mt-8 bg-black/60 px-4 py-2 rounded-full">
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
                      <span className="text-lg text-white font-bold uppercase">
                        {room.currentColor}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-24 h-36 bg-gradient-to-br from-red-500 to-red-700 rounded-xl border-4 border-red-300 shadow-xl flex items-center justify-center">
                  <div className="text-white font-bold text-2xl">UNO</div>
                </div>
              )}
            </div>

            {/* Direction Indicator */}
            <div className="absolute -top-4 -left-4 w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex flex-col items-center justify-center border-2 border-yellow-300 shadow-lg">
              <span className="text-xl">{room.direction === 'clockwise' ? '↻' : '↺'}</span>
              <span className="text-[8px] font-bold text-black">DIR</span>
            </div>
          </div>

          {/* Player Names Around (No cards shown) */}
          <div className="mt-8 flex flex-wrap justify-center gap-4 max-w-md">
            {gamePlayers.map((player: any, index: number) => {
              const isPlayerTurn = currentGamePlayer?.id === player?.id;
              return (
                <div 
                  key={player.id}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                    isPlayerTurn 
                      ? 'bg-green-500 text-white ring-2 ring-green-300' 
                      : 'bg-slate-700 text-gray-300'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-uno-blue to-uno-purple flex items-center justify-center text-white font-bold text-sm">
                    {player.nickname[0].toUpperCase()}
                  </div>
                  <span className="font-medium">{player.nickname}</span>
                  {isPlayerTurn && (
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">TURN</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

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
