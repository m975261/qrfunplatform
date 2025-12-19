import { XOGameState, XOSettings, XOPlayer, XOCell } from "@shared/types";

export type XOBoard = XOCell[][];

export interface XOMove {
  row: number;
  col: number;
}

export interface BoardProgression {
  size: number;
  winLength: number;
}

const BOARD_PROGRESSIONS: BoardProgression[] = [
  { size: 3, winLength: 3 },
  { size: 4, winLength: 4 },
  { size: 5, winLength: 4 },
  { size: 6, winLength: 5 },
];

export class XOGameLogic {
  static createInitialState(xPlayerId: string | null, oPlayerId: string | null): XOGameState {
    return {
      board: this.createEmptyBoard(3),
      boardSize: 3,
      winLength: 3,
      currentPlayer: "X",
      winner: null,
      winningLine: null,
      moveHistory: [],
      isDraw: false,
      gameNumber: 1,
      xPlayerId,
      oPlayerId,
      scores: { x: 0, o: 0, draws: 0 },
    };
  }

  static createEmptyBoard(size: number): XOBoard {
    return Array(size).fill(null).map(() => Array(size).fill(null));
  }

  static cloneBoard(board: XOBoard): XOBoard {
    return board.map(row => [...row]);
  }

  static isValidMove(board: XOBoard, row: number, col: number): boolean {
    if (row < 0 || row >= board.length || col < 0 || col >= board.length) {
      return false;
    }
    return board[row][col] === null;
  }

  static makeMove(state: XOGameState, row: number, col: number): XOGameState | null {
    if (!this.isValidMove(state.board, row, col)) {
      return null;
    }
    if (state.winner || state.isDraw) {
      return null;
    }

    const newBoard = this.cloneBoard(state.board);
    newBoard[row][col] = state.currentPlayer;

    const newMoveHistory = [...state.moveHistory, { row, col, player: state.currentPlayer }];

    const winResult = this.checkWin(newBoard, state.winLength);
    if (winResult) {
      const newScores = { ...state.scores };
      if (winResult.winner === "X") newScores.x++;
      else newScores.o++;

      return {
        ...state,
        board: newBoard,
        moveHistory: newMoveHistory,
        winner: winResult.winner,
        winningLine: winResult.line,
        scores: newScores,
      };
    }

    if (this.isBoardFull(newBoard)) {
      return {
        ...state,
        board: newBoard,
        moveHistory: newMoveHistory,
        isDraw: true,
        scores: { ...state.scores, draws: state.scores.draws + 1 },
      };
    }

    return {
      ...state,
      board: newBoard,
      moveHistory: newMoveHistory,
      currentPlayer: state.currentPlayer === "X" ? "O" : "X",
    };
  }

  static isBoardFull(board: XOBoard): boolean {
    return board.every(row => row.every(cell => cell !== null));
  }

  static checkWin(board: XOBoard, winLength: number): { winner: XOPlayer; line: XOMove[] } | null {
    const size = board.length;

    for (let row = 0; row < size; row++) {
      for (let col = 0; col <= size - winLength; col++) {
        const cell = board[row][col];
        if (cell && this.checkLine(board, row, col, 0, 1, winLength, cell)) {
          return {
            winner: cell,
            line: Array(winLength).fill(null).map((_, i) => ({ row, col: col + i })),
          };
        }
      }
    }

    for (let row = 0; row <= size - winLength; row++) {
      for (let col = 0; col < size; col++) {
        const cell = board[row][col];
        if (cell && this.checkLine(board, row, col, 1, 0, winLength, cell)) {
          return {
            winner: cell,
            line: Array(winLength).fill(null).map((_, i) => ({ row: row + i, col })),
          };
        }
      }
    }

    for (let row = 0; row <= size - winLength; row++) {
      for (let col = 0; col <= size - winLength; col++) {
        const cell = board[row][col];
        if (cell && this.checkLine(board, row, col, 1, 1, winLength, cell)) {
          return {
            winner: cell,
            line: Array(winLength).fill(null).map((_, i) => ({ row: row + i, col: col + i })),
          };
        }
      }
    }

    for (let row = 0; row <= size - winLength; row++) {
      for (let col = winLength - 1; col < size; col++) {
        const cell = board[row][col];
        if (cell && this.checkLine(board, row, col, 1, -1, winLength, cell)) {
          return {
            winner: cell,
            line: Array(winLength).fill(null).map((_, i) => ({ row: row + i, col: col - i })),
          };
        }
      }
    }

    return null;
  }

