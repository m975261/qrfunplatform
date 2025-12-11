import { useEffect, useState, useRef } from "react";
import { useRoute, useSearch, useLocation } from "wouter";
import { Card as UICard, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, QrCode, X, GripVertical, Link2, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useSocket } from "@/hooks/useSocket";
import StreamGameBoard from "@/components/game/StreamGameBoard";
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
  const [showSpectators, setShowSpectators] = useState(true);
  const [viewersPanelWidth, setViewersPanelWidth] = useState(250);
  const [viewersPanelHeight, setViewersPanelHeight] = useState(200);
  const [viewersPanelPosition, setViewersPanelPosition] = useState({ x: window.innerWidth - 270, y: 80 });
  const [isResizingPanel, setIsResizingPanel] = useState(false);
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartY = useRef(0);
  const resizeStartWidth = useRef(250);
  const resizeStartHeight = useRef(200);
  const panelDragStart = useRef({ x: 0, y: 0 });
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
  
  // Get current player for turn highlighting
  const currentPlayerIndex = room?.currentPlayerIndex ?? 0;
  const currentGamePlayer = gamePlayers[currentPlayerIndex];
  
  // Include all spectators (not just online ones for stream mode)
  const spectators = players.filter((p: any) => p.isSpectator);

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

  // Panel drag handler
  const handlePanelDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDraggingPanel(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    panelDragStart.current = { x: clientX - viewersPanelPosition.x, y: clientY - viewersPanelPosition.y };
  };

  // Panel resize handler (bottom-right corner)
  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingPanel(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    resizeStartX.current = clientX;
    resizeStartY.current = clientY;
    resizeStartWidth.current = viewersPanelWidth;
    resizeStartHeight.current = viewersPanelHeight;
  };

  useEffect(() => {
    const handlePanelMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      if (isDraggingPanel) {
        // No limitations - fully free movement
        const newX = clientX - panelDragStart.current.x;
        const newY = clientY - panelDragStart.current.y;
        setViewersPanelPosition({ x: newX, y: newY });
      }
      
      if (isResizingPanel) {
        // No limitations - use show/hide button for recovery if needed
        const deltaX = clientX - resizeStartX.current;
        const deltaY = clientY - resizeStartY.current;
        setViewersPanelWidth(resizeStartWidth.current + deltaX);
        setViewersPanelHeight(resizeStartHeight.current + deltaY);
      }
    };

    const handlePanelEnd = () => {
      setIsDraggingPanel(false);
      setIsResizingPanel(false);
    };

    if (isDraggingPanel || isResizingPanel) {
      document.addEventListener('mousemove', handlePanelMove);
      document.addEventListener('mouseup', handlePanelEnd);
      document.addEventListener('touchmove', handlePanelMove);
      document.addEventListener('touchend', handlePanelEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handlePanelMove);
      document.removeEventListener('mouseup', handlePanelEnd);
      document.removeEventListener('touchmove', handlePanelMove);
      document.removeEventListener('touchend', handlePanelEnd);
    };
  }, [isDraggingPanel, isResizingPanel, viewersPanelWidth, viewersPanelHeight]);

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
    playAgain();
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

  // Derive game end state from gameState directly for reliable rendering
  const shouldShowGameEnd = showGameEnd || gameState?.gameEndData || gameState?.room?.status === 'finished';
  
  if (!room && !shouldShowGameEnd) {
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

  // Show Game End Modal even if room became null
  if (!room && shouldShowGameEnd) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-400 via-red-500 to-red-600 flex items-center justify-center">
        <GameEndModal
          winner={gameEndData?.winner || gameState?.gameEndData?.winner || "Someone"}
          rankings={gameEndData?.rankings || gameState?.gameEndData?.rankings}
          onPlayAgain={handlePlayAgain}
          onBackToLobby={handleBackToLobby}
        />
      </div>
    );
  }

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

      {/* UNO Call Animation - Same as Game.tsx */}
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

      {/* Header with Room Code and Controls - Same as Game.tsx */}
      <div className="absolute top-2 md:top-4 left-2 md:left-4 right-2 md:right-4 z-10">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <div className="bg-white/95 backdrop-blur-sm px-2 md:px-4 py-2 rounded-xl shadow-lg">
              <div className="text-xs md:text-sm font-medium text-gray-800">
                Room <span className="font-mono text-uno-blue">{room.code}</span>
              </div>
            </div>
            <div className="bg-white/95 backdrop-blur-sm px-2 md:px-4 py-2 rounded-xl shadow-lg">
              <div className="text-xs md:text-sm font-bold text-gray-800 text-center">
                Enter Code Here: <span className="text-uno-red font-bold underline">QrFun.net</span>
              </div>
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

      {/* Floating Draggable & Resizable Viewers Panel - NO CLOSE BUTTON */}
      {showSpectators && (
        <div 
          className="fixed z-20 select-none"
          style={{
            left: viewersPanelPosition.x,
            top: viewersPanelPosition.y,
            width: viewersPanelWidth,
            height: viewersPanelHeight
          }}
        >
          <UICard className="bg-white/95 backdrop-blur-sm shadow-xl h-full flex flex-col">
            {/* Draggable Header - No X button, only hide/minimize */}
            <div 
              className="bg-gradient-to-r from-gray-100 to-gray-200 px-3 py-2 cursor-grab active:cursor-grabbing flex items-center justify-between rounded-t-lg border-b"
              onMouseDown={handlePanelDragStart}
              onTouchStart={handlePanelDragStart}
            >
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Viewers ({spectators.length})</span>
              </div>
              <button
                onClick={() => setShowSpectators(false)}
                className="p-1 hover:bg-gray-300 rounded"
                data-testid="hide-spectators"
                title="Minimize panel"
              >
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            
            {/* Content - Viewers Table */}
            <CardContent className="p-3 flex-1 overflow-auto">
              {spectators.length === 0 ? (
                <div className="text-sm text-gray-400 italic">No viewers yet</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-2">Viewer</th>
                      <th className="pb-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spectators.map((spectator: any) => (
                      <tr key={spectator.id} className="border-b border-gray-100">
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-gradient-to-br from-uno-blue to-uno-green rounded-full flex items-center justify-center text-white text-xs font-bold">
                              {spectator.nickname[0].toUpperCase()}
                            </div>
                            <span className="text-gray-700 truncate">{spectator.nickname}</span>
                          </div>
                        </td>
                        <td className="py-2 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${spectator.isOnline ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                            {spectator.isOnline ? 'Online' : 'Offline'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
            
            {/* Resize Handle (bottom-right corner) - no size limits */}
            <div
              onMouseDown={handleResizeStart}
              onTouchStart={handleResizeStart}
              className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
              style={{ touchAction: 'none' }}
            >
              <div className="w-0 h-0 border-l-[16px] border-l-transparent border-b-[16px] border-b-gray-400/50 hover:border-b-uno-blue/50 transition-colors" />
            </div>
          </UICard>
        </div>
      )}
      
      {/* Show/Hide Viewers Button - next to QR button */}
      {!showSpectators && (
        <button
          onClick={() => setShowSpectators(true)}
          className="fixed top-16 right-2 z-20 bg-white/95 backdrop-blur-sm shadow-lg rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors flex items-center gap-2"
          data-testid="toggle-spectators"
          title="Show Viewers Panel"
        >
          <Users className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-600">Viewers ({spectators.length})</span>
          <ChevronLeft className="w-4 h-4 text-gray-400" />
        </button>
      )}

      {/* Game Board - Using StreamGameBoard with isSpectator=true for OBS view */}
      {/* For spectator/OBS view, pass undefined for currentPlayerId so isMyTurn is always false */}
      <StreamGameBoard
        room={room}
        players={players}
        currentPlayerId={undefined}
        isSpectator={true}
        colorChoiceRequested={false}
      />

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
              <div className="mt-2 text-center">
                <a 
                  href="https://qrfun.net" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:text-purple-500 text-sm font-medium underline"
                >
                  qrfun.net
                </a>
              </div>
            </CardContent>
          </UICard>
        </div>
      )}

      {/* Game End Modal */}
      {shouldShowGameEnd && (
        <GameEndModal
          winner={gameEndData?.winner || gameState?.gameEndData?.winner || gamePlayers.find((p: any) => (p.hand?.length || 0) === 0)?.nickname || "Someone"}
          rankings={gameEndData?.rankings || gameState?.gameEndData?.rankings}
          onPlayAgain={handlePlayAgain}
          onBackToLobby={handleBackToLobby}
        />
      )}
    </div>
  );
}
