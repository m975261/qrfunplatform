import { useState } from "react";
import GameCard from "@/components/game/Card";

interface StreamGameBoardProps {
  room: any;
  players: any[];
  currentPlayerId?: string;
  onPlayCard?: (cardId: string, color?: string) => void;
  onDrawCard?: () => void;
  onCallUno?: () => void;
  isSpectator?: boolean;
}

export default function StreamGameBoard({
  room,
  players,
  currentPlayerId,
  onPlayCard,
  onDrawCard,
  onCallUno,
  isSpectator = false,
}: StreamGameBoardProps) {
  const [playingCardId, setPlayingCardId] = useState<string | null>(null);
  const [drawingCard, setDrawingCard] = useState(false);
  const [colorPickerCard, setColorPickerCard] = useState<any>(null);

  const gamePlayers = players
    .filter((p: any) => !p.isSpectator && p.position !== null && p.position !== undefined)
    .sort((a: any, b: any) => (a.position || 0) - (b.position || 0));

  const myPlayer = players.find((p: any) => p.id === currentPlayerId);
  const myHand = myPlayer?.hand || [];
  const currentPlayerIndex = room?.currentPlayerIndex;
  const currentGamePlayer = gamePlayers.find((p: any) => p.position === currentPlayerIndex);
  const topCard = room?.topCard || room?.discardPile?.[room?.discardPile?.length - 1];
  const currentColor = room?.currentColor;
  const pendingDraw = room?.pendingDraw ?? 0;

  const isMyTurn = myPlayer?.position === currentPlayerIndex && room?.status === "playing";

  const getPlayerAtPosition = (position: number) => {
    return gamePlayers.find((player: any) => player.position === position) || null;
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

  const handleCardClick = (card: any) => {
    if (!isCardPlayable(card) || !onPlayCard) return;
    if (card.type === "wild" || card.type === "wild4") {
      setColorPickerCard(card);
      return;
    }
    setPlayingCardId(card.id);
    setTimeout(() => {
      onPlayCard(card.id);
      setPlayingCardId(null);
    }, 300);
  };

  const handleColorSelect = (color: string) => {
    if (colorPickerCard && onPlayCard) {
      setPlayingCardId(colorPickerCard.id);
      setTimeout(() => {
        onPlayCard(colorPickerCard.id, color);
        setPlayingCardId(null);
        setColorPickerCard(null);
      }, 300);
    }
  };

  const handleDraw = () => {
    if (!isMyTurn || !onDrawCard) return;
    setDrawingCard(true);
    onDrawCard();
    setTimeout(() => setDrawingCard(false), 400);
  };

  const PlayerSilhouette = ({ player, position, isCurrentTurn }: { player: any; position: number; isCurrentTurn: boolean }) => {
    const cardCount = player?.hand?.length || player?.cardCount || 0;
    const isOnline = player?.isOnline !== false;

    const positionStyles: { [key: number]: string } = {
      0: "top-0 left-1/2 -translate-x-1/2",
      1: "right-0 top-1/2 -translate-y-1/2 md:right-2",
      2: "bottom-0 left-1/2 -translate-x-1/2",
      3: "left-0 top-1/2 -translate-y-1/2 md:left-2",
    };

    const cardRotations: { [key: number]: string } = {
      0: "rotate-180",
      1: "-rotate-90",
      2: "",
      3: "rotate-90",
    };

    if (!player) {
      return (
        <div className={`absolute ${positionStyles[position]} z-10`}>
          <div className="w-16 h-20 md:w-20 md:h-24 rounded-lg bg-gray-700/30 border-2 border-dashed border-gray-600 flex items-center justify-center">
            <span className="text-gray-500 text-xs">Empty</span>
          </div>
        </div>
      );
    }

    return (
      <div className={`absolute ${positionStyles[position]} z-10`}>
        <div className={`relative flex flex-col items-center transition-all duration-300 ${isCurrentTurn ? "scale-110" : ""}`}>
          <div className={`relative ${cardRotations[position]}`}>
            <div className="flex -space-x-6 md:-space-x-8">
              {Array.from({ length: Math.min(cardCount, 5) }).map((_, i) => (
                <div
                  key={i}
                  className="w-8 h-12 md:w-10 md:h-14 bg-gradient-to-br from-blue-600 to-blue-800 rounded-md border-2 border-blue-400 shadow-lg transform transition-transform"
                  style={{
                    transform: `rotate(${(i - Math.min(cardCount, 5) / 2) * 8}deg)`,
                    zIndex: i,
                  }}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-4 h-6 md:w-5 md:h-8 rounded-sm bg-blue-900 flex items-center justify-center">
                      <span className="text-white text-[8px] md:text-xs font-bold">UNO</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {cardCount > 5 && (
              <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                +{cardCount - 5}
              </div>
            )}
          </div>

          <div
            className={`mt-2 px-2 py-1 rounded-full text-xs font-bold shadow-lg transition-all ${
              isCurrentTurn
                ? "bg-green-500 text-white ring-2 ring-green-300 animate-pulse"
                : "bg-black/70 text-white"
            }`}
          >
            {player.nickname}
            {isCurrentTurn && " ⭐"}
          </div>

          <div
            className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border border-white ${
              isOnline ? "bg-green-500" : "bg-red-500"
            }`}
          />

          {player.id === room?.hostId && (
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-sm">👑</div>
          )}

          {cardCount <= 1 && player.hasCalledUno && (
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold animate-pulse whitespace-nowrap">
              UNO!
            </div>
          )}

          {player.finishPosition && (
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-xs px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
              {player.finishPosition === 1 ? "1ST" : player.finishPosition === 2 ? "2ND" : player.finishPosition === 3 ? "3RD" : `${player.finishPosition}TH`}
            </div>
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
          100% { transform: translateY(-150px) scale(0.7); opacity: 0; }
        }
        @keyframes cardDraw { 
          0% { transform: translateY(-50px) scale(0.8); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        .animate-card-play { animation: cardPlayUp 0.4s ease-out forwards; }
        .animate-card-draw { animation: cardDraw 0.35s ease-out forwards; }
      `}</style>

      {room?.status === "playing" && currentGamePlayer && (
        <div className={`fixed top-2 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 md:px-4 md:py-2 rounded-full shadow-lg border-2 transition-all ${
          isMyTurn 
            ? (pendingDraw > 0 ? 'bg-red-600 border-red-400 animate-pulse' : 'bg-green-600 border-green-400 animate-pulse')
            : 'bg-yellow-600/90 border-yellow-400'
        }`}>
          <div className="text-white font-bold text-xs md:text-sm text-center flex items-center gap-1 md:gap-2">
            {isMyTurn ? (
              pendingDraw > 0 ? (
                <span>⚠️ DRAW {pendingDraw}!</span>
              ) : (
                <span>⭐ YOUR TURN</span>
              )
            ) : (
              pendingDraw > 0 ? (
                <span>🎮 {currentGamePlayer.nickname} draws {pendingDraw}</span>
              ) : (
                <span>🎮 {currentGamePlayer.nickname}'s turn</span>
              )
            )}
          </div>
        </div>
      )}

      <div className="absolute inset-0 flex items-center justify-center p-4 pt-12 pb-32 md:pb-40">
        <div className="relative w-full max-w-md md:max-w-xl aspect-[4/3] md:aspect-video">
          <div className="absolute inset-[15%] md:inset-[20%] rounded-full bg-gradient-to-br from-slate-700 to-slate-800 shadow-2xl border-4 border-slate-600" />

          {[0, 1, 2, 3].map((position) => {
            const player = getPlayerAtPosition(position);
            const isCurrentTurn = currentGamePlayer?.id === player?.id;
            return (
              <PlayerSilhouette
                key={position}
                player={player}
                position={position}
                isCurrentTurn={isCurrentTurn}
              />
            );
          })}

          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="flex items-center gap-2 md:gap-4">
              <div
                className={`w-12 h-16 md:w-16 md:h-22 lg:w-20 lg:h-28 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg border-2 border-blue-400 shadow-xl flex items-center justify-center cursor-pointer hover:scale-105 transition-transform ${
                  drawingCard ? "animate-card-draw" : ""
                } ${isMyTurn && !isSpectator ? "ring-2 ring-green-400" : ""}`}
                onClick={handleDraw}
              >
                <div className="text-white text-xs md:text-sm font-bold text-center">
                  DRAW
                  <div className="text-[10px] md:text-xs opacity-70">PILE</div>
                </div>
              </div>

              {topCard && (
                <div className="transform scale-90 md:scale-100 lg:scale-110">
                  <GameCard card={topCard} size="large" interactive={false} onClick={() => {}} />
                </div>
              )}
            </div>

            {currentColor && (topCard?.type === "wild" || topCard?.type === "wild4") && (
              <div className="absolute -bottom-8 md:-bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center">
                <div
                  className={`w-6 h-6 md:w-8 md:h-8 rounded-full border-2 border-white shadow-lg ${
                    currentColor === "red" ? "bg-red-500"
                    : currentColor === "yellow" ? "bg-yellow-500"
                    : currentColor === "blue" ? "bg-blue-500"
                    : currentColor === "green" ? "bg-green-500"
                    : "bg-gray-500"
                  }`}
                />
                <span className="text-[10px] md:text-xs text-white font-bold mt-1 uppercase">{currentColor}</span>
              </div>
            )}
          </div>

          {room?.direction && room?.status === "playing" && (
            <div className="absolute top-2 left-2 md:top-4 md:left-4 z-30">
              <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full border-2 border-yellow-300 shadow-lg w-10 h-10 md:w-12 md:h-12 flex items-center justify-center">
                <span className="text-white text-lg md:text-xl">
                  {room.direction === "clockwise" ? "↻" : "↺"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {!isSpectator && myHand.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-black/90 to-transparent">
          <div className="container mx-auto px-2 py-2 md:px-4 md:py-3 relative">
            {onCallUno && (
              <div className="absolute top-2 right-2 z-50">
                <button
                  onClick={onCallUno}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold px-2 py-1 md:px-3 md:py-1.5 rounded-md text-xs md:text-sm shadow-lg animate-pulse border-2 border-red-500"
                >
                  🔥 UNO! 🔥
                </button>
              </div>
            )}

            <div className="flex justify-center">
              <div className="flex items-end gap-1 overflow-x-auto pb-2 px-2 scrollbar-hide max-w-full">
                {myHand.map((card: any, index: number) => {
                  const playable = isCardPlayable(card);
                  const isPlaying = playingCardId === card.id;
                  return (
                    <div
                      key={card.id}
                      className={`flex-shrink-0 transition-all duration-200 ${
                        playable ? "hover:-translate-y-3 cursor-pointer" : "opacity-60"
                      } ${isPlaying ? "animate-card-play" : ""}`}
                      style={{
                        marginLeft: index > 0 ? "-1rem" : "0",
                        zIndex: index,
                      }}
                      onClick={() => handleCardClick(card)}
                    >
                      <div className="transform scale-75 md:scale-90 lg:scale-100">
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

      {colorPickerCard && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
          <div className="bg-slate-800 rounded-xl p-4 md:p-6 border-2 border-slate-600 shadow-2xl">
            <h3 className="text-white text-lg md:text-xl font-bold text-center mb-4">Choose Color</h3>
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              {["red", "yellow", "green", "blue"].map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorSelect(color)}
                  className={`w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-white shadow-lg transform hover:scale-110 transition-transform ${
                    color === "red" ? "bg-red-500"
                    : color === "yellow" ? "bg-yellow-500"
                    : color === "green" ? "bg-green-500"
                    : "bg-blue-500"
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => setColorPickerCard(null)}
              className="mt-4 w-full py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
