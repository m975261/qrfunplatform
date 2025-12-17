import { useEffect, useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, RotateCcw, Trophy, Zap } from "lucide-react";
import { Link } from "wouter";
import { XOGameState, XOCell } from "@shared/schema";

interface Player {
  id: string;
  nickname: string;
  position: number;
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
  const { toast } = useToast();
  const [showRoundEnd, setShowRoundEnd] = useState(false);
  const [roundWinner, setRoundWinner] = useState<string | null>(null);
  const [drawCountdown, setDrawCountdown] = useState<number | null>(null);
  const [showWinAnimation, setShowWinAnimation] = useState(false);
  const [winCountdown, setWinCountdown] = useState<number | null>(null);
  const [lastProcessedGameNumber, setLastProcessedGameNumber] = useState<number | null>(null);
  
  const playerId = localStorage.getItem("xo_playerId");

  const { data, isLoading, refetch } = useQuery<{ room: Room; players: Player[] }>({
    queryKey: ['/api/xo/rooms', roomId],
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
      toast({
        title: "Invalid Move",
        description: error.message || "That move is not allowed",
        variant: "destructive",
      });
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
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/xo/rooms/${roomId}/next-round`);
      return response.json();
    },
    onSuccess: (data) => {
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
      nextRoundMutation.mutate();
    }
  }, [drawCountdown, xoState?.isDraw, xoState?.boardSize, nextRoundMutation.isPending]);

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

  const handleCellClick = (row: number, col: number) => {
    if (!isMyTurn || xoState?.board[row][col] || xoState?.winner || xoState?.isDraw) return;
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

        {/* Game Info */}
        <Card className="p-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-0 shadow-xl mb-4">
          <div className="flex justify-between items-center">
            <div className="text-center flex-1">
              <div className="text-2xl mb-1">❌</div>
              <div className="font-medium text-sm">{xPlayerName}</div>
              <div className="text-2xl font-bold text-blue-600">{xoState.scores.x}</div>
            </div>
            <div className="text-center px-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">Round {xoState.gameNumber}</div>
              <div className="text-lg font-bold">{boardSize}×{boardSize}</div>
              <div className="text-sm font-semibold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-2 py-1 rounded-full mt-1">
                🎯 {xoState.winLength} in a row to win!
              </div>
            </div>
            <div className="text-center flex-1">
              <div className="text-2xl mb-1">⭕</div>
              <div className="font-medium text-sm">{oPlayerName}</div>
              <div className="text-2xl font-bold text-purple-600">{xoState.scores.o}</div>
            </div>
          </div>
          <div className="text-center mt-3 text-sm text-gray-500 dark:text-gray-400">
            Draws: {xoState.scores.draws}
          </div>
        </Card>

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

        {/* Round End Popup - small, positioned to the right */}
        {showRoundEnd && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-50">
            <Card className="p-3 bg-white dark:bg-gray-800 shadow-lg text-center w-32">
              <div className="text-2xl mb-1">
                {roundWinner ? '🎉' : '🤝'}
              </div>
              <h3 className="text-sm font-bold mb-1">
                {roundWinner ? `${roundWinner} Wins!` : "Draw!"}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-xs mb-2">
                {xoState.boardSize < 6 && roundWinner && !(isBotGame && xoState.winner === "O") && (
                  <>Next: {xoState.boardSize + 1}×{xoState.boardSize + 1}</>
                )}
                {xoState.boardSize >= 6 && roundWinner && <>Max size!</>}
                {isBotGame && xoState.winner === "O" && <>Try again?</>}
                {xoState.isDraw && xoState.boardSize < 6 && drawCountdown !== null && (
                  <>Next in {drawCountdown}s</>
                )}
              </p>
              <div className="space-y-1">
                {xoState.boardSize < 6 && roundWinner && !(isBotGame && xoState.winner === "O") && (
                  <Button 
                    onClick={() => nextRoundMutation.mutate()}
                    className="w-full bg-green-600 hover:bg-green-700 text-xs py-1 h-7"
                    size="sm"
                    data-testid="button-next-round"
                  >
                    Next
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  onClick={() => resetGameMutation.mutate()}
                  className="w-full text-xs py-1 h-7"
                  size="sm"
                  data-testid="button-play-again"
                >
                  Restart
                </Button>
                <Link href="/xo" className="block">
                  <Button 
                    variant="ghost" 
                    className="w-full text-xs py-1 h-7"
                    size="sm"
                    data-testid="button-home"
                  >
                    Home
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
