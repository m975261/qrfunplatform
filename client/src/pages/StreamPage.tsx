import { useEffect, useState, useRef, useCallback } from "react";
import { useRoute, useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, QrCode, Users, Tv, X, GripVertical } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useSocket } from "@/hooks/useSocket";
import { useToast } from "@/hooks/use-toast";

interface StreamPlayer {
  id: string;
  nickname: string;
  position: number | null;
  cardCount: number;
  isCurrentTurn: boolean;
  hasCalledUno: boolean;
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
  const qrPanelRef = useRef<HTMLDivElement>(null);
  const qrButtonRef = useRef<HTMLButtonElement>(null);
  const { toast } = useToast();
  
  const { gameState, isConnected, streamSubscribe } = useSocket();

  // Subscribe to room updates when connected
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

  const getPositionClass = (position: number): string => {
    const positions = [
      'top-4 left-1/2 -translate-x-1/2',
      'right-4 top-1/2 -translate-y-1/2',
      'bottom-4 left-1/2 -translate-x-1/2',
      'left-4 top-1/2 -translate-y-1/2'
    ];
    return positions[position] || positions[0];
  };

  const getCardColor = (color: string | null): string => {
    switch (color) {
      case 'red': return 'bg-uno-red';
      case 'blue': return 'bg-uno-blue';
      case 'green': return 'bg-uno-green';
      case 'yellow': return 'bg-uno-yellow';
      default: return 'bg-gray-400';
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

  const handleCopyCode = () => {
    if (room?.code) {
      navigator.clipboard.writeText(room.code);
    }
  };

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex items-center justify-center">
        <Card className="bg-white/10 backdrop-blur-sm border-white/20 text-white p-8">
          <div className="text-center">
            <Tv className="w-16 h-16 mx-auto mb-4 text-purple-300" />
            <h2 className="text-2xl font-bold mb-2">Stream Page Loading...</h2>
            <p className="text-gray-300">Connecting to room...</p>
          </div>
        </Card>
      </div>
    );
  }

  const isPlaying = room.status === 'playing';
  const currentColor = room.currentColor;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 p-4 overflow-hidden">
      {/* Stream Header */}
      <div className="absolute top-4 left-4 z-20">
        <div className="flex items-center gap-3">
          <div className="bg-purple-600/80 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-2">
            <Tv className="w-5 h-5 text-white" />
            <span className="text-white font-bold">STREAM VIEW</span>
          </div>
          <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
            <span className="text-white font-mono">Room: {room.code}</span>
          </div>
          {isConnected && (
            <div className="bg-green-500/80 px-3 py-1 rounded-full">
              <span className="text-white text-sm">LIVE</span>
            </div>
          )}
        </div>
      </div>

      {/* QR Code Button */}
      <div className="absolute top-4 right-4 z-20">
        <Button
          ref={qrButtonRef}
          onClick={() => {
            if (!showQRCode && qrButtonRef.current) {
              const rect = qrButtonRef.current.getBoundingClientRect();
              setQrPosition({ x: rect.left - 200, y: rect.bottom + 8 });
            }
            setShowQRCode(!showQRCode);
          }}
          className="bg-white/20 hover:bg-white/30 text-white"
        >
          <QrCode className="mr-2 h-4 w-4" />
          Share Room
        </Button>
      </div>

