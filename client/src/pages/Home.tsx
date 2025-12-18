import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Upload, Camera, ArrowRight, ArrowLeft, Radio, Eye } from "lucide-react";
import { Link } from "wouter";
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
  const [selectedAvatar, setSelectedAvatar] = useState<'male' | 'female'>('male');
  const [showGuruLogin, setShowGuruLogin] = useState(false);
  const [guruPassword, setGuruPassword] = useState("");
  const [pendingAction, setPendingAction] = useState<'create' | 'join' | null>(null);
  const [guruLoginError, setGuruLoginError] = useState("");
  
  // Mode tabs for guru users (streaming removed)
  const [selectedModeTab, setSelectedModeTab] = useState<'normal' | 'viewer'>('normal');
  const [isGuruUserLoggedIn, setIsGuruUserLoggedIn] = useState(false);
  
  // Viewer Mode state
  const [isViewerMode, setIsViewerMode] = useState(false);
  const [showViewerConfirm, setShowViewerConfirm] = useState(false);
  
  const { toast } = useToast();
  
  // Check if user is already logged in as guru
  useEffect(() => {
    const guruStatus = localStorage.getItem("isGuruUser");
    setIsGuruUserLoggedIn(guruStatus === "true");
  }, []);

  // Smart session and nickname management
  useEffect(() => {
    const existingPlayerId = localStorage.getItem("playerId");
    const existingNickname = localStorage.getItem("playerNickname");
    const existingRoomId = localStorage.getItem("currentRoomId");
    
    // If user has an existing session but came from a shared link, clear old session first
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room') || urlParams.get('code');
    
    if (roomFromUrl && existingPlayerId && existingNickname && existingRoomId) {
      // Clear old session when accessing via shared link
      localStorage.removeItem("playerId");
      localStorage.removeItem("playerNickname"); 
      localStorage.removeItem("currentRoomId");
      console.log("Cleared old session due to shared link access");
    } else if (existingPlayerId && existingNickname && existingRoomId) {
      console.log("Found existing session, but NOT auto-redirecting to avoid unwanted room access");
      // Don't auto-redirect - let user manually choose to rejoin or create new room
      // This prevents unwanted automatic room access when just visiting the home page
    }
    
    // Check for room parameter in URL (from shared links) - already extracted above
    const preferredPosition = urlParams.get('position');
    
    if (roomFromUrl) {
      const cleanCode = roomFromUrl.replace(/[^0-9]/g, ''); // Remove non-digits
      if (cleanCode.length === 5) {
        // Store preferred position if provided
        if (preferredPosition) {
          localStorage.setItem("preferredPosition", preferredPosition);
        }
        
        // If user already has a nickname from previous session, auto-join without popup
        if (existingNickname) {
          console.log("Auto-joining with saved nickname:", existingNickname);
          setQrDetectedCode(cleanCode);
          setPopupNickname(existingNickname);
          directJoinMutation.mutate({ code: cleanCode, nickname: existingNickname });
          return;
        }
        
        // First time user - show nickname popup
        setQrDetectedCode(cleanCode);
        setShowNicknamePopup(true);
        // Clear the URL parameter after extracting it
        window.history.replaceState({}, document.title, window.location.pathname);
        toast({
          title: "Room Link Detected",
          description: `Joining room ${cleanCode}! Enter your nickname.`,
          duration: 1000,
        });
      }
    }
  }, [toast, setLocation]);

  const createRoomMutation = useMutation({
    mutationFn: async ({ hostNickname, viewerMode }: { hostNickname?: string; viewerMode?: boolean }) => {
      const payload: { hostNickname?: string; isStreamingMode: boolean; isViewerMode?: boolean } = { 
        isStreamingMode: false 
      };
      if (hostNickname) {
        payload.hostNickname = hostNickname;
      }
      if (viewerMode) {
        payload.isViewerMode = true;
      }
      const response = await apiRequest("POST", "/api/rooms", payload);
      return response.json();
    },
    onSuccess: (data) => {
      // VIEWER MODE: Create empty lobby - no host player, redirect to viewer mode lobby
      if (data.isViewerMode) {
        setShowHostPopup(false);
        setIsViewerMode(false);
        // Store room info only - no player created yet (first joiner becomes host)
        localStorage.setItem("currentRoomId", data.room.id);
        // Clear any stale player IDs
        localStorage.removeItem("playerId");
        localStorage.removeItem("playerNickname");
        
        // Navigate to Viewer Mode Lobby page (empty lobby, users join via QR/link)
        setLocation(`/vmode/room/${data.room.id}?code=${data.room.code}`);
        return;
      }
      
      // NORMAL MODE: Standard room creation flow
      localStorage.setItem("playerId", data.player.id);
      localStorage.setItem("playerNickname", data.hostNickname || popupNickname);
      localStorage.setItem("currentRoomId", data.room.id);
      // Save selected avatar
      localStorage.setItem(`avatar_${data.player.id}`, selectedAvatar);
      setShowHostPopup(false);
      setLocation(`/room/${data.room.id}?code=${data.room.code}`);
      // Room created - no toast notification needed
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create room. Please try again.",
        variant: "destructive",
        duration: 1000,
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
      localStorage.setItem("playerNickname", data.player.nickname);
      localStorage.setItem("currentRoomId", data.room.id);
      // Save selected avatar (but use existing saved nickname for manual joins)
      const existingNickname = localStorage.getItem("playerNickname");
      if (existingNickname) {
        const savedAvatarKey = Object.keys(localStorage).find(key => 
          key.startsWith('avatar_') && localStorage.getItem(key)
        );
        if (savedAvatarKey) {
          const savedAvatar = localStorage.getItem(savedAvatarKey);
          localStorage.setItem(`avatar_${data.player.id}`, savedAvatar || 'male');
        } else {
          localStorage.setItem(`avatar_${data.player.id}`, selectedAvatar);
        }
      } else {
        localStorage.setItem(`avatar_${data.player.id}`, selectedAvatar);
      }
      
      // Clear room code input
      setRoomCode("");
      
      console.log("Successfully joined room:", data);
      
      // VIEWER MODE: Redirect to viewer mode routes
      if (data.room.isViewerMode) {
        if (data.room.status === "waiting") {
          setLocation(`/vmode/room/${data.room.id}`);
        } else {
          setLocation(`/vmode/game/${data.room.id}`);
        }
        return;
      }
      
      // NORMAL MODE
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
        duration: 1000,
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
      localStorage.setItem("playerNickname", data.player.nickname);
      localStorage.setItem("currentRoomId", data.room.id);
      // Save selected avatar
      localStorage.setItem(`avatar_${data.player.id}`, selectedAvatar);
      setShowNicknamePopup(false);
      
      console.log("Successfully joined room via link:", data);
      
      // VIEWER MODE: Redirect to viewer mode routes
      if (data.room.isViewerMode) {
        if (data.room.status === "waiting") {
          setLocation(`/vmode/room/${data.room.id}`);
        } else {
          setLocation(`/vmode/game/${data.room.id}`);
        }
        return;
      }
      
      // NORMAL MODE
      if (data.room.status === "waiting") {
        setLocation(`/room/${data.room.id}`);
      } else {
        setLocation(`/game/${data.room.id}`);
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to join room. The room might not exist or be full.",
        variant: "destructive",
        duration: 1000,
      });
      setShowNicknamePopup(false);
    },
  });

  const handleCreateRoom = () => {
    const existingNickname = localStorage.getItem("playerNickname");
    if (existingNickname) {
      // Use saved nickname automatically
      setPopupNickname(existingNickname);
    }
    setShowHostPopup(true);
  };

  // Check if nickname is a guru user
  const checkGuruUser = async (nickname: string, action: 'create' | 'join') => {
    try {
      const response = await fetch('/api/guru-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: nickname, password: 'check', gameType: 'uno' })
      });
      
      if (response.status === 404) {
        // Not a guru user, proceed normally
        return false;
      } else if (response.status === 200) {
        // Is a guru user but needs password
        const data = await response.json();
        return data.requiresPassword || data.userExists;
      } else {
        // Unexpected response
        return false;
      }
    } catch (error) {
      console.error('Error checking guru user:', error);
      return false;
    }
  };

  const handleGuruAuthentication = async () => {
    if (!guruPassword.trim()) {
      setGuruLoginError("Please enter your password.");
      return;
    }

    try {
      const response = await fetch('/api/guru-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: popupNickname, password: guruPassword, gameType: 'uno' })
      });

      if (response.ok) {
        const data = await response.json();
        // Store guru user status
        localStorage.setItem("isGuruUser", "true");
        localStorage.setItem("guruUserData", JSON.stringify(data.guruUser));
        // Store the guru user's actual playerName as the nickname to use
        localStorage.setItem("playerNickname", data.guruUser.playerName);
        
        // Close guru login and proceed with original action
        setShowGuruLogin(false);
        setGuruPassword("");
        setGuruLoginError("");
        
        // Update the nickname to use guru user's playerName for display
        setPopupNickname(data.guruUser.playerName);
        
        if (pendingAction === 'create') {
          // Guru users use the tab selection for viewer mode
          const viewerMode = selectedModeTab === 'viewer';
          setIsGuruUserLoggedIn(true);
          if (viewerMode) {
            // Viewer mode - no nickname needed, creates empty lobby (first joiner becomes host)
            createRoomMutation.mutate({ viewerMode: true });
          } else {
            // Normal mode - use guru user's playerName
            createRoomMutation.mutate({ hostNickname: data.guruUser.playerName });
          }
        } else if (pendingAction === 'join') {
          if (qrDetectedCode) {
            // Use guru user's playerName instead of entered nickname
            directJoinMutation.mutate({ code: qrDetectedCode, nickname: data.guruUser.playerName });
          }
        }
        setPendingAction(null);
      } else {
        const errorData = await response.json();
        setGuruLoginError(errorData.error || "Invalid password.");
      }
    } catch (error) {
      console.error('Error authenticating guru user:', error);
      setGuruLoginError("Authentication failed. Please try again.");
    }
  };

  const handleHostRoom = async () => {
    // Determine mode based on user type
    const viewerMode = isGuruUserLoggedIn ? (selectedModeTab === 'viewer') : isViewerMode;
    
    // Viewer mode doesn't need nickname - create empty lobby immediately
    if (viewerMode) {
      createRoomMutation.mutate({ viewerMode: true });
      return;
    }
    
    // Normal mode requires nickname
    if (!popupNickname.trim()) {
      toast({
        title: "Error",
        description: "Please enter a nickname.",
        variant: "destructive",
        duration: 1000,
      });
      return;
    }

    // Check if this is a guru user
    const isGuruUser = await checkGuruUser(popupNickname, 'create');
    if (isGuruUser) {
      setPendingAction('create');
      setShowHostPopup(false);
      setShowGuruLogin(true);
      return;
    }

    // Regular user - clear any previous guru status and proceed normally
    localStorage.removeItem("isGuruUser");
    localStorage.removeItem("guruUserData");
    
    // Normal mode - use nickname
    createRoomMutation.mutate({ hostNickname: popupNickname });
  };

  const handleJoinRoom = async () => {
    if (!roomCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a room code.",
        variant: "destructive",
        duration: 1000,
      });
      return;
    }
    
    if (roomCode.length !== 5) {
      toast({
        title: "Error", 
        description: "Room code must be exactly 5 digits.",
        variant: "destructive",
        duration: 1000,
      });
      return;
    }
    
    const existingNickname = localStorage.getItem("playerNickname");
    if (existingNickname) {
      // Check if saved nickname is a guru user
      const isGuruUser = await checkGuruUser(existingNickname, 'join');
      if (!isGuruUser) {
        // Regular user - clear any previous guru status
        localStorage.removeItem("isGuruUser");
        localStorage.removeItem("guruUserData");
      }
      
      // Auto-join with saved nickname (works for both regular and guru users)
      console.log("Auto-joining with saved nickname:", existingNickname);
      setQrDetectedCode(roomCode);
      setPopupNickname(existingNickname);
      joinRoomMutation.mutate({ code: roomCode, nickname: existingNickname });
      return;
    }
    
    // First time user - show nickname popup
    setQrDetectedCode(roomCode);
    setShowNicknamePopup(true);
  };

  const handleDirectJoin = async () => {
    if (!popupNickname.trim()) {
      toast({
        title: "Error",
        description: "Please enter a nickname.",
        variant: "destructive",
        duration: 1000,
      });
      return;
    }

    // Check if this is a guru user
    const isGuruUser = await checkGuruUser(popupNickname, 'join');
    if (isGuruUser) {
      setPendingAction('join');
      setShowNicknamePopup(false);
      setShowGuruLogin(true);
      return;
    }

    // Regular user - clear any previous guru status and proceed normally
    localStorage.removeItem("isGuruUser");
    localStorage.removeItem("guruUserData");
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
            <Link href="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4 transition-colors">
              <ArrowLeft size={20} />
              Back to Games
            </Link>
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
        if (!open) {
          setPopupNickname("");
          setSelectedAvatar('male');
        }
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
            
            {/* Avatar Selection */}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-3 block">
                Choose Your Avatar
              </Label>
              <div className="flex justify-center space-x-4">
                <button
                  type="button"
                  onClick={() => setSelectedAvatar('male')}
                  className={`w-16 h-16 rounded-full border-4 transition-all flex items-center justify-center text-2xl hover:scale-105 ${
                    selectedAvatar === 'male' 
                      ? 'border-blue-500 bg-blue-50 shadow-lg' 
                      : 'border-gray-300 bg-white hover:border-gray-400'
                  }`}
                >
                  👨
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAvatar('female')}
                  className={`w-16 h-16 rounded-full border-4 transition-all flex items-center justify-center text-2xl hover:scale-105 ${
                    selectedAvatar === 'female' 
                      ? 'border-pink-500 bg-pink-50 shadow-lg' 
                      : 'border-gray-300 bg-white hover:border-gray-400'
                  }`}
                >
                  👩
                </button>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={() => {
                  setShowNicknamePopup(false);
                  setPopupNickname("");
                  setSelectedAvatar('male');
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
        if (!open) {
          setPopupNickname("");
          setSelectedAvatar('male');
          setIsViewerMode(false);
          setSelectedModeTab('normal');
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center font-fredoka text-2xl bg-gradient-to-r from-uno-red to-uno-yellow bg-clip-text text-transparent">
              Create New Room
            </DialogTitle>
          </DialogHeader>
          
          {/* GURU USER: Show Mode Tabs */}
          {isGuruUserLoggedIn && (
            <Tabs value={selectedModeTab} onValueChange={(v) => setSelectedModeTab(v as 'normal' | 'viewer')} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="normal" className="flex items-center gap-2">
                  <Radio className="h-4 w-4" />
                  Normal
                </TabsTrigger>
                <TabsTrigger value="viewer" className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Viewer
                </TabsTrigger>
              </TabsList>
              
              {selectedModeTab === 'viewer' && (
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-4 text-sm text-teal-700">
                  <p className="font-medium mb-1">Viewer Mode Active</p>
                  <p className="text-xs">Same as Normal Mode but uses separate routes for development/testing purposes.</p>
                </div>
              )}
            </Tabs>
          )}
          
          <div className="space-y-4 pt-2">
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
            
            {/* Avatar Selection */}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-3 block">
                Choose Your Avatar
              </Label>
              <div className="flex justify-center space-x-4">
                <button
                  type="button"
                  onClick={() => setSelectedAvatar('male')}
                  className={`w-16 h-16 rounded-full border-4 transition-all flex items-center justify-center text-2xl hover:scale-105 ${
                    selectedAvatar === 'male' 
                      ? 'border-blue-500 bg-blue-50 shadow-lg' 
                      : 'border-gray-300 bg-white hover:border-gray-400'
                  }`}
                >
                  👨
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAvatar('female')}
                  className={`w-16 h-16 rounded-full border-4 transition-all flex items-center justify-center text-2xl hover:scale-105 ${
                    selectedAvatar === 'female' 
                      ? 'border-pink-500 bg-pink-50 shadow-lg' 
                      : 'border-gray-300 bg-white hover:border-gray-400'
                  }`}
                >
                  👩
                </button>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <Button
                onClick={() => {
                  setShowHostPopup(false);
                  setPopupNickname("");
                  setSelectedAvatar('male');
                  setIsViewerMode(false);
                  setSelectedModeTab('normal');
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
            
            {/* NORMAL USER: Advanced option - subtle, at the bottom */}
            {!isGuruUserLoggedIn && (
              <div className="flex items-center justify-center gap-1.5 pt-2 opacity-50 hover:opacity-80 transition-opacity">
                <Checkbox 
                  id="viewer-mode" 
                  checked={isViewerMode}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setShowViewerConfirm(true);
                    } else {
                      setIsViewerMode(false);
                    }
                  }}
                  className="h-3 w-3"
                />
                <Label 
                  htmlFor="viewer-mode" 
                  className="text-[10px] text-gray-400 cursor-pointer flex items-center gap-1"
                >
                  <Eye className="h-2.5 w-2.5" />
                  Advanced (Viewer Mode)
                </Label>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Viewer Mode Confirmation Dialog */}
      <Dialog open={showViewerConfirm} onOpenChange={setShowViewerConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-semibold text-teal-700">
              Enable Viewer Mode?
            </DialogTitle>
            <DialogDescription className="text-center text-sm text-gray-600 pt-2">
              Viewer Mode uses separate routes for testing purposes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 text-sm text-teal-800">
              <p className="font-medium mb-2">What happens in Viewer Mode:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Works exactly like Normal Mode</li>
                <li>Uses separate routes (/vmode/...)</li>
                <li>Useful for development and testing</li>
                <li>Does not affect Normal Mode rooms</li>
              </ul>
            </div>
            <p className="text-xs text-gray-500 text-center">
              If you are not sure how this feature works, please click Cancel.
            </p>
            <div className="flex space-x-2">
              <Button
                onClick={() => {
                  setShowViewerConfirm(false);
                  setIsViewerMode(false);
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setShowViewerConfirm(false);
                  setShowHostPopup(false);
                  // Create viewer mode room immediately - no nickname needed, first joiner becomes host
                  createRoomMutation.mutate({ viewerMode: true });
                }}
                className="flex-1 bg-teal-600 hover:bg-teal-700"
              >
                <Eye className="mr-2 h-4 w-4" />
                Enable Viewer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Guru User Login Dialog */}
      <Dialog open={showGuruLogin} onOpenChange={(open) => {
        if (!open) {
          setShowGuruLogin(false);
          setGuruPassword("");
          setGuruLoginError("");
          setPendingAction(null);
          // Reopen the previous dialog
          if (pendingAction === 'create') {
            setShowHostPopup(true);
          } else if (pendingAction === 'join') {
            setShowNicknamePopup(true);
          }
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center font-fredoka text-2xl bg-gradient-to-r from-uno-blue to-uno-green bg-clip-text text-transparent">
              User Authentication
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="text-center mb-4">
              <p className="text-sm text-gray-600">
                Authentication required for "{popupNickname}".
              </p>
              <p className="text-xs text-gray-500">
                Please enter your password to continue.
              </p>
            </div>
            
            {guruLoginError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <p className="text-red-600 text-sm">{guruLoginError}</p>
              </div>
            )}

            <div>
              <Label htmlFor="guru-password" className="text-sm font-medium text-gray-700 mb-2">
                Password
              </Label>
              <Input
                id="guru-password"
                type="password"
                placeholder="Enter your password..."
                value={guruPassword}
                onChange={(e) => {
                  setGuruPassword(e.target.value);
                  setGuruLoginError(""); // Clear error on input
                }}
                className="text-center font-medium"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleGuruAuthentication();
                  }
                }}
                autoFocus
              />
            </div>
            
            <div className="flex space-x-2">
              <Button
                onClick={() => {
                  setShowGuruLogin(false);
                  setGuruPassword("");
                  setGuruLoginError("");
                  // Reopen the previous dialog
                  if (pendingAction === 'create') {
                    setShowHostPopup(true);
                  } else if (pendingAction === 'join') {
                    setShowNicknamePopup(true);
                  }
                  setPendingAction(null);
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleGuruAuthentication}
                disabled={!guruPassword.trim()}
                className="flex-1 bg-gradient-to-r from-uno-blue to-uno-green hover:scale-105 transition-all"
              >
                Authenticate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
