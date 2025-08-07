import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, QrCode, X, Plus, Play, Crown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useSocket } from "@/hooks/useSocket";

export default function RoomLobby() {
  const [, params] = useRoute("/room/:roomId");
  const [, setLocation] = useLocation();
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeData, setQRCodeData] = useState<string | null>(null);
  const { toast } = useToast();
  const { gameState, joinRoom, startGame, isConnected } = useSocket();
  const roomId = params?.roomId;
  const playerId = localStorage.getItem("playerId");

  const { data: roomData } = useQuery({
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

  useEffect(() => {
    if (gameState?.room?.status === "playing") {
      setLocation(`/game/${roomId}`);
    }
  }, [gameState?.room?.status, roomId, setLocation]);

  const handleCopyLink = () => {
    const roomLink = `${window.location.origin}/?room=${gameState?.room?.code}`;
    navigator.clipboard.writeText(roomLink);
    toast({
      title: "Link Copied",
      description: "Room link copied to clipboard!",
    });
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
    setLocation("/");
  };

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-uno-blue via-uno-purple to-uno-red flex items-center justify-center">
        <div className="text-white text-xl">
          <div>Loading...</div>
          <div className="text-sm mt-2">
            Player ID: {playerId ? playerId.substring(0, 8) + '...' : 'None'}
          </div>
          <div className="text-sm">
            Connected: {isConnected ? 'Yes' : 'No'}
          </div>
        </div>
      </div>
    );
  }

  const room = gameState.room;
  const players = gameState.players || [];
  const gamePlayers = players.filter((p: any) => !p.isSpectator);
  const currentPlayer = players.find((p: any) => p.id === playerId);
  const isHost = currentPlayer?.id === room?.hostId;

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
      if (player.position !== null) {
        slots[player.position] = player;
      }
    });
    return slots;
  };

  const playerSlots = getPlayerSlots();

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
                <Button
                  onClick={handleLeaveRoom}
                  variant="outline"
                  size="sm"
                  className="bg-red-100 text-red-600 hover:bg-red-200"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="text-sm text-gray-600">
              {gamePlayers.length}/4 players joined
            </div>
          </CardContent>
        </Card>

        {/* Player Slots */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {playerSlots.map((player, index) => (
            <Card key={index} className="bg-white/95 backdrop-blur-sm shadow-xl">
              <CardContent className="p-6">
                {player ? (
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <div className={`w-16 h-16 bg-gradient-to-br ${
                        index === 0 ? 'from-uno-green to-emerald-500' :
                        index === 1 ? 'from-uno-blue to-blue-500' :
                        index === 2 ? 'from-uno-red to-red-500' :
                        'from-uno-yellow to-yellow-500'
                      } rounded-full flex items-center justify-center text-white text-xl font-bold`}>
                        {player.nickname[0].toUpperCase()}
                      </div>
                      {player.id === room?.hostId && (
                        <div className="absolute -top-1 -right-1 bg-uno-yellow text-white text-xs px-2 py-0.5 rounded-full font-medium">
                          <Crown className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-800">{player.nickname}</div>
                      <div className="text-sm text-gray-500">Ready to play</div>
                    </div>
                    <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 hover:border-uno-blue cursor-pointer transition-all group h-16 rounded-xl">
                    <div className="flex items-center justify-center h-full text-gray-400 group-hover:text-uno-blue transition-all">
                      <div className="text-center">
                        <Plus className="h-6 w-6 mx-auto mb-1" />
                        <div className="text-sm font-medium">Waiting for player...</div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Game Controls */}
        <Card className="bg-white/95 backdrop-blur-sm shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="text-gray-600">
                {gamePlayers.length >= 2 ? "All players ready? Let's start the game!" : "Waiting for more players..."}
              </div>
              {isHost && (
                <Button
                  onClick={handleStartGame}
                  disabled={gamePlayers.length < 2}
                  className="bg-gradient-to-r from-uno-green to-emerald-500 hover:scale-105 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Start Game
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* QR Code Modal */}
        {showQRCode && qrCodeData && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <Card className="max-w-sm w-full mx-4">
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Share Room</h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowQRCode(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="bg-white p-4 rounded-xl mb-4">
                  <img src={qrCodeData} alt="Room QR Code" className="w-full max-w-48 mx-auto" />
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Scan this QR code or share room code: <strong>{room?.code}</strong>
                </p>
                <Button onClick={handleCopyLink} className="w-full">
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Room Link
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