  private static checkLine(
    board: XOBoard,
    startRow: number,
    startCol: number,
    rowDir: number,
    colDir: number,
    length: number,
    player: XOPlayer
  ): boolean {
    for (let i = 0; i < length; i++) {
      const row = startRow + i * rowDir;
      const col = startCol + i * colDir;
      if (board[row][col] !== player) {
        return false;
      }
    }
    return true;
  }

  static progressBoard(state: XOGameState): XOGameState {
    const currentIndex = BOARD_PROGRESSIONS.findIndex(p => p.size === state.boardSize);
    const nextIndex = currentIndex + 1;
    const newGameNumber = state.gameNumber + 1;
    
    // Alternate starting player based on game number
    const nextPlayer: XOPlayer = state.gameNumber % 2 === 0 ? "X" : "O";

    // Rounds 1-4: Progress through board sizes (3x3 → 4x4 → 5x5 → 6x6)
    if (nextIndex < BOARD_PROGRESSIONS.length) {
      const nextProgression = BOARD_PROGRESSIONS[nextIndex];
      return {
        ...state,
        board: this.createEmptyBoard(nextProgression.size),
        boardSize: nextProgression.size,
        winLength: nextProgression.winLength,
        currentPlayer: nextPlayer,
        winner: null,
        winningLine: null,
        moveHistory: [],
        isDraw: false,
        gameNumber: newGameNumber,
      };
    }
    
    // Round 5: 6x6 with 5-in-a-row (after round 4 draw)
    if (state.gameNumber === 4) {
      return {
        ...state,
        board: this.createEmptyBoard(6),
        boardSize: 6,
        winLength: 5,
        currentPlayer: nextPlayer,
        winner: null,
        winningLine: null,
        moveHistory: [],
        isDraw: false,
        gameNumber: 5,
      };
    }
    
    // Rounds 6-7: 6x6 with 4-in-a-row (tiebreaker rounds)
    if (state.gameNumber === 5 || state.gameNumber === 6) {
      return {
        ...state,
        board: this.createEmptyBoard(6),
        boardSize: 6,
        winLength: 4,  // 4-in-a-row for tiebreaker rounds
        currentPlayer: nextPlayer,
        winner: null,
        winningLine: null,
        moveHistory: [],
        isDraw: false,
        gameNumber: newGameNumber,
      };
    }
    
    // Rounds 8-9: 6x6 with 3-in-a-row (final tiebreaker rounds)
    if (state.gameNumber === 7 || state.gameNumber === 8) {
      return {
        ...state,
        board: this.createEmptyBoard(6),
        boardSize: 6,
        winLength: 3,  // 3-in-a-row for final tiebreaker rounds
        currentPlayer: nextPlayer,
        winner: null,
        winningLine: null,
        moveHistory: [],
        isDraw: false,
        gameNumber: newGameNumber,
      };
    }
    
    // Round 9 is the final round - if we somehow get here, stay at round 9
    // (This shouldn't happen as round 9 draws should show "Game Over")
    return {
      ...state,
      board: this.createEmptyBoard(6),
      boardSize: 6,
      winLength: 3,
      currentPlayer: nextPlayer,
      winner: null,
      winningLine: null,
      moveHistory: [],
      isDraw: false,
      gameNumber: 9,
    };
  }
  
  // Check if game can progress to next round (rounds 1-8 can progress, round 9 is final)
  static canProgressBoard(state: XOGameState): boolean {
    return state.gameNumber < 9;
  }

  static resetGame(state: XOGameState, swapPlayers: boolean = true): XOGameState {
    return {
      ...state,
      board: this.createEmptyBoard(3),
      boardSize: 3,
      winLength: 3,
      currentPlayer: swapPlayers ? (state.gameNumber % 2 === 0 ? "X" : "O") : "X",
      winner: null,
      winningLine: null,
      moveHistory: [],
      isDraw: false,
      gameNumber: state.gameNumber + 1,
    };
  }

