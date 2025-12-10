import { useEffect, useState } from "react";
import { useRoute, useSearch, useLocation } from "wouter";
import { Card as UICard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tv, Home, Users, Share2, MessageCircle } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { useToast } from "@/hooks/use-toast";
import StreamGameBoard from "@/components/game/StreamGameBoard";
import ColorPickerModal from "@/components/game/ColorPickerModal";

export default function StreamPlayerPage() {
  const [, playerParams] = useRoute("/stream/:roomId/player/:slot");
  const [, hostParams] = useRoute("/stream/:roomId/host/game");
  const search = useSearch();
  const [, setLocation] = useLocation();
  
  const roomId = playerParams?.roomId || hostParams?.roomId;
  const slot = playerParams?.slot ? parseInt(playerParams.slot) : 1;
  const isHostGame = !!hostParams?.roomId;
  const roomCode = new URLSearchParams(search).get('code') || undefined;
  
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [handRefreshKey, setHandRefreshKey] = useState(0);
  const [cardAnimation, setCardAnimation] = useState<{
    card: any;
    from: 'player' | 'opponent' | 'deck';
    to: 'discard' | 'player';
    show: boolean;
  } | null>(null);
  const { toast } = useToast();
  
  const { 
    gameState, 
    setGameState,
    joinRoom, 
    playCard, 
    drawCard, 
    chooseColor,
    callUno,
    isConnected 
  } = useSocket();

  const playerId = localStorage.getItem("playerId");

  useEffect(() => {
    if (isConnected && roomId && playerId) {
      joinRoom(playerId, roomId);
    }
  }, [isConnected, roomId, playerId, joinRoom]);

  useEffect(() => {
    if (gameState?.colorChoiceRequested || (gameState?.room?.waitingForColorChoice === playerId)) {
      setShowColorPicker(true);
    }
  }, [gameState?.colorChoiceRequested, gameState?.room?.waitingForColorChoice, playerId]);

  const room = gameState?.room;
  const players = gameState?.players || [];
  
  const myPlayer = players.find((p: any) => p.id === playerId);
  const myHand = myPlayer?.hand || [];
  const isMyTurn = room?.currentPlayerIndex === myPlayer?.position;
  
  const gamePlayers = players.filter((p: any) => 
    !p.isSpectator && p.position !== null && p.position !== undefined
  );

  const topCard = room?.topCard || room?.discardPile?.[room?.discardPile?.length - 1];
  const currentColor = room?.currentColor;

  const canPlayCard = (card: any) => {
    if (!topCard || !isMyTurn) return false;
    if (card.type === 'wild' || card.type === 'wild4') return true;
    if (card.color === currentColor) return true;
    if (card.color === topCard.color) return true;
    if (card.type === 'number' && topCard.type === 'number' && card.number === topCard.number) return true;
    if (card.type === topCard.type && card.type !== 'number') return true;
    return false;
  };

  const handlePlayCard = (cardIndex: number) => {
    const card = myHand[cardIndex];
    if (!card || !canPlayCard(card)) return;
    
    setCardAnimation({
      card: { ...card },
      from: 'player',
      to: 'discard',
      show: true
    });
    setTimeout(() => setCardAnimation(null), 400);
    
    playCard(cardIndex);
  };

  const handleColorChoice = (color: string) => {
    chooseColor(color as 'red' | 'yellow' | 'green' | 'blue');
    setShowColorPicker(false);
    
    setGameState((prev: any) => ({
      ...prev,
      colorChoiceRequested: false,
      selectedColor: color,
      room: {
        ...prev?.room,
        currentColor: color,
        waitingForColorChoice: null
      },
      forceRefresh: Math.random(),
    }));
    
    setHandRefreshKey(prev => prev + 1);
    setTimeout(() => setHandRefreshKey(prev => prev + 1), 1);
    setTimeout(() => setHandRefreshKey(prev => prev + 1), 5);
    setTimeout(() => setHandRefreshKey(prev => prev + 1), 10);
  };

  const handleDrawCard = () => {
    if (isMyTurn) {
      setCardAnimation({
        card: null,
        from: 'deck',
        to: 'player',
        show: true
      });
      setTimeout(() => setCardAnimation(null), 350);
      drawCard();
    }
  };

  const handleCallUno = () => {
    if (!myPlayer?.hasCalledUno) {
      callUno();
      toast({ title: "UNO!", duration: 1500 });
    }
  };

  if (!room || room.status !== 'playing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <UICard className="bg-slate-800/90 backdrop-blur-sm shadow-xl border-slate-700 p-8 text-center">
          <Tv className="w-16 h-16 mx-auto mb-4 text-purple-400" />
          <h2 className="text-2xl font-bold text-white mb-2">Waiting for Game to Start</h2>
          <p className="text-gray-400">You are {isHostGame ? 'the Host' : `Player ${slot}`}</p>
          <p className="text-sm text-gray-500 mt-2">The host will start the game soon...</p>
        </UICard>
      </div>
    );
  }

  const streamingHostDisconnected = gameState?.streamingHostDisconnected;
  const streamingHostDeadlineMs = gameState?.streamingHostDeadlineMs;
  const streamingHostName = gameState?.streamingHostName;

  return (
    <div className="min-h-screen relative">
      <div className="fixed top-2 left-2 right-2 z-50">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="bg-slate-800/90 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="bg-purple-600 px-2 py-1 rounded-full flex items-center gap-1">
                <Tv className="w-3 h-3 text-white" />
                <span className="text-white text-xs font-bold">{isHostGame ? 'HOST' : `P${slot}`}</span>
              </div>
              <span className="font-mono text-sm text-blue-400">{room?.code}</span>
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3 text-slate-400" />
                <span className="text-xs text-slate-300">{gamePlayers.length}</span>
              </div>
            </div>
          </div>

          <div className="flex space-x-1 sm:space-x-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="bg-green-900/50 border-green-700 text-green-300 hover:bg-green-800/50 p-2 sm:px-3"
              onClick={() => {
                const baseUrl = window.location.origin;
                const joinUrl = `${baseUrl}?room=${room.code}`;
                navigator.clipboard.writeText(joinUrl).then(() => {
                  toast({
                    title: "Link Copied!",
                    description: "Room join link copied to clipboard",
                  });
                });
              }}
            >
              <Share2 className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline sm:ml-2">Share</span>
            </Button>
            
            <Button
              variant="outline" 
              size="sm"
              className="bg-blue-900/50 border-blue-700 text-blue-300 hover:bg-blue-800/50 px-2 sm:px-3"
              onClick={() => {
                localStorage.removeItem("currentRoomId");
                localStorage.removeItem("playerId");
                localStorage.removeItem("playerNickname");
                window.location.replace("/");
              }}
            >
              <Home className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
              <span className="hidden sm:inline">Home</span>
            </Button>
          </div>
        </div>
      </div>

      <StreamGameBoard
        room={room}
        players={players}
        currentPlayerId={playerId}
        isMyTurn={isMyTurn}
        onPlayCard={handlePlayCard}
        onDrawCard={handleDrawCard}
        onCallUno={handleCallUno}
        canPlayCard={canPlayCard}
        streamingHostDisconnected={streamingHostDisconnected}
        streamingHostDeadlineMs={streamingHostDeadlineMs}
        streamingHostName={streamingHostName}
        handRefreshKey={handRefreshKey}
        cardAnimation={cardAnimation}
      />

      {showColorPicker && (
        <ColorPickerModal
          onChooseColor={handleColorChoice}
          onClose={() => setShowColorPicker(false)}
        />
      )}
    </div>
  );
}
