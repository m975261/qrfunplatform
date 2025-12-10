import { useEffect, useState, useRef } from "react";
import { useRoute, useSearch, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, QrCode, Tv, X, GripVertical, Link2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useSocket } from "@/hooks/useSocket";
import { useToast } from "@/hooks/use-toast";

export default function StreamLobbyPage() {
  const [, params] = useRoute("/stream/:roomId/lobby");
  const search = useSearch();
  const [, setLocation] = useLocation();
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
      console.log("📺 StreamLobbyPage: Subscribing to room", roomId);
      streamSubscribe(roomId, roomCode);
      setHasSubscribed(true);
    }
  }, [isConnected, roomId, roomCode, hasSubscribed, streamSubscribe]);

  useEffect(() => {
    if (gameState?.room?.status === "playing") {
      setLocation(`/stream/${roomId}/game`);
    }
  }, [gameState?.room?.status, roomId, setLocation]);

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
      const joinLink = `${baseUrl}/?room=${room.code}`;
      navigator.clipboard.writeText(joinLink);
      toast({ title: "Join link copied!", description: "Share this link with players", duration: 2000 });
    }
  };

  const getPositionClass = (position: number) => {
    const positions = [
      'top-4 left-1/2 -translate-x-1/2',
      'right-4 top-1/2 -translate-y-1/2',
      'bottom-4 left-1/2 -translate-x-1/2',
      'left-4 top-1/2 -translate-y-1/2'
    ];
    return positions[position] || positions[0];
  };

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 text-white p-8">
          <div className="text-center">
            <Tv className="w-16 h-16 mx-auto mb-4 text-purple-400" />
            <h2 className="text-2xl font-bold mb-2">Stream Lobby Loading...</h2>
            <p className="text-gray-400">Waiting for room connection...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Header Bar */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-slate-900/90 backdrop-blur-sm border-b border-slate-700">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600 px-3 py-1 rounded-full flex items-center gap-2">
              <Tv className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-bold">STREAM LOBBY</span>
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

      {/* Central Lobby Area - View Only (No Controls) */}
      <div className="pt-20 flex items-center justify-center min-h-screen">
        <div className="relative w-80 h-80 mx-auto bg-slate-800/30 backdrop-blur-sm rounded-full border-2 border-slate-600">
          {/* UNO Logo in Center */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-24 h-24 bg-gradient-to-br from-red-500 to-yellow-500 rounded-full flex items-center justify-center shadow-2xl border-4 border-white/20">
              <span className="text-white font-bold text-2xl">UNO</span>
            </div>
          </div>

          {/* "Waiting for Host" Message */}
          {gamePlayers.length === 0 && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-16 text-center">
              <div className="bg-purple-600/80 text-white px-4 py-2 rounded-full text-sm font-bold animate-pulse">
                Waiting for Host to Join...
              </div>
            </div>
          )}

          {/* 4 Fixed Avatar Positions (View Only) */}
          {[0, 1, 2, 3].map((position) => {
            const player = getPlayerAtPosition(position);
            
            return (
              <div
                key={position}
                className={`absolute ${getPositionClass(position)} w-20 h-20`}
              >
                {player ? (
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-uno-blue to-uno-purple flex items-center justify-center text-white font-bold shadow-lg border-4 border-white/20">
                      <span className="text-2xl">{player.nickname[0].toUpperCase()}</span>
                    </div>
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <span className="bg-black/70 text-white text-xs px-2 py-1 rounded-full">
                        {player.nickname}
                      </span>
                    </div>
                    {player.isOnline && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
                    )}
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-full bg-slate-700/50 border-4 border-dashed border-slate-600 flex items-center justify-center">
                    <span className="text-slate-500 text-xs">Slot {position + 1}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Spectators Panel - Right Side */}
      <div className="fixed z-20" style={{
        top: '5rem',
        bottom: '2rem',
        right: '0.5rem',
        width: 'min(16rem, 20vw)'
      }}>
        <div className="bg-slate-800/90 backdrop-blur-sm rounded-xl p-3 shadow-lg h-full flex flex-col border border-slate-700">
          <div className="text-xs font-semibold text-gray-300 mb-3 flex-shrink-0">
            Spectators ({spectators.length})
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
                Waiting for players to join...
              </div>
            )}
          </div>
          <div className="text-[10px] text-slate-500 text-center mt-2 pt-2 border-t border-slate-700">
            {gamePlayers.length}/4 Players
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
