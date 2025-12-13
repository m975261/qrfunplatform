import { useEffect, useState } from "react";
import { useRoute, useSearch, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tv, User, Loader2 } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";

export default function StreamJoinPage() {
  const [, params] = useRoute("/stream/:roomId/join");
  const search = useSearch();
  const [, setLocation] = useLocation();
  const roomId = params?.roomId;
  const roomCode = new URLSearchParams(search).get('code') || undefined;
  
  const [nickname, setNickname] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [roomInfo, setRoomInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { gameState, joinRoom, isConnected } = useSocket();

  useEffect(() => {
    const fetchRoomInfo = async () => {
      if (!roomId) return;
      try {
        const response = await fetch(`/api/rooms/${roomId}`);
        if (response.ok) {
          const data = await response.json();
          setRoomInfo(data);
        }
      } catch (error) {
        console.error("Error fetching room info:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRoomInfo();
  }, [roomId]);

  useEffect(() => {
    if (gameState?.joinedAsHost !== undefined && gameState?.room) {
      const code = gameState.room.code;
      if (gameState.joinedAsHost) {
        localStorage.setItem("streamHostPlayerId", localStorage.getItem("playerId") || "");
        setLocation(`/stream/${roomId}/host?code=${code}`);
      } else {
        localStorage.setItem("streamSpectatorPlayerId", localStorage.getItem("playerId") || "");
        setLocation(`/stream/${roomId}/spectator?code=${code}`);
      }
    }
  }, [gameState?.joinedAsHost, gameState?.room, roomId, setLocation]);

  const handleJoin = async () => {
    if (!nickname.trim() || nickname.length < 2) {
      setError("Please enter a nickname with at least 2 characters.");
      return;
    }

    setIsJoining(true);
    setError(null);
    
    try {
      const response = await fetch("/api/stream/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          nickname: nickname.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 409) {
          setError(error.message || "This nickname is already in use. Please choose a different one.");
          setIsJoining(false);
          return;
        }
        throw new Error(error.message || "Failed to join room");
      }

      const data = await response.json();
      
      localStorage.setItem("playerId", data.playerId);
      localStorage.setItem("playerNickname", nickname.trim());
      
      if (isConnected && roomId) {
        joinRoom(data.playerId, roomId);
      }
      
      const code = roomInfo?.room?.code || roomCode;
      
      if (data.isHost) {
        localStorage.setItem("streamHostPlayerId", data.playerId);
        setLocation(`/stream/${roomId}/host?code=${code}`);
      } else {
        localStorage.setItem("streamSpectatorPlayerId", data.playerId);
        setLocation(`/stream/${roomId}/spectator?code=${code}`);
      }
    } catch (error: any) {
      setError(error.message || "Could not join the streaming room.");
      setIsJoining(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isJoining) {
      handleJoin();
    }
  };

  const room = roomInfo?.room;
  const hasHost = room?.hostId !== null && room?.hostId !== undefined;
  const playerCount = roomInfo?.players?.filter((p: any) => !p.isSpectator)?.length || 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-uno-blue via-uno-purple to-uno-red flex items-center justify-center">
        <Card className="bg-white/95 backdrop-blur-sm shadow-xl p-8">
          <div className="text-center">
            <Loader2 className="w-16 h-16 mx-auto mb-4 text-purple-600 animate-spin" />
            <h2 className="text-2xl font-bold mb-2 text-gray-800">Loading Room...</h2>
          </div>
        </Card>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-uno-blue via-uno-purple to-uno-red flex items-center justify-center">
        <Card className="bg-white/95 backdrop-blur-sm shadow-xl p-8">
          <div className="text-center">
            <Tv className="w-16 h-16 mx-auto mb-4 text-red-600" />
            <h2 className="text-2xl font-bold mb-2 text-gray-800">Room Not Found</h2>
            <p className="text-gray-600">This streaming room doesn't exist or has expired.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-uno-blue via-uno-purple to-uno-red flex items-center justify-center p-4">
      <Card className="bg-white/95 backdrop-blur-sm shadow-xl max-w-md w-full">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Tv className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Join Stream Room</h1>
            <p className="text-gray-600">
              Room Code: <span className="font-mono font-bold text-uno-blue">{room.code}</span>
            </p>
            
            <div className="mt-4 p-3 bg-gray-100 rounded-lg">
              {!hasHost ? (
                <div className="text-green-600 font-semibold">
                  You'll be the HOST with full control!
                </div>
              ) : (
                <div className="text-purple-600 font-semibold">
                  You'll join as a spectator. Host will assign you to play.
                </div>
              )}
              <div className="text-sm text-gray-500 mt-1">
                {playerCount}/4 players assigned
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter Your Nickname
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Your nickname..."
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-10 text-lg py-6"
                  maxLength={20}
                  disabled={isJoining}
                  data-testid="input-stream-nickname"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <Button
              onClick={handleJoin}
              disabled={isJoining || nickname.trim().length < 2}
              className="w-full py-6 text-lg font-bold bg-gradient-to-r from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800"
              data-testid="button-stream-join"
            >
              {isJoining ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Joining...
                </>
              ) : hasHost ? (
                "Join as Spectator"
              ) : (
                "Join as Host"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
