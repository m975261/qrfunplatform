import { useEffect, useState, useRef, useCallback } from "react";
import { useRoute, useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, QrCode, Users, Tv, X, GripVertical, Link2, Crown, Plus } from "lucide-react";
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

  // Check if a player is online
  const isPlayerOnline = (player: any): boolean => {
    return player?.isOnline || false;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-uno-blue via-uno-purple to-uno-red p-4">
      <div className="max-w-4xl mx-auto">
        {/* Room Header - Same style as RoomLobby */}
        <Card className="bg-white/95 backdrop-blur-sm shadow-xl mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-gray-800">
                    Room <span className="font-mono text-uno-blue">{room?.code}</span>
                  </h2>
                  <div className="bg-purple-600 px-3 py-1 rounded-full flex items-center gap-2">
                    <Tv className="w-4 h-4 text-white" />
                    <span className="text-white text-sm font-bold">STREAM</span>
                  </div>
                  {isConnected && (
                    <div className="bg-green-500 px-3 py-1 rounded-full">
                      <span className="text-white text-sm font-bold">LIVE</span>
                    </div>
                  )}
                </div>
                <p className="text-gray-600">
                  {isPlaying ? 'Game in progress...' : 'Waiting for players to join...'}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <Button
                  onClick={handleCopyLink}
                  variant="outline"
                  size="sm"
                  className="bg-uno-blue text-white hover:bg-blue-600"
                >
                  <Link2 className="mr-2 h-4 w-4" />
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

        {/* Central Game Area with 4 Fixed Avatar Positions - Same style as RoomLobby */}
        <div className="relative w-80 h-80 mx-auto mb-8 bg-white/10 backdrop-blur-sm rounded-full border-2 border-white/20">
          {/* UNO Logo in Center */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            {isPlaying ? (
              <div className={`w-24 h-24 rounded-full flex flex-col items-center justify-center shadow-lg ${getCardColor(currentColor)}`}>
                <span className="text-white font-bold text-lg">UNO</span>
                <span className="text-white/80 text-xs capitalize">{currentColor || 'playing'}</span>
              </div>
            ) : (
              <div className="w-20 h-20 bg-gradient-to-br from-uno-red to-uno-yellow rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">UNO</span>
              </div>
            )}
          </div>

          {/* 4 Fixed Avatar Positions - Same style as RoomLobby */}
          {[0, 1, 2, 3].map((position) => {
            const player = gamePlayers.find((p: any) => p.position === position);
            const isOnline = player ? isPlayerOnline(player) : false;
            const isCurrentTurn = room.currentPlayerIndex === position && isPlaying;
            const cardCount = player ? (player.cardCount || room.positionHands?.[position]?.length || 0) : 0;

            return (
              <div
                key={position}
                className={`absolute ${getPositionClass(position)} w-20 h-20`}
              >
                <div className={`relative ${isCurrentTurn ? 'scale-110 transition-transform' : ''}`}>
                  {player ? (
                    // Player Avatar - Same style as RoomLobby
                    <div className={`w-20 h-20 bg-gradient-to-br from-uno-blue to-uno-purple rounded-full flex flex-col items-center justify-center text-white font-bold shadow-lg border-4 ${
                      isCurrentTurn ? 'border-yellow-400' : 'border-white/20'
                    }`}>
                      <div className="text-lg">{player.nickname[0].toUpperCase()}</div>
                      <div className="text-xs font-semibold truncate max-w-full px-1 leading-tight">{player.nickname}</div>
                      {/* Online/Offline indicator */}
                      <div className={`absolute -top-1 -right-1 w-6 h-6 rounded-full border-2 border-white ${
                        isOnline ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      {/* Host crown */}
                      {player.id === room?.hostId && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <Crown className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                        </div>
                      )}
                      {/* Card count during game */}
                      {isPlaying && (
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gray-800 px-2 py-0.5 rounded text-xs text-white flex items-center gap-1">
                          <span>🎴</span>
                          <span>{cardCount}</span>
                        </div>
                      )}
                      {/* Current turn indicator */}
                      {isCurrentTurn && (
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full animate-bounce">
                          TURN
                        </div>
                      )}
                    </div>
                  ) : (
                    // Empty Slot - Same style as RoomLobby
                    <div className="w-20 h-20 rounded-full flex items-center justify-center border-4 bg-gray-300/50 border-white/30">
                      <div className="text-center">
                        <Plus className="w-8 h-8 text-gray-500 mx-auto" />
                        <div className="text-xs text-gray-600">Empty</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Direction Indicator - Below circle */}
        {isPlaying && (
          <div className="flex justify-center mb-4">
            <div className="bg-yellow-500/80 px-4 py-2 rounded-lg flex items-center gap-2">
              <span className="text-2xl">{room.direction === 'clockwise' ? '↻' : '↺'}</span>
              <span className="text-black font-bold">{room.direction === 'clockwise' ? 'Clockwise' : 'Counter-Clockwise'}</span>
            </div>
          </div>
        )}

        {/* Status Footer */}
        <Card className="bg-white/95 backdrop-blur-sm shadow-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-600" />
                <span className="text-gray-800 font-medium">{gamePlayers.length}/4 Players</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Status:</span>
                <span className={`font-bold capitalize ${
                  room.status === 'playing' ? 'text-green-600' : 
                  room.status === 'waiting' ? 'text-blue-600' : 'text-gray-600'
                }`}>{room.status}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
              
              <div className="flex gap-2 mb-3">
                <Button
                  onClick={handleCopyCode}
                  variant="outline"
                  size="sm"
                  className="flex-1 bg-purple-600 text-white hover:bg-purple-700"
                >
                  <Copy className="mr-1 h-4 w-4" />
                  Code
                </Button>
                <Button
                  onClick={handleCopyLink}
                  variant="outline"
                  size="sm"
                  className="flex-1 bg-green-600 text-white hover:bg-green-700"
                >
                  <Link2 className="mr-1 h-4 w-4" />
                  Link
                </Button>
              </div>
              
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