  static getAvailableMoves(board: XOBoard): XOMove[] {
    const moves: XOMove[] = [];
    for (let row = 0; row < board.length; row++) {
      for (let col = 0; col < board.length; col++) {
        if (board[row][col] === null) {
          moves.push({ row, col });
        }
      }
    }
    return moves;
  }

  static generateRoomCode(): string {
    // Generate codes in format AA2BB - first pair same, 2 in middle, last pair same but different from first
    const digits = "0123456789";
    
    const firstPair = digits.charAt(Math.floor(Math.random() * digits.length));
    let lastPair = digits.charAt(Math.floor(Math.random() * digits.length));
    
    // Ensure last pair is different from first pair
    while (lastPair === firstPair) {
      lastPair = digits.charAt(Math.floor(Math.random() * digits.length));
    }
    
    return `${firstPair}${firstPair}2${lastPair}${lastPair}`;
  }
}

export class XOMinimaxAI {
  private maxDepth: number;

  constructor(difficulty: "easy" | "medium" | "hard" | "hardest") {
    switch (difficulty) {
      case "easy": this.maxDepth = 1; break;
      case "medium": this.maxDepth = 3; break;
      case "hard": this.maxDepth = 6; break;
      case "hardest": this.maxDepth = 9; break;
    }
  }

