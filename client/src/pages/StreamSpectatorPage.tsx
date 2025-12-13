import { useEffect, useState, useRef } from "react";
import { useRoute, useSearch, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Card as UICard } from "@/components/ui/card";
import { Tv, Crown, Users, Clock, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import StreamGameBoard from "@/components/game/StreamGameBoard";
import GameEndModal from "@/components/game/GameEndModal";

// Host disconnect countdown component for streaming mode
function StreamingHostDisconnectBanner({ deadlineMs, hostName }: { deadlineMs: number, hostName: string }) {
  const [secondsLeft, setSecondsLeft] = useState(30);
  
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
      setSecondsLeft(remaining);
    }, 100);
    return () => clearInterval(interval);
  }, [deadlineMs]);
  
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white p-4 shadow-lg animate-pulse">
      <div className="max-w-4xl mx-auto flex items-center justify-center gap-3">
        <AlertTriangle className="w-6 h-6" />
        <span className="font-bold text-lg">
          Host "{hostName}" disconnected! Redirecting in {secondsLeft}s...
        </span>
      </div>
    </div>
  );
}

export default function StreamSpectatorPage() {
  const [, params] = useRoute("/stream/:roomId/spectator");
  const search = useSearch();
  const [, setLocation] = useLocation();
  const roomId = params?.roomId;
  const roomCode = new URLSearchParams(search).get('code') || undefined;
  const hasShownAssignedToast = useRef(false);
  const [assignedSlot, setAssignedSlot] = useState<number | null>(null);
  
  const { gameState, joinRoom, playAgain, isConnected } = useSocket();
  const playerId = localStorage.getItem("playerId");
  const playerNickname = localStorage.getItem("playerNickname");
  
  // Game view state
  const [showSpectators, setShowSpectators] = useState(true);
  const [showGameEnd, setShowGameEnd] = useState(false);
  const [gameEndData, setGameEndData] = useState<any>(null);
  const [unoMessage, setUnoMessage] = useState<string | null>(null);
  const [oneCardMessage, setOneCardMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isConnected && roomId && playerId) {
      joinRoom(playerId, roomId);
    }
  }, [isConnected, roomId, playerId, joinRoom]);

  useEffect(() => {
    const myPlayer = gameState?.players?.find((p: any) => p.id === playerId);
    if (!myPlayer || !roomId) return;
    
    const code = gameState?.room?.code || roomCode;
    const isPlaying = gameState?.room?.status === "playing";
    const hasPosition = myPlayer.position !== null && myPlayer.position !== undefined && !myPlayer.isSpectator;
    
    if (hasPosition && isPlaying) {
      const slot = myPlayer.position + 1;
      localStorage.setItem("streamPlayerPlayerId", playerId || "");
      setLocation(`/stream/${roomId}/player/${slot}?code=${code}`);
    } else if (hasPosition && !isPlaying) {
      setAssignedSlot(myPlayer.position + 1);
    } else if (!hasPosition) {
      // Player was unassigned - reset state
      if (assignedSlot !== null) {
        setAssignedSlot(null);
        hasShownAssignedToast.current = false;
      }
    }
  }, [gameState?.players, gameState?.room?.status, gameState?.room?.code, playerId, roomId, setLocation, roomCode, assignedSlot]);

  const room = gameState?.room;
  const players = gameState?.players || [];
  
  const gamePlayers = players.filter((p: any) => 
    !p.isSpectator && p.position !== null && p.position !== undefined
  ).sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
  
  const spectators = players.filter((p: any) => p.isSpectator);
  const myPlayer = players.find((p: any) => p.id === playerId);
  const hostPlayer = players.find((p: any) => p.id === room?.hostId);
  const isGamePlaying = room?.status === "playing";
  const isSpectator = myPlayer?.isSpectator === true || myPlayer?.position == null;
  
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

  const getPositionClass = (position: number) => {
    const positions = [
      'top-4 left-1/2 -translate-x-1/2',
      'right-4 top-1/2 -translate-y-1/2',
      'bottom-4 left-1/2 -translate-x-1/2',
      'left-4 top-1/2 -translate-y-1/2'
    ];
    return positions[position] || positions[0];
  };

  const getPlayerAtPosition = (position: number) => {
    return gamePlayers.find((p: any) => p.position === position);
  };

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-uno-blue via-uno-purple to-uno-red flex items-center justify-center">
        <Card className="bg-white/95 backdrop-blur-sm shadow-xl p-8">
          <div className="text-center">
            <Tv className="w-16 h-16 mx-auto mb-4 text-purple-600 animate-pulse" />
            <h2 className="text-2xl font-bold mb-2 text-gray-800">Connecting to Room...</h2>
            <p className="text-gray-600">Please wait while we connect you.</p>
          </div>
        </Card>
      </div>
    );
  }

  // Handle streaming host disconnect
  const streamingHostDisconnected = gameState?.streamingHostDisconnected;
  const streamingHostDeadlineMs = gameState?.streamingHostDeadlineMs;
  const streamingHostName = gameState?.streamingHostName;

  // Derive game end state
  const shouldShowGameEnd = showGameEnd || gameState?.gameEndData || gameState?.room?.status === 'finished';

  // When game is playing and user is a spectator, show the game board (spectator view)
  if (isGamePlaying && isSpectator) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-uno-blue via-uno-purple to-uno-red relative overflow-hidden">
        {streamingHostDisconnected && streamingHostDeadlineMs && (
          <StreamingHostDisconnectBanner 
            deadlineMs={streamingHostDeadlineMs} 
            hostName={streamingHostName || "Host"} 
          />
        )}
        
        {/* Header */}
        <div className="absolute top-4 left-4 right-4 z-10">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="bg-white/95 backdrop-blur-sm text-gray-800 font-bold px-3 py-1 rounded-full text-sm shadow-lg">
                Room {room?.code}
              </span>
              <span className="bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                <Tv className="w-3 h-3" />
                WATCHING
              </span>
            </div>
          </div>
        </div>
        
        {/* UNO Message Overlay */}
        {unoMessage && (
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-uno-red text-white text-6xl font-bold px-12 py-8 rounded-3xl shadow-2xl animate-bounce border-8 border-white">
              {unoMessage}
            </div>
          </div>
        )}
        
        {/* One Card Left Message */}
        {oneCardMessage && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
            <div className="bg-orange-500 text-white text-xl font-bold px-6 py-3 rounded-full shadow-lg animate-pulse border-4 border-orange-300">
              {oneCardMessage}
            </div>
          </div>
        )}

        {/* Collapsible Viewers Panel */}
        <div className="fixed top-20 right-0 z-20 flex items-start">
          <button
            onClick={() => setShowSpectators(!showSpectators)}
            className="bg-white/95 backdrop-blur-sm shadow-lg rounded-l-lg p-2 hover:bg-gray-100 transition-colors border-r-0"
            data-testid="toggle-spectators"
          >
            {showSpectators ? (
              <ChevronRight className="w-4 h-4 text-gray-600" />
            ) : (
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4 text-gray-600" />
                <span className="text-xs font-medium text-gray-600">{spectators.length}</span>
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </div>
            )}
          </button>
          
          {showSpectators && (
            <UICard className="bg-white/95 backdrop-blur-sm shadow-lg rounded-l-lg rounded-r-none mr-0">
              <CardContent className="p-3">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Guests ({spectators.length})
                </div>
                
                {spectators.length === 0 ? (
                  <div className="text-sm text-gray-400 italic">No viewers yet</div>
                ) : (
                  <div className="space-y-2">
                    {spectators.map((spectator: any) => {
                      const isMe = spectator.id === playerId;
                      return (
                        <div key={spectator.id} className="flex items-center space-x-2">
                          <div className={`w-6 h-6 ${isMe ? 'bg-gradient-to-br from-green-400 to-green-600' : 'bg-gray-400'} rounded-full flex items-center justify-center text-white text-xs font-bold`}>
                            {spectator.nickname?.[0]?.toUpperCase()}
                          </div>
                          <span className={`text-sm ${isMe ? 'text-green-600 font-semibold' : 'text-gray-600'}`}>
                            {spectator.nickname}
                            {isMe && " (You)"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </UICard>
          )}
        </div>

        {/* Game Board - Spectator view with face-down cards */}
        <StreamGameBoard
          room={room}
          players={gamePlayers}
          currentPlayerId={undefined}
          isSpectator={true}
          colorChoiceRequested={false}
        />

        {/* Game End Modal */}
        {shouldShowGameEnd && (
          <GameEndModal
            winner={gameEndData?.winner || gameState?.gameEndData?.winner || gamePlayers.find((p: any) => (p.hand?.length || 0) === 0)?.nickname || "Someone"}
            rankings={gameEndData?.rankings || gameState?.gameEndData?.rankings}
            onPlayAgain={() => {
              playAgain();
              setShowGameEnd(false);
              setGameEndData(null);
            }}
            onBackToLobby={() => setLocation("/")}
          />
        )}
      </div>
    );
  }

  // Waiting room view (lobby before game starts)
  return (
    <div className="min-h-screen bg-gradient-to-br from-uno-blue via-uno-purple to-uno-red p-4">
      {streamingHostDisconnected && streamingHostDeadlineMs && (
        <StreamingHostDisconnectBanner 
          deadlineMs={streamingHostDeadlineMs} 
          hostName={streamingHostName || "Host"} 
        />
      )}
      <div className={`max-w-4xl mx-auto ${streamingHostDisconnected ? 'pt-16' : ''}`}>
        <Card className="bg-white/95 backdrop-blur-sm shadow-xl mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-gray-800">
                    Room <span className="font-mono text-uno-blue">{room?.code}</span>
                  </h2>
                  <span className="bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                    <Tv className="w-3 h-3" />
                    SPECTATOR
                  </span>
                  {isConnected && (
                    <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                      CONNECTED
                    </span>
                  )}
                </div>
                <p className="text-gray-600 mt-1">
                  Welcome, <span className="font-semibold">{playerNickname || myPlayer?.nickname || "Guest"}</span>!
                </p>
              </div>
            </div>

            {assignedSlot ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">You've Been Assigned to Slot {assignedSlot}!</span>
                </div>
                <p className="text-green-700 text-sm mt-1">
                  Waiting for the host to start the game. You'll automatically join when it begins.
                </p>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-yellow-800">
                  <Clock className="w-5 h-5" />
                  <span className="font-semibold">Waiting for Host to Assign You</span>
                </div>
                <p className="text-yellow-700 text-sm mt-1">
                  The host ({hostPlayer?.nickname || "waiting..."}) will assign you to a player slot when ready.
                </p>
              </div>
            )}
            
            <div className="text-sm text-gray-600">
              {gamePlayers.length}/4 players assigned
            </div>
          </CardContent>
        </Card>

        <div className="relative w-80 h-80 mx-auto mb-8 bg-white/10 backdrop-blur-sm rounded-full border-2 border-white/20">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-20 h-20 bg-gradient-to-br from-uno-red to-uno-yellow rounded-full flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">UNO</span>
            </div>
          </div>

          {[0, 1, 2, 3].map((position) => {
            const player = getPlayerAtPosition(position);
            const isMe = player?.id === playerId;
            
            return (
              <div
                key={position}
                className={`absolute ${getPositionClass(position)} w-20 h-20`}
              >
                {player ? (
                  <div className={`w-20 h-20 bg-gradient-to-br ${isMe ? 'from-green-500 to-green-700' : 'from-uno-blue to-uno-purple'} rounded-full flex flex-col items-center justify-center text-white font-bold shadow-lg border-4 ${isMe ? 'border-green-300' : 'border-white/20'}`}>
                    <div className="text-lg">{player.nickname[0].toUpperCase()}</div>
                    <div className="text-xs font-semibold truncate max-w-full px-1 leading-tight">{player.nickname}</div>
                    {player.id === room?.hostId && (
                      <Crown className="absolute -top-2 left-1/2 -translate-x-1/2 w-5 h-5 text-yellow-400 fill-yellow-400" />
                    )}
                    <div className={`absolute -top-1 -right-1 w-6 h-6 rounded-full border-2 border-white ${
                      player.isOnline ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gray-300/50 border-4 border-white/30 flex items-center justify-center">
                    <span className="text-gray-600 text-xs">Slot {position + 1}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Viewers Panel - Always shown */}
        <Card className="bg-white/95 backdrop-blur-sm shadow-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-gray-700 mb-3">
              <Users className="w-5 h-5" />
              <span className="font-semibold">Guests ({spectators.length})</span>
            </div>
            {spectators.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {spectators.map((spectator: any) => {
                  const isMe = spectator.id === playerId;
                  return (
                    <div 
                      key={spectator.id} 
                      className={`flex items-center gap-2 ${isMe ? 'bg-green-100 border border-green-300' : 'bg-gray-100'} px-3 py-2 rounded-full`}
                    >
                      <div className={`w-6 h-6 ${isMe ? 'bg-gradient-to-br from-green-400 to-green-600' : 'bg-gradient-to-br from-purple-400 to-purple-600'} rounded-full flex items-center justify-center text-white font-bold text-xs`}>
                        {spectator.nickname?.[0]?.toUpperCase()}
                      </div>
                      <span className="text-sm text-gray-700">
                        {spectator.nickname}
                        {isMe && <span className="text-green-600 font-semibold ml-1">(You)</span>}
                      </span>
                      <div className={`w-2 h-2 rounded-full ${spectator.isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-400 text-sm italic">No viewers yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
