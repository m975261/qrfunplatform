import { useState, useEffect, useRef } from "react";
import GameCard from "@/components/game/Card";

interface StreamGameBoardProps {
  room: any;
  players: any[];
  currentPlayerId?: string;
  onPlayCard?: (cardIndex: number) => void;
  onDrawCard?: () => void;
  onCallUno?: () => void;
  onChooseColor?: (color: string) => void;
  isSpectator?: boolean;
  colorChoiceRequested?: boolean;
  cardAnimation?: { type: string; playerId?: string } | null;
}

interface FlyingCard {
  id: string;
  card: any;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  type: 'play' | 'draw';
  animating: boolean;
}

export default function StreamGameBoard({
  room,
  players,
  currentPlayerId,
  onPlayCard,
  onDrawCard,
  onCallUno,
  onChooseColor,
  isSpectator = false,
  colorChoiceRequested = false,
  cardAnimation = null,
}: StreamGameBoardProps) {
  const [playingCardIndex, setPlayingCardIndex] = useState<number | null>(null);
  const [drawingCard, setDrawingCard] = useState(false);
  const [flyingCards, setFlyingCards] = useState<FlyingCard[]>([]);
  const [prevHandLength, setPrevHandLength] = useState(0);
  const deckRef = useRef<HTMLDivElement>(null);
  const handContainerRef = useRef<HTMLDivElement>(null);

  const gamePlayers = players
    .filter((p: any) => !p.isSpectator && p.position !== null && p.position !== undefined)
    .sort((a: any, b: any) => (a.position || 0) - (b.position || 0));

  const myPlayer = players.find((p: any) => p.id === currentPlayerId);
  const myHand = myPlayer?.hand || [];
  const currentPlayerIndex = room?.currentPlayerIndex ?? 0;
  const currentGamePlayer = gamePlayers[currentPlayerIndex];
  const topCard = room?.topCard || room?.discardPile?.[0];
  const currentColor = room?.currentColor;
  const pendingDraw = room?.pendingDraw ?? 0;

  const isMyTurn = currentGamePlayer?.id === myPlayer?.id && room?.status === "playing";

  // Detect when a card is drawn (hand increases)
  useEffect(() => {
    if (myHand.length > prevHandLength && prevHandLength > 0) {
      const newCard = myHand[myHand.length - 1];
      if (deckRef.current && handContainerRef.current) {
        const deckRect = deckRef.current.getBoundingClientRect();
        const handRect = handContainerRef.current.getBoundingClientRect();
        
        const cardId = `draw-${Date.now()}`;
        const flyingCard: FlyingCard = {
          id: cardId,
          card: newCard,
          startX: deckRect.left + deckRect.width / 2,
          startY: deckRect.top + deckRect.height / 2,
          endX: handRect.left + handRect.width / 2,
          endY: handRect.top + 20,
          type: 'draw',
          animating: false
        };
        
        setFlyingCards(prev => [...prev, flyingCard]);
        
        // Start animation after mounting
        requestAnimationFrame(() => {
          setFlyingCards(prev => prev.map(c => c.id === cardId ? { ...c, animating: true } : c));
        });
        
        setTimeout(() => {
          setFlyingCards(prev => prev.filter(c => c.id !== cardId));
        }, 450);
      }
    }
    setPrevHandLength(myHand.length);
  }, [myHand.length, prevHandLength, myHand]);

  const getPlayerAtPosition = (position: number) => {
    return gamePlayers.find((player: any) => player.position === position) || null;
  };

  const getPlayerAvatar = (id: string) => {
    const savedAvatar = localStorage.getItem(`avatar_${id}`);
    if (savedAvatar === 'male') return '👨';
    if (savedAvatar === 'female') return '👩';
    return '👨';
  };

  const isCardPlayable = (card: any) => {
    if (!isMyTurn || !topCard || isSpectator) return false;
    if (pendingDraw > 0) return false;
    if (card.type === "wild" || card.type === "wild4") return true;
    if (currentColor && card.color === currentColor) return true;
    if (card.color === topCard.color) return true;
    if (card.type === "number" && topCard.type === "number" && card.number === topCard.number) return true;
    if (card.type !== "number" && topCard.type !== "number" && card.type === topCard.type) return true;
    return false;
  };

  const handleCardClick = (cardIndex: number, card: any, cardElement?: HTMLDivElement) => {
    if (!isCardPlayable(card) || !onPlayCard) return;
    
    setPlayingCardIndex(cardIndex);
    
    // Create flying card animation
    if (cardElement) {
      const cardRect = cardElement.getBoundingClientRect();
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2 - 50;
      
      const cardId = `play-${Date.now()}`;
      const flyingCard: FlyingCard = {
        id: cardId,
        card: card,
        startX: cardRect.left + cardRect.width / 2,
        startY: cardRect.top,
        endX: centerX,
        endY: centerY,
        type: 'play',
        animating: false
      };
      
      setFlyingCards(prev => [...prev, flyingCard]);
      
      // Start animation after mounting
      requestAnimationFrame(() => {
        setFlyingCards(prev => prev.map(c => c.id === cardId ? { ...c, animating: true } : c));
      });
      
      setTimeout(() => {
        setFlyingCards(prev => prev.filter(c => c.id !== cardId));
      }, 400);
    }
    
    setTimeout(() => {
      onPlayCard(cardIndex);
      setPlayingCardIndex(null);
    }, 350);
  };

  const handleDraw = () => {
    if (!isMyTurn || !onDrawCard) return;
    setDrawingCard(true);
    onDrawCard();
    setTimeout(() => setDrawingCard(false), 400);
  };

  const handleColorSelect = (color: string) => {
    if (onChooseColor) {
      onChooseColor(color);
    }
  };

  const PlayerSlot = ({ player, position, isCurrentTurn }: { player: any; position: number; isCurrentTurn: boolean }) => {
    const cardCount = player?.hand?.length || player?.cardCount || 0;
    const isOnline = player?.isOnline !== false;
    const isAnimating = cardAnimation?.playerId === player?.id;
    const displayCardCount = Math.min(cardCount, 10);

    const positionStyles: { [key: number]: string } = {
      0: "top-4 left-1/2 -translate-x-1/2",
      1: "right-4 top-1/2 -translate-y-1/2",
      2: "bottom-20 left-1/2 -translate-x-1/2",
      3: "left-4 top-1/2 -translate-y-1/2",
    };

    const getCardFanStyle = (pos: number, cardIndex: number, totalCards: number) => {
      const fanSpread = totalCards > 1 ? 8 : 0;
      const centerOffset = (totalCards - 1) / 2;
      const rotation = (cardIndex - centerOffset) * fanSpread;
      
      if (pos === 0) {
        return { transform: `rotate(${rotation}deg) translateY(-2px)`, marginLeft: cardIndex > 0 ? '-8px' : '0' };
      } else if (pos === 1) {
        return { transform: `rotate(${rotation + 90}deg)`, marginTop: cardIndex > 0 ? '-8px' : '0' };
      } else if (pos === 2) {
        return { transform: `rotate(${rotation + 180}deg) translateY(2px)`, marginLeft: cardIndex > 0 ? '-8px' : '0' };
      } else {
        return { transform: `rotate(${rotation - 90}deg)`, marginTop: cardIndex > 0 ? '-8px' : '0' };
      }
    };

    const getContainerLayout = (pos: number) => {
      if (pos === 0 || pos === 2) {
        return "flex flex-row items-center";
      }
      return "flex flex-col items-center";
    };

    const getSlotLayout = (pos: number) => {
      if (pos === 0) return "flex flex-col items-center";
      if (pos === 1) return "flex flex-row items-center";
      if (pos === 2) return "flex flex-col-reverse items-center";
      return "flex flex-row-reverse items-center";
    };

    if (!player) {
      return (
        <div className={`absolute ${positionStyles[position]} z-10`}>
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gray-700/50 border-2 border-dashed border-gray-500 flex items-center justify-center">
            <span className="text-gray-400 text-[10px]">Empty</span>
          </div>
        </div>
      );
    }

    const renderCardFan = () => (
      <div className={`relative ${getContainerLayout(position)}`}>
        {Array.from({ length: displayCardCount }).map((_, i) => (
          <div
            key={i}
            className={`w-5 h-7 md:w-6 md:h-9 bg-gradient-to-br from-red-600 to-red-800 rounded-sm border border-red-400 shadow-md transition-all ${
              isAnimating && cardAnimation?.type === 'play' ? 'animate-pulse scale-90' : ''
            }`}
            style={{
              ...getCardFanStyle(position, i, displayCardCount),
              zIndex: i,
            }}
          >
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-yellow-300 text-[5px] md:text-[6px] font-bold">UNO</span>
            </div>
          </div>
        ))}
        {cardCount > 10 && (
          <div className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[6px] px-1 rounded-full font-bold z-20">
            +{cardCount - 10}
          </div>
        )}
      </div>
    );

    const renderAvatar = () => (
      <div className="relative flex flex-col items-center">
        <div
          className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-lg md:text-xl shadow-lg border-2 transition-all ${
            isCurrentTurn
              ? "bg-gradient-to-br from-green-400 to-green-600 border-green-300 ring-2 ring-green-400/50 animate-pulse"
              : "bg-gradient-to-br from-blue-500 to-blue-700 border-blue-400"
          }`}
        >
          {getPlayerAvatar(player.id)}
        </div>
        <div
          className={`mt-0.5 px-1.5 py-0.5 rounded-full text-[8px] md:text-[10px] font-bold shadow-lg transition-all max-w-[60px] truncate ${
            isCurrentTurn ? "bg-green-500 text-white" : "bg-black/70 text-white"
          }`}
        >
          {player.nickname}
        </div>
        <div
          className={`absolute top-0 -right-0.5 w-2 h-2 md:w-2.5 md:h-2.5 rounded-full border border-white ${
            isOnline ? "bg-green-500" : "bg-red-500"
          }`}
        />
        {player.id === room?.hostId && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px]">👑</div>
        )}
        <div className="absolute -bottom-1 -left-1 bg-slate-800 text-white text-[7px] md:text-[8px] px-1 py-0.5 rounded-full font-bold shadow border border-slate-600">
          {cardCount}
        </div>
        {cardCount <= 1 && player.hasCalledUno && (
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[6px] px-1 py-0.5 rounded-full font-bold animate-pulse whitespace-nowrap">
            UNO!
          </div>
        )}
        {player.finishPosition && (
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[6px] px-1 py-0.5 rounded-full font-bold whitespace-nowrap">
            {player.finishPosition === 1 ? "1ST" : player.finishPosition === 2 ? "2ND" : player.finishPosition === 3 ? "3RD" : `${player.finishPosition}TH`}
          </div>
        )}
      </div>
    );

    return (
      <div className={`absolute ${positionStyles[position]} z-10`}>
        <div className={`${getSlotLayout(position)} gap-1 transition-all duration-300 ${isCurrentTurn ? "scale-105" : ""}`}>
          {position === 0 && (
            <>
              {renderCardFan()}
              {renderAvatar()}
            </>
          )}
          {position === 1 && (
            <>
              {renderAvatar()}
              {renderCardFan()}
            </>
          )}
          {position === 2 && (
            <>
              {renderAvatar()}
              {renderCardFan()}
            </>
          )}
          {position === 3 && (
            <>
              {renderCardFan()}
              {renderAvatar()}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full h-full min-h-[100svh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
      <style>{`
        @keyframes cardPlayUp { 
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-100px) scale(0.6); opacity: 0; }
        }
        @keyframes cardDraw { 
          0% { transform: translateY(-30px) scale(0.8); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes flyToCenter {
          0% { opacity: 1; }
          100% { opacity: 0.8; }
        }
        @keyframes flyToHand {
          0% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        .animate-card-play { animation: cardPlayUp 0.35s ease-out forwards; }
        .animate-card-draw { animation: cardDraw 0.3s ease-out forwards; }
        .flying-card { 
          position: fixed;
          pointer-events: none;
          z-index: 100;
          transition: all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
      `}</style>

      {/* Flying Cards Animation Overlay */}
      {flyingCards.map((fc) => {
        const x = fc.animating ? fc.endX : fc.startX;
        const y = fc.animating ? fc.endY : fc.startY;
        const scale = fc.animating ? (fc.type === 'play' ? 0.9 : 0.7) : (fc.type === 'play' ? 0.7 : 0.5);
        
        return (
          <div
            key={fc.id}
            className="fixed pointer-events-none z-[100]"
            style={{
              left: x,
              top: y,
              transform: `translate(-50%, -50%) scale(${scale})`,
              opacity: fc.animating ? 1 : 0.7,
              transition: 'all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            }}
          >
            <GameCard card={fc.card} size="medium" interactive={false} onClick={() => {}} />
          </div>
        );
      })}

      {room?.status === "playing" && currentGamePlayer && (
        <div className={`fixed top-2 left-1/2 -translate-x-1/2 z-50 px-3 py-1 md:px-4 md:py-1.5 rounded-full shadow-lg border-2 transition-all ${
          isMyTurn 
            ? (pendingDraw > 0 ? 'bg-red-600 border-red-400 animate-pulse' : 'bg-green-600 border-green-400 animate-pulse')
            : 'bg-yellow-600/90 border-yellow-400'
        }`}>
          <div className="text-white font-bold text-[10px] md:text-xs text-center flex items-center gap-1">
            {isMyTurn ? (
              pendingDraw > 0 ? (
                <span>⚠️ DRAW {pendingDraw}!</span>
              ) : (
                <span>⭐ YOUR TURN</span>
              )
            ) : (
              <span>🎮 {currentGamePlayer.nickname}'s turn</span>
            )}
          </div>
        </div>
      )}

      <div className="absolute inset-0 flex items-center justify-center p-2 pt-10 pb-28 md:pb-36">
        <div className="relative w-full max-w-sm md:max-w-lg aspect-square">
          <div className="absolute inset-[20%] rounded-full bg-gradient-to-br from-slate-700 to-slate-800 shadow-2xl border-4 border-slate-600" />

          {[0, 1, 2, 3].map((position) => {
            const player = getPlayerAtPosition(position);
            const isCurrentTurn = currentGamePlayer?.id === player?.id;
            return (
              <PlayerSlot
                key={position}
                player={player}
                position={position}
                isCurrentTurn={isCurrentTurn}
              />
            );
          })}

          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="flex items-center gap-2 md:gap-3">
              <div
                ref={deckRef}
                className={`w-10 h-14 md:w-14 md:h-20 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg border-2 border-blue-400 shadow-xl flex items-center justify-center cursor-pointer hover:scale-105 transition-transform ${
                  drawingCard ? "animate-pulse scale-95" : ""
                } ${isMyTurn && !isSpectator ? "ring-2 ring-green-400" : ""}`}
                onClick={handleDraw}
              >
                <div className="text-white text-[8px] md:text-xs font-bold text-center">
                  DRAW
                </div>
              </div>

              {topCard && (
                <div className="transform scale-75 md:scale-100">
                  <GameCard card={topCard} size="large" interactive={false} onClick={() => {}} />
                </div>
              )}
            </div>

            {currentColor && (topCard?.type === "wild" || topCard?.type === "wild4") && (
              <div className="absolute -bottom-6 md:-bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center">
                <div
                  className={`w-5 h-5 md:w-6 md:h-6 rounded-full border-2 border-white shadow-lg ${
                    currentColor === "red" ? "bg-red-500"
                    : currentColor === "yellow" ? "bg-yellow-500"
                    : currentColor === "blue" ? "bg-blue-500"
                    : currentColor === "green" ? "bg-green-500"
                    : "bg-gray-500"
                  }`}
                />
                <span className="text-[8px] md:text-[10px] text-white font-bold mt-0.5 uppercase">{currentColor}</span>
              </div>
            )}
          </div>

          {room?.direction && room?.status === "playing" && (
            <div className="absolute top-2 left-2 z-30">
              <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full border-2 border-yellow-300 shadow-lg w-8 h-8 md:w-10 md:h-10 flex items-center justify-center">
                <span className="text-white text-sm md:text-lg">
                  {room.direction === "clockwise" ? "↻" : "↺"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {!isSpectator && myHand.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-black/95 to-black/70">
          <div className="container mx-auto px-2 py-2 relative">
            {onCallUno && (
              <div className="absolute top-1 right-2 z-50">
                <button
                  onClick={onCallUno}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold px-2 py-1 rounded text-[10px] md:text-xs shadow-lg animate-pulse border border-red-500"
                >
                  🔥 UNO!
                </button>
              </div>
            )}

            <div className="flex justify-center overflow-x-auto pb-1 scrollbar-hide" ref={handContainerRef}>
              <div className="flex items-end gap-0.5 px-2">
                {myHand.map((card: any, index: number) => {
                  const playable = isCardPlayable(card);
                  const isPlaying = playingCardIndex === index;
                  return (
                    <div
                      key={index}
                      className={`flex-shrink-0 transition-all duration-200 ${
                        playable ? "hover:-translate-y-3 cursor-pointer hover:z-50" : "opacity-50"
                      } ${isPlaying ? "scale-110 opacity-0 -translate-y-8" : ""}`}
                      style={{
                        marginLeft: index > 0 ? "-0.75rem" : "0",
                        zIndex: isPlaying ? 100 : index,
                        transition: isPlaying ? 'all 0.3s ease-out' : 'all 0.2s ease',
                      }}
                      onClick={(e) => handleCardClick(index, card, e.currentTarget as HTMLDivElement)}
                    >
                      <div className="transform scale-[0.6] md:scale-75 lg:scale-90 origin-bottom">
                        <GameCard
                          card={card}
                          size="medium"
                          interactive={playable}
                          onClick={() => {}}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {colorChoiceRequested && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
          <div className="bg-slate-800 rounded-xl p-4 md:p-6 border-2 border-slate-600 shadow-2xl">
            <h3 className="text-white text-base md:text-lg font-bold text-center mb-3">Choose Color</h3>
            <div className="grid grid-cols-2 gap-2 md:gap-3">
              {["red", "yellow", "green", "blue"].map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorSelect(color)}
                  className={`w-12 h-12 md:w-16 md:h-16 rounded-full border-3 border-white shadow-lg transform hover:scale-110 transition-transform ${
                    color === "red" ? "bg-red-500"
                    : color === "yellow" ? "bg-yellow-500"
                    : color === "green" ? "bg-green-500"
                    : "bg-blue-500"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
