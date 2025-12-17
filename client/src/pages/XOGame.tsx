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
        setShowRoundEnd(true);
      } else if (data.xoState.isDraw) {
        setRoundWinner(null);
        setShowRoundEnd(true);
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
        setShowRoundEnd(true);
      } else if (data.xoState.isDraw) {
        setRoundWinner(null);
        setShowRoundEnd(true);
      }
    },
  });

  const nextRoundMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/xo/rooms/${roomId}/next-round`);
      return response.json();
    },
    onSuccess: () => {
      setShowRoundEnd(false);
      setRoundWinner(null);
      queryClient.invalidateQueries({ queryKey: ['/api/xo/rooms', roomId] });
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
      <div className="max-w-lg mx-auto">
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
              <div className="text-xs text-gray-400">Win {xoState.winLength} in a row</div>
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
            className="mx-auto"
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
          </div>
        </Card>

        {/* Round End Modal */}
        {showRoundEnd && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-sm w-full p-6 bg-white dark:bg-gray-800 text-center">
              <div className="text-6xl mb-4">
                {roundWinner ? '🎉' : '🤝'}
              </div>
              <h2 className="text-2xl font-bold mb-2">
                {roundWinner ? `${roundWinner} Wins!` : "It's a Draw!"}
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {xoState.boardSize < 6 && roundWinner && (
                  <>Next round: {xoState.boardSize + 1}×{xoState.boardSize + 1} board!</>
                )}
                {xoState.boardSize >= 6 && roundWinner && (
                  <>Maximum board size reached!</>
                )}
              </p>
              <div className="space-y-2">
                {xoState.boardSize < 6 && (roundWinner || xoState.isDraw) && (
                  <Button 
                    onClick={() => nextRoundMutation.mutate()}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600"
                    data-testid="button-next-round"
                  >
                    <Zap size={18} className="mr-2" />
                    {roundWinner ? "Next Round!" : "Play Again"}
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  onClick={() => resetGameMutation.mutate()}
                  className="w-full"
                  data-testid="button-new-game"
                >
                  New Game (3×3)
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
