import { useEffect, useState, useRef } from "react";
import { useRoute } from "wouter";
import { Card as UICard, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Menu, ArrowRight, ArrowLeft, Users, MessageCircle, X, Pencil } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { useToast } from "@/hooks/use-toast";
import PlayerArea from "@/components/game/PlayerArea";
import GameCard from "@/components/game/Card";
import ChatPanel from "@/components/game/ChatPanel";
import GameEndModal from "@/components/game/GameEndModal";
import ColorPickerModal from "@/components/game/ColorPickerModal";

export default function Game() {
  const [, params] = useRoute("/game/:roomId");
  const roomId = params?.roomId;
  const playerId = localStorage.getItem("playerId");
  const { toast } = useToast();
  
  const {
    gameState,
    floatingEmojis,
    joinRoom,
    playCard,
    drawCard,
    callUno,
    chooseColor,
    sendChatMessage,
    sendEmoji,
    exitGame,
    kickPlayer,
    continueGame,
    replacePlayer,
    playAgain,
    isConnected
  } = useSocket();

  const [showChat, setShowChat] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showGameEnd, setShowGameEnd] = useState(false);
  const [gameEndData, setGameEndData] = useState<any>(null);
  const [pendingWildCard, setPendingWildCard] = useState<number | null>(null);
  const [timer, setTimer] = useState(30);
  const [hasCalledUno, setHasCalledUno] = useState(false);
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);
  const [unoMessage, setUnoMessage] = useState<string | null>(null);
  const [oneCardMessage, setOneCardMessage] = useState<string | null>(null);
  const [turnFinishedMessage, setTurnFinishedMessage] = useState<string | null>(null);
  const [cardAnimation, setCardAnimation] = useState<{
    card: any;
    from: 'player' | 'opponent' | 'deck';
    to: 'discard' | 'player';
    show: boolean;
  } | null>(null);
  
  // Viewer panel state (hidden by default)
  const [showViewers, setShowViewers] = useState(false);
  const [viewerPanelPosition, setViewerPanelPosition] = useState({ x: -1, y: -1 });
  const [viewerPanelSize, setViewerPanelSize] = useState({ width: 210, height: 280 });
  const [isDraggingViewerPanel, setIsDraggingViewerPanel] = useState(false);
  const [isResizingViewerPanel, setIsResizingViewerPanel] = useState(false);
  const [viewerPanelDragStart, setViewerPanelDragStart] = useState({ x: 0, y: 0, panelX: 0, panelY: 0 });
  const [viewerPanelResizeStart, setViewerPanelResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const viewerPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (roomId && playerId && isConnected) {
      joinRoom(playerId, roomId);
    }
  }, [roomId, playerId, isConnected, joinRoom]);

  // Handle UNO message animation
  useEffect(() => {
    if (gameState?.unoMessage) {
      setUnoMessage(gameState.unoMessage);
      // Clear local message after animation
      setTimeout(() => {
        setUnoMessage(null);
      }, 3000);
    }
  }, [gameState?.unoMessage]);

  // Handle "1 card left" message
  useEffect(() => {
    if (gameState?.oneCardMessage) {
      setOneCardMessage(gameState.oneCardMessage);
      setTimeout(() => {
        setOneCardMessage(null);
      }, 2500);
    }
  }, [gameState?.oneCardMessageTimestamp]);

  // Handle "turn finished" message
  useEffect(() => {
    if (gameState?.turnFinishedMessage) {
      setTurnFinishedMessage(gameState.turnFinishedMessage);
      setTimeout(() => {
        setTurnFinishedMessage(null);
      }, 1500);
    }
  }, [gameState?.turnFinishedTimestamp]);



  useEffect(() => {
    if (gameState?.room?.status === "finished") {
      setShowGameEnd(true);
    }
    
    if (gameState?.gameEndData) {
      setGameEndData(gameState.gameEndData);
      setShowGameEnd(true);
    }
    
    if (gameState?.needsContinue) {
      setShowContinuePrompt(true);
    }
  }, [gameState?.room?.status, gameState?.gameEndData, gameState?.needsContinue]);

  // Handle server color choice request to prevent double triggers
  useEffect(() => {
    if (gameState?.colorChoiceRequested || gameState?.showColorPicker) {
      setShowColorPicker(true);
    }
  }, [gameState?.colorChoiceRequested, gameState?.showColorPicker]);

  const handlePlayCard = (cardIndex: number) => {
    const player = gameState?.players?.find((p: any) => p.id === playerId);
    const card = player?.hand?.[cardIndex];
    
    // Show card animation
    if (card) {
      setCardAnimation({
        card: { ...card },
        from: 'player',
        to: 'discard',
        show: true
      });
      setTimeout(() => setCardAnimation(null), 400);
    }
    
    if (card?.type === "wild" || card?.type === "wild4") {
      // For wild cards, play immediately and let server request color choice
      // This prevents double color picker trigger
      playCard(cardIndex);
    } else {
      playCard(cardIndex);
    }
  };

  const handleColorChoice = (color: string) => {
    chooseColor(color);
    // Clear local color picker state to prevent double trigger
    setShowColorPicker(false);
  };

  const handleUnoCall = () => {
    const player = gameState?.players?.find((p: any) => p.id === playerId);
    if (!player?.hasCalledUno) {
      callUno();
      setHasCalledUno(true);
      // UNO call will be validated on the server and work only when playing second-to-last card
    }
  };

  // Helper function for responsive card sizes
  const getCardSize = () => {
    return "md"; // Default medium size for Game.tsx
  };

  // Viewer panel drag handlers
  const handleViewerPanelDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = viewerPanelRef.current?.getBoundingClientRect();
    if (!rect) return;
    setIsDraggingViewerPanel(true);
    setViewerPanelDragStart({ 
      x: e.clientX, 
      y: e.clientY, 
      panelX: viewerPanelPosition.x === -1 ? rect.left : viewerPanelPosition.x,
      panelY: viewerPanelPosition.y === -1 ? rect.top : viewerPanelPosition.y
    });
  };

  const handleViewerPanelTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const rect = viewerPanelRef.current?.getBoundingClientRect();
    if (!rect) return;
    setIsDraggingViewerPanel(true);
    setViewerPanelDragStart({ 
      x: touch.clientX, 
      y: touch.clientY, 
      panelX: viewerPanelPosition.x === -1 ? rect.left : viewerPanelPosition.x,
      panelY: viewerPanelPosition.y === -1 ? rect.top : viewerPanelPosition.y
    });
  };

  const handleViewerPanelResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingViewerPanel(true);
    setViewerPanelResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: viewerPanelSize.width,
      height: viewerPanelSize.height
    });
  };

  const handleViewerPanelResizeTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    e.stopPropagation();
    const touch = e.touches[0];
    setIsResizingViewerPanel(true);
    setViewerPanelResizeStart({
      x: touch.clientX,
      y: touch.clientY,
      width: viewerPanelSize.width,
      height: viewerPanelSize.height
    });
  };

  // Viewer panel drag/resize effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingViewerPanel) {
        const newX = viewerPanelDragStart.panelX + (e.clientX - viewerPanelDragStart.x);
        const newY = viewerPanelDragStart.panelY + (e.clientY - viewerPanelDragStart.y);
        setViewerPanelPosition({ x: newX, y: newY });
      }
      if (isResizingViewerPanel) {
        const newWidth = Math.max(160, viewerPanelResizeStart.width + (e.clientX - viewerPanelResizeStart.x));
        const newHeight = Math.max(120, viewerPanelResizeStart.height + (e.clientY - viewerPanelResizeStart.y));
        setViewerPanelSize({ width: newWidth, height: newHeight });
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (isDraggingViewerPanel) {
        const newX = viewerPanelDragStart.panelX + (touch.clientX - viewerPanelDragStart.x);
        const newY = viewerPanelDragStart.panelY + (touch.clientY - viewerPanelDragStart.y);
        setViewerPanelPosition({ x: newX, y: newY });
      }
      if (isResizingViewerPanel) {
        const newWidth = Math.max(160, viewerPanelResizeStart.width + (touch.clientX - viewerPanelResizeStart.x));
        const newHeight = Math.max(120, viewerPanelResizeStart.height + (touch.clientY - viewerPanelResizeStart.y));
        setViewerPanelSize({ width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      setIsDraggingViewerPanel(false);
      setIsResizingViewerPanel(false);
    };

    const handleTouchEnd = () => {
      setIsDraggingViewerPanel(false);
      setIsResizingViewerPanel(false);
    };

    if (isDraggingViewerPanel || isResizingViewerPanel) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDraggingViewerPanel, isResizingViewerPanel, viewerPanelDragStart, viewerPanelResizeStart]);

  const handlePlayCardWithUnoCheck = (cardIndex: number) => {
    const player = gameState?.players?.find((p: any) => p.id === playerId);
    
    // UNO penalty is now handled server-side when playing cards
    // Normal card play
    handlePlayCard(cardIndex);
  };

  if (!gameState || !gameState.room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-uno-blue via-uno-purple to-uno-red flex items-center justify-center">
        <div className="text-white text-xl">Loading game...</div>
      </div>
    );
  }

  const room = gameState.room;
  const players = gameState.players || [];
  const gamePlayers = players.filter((p: any) => !p.isSpectator).sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
  const spectators = players.filter((p: any) => p.isSpectator && p.isOnline);
  const currentPlayer = players.find((p: any) => p.id === playerId);
  const currentGamePlayer = gamePlayers[room.currentPlayerIndex || 0];
  const isMyTurn = currentGamePlayer?.id === playerId;
  const topCard = room.discardPile?.[0];

  // Timer countdown - only for current player's turn
  useEffect(() => {
    if (gameState?.room?.status === "playing" && isMyTurn) {
      const interval = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            // Timer expired - no auto-play, host can kick player if needed
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(interval);
    } else if (!isMyTurn) {
      setTimer(30); // Reset timer when it's not your turn
    }
  }, [gameState?.room?.status, isMyTurn, drawCard]);

  // Arrange players for display (current player at bottom)
  const getPlayersArranged = () => {
    const currentPlayerIndex = gamePlayers.findIndex((p: any) => p.id === playerId);
    if (currentPlayerIndex === -1) return gamePlayers;
    
    const arranged = [...gamePlayers];
    const currentPlayerData = arranged.splice(currentPlayerIndex, 1)[0];
    arranged.push(currentPlayerData);
    
    return arranged;
  };

  const arrangedPlayers = getPlayersArranged();

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-red-500 to-red-600 relative overflow-hidden">
      {/* Card Animation Overlay */}
      {cardAnimation?.show && (
        <div className="fixed inset-0 pointer-events-none z-[60] flex items-center justify-center">
          <div 
            className={`transition-all duration-300 ease-out ${
              cardAnimation.from === 'player' && cardAnimation.to === 'discard'
                ? 'animate-card-play-up'
                : cardAnimation.from === 'opponent' && cardAnimation.to === 'discard'
                ? 'animate-card-play-down'
                : cardAnimation.from === 'deck' && cardAnimation.to === 'player'
                ? 'animate-card-draw-player'
                : ''
            }`}
          >
            {cardAnimation.from === 'deck' ? (
              <div className="w-16 h-24 bg-gradient-to-br from-red-600 via-red-500 to-red-700 rounded-xl border-3 border-red-800 shadow-2xl flex items-center justify-center">
                <span className="text-white font-bold text-sm transform -rotate-12">UNO</span>
              </div>
            ) : (
              <div className="transform scale-125">
                <GameCard card={cardAnimation.card} size="large" />
              </div>
            )}
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes cardPlayUp {
          0% { transform: translateY(200px) scale(0.8); opacity: 0.5; }
          50% { transform: translateY(0) scale(1.1); opacity: 1; }
          100% { transform: translateY(-50px) scale(1); opacity: 0; }
        }
        @keyframes cardPlayDown {
          0% { transform: translateY(-200px) scale(0.8); opacity: 0.5; }
          50% { transform: translateY(0) scale(1.1); opacity: 1; }
          100% { transform: translateY(50px) scale(1); opacity: 0; }
        }
        @keyframes cardDrawPlayer {
          0% { transform: translateY(-100px) translateX(-100px) scale(0.8); opacity: 0.5; }
          50% { transform: translateY(50px) translateX(0) scale(1.1); opacity: 1; }
          100% { transform: translateY(200px) scale(0.9); opacity: 0; }
        }
        .animate-card-play-up { animation: cardPlayUp 0.4s ease-out forwards; }
        .animate-card-play-down { animation: cardPlayDown 0.4s ease-out forwards; }
        .animate-card-draw-player { animation: cardDrawPlayer 0.35s ease-out forwards; }
      `}</style>
      
      {/* Floating Emojis */}
      <div className="absolute inset-0 pointer-events-none z-50">
        {floatingEmojis.map((emoji) => (
          <div
            key={emoji.id}
            className="absolute text-3xl animate-bounce-gentle"
            style={{ left: emoji.x, top: emoji.y }}
          >
            {emoji.emoji}
          </div>
        ))}
      </div>

      {/* UNO Call Animation - Enhanced for all players */}
      {(unoMessage || gameState?.unoMessage) && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          <div className="bg-gradient-to-r from-uno-red via-red-500 to-orange-500 text-white text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold px-6 py-4 rounded-full shadow-2xl border-4 border-white animate-bounce transform scale-110">
            <div className="flex items-center space-x-3">
              <span className="animate-pulse">🔥</span>
              <span className="animate-pulse">{unoMessage || gameState?.unoMessage} says UNO!</span>
              <span className="animate-pulse">🔥</span>
            </div>
          </div>
        </div>
      )}

      {/* False UNO Penalty Message */}
      {gameState?.falseUnoMessage && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          <div className="bg-gradient-to-r from-red-600 via-red-500 to-orange-500 text-white text-xl sm:text-2xl md:text-3xl font-bold px-6 py-4 rounded-2xl shadow-2xl border-4 border-white animate-bounce">
            <div className="flex items-center space-x-3">
              <span className="animate-pulse">❌</span>
              <span>{gameState.falseUnoMessage}</span>
              <span className="animate-pulse">❌</span>
            </div>
          </div>
        </div>
      )}

      {/* One Card Left Message */}
      {oneCardMessage && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 pointer-events-none z-40">
          <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-xl md:text-2xl font-bold px-6 py-3 rounded-full shadow-xl border-3 border-white animate-pulse">
            <div className="flex items-center space-x-2">
              <span>⚠️</span>
              <span>{oneCardMessage}</span>
              <span>⚠️</span>
            </div>
          </div>
        </div>
      )}

      {/* Game Paused Banner */}
      {room?.status === 'paused' && (
        <div className="fixed top-16 md:top-20 left-1/2 transform -translate-x-1/2 pointer-events-none z-40" data-testid="paused-indicator">
          <div className="bg-gradient-to-r from-gray-600 to-gray-700 text-white text-sm md:text-lg font-bold px-4 md:px-6 py-2 md:py-3 rounded-full shadow-xl border-2 border-gray-400">
            <div className="flex items-center space-x-1 md:space-x-2">
              <span>⏸️</span>
              <span>Game Paused</span>
              <span>⏸️</span>
            </div>
          </div>
        </div>
      )}

      {/* Turn Finished Message */}
      {turnFinishedMessage && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 pointer-events-none z-30">
          <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-lg font-medium px-4 py-2 rounded-lg shadow-lg animate-fade-in-out">
            <div className="flex items-center space-x-2">
              <span>✅</span>
              <span>{turnFinishedMessage}</span>
            </div>
          </div>
        </div>
      )}



      {/* Turn Indicator - Shows YOUR TURN or {player}'s Turn */}
      {room?.status === 'playing' && currentGamePlayer && (
        <div className="fixed top-16 md:top-14 left-1/2 transform -translate-x-1/2 pointer-events-none z-30" data-testid="turn-indicator">
          {isMyTurn ? (
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm md:text-lg lg:text-xl font-bold px-4 md:px-6 py-2 md:py-3 rounded-full shadow-xl border-2 border-white animate-pulse">
              <div className="flex items-center space-x-1 md:space-x-2">
                <span>⭐</span>
                <span>YOUR TURN!</span>
                <span>⭐</span>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-sm md:text-lg lg:text-xl font-bold px-4 md:px-6 py-2 md:py-3 rounded-full shadow-xl border-2 border-white animate-pulse">
              <div className="flex items-center space-x-1 md:space-x-2">
                <span>🎯</span>
                <span>{currentGamePlayer.nickname}'s Turn</span>
                <span>🎯</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mobile/Desktop Responsive Header */}
      <div className="absolute top-2 md:top-4 left-2 md:left-4 right-2 md:right-4 z-10">
        <div className="flex items-center justify-between">
          <div className="bg-white/95 backdrop-blur-sm px-2 md:px-4 py-2 rounded-xl shadow-lg">
            <div className="text-xs md:text-sm font-medium text-gray-800">
              Room <span className="font-mono text-uno-blue">{room.code}</span>
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-sm px-2 md:px-4 py-2 rounded-xl shadow-lg">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full animate-pulse ${isMyTurn ? 'bg-green-500' : 'bg-orange-500'}`}></div>
              <span className="font-mono font-medium text-orange-600 text-xs md:text-sm">
                {timer}s
              </span>
            </div>
          </div>

          <div className="flex space-x-1">
            <Button
              variant="outline"
              size="sm"
              className="bg-white/95 backdrop-blur-sm p-2"
              onClick={() => setShowChat(!showChat)}
            >
              <Menu className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="bg-red-50 hover:bg-red-100 border-red-200 text-red-700 text-xs p-2"
              onClick={() => {
                if (confirm("Are you sure you want to exit the game? You will be ranked last.")) {
                  exitGame();
                }
              }}
            >
              Exit
            </Button>
          </div>
        </div>
      </div>

      {/* Responsive Player Areas Around Circle */}
      {/* Top Player */}
      {arrangedPlayers.length > 1 && (
        <div className="absolute top-16 md:top-20 left-1/2 transform -translate-x-1/2 z-20">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl p-2 md:p-3 shadow-lg max-w-xs">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs md:text-sm">
                {arrangedPlayers[arrangedPlayers.length - 2]?.nickname?.[0]?.toUpperCase()}
              </div>
              <div>
                <div className={`font-semibold text-xs md:text-sm text-gray-800 ${currentGamePlayer?.id === arrangedPlayers[arrangedPlayers.length - 2]?.id ? 'text-red-600 animate-pulse' : ''}`}>
                  {arrangedPlayers[arrangedPlayers.length - 2]?.nickname} {currentGamePlayer?.id === arrangedPlayers[arrangedPlayers.length - 2]?.id && '⭐'}
                </div>
                <div className="text-xs text-gray-500">{arrangedPlayers[arrangedPlayers.length - 2]?.hand?.length || 0} cards</div>
              </div>
            </div>
            <div className="flex justify-center space-x-1">
              {Array(Math.min(arrangedPlayers[arrangedPlayers.length - 2]?.hand?.length || 0, 10)).fill(null).map((_, i) => (
                <div key={i} className="w-3 h-4 md:w-4 md:h-6 bg-gradient-to-br from-gray-700 to-gray-900 rounded border border-white shadow-sm transform rotate-2 hover:rotate-0 transition-transform"></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Left Player - compact vertical layout */}
      {arrangedPlayers.length > 2 && (
        <div className="absolute left-1 sm:left-2 md:left-3 top-1/2 transform -translate-y-1/2 z-20">
          <div className="bg-white/90 backdrop-blur-sm rounded-lg p-1.5 md:p-2 shadow-lg w-16 md:w-20">
            <div className="flex flex-col items-center text-center">
              <div className={`w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white font-bold text-sm md:text-base mb-1 ${currentGamePlayer?.id === arrangedPlayers[arrangedPlayers.length - 3]?.id ? 'ring-2 ring-red-500 animate-pulse' : ''}`}>
                {arrangedPlayers[arrangedPlayers.length - 3]?.nickname?.[0]?.toUpperCase()}
              </div>
              <div className={`text-[10px] md:text-xs font-semibold text-gray-800 truncate w-full ${currentGamePlayer?.id === arrangedPlayers[arrangedPlayers.length - 3]?.id ? 'text-red-600' : ''}`}>
                {arrangedPlayers[arrangedPlayers.length - 3]?.nickname?.slice(0, 6)}
              </div>
              <div className="text-[8px] md:text-[10px] text-gray-500">{arrangedPlayers[arrangedPlayers.length - 3]?.hand?.length || 0} cards</div>
            </div>
          </div>
        </div>
      )}

      {/* Right Player - compact vertical layout */}
      {arrangedPlayers.length > 3 && (
        <div className="absolute right-1 sm:right-2 md:right-3 top-1/2 transform -translate-y-1/2 z-20">
          <div className="bg-white/90 backdrop-blur-sm rounded-lg p-1.5 md:p-2 shadow-lg w-16 md:w-20">
            <div className="flex flex-col items-center text-center">
              <div className={`w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center text-white font-bold text-sm md:text-base mb-1 ${currentGamePlayer?.id === arrangedPlayers[arrangedPlayers.length - 4]?.id ? 'ring-2 ring-red-500 animate-pulse' : ''}`}>
                {arrangedPlayers[arrangedPlayers.length - 4]?.nickname?.[0]?.toUpperCase()}
              </div>
              <div className={`text-[10px] md:text-xs font-semibold text-gray-800 truncate w-full ${currentGamePlayer?.id === arrangedPlayers[arrangedPlayers.length - 4]?.id ? 'text-red-600' : ''}`}>
                {arrangedPlayers[arrangedPlayers.length - 4]?.nickname?.slice(0, 6)}
              </div>
              <div className="text-[8px] md:text-[10px] text-gray-500">{arrangedPlayers[arrangedPlayers.length - 4]?.hand?.length || 0} cards</div>
            </div>
          </div>
        </div>
      )}

      {/* Draw Pile - positioned between 6 o'clock (bottom) and 10 o'clock (upper-left) */}
      <div className="absolute z-20" style={{ left: '21%', bottom: '22%' }}>
        <div className="relative cursor-pointer group" onClick={drawCard}>
          <div className="bg-gradient-to-br from-amber-600 to-orange-700 rounded-lg border-2 border-amber-500 shadow-xl group-hover:shadow-amber-500/50 transition-all w-10 h-14 sm:w-11 sm:h-15 md:w-12 md:h-16"></div>
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg border-2 border-amber-400 shadow-xl absolute -top-0.5 -left-0.5 w-10 h-14 sm:w-11 sm:h-15 md:w-12 md:h-16"></div>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-white font-bold text-xs sm:text-sm drop-shadow-lg">Draw</span>
          </div>
        </div>
      </div>

      {/* Circular Game Area - Responsive */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          {/* Main Game Circle */}
          <div className="w-40 h-40 sm:w-48 sm:h-48 md:w-64 md:h-64 lg:w-80 lg:h-80 rounded-full bg-gradient-to-br from-yellow-300 via-orange-400 to-red-500 shadow-2xl flex items-center justify-center relative border-4 border-white/30">
            
            {/* Inner Circle */}
            <div className="w-28 h-28 sm:w-32 sm:h-32 md:w-40 md:h-40 lg:w-48 lg:h-48 rounded-full bg-gradient-to-br from-yellow-200 to-orange-300 shadow-inner flex items-center justify-center relative border-2 border-white/50">

              {/* Current Card - Center with compact size to prevent overlap */}
              <div className="flex flex-col items-center">
                {topCard && (
                  <GameCard 
                    card={topCard} 
                    size="small" 
                  />
                )}
                {/* Active Color Indicator - Compact and positioned to avoid overlap */}
                {room.currentColor && (topCard?.type === "wild" || topCard?.type === "wild4") && (
                  <div className="mt-1 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm">
                    <div className="text-xs font-bold text-gray-700">
                      Active: <span className={`${room.currentColor === 'red' ? 'text-red-500' : room.currentColor === 'blue' ? 'text-blue-500' : room.currentColor === 'green' ? 'text-green-500' : 'text-yellow-500'}`}>
                        {room.currentColor?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Direction Indicator - Right Side */}
              <div className="absolute -right-6 sm:-right-8 md:-right-12 top-1/2 transform -translate-y-1/2 flex flex-col items-center">
                <div className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-lg border-2 border-yellow-300">
                  <span className="text-white text-xs sm:text-sm md:text-base">
                    {room.direction === "clockwise" ? "↻" : "↺"}
                  </span>
                </div>
                <div className="text-[8px] sm:text-[10px] text-center mt-1 text-white font-bold bg-black/40 px-1 py-0.5 rounded whitespace-nowrap">
                  Game Direction
                </div>
              </div>
            </div>

            {/* UNO Button - Always Available, Always Same Appearance */}
            <div className="absolute -bottom-12 sm:-bottom-16 md:-bottom-20 left-1/2 transform -translate-x-1/2">
              <Button
                onClick={handleUnoCall}
                className="transition-all shadow-lg text-white font-bold px-3 py-2 sm:px-4 sm:py-2 md:px-6 md:py-3 text-sm sm:text-base md:text-lg rounded-full bg-gradient-to-r from-uno-red to-red-500 hover:scale-110 animate-pulse"
              >
                🔥 UNO! 🔥
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Player (Current User) - Responsive */}
      {currentPlayer && !currentPlayer.isSpectator && (
        <div className="absolute bottom-2 sm:bottom-4 left-1/2 transform -translate-x-1/2 z-20 w-full max-w-xs sm:max-w-md md:max-w-lg lg:max-w-2xl px-2">
          <div className="bg-white/95 backdrop-blur-sm rounded-xl p-2 sm:p-3 md:p-4 shadow-xl">
            <div className="text-center mb-2 sm:mb-3 md:mb-4">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 bg-gradient-to-br from-uno-green to-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm md:text-base">
                  {currentPlayer.nickname[0].toUpperCase()}
                </div>
                <div>
                  <div className={`font-semibold text-xs sm:text-sm md:text-base text-gray-800 ${isMyTurn ? 'animate-pulse text-red-600' : ''}`}>
                    {currentPlayer.nickname} (You) {isMyTurn && '⭐'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {currentPlayer.hand?.length || 0} cards
                  </div>
                </div>
              </div>
            </div>
            
            {/* User's Cards - Responsive Grid Layout */}
            <div className="flex flex-wrap gap-1 sm:gap-2 justify-center max-h-24 sm:max-h-32 md:max-h-40 overflow-y-auto">
              {currentPlayer.hand?.map((card: any, index: number) => (
                <div key={index} className="flex-shrink-0">
                  <GameCard
                    card={card}
                    onClick={() => handlePlayCardWithUnoCheck(index)}
                    disabled={!isMyTurn}
                    interactive
                    size="small"
                  />
                </div>
              )) || []}
            </div>
          </div>
        </div>
      )}

      {/* Viewers Panel - Draggable, Resizable, Hideable (hidden by default) */}
      {!showViewers && (
        <button
          onClick={() => setShowViewers(true)}
          className="fixed z-40 bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center gap-1 transition-all"
          style={{ 
            top: '4.5rem', 
            right: 0,
            padding: '8px 6px 8px 10px',
            borderTopLeftRadius: '12px',
            borderBottomLeftRadius: '12px'
          }}
          data-testid="button-show-viewers"
          title="Show Viewers Panel"
        >
          <span className="text-sm font-bold">👥 {spectators.length}</span>
        </button>
      )}
      
      {showViewers && (
        <div 
          ref={viewerPanelRef}
          className="fixed z-30 bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-gray-200 flex flex-col select-none"
          style={{
            top: viewerPanelPosition.y === -1 ? '4rem' : viewerPanelPosition.y,
            right: viewerPanelPosition.x === -1 ? '0.5rem' : 'auto',
            left: viewerPanelPosition.x === -1 ? 'auto' : viewerPanelPosition.x,
            width: viewerPanelSize.width,
            height: viewerPanelSize.height,
            cursor: isDraggingViewerPanel ? 'grabbing' : 'auto'
          }}
          data-testid="panel-viewers"
        >
          <div 
            className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-xl cursor-grab active:cursor-grabbing touch-none"
            onMouseDown={handleViewerPanelDragStart}
            onTouchStart={handleViewerPanelTouchStart}
          >
            <span className="text-sm font-semibold">👥 Viewers ({spectators.length})</span>
            <button
              onClick={() => setShowViewers(false)}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              title="Hide Panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {spectators.length > 0 ? (
              spectators.map((spectator: any, index: number) => (
                <div key={spectator.id}>
                  <div className="flex items-center gap-2 p-2 rounded-lg">
                    <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {spectator.nickname[0].toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-700 font-medium flex-1">{spectator.nickname}</span>
                  </div>
                  {index < spectators.length - 1 && <hr className="border-gray-200 mx-1 my-1" />}
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-16 text-gray-400 text-sm">
                No viewers watching
              </div>
            )}
          </div>
          
          <div 
            className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize touch-none"
            onMouseDown={handleViewerPanelResizeStart}
            onTouchStart={handleViewerPanelResizeTouchStart}
            style={{
              background: 'linear-gradient(135deg, transparent 50%, rgba(100,100,100,0.4) 50%)',
              borderBottomRightRadius: '0.75rem'
            }}
            title="Drag to resize"
          />
        </div>
      )}

      {/* Chat Panel */}
      {showChat && (
        <ChatPanel
          messages={gameState.messages || []}
          players={players}
          onSendMessage={sendChatMessage}
          onSendEmoji={sendEmoji}
          onClose={() => setShowChat(false)}
        />
      )}

      {/* Modals - Only show when explicitly triggered */}
      {(showColorPicker || gameState?.colorChoiceRequested) && (
        <ColorPickerModal
          onChooseColor={handleColorChoice}
          onClose={() => {
            setShowColorPicker(false);
          }}
        />
      )}

      {showGameEnd && (
        <GameEndModal
          winner={gameEndData?.winner || gamePlayers.find((p: any) => (p.hand?.length || 0) === 0)?.nickname || "Someone"}
          rankings={gameEndData?.rankings}
          onPlayAgain={() => {
            // Call server-side play again to reset the room state
            playAgain();
            setShowGameEnd(false);
            setGameEndData(null);
            // Navigate back to lobby to see the reset room
            if (roomId) {
              window.location.href = `/room/${roomId}`;
            } else {
              window.location.href = `/`;
            }
          }}
          onBackToLobby={() => {
            window.location.href = "/";
          }}
        />
      )}

      {/* Continue Game Prompt */}
      {showContinuePrompt && room?.hostId === playerId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <UICard className="max-w-md w-full mx-4">
            <CardContent className="p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Player Left the Game</h3>
              <p className="text-gray-600 mb-6">
                A player has left the game. As the host, you can either continue with the remaining players or invite someone to replace them.
              </p>
              
              <div className="space-y-3">
                <Button
                  onClick={() => {
                    continueGame();
                    setShowContinuePrompt(false);
                  }}
                  className="w-full bg-gradient-to-r from-uno-green to-emerald-500"
                >
                  Continue Game
                </Button>
                
                {spectators.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">Or select a spectator to replace:</p>
                    {spectators.map((spectator: any) => (
                      <Button
                        key={spectator.id}
                        onClick={() => {
                          // Find the first available position (kicked player's position)
                          const kickedPlayers = gamePlayers.filter((p: any) => p.hasLeft);
                          const targetPosition = kickedPlayers.length > 0 ? kickedPlayers[0].position : 0;
                          replacePlayer(targetPosition); 
                          setShowContinuePrompt(false);
                        }}
                        variant="outline"
                        className="w-full"
                      >
                        Replace with {spectator.nickname}
                      </Button>
                    ))}
                  </div>
                )}
                
                <Button
                  onClick={() => setShowContinuePrompt(false)}
                  variant="outline"
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </UICard>
        </div>
      )}
    </div>
  );
}
