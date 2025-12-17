import { useEffect, useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ArrowLeft, RotateCcw, Trophy, Zap, Eye, UserMinus, UserPlus, Pencil, Check, X, Play } from "lucide-react";
import { Link } from "wouter";
import { XOGameState, XOCell } from "@shared/schema";

interface Player {
  id: string;
  nickname: string;
  position: number;
  isSpectator?: boolean;
  hasLeft?: boolean;
  isOnline?: boolean;
}

interface Room {
  id: string;
  code: string;
  hostId: string;
  status: string;
  xoState: XOGameState;
  xoSettings: {
    isBotGame: boolean;
    difficulty: string;
  };
}

export default function XOGame() {
  const { roomId } = useParams<{ roomId: string }>();
  const [, setLocation] = useLocation();
  const [showRoundEnd, setShowRoundEnd] = useState(false);
  const [roundWinner, setRoundWinner] = useState<string | null>(null);
  const [drawCountdown, setDrawCountdown] = useState<number | null>(null);
  const [showWinAnimation, setShowWinAnimation] = useState(false);
  const [winCountdown, setWinCountdown] = useState<number | null>(null);
  const [lastProcessedGameNumber, setLastProcessedGameNumber] = useState<number | null>(null);
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editNickname, setEditNickname] = useState("");
  
  const playerId = localStorage.getItem("xo_playerId");

  const { data, isLoading, refetch } = useQuery<{ room: Room; players: Player[] }>({
    queryKey: ['/api/xo/rooms', roomId, playerId],
    queryFn: async () => {
      const response = await fetch(`/api/xo/rooms/${roomId}?playerId=${playerId}`);
      if (!response.ok) throw new Error('Failed to fetch room');
      return response.json();
    },
    refetchInterval: 500,
  });

  const room = data?.room;
  const players = data?.players || [];
  const xoState = room?.xoState;
  const isBotGame = room?.xoSettings?.isBotGame;

  const myMark = xoState?.xPlayerId === playerId ? "X" : xoState?.oPlayerId === playerId ? "O" : null;
  const isMyTurn = xoState?.currentPlayer === myMark;
  const currentPlayerName = players.find(p => 
    p.id === (xoState?.currentPlayer === "X" ? xoState?.xPlayerId : xoState?.oPlayerId)
  )?.nickname || (xoState?.currentPlayer === "X" ? "X" : "O");

  const xPlayerName = players.find(p => p.id === xoState?.xPlayerId)?.nickname || "Player X";
  const oPlayerName = isBotGame ? "Bot" : (players.find(p => p.id === xoState?.oPlayerId)?.nickname || "Player O");
  const myNickname = players.find(p => p.id === playerId)?.nickname;
  const spectators = players.filter(p => p.isSpectator && !p.hasLeft);
  const activePlayers = players.filter(p => !p.isSpectator && !p.hasLeft);
  const isHost = room?.hostId === playerId;
  const isPaused = room?.status === "paused";

  const makeMovesMutation = useMutation({
    mutationFn: async ({ row, col }: { row: number; col: number }) => {
      const response = await apiRequest("POST", `/api/xo/rooms/${roomId}/move`, {
        playerId,
        row,
        col,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/xo/rooms', roomId] });
      
      if (data.xoState.winner) {
        const winnerName = data.xoState.winner === "X" ? xPlayerName : oPlayerName;
        setRoundWinner(winnerName);
        setShowWinAnimation(true);
        setWinCountdown(3);
      } else if (data.xoState.isDraw) {
        setRoundWinner(null);
        setShowRoundEnd(true);
        setDrawCountdown(5);
      } else if (isBotGame && data.xoState.currentPlayer === "O") {
        setTimeout(() => triggerBotMove(), 500);
      }
    },
    onError: (error: any) => {
      console.error("Invalid Move:", error.message || "That move is not allowed");
    },
  });

  const botMoveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/xo/rooms/${roomId}/bot-move`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/xo/rooms', roomId] });
      
      if (data.xoState.winner) {
        const winnerName = data.xoState.winner === "X" ? xPlayerName : oPlayerName;
        setRoundWinner(winnerName);
        setShowWinAnimation(true);
        setWinCountdown(3);
      } else if (data.xoState.isDraw) {
        setRoundWinner(null);
        setShowRoundEnd(true);
        setDrawCountdown(5);
      }
    },
  });

  const nextRoundMutation = useMutation({
    mutationFn: async (expectedGameNumber?: number) => {
      const response = await apiRequest("POST", `/api/xo/rooms/${roomId}/next-round`, { expectedGameNumber });
      return response.json();
    },
    onSuccess: (data) => {
      // If already progressed by another player, just refresh state
      if (data.alreadyProgressed) {
        queryClient.invalidateQueries({ queryKey: ['/api/xo/rooms', roomId] });
        return;
      }
      setShowRoundEnd(false);
      setRoundWinner(null);
      setDrawCountdown(null);
      setShowWinAnimation(false);
      setWinCountdown(null);
      setLastProcessedGameNumber(null);
      queryClient.invalidateQueries({ queryKey: ['/api/xo/rooms', roomId] });
      
      if (isBotGame && data.xoState?.currentPlayer === "O") {
        setTimeout(() => triggerBotMove(), 800);
      }
    },
  });

  const resetGameMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/xo/rooms/${roomId}/reset`);
      return response.json();
    },
    onSuccess: () => {
      setShowRoundEnd(false);
      setRoundWinner(null);
      setShowWinAnimation(false);
      setWinCountdown(null);
      setDrawCountdown(null);
      setLastProcessedGameNumber(null);
      queryClient.invalidateQueries({ queryKey: ['/api/xo/rooms', roomId] });
    },
  });

  const continueGameMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/xo/rooms/${roomId}/continue`, {
        requesterId: playerId,
      });
      return response.json();
    },
    onSuccess: () => {
      setShowContinuePrompt(false);
      queryClient.invalidateQueries({ queryKey: ['/api/xo/rooms', roomId] });
    },
  });

  const kickPlayerMutation = useMutation({
    mutationFn: async (playerIdToKick: string) => {
      const response = await apiRequest("POST", `/api/xo/rooms/${roomId}/kick`, {
        requesterId: playerId,
        playerId: playerIdToKick,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/xo/rooms', roomId] });
    },
  });

  const assignSpectatorMutation = useMutation({
    mutationFn: async ({ spectatorId, position }: { spectatorId: string; position: number }) => {
      const response = await apiRequest("POST", `/api/xo/rooms/${roomId}/assign-spectator`, {
        requesterId: playerId,
        spectatorId,
        position,
      });
      return response.json();
    },
    onSuccess: () => {
      setShowContinuePrompt(false);
      queryClient.invalidateQueries({ queryKey: ['/api/xo/rooms', roomId] });
    },
  });

  const renamePlayerMutation = useMutation({
    mutationFn: async ({ targetPlayerId, newNickname }: { targetPlayerId: string; newNickname: string }) => {
      const response = await apiRequest("POST", `/api/xo/rooms/${roomId}/rename`, {
        requesterId: playerId,
        targetPlayerId,
        newNickname,
      });
      return response.json();
    },
    onSuccess: () => {
      setEditingPlayerId(null);
      setEditNickname("");
      queryClient.invalidateQueries({ queryKey: ['/api/xo/rooms', roomId] });
    },
  });

  const triggerBotMove = useCallback(() => {
    if (isBotGame && xoState?.currentPlayer === "O" && !xoState?.winner && !xoState?.isDraw) {
      botMoveMutation.mutate();
    }
  }, [isBotGame, xoState?.currentPlayer, xoState?.winner, xoState?.isDraw]);

  useEffect(() => {
    if (isBotGame && xoState?.currentPlayer === "O" && !xoState?.winner && !xoState?.isDraw) {
      const timer = setTimeout(triggerBotMove, 800);
      return () => clearTimeout(timer);
    }
  }, [isBotGame, xoState?.currentPlayer, triggerBotMove]);

  useEffect(() => {
    if (drawCountdown !== null && drawCountdown > 0) {
      const timer = setTimeout(() => {
        setDrawCountdown(drawCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (drawCountdown === 0 && xoState?.isDraw && xoState?.boardSize < 6 && !nextRoundMutation.isPending) {
      setDrawCountdown(null);
      // Pass current game number to prevent duplicate progressions
      nextRoundMutation.mutate(xoState.gameNumber);
    }
  }, [drawCountdown, xoState?.isDraw, xoState?.boardSize, xoState?.gameNumber, nextRoundMutation.isPending]);

  useEffect(() => {
    if (winCountdown !== null && winCountdown > 0) {
      const timer = setTimeout(() => {
        setWinCountdown(winCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (winCountdown === 0) {
      setShowWinAnimation(false);
      setWinCountdown(null);
      setShowRoundEnd(true);
    }
  }, [winCountdown]);

  useEffect(() => {
    if (!xoState) return;
    
    const gameId = xoState.gameNumber;
    
    if (lastProcessedGameNumber !== gameId) {
      if (xoState.winner && !showWinAnimation && !showRoundEnd) {
        const winnerName = xoState.winner === "X" ? xPlayerName : oPlayerName;
        setRoundWinner(winnerName);
        setShowWinAnimation(true);
        setWinCountdown(3);
        setLastProcessedGameNumber(gameId);
      } else if (xoState.isDraw && !showRoundEnd && drawCountdown === null) {
        setRoundWinner(null);
        setShowRoundEnd(true);
        setDrawCountdown(5);
        setLastProcessedGameNumber(gameId);
      }
    }
  }, [xoState?.winner, xoState?.isDraw, xoState?.gameNumber, lastProcessedGameNumber, showWinAnimation, showRoundEnd, drawCountdown, xPlayerName, oPlayerName]);

  useEffect(() => {
    if (xoState && !xoState.isDraw && !xoState.winner && xoState.moveHistory.length === 0 && (showRoundEnd || drawCountdown !== null)) {
      setShowRoundEnd(false);
      setDrawCountdown(null);
    }
  }, [xoState?.isDraw, xoState?.winner, xoState?.moveHistory?.length, showRoundEnd, drawCountdown]);

  useEffect(() => {
    if (isPaused && isHost && !isBotGame) {
      setShowContinuePrompt(true);
    }
  }, [isPaused, isHost, isBotGame]);

  const startEditingNickname = (player: Player) => {
    setEditingPlayerId(player.id);
    setEditNickname(player.nickname);
  };

  const saveNickname = (targetPlayerId: string) => {
    if (editNickname.trim() && editNickname !== players.find(p => p.id === targetPlayerId)?.nickname) {
      renamePlayerMutation.mutate({ targetPlayerId, newNickname: editNickname.trim() });
    } else {
      setEditingPlayerId(null);
      setEditNickname("");
    }
  };

  const handleCellClick = (row: number, col: number) => {
    if (isPaused || !isMyTurn || xoState?.board[row][col] || xoState?.winner || xoState?.isDraw) return;
    makeMovesMutation.mutate({ row, col });
  };

  const isWinningCell = (row: number, col: number) => {
    return xoState?.winningLine?.some(cell => cell.row === row && cell.col === col);
  };

  if (isLoading || !xoState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-indigo-900 dark:to-purple-900 flex items-center justify-center">
        <div className="text-xl text-gray-600 dark:text-gray-300">Loading game...</div>
      </div>
    );
  }

  const boardSize = xoState.boardSize;
  const cellSize = Math.max(40, Math.min(80, 320 / boardSize));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-indigo-900 dark:to-purple-900 p-4">
      <div className="max-w-lg mx-auto relative">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/xo" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white transition-colors">
            <ArrowLeft size={20} />
            Leave
          </Link>
          <Button variant="ghost" size="sm" onClick={() => resetGameMutation.mutate()} data-testid="button-reset">
            <RotateCcw size={18} className="mr-1" />
            Reset
          </Button>
        </div>

        {/* Player Name Display */}
        {myNickname && (
          <div className="text-center mb-2 text-sm text-gray-600 dark:text-gray-300">
            Player name: <span className="font-semibold">{myNickname}</span>
          </div>
        )}

        {/* Game Info */}
        <Card className="p-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-0 shadow-xl mb-4">
          <div className="flex justify-between items-center">
            {/* X Player */}
            <div className="text-center flex-1 relative">
              <div className="relative inline-block">
                <div className="text-2xl mb-1">❌</div>
                {/* Host controls for X player */}
                {isHost && !isBotGame && xoState.xPlayerId && xoState.xPlayerId !== playerId && (
                  <div className="absolute -top-1 -right-6 flex flex-col gap-0.5">
                    {editingPlayerId === xoState.xPlayerId ? null : (
                      <>
                        <button
                          onClick={() => {
                            const xPlayer = players.find(p => p.id === xoState.xPlayerId);
                            if (xPlayer) startEditingNickname(xPlayer);
                          }}
                          className="text-gray-400 hover:text-blue-500 p-0.5 rounded bg-white/80 dark:bg-gray-700/80"
                          title="Edit nickname"
                        >
                          <Pencil size={10} />
                        </button>
                        <button
                          onClick={() => kickPlayerMutation.mutate(xoState.xPlayerId!)}
                          disabled={kickPlayerMutation.isPending}
                          className="text-gray-400 hover:text-red-500 p-0.5 rounded bg-white/80 dark:bg-gray-700/80"
                          title="Move to spectators"
                        >
                          <UserMinus size={10} />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {editingPlayerId === xoState.xPlayerId ? (
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Input
                    value={editNickname}
                    onChange={(e) => setEditNickname(e.target.value)}
                    className="h-6 w-20 text-xs px-1"
                    maxLength={15}
                    onKeyDown={(e) => e.key === 'Enter' && saveNickname(xoState.xPlayerId!)}
                  />
                  <button onClick={() => saveNickname(xoState.xPlayerId!)} className="text-green-500 hover:text-green-700">
                    <Check size={12} />
                  </button>
                  <button onClick={() => { setEditingPlayerId(null); setEditNickname(""); }} className="text-red-500 hover:text-red-700">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div className="font-medium text-sm">{xPlayerName}</div>
              )}
              <div className="text-2xl font-bold text-blue-600">{xoState.scores.x}</div>
            </div>

            {/* Center Info */}
            <div className="text-center px-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">Round {xoState.gameNumber}</div>
              <div className="text-lg font-bold">{boardSize}×{boardSize}</div>
              <div className="text-sm font-semibold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-2 py-1 rounded-full mt-1">
                🎯 {xoState.winLength} in a row to win!
              </div>
            </div>

            {/* O Player */}
            <div className="text-center flex-1 relative">
              <div className="relative inline-block">
                <div className="text-2xl mb-1">⭕</div>
                {/* Host controls for O player */}
                {isHost && !isBotGame && xoState.oPlayerId && xoState.oPlayerId !== playerId && (
                  <div className="absolute -top-1 -left-6 flex flex-col gap-0.5">
                    {editingPlayerId === xoState.oPlayerId ? null : (
                      <>
                        <button
                          onClick={() => {
                            const oPlayer = players.find(p => p.id === xoState.oPlayerId);
                            if (oPlayer) startEditingNickname(oPlayer);
                          }}
                          className="text-gray-400 hover:text-purple-500 p-0.5 rounded bg-white/80 dark:bg-gray-700/80"
                          title="Edit nickname"
                        >
                          <Pencil size={10} />
                        </button>
                        <button
                          onClick={() => kickPlayerMutation.mutate(xoState.oPlayerId!)}
                          disabled={kickPlayerMutation.isPending}
                          className="text-gray-400 hover:text-red-500 p-0.5 rounded bg-white/80 dark:bg-gray-700/80"
                          title="Move to spectators"
                        >
                          <UserMinus size={10} />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {editingPlayerId === xoState.oPlayerId ? (
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Input
                    value={editNickname}
                    onChange={(e) => setEditNickname(e.target.value)}
                    className="h-6 w-20 text-xs px-1"
                    maxLength={15}
                    onKeyDown={(e) => e.key === 'Enter' && saveNickname(xoState.oPlayerId!)}
                  />
                  <button onClick={() => saveNickname(xoState.oPlayerId!)} className="text-green-500 hover:text-green-700">
                    <Check size={12} />
                  </button>
                  <button onClick={() => { setEditingPlayerId(null); setEditNickname(""); }} className="text-red-500 hover:text-red-700">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div className="font-medium text-sm">{oPlayerName}</div>
              )}
              <div className="text-2xl font-bold text-purple-600">{xoState.scores.o}</div>
            </div>
          </div>
          <div className="text-center mt-3 text-sm text-gray-500 dark:text-gray-400">
            Draws: {xoState.scores.draws}
          </div>
        </Card>

        {/* Game Paused Banner */}
        {isPaused && (
          <div className="bg-gradient-to-r from-gray-600 to-gray-700 text-white font-bold px-4 py-3 rounded-xl shadow-xl border-2 border-gray-400 mb-4" data-testid="paused-indicator">
            <div className="flex items-center justify-center gap-2 text-lg">
              <span>⏸️</span>
              <span>Game Paused</span>
              <span>⏸️</span>
            </div>
            {isHost && !isBotGame && (
              <div className="mt-2 flex justify-center">
                <Button
                  onClick={() => continueGameMutation.mutate()}
                  disabled={continueGameMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-sm"
                  size="sm"
                  data-testid="button-continue-game"
                >
                  <Play size={14} className="mr-1" />
                  {continueGameMutation.isPending ? "Continuing..." : "Continue Game"}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Turn Indicator */}
        <div className={`text-center py-3 px-4 rounded-lg mb-4 ${
          isMyTurn 
            ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200' 
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
        }`}>
          {xoState.winner ? (
            <span className="font-bold flex items-center justify-center gap-2">
              <Trophy size={20} className="text-yellow-500" />
              {xoState.winner === myMark ? "You Won!" : `${roundWinner || xoState.winner} Wins!`}
            </span>
          ) : xoState.isDraw ? (
            <span className="font-bold">It's a Draw!</span>
          ) : isMyTurn ? (
            <span className="font-bold">Your Turn ({myMark})</span>
          ) : (
            <span>{currentPlayerName}'s Turn</span>
          )}
        </div>

        {/* Game Board */}
        <Card className="p-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-0 shadow-xl">
          <div 
            className="mx-auto relative"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${boardSize}, ${cellSize}px)`,
              gap: '4px',
              width: 'fit-content',
            }}
          >
            {xoState.board.map((row, rowIndex) =>
              row.map((cell, colIndex) => (
                <button
                  key={`${rowIndex}-${colIndex}`}
                  onClick={() => handleCellClick(rowIndex, colIndex)}
                  disabled={!isMyTurn || !!cell || !!xoState.winner || xoState.isDraw}
                  className={`
                    flex items-center justify-center font-bold transition-all duration-200
                    ${isWinningCell(rowIndex, colIndex) 
                      ? 'bg-yellow-200 dark:bg-yellow-600 scale-110 ring-2 ring-yellow-400' 
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'}
                    ${!cell && isMyTurn && !xoState.winner && !xoState.isDraw ? 'cursor-pointer' : 'cursor-default'}
                    rounded-lg
                  `}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    fontSize: cellSize * 0.5,
                  }}
                  data-testid={`cell-${rowIndex}-${colIndex}`}
                >
                  {cell === "X" && <span className="text-blue-600">❌</span>}
                  {cell === "O" && <span className="text-purple-600">⭕</span>}
                </button>
              ))
            )}
            
            {/* Winning Line SVG Overlay - stays visible even with modal */}
            {xoState.winningLine && xoState.winningLine.length >= 2 && (
              <svg
                className="absolute inset-0 pointer-events-none z-[60]"
                style={{
                  width: boardSize * cellSize + (boardSize - 1) * 4,
                  height: boardSize * cellSize + (boardSize - 1) * 4,
                }}
              >
                <line
                  x1={(xoState.winningLine[0].col * (cellSize + 4)) + cellSize / 2}
                  y1={(xoState.winningLine[0].row * (cellSize + 4)) + cellSize / 2}
                  x2={(xoState.winningLine[xoState.winningLine.length - 1].col * (cellSize + 4)) + cellSize / 2}
                  y2={(xoState.winningLine[xoState.winningLine.length - 1].row * (cellSize + 4)) + cellSize / 2}
                  stroke={xoState.winner === "X" ? "#2563eb" : "#9333ea"}
                  strokeWidth="6"
                  strokeLinecap="round"
                  className="animate-pulse"
                  style={{
                    strokeDasharray: 1000,
                    strokeDashoffset: 1000,
                    animation: 'drawLine 0.5s ease-out forwards',
                  }}
                />
                <style>{`
                  @keyframes drawLine {
                    to {
                      stroke-dashoffset: 0;
                    }
                  }
                `}</style>
              </svg>
            )}
          </div>
          
          {/* Win Animation Countdown */}
          {showWinAnimation && winCountdown !== null && (
            <div className="text-center mt-4 text-lg font-bold text-yellow-600 dark:text-yellow-400 animate-pulse">
              🎉 {roundWinner} Wins! {isBotGame && xoState.winner === "O" ? `Game over in ${winCountdown}...` : `Next round in ${winCountdown}...`}
            </div>
          )}
        </Card>

        {/* Spectators Section - Below game board */}
        {spectators.length > 0 && (
          <Card className="p-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-0 shadow-xl mt-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mb-2">
              <Eye size={14} />
              <span className="font-medium">Spectators ({spectators.length}):</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {spectators.map(spectator => (
                <div key={spectator.id} className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full text-xs flex items-center gap-1">
                  {editingPlayerId === spectator.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editNickname}
                        onChange={(e) => setEditNickname(e.target.value)}
                        className="h-5 w-20 text-xs px-1"
                        maxLength={15}
                        onKeyDown={(e) => e.key === 'Enter' && saveNickname(spectator.id)}
                      />
                      <button onClick={() => saveNickname(spectator.id)} className="text-green-500 hover:text-green-700">
                        <Check size={12} />
                      </button>
                      <button onClick={() => { setEditingPlayerId(null); setEditNickname(""); }} className="text-red-500 hover:text-red-700">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span>{spectator.nickname}</span>
                      {isHost && (
                        <button onClick={() => startEditingNickname(spectator)} className="text-gray-400 hover:text-gray-600 ml-1">
                          <Pencil size={10} />
                        </button>
                      )}
                      {isHost && isPaused && (
                        <button
                          onClick={() => {
                            const vacantPosition = xoState.xPlayerId && !players.find(p => p.id === xoState.xPlayerId && !p.isSpectator && !p.hasLeft) ? 0 : 1;
                            assignSpectatorMutation.mutate({ spectatorId: spectator.id, position: vacantPosition });
                          }}
                          disabled={assignSpectatorMutation.isPending}
                          className="text-green-500 hover:text-green-700 ml-1"
                          title="Promote to player"
                        >
                          <UserPlus size={12} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Continue Game Prompt Dialog */}
        {showContinuePrompt && isHost && !isBotGame && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <Card className="max-w-md w-full mx-4">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Player Left the Game</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  A player has left the game. As the host, you can continue with a replacement or wait for them to return.
                </p>
                
                <div className="space-y-3">
                  <Button
                    onClick={() => {
                      continueGameMutation.mutate();
                    }}
                    className="w-full bg-green-600 hover:bg-green-700"
                    disabled={continueGameMutation.isPending}
                  >
                    <Play size={16} className="mr-2" />
                    Continue Game
                  </Button>
                  
                  {spectators.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Or select a spectator to replace:</p>
                      {spectators.map(spectator => (
                        <Button
                          key={spectator.id}
                          onClick={() => {
                            const vacantPosition = xoState.xPlayerId && !players.find(p => p.id === xoState.xPlayerId && !p.isSpectator && !p.hasLeft) ? 0 : 1;
                            assignSpectatorMutation.mutate({ spectatorId: spectator.id, position: vacantPosition });
                          }}
                          disabled={assignSpectatorMutation.isPending}
                          variant="outline"
                          className="w-full"
                        >
                          <UserPlus size={14} className="mr-2" />
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
            </Card>
          </div>
        )}

        {/* Round End Popup - horizontal layout */}
        {showRoundEnd && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <Card className="px-6 py-4 bg-white dark:bg-gray-800 shadow-xl">
              {roundWinner ? (
                <div className="flex items-center gap-4">
                  <span className="text-2xl">🎉</span>
                  <span className="font-bold text-lg">{roundWinner} Wins!</span>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => resetGameMutation.mutate()}
                      className="bg-green-600 hover:bg-green-700 text-sm"
                      size="sm"
                      data-testid="button-play-again"
                    >
                      Play Again
                    </Button>
                    <Link href="/xo">
                      <Button 
                        variant="outline" 
                        size="sm"
                        data-testid="button-home"
                      >
                        Home
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <span className="text-2xl">🤝</span>
                  <span className="font-bold text-lg">It's a Draw!</span>
                  {drawCountdown !== null && (
                    <span className="text-gray-500 dark:text-gray-400">Next in {drawCountdown}s</span>
                  )}
                  <Link href="/xo">
                    <Button 
                      variant="outline" 
                      size="sm"
                      data-testid="button-exit"
                    >
                      Exit
                    </Button>
                  </Link>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
