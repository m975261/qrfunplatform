import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Upload, Camera, ArrowRight } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import QRScanner from "@/components/ui/qr-scanner";
import QrScanner from 'qr-scanner';

export default function Home() {
  const [, setLocation] = useLocation();
  const [roomCode, setRoomCode] = useState("");
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showNicknamePopup, setShowNicknamePopup] = useState(false);
  const [showHostPopup, setShowHostPopup] = useState(false);
  const [qrDetectedCode, setQrDetectedCode] = useState("");
  const [popupNickname, setPopupNickname] = useState("");
  const { toast } = useToast();

  // Check for existing player session and room parameter in URL
  useEffect(() => {
    const existingPlayerId = localStorage.getItem("playerId");
    const existingNickname = localStorage.getItem("playerNickname");
    const existingRoomId = localStorage.getItem("currentRoomId");
    
    // If user has an existing session, redirect to their room
    if (existingPlayerId && existingNickname && existingRoomId) {
      console.log("Found existing session, redirecting to room:", { existingPlayerId, existingNickname, existingRoomId });
      setLocation(`/room/${existingRoomId}`);
      return;
    }
    
    // Check for room parameter in URL (from shared links)
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room') || urlParams.get('code');
    
    if (roomFromUrl) {
      const cleanCode = roomFromUrl.replace(/[^0-9]/g, ''); // Remove non-digits
      if (cleanCode.length === 5) {
        // If user already has a nickname from previous session, use it
        if (existingNickname) {
          setPopupNickname(existingNickname);
        }
        setQrDetectedCode(cleanCode);
        setShowNicknamePopup(true);
        // Clear the URL parameter after extracting it
        window.history.replaceState({}, document.title, window.location.pathname);
        toast({
          title: "Room Link Detected",
          description: `Joining room ${cleanCode}! ${existingNickname ? 'Using saved nickname.' : 'Enter your nickname.'}`,
        });
      }
    }
  }, [toast, setLocation]);

  const createRoomMutation = useMutation({
    mutationFn: async (hostNickname: string) => {
      const response = await apiRequest("POST", "/api/rooms", { hostNickname });
      return response.json();
    },
    onSuccess: (data) => {
      localStorage.setItem("playerId", data.player.id);
      localStorage.setItem("playerNickname", popupNickname);
      localStorage.setItem("currentRoomId", data.room.id);
      setShowHostPopup(false);
      setLocation(`/room/${data.room.id}?code=${data.room.code}`);
      // Room created - no toast notification needed
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create room. Please try again.",
        variant: "destructive",
      });
      setShowHostPopup(false);
    },
  });

  const joinRoomMutation = useMutation({
    mutationFn: async ({ code, nickname }: { code: string; nickname: string }) => {
      const response = await apiRequest("POST", `/api/rooms/${code}/join`, { nickname });
      return response.json();
    },
    onSuccess: (data) => {
      localStorage.setItem("playerId", data.player.id);
      localStorage.setItem("playerNickname", popupNickname);
      localStorage.setItem("currentRoomId", data.room.id);
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

  // Direct join from QR code mutation
  const directJoinMutation = useMutation({
    mutationFn: async ({ code, nickname }: { code: string; nickname: string }) => {
      const response = await apiRequest("POST", `/api/rooms/${code}/join`, { nickname });
      return response.json();
    },
    onSuccess: (data) => {
      localStorage.setItem("playerId", data.player.id);
      localStorage.setItem("playerNickname", popupNickname);
      setShowNicknamePopup(false);
      if (data.room.status === "waiting") {
        setLocation(`/room/${data.room.id}`);
      } else {
        setLocation(`/game/${data.room.id}`);
      }
      // Room joined - no toast notification needed
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to join room. The room might not exist or be full.",
        variant: "destructive",
      });
      setShowNicknamePopup(false);
    },
  });

  const handleCreateRoom = () => {
    setShowHostPopup(true);
  };

  const handleHostRoom = () => {
    if (!popupNickname.trim()) {
      toast({
        title: "Error",
        description: "Please enter a nickname.",
        variant: "destructive",
      });
      return;
    }
    createRoomMutation.mutate(popupNickname);
  };

  const handleJoinRoom = () => {
    if (!roomCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a room code.",
        variant: "destructive",
      });
      return;
    }
    setQrDetectedCode(roomCode);
    setShowNicknamePopup(true);
  };

  const handleDirectJoin = () => {
    if (!popupNickname.trim()) {
      toast({
        title: "Error",
        description: "Please enter a nickname.",
        variant: "destructive",
      });
      return;
    }
    directJoinMutation.mutate({ code: qrDetectedCode, nickname: popupNickname });
  };

  const handleQRUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        // Create an image element to load the file
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const loadImage = () => new Promise<void>((resolve, reject) => {
          img.onload = () => {
            // Set canvas size to match image
            canvas.width = img.width;
            canvas.height = img.height;
            
            // Draw image on canvas
            ctx?.drawImage(img, 0, 0);
            resolve();
          };
          img.onerror = reject;
        });
        
        // Load the image
        img.src = URL.createObjectURL(file);
        await loadImage();
        
        // Scan QR code from canvas
        const result = await QrScanner.scanImage(canvas);
        
        // Extract room code from the result
        let roomCode = '';
        
        // Check for different URL patterns
        if (result.includes('/r/')) {
          const match = result.match(/\/r\/([0-9]{5})/);
          roomCode = match ? match[1] : '';
        } else if (result.includes('/game?code=')) {
          const match = result.match(/code=([0-9]{5})/);
          roomCode = match ? match[1] : '';
        } else if (result.includes('room=')) {
          const match = result.match(/room=([0-9]{5})/);
          roomCode = match ? match[1] : '';
        } else if (/^[0-9]{5}$/.test(result)) {
          // Direct room code
          roomCode = result;
        }
        
        if (roomCode) {
          setQrDetectedCode(roomCode);
          setShowNicknamePopup(true);
        } else {
          toast({
            title: "Invalid QR Code",
            description: "This QR code doesn't contain a valid UNO room code.",
            variant: "destructive",
          });
        }
        
        // Clean up
        URL.revokeObjectURL(img.src);
        
      } catch (error) {
        console.error('QR code scan error:', error);
        toast({
          title: "Scan Failed",
          description: "Could not read QR code from this image. Make sure it's clear and contains a valid QR code.",
          variant: "destructive",
        });
      }
    }
    
    // Reset the input so the same file can be selected again
    event.target.value = '';
  };

  const handleQRScan = (result: string) => {
    // Extract room code from QR result - handle multiple URL patterns
    let roomCode = '';
    
    if (result.includes('/r/')) {
      const match = result.match(/\/r\/([0-9]{5})/);
      roomCode = match ? match[1] : '';
    } else if (result.includes('/game?code=')) {
      const match = result.match(/code=([0-9]{5})/);
      roomCode = match ? match[1] : '';
    } else if (result.includes('room=')) {
      const match = result.match(/room=([0-9]{5})/);
      roomCode = match ? match[1] : '';
    } else if (/^[0-9]{5}$/.test(result)) {
      // Direct room code
      roomCode = result;
    }
    
    if (roomCode) {
      setQrDetectedCode(roomCode);
      setShowQRScanner(false);
      setShowNicknamePopup(true);
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
                  onChange={(e) => setRoomCode(e.target.value)}
                  maxLength={5}
                  className="flex-1 text-center font-mono font-medium"
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
                <Label className="flex-1 bg-uno-yellow/20 hover:bg-uno-yellow/30 text-gray-700 py-3 px-4 rounded-xl font-medium cursor-pointer transition-all text-center border-2 border-dashed border-uno-yellow/50 hover:border-uno-yellow">
                  <Upload className="inline mr-2 h-4 w-4" />
                  Upload QR Photo
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
                  className="flex-1 bg-uno-blue/10 hover:bg-uno-blue/20 text-gray-700 border-uno-blue/30"
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Live Scan
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

      {/* Nickname Popup for Direct QR Join */}
      <Dialog open={showNicknamePopup} onOpenChange={(open) => {
        setShowNicknamePopup(open);
        if (!open) setPopupNickname("");
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center font-fredoka text-2xl bg-gradient-to-r from-uno-red to-uno-yellow bg-clip-text text-transparent">
              Join Room {qrDetectedCode}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label htmlFor="popup-nickname" className="text-sm font-medium text-gray-700 mb-2">
                Enter Your Nickname
              </Label>
              <Input
                id="popup-nickname"
                type="text"
                placeholder="Your nickname..."
                value={popupNickname}
                onChange={(e) => setPopupNickname(e.target.value)}
                maxLength={20}
                className="text-center font-medium"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleDirectJoin();
                  }
                }}
                autoFocus
              />
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={() => {
                  setShowNicknamePopup(false);
                  setPopupNickname("");
                }}
                variant="outline"
                className="flex-1"
                disabled={directJoinMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDirectJoin}
                disabled={directJoinMutation.isPending || !popupNickname.trim()}
                className="flex-1 bg-gradient-to-r from-uno-green to-emerald-500 hover:scale-105 transition-all"
              >
                {directJoinMutation.isPending ? (
                  <ArrowRight className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                Join Room
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Host Popup for Creating Room */}
      <Dialog open={showHostPopup} onOpenChange={(open) => {
        setShowHostPopup(open);
        if (!open) setPopupNickname("");
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center font-fredoka text-2xl bg-gradient-to-r from-uno-red to-uno-yellow bg-clip-text text-transparent">
              Create New Room
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label htmlFor="host-nickname" className="text-sm font-medium text-gray-700 mb-2">
                Enter Your Nickname
              </Label>
              <Input
                id="host-nickname"
                type="text"
                placeholder="Your nickname..."
                value={popupNickname}
                onChange={(e) => setPopupNickname(e.target.value)}
                maxLength={20}
                className="text-center font-medium"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleHostRoom();
                  }
                }}
                autoFocus
              />
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={() => {
                  setShowHostPopup(false);
                  setPopupNickname("");
                }}
                variant="outline"
                className="flex-1"
                disabled={createRoomMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleHostRoom}
                disabled={createRoomMutation.isPending || !popupNickname.trim()}
                className="flex-1 bg-gradient-to-r from-uno-green to-emerald-500 hover:scale-105 transition-all"
              >
                {createRoomMutation.isPending ? (
                  <Plus className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Create Room
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