  getMove(state: XOGameState): XOMove | null {
    const availableMoves = XOGameLogic.getAvailableMoves(state.board);
    if (availableMoves.length === 0) return null;

    if (this.maxDepth === 1) {
      const winMove = this.findWinningMove(state.board, state.currentPlayer, state.winLength);
      if (winMove) return winMove;
      const blockMove = this.findWinningMove(state.board, state.currentPlayer === "X" ? "O" : "X", state.winLength);
      if (blockMove) return blockMove;
      return availableMoves[Math.floor(Math.random() * availableMoves.length)];
    }

    let bestMove: XOMove | null = null;
    let bestScore = -Infinity;

    for (const move of availableMoves) {
      const newBoard = XOGameLogic.cloneBoard(state.board);
      newBoard[move.row][move.col] = state.currentPlayer;

      const score = this.minimax(
        newBoard,
        state.winLength,
        0,
        false,
        state.currentPlayer,
        -Infinity,
        Infinity
      );

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  private minimax(
    board: XOBoard,
    winLength: number,
    depth: number,
    isMaximizing: boolean,
    aiPlayer: XOPlayer,
    alpha: number,
    beta: number
  ): number {
    const opponent: XOPlayer = aiPlayer === "X" ? "O" : "X";
    const winResult = XOGameLogic.checkWin(board, winLength);

    if (winResult) {
      return winResult.winner === aiPlayer ? 1000 - depth : depth - 1000;
    }

    if (XOGameLogic.isBoardFull(board)) {
      return 0;
    }

    if (depth >= this.maxDepth) {
      return this.evaluateBoard(board, winLength, aiPlayer);
    }

    const availableMoves = XOGameLogic.getAvailableMoves(board);

    if (isMaximizing) {
      let maxScore = -Infinity;
      for (const move of availableMoves) {
        const newBoard = XOGameLogic.cloneBoard(board);
        newBoard[move.row][move.col] = aiPlayer;
        const score = this.minimax(newBoard, winLength, depth + 1, false, aiPlayer, alpha, beta);
        maxScore = Math.max(maxScore, score);
        alpha = Math.max(alpha, score);
        if (beta <= alpha) break;
      }
      return maxScore;
    } else {
      let minScore = Infinity;
      for (const move of availableMoves) {
        const newBoard = XOGameLogic.cloneBoard(board);
        newBoard[move.row][move.col] = opponent;
        const score = this.minimax(newBoard, winLength, depth + 1, true, aiPlayer, alpha, beta);
        minScore = Math.min(minScore, score);
        beta = Math.min(beta, score);
        if (beta <= alpha) break;
      }
      return minScore;
    }
  }

  private evaluateBoard(board: XOBoard, winLength: number, aiPlayer: XOPlayer): number {
    let score = 0;
    const size = board.length;
    const opponent: XOPlayer = aiPlayer === "X" ? "O" : "X";

    for (let row = 0; row < size; row++) {
      for (let col = 0; col <= size - winLength; col++) {
        score += this.evaluateLine(board, row, col, 0, 1, winLength, aiPlayer, opponent);
      }
    }

    for (let row = 0; row <= size - winLength; row++) {
      for (let col = 0; col < size; col++) {
        score += this.evaluateLine(board, row, col, 1, 0, winLength, aiPlayer, opponent);
      }
    }

    for (let row = 0; row <= size - winLength; row++) {
      for (let col = 0; col <= size - winLength; col++) {
        score += this.evaluateLine(board, row, col, 1, 1, winLength, aiPlayer, opponent);
      }
    }

    for (let row = 0; row <= size - winLength; row++) {
      for (let col = winLength - 1; col < size; col++) {
        score += this.evaluateLine(board, row, col, 1, -1, winLength, aiPlayer, opponent);
      }
    }

    return score;
  }

  private evaluateLine(
    board: XOBoard,
    startRow: number,
    startCol: number,
    rowDir: number,
    colDir: number,
    length: number,
    aiPlayer: XOPlayer,
    opponent: XOPlayer
  ): number {
    let aiCount = 0;
    let oppCount = 0;

    for (let i = 0; i < length; i++) {
      const cell = board[startRow + i * rowDir][startCol + i * colDir];
      if (cell === aiPlayer) aiCount++;
      else if (cell === opponent) oppCount++;
    }

    if (aiCount > 0 && oppCount > 0) return 0;
    if (aiCount > 0) return Math.pow(10, aiCount);
    if (oppCount > 0) return -Math.pow(10, oppCount);
    return 0;
  }

  private findWinningMove(board: XOBoard, player: XOPlayer, winLength: number): XOMove | null {
    const moves = XOGameLogic.getAvailableMoves(board);
    for (const move of moves) {
      const newBoard = XOGameLogic.cloneBoard(board);
      newBoard[move.row][move.col] = player;
      if (XOGameLogic.checkWin(newBoard, winLength)) {
        return move;
      }
    }
    return null;
  }
}

export class XOMCTSAI {
  private simulations: number;
  private difficulty: string;

  constructor(difficulty: "easy" | "medium" | "hard" | "hardest") {
    this.difficulty = difficulty;
    switch (difficulty) {
      case "easy": this.simulations = 200; break;
      case "medium": this.simulations = 800; break;
      case "hard": this.simulations = 2000; break;
      case "hardest": this.simulations = 5000; break;
    }
  }

  getMove(state: XOGameState): XOMove | null {
    const availableMoves = XOGameLogic.getAvailableMoves(state.board);
    if (availableMoves.length === 0) return null;

    const aiPlayer = state.currentPlayer;
    const opponent: XOPlayer = aiPlayer === "X" ? "O" : "X";

    // CRITICAL: Always check for immediate win first
    const winningMove = this.findWinningMove(state.board, aiPlayer, state.winLength);
    if (winningMove) return winningMove;

    // CRITICAL: Always block opponent's winning move
    const blockingMove = this.findWinningMove(state.board, opponent, state.winLength);
    if (blockingMove) return blockingMove;

    // For hard/hardest: Also check for "almost winning" threats (winLength-1 in a row)
    if (this.difficulty === "hard" || this.difficulty === "hardest") {
      // Check for creating a winning threat
      const threatMove = this.findThreatMove(state.board, aiPlayer, state.winLength);
      if (threatMove) return threatMove;

      // Check for blocking opponent's threat
      const blockThreatMove = this.findThreatMove(state.board, opponent, state.winLength);
      if (blockThreatMove) return blockThreatMove;
    }

    // Fall back to MCTS for non-critical moves
    const moveScores = new Map<string, { wins: number; visits: number }>();
    
    for (const move of availableMoves) {
      moveScores.set(`${move.row},${move.col}`, { wins: 0, visits: 0 });
    }

    for (let i = 0; i < this.simulations; i++) {
      const move = availableMoves[Math.floor(Math.random() * availableMoves.length)];
      const key = `${move.row},${move.col}`;
      
      const result = this.simulate(state, move);
      const scores = moveScores.get(key)!;
      scores.visits++;
      if (result === state.currentPlayer) {
        scores.wins++;
      } else if (result === "draw") {
        scores.wins += 0.5;
      }
    }

    let bestMove: XOMove | null = null;
    let bestScore = -Infinity;

    for (const move of availableMoves) {
      const key = `${move.row},${move.col}`;
      const scores = moveScores.get(key)!;
      const score = scores.visits > 0 ? scores.wins / scores.visits : 0;
      
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  private findWinningMove(board: XOBoard, player: XOPlayer, winLength: number): XOMove | null {
    const moves = XOGameLogic.getAvailableMoves(board);
    for (const move of moves) {
      const newBoard = XOGameLogic.cloneBoard(board);
      newBoard[move.row][move.col] = player;
      if (XOGameLogic.checkWin(newBoard, winLength)) {
        return move;
      }
    }
    return null;
  }

  private findThreatMove(board: XOBoard, player: XOPlayer, winLength: number): XOMove | null {
    const moves = XOGameLogic.getAvailableMoves(board);
    const size = board.length;
    
    for (const move of moves) {
      const newBoard = XOGameLogic.cloneBoard(board);
      newBoard[move.row][move.col] = player;
      
      // Check if this creates a threat (winLength-1 in a row with open space)
      if (this.countThreats(newBoard, player, winLength) > this.countThreats(board, player, winLength)) {
        return move;
      }
    }
    return null;
  }

  private countThreats(board: XOBoard, player: XOPlayer, winLength: number): number {
    const size = board.length;
    let threats = 0;
    const needed = winLength - 1;

    // Check all lines for threats (winLength-1 pieces with empty space to complete)
    const checkLine = (startRow: number, startCol: number, dRow: number, dCol: number): boolean => {
      let count = 0;
      let empty = 0;
      for (let i = 0; i < winLength; i++) {
        const r = startRow + i * dRow;
        const c = startCol + i * dCol;
        if (r < 0 || r >= size || c < 0 || c >= size) return false;
        if (board[r][c] === player) count++;
        else if (board[r][c] === null) empty++;
        else return false; // Blocked by opponent
      }
      return count === needed && empty === 1;
    };

    // Horizontal
    for (let row = 0; row < size; row++) {
      for (let col = 0; col <= size - winLength; col++) {
        if (checkLine(row, col, 0, 1)) threats++;
      }
    }
    // Vertical
    for (let row = 0; row <= size - winLength; row++) {
      for (let col = 0; col < size; col++) {
        if (checkLine(row, col, 1, 0)) threats++;
      }
    }
    // Diagonal down-right
    for (let row = 0; row <= size - winLength; row++) {
      for (let col = 0; col <= size - winLength; col++) {
        if (checkLine(row, col, 1, 1)) threats++;
      }
    }
    // Diagonal down-left
    for (let row = 0; row <= size - winLength; row++) {
      for (let col = winLength - 1; col < size; col++) {
        if (checkLine(row, col, 1, -1)) threats++;
      }
    }

    return threats;
  }

  private simulate(state: XOGameState, firstMove: XOMove): XOPlayer | "draw" | null {
    const board = XOGameLogic.cloneBoard(state.board);
    board[firstMove.row][firstMove.col] = state.currentPlayer;

    let currentPlayer: XOPlayer = state.currentPlayer === "X" ? "O" : "X";

    while (true) {
      const winResult = XOGameLogic.checkWin(board, state.winLength);
      if (winResult) return winResult.winner;

      if (XOGameLogic.isBoardFull(board)) return "draw";

      const moves = XOGameLogic.getAvailableMoves(board);
      if (moves.length === 0) return "draw";

      const randomMove = moves[Math.floor(Math.random() * moves.length)];
      board[randomMove.row][randomMove.col] = currentPlayer;
      currentPlayer = currentPlayer === "X" ? "O" : "X";
    }
  }
}

export class XOAIManager {
  static getAI(settings: XOSettings, boardSize: number) {
    const difficulty = settings.isGuruPlayer ? "hardest" : settings.difficulty;

    // Use MCTS for 4x4 and larger boards - minimax is too slow
    if (boardSize <= 3) {
      return new XOMinimaxAI(difficulty);
    } else {
      return new XOMCTSAI(difficulty);
    }
  }

  static shouldUsePerfectMode(settings: XOSettings): boolean {
    return settings.isGuruPlayer || settings.difficulty === "hardest";
  }

  static getMove(state: XOGameState, settings: XOSettings): XOMove | null {
    const ai = this.getAI(settings, state.boardSize);
    return ai.getMove(state);
  }
}
