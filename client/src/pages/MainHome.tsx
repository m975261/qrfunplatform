import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Play, Users, Bot, LogIn, Upload } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import QrScanner from 'qr-scanner';

export default function MainHome() {
  const [, setLocation] = useLocation();
  const [showGameModeDialog, setShowGameModeDialog] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const { toast } = useToast();

  const handleQRImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const loadImage = () => new Promise<void>((resolve, reject) => {
          img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx?.drawImage(img, 0, 0);
            resolve();
          };
          img.onerror = reject;
        });
        
        img.src = URL.createObjectURL(file);
        await loadImage();
        
        const result = await QrScanner.scanImage(canvas);
        
        let extractedCode = '';
        if (result.includes('/r/')) {
          const match = result.match(/\/r\/([0-9]{5})/);
          extractedCode = match ? match[1] : '';
        } else if (result.includes('code=')) {
          const match = result.match(/code=([0-9]{5})/);
          extractedCode = match ? match[1] : '';
        } else if (result.includes('room=')) {
          const match = result.match(/room=([0-9]{5})/);
          extractedCode = match ? match[1] : '';
        } else if (/^[0-9]{5}$/.test(result)) {
          extractedCode = result;
        }
        
        if (extractedCode) {
          setLocation(`/uno?room=${extractedCode}`);
        } else {
          toast({
            title: "Invalid QR Code",
            description: "This QR code doesn't contain a valid room code.",
            variant: "destructive",
          });
        }
        
        URL.revokeObjectURL(img.src);
        
      } catch (error) {
        console.error('QR code scan error:', error);
        toast({
          title: "Scan Failed",
          description: "Could not read QR code from this image. Make sure it's clear and valid.",
          variant: "destructive",
        });
      }
    }
    event.target.value = '';
  };

  const handleJoinWithCode = async () => {
    const code = roomCode.trim();
    if (!code) {
      setJoinError("Please enter a room code");
      return;
    }
    
    setIsJoining(true);
    setJoinError("");
    
    try {
      const response = await fetch(`/api/rooms/code/${code}`);
      if (response.ok) {
        const data = await response.json();
        if (data.room) {
          setLocation(`/uno?room=${code}`);
        } else {
          setJoinError("Room not found");
        }
      } else {
        setJoinError("Room not found");
      }
    } catch (error) {
      setJoinError("Could not connect. Try again.");
    } finally {
      setIsJoining(false);
    }
  };

  // Handle shared room links - redirect to UNO page with room parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room') || urlParams.get('code');
    
    if (roomFromUrl) {
      // Redirect to UNO page with room parameters preserved
      console.log("Room link detected on main page, redirecting to UNO:", roomFromUrl);
      const currentSearch = window.location.search;
      setLocation(`/uno${currentSearch}`);
      return;
    }
  }, [setLocation]);

  const games = [
    {
      id: "uno",
      name: "UNO",
      path: "/uno",
      logo: "🎴",
      status: "available",
      description: "Classic multiplayer card game",
      rules: [
        "Match cards by color or number",
        "Use action cards: Skip, Reverse, Draw Two",
        "Wild cards change the color",
        "Draw Four cards force next player to draw 4",
        "Say 'UNO' when you have one card left",
        "First player to empty their hand wins"
      ],
      players: "2-4 players",
      features: ["Real-time multiplayer", "Room codes & QR sharing", "Spectator mode", "Ranking system"]
    },
    {
      id: "xo",
      name: "XO",
      path: "/xo",
      logo: "⭕",
      status: "coming-soon",
      description: "Strategic Tic Tac Toe game",
      rules: [
        "Get three in a row to win",
        "Play on a 3x3 grid",
        "Take turns placing X or O",
        "Block your opponent's winning moves",
        "First to get three in a line wins",
        "Game ends in draw if grid fills without winner"
      ],
      players: "2 players",
      features: ["Real-time multiplayer", "Smart AI opponent", "Tournament mode", "Statistics tracking"]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900 dark:to-pink-900">
      {/* Header */}
      <header className="relative overflow-hidden bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
              QRFun Games
            </h1>
          </div>
          <div className="text-center">
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-2">
              Multiplayer games with instant QR code sharing
            </p>
            <p className="text-gray-500 dark:text-gray-400">
              Create rooms, share QR codes, and play with friends instantly
            </p>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-blue-200 dark:bg-blue-800 rounded-full opacity-20"></div>
          <div className="absolute top-1/2 -left-8 w-32 h-32 bg-purple-200 dark:bg-purple-800 rounded-full opacity-20"></div>
          <div className="absolute -bottom-4 right-1/3 w-20 h-20 bg-pink-200 dark:bg-pink-800 rounded-full opacity-20"></div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {/* Join with Room Code - Prominent section for visitors */}
        <div className="max-w-md mx-auto mb-12">
          <Card className="bg-gradient-to-r from-green-500 to-emerald-600 border-0 shadow-xl overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <LogIn className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Join with Room Code</h2>
                  <p className="text-white/80 text-sm">Enter the code shared with you</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Enter room code (e.g. 12345)"
                  value={roomCode}
                  onChange={(e) => {
                    setRoomCode(e.target.value.toUpperCase());
                    setJoinError("");
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinWithCode()}
                  className="bg-white/95 border-0 text-gray-800 placeholder:text-gray-500 font-mono text-lg tracking-wider"
                  maxLength={10}
                  data-testid="input-room-code"
                />
                <Button
                  onClick={handleJoinWithCode}
                  disabled={isJoining || !roomCode.trim()}
                  className="bg-white text-green-600 hover:bg-gray-100 font-semibold px-6 shadow-lg"
                  data-testid="button-join-room"
                >
                  {isJoining ? "Joining..." : "Join"}
                </Button>
              </div>
              
              {joinError && (
                <p className="text-white/90 text-sm mt-2 bg-red-500/30 px-3 py-1 rounded-lg">
                  {joinError}
                </p>
              )}
            </div>
          </Card>

          {/* Join with QR Image */}
          <Label className="mt-4 w-full flex items-center justify-center bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white py-4 px-6 rounded-xl font-semibold cursor-pointer transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] gap-3"
            data-testid="button-join-qr-image"
          >
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="text-lg">Join with QR Image</div>
              <div className="text-white/80 text-sm font-normal">Upload a QR code to join instantly</div>
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleQRImageUpload}
              className="hidden"
            />
          </Label>
        </div>

        {/* Games Grid - Centered */}
        <div className="flex flex-wrap justify-center gap-6 lg:gap-8 mb-16 max-w-5xl mx-auto">
          {games.map((game) => (
            <Card key={game.id} className="relative group hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-0 shadow-lg flex flex-col w-full sm:w-96">
              <div className="p-6 lg:p-8 flex-1 flex flex-col">
                {/* Game Header */}
                <div className="mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-4">
                    <div className="text-5xl lg:text-6xl">{game.logo}</div>
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                        <h3 className="text-xl lg:text-2xl font-bold text-gray-800 dark:text-white">
                          {game.name}
                        </h3>
                        {game.status === "available" && game.id === "uno" && (
                          <Button 
                            size="sm" 
                            onClick={() => setShowGameModeDialog(true)}
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 px-3 py-2 text-sm w-fit"
                          >
                            <Play className="w-3 h-3 mr-1" />
                            Play Now
                          </Button>
                        )}
                        {game.status === "available" && game.id !== "uno" && (
                          <Link href={game.path}>
                            <Button size="sm" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 px-3 py-2 text-sm w-fit">
                              <Play className="w-3 h-3 mr-1" />
                              Play Now
                            </Button>
                          </Link>
                        )}
                      </div>
                      <p className="text-gray-600 dark:text-gray-300 text-sm lg:text-base">
                        {game.description}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <Badge 
                      variant={game.status === "available" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {game.status === "available" ? "Available" : "Coming Soon"}
                    </Badge>
                    <p className="text-xs lg:text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {game.players}
                    </p>
                  </div>
                </div>

                {/* Game Rules */}
                <div className="mb-4 lg:mb-6 flex-1">
                  <h4 className="font-semibold text-gray-800 dark:text-white mb-2 lg:mb-3 text-sm lg:text-base">
                    Game Rules
                  </h4>
                  <ul className="space-y-1 text-xs lg:text-sm text-gray-600 dark:text-gray-300">
                    {game.rules.slice(0, 3).map((rule, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-blue-500 mt-1 lg:mt-1.5 w-1 h-1 lg:w-1.5 lg:h-1.5 rounded-full bg-current flex-shrink-0"></span>
                        {rule}
                      </li>
                    ))}
                    {game.rules.length > 3 && (
                      <li className="text-gray-400 dark:text-gray-500 text-xs">
                        +{game.rules.length - 3} more rules...
                      </li>
                    )}
                  </ul>
                </div>

                {/* Features */}
                <div className="mt-auto">
                  <h4 className="font-semibold text-gray-800 dark:text-white mb-2 text-sm lg:text-base">
                    Features
                  </h4>
                  <div className="flex flex-wrap gap-1 lg:gap-2">
                    {game.features.slice(0, 4).map((feature, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                    {game.features.length > 4 && (
                      <Badge variant="outline" className="text-xs text-gray-400">
                        +{game.features.length - 4}
                      </Badge>
                    )}
                  </div>
                </div>


              </div>

              {/* Hover Effect Gradient */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-purple-600/5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
            </Card>
          ))}
        </div>

        {/* About Section */}
        <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-0 shadow-lg">
          <div className="p-8 text-center">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">
              Why QRFun Games?
            </h2>
            <div className="grid md:grid-cols-3 gap-8 mt-8">
              <div className="space-y-2">
                <div className="text-3xl">📱</div>
                <h3 className="font-semibold text-gray-800 dark:text-white">
                  Instant Sharing
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Share game rooms instantly with QR codes - no complex setup required
                </p>
              </div>
              <div className="space-y-2">
                <div className="text-3xl">🌐</div>
                <h3 className="font-semibold text-gray-800 dark:text-white">
                  Cross-Platform
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Play on any device - mobile, tablet, or desktop with the same experience
                </p>
              </div>
              <div className="space-y-2">
                <div className="text-3xl">⚡</div>
                <h3 className="font-semibold text-gray-800 dark:text-white">
                  Real-Time
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Lightning-fast multiplayer with live synchronization across all players
                </p>
              </div>
            </div>
          </div>
        </Card>
      </main>

      {/* Footer */}
      <footer className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-600 dark:text-gray-300">
            QRFun Games - Bringing people together through instant multiplayer gaming
          </p>
        </div>
      </footer>

      {/* UNO Game Mode Selection Dialog */}
      <Dialog open={showGameModeDialog} onOpenChange={setShowGameModeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center font-fredoka text-2xl bg-gradient-to-r from-uno-red to-uno-yellow bg-clip-text text-transparent">
              Choose Game Mode
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Button
              onClick={() => {
                setShowGameModeDialog(false);
                setLocation("/uno");
              }}
              className="w-full h-20 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-medium text-lg shadow-lg hover:shadow-xl transition-all"
              data-testid="button-play-with-friends"
            >
              <Users className="w-6 h-6 mr-3" />
              Play with Friends
            </Button>
            <Button
              onClick={() => {
                setShowGameModeDialog(false);
                setLocation("/uno/bot");
              }}
              className="w-full h-20 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-medium text-lg shadow-lg hover:shadow-xl transition-all"
              data-testid="button-play-with-bot"
            >
              <Bot className="w-6 h-6 mr-3" />
              Play with Bot
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}