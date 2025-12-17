import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ArrowLeft, Bot, Users } from "lucide-react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function XOHome() {
  const [, setLocation] = useLocation();
  const [roomCode, setRoomCode] = useState("");
  const [showNicknamePopup, setShowNicknamePopup] = useState(false);
  const [showHostPopup, setShowHostPopup] = useState(false);
  const [popupNickname, setPopupNickname] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<'male' | 'female'>('male');
  const [gameMode, setGameMode] = useState<'multiplayer' | 'bot'>('multiplayer');
  const [botDifficulty, setBotDifficulty] = useState<'easy' | 'medium' | 'hard' | 'hardest'>('medium');
  const [pendingCode, setPendingCode] = useState("");

  const { toast } = useToast();

  useEffect(() => {
    const savedAvatar = localStorage.getItem("xo_avatar");
    if (savedAvatar === "male" || savedAvatar === "female") {
      setSelectedAvatar(savedAvatar);
    }
    const savedNickname = localStorage.getItem("xo_nickname");
    if (savedNickname) {
      setPopupNickname(savedNickname);
    }
  }, []);

  const createRoomMutation = useMutation({
    mutationFn: async ({ hostNickname, isBotGame, difficulty }: { hostNickname: string; isBotGame: boolean; difficulty?: string }) => {
      const response = await apiRequest("POST", "/api/xo/rooms", { 
        hostNickname,
        isBotGame,
        difficulty: difficulty || 'medium'
      });
      return response.json();
    },
    onSuccess: (data) => {
      localStorage.setItem("xo_playerId", data.player.id);
      localStorage.setItem("xo_nickname", popupNickname);
      localStorage.setItem("xo_roomId", data.room.id);
      localStorage.setItem("xo_avatar", selectedAvatar);
      setShowHostPopup(false);
      
      if (data.room.xoSettings?.isBotGame) {
        setLocation(`/xo/game/${data.room.id}`);
      } else {
        setLocation(`/xo/room/${data.room.id}?code=${data.room.code}`);
      }
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
      const response = await apiRequest("POST", `/api/xo/rooms/${code}/join`, { nickname });
      return response.json();
    },
    onSuccess: (data) => {
      localStorage.setItem("xo_playerId", data.player.id);
      localStorage.setItem("xo_nickname", data.player.nickname);
      localStorage.setItem("xo_roomId", data.room.id);
      localStorage.setItem("xo_avatar", selectedAvatar);
      setShowNicknamePopup(false);
      setLocation(`/xo/room/${data.room.id}?code=${data.room.code}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to join room.",
        variant: "destructive",
      });
    },
  });

  const handleCreateRoom = () => {
    setShowHostPopup(true);
  };

  const handleJoinRoom = () => {
    if (roomCode.length < 5) {
      toast({
        title: "Invalid Code",
        description: "Please enter a valid 5-digit room code.",
        variant: "destructive",
      });
      return;
    }
    setPendingCode(roomCode);
    setShowNicknamePopup(true);
  };

  const handleConfirmCreate = () => {
    if (!popupNickname.trim()) {
      toast({
        title: "Nickname Required",
        description: "Please enter a nickname.",
        variant: "destructive",
      });
      return;
    }
    createRoomMutation.mutate({ 
      hostNickname: popupNickname.trim(), 
      isBotGame: gameMode === 'bot',
      difficulty: botDifficulty
    });
  };

  const handleConfirmJoin = () => {
    if (!popupNickname.trim()) {
      toast({
        title: "Nickname Required",
        description: "Please enter a nickname.",
        variant: "destructive",
      });
      return;
    }
    joinRoomMutation.mutate({ code: pendingCode, nickname: popupNickname.trim() });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-indigo-900 dark:to-purple-900 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-0 shadow-xl">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white mb-4 transition-colors">
            <ArrowLeft size={20} />
            Back to Games
          </Link>
          <div className="text-6xl mb-4">⭕❌</div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2" data-testid="title-xo">
            XO Game
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Classic Tic-Tac-Toe with Dynamic Boards!
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <Button
              onClick={handleCreateRoom}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-6 text-lg rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
              data-testid="button-create-room"
            >
              <Plus size={24} />
              Create New Game
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-300 dark:border-gray-600" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white dark:bg-gray-800 px-4 text-gray-500 dark:text-gray-400">
                or join existing
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="roomCode" className="text-gray-700 dark:text-gray-200">
              Room Code
            </Label>
            <div className="flex gap-2">
              <Input
                id="roomCode"
                type="text"
                placeholder="Enter 5-digit code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                className="text-center text-lg font-mono tracking-widest"
                data-testid="input-room-code"
              />
              <Button
                onClick={handleJoinRoom}
                disabled={roomCode.length < 5}
                className="px-6 bg-indigo-600 hover:bg-indigo-700"
                data-testid="button-join-room"
              >
                Join
              </Button>
            </div>
          </div>

          <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
            <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">How to Play</h3>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• Start on 3×3 board (win 3 in a row)</li>
              <li>• Winner advances: 4×4, 5×5, 6×6 boards!</li>
              <li>• Play vs friends or challenge the AI</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Create Room Dialog */}
      <Dialog open={showHostPopup} onOpenChange={setShowHostPopup}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create XO Game</DialogTitle>
            <DialogDescription>
              Enter your nickname and choose game mode
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="hostNickname">Nickname</Label>
              <Input
                id="hostNickname"
                value={popupNickname}
                onChange={(e) => setPopupNickname(e.target.value.slice(0, 15))}
                placeholder="Enter nickname"
                className="mt-1"
                data-testid="input-host-nickname"
              />
            </div>

            <div className="space-y-2">
              <Label>Avatar</Label>
              <div className="flex gap-4 justify-center">
                <button
                  type="button"
                  onClick={() => setSelectedAvatar('male')}
                  className={`text-4xl p-2 rounded-xl transition-all ${selectedAvatar === 'male' ? 'bg-blue-100 dark:bg-blue-900 ring-2 ring-blue-500' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                  data-testid="button-avatar-male"
                >
                  👨
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAvatar('female')}
                  className={`text-4xl p-2 rounded-xl transition-all ${selectedAvatar === 'female' ? 'bg-pink-100 dark:bg-pink-900 ring-2 ring-pink-500' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                  data-testid="button-avatar-female"
                >
                  👩
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Game Mode</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={gameMode === 'multiplayer' ? 'default' : 'outline'}
                  onClick={() => setGameMode('multiplayer')}
                  className="flex items-center gap-2"
                  data-testid="button-mode-multiplayer"
                >
                  <Users size={18} />
                  Multiplayer
                </Button>
                <Button
                  type="button"
                  variant={gameMode === 'bot' ? 'default' : 'outline'}
                  onClick={() => setGameMode('bot')}
                  className="flex items-center gap-2"
                  data-testid="button-mode-bot"
                >
                  <Bot size={18} />
                  vs Bot
                </Button>
              </div>
            </div>

            {gameMode === 'bot' && (
              <div className="space-y-2">
                <Label>Bot Difficulty</Label>
                <Select value={botDifficulty} onValueChange={(v) => setBotDifficulty(v as any)}>
                  <SelectTrigger data-testid="select-difficulty">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                    <SelectItem value="hardest">Hardest (Perfect)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              onClick={handleConfirmCreate}
              disabled={createRoomMutation.isPending || !popupNickname.trim()}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              data-testid="button-confirm-create"
            >
              {createRoomMutation.isPending ? "Creating..." : "Start Game"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Join Room Dialog */}
      <Dialog open={showNicknamePopup} onOpenChange={setShowNicknamePopup}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Join Game</DialogTitle>
            <DialogDescription>
              Enter your nickname to join room {pendingCode}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="joinNickname">Nickname</Label>
              <Input
                id="joinNickname"
                value={popupNickname}
                onChange={(e) => setPopupNickname(e.target.value.slice(0, 15))}
                placeholder="Enter nickname"
                className="mt-1"
                data-testid="input-join-nickname"
              />
            </div>

            <div className="space-y-2">
              <Label>Avatar</Label>
              <div className="flex gap-4 justify-center">
                <button
                  type="button"
                  onClick={() => setSelectedAvatar('male')}
                  className={`text-4xl p-2 rounded-xl transition-all ${selectedAvatar === 'male' ? 'bg-blue-100 dark:bg-blue-900 ring-2 ring-blue-500' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                >
                  👨
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAvatar('female')}
                  className={`text-4xl p-2 rounded-xl transition-all ${selectedAvatar === 'female' ? 'bg-pink-100 dark:bg-pink-900 ring-2 ring-pink-500' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                >
                  👩
                </button>
              </div>
            </div>

            <Button
              onClick={handleConfirmJoin}
              disabled={joinRoomMutation.isPending || !popupNickname.trim()}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              data-testid="button-confirm-join"
            >
              {joinRoomMutation.isPending ? "Joining..." : "Join Game"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
