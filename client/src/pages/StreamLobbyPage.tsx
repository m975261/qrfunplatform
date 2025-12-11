import { useEffect, useState, useRef } from "react";
import { useRoute, useSearch, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, QrCode, Tv, X, GripVertical, Link2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useSocket } from "@/hooks/useSocket";

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
    }
  };

  const handleCopyLink = () => {
    if (room?.code) {
      const baseUrl = window.location.origin;
      const joinLink = `${baseUrl}/?room=${room.code}`;
      navigator.clipboard.writeText(joinLink);
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
      <div className="min-h-screen bg-gradient-to-br from-uno-blue via-uno-purple to-uno-red flex items-center justify-center">
        <Card className="bg-white/95 backdrop-blur-sm shadow-xl p-8">
          <div className="text-center">
            <Tv className="w-16 h-16 mx-auto mb-4 text-purple-600" />
            <h2 className="text-2xl font-bold mb-2 text-gray-800">Stream Lobby Loading...</h2>
            <p className="text-gray-600">Waiting for room connection...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-uno-blue via-uno-purple to-uno-red p-4">
      <div className="max-w-4xl mx-auto">
        {/* Room Header - Same style as normal lobby */}
        <Card className="bg-white/95 backdrop-blur-sm shadow-xl mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-gray-800">
                    Room <span className="font-mono text-uno-blue">{room?.code}</span>
                  </h2>
                  <span className="bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                    <Tv className="w-3 h-3" />
                    STREAM VIEW
                  </span>
                  {isConnected && (
                    <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                      LIVE
                    </span>
                  )}
                </div>
                <p className="text-gray-600">Waiting for players to join...</p>
              </div>
              <div className="flex items-center space-x-3">
                <Button
                  onClick={handleCopyLink}
                  variant="outline"
                  size="sm"
                  className="bg-uno-blue text-white hover:bg-blue-600"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Link
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
                  className="bg-uno-green text-white hover:bg-green-600"
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  QR Code
                </Button>
              </div>
            </div>
            
            <div className="text-sm text-gray-600">
              {gamePlayers.length}/4 players joined
            </div>
          </CardContent>
        </Card>

        {/* "Waiting for Host" Message - Positioned above the circle */}
        {gamePlayers.length === 0 && (
          <div className="text-center mb-4">
            <div className="inline-block bg-purple-600 text-white px-6 py-3 rounded-full text-lg font-bold animate-pulse shadow-lg">
              Waiting for Host to Join...
            </div>
          </div>
        )}

        {/* Central Game Area with 4 Fixed Avatar Positions - Same style as normal lobby */}
        <div className="relative w-80 h-80 mx-auto mb-8 bg-white/10 backdrop-blur-sm rounded-full border-2 border-white/20">
          {/* UNO Logo in Center */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-20 h-20 bg-gradient-to-br from-uno-red to-uno-yellow rounded-full flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">UNO</span>
            </div>
          </div>

          {/* 4 Fixed Avatar Positions (View Only) */}
          {[0, 1, 2, 3].map((position) => {
            const player = getPlayerAtPosition(position);
            const savedAvatar = player ? localStorage.getItem(`avatar_${player.id}`) : null;
            const avatarEmoji = savedAvatar === 'male' ? '👨' : savedAvatar === 'female' ? '👩' : '👨';
            
            return (
              <div
                key={position}
                className={`absolute ${getPositionClass(position)}`}
              >
                {player ? (
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-uno-blue to-uno-purple rounded-full flex items-center justify-center text-2xl shadow-lg border-3 border-white/30 relative">
                      {avatarEmoji}
                      <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                        player.isOnline ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      {player.position === 0 && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-sm">👑</div>
                      )}
                    </div>
                    <div className="mt-1 px-2 py-0.5 bg-black/70 text-white text-xs font-bold rounded-full truncate max-w-[70px]">
                      {player.nickname}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-gray-300/50 border-3 border-white/30 flex items-center justify-center">
                      <span className="text-gray-500 text-[10px]">Empty</span>
                    </div>
                    <div className="mt-1 px-2 py-0.5 bg-gray-500/50 text-gray-300 text-[10px] font-bold rounded-full">
                      Slot {position + 1}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Spectators Card - Same style as normal lobby */}
        {spectators.length > 0 && (
          <Card className="bg-white/95 backdrop-blur-sm shadow-xl mt-6">
            <CardContent className="p-4">
              <div className="text-sm font-semibold text-gray-700 mb-3">
                Spectators ({spectators.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {spectators.map((spectator: any) => (
                  <div key={spectator.id} className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-full">
                    <div className="w-6 h-6 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                      {spectator.nickname?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-700">{spectator.nickname}</span>
                    <div className={`w-2 h-2 rounded-full ${spectator.isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
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
          <Card className="w-64 shadow-2xl border-2 border-uno-blue bg-white">
            <CardContent className="p-4">
              <div
                className="flex items-center justify-between mb-3 cursor-grab active:cursor-grabbing"
                onMouseDown={handleQRDragStart}
                onTouchStart={handleQRDragStart}
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-800">Scan to Join</span>
                </div>
                <button
                  onClick={() => setShowQRCode(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <div className="bg-white p-3 rounded-lg flex justify-center border border-gray-200">
                <img src={qrCodeData} alt="QR Code" className="w-full h-auto" />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="font-mono text-lg font-bold text-gray-800">{room?.code}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyCode}
                  className="bg-uno-blue text-white hover:bg-blue-600"
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
                  className="text-purple-500 hover:text-purple-400 text-sm font-medium underline"
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
