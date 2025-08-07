import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Upload, Camera, ArrowRight } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import QRScanner from "@/components/ui/qr-scanner";

export default function Home() {
  const [, setLocation] = useLocation();
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [showQRScanner, setShowQRScanner] = useState(false);
  const { toast } = useToast();

  const createRoomMutation = useMutation({
    mutationFn: async (hostNickname: string) => {
      const response = await apiRequest("POST", "/api/rooms", { hostNickname });
      return response.json();
    },
    onSuccess: (data) => {
      localStorage.setItem("playerNickname", nickname);
      setLocation(`/room/${data.room.id}?code=${data.room.code}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create room. Please try again.",
        variant: "destructive",
      });
    },
  });

  const joinRoomMutation = useMutation({
    mutationFn: async ({ code, nickname }: { code: string; nickname: string }) => {
      const response = await apiRequest("POST", `/api/rooms/${code}/join`, { nickname });
      return response.json();
    },
    onSuccess: (data) => {
      localStorage.setItem("playerId", data.player.id);
      localStorage.setItem("playerNickname", nickname);
      if (data.room.status === "waiting") {
        setLocation(`/room/${data.room.id}`);
      } else {
        setLocation(`/game/${data.room.id}`);
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to join room. Please check the room code.",
        variant: "destructive",
      });
    },
  });

  const handleCreateRoom = () => {
    if (!nickname.trim()) {
      toast({
        title: "Error",
        description: "Please enter a nickname.",
        variant: "destructive",
      });
      return;
    }
    createRoomMutation.mutate(nickname);
  };

  const handleJoinRoom = () => {
    if (!nickname.trim() || !roomCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter both nickname and room code.",
        variant: "destructive",
      });
      return;
    }
    joinRoomMutation.mutate({ code: roomCode.toUpperCase(), nickname });
  };

  const handleQRUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // TODO: Implement QR code reading from uploaded image
      toast({
        title: "Feature Coming Soon",
        description: "QR code upload will be available soon!",
      });
    }
  };

  const handleQRScan = (result: string) => {
    // Extract room code from QR result
    const match = result.match(/room=([A-Z0-9]{6})/);
    if (match) {
      setRoomCode(match[1]);
      setShowQRScanner(false);
      toast({
        title: "Room Code Found",
        description: `Room code ${match[1]} detected from QR code.`,
      });
    } else {
      toast({
        title: "Invalid QR Code",
        description: "This QR code doesn't contain a valid room code.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-uno-blue via-uno-purple to-uno-red flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white/95 backdrop-blur-sm shadow-2xl animate-fade-in">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <h1 className="font-fredoka text-4xl bg-gradient-to-r from-uno-red to-uno-yellow bg-clip-text text-transparent mb-2">
              UNO Multiplayer
            </h1>
            <p className="text-gray-600">Play with friends anywhere!</p>
          </div>

          <div className="space-y-6">
            {/* Nickname Input */}
            <div>
              <Label htmlFor="nickname" className="text-sm font-medium text-gray-700 mb-2">
                Your Nickname
              </Label>
              <Input
                id="nickname"
                type="text"
                placeholder="Enter your nickname..."
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                className="text-center font-medium"
              />
            </div>

            {/* Room Options */}
            <div className="space-y-4">
              <Button
                onClick={handleCreateRoom}
                disabled={createRoomMutation.isPending}
                className="w-full bg-gradient-to-r from-uno-green to-emerald-500 hover:scale-105 transition-all shadow-lg hover:shadow-xl"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create New Room
              </Button>

              <div className="flex space-x-2">
                <Input
                  type="text"
                  placeholder="Room Code"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="flex-1 text-center font-mono font-medium uppercase"
                />
                <Button
                  onClick={handleJoinRoom}
                  disabled={joinRoomMutation.isPending}
                  className="bg-uno-blue hover:bg-blue-600 shadow-lg"
                >
                  Join
                </Button>
              </div>

              <div className="text-center text-gray-500 text-sm">or</div>

              {/* QR Code Options */}
              <div className="flex space-x-2">
                <Label className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-xl font-medium cursor-pointer transition-all text-center">
                  <Upload className="inline mr-2 h-4 w-4" />
                  Upload QR
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleQRUpload}
                    className="hidden"
                  />
                </Label>
                <Button
                  onClick={() => setShowQRScanner(true)}
                  variant="outline"
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Scan QR
                </Button>
              </div>
            </div>

            {/* Recent Rooms */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Recent Rooms</h3>
              <div className="text-center text-gray-500 text-sm">
                No recent rooms found
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {showQRScanner && (
        <QRScanner
          onResult={handleQRScan}
          onClose={() => setShowQRScanner(false)}
        />
      )}
    </div>
  );
}