      {/* Main Game Area */}
      <div className="flex items-center justify-center min-h-screen">
        <div className="relative w-[500px] h-[500px]">
          {/* Center Table */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-gradient-to-br from-green-700 to-green-900 shadow-2xl border-4 border-green-600 flex flex-col items-center justify-center">
            {isPlaying ? (
              <>
                {/* Discard Pile - Only show current color, not card value */}
                <div className={`w-16 h-24 rounded-lg ${getCardColor(currentColor)} shadow-lg flex items-center justify-center border-2 border-white/30`}>
                  <div className="w-12 h-20 bg-gradient-to-br from-gray-800 to-gray-900 rounded-md flex items-center justify-center border border-gray-600">
                    <span className="text-2xl font-bold text-white opacity-60">UNO</span>
                  </div>
                </div>
                <p className="text-white/80 text-xs mt-2 font-medium capitalize">{currentColor || 'Starting...'}</p>
              </>
            ) : (
              <div className="text-center">
                <span className="text-white font-bold text-xl">UNO</span>
                <p className="text-white/60 text-sm mt-1">
                  {room.status === 'waiting' ? 'Waiting...' : 'Starting...'}
                </p>
              </div>
            )}
          </div>

          {/* Player Positions - 4 Fixed Slots */}
          {[0, 1, 2, 3].map((position) => {
            const player = gamePlayers.find((p: any) => p.position === position);
            const isCurrentTurn = room.currentPlayerIndex === position && isPlaying;
            const cardCount = player ? (room.positionHands?.[position]?.length || 0) : 0;

            return (
              <div
                key={position}
                className={`absolute ${getPositionClass(position)}`}
              >
                <div className={`relative ${isCurrentTurn ? 'scale-110' : ''} transition-transform`}>
                  {/* Avatar */}
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl shadow-lg border-4 ${
                    isCurrentTurn 
                      ? 'border-yellow-400 bg-yellow-500/20 animate-pulse' 
                      : player 
                        ? 'border-white/50 bg-white/20' 
                        : 'border-gray-500/30 bg-gray-700/30'
                  }`}>
                    {player ? (
                      <span className="text-2xl">👤</span>
                    ) : (
                      <span className="text-gray-500 text-2xl">?</span>
                    )}
                  </div>
                  
                  {/* Player Info */}
                  {player && (
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
                      <p className="text-white font-bold text-sm bg-black/50 px-2 py-0.5 rounded">
                        {player.nickname}
                      </p>
                      {isPlaying && (
                        <div className="flex items-center justify-center gap-1 mt-1">
                          {/* Hidden Card Count */}
                          <div className="bg-gray-800/80 px-2 py-0.5 rounded text-xs text-white flex items-center gap-1">
                            <span>🎴</span>
                            <span>{cardCount}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Current Turn Indicator */}
                  {isCurrentTurn && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full animate-bounce">
                      TURN
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Player Count / Status */}
      <div className="absolute bottom-4 left-4 z-20">
        <div className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg flex items-center gap-2">
          <Users className="w-5 h-5 text-white" />
          <span className="text-white">{gamePlayers.length}/4 Players</span>
          <span className="text-white/60">|</span>
          <span className="text-white capitalize">{room.status}</span>
        </div>
      </div>

      {/* Direction Indicator */}
      {isPlaying && (
        <div className="absolute bottom-4 right-4 z-20">
          <div className="bg-yellow-500/80 px-4 py-2 rounded-lg flex items-center gap-2">
            <span className="text-2xl">{room.direction === 'clockwise' ? '↻' : '↺'}</span>
            <span className="text-black font-bold">{room.direction === 'clockwise' ? 'Clockwise' : 'Counter-Clockwise'}</span>
          </div>
        </div>
      )}

      {/* QR Code Floating Panel */}
      {showQRCode && qrCodeData && (
        <div
          ref={qrPanelRef}
          className="fixed z-40 select-none"
          style={{
            left: qrPosition.x,
            top: qrPosition.y,
            cursor: isDraggingQR ? 'grabbing' : 'default'
          }}
        >
          <Card className="w-64 shadow-2xl border-2 border-purple-500/50 bg-white/98 backdrop-blur-sm">
            <CardContent className="p-4">
              <div
                className="flex items-center justify-between mb-2 cursor-grab active:cursor-grabbing bg-purple-600 rounded-lg px-3 py-2"
                onMouseDown={handleQRDragStart}
                onTouchStart={handleQRDragStart}
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-white/70" />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white">Room {room?.code}</span>
                    <span className="text-xs font-bold text-white">QrFun.org</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowQRCode(false)}
                  className="text-white/70 hover:text-white p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              <Button
                onClick={handleCopyCode}
                variant="outline"
                size="sm"
                className="w-full mb-3 bg-purple-600 text-white hover:bg-purple-700"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy Code
              </Button>
              
              <div className="bg-white p-3 rounded-lg shadow-inner border border-gray-100">
                <img 
                  src={qrCodeData} 
                  alt={`QR Code for room ${room?.code}`}
                  className="w-full h-auto"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
