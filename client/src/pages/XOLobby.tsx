import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Copy, Users, Play, Crown } from "lucide-react";
import { Link } from "wouter";
import QRCode from "qrcode";

interface Player {
  id: string;
  nickname: string;
  position: number;
  isSpectator: boolean;
  hasLeft?: boolean;
}

interface XOGameState {
  xPlayerId: string | null;
  oPlayerId: string | null;
}

interface Room {
  id: string;
  code: string;
  hostId: string | null;
  status: string;
  xoState: XOGameState;
}

export default function XOLobby() {
  const { roomId } = useParams<{ roomId: string }>();
  const [, setLocation] = useLocation();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const { toast } = useToast();
  
  const playerId = localStorage.getItem("xo_playerId");
  const roomCode = new URLSearchParams(window.location.search).get("code") || "";

  const { data, isLoading } = useQuery<{ room: Room; players: Player[] }>({
    queryKey: ['/api/xo/rooms', roomId],
    refetchInterval: 2000,
  });

  const room = data?.room;
  const players = data?.players || [];
  const isHost = room?.hostId === playerId;

  useEffect(() => {
    if (room?.status === "playing") {
      setLocation(`/xo/game/${roomId}`);
    }
  }, [room?.status, roomId, setLocation]);

  useEffect(() => {
    const generateQR = async () => {
      if (roomCode) {
        const shareUrl = `${window.location.origin}/xo?room=${roomCode}`;
        const url = await QRCode.toDataURL(shareUrl, { width: 200, margin: 2 });
        setQrCodeUrl(url);
      }
    };
    generateQR();
  }, [roomCode]);

  const startGameMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/xo/rooms/${roomId}/start`);
      return response.json();
    },
    onSuccess: () => {
      setLocation(`/xo/game/${roomId}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start game",
        variant: "destructive",
      });
    },
  });

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    toast({
      title: "Copied!",
      description: "Room code copied to clipboard",
    });
  };

  const copyShareLink = () => {
    const shareUrl = `${window.location.origin}/xo?room=${roomCode}`;
    navigator.clipboard.writeText(shareUrl);
    toast({
      title: "Copied!",
      description: "Share link copied to clipboard",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-indigo-900 dark:to-purple-900 flex items-center justify-center">
        <div className="text-xl text-gray-600 dark:text-gray-300">Loading...</div>
      </div>
    );
  }

  const activePlayers = players.filter(p => !p.hasLeft && !p.isSpectator);
  const canStart = activePlayers.length >= 2;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-indigo-900 dark:to-purple-900 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href="/xo" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white transition-colors">
            <ArrowLeft size={20} />
            Leave Room
          </Link>
        </div>

        <Card className="p-6 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-0 shadow-xl mb-6">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">⭕❌</div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">XO Game Lobby</h1>
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl font-mono font-bold tracking-widest text-indigo-600 dark:text-indigo-400">
                {roomCode}
              </span>
              <Button variant="ghost" size="sm" onClick={copyRoomCode} data-testid="button-copy-code">
                <Copy size={18} />
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* QR Code */}
            <div className="text-center">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-3">Scan to Join</h3>
              {qrCodeUrl && (
                <img src={qrCodeUrl} alt="QR Code" className="mx-auto rounded-lg shadow" />
              )}
              <Button variant="outline" size="sm" onClick={copyShareLink} className="mt-3" data-testid="button-copy-link">
                <Copy size={16} className="mr-2" />
                Copy Link
              </Button>
            </div>

            {/* Players */}
            <div>
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Users size={16} />
                Players ({activePlayers.length}/2)
              </h3>
              <div className="space-y-2">
                {activePlayers.map((player, index) => (
                  <div
                    key={player.id}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      index === 0 ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-purple-50 dark:bg-purple-900/30'
                    }`}
                    data-testid={`player-${player.id}`}
                  >
                    <span className="text-2xl">{index === 0 ? '❌' : '⭕'}</span>
                    <span className="font-medium flex-1">{player.nickname}</span>
                    {room?.hostId === player.id && (
                      <Crown size={16} className="text-yellow-500" />
                    )}
                  </div>
                ))}
                {activePlayers.length < 2 && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border-2 border-dashed border-gray-300 dark:border-gray-600">
                    <span className="text-2xl opacity-50">⭕</span>
                    <span className="text-gray-400">Waiting for opponent...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Start Game Button */}
        {isHost && (
          <Card className="p-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-0 shadow-xl">
            <Button
              onClick={() => startGameMutation.mutate()}
              disabled={!canStart || startGameMutation.isPending}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-6 text-lg"
              data-testid="button-start-game"
            >
              <Play size={24} className="mr-2" />
              {startGameMutation.isPending ? "Starting..." : canStart ? "Start Game" : "Waiting for opponent..."}
            </Button>
          </Card>
        )}

        {!isHost && (
          <Card className="p-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-0 shadow-xl text-center">
            <p className="text-gray-600 dark:text-gray-300">
              Waiting for host to start the game...
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
