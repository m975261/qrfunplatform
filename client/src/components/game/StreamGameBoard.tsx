import { useState, useEffect } from "react";
import GameCard from "@/components/game/Card";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface StreamGameBoardProps {
  room: any;
  players: any[];
  currentPlayerId: string | null;
  isMyTurn: boolean;
  onPlayCard: (cardIndex: number) => void;
  onDrawCard: () => void;
  onCallUno: () => void;
  canPlayCard: (card: any) => boolean;
  streamingHostDisconnected?: boolean;
  streamingHostDeadlineMs?: number;
  streamingHostName?: string;
  handRefreshKey?: number;
  cardAnimation?: {
    card: any;
    from: 'player' | 'opponent' | 'deck';
    to: 'discard' | 'player';
    show: boolean;
  } | null;
}

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

export default function StreamGameBoard({
  room,
  players,
  currentPlayerId,
  isMyTurn,
  onPlayCard,
  onDrawCard,
  onCallUno,
  canPlayCard,
  streamingHostDisconnected,
  streamingHostDeadlineMs,
  streamingHostName,
  handRefreshKey = 0,
  cardAnimation,
}: StreamGameBoardProps) {
  const gamePlayers = players.filter((p: any) => 
    !p.isSpectator && p.position !== null && p.position !== undefined
  ).sort((a: any, b: any) => (a.position || 0) - (b.position || 0));

  const myPlayer = players.find((p: any) => p.id === currentPlayerId);
  const myHand = myPlayer?.hand || [];
  const currentPlayerIndex = room?.currentPlayerIndex;
  const currentGamePlayer = gamePlayers.find((p: any) => p.position === currentPlayerIndex);
  const topCard = room?.topCard || room?.discardPile?.[room?.discardPile?.length - 1];
  const currentColor = room?.currentColor;

  const getPlayerAtPosition = (position: number) => {
    return gamePlayers.find((player: any) => player.position === position) || null;
  };

  const getPlayerAvatar = (id: string, nickname: string) => {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden pt-16 sm:pt-20 md:pt-24">
      {streamingHostDisconnected && streamingHostDeadlineMs && (
        <StreamingHostDisconnectBanner 
          deadlineMs={streamingHostDeadlineMs} 
          hostName={streamingHostName || "Host"} 
        />
      )}

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

      {room?.status === "playing" && currentGamePlayer && (
        <div className={`fixed top-14 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full shadow-lg border-2 transition-all ${
          isMyTurn 
            ? ((room?.pendingDraw ?? 0) > 0 ? 'bg-red-600 border-red-400 animate-pulse' : 'bg-green-600 border-green-400 animate-pulse')
            : 'bg-yellow-600 border-yellow-400'
        }`}>
          <div className="text-white font-bold text-sm text-center flex items-center gap-2">
            {isMyTurn ? (
              (room?.pendingDraw ?? 0) > 0 ? (
                <span>⚠️ MUST DRAW {room.pendingDraw} CARDS! ⚠️</span>
              ) : (
                <span>⭐ YOUR TURN - Play or Draw! ⭐</span>
              )
            ) : (
              (room?.pendingDraw ?? 0) > 0 ? (
                <span>🎮 {currentGamePlayer.nickname} must draw {room.pendingDraw} cards</span>
              ) : (
                <span>🎮 {currentGamePlayer.nickname}'s turn</span>
              )
            )}
          </div>
        </div>
      )}

      <section className="relative w-full h-full flex items-center justify-center bg-transparent p-4 pb-32">
        <div
          className="relative aspect-square w-[min(80vmin,450px)]"
          style={{
            ['--r' as any]: 'calc(var(--center) / 2 + var(--avatar) / 2 + 8px)',
            ['--avatar' as any]: 'clamp(60px, 11vmin, 76px)',
            ['--center' as any]: 'clamp(90px, 16vmin, 130px)',
            ['--gap' as any]: 'clamp(8px, 2vmin, 16px)',
          }}
        >
          <div className="absolute inset-0 grid place-items-center z-10">
            <div className="relative">
              <div
                className="absolute -z-10 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-slate-600 shadow-2xl bg-gradient-to-br from-slate-700 to-slate-800"
                style={{ width: 'var(--center)', height: 'var(--center)' }}
              />
              <div className="flex flex-col items-center space-y-2">
                {topCard ? (
                  <div className="flex flex-col items-center">
                    <GameCard card={topCard} size="small" interactive={false} onClick={() => {}} />
                    {currentColor && (topCard.type === 'wild' || topCard.type === 'wild4') && (
                      <div className="flex flex-col items-center mt-2">
                        <div
                          className={`w-6 h-6 rounded-full border-2 border-white ${
                            currentColor === 'red'
                              ? 'bg-red-500'
                              : currentColor === 'yellow'
                              ? 'bg-yellow-500'
                              : currentColor === 'blue'
                              ? 'bg-blue-500'
                              : currentColor === 'green'
                              ? 'bg-green-500'
                              : 'bg-gray-500'
                          }`}
                        />
                        <span className="text-xs text-white font-bold mt-1">
                          Active: {currentColor}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-16 h-24 bg-gradient-to-br from-red-500 to-red-700 rounded-lg border-2 border-red-300 shadow-xl flex items-center justify-center">
                    <div className="text-white font-bold text-lg">UNO</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {[0, 1, 2, 3].map((position) => {
            const player = getPlayerAtPosition(position);
            const isOnline = player ? isPlayerOnline(player) : false;
            const isPlayerTurn = currentGamePlayer?.id === player?.id;

            const posClass =
              position === 0
                ? 'top-[calc(50%-var(--r))] left-1/2 -translate-x-1/2 -translate-y-1/2'
                : position === 1
                ? 'left-[calc(50%+var(--r))] top-1/2 -translate-x-1/2 -translate-y-1/2'
                : position === 2
                ? 'top-[calc(50%+var(--r))] left-1/2 -translate-x-1/2 -translate-y-1/2'
                : 'left-[calc(50%-var(--r))] top-1/2 -translate-x-1/2 -translate-y-1/2';

            return (
              <div key={position} className={`absolute ${posClass} pointer-events-auto z-20`}>
                <div className="relative">
                  {player ? (
                    <div className="relative">
                      <button
                        className={`rounded-full flex items-center justify-center text-white font-bold shadow-lg border-4 bg-gradient-to-br from-uno-blue to-uno-purple ${
                          isPlayerTurn ? 'border-green-400 ring-2 ring-green-400/50' : 'border-white/20'
                        }`}
                        style={{ width: 'var(--avatar)', height: 'var(--avatar)' }}
                        aria-label={`${player.nickname} avatar`}
                        title={player.nickname}
                      >
                        <div className="text-2xl">{getPlayerAvatar(player.id, player.nickname)}</div>
                      </button>

                      <div
                        className={`absolute text-xs font-semibold text-white bg-black/70 px-2 py-1 rounded-full whitespace-nowrap ${
                          position === 0 ? 'left-full top-1/2 -translate-y-1/2 ml-2'
                          : position === 1 ? 'top-full left-1/2 -translate-x-1/2 mt-2'
                          : position === 2 ? 'right-3/4 top-full mt-2'
                          : 'right-1/4 bottom-full -translate-x-1/2 mb-2'
                        }`}
                      >
                        {player.nickname}
                      </div>

                      <div
                        className={`absolute -top-1 -right-1 w-6 h-6 rounded-full border-2 border-white ${
                          isOnline ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />

                      {player.id === room?.hostId && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">👑</div>
                      )}

                      {player.finishPosition && (
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-xs px-2 py-1 rounded-full font-bold shadow-lg">
                          {player.finishPosition === 1
                            ? '1ST'
                            : player.finishPosition === 2
                            ? '2ND'
                            : player.finishPosition === 3
                            ? '3RD'
                            : `${player.finishPosition}TH`}
                        </div>
                      )}

                      {!player.finishPosition && (
                        <div className="absolute -left-2 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded-full font-bold shadow-lg">
                          {player.hand?.length || player.cardCount || 0}
                        </div>
                      )}

                      {player.hasCalledUno && (
                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold shadow-lg animate-pulse">
                          UNO!
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className="rounded-full flex items-center justify-center border-4 border-white/20 bg-gray-500/30"
                      style={{ width: 'var(--avatar)', height: 'var(--avatar)' }}
                    >
                      <div className="text-center">
                        <div className="w-8 h-8 rounded-full bg-gray-400 mx-auto" />
                        <div className="text-xs text-gray-400 mt-1">Empty</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {room?.direction && room?.status === 'playing' && (
            <div className="absolute z-20 top-2 left-2">
              <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full border-2 border-yellow-300 shadow-lg w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex items-center justify-center animate-pulse">
                <div className="text-white text-[9px] font-bold text-center leading-tight">
                  {room.direction === 'clockwise' ? (
                    <div className="flex flex-col items-center">
                      <span className="text-sm">↻</span>
                      <span>GAME</span>
                      <span>DIR</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <span className="text-sm">↺</span>
                      <span>GAME</span>
                      <span>DIR</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {isMyTurn && (
            <div className="absolute z-20 bottom-2 left-2">
              <div className="relative cursor-pointer group" onClick={onDrawCard}>
                <div className="bg-gradient-to-br from-blue-800 to-blue-900 rounded-lg border-2 border-blue-600 shadow-xl group-hover:shadow-blue-500/50 transition-all w-10 h-14 sm:w-11 sm:h-15 md:w-12 md:h-16"></div>
                <div className="bg-gradient-to-br from-blue-700 to-blue-800 rounded-lg border-2 border-blue-500 shadow-xl absolute -top-0.5 -left-0.5 w-10 h-14 sm:w-11 sm:h-15 md:w-12 md:h-16"></div>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-white font-bold text-xs">CARDS</div>
                </div>
              </div>
              <div className="text-center mt-1">
                <div className="text-blue-300 font-bold text-xs">DRAW</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {myPlayer && !myPlayer.isSpectator && (
        <div className="fixed bottom-0 left-0 right-0 z-30">
          <div className="bg-gradient-to-t from-slate-800/95 to-slate-800/90 backdrop-blur-md px-2 pb-10" style={{
            height: 'max(20vh, 120px)'
          }}>
            
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm border-2 ${
                    isMyTurn ? 'bg-gradient-to-br from-green-400 to-green-600 border-green-300' : 'bg-gradient-to-br from-blue-400 to-blue-600 border-blue-300'
                  }`}
                >
                  {getPlayerAvatar(myPlayer.id, myPlayer.nickname)}
                </div>
                <div className="ml-2">
                  <div className={`font-semibold text-white text-sm ${isMyTurn ? 'text-green-400' : ''}`}>
                    {myPlayer.nickname}
                  </div>
                  <div className="text-xs text-slate-400">
                    {myHand.length} cards
                  </div>
                </div>
                {isMyTurn && (
                  <div className="ml-3">
                    <div className="bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs font-bold border border-green-500/30">
                      YOUR TURN ⭐
                    </div>
                  </div>
                )}
              </div>

              {myHand.length <= 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="font-bold border-2 transition-all bg-red-600 border-red-500 text-white hover:bg-red-700 animate-pulse text-xs px-3 py-1"
                  onClick={onCallUno}
                  data-testid="button-call-uno"
                >
                  🔥 UNO! 🔥
                </Button>
              )}
            </div>

            <div className="overflow-x-auto overflow-y-visible px-1">
              {myHand && myHand.length > 0 ? (
                <div key={`hand-${handRefreshKey}`} className="flex space-x-1 min-w-max h-full items-center py-1 justify-center">
                  {myHand.map((card: any, index: number) => {
                    const isPlayable = canPlayCard(card);
                    return (
                      <div 
                        key={index} 
                        className={`transition-all duration-200 flex-shrink-0 ${
                          isMyTurn && isPlayable 
                            ? 'hover:scale-110 hover:-translate-y-3 cursor-pointer' 
                            : 'opacity-60'
                        }`}
                        onClick={() => {
                          if (!isMyTurn || !isPlayable) return;
                          onPlayCard(index);
                        }}
                        data-testid={`card-${index}`}
                      >
                        <GameCard
                          card={card}
                          size="extra-small"
                          selected={false}
                          disabled={!isMyTurn || !isPlayable}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-slate-400 text-lg">No cards in hand</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {myPlayer && myPlayer.isSpectator && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-slate-800/95 to-slate-800/90 backdrop-blur-md">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-center">
              <div className="bg-slate-700/80 px-6 py-3 rounded-lg border border-slate-600">
                <div className="text-center">
                  <div className="text-slate-300 text-sm mb-2">You are watching as a spectator</div>
                  <div className="text-xs text-slate-400">
                    Current turn: <span className="text-green-400 font-medium">{currentGamePlayer?.nickname || 'Unknown'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!myPlayer && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-slate-800/95 to-slate-800/90 backdrop-blur-md">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-center">
              <div className="bg-purple-700/80 px-6 py-3 rounded-lg border border-purple-500">
                <div className="text-center">
                  <div className="text-white text-sm font-semibold mb-1">📺 OBS View Mode</div>
                  <div className="text-purple-200 text-xs">
                    Current turn: <span className="text-green-400 font-medium">{currentGamePlayer?.nickname || 'Unknown'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
