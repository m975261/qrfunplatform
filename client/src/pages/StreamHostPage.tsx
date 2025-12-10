import { useEffect, useState, useRef } from "react";
import { useLocation, useRoute, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, QrCode, X, Plus, Play, Crown, GripVertical, Pencil, Tv } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useSocket } from "@/hooks/useSocket";
import NicknameEditor from "@/components/NicknameEditor";

export default function StreamHostPage() {
  const [, params] = useRoute("/stream/:roomId/host");
  const search = useSearch();
  const [, setLocation] = useLocation();
  const roomId = params?.roomId;
  const roomCode = new URLSearchParams(search).get('code') || undefined;
  
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeData, setQRCodeData] = useState<string | null>(null);
  const [showNicknameEditor, setShowNicknameEditor] = useState(false);
  const [editingSpectatorId, setEditingSpectatorId] = useState<string | null>(null);
  const [editingSpectatorNickname, setEditingSpectatorNickname] = useState<string>("");
  
  const [qrPosition, setQrPosition] = useState({ x: 20, y: 100 });
  const [isDraggingQR, setIsDraggingQR] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const qrPanelRef = useRef<HTMLDivElement>(null);
  const qrButtonRef = useRef<HTMLButtonElement>(null);
  const { toast } = useToast();
  
  const { 
    gameState, 
    joinRoom, 
    startGame, 
    replacePlayer, 
    kickPlayer: kickPlayerWS,
    assignSpectator,
    isConnected 
  } = useSocket();

  // Use the generic playerId as the source of truth - it's always set fresh on join
  // Streaming-specific IDs are only used to validate role, not for joining
  const playerId = localStorage.getItem("playerId");

  useEffect(() => {
    if (isConnected && roomId && playerId) {
      joinRoom(playerId, roomId);
    }
  }, [isConnected, roomId, playerId, joinRoom]);

  // Clean up stale streaming IDs if they don't match current generic playerId
  useEffect(() => {
    const storedHostId = localStorage.getItem("streamHostPlayerId");
    const storedPlayerId = localStorage.getItem("streamPlayerPlayerId");
    
    if (storedHostId && storedHostId !== playerId) {
      localStorage.removeItem("streamHostPlayerId");
    }
    if (storedPlayerId && storedPlayerId !== playerId) {
      localStorage.removeItem("streamPlayerPlayerId");
    }
  }, [playerId]);

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
  const isHost = room?.hostId === playerId;

  useEffect(() => {
    if (room && playerId && !isHost) {
      console.log("[StreamHostPage] User is not host, redirecting to spectator page");
      const code = room.code || roomCode;
      setLocation(`/stream/${roomId}/spectator?code=${code}`);
    }
  }, [room, playerId, isHost, roomId, roomCode, setLocation]);

  // Redirect based on role when game starts or player is assigned to a slot
  useEffect(() => {
    const myPlayer = gameState?.players?.find((p: any) => p.id === playerId);
    if (!myPlayer || !roomId) return;
    
    const roomCode = gameState?.room?.code;
    const isPlaying = gameState?.room?.status === "playing";
    const hasPosition = myPlayer.position !== null && myPlayer.position !== undefined && !myPlayer.isSpectator;
    
    if (isHost && isPlaying) {
      // Host goes to host/game page when game starts
      setLocation(`/stream/${roomId}/host/game?code=${roomCode}`);
    } else if (!isHost && hasPosition) {
      // Non-host player with assigned position - store ID and redirect to their player page
      const slot = myPlayer.position + 1;
      localStorage.setItem("streamPlayerPlayerId", playerId || "");
      setLocation(`/stream/${roomId}/player/${slot}?code=${roomCode}`);
    }
  }, [gameState?.players, gameState?.room?.status, gameState?.room?.code, playerId, roomId, setLocation, isHost]);

  const handleCopyLink = () => {
    const roomLink = `${window.location.origin}/?room=${room?.code}`;
    navigator.clipboard.writeText(roomLink);
    toast({ title: "Link copied!", duration: 1500 });
  };

  const handleCopyStreamUrl = () => {
    const streamUrl = `${window.location.origin}/stream/${roomId}/lobby?code=${room?.code}`;
    navigator.clipboard.writeText(streamUrl);
    toast({
      title: "Stream URL Copied!",
      description: "Use this URL in OBS or your streaming software",
      duration: 2000,
    });
  };

  const handleStartGame = () => {
    if (gamePlayers.length < 2) {
      toast({
        title: "Not Enough Players",
        description: "Need at least 2 players to start the game.",
        variant: "destructive",
      });
      return;
    }
    startGame();
  };

  const handleAssignToSlot = (spectatorId: string, position: number) => {
    if (isHost) {
      assignSpectator(spectatorId, position);
    }
  };

  const handleKickPlayer = (targetPlayerId: string) => {
    if (isHost) {
      kickPlayerWS(targetPlayerId);
    }
  };

  const handleQRDragStart = (e: React.MouseEvent | React.TouchEvent) => {
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
        x: Math.max(0, Math.min(window.innerWidth - 200, clientX - dragStartPos.x)),
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

  const getPositionClass = (position: number) => {
    const positions = [
      'top-4 left-1/2 -translate-x-1/2',
      'right-4 top-1/2 -translate-y-1/2',
      'bottom-4 left-1/2 -translate-x-1/2',
      'left-4 top-1/2 -translate-y-1/2'
    ];
    return positions[position] || positions[0];
  };

  const getPlayerAtPosition = (position: number) => {
    return gamePlayers.find((p: any) => p.position === position);
  };

  const getAvailablePositions = () => {
    const occupied = gamePlayers.map((p: any) => p.position);
    return [0, 1, 2, 3].filter(pos => !occupied.includes(pos));
  };

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-uno-blue via-uno-purple to-uno-red p-4 flex items-center justify-center">
        <Card className="bg-white/95 p-8">
          <div className="text-center">
            <Tv className="w-16 h-16 mx-auto mb-4 text-purple-600" />
            <h2 className="text-2xl font-bold mb-2">Loading Host Controls...</h2>
            <p className="text-gray-600">Connecting to streaming room...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-uno-blue via-uno-purple to-uno-red p-4">
      <div className="max-w-4xl mx-auto">
        {/* Room Header */}
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
                    HOST CONTROLS
                  </span>
                </div>
                <p className="text-gray-600">Manage players and start the game</p>
              </div>
              <div className="flex items-center space-x-3">
                <Button
                  onClick={handleCopyStreamUrl}
                  variant="outline"
                  size="sm"
                  className="bg-purple-600 text-white hover:bg-purple-700"
                >
                  <Tv className="mr-2 h-4 w-4" />
                  Stream URL
                </Button>
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
                      setQrPosition({
                        x: rect.left,
                        y: rect.bottom + 8
                      });
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
              {gamePlayers.length}/4 players assigned
            </div>
          </CardContent>
        </Card>

        {/* Central Game Area with 4 Fixed Avatar Positions */}
        <div className="relative w-80 h-80 mx-auto mb-8 bg-white/10 backdrop-blur-sm rounded-full border-2 border-white/20">
          {/* UNO Logo in Center */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-20 h-20 bg-gradient-to-br from-uno-red to-uno-yellow rounded-full flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">UNO</span>
            </div>
          </div>

          {/* 4 Fixed Avatar Positions */}
          {[0, 1, 2, 3].map((position) => {
            const player = getPlayerAtPosition(position);
            
            return (
              <div
                key={position}
                className={`absolute ${getPositionClass(position)} w-20 h-20`}
              >
                <div className="relative">
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
                      {player.id === room?.hostId && (
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                          <Crown className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                        </div>
                      )}
                      {player.isOnline && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
                      )}
                      {/* Kick Button (Host Only) */}
                      {isHost && player.id !== playerId && (
                        <button
                          onClick={() => handleKickPlayer(player.id)}
                          className="absolute -bottom-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-white/20 border-4 border-dashed border-white/40 flex items-center justify-center">
                      <span className="text-white/60 text-xs">Slot {position + 1}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Spectators Panel - Host Can Assign to Slots */}
        <Card className="bg-white/95 backdrop-blur-sm shadow-xl mb-6">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              Spectators ({spectators.length})
            </h3>
            {spectators.length > 0 ? (
              <div className="space-y-3">
                {spectators.map((spectator: any) => (
                  <div key={spectator.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                        {spectator.nickname?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{spectator.nickname}</span>
                          <button
                            onClick={() => {
                              setEditingSpectatorId(spectator.id);
                              setEditingSpectatorNickname(spectator.nickname);
                            }}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            <Pencil className="w-3 h-3 text-gray-500" />
                          </button>
                        </div>
                        <div className={`text-xs ${spectator.isOnline ? 'text-green-500' : 'text-red-500'}`}>
                          {spectator.isOnline ? 'Online' : 'Offline'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getAvailablePositions().map((pos) => (
                        <Button
                          key={pos}
                          size="sm"
                          variant="outline"
                          onClick={() => handleAssignToSlot(spectator.id, pos)}
                          className="bg-uno-green text-white hover:bg-green-600"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Slot {pos + 1}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                Waiting for players to join...
              </div>
            )}
          </CardContent>
        </Card>

        {/* Start Game Button */}
        {isHost && gamePlayers.length >= 2 && (
          <div className="text-center">
            <Button
              onClick={handleStartGame}
              size="lg"
              className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-xl px-12 py-6 rounded-full shadow-xl hover:from-green-600 hover:to-emerald-700"
            >
              <Play className="mr-3 h-6 w-6" />
              Start Game
            </Button>
          </div>
        )}

        {/* QR Code Panel */}
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
            <Card className="w-64 shadow-2xl">
              <CardContent className="p-4">
                <div
                  className="flex items-center justify-between mb-3 cursor-grab active:cursor-grabbing"
                  onMouseDown={handleQRDragStart}
                  onTouchStart={handleQRDragStart}
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium">Scan to Join</span>
                  </div>
                  <button
                    onClick={() => setShowQRCode(false)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <div className="bg-white p-3 rounded-lg flex justify-center">
                  <img src={qrCodeData} alt="QR Code" className="w-full h-auto" />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-mono text-lg font-bold">{room?.code}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(room?.code || '');
                      toast({ title: "Code copied!", duration: 1500 });
                    }}
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
    </div>
  );
}
