import { useEffect, useState, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, QrCode, X, Plus, Play, Crown, GripVertical } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useSocket } from "@/hooks/useSocket";
import NicknameEditor from "@/components/NicknameEditor";

export default function RoomLobby() {
  const [, params] = useRoute("/room/:roomId");
  const [, setLocation] = useLocation();
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeData, setQRCodeData] = useState<string | null>(null);
  const [showNicknameEditor, setShowNicknameEditor] = useState(false);
  
  // Draggable QR code panel state
  const [qrPosition, setQrPosition] = useState({ x: 20, y: 100 });
  const [isDraggingQR, setIsDraggingQR] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const qrPanelRef = useRef<HTMLDivElement>(null);
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
  const roomId = params?.roomId;
  const playerId = localStorage.getItem("playerId");

  const { data: roomData, isLoading: isLoadingRoom, error: roomError } = useQuery({
    queryKey: ["/api/rooms", roomId],
    enabled: !!roomId,
  });

  // Set QR code data when room data is available
  useEffect(() => {
    if (roomData && typeof roomData === 'object' && 'qrCode' in roomData) {
      setQRCodeData(roomData.qrCode as string);
    }
  }, [roomData]);

  useEffect(() => {
    if (roomId && playerId && isConnected) {
      console.log("Joining room via WebSocket:", { playerId, roomId });
      joinRoom(playerId, roomId);
    }
  }, [roomId, playerId, isConnected, joinRoom]);

  // Handle game state transitions
  useEffect(() => {
    if (gameState?.room?.status === "playing") {
      setLocation(`/game/${roomId}`);
    }
  }, [gameState?.room?.status, roomId, setLocation]);

  // Handle end-game reset when room status changes from "finished"
  useEffect(() => {
    if (gameState?.room?.status === "finished") {
      // Trigger end-game reset after a small delay
      setTimeout(async () => {
        try {
          const response = await fetch(`/api/rooms/${roomId}/end-game-reset`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${playerId}`
            }
          });
          
          if (response.ok) {
            console.log("End-game reset completed - all players except host converted to spectators");
          }
        } catch (error) {
          console.error("Failed to reset game:", error);
        }
      }, 1000);
    }
  }, [gameState?.room?.status, roomId, playerId]);

  const handleCopyLink = () => {
    const roomLink = `${window.location.origin}/?room=${gameState?.room?.code}`;
    navigator.clipboard.writeText(roomLink);
    // Link copied - no toast notification needed
  };

  const handleStartGame = () => {
    const players = gameState?.players?.filter((p: any) => !p.isSpectator) || [];
    console.log("Starting game with players:", players);
    if (players.length < 2) {
      toast({
        title: "Not Enough Players",
        description: "Need at least 2 players to start the game.",
        variant: "destructive",
      });
      return;
    }
    startGame();
  };

  const handleLeaveRoom = () => {
    // Clear current room session when leaving
    localStorage.removeItem("currentRoomId");
    setLocation("/");
  };

  // QR Panel drag handlers
  const handleQRDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDraggingQR(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragStartPos({ x: clientX - qrPosition.x, y: clientY - qrPosition.y });
  };

  const handleQRDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDraggingQR) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setQrPosition({
      x: Math.max(0, Math.min(window.innerWidth - 200, clientX - dragStartPos.x)),
      y: Math.max(0, Math.min(window.innerHeight - 300, clientY - dragStartPos.y))
    });
  };

  const handleQRDragEnd = () => {
    setIsDraggingQR(false);
  };

  // Global mouse/touch move and end for QR dragging
  useEffect(() => {
    if (!isDraggingQR) return;
    
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      setQrPosition({
        x: Math.max(0, Math.min(window.innerWidth - 200, clientX - dragStartPos.x)),
        y: Math.max(0, Math.min(window.innerHeight - 300, clientY - dragStartPos.y))
      });
    };
    
    const handleEnd = () => setIsDraggingQR(false);
    
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);
    
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDraggingQR, dragStartPos]);

  const kickPlayerLocal = async (playerIdToKick: string) => {
    if (!playerId || !gameState?.room?.id) return;
    
    // Use WebSocket for real-time sync instead of HTTP API
    kickPlayerWS(playerIdToKick);
  };

  const takePlayerSlot = async (position: number) => {
    if (!playerId || !gameState?.room?.id) return;
    
    // Use the replacePlayer WebSocket function instead of HTTP API
    replacePlayer(position);
  };

  const handleHostAssignSpectator = (spectatorId: string) => {
    if (!isHost) return;
    
    // Find the next available position (0-3)
    const occupiedPositions = players
      .filter((p: any) => !p.isSpectator && p.position !== null)
      .map((p: any) => p.position);
    
    let nextPosition = null;
    for (let i = 0; i < 4; i++) {
      if (!occupiedPositions.includes(i)) {
        nextPosition = i;
        break;
      }
    }
    
    if (nextPosition === null) {
      console.log("No available slots to assign spectator");
      return;
    }
    
    // Use WebSocket for real-time sync instead of HTTP API
    assignSpectator(spectatorId, nextPosition);
    console.log(`✅ Assigning spectator to position ${nextPosition} via WebSocket`);
  };

  // Handle case where room/player data is stale (server restart)
  useEffect(() => {
    if (roomError && roomId && playerId) {
      console.log("Room not found, clearing stale data and redirecting to home");
      localStorage.removeItem("currentRoomId");
      localStorage.removeItem("playerId");
      setLocation("/");
    }
  }, [roomError, roomId, playerId, setLocation]);

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-uno-blue via-uno-purple to-uno-red flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mb-4 mx-auto"></div>
          <p className="text-xl">Connecting to room...</p>
          <p className="text-sm mt-2 opacity-75">Please wait while we establish your connection</p>
        </div>
      </div>
    );
  }

  const room = gameState.room;
  const players = gameState.players || [];
  const gamePlayers = players.filter((p: any) => !p.isSpectator);
  const currentPlayer = players.find((p: any) => p.id === playerId);
  const isHost = currentPlayer?.isHost || currentPlayer?.id === room?.hostId;

  // Debug logging
  console.log("RoomLobby state:", {
    room,
    players: players.length,
    gamePlayers: gamePlayers.length,
    currentPlayer: currentPlayer?.nickname,
    isHost,
    playerId
  });

  const getPlayerSlots = () => {
    const slots = Array(4).fill(null);
    gamePlayers.forEach((player: any) => {
      if (player.position !== null && player.position !== undefined) {
        slots[player.position] = player;
      }
    });
    return slots;
  };

  const playerSlots = getPlayerSlots();

  // Check if player is online based on gameState
  const isPlayerOnline = (player: any) => {
    if (!gameState?.players || !player) return false;
    // Find the player in gameState.players and check their isOnline property
    const playerData = gameState.players.find((p: any) => p.id === player.id);
    return playerData?.isOnline || false;
  };

  // Get position class for avatar placement (12, 3, 6, 9 o'clock)
  const getPositionClass = (position: number) => {
    const positions = [
      'top-4 left-1/2 -translate-x-1/2', // 12 o'clock
      'right-4 top-1/2 -translate-y-1/2', // 3 o'clock  
      'bottom-4 left-1/2 -translate-x-1/2', // 6 o'clock
      'left-4 top-1/2 -translate-y-1/2' // 9 o'clock
    ];
    return positions[position] || positions[0];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-uno-blue via-uno-purple to-uno-red p-4">
      <div className="max-w-4xl mx-auto">
        {/* Room Header */}
        <Card className="bg-white/95 backdrop-blur-sm shadow-xl mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  Room <span className="font-mono text-uno-blue">{room?.code}</span>
                </h2>
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
                  onClick={() => setShowQRCode(!showQRCode)}
                  variant="outline"
                  size="sm"
                  className="bg-uno-green text-white hover:bg-green-600"
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  QR Code
                </Button>
                {/* Exit button - Only show for host in waiting room */}
                {isHost && (
                  <Button
                    onClick={handleLeaveRoom}
                    variant="outline"
                    size="sm"
                    className="bg-red-100 text-red-600 hover:bg-red-200"
                    title="Exit Room"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            
            <div className="text-sm text-gray-600">
              {gamePlayers.length}/4 players joined
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
            const player = playerSlots[position];
            const isOnline = player ? isPlayerOnline(player) : false;
            
            // Check if this position was active when game started
            const wasActiveAtStart = room?.activePositions?.includes(position) ?? false;
            const gameInProgress = room?.status === 'playing' || room?.status === 'paused';
            
            return (
              <div
                key={position}
                className={`absolute ${getPositionClass(position)} w-20 h-20`}
              >
                <div className="relative">
                  {player ? (
                    // Player Avatar
                    <div className="w-20 h-20 bg-gradient-to-br from-uno-blue to-uno-purple rounded-full flex flex-col items-center justify-center text-white font-bold shadow-lg border-4 border-white/20">
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
                    </div>
                  ) : (
                    // Empty Slot
                    <div 
                      className={`w-20 h-20 rounded-full flex items-center justify-center border-4 transition-colors ${
                        gameInProgress && !wasActiveAtStart
                          ? 'bg-gray-200/50 border-gray-300/30 cursor-not-allowed' 
                          : gameInProgress && wasActiveAtStart
                          ? 'bg-blue-100/50 border-blue-300/50 cursor-pointer hover:bg-blue-200/70'
                          : 'bg-gray-300/50 border-white/30 cursor-pointer hover:bg-gray-300/70'
                      }`}
                      onClick={() => {
                        if (gameInProgress && !wasActiveAtStart) {
                          return; // Slot was never active, permanently closed
                        }
                        if (currentPlayer?.isSpectator) {
                          takePlayerSlot(position);
                        } else if (!currentPlayer) {
                          // External user - redirect to join flow
                          const roomCode = room?.code;
                          if (roomCode) {
                            window.location.href = `/?room=${roomCode}&position=${position}`;
                          }
                        }
                      }}
                    >
                      {gameInProgress && !wasActiveAtStart ? (
                        <div className="text-center">
                          <X className="w-8 h-8 text-gray-400 mx-auto" />
                          <div className="text-xs text-gray-500 mt-1">Closed</div>
                        </div>
                      ) : gameInProgress && wasActiveAtStart ? (
                        <div className="text-center">
                          <Plus className="w-8 h-8 text-blue-600 mx-auto" />
                          <div className="text-xs text-blue-700 font-medium">Rejoin</div>
                        </div>
                      ) : currentPlayer?.isSpectator || !currentPlayer ? (
                        <div className="text-center">
                          <Plus className="w-8 h-8 text-blue-600 mx-auto" />
                          <div className="text-xs text-blue-700 font-medium">
                            {currentPlayer?.isSpectator ? "Join" : "Click to Join"}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <div className="w-8 h-8 rounded-full bg-gray-400 mx-auto" />
                          <div className="text-xs text-gray-600">Empty</div>
                        </div>
                      )}
                    </div>
                  )}
                  

                  
                  {/* Control Buttons Attached to Avatar */}
                  {player && (
                    <>
                      {/* Edit Button for Current Player - Bottom Right of Avatar */}
                      {player.id === playerId && (
                        <button
                          onClick={() => setShowNicknameEditor(true)}
                          className="absolute bottom-1 right-1 w-4 h-4 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-lg transition-colors border border-white"
                          title="Edit nickname"
                        >
                          E
                        </button>
                      )}
                      
                      {/* Kick Button for Host - Bottom Left of Avatar */}
                      {isHost && player.id !== playerId && (
                        <button
                          onClick={() => kickPlayerLocal(player.id)}
                          className="absolute bottom-1 left-1 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-lg transition-colors border border-white"
                          title={isOnline ? "Remove player" : "Remove offline player"}
                        >
                          K
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Spectators Section - Centered under avatar slots */}
        {players.filter((p: any) => p.isSpectator && p.isOnline).length > 0 && (
          <div className="w-full flex justify-center mb-6">
            <Card className="bg-white/95 backdrop-blur-sm shadow-xl" style={{
              width: 'min(20rem, 90vw)', // Responsive width that adapts to screen size
            }}>
              <CardContent className="p-3">
                <div className="text-xs font-semibold text-gray-700 mb-2 text-center">
                  Spectators ({players.filter((p: any) => p.isSpectator && p.isOnline).length})
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {players.filter((p: any) => p.isSpectator && p.isOnline).map((spectator: any, index: number, arr: any[]) => (
                    <div key={spectator.id}>
                      <div 
                        className={`flex items-center space-x-2 p-2 rounded-md transition-colors ${
                          isHost ? 'hover:bg-blue-50 cursor-pointer' : 'hover:bg-gray-50'
                        }`}
                        onClick={isHost ? () => handleHostAssignSpectator(spectator.id) : undefined}
                        title={isHost ? "Click to assign to next available slot" : ""}
                      >
                        <div className="w-6 h-6 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                          {spectator.nickname?.[0]?.toUpperCase()}
                        </div>
                        <span className="text-xs text-gray-700 flex-1 truncate">{spectator.nickname}</span>
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${spectator.isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                        {isHost && (
                          <div className="text-xs text-blue-600 font-medium">+</div>
                        )}
                      </div>
                      {/* Separator line between spectators */}
                      {index < arr.length - 1 && (
                        <hr className="border-gray-200 mx-1" />
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-xs text-gray-500 text-center">
                  {isHost ? "Click spectators to assign to slots" : "Click empty slots to join"}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Game Controls */}
        <Card className="bg-white/95 backdrop-blur-sm shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="text-gray-600">
                {gamePlayers.length < 2 ? "Need at least 2 players to start" : `${gamePlayers.length}/4 players ready`}
              </div>
              {isHost && (
                <Button 
                  onClick={handleStartGame}
                  disabled={gamePlayers.length < 2}
                  className="bg-uno-green hover:bg-green-600 text-white"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Start Game
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* QR Code Floating Panel - Draggable, non-blocking */}
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
            <Card className="w-64 shadow-2xl border-2 border-uno-blue/50 bg-white/98 backdrop-blur-sm animate-in slide-in-from-top-2 duration-200">
              <CardContent className="p-4">
                {/* Drag handle */}
                <div
                  className="flex items-center justify-between mb-3 cursor-grab active:cursor-grabbing"
                  onMouseDown={handleQRDragStart}
                  onTouchStart={handleQRDragStart}
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-semibold text-gray-700">Room {room?.code}</span>
                  </div>
                  <button
                    onClick={() => setShowQRCode(false)}
                    className="text-gray-400 hover:text-gray-600 p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                
                {/* QR Code */}
                <div className="bg-white p-3 rounded-lg shadow-inner border border-gray-100 mb-3">
                  <img 
                    src={qrCodeData} 
                    alt={`QR Code for room ${room?.code}`}
                    className="w-full h-auto"
                  />
                </div>
                
                {/* Copy Link Button */}
                <Button
                  onClick={handleCopyLink}
                  variant="outline"
                  size="sm"
                  className="w-full bg-uno-blue text-white hover:bg-blue-600"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Link
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Nickname Editor Modal */}
        {showNicknameEditor && currentPlayer && (
          <NicknameEditor
            currentNickname={currentPlayer.nickname}
            playerId={currentPlayer.id}
            isOpen={showNicknameEditor}
            onClose={() => setShowNicknameEditor(false)}
            onNicknameChanged={(newNickname) => {
              // The WebSocket will handle the real-time update
              setShowNicknameEditor(false);
            }}
          />
        )}
      </div>
    </div>
  );
}