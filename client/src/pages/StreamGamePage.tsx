import { useEffect, useState, useRef } from "react";
import { useRoute, useSearch, useLocation } from "wouter";
import { Card as UICard, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, QrCode, X, GripVertical, Link2, ArrowRight, ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useSocket } from "@/hooks/useSocket";
import GameCard from "@/components/game/Card";
import GameEndModal from "@/components/game/GameEndModal";

export default function StreamGamePage() {
  const [, params] = useRoute("/stream/:roomId/game");
  const search = useSearch();
  const [, setLocation] = useLocation();
  const roomId = params?.roomId;
  const roomCode = new URLSearchParams(search).get('code') || undefined;
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeData, setQRCodeData] = useState<string | null>(null);
  const [qrPosition, setQrPosition] = useState({ x: 20, y: 100 });
  const [isDraggingQR, setIsDraggingQR] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [hasSubscribed, setHasSubscribed] = useState(false);
  const [showGameEnd, setShowGameEnd] = useState(false);
  const [gameEndData, setGameEndData] = useState<any>(null);
  const [unoMessage, setUnoMessage] = useState<string | null>(null);
  const [oneCardMessage, setOneCardMessage] = useState<string | null>(null);
  const qrPanelRef = useRef<HTMLDivElement>(null);
  const qrButtonRef = useRef<HTMLButtonElement>(null);
  
  const { gameState, floatingEmojis, isConnected, streamSubscribe, playAgain } = useSocket();

  useEffect(() => {
    if (isConnected && roomId && !hasSubscribed) {
      console.log("📺 StreamGamePage: Subscribing to room", roomId);
      streamSubscribe(roomId, roomCode);
      setHasSubscribed(true);
    }
  }, [isConnected, roomId, roomCode, hasSubscribed, streamSubscribe]);

  const { data: roomData } = useQuery({
    queryKey: ["/api/rooms", roomId],
    enabled: !!roomId,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (roomData && typeof roomData === 'object' && 'qrCode' in roomData) {
      setQRCodeData(roomData.qrCode as string);
    }
  }, [roomData]);

  // UNO message animation
  useEffect(() => {
    if (gameState?.unoMessage) {
      setUnoMessage(gameState.unoMessage);
      setTimeout(() => setUnoMessage(null), 3000);
    }
  }, [gameState?.unoMessage]);

  // One card left message
  useEffect(() => {
    if (gameState?.oneCardMessage) {
      setOneCardMessage(gameState.oneCardMessage);
      setTimeout(() => setOneCardMessage(null), 2500);
    }
  }, [gameState?.oneCardMessageTimestamp]);

  // Game end detection
  useEffect(() => {
    if (gameState?.room?.status === "finished") {
      setShowGameEnd(true);
    }
    if (gameState?.gameEndData) {
      setGameEndData(gameState.gameEndData);
      setShowGameEnd(true);
    }
  }, [gameState?.room?.status, gameState?.gameEndData]);

  const room = gameState?.room || (roomData as any)?.room;
  const players = gameState?.players || [];
  
  const gamePlayers = players.filter((p: any) => 
    !p.isSpectator && p.position !== null && p.position !== undefined
  ).sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
  
  const spectators = players.filter((p: any) => p.isSpectator && p.isOnline);

  const handleQRDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDraggingQR(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragStartPos({ x: clientX - qrPosition.x, y: clientY - qrPosition.y });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!isDraggingQR) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      setQrPosition({
        x: Math.max(0, Math.min(window.innerWidth - 256, clientX - dragStartPos.x)),
        y: Math.max(0, Math.min(window.innerHeight - 300, clientY - dragStartPos.y))
      });
    };

    const handleMouseUp = () => setIsDraggingQR(false);

    if (isDraggingQR) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleMouseMove);
      document.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDraggingQR, dragStartPos]);

  const handleCopyCode = () => {
    if (room?.code) {
      navigator.clipboard.writeText(room.code);
    }
  };

  const handleCopyLink = () => {
    if (room?.code) {
      const baseUrl = window.location.origin;
      const joinLink = `${baseUrl}/?room=${room.code}`;
      navigator.clipboard.writeText(joinLink);
    }
  };

  const handlePlayAgain = () => {
    setShowGameEnd(false);
    setGameEndData(null);
    if (roomId) {
      setLocation(`/stream/${roomId}/lobby?code=${room?.code}`);
    }
  };

  const handleBackToLobby = () => {
    setShowGameEnd(false);
    setGameEndData(null);
    setLocation('/');
  };

  const getPlayerAtPosition = (position: number) => {
    return gamePlayers.find((player: any) => player.position === position) || null;
  };

  const getPlayerAvatar = (id: string) => {
    const savedAvatar = localStorage.getItem(`avatar_${id}`);
    if (savedAvatar === 'male') return '👨';
    if (savedAvatar === 'female') return '👩';
    return '👨';
  };

  const isPlayerOnline = (player: any) => {
    if (!player) return false;
    const playerData = players.find((p: any) => p.id === player.id);
    return playerData?.isOnline !== false;
  };

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-400 via-red-500 to-red-600 flex items-center justify-center">
        <UICard className="bg-white/95 backdrop-blur-sm shadow-xl p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Loading...</h2>
            <p className="text-gray-600">Connecting to game...</p>
          </div>
        </UICard>
      </div>
    );
  }

  const topCard = room?.topCard || room?.discardPile?.[0];
  const currentPlayerIndex = room?.currentPlayerIndex ?? 0;
  const currentGamePlayer = gamePlayers[currentPlayerIndex];
  const pendingDraw = room?.pendingDraw ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-red-500 to-red-600 relative overflow-hidden">
      {/* Floating Emojis - Same as Game.tsx */}
      <div className="absolute inset-0 pointer-events-none z-50">
        {floatingEmojis.map((emoji: any) => (
          <div
            key={emoji.id}
            className="absolute text-3xl animate-bounce"
            style={{ left: emoji.x, top: emoji.y }}
          >
            {emoji.emoji}
          </div>
        ))}
      </div>

      {/* UNO Message Animation */}
      {unoMessage && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="animate-bounce">
            <div className="bg-gradient-to-r from-red-500 to-yellow-500 text-white text-4xl md:text-6xl font-bold px-8 py-4 rounded-2xl shadow-2xl border-4 border-white transform rotate-[-5deg]">
              {unoMessage}
            </div>
          </div>
        </div>
      )}

      {/* One Card Left Message */}
      {oneCardMessage && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="animate-pulse">
            <div className="bg-yellow-500 text-black text-2xl md:text-4xl font-bold px-6 py-3 rounded-xl shadow-xl border-2 border-yellow-300">
              ⚠️ {oneCardMessage}
            </div>
          </div>
        </div>
      )}

      {/* Header with Room Code and Controls */}
      <div className="absolute top-2 md:top-4 left-2 md:left-4 right-2 md:right-4 z-10">
        <div className="flex items-center justify-between">
          <div className="bg-white/95 backdrop-blur-sm px-2 md:px-4 py-2 rounded-xl shadow-lg">
            <div className="text-xs md:text-sm font-medium text-gray-800">
              Room <span className="font-mono text-blue-600">{room.code}</span>
            </div>
          </div>

          <div className="flex space-x-1">
            <Button
              onClick={handleCopyLink}
              variant="outline"
              size="sm"
              className="bg-white/95 backdrop-blur-sm p-2"
            >
              <Link2 className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
            <Button
              ref={qrButtonRef}
              onClick={() => {
                if (!showQRCode && qrButtonRef.current) {
                  const rect = qrButtonRef.current.getBoundingClientRect();
                  setQrPosition({ x: rect.left - 200, y: rect.bottom + 8 });
                }
                setShowQRCode(!showQRCode);
              }}
              variant="outline"
              size="sm"
              className="bg-white/95 backdrop-blur-sm p-2"
            >
              <QrCode className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Top Player (Position 0) */}
      {gamePlayers.length > 0 && getPlayerAtPosition(0) && (
        <div className="absolute top-16 md:top-20 left-1/2 transform -translate-x-1/2 z-20">
          <div className="flex flex-col items-center">
            {/* Cards above avatar */}
            <div className="flex justify-center space-x-0.5 mb-2">
              {Array(Math.min(getPlayerAtPosition(0)?.hand?.length || getPlayerAtPosition(0)?.cardCount || 0, 10)).fill(null).map((_, i) => (
                <div key={i} className="w-3 h-4 md:w-4 md:h-6 bg-gradient-to-br from-red-600 to-red-800 rounded border border-red-400 shadow-sm transform hover:rotate-0 transition-transform" style={{ transform: `rotate(${(i - 4) * 3}deg)`, marginLeft: i > 0 ? '-4px' : '0' }}>
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-yellow-300 text-[3px] md:text-[4px] font-bold">UNO</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-white/90 backdrop-blur-sm rounded-xl p-2 md:p-3 shadow-lg">
              <div className="flex items-center space-x-2">
                <div className={`w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-sm md:text-base ${currentGamePlayer?.id === getPlayerAtPosition(0)?.id ? 'ring-2 ring-green-500 animate-pulse' : ''}`}>
                  {getPlayerAvatar(getPlayerAtPosition(0)?.id)}
                </div>
                <div>
                  <div className={`font-semibold text-xs md:text-sm text-gray-800 ${currentGamePlayer?.id === getPlayerAtPosition(0)?.id ? 'text-red-600 animate-pulse' : ''}`}>
                    {getPlayerAtPosition(0)?.nickname} {currentGamePlayer?.id === getPlayerAtPosition(0)?.id && '⭐'}
                  </div>
                  <div className="text-xs text-gray-500">{getPlayerAtPosition(0)?.hand?.length || getPlayerAtPosition(0)?.cardCount || 0} cards</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Left Player (Position 3) */}
      {gamePlayers.length > 3 && getPlayerAtPosition(3) && (
        <div className="absolute left-1 sm:left-2 md:left-3 top-1/2 transform -translate-y-1/2 z-20">
          <div className="flex flex-row items-center">
            {/* Cards to the left of avatar */}
            <div className="flex flex-col justify-center mr-1">
              {Array(Math.min(getPlayerAtPosition(3)?.hand?.length || getPlayerAtPosition(3)?.cardCount || 0, 10)).fill(null).map((_, i) => (
                <div key={i} className="w-4 h-3 md:w-6 md:h-4 bg-gradient-to-br from-red-600 to-red-800 rounded-sm border border-red-400 shadow-sm" style={{ transform: `rotate(${90 + (i - 4) * 5}deg)`, marginTop: i > 0 ? '-4px' : '0' }}>
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-yellow-300 text-[3px] md:text-[4px] font-bold rotate-90">UNO</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-white/90 backdrop-blur-sm rounded-lg p-1.5 md:p-2 shadow-lg w-16 md:w-20">
              <div className="flex flex-col items-center text-center">
                <div className={`w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-sm md:text-base mb-1 ${currentGamePlayer?.id === getPlayerAtPosition(3)?.id ? 'ring-2 ring-green-500 animate-pulse' : ''}`}>
                  {getPlayerAvatar(getPlayerAtPosition(3)?.id)}
                </div>
                <div className={`text-[10px] md:text-xs font-semibold text-gray-800 truncate w-full ${currentGamePlayer?.id === getPlayerAtPosition(3)?.id ? 'text-red-600' : ''}`}>
                  {getPlayerAtPosition(3)?.nickname?.slice(0, 6)}
                </div>
                <div className="text-[8px] md:text-[10px] text-gray-500">{getPlayerAtPosition(3)?.hand?.length || getPlayerAtPosition(3)?.cardCount || 0} cards</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Right Player (Position 1) */}
      {gamePlayers.length > 1 && getPlayerAtPosition(1) && (
        <div className="absolute right-1 sm:right-2 md:right-3 top-1/2 transform -translate-y-1/2 z-20">
          <div className="flex flex-row items-center">
            <div className="bg-white/90 backdrop-blur-sm rounded-lg p-1.5 md:p-2 shadow-lg w-16 md:w-20">
              <div className="flex flex-col items-center text-center">
                <div className={`w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center text-sm md:text-base mb-1 ${currentGamePlayer?.id === getPlayerAtPosition(1)?.id ? 'ring-2 ring-green-500 animate-pulse' : ''}`}>
                  {getPlayerAvatar(getPlayerAtPosition(1)?.id)}
                </div>
                <div className={`text-[10px] md:text-xs font-semibold text-gray-800 truncate w-full ${currentGamePlayer?.id === getPlayerAtPosition(1)?.id ? 'text-red-600' : ''}`}>
                  {getPlayerAtPosition(1)?.nickname?.slice(0, 6)}
                </div>
                <div className="text-[8px] md:text-[10px] text-gray-500">{getPlayerAtPosition(1)?.hand?.length || getPlayerAtPosition(1)?.cardCount || 0} cards</div>
              </div>
            </div>
            {/* Cards to the right of avatar */}
            <div className="flex flex-col justify-center ml-1">
              {Array(Math.min(getPlayerAtPosition(1)?.hand?.length || getPlayerAtPosition(1)?.cardCount || 0, 10)).fill(null).map((_, i) => (
                <div key={i} className="w-4 h-3 md:w-6 md:h-4 bg-gradient-to-br from-red-600 to-red-800 rounded-sm border border-red-400 shadow-sm" style={{ transform: `rotate(${-90 + (i - 4) * 5}deg)`, marginTop: i > 0 ? '-4px' : '0' }}>
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-yellow-300 text-[3px] md:text-[4px] font-bold rotate-[-90deg]">UNO</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Circular Game Area - Same as Game.tsx */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          {/* Main Game Circle */}
          <div className="w-40 h-40 sm:w-48 sm:h-48 md:w-64 md:h-64 lg:w-80 lg:h-80 rounded-full bg-gradient-to-br from-yellow-300 via-orange-400 to-red-500 shadow-2xl flex items-center justify-center relative border-4 border-white/30">
            
            {/* Inner Circle */}
            <div className="w-28 h-28 sm:w-32 sm:h-32 md:w-40 md:h-40 lg:w-48 lg:h-48 rounded-full bg-gradient-to-br from-yellow-200 to-orange-300 shadow-inner flex items-center justify-center relative border-2 border-white/50">
              
              {/* Draw Pile - Left Side */}
              <div className="absolute -left-6 sm:-left-8 md:-left-12 top-1/2 transform -translate-y-1/2">
                <div className="relative">
                  <div className={`w-8 h-12 sm:w-10 sm:h-14 md:w-14 md:h-18 bg-gradient-to-br ${pendingDraw > 0 ? 'from-red-600 to-red-800' : 'from-blue-800 to-blue-900'} rounded-lg border-2 border-white shadow-xl`}></div>
                  <div className={`w-8 h-12 sm:w-10 sm:h-14 md:w-14 md:h-18 bg-gradient-to-br ${pendingDraw > 0 ? 'from-red-500 to-red-700' : 'from-blue-700 to-blue-800'} rounded-lg border-2 border-white shadow-xl absolute -top-0.5 -left-0.5`}></div>
                  <div className={`w-8 h-12 sm:w-10 sm:h-14 md:w-14 md:h-18 bg-gradient-to-br ${pendingDraw > 0 ? 'from-red-400 to-red-600' : 'from-blue-600 to-blue-700'} rounded-lg border-2 border-white shadow-xl absolute -top-1 -left-1 flex items-center justify-center`}>
                    {pendingDraw > 0 && <span className="text-white text-xs font-bold">+{pendingDraw}</span>}
                  </div>
                </div>
                <div className="text-xs text-center mt-1 text-white font-bold">{pendingDraw > 0 ? `DRAW ${pendingDraw}` : 'DRAW'}</div>
              </div>

              {/* Current Card - Center */}
              <div className="flex flex-col items-center">
                {topCard && (
                  <GameCard 
                    card={topCard} 
                    size="small" 
                  />
                )}
                {/* Active Color Indicator */}
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
              <div className="absolute -right-6 sm:-right-8 md:-right-12 top-1/2 transform -translate-y-1/2">
                <div className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full flex items-center justify-center shadow-lg">
                  {room.direction === "clockwise" ? (
                    <ArrowRight className="text-white h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 animate-pulse" />
                  ) : (
                    <ArrowLeft className="text-white h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 animate-pulse" />
                  )}
                </div>
                <div className="text-xs text-center mt-1 text-white font-bold">
                  {room.direction === "clockwise" ? "CW" : "CCW"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Player (Position 2) */}
      {gamePlayers.length > 2 && getPlayerAtPosition(2) && (
        <div className="absolute bottom-2 sm:bottom-4 left-1/2 transform -translate-x-1/2 z-20">
          <div className="flex flex-col items-center">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl p-2 sm:p-3 md:p-4 shadow-xl">
              <div className="flex items-center space-x-2 mb-2">
                <div className={`w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center text-sm md:text-base ${currentGamePlayer?.id === getPlayerAtPosition(2)?.id ? 'ring-2 ring-green-500 animate-pulse' : ''}`}>
                  {getPlayerAvatar(getPlayerAtPosition(2)?.id)}
                </div>
                <div>
                  <div className={`font-semibold text-xs sm:text-sm md:text-base text-gray-800 ${currentGamePlayer?.id === getPlayerAtPosition(2)?.id ? 'text-red-600 animate-pulse' : ''}`}>
                    {getPlayerAtPosition(2)?.nickname} {currentGamePlayer?.id === getPlayerAtPosition(2)?.id && '⭐'}
                  </div>
                  <div className="text-xs text-gray-500">{getPlayerAtPosition(2)?.hand?.length || getPlayerAtPosition(2)?.cardCount || 0} cards</div>
                </div>
              </div>
            </div>
            {/* Cards below avatar */}
            <div className="flex justify-center space-x-0.5 mt-2">
              {Array(Math.min(getPlayerAtPosition(2)?.hand?.length || getPlayerAtPosition(2)?.cardCount || 0, 10)).fill(null).map((_, i) => (
                <div key={i} className="w-3 h-4 md:w-4 md:h-6 bg-gradient-to-br from-red-600 to-red-800 rounded border border-red-400 shadow-sm" style={{ transform: `rotate(${180 + (i - 4) * 3}deg)`, marginLeft: i > 0 ? '-4px' : '0' }}>
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-yellow-300 text-[3px] md:text-[4px] font-bold rotate-180">UNO</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Spectators Panel - Same as Game.tsx */}
      {spectators.length > 0 && (
        <div className="absolute top-20 right-4 z-20">
          <UICard className="bg-white/95 backdrop-blur-sm shadow-lg">
            <CardContent className="p-3">
              <div className="text-sm font-medium text-gray-700 mb-2">Spectators ({spectators.length})</div>
              <div className="space-y-2">
                {spectators.map((spectator: any) => (
                  <div key={spectator.id} className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {spectator.nickname[0].toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-600">{spectator.nickname}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </UICard>
        </div>
      )}

      {/* Turn Indicator */}
      {currentGamePlayer && (
        <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full shadow-lg border-2 ${
          pendingDraw > 0 ? 'bg-red-600 border-red-400 animate-pulse' : 'bg-green-600 border-green-400 animate-pulse'
        }`}>
          <div className="text-white font-bold text-sm text-center">
            {pendingDraw > 0 ? (
              <span>⚠️ {currentGamePlayer.nickname} must draw {pendingDraw} cards!</span>
            ) : (
              <span>🎮 {currentGamePlayer.nickname}'s turn</span>
            )}
          </div>
        </div>
      )}

      {/* QR Code Floating Panel */}
      {showQRCode && qrCodeData && (
        <div
          ref={qrPanelRef}
          className="fixed z-50 select-none"
          style={{
            left: qrPosition.x,
            top: qrPosition.y,
            cursor: isDraggingQR ? 'grabbing' : 'default'
          }}
        >
          <UICard className="w-64 shadow-2xl border-2 border-orange-500/50 bg-white/98 backdrop-blur-sm">
            <CardContent className="p-4">
              <div
                className="flex items-center justify-between mb-3 cursor-grab active:cursor-grabbing"
                onMouseDown={handleQRDragStart}
                onTouchStart={handleQRDragStart}
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-800">Scan to Join</span>
                </div>
                <button
                  onClick={() => setShowQRCode(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <div className="bg-white p-3 rounded-lg flex justify-center border border-gray-200">
                <img src={qrCodeData} alt="QR Code" className="w-full h-auto" />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="font-mono text-lg font-bold text-gray-800">{room?.code}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyCode}
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </Button>
              </div>
            </CardContent>
          </UICard>
        </div>
      )}

      {/* Game End Modal */}
      {showGameEnd && (
        <GameEndModal
          winner={gameEndData?.winner || currentGamePlayer?.nickname || "Unknown"}
          rankings={gameEndData?.rankings}
          onPlayAgain={handlePlayAgain}
          onBackToLobby={handleBackToLobby}
        />
      )}
    </div>
  );
}
