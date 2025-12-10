import { useEffect, useState } from "react";
import { useRoute, useSearch, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Tv } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { useToast } from "@/hooks/use-toast";
import GameCard from "@/components/game/Card";
import { Button } from "@/components/ui/button";

export default function StreamPlayerPage() {
  // Try both player slot route and host game route
  const [, playerParams] = useRoute("/stream/:roomId/player/:slot");
  const [, hostParams] = useRoute("/stream/:roomId/host/game");
  const search = useSearch();
  const [, setLocation] = useLocation();
  
  // Determine roomId and slot from either route
  const roomId = playerParams?.roomId || hostParams?.roomId;
  const slot = playerParams?.slot ? parseInt(playerParams.slot) : 1; // Host is slot 1 (position 0)
  const isHostGame = !!hostParams?.roomId;
  const roomCode = new URLSearchParams(search).get('code') || undefined;
  
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [colorChoiceRequested, setColorChoiceRequested] = useState(false);
  const { toast } = useToast();
  
  const { 
    gameState, 
    joinRoom, 
    playCard, 
    drawCard, 
    chooseColor,
    callUno,
    isConnected 
  } = useSocket();

  // Use the generic playerId as the source of truth - it's always set fresh on join
  // All players joining a streaming room get a fresh playerId in localStorage
  const playerId = localStorage.getItem("playerId");

  useEffect(() => {
    if (isConnected && roomId && playerId) {
      joinRoom(playerId, roomId);
    }
  }, [isConnected, roomId, playerId, joinRoom]);

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
    if (card.value === topCard.value) return true;
    return false;
  };

  const handlePlayCard = (cardIndex: number) => {
    const card = myHand[cardIndex];
    if (!card || !canPlayCard(card)) return;
    
    if (card.type === 'wild' || card.type === 'wild4') {
      setSelectedCardIndex(cardIndex);
      setColorChoiceRequested(true);
    } else {
      playCard(cardIndex);
    }
  };

  const handleChooseColor = (color: string) => {
    if (selectedCardIndex !== null) {
      chooseColor(color as 'red' | 'yellow' | 'green' | 'blue');
      playCard(selectedCardIndex);
      setSelectedCardIndex(null);
      setColorChoiceRequested(false);
    }
  };

  const handleDrawCard = () => {
    if (isMyTurn) {
      drawCard();
    }
  };

  const handleCallUno = () => {
    callUno();
    toast({ title: "UNO!", duration: 1500 });
  };

  if (!room || room.status !== 'playing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-uno-blue via-uno-purple to-uno-red flex items-center justify-center p-4">
        <Card className="bg-white/95 p-8 text-center">
          <Tv className="w-16 h-16 mx-auto mb-4 text-purple-600" />
          <h2 className="text-2xl font-bold mb-2">Waiting for Game to Start</h2>
          <p className="text-gray-600">You are {isHostGame ? 'the Host' : `Player ${slot}`}</p>
          <p className="text-sm text-gray-500 mt-2">The host will start the game soon...</p>
        </Card>
      </div>
    );
  }

  const currentPlayerIndex = room.currentPlayerIndex;
  const currentGamePlayer = gamePlayers.find((p: any) => p.position === currentPlayerIndex);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-slate-900/90 backdrop-blur-sm border-b border-slate-700">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600 px-3 py-1 rounded-full flex items-center gap-2">
              <Tv className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-bold">{isHostGame ? 'HOST' : `PLAYER ${slot}`}</span>
            </div>
            <span className="text-white font-mono">{room?.code}</span>
          </div>
          <div className="flex items-center gap-2">
            {myHand.length === 2 && (
              <Button
                onClick={handleCallUno}
                className="bg-uno-red text-white font-bold animate-pulse"
              >
                UNO!
              </Button>
            )}
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${isMyTurn ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-300'}`}>
              {isMyTurn ? "YOUR TURN" : `${currentGamePlayer?.nickname}'s Turn`}
            </span>
          </div>
        </div>
      </div>

      {/* Turn Banner */}
      {isMyTurn && (
        <div className="fixed top-14 left-0 right-0 z-30 flex justify-center pointer-events-none">
          <div className="bg-gradient-to-r from-green-500/90 to-emerald-500/90 text-white px-6 py-2 rounded-full shadow-lg animate-pulse">
            <span className="font-bold">It's Your Turn!</span>
          </div>
        </div>
      )}

      {/* Game Area */}
      <section className="relative w-full min-h-screen pt-24 pb-48 flex flex-col items-center justify-center">
        {/* Discard Pile */}
        <div className="relative mb-8">
          <div className="w-40 h-40 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border-4 border-slate-600 shadow-2xl flex items-center justify-center">
            {topCard ? (
              <GameCard card={topCard} size="large" interactive={false} />
            ) : (
              <div className="w-20 h-28 bg-gradient-to-br from-red-500 to-red-700 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold">UNO</span>
              </div>
            )}
          </div>
          
          {/* Current Color */}
          {currentColor && (
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 px-3 py-1 rounded-full">
              <div
                className={`w-5 h-5 rounded-full border-2 border-white ${
                  currentColor === 'red' ? 'bg-red-500'
                  : currentColor === 'yellow' ? 'bg-yellow-500'
                  : currentColor === 'blue' ? 'bg-blue-500'
                  : currentColor === 'green' ? 'bg-green-500'
                  : 'bg-gray-500'
                }`}
              />
              <span className="text-sm text-white font-bold uppercase">{currentColor}</span>
            </div>
          )}

          {/* Direction */}
          <div className="absolute -top-2 -left-2 w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center border-2 border-yellow-300">
            <span className="text-lg">{room.direction === 'clockwise' ? '↻' : '↺'}</span>
          </div>
        </div>

        {/* Draw Button */}
        {isMyTurn && (
          <Button
            onClick={handleDrawCard}
            className="mb-8 bg-gradient-to-br from-red-600 to-red-800 text-white font-bold px-6 py-3 rounded-xl"
          >
            Draw Card
          </Button>
        )}

        {/* Other Players */}
        <div className="flex flex-wrap justify-center gap-4 mb-8 px-4">
          {gamePlayers.filter((p: any) => p.id !== playerId).map((player: any) => {
            const isPlayerTurn = currentPlayerIndex === player.position;
            const cardCount = player.cardCount || player.hand?.length || 0;
            return (
              <div
                key={player.id}
                className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                  isPlayerTurn
                    ? 'bg-green-500 text-white ring-2 ring-green-300'
                    : 'bg-slate-700 text-gray-300'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-uno-blue to-uno-purple flex items-center justify-center text-white font-bold text-sm">
                  {player.nickname[0].toUpperCase()}
                </div>
                <span className="font-medium">{player.nickname}</span>
                <span className="text-xs bg-black/30 px-2 py-0.5 rounded-full">{cardCount} 🎴</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* My Hand - Fixed at Bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-sm border-t border-slate-700 p-4">
        <div className="flex justify-center gap-2 overflow-x-auto pb-2">
          {myHand.map((card: any, index: number) => {
            const isPlayable = canPlayCard(card);
            return (
              <button
                key={index}
                onClick={() => isPlayable && handlePlayCard(index)}
                className={`flex-shrink-0 transition-transform ${
                  isPlayable && isMyTurn
                    ? 'hover:scale-110 hover:-translate-y-2 cursor-pointer'
                    : 'opacity-60 cursor-not-allowed'
                }`}
                disabled={!isPlayable || !isMyTurn}
              >
                <GameCard card={card} size="medium" interactive={isPlayable && isMyTurn} />
              </button>
            );
          })}
        </div>
        <div className="text-center text-xs text-gray-400 mt-2">
          {myHand.length} cards in hand
        </div>
      </div>

      {/* Color Choice Modal */}
      {colorChoiceRequested && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
          <Card className="bg-white p-6 rounded-2xl shadow-2xl">
            <h3 className="text-xl font-bold text-center mb-4">Choose a Color</h3>
            <div className="grid grid-cols-2 gap-4">
              {['red', 'yellow', 'green', 'blue'].map((color) => (
                <button
                  key={color}
                  onClick={() => handleChooseColor(color)}
                  className={`w-20 h-20 rounded-xl border-4 border-white shadow-lg transition-transform hover:scale-110 ${
                    color === 'red' ? 'bg-red-500'
                    : color === 'yellow' ? 'bg-yellow-500'
                    : color === 'green' ? 'bg-green-500'
                    : 'bg-blue-500'
                  }`}
                />
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
