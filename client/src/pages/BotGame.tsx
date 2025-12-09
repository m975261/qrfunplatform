import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Bot, RotateCcw, Home } from "lucide-react";
import GameCard from "@/components/game/Card";
import type { Card as UnoCard } from "@shared/schema";

type CardColor = "red" | "blue" | "green" | "yellow";
type GameStatus = "nickname" | "playing" | "finished";

interface BotGameState {
  playerHand: UnoCard[];
  botHand: UnoCard[];
  deck: UnoCard[];
  discardPile: UnoCard[];
  currentColor: CardColor;
  currentTurn: "player" | "bot";
  pendingDraw: number;
  direction: "clockwise" | "counterclockwise";
  winner: "player" | "bot" | null;
  playerCalledUno: boolean;
  botCalledUno: boolean;
  playerJustDrew: boolean;
  lastDrawnCard: UnoCard | null;
}

const COLORS: CardColor[] = ["red", "blue", "green", "yellow"];

function createDeck(): UnoCard[] {
  const deck: UnoCard[] = [];
  
  for (const color of COLORS) {
    deck.push({ type: "number", color, number: 0 });
    for (let num = 1; num <= 9; num++) {
      deck.push({ type: "number", color, number: num });
      deck.push({ type: "number", color, number: num });
    }
    for (let i = 0; i < 2; i++) {
      deck.push({ type: "skip", color });
      deck.push({ type: "reverse", color });
      deck.push({ type: "draw2", color });
    }
  }
  
  for (let i = 0; i < 4; i++) {
    deck.push({ type: "wild", color: "wild" });
    deck.push({ type: "wild4", color: "wild" });
  }
  
  return deck;
}

function shuffleDeck(deck: UnoCard[]): UnoCard[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function canPlayCard(card: UnoCard, topCard: UnoCard, currentColor: CardColor): boolean {
  if (card.type === "wild" || card.type === "wild4") {
    return true;
  }
  if (card.color === currentColor) {
    return true;
  }
  if (card.type === topCard.type && card.type !== "number") {
    return true;
  }
  if (card.type === "number" && topCard.type === "number" && card.number === topCard.number) {
    return true;
  }
  return false;
}

function getPlayableCards(hand: UnoCard[], topCard: UnoCard, currentColor: CardColor): number[] {
  return hand.map((card, index) => canPlayCard(card, topCard, currentColor) ? index : -1).filter(i => i !== -1);
}

export default function BotGame() {
  const [, setLocation] = useLocation();
  const [gameStatus, setGameStatus] = useState<GameStatus>("nickname");
  const [nickname, setNickname] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<'male' | 'female'>('male');
  const [gameState, setGameState] = useState<BotGameState | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingWildCard, setPendingWildCard] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [botThinking, setBotThinking] = useState(false);
  const [pendingUnoPenalty, setPendingUnoPenalty] = useState(false);

  const initializeGame = useCallback(() => {
    let deck = shuffleDeck(createDeck());
    const playerHand = deck.splice(0, 7);
    const botHand = deck.splice(0, 7);
    
    let firstCard = deck.pop()!;
    while (firstCard.type === "wild4") {
      deck.unshift(firstCard);
      deck = shuffleDeck(deck);
      firstCard = deck.pop()!;
    }
    
    let startColor: CardColor = firstCard.color as CardColor;
    if (firstCard.type === "wild") {
      startColor = COLORS[Math.floor(Math.random() * 4)];
    }
    
    setGameState({
      playerHand,
      botHand,
      deck,
      discardPile: [firstCard],
      currentColor: startColor,
      currentTurn: "player",
      pendingDraw: 0,
      direction: "clockwise",
      winner: null,
      playerCalledUno: false,
      botCalledUno: false,
      playerJustDrew: false,
      lastDrawnCard: null
    });
    setMessage("Your turn! Play a card or draw.");
  }, []);

  const startGame = () => {
    if (!nickname.trim()) return;
    localStorage.setItem("playerNickname", nickname);
    localStorage.setItem("botGameAvatar", selectedAvatar);
    setGameStatus("playing");
    initializeGame();
  };

  useEffect(() => {
    const savedNickname = localStorage.getItem("playerNickname");
    if (savedNickname) {
      setNickname(savedNickname);
    }
    const savedAvatar = localStorage.getItem("botGameAvatar");
    if (savedAvatar === "male" || savedAvatar === "female") {
      setSelectedAvatar(savedAvatar);
    }
  }, []);

  const drawCards = useCallback((count: number, forPlayer: "player" | "bot", clearPending: boolean = true): UnoCard[] => {
    if (!gameState) return [];
    
    let { deck, discardPile } = gameState;
    const drawnCards: UnoCard[] = [];
    
    for (let i = 0; i < count; i++) {
      if (deck.length === 0) {
        if (discardPile.length <= 1) break;
        const topCard = discardPile.pop()!;
        deck = shuffleDeck(discardPile);
        discardPile = [topCard];
      }
      if (deck.length > 0) {
        drawnCards.push(deck.pop()!);
      }
    }
    
    setGameState(prev => {
      if (!prev) return prev;
      const newState = {
        ...prev,
        deck,
        discardPile,
        [forPlayer === "player" ? "playerHand" : "botHand"]: [
          ...prev[forPlayer === "player" ? "playerHand" : "botHand"],
          ...drawnCards
        ],
        pendingDraw: clearPending ? 0 : prev.pendingDraw,
        playerCalledUno: forPlayer === "player" ? false : prev.playerCalledUno,
        botCalledUno: forPlayer === "bot" ? false : prev.botCalledUno
      };
      return newState;
    });
    
    return drawnCards;
  }, [gameState]);

  const handlePlayerDraw = useCallback(() => {
    if (!gameState || gameState.currentTurn !== "player" || gameState.winner) return;
    if (gameState.playerJustDrew) return;
    
    if (gameState.pendingDraw > 0) {
      const drawCount = gameState.pendingDraw;
      drawCards(drawCount, "player", true);
      setMessage(`You drew ${drawCount} cards. Bot's turn!`);
      setTimeout(() => {
        setGameState(prev => prev ? { ...prev, currentTurn: "bot", playerJustDrew: false, lastDrawnCard: null } : prev);
      }, 500);
    } else {
      const drawnCards = drawCards(1, "player", false);
      if (drawnCards.length > 0) {
        const drawnCard = drawnCards[0];
        const topCard = gameState.discardPile[gameState.discardPile.length - 1];
        const canPlay = canPlayCard(drawnCard, topCard, gameState.currentColor);
        
        setGameState(prev => prev ? { 
          ...prev, 
          playerJustDrew: true, 
          lastDrawnCard: drawnCard 
        } : prev);
        
        if (canPlay) {
          setMessage(`You drew a playable card! Play it or pass.`);
        } else {
          setMessage(`You drew a card you can't play. Passing turn...`);
          setTimeout(() => {
            setGameState(prev => prev ? { ...prev, currentTurn: "bot", playerJustDrew: false, lastDrawnCard: null } : prev);
          }, 800);
        }
      }
    }
  }, [gameState, drawCards]);

  const handlePassTurn = useCallback(() => {
    if (!gameState || gameState.currentTurn !== "player") return;
    setMessage("You passed. Bot's turn!");
    setGameState(prev => prev ? { ...prev, currentTurn: "bot", playerJustDrew: false, lastDrawnCard: null } : prev);
  }, [gameState]);

  const applyCardEffect = useCallback((card: UnoCard, playedBy: "player" | "bot", newHandLength: number, chosenColor?: CardColor) => {
    setGameState(prev => {
      if (!prev) return prev;
      
      let newDirection = prev.direction;
      let newPendingDraw = prev.pendingDraw;
      let nextTurn: "player" | "bot" = playedBy === "player" ? "bot" : "player";
      let newColor = chosenColor || (card.color === "wild" ? prev.currentColor : card.color as CardColor);
      
      if (card.type === "reverse") {
        newDirection = prev.direction === "clockwise" ? "counterclockwise" : "clockwise";
        nextTurn = playedBy;
      }
      
      if (card.type === "skip") {
        nextTurn = playedBy;
      }
      
      if (card.type === "draw2") {
        newPendingDraw = prev.pendingDraw + 2;
      }
      
      if (card.type === "wild4") {
        newPendingDraw = prev.pendingDraw + 4;
      }
      
      let winner: "player" | "bot" | null = null;
      if (newHandLength === 0) {
        winner = playedBy;
      }
      
      return {
        ...prev,
        currentColor: newColor,
        direction: newDirection,
        pendingDraw: newPendingDraw,
        currentTurn: winner ? prev.currentTurn : nextTurn,
        winner,
        playerCalledUno: playedBy === "player" && newHandLength === 1 ? false : prev.playerCalledUno,
        botCalledUno: playedBy === "bot" && newHandLength === 1 ? true : prev.botCalledUno
      };
    });
  }, []);

  const playCard = useCallback((cardIndex: number, isPlayer: boolean, chosenColor?: CardColor) => {
    if (!gameState) return;
    
    const hand = isPlayer ? gameState.playerHand : gameState.botHand;
    const card = hand[cardIndex];
    
    if ((card.type === "wild" || card.type === "wild4") && !chosenColor) {
      if (isPlayer) {
        setPendingWildCard(cardIndex);
        setShowColorPicker(true);
      }
      return;
    }
    
    const newHand = [...hand];
    const playedCard = { ...newHand.splice(cardIndex, 1)[0] };
    
    const currentHandLength = hand.length;
    
    setGameState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [isPlayer ? "playerHand" : "botHand"]: newHand,
        discardPile: [...prev.discardPile, playedCard],
        playerJustDrew: false,
        lastDrawnCard: null
      };
    });
    
    const cardName = card.type === "number" ? `${card.color} ${card.number}` : `${card.color || ''} ${card.type}`;
    setMessage(isPlayer ? `You played ${cardName}` : `Bot played ${cardName}`);
    
    const needsUnoPenalty = isPlayer && currentHandLength === 2 && !gameState.playerCalledUno;
    if (needsUnoPenalty) {
      setPendingUnoPenalty(true);
    }
    
    applyCardEffect(playedCard, isPlayer ? "player" : "bot", newHand.length, chosenColor);
  }, [gameState, applyCardEffect]);

  const handleColorChoice = (color: CardColor) => {
    setShowColorPicker(false);
    if (pendingWildCard !== null) {
      playCard(pendingWildCard, true, color);
      setPendingWildCard(null);
    }
  };

  const handleCardClick = (cardIndex: number) => {
    if (!gameState || gameState.currentTurn !== "player" || gameState.winner) return;
    
    const card = gameState.playerHand[cardIndex];
    const topCard = gameState.discardPile[gameState.discardPile.length - 1];
    
    if (gameState.playerJustDrew) {
      const drawnCardIndex = gameState.playerHand.length - 1;
      if (cardIndex !== drawnCardIndex) {
        setMessage("After drawing, you can only play the drawn card or pass!");
        return;
      }
      if (!gameState.lastDrawnCard || !canPlayCard(gameState.lastDrawnCard, topCard, gameState.currentColor)) {
        setMessage("The drawn card cannot be played. Pass your turn.");
        return;
      }
      playCard(cardIndex, true);
      return;
    }
    
    if (gameState.pendingDraw > 0) {
      if (card.type === "draw2" && topCard.type === "draw2") {
        playCard(cardIndex, true);
        return;
      }
      if (card.type === "wild4") {
        playCard(cardIndex, true);
        return;
      }
      setMessage(`You must draw ${gameState.pendingDraw} cards or play a stacking card!`);
      return;
    }
    
    if (!canPlayCard(card, topCard, gameState.currentColor)) {
      setMessage("You can't play that card! Match color or value.");
      return;
    }
    
    playCard(cardIndex, true);
  };

  const callUno = () => {
    if (!gameState || gameState.playerCalledUno) return;
    
    if (gameState.playerHand.length > 2) {
      setMessage("False UNO call! Draw 2 penalty cards!");
      drawCards(2, "player", false);
      return;
    }
    
    setGameState(prev => prev ? { ...prev, playerCalledUno: true } : prev);
    setMessage("UNO!");
  };

  const botPlay = useCallback(() => {
    if (!gameState || gameState.currentTurn !== "bot" || gameState.winner) return;
    
    setBotThinking(true);
    
    setTimeout(() => {
      const topCard = gameState.discardPile[gameState.discardPile.length - 1];
      
      if (gameState.pendingDraw > 0) {
        const stackableCards = gameState.botHand
          .map((card, index) => ({ card, index }))
          .filter(({ card }) => 
            (card.type === "draw2" && topCard.type === "draw2") || 
            card.type === "wild4"
          );
        
        if (stackableCards.length > 0) {
          const choice = stackableCards[0];
          if (choice.card.type === "wild4") {
            const colorCounts = COLORS.map(c => ({
              color: c,
              count: gameState.botHand.filter(card => card.color === c).length
            }));
            const bestColor = colorCounts.sort((a, b) => b.count - a.count)[0].color;
            playCard(choice.index, false, bestColor);
          } else {
            playCard(choice.index, false);
          }
          setBotThinking(false);
          return;
        }
        
        drawCards(gameState.pendingDraw, "bot");
        setMessage(`Bot drew ${gameState.pendingDraw} cards. Your turn!`);
        setGameState(prev => prev ? { ...prev, currentTurn: "player", pendingDraw: 0 } : prev);
        setBotThinking(false);
        return;
      }
      
      const playableIndices = getPlayableCards(gameState.botHand, topCard, gameState.currentColor);
      
      if (playableIndices.length === 0) {
        drawCards(1, "bot");
        setMessage("Bot drew a card. Your turn!");
        setTimeout(() => {
          setGameState(prev => prev ? { ...prev, currentTurn: "player" } : prev);
        }, 300);
        setBotThinking(false);
        return;
      }
      
      const actionCards = playableIndices.filter(i => {
        const card = gameState.botHand[i];
        return card.type === "skip" || card.type === "reverse" || card.type === "draw2";
      });
      
      const colorMatchCards = playableIndices.filter(i => {
        const card = gameState.botHand[i];
        return card.color === gameState.currentColor && card.type === "number";
      });
      
      const wildCards = playableIndices.filter(i => {
        const card = gameState.botHand[i];
        return card.type === "wild" || card.type === "wild4";
      });
      
      let chosenIndex: number;
      
      if (gameState.botHand.length <= 3 && actionCards.length > 0) {
        chosenIndex = actionCards[0];
      } else if (colorMatchCards.length > 0) {
        chosenIndex = colorMatchCards[Math.floor(Math.random() * colorMatchCards.length)];
      } else if (actionCards.length > 0) {
        chosenIndex = actionCards[0];
      } else if (wildCards.length > 0 && (gameState.botHand.length <= 4 || playableIndices.length === wildCards.length)) {
        chosenIndex = wildCards[0];
      } else {
        const nonWildPlayable = playableIndices.filter(i => {
          const card = gameState.botHand[i];
          return card.type !== "wild" && card.type !== "wild4";
        });
        chosenIndex = nonWildPlayable.length > 0 
          ? nonWildPlayable[Math.floor(Math.random() * nonWildPlayable.length)]
          : playableIndices[0];
      }
      
      const chosenCard = gameState.botHand[chosenIndex];
      
      if (chosenCard.type === "wild" || chosenCard.type === "wild4") {
        const colorCounts = COLORS.map(c => ({
          color: c,
          count: gameState.botHand.filter(card => card.color === c).length
        }));
        const bestColor = colorCounts.sort((a, b) => b.count - a.count)[0].color;
        playCard(chosenIndex, false, bestColor);
      } else {
        playCard(chosenIndex, false);
      }
      
      setBotThinking(false);
    }, 1000 + Math.random() * 1000);
  }, [gameState, playCard, drawCards]);

  useEffect(() => {
    if (pendingUnoPenalty && gameState) {
      const timer = setTimeout(() => {
        setMessage("Bot challenges: You didn't call UNO! Draw 2 cards!");
        drawCards(2, "player", false);
        setPendingUnoPenalty(false);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [pendingUnoPenalty, gameState, drawCards]);

  useEffect(() => {
    if (gameState?.currentTurn === "bot" && !gameState.winner && !pendingUnoPenalty) {
      const timer = setTimeout(botPlay, 500);
      return () => clearTimeout(timer);
    }
  }, [gameState?.currentTurn, gameState?.winner, botPlay, pendingUnoPenalty]);

  useEffect(() => {
    if (gameState?.winner) {
      setGameStatus("finished");
      setMessage(gameState.winner === "player" ? "You won!" : "Bot wins!");
    }
  }, [gameState?.winner]);

  const getColorClass = (color: CardColor) => {
    switch (color) {
      case "red": return "bg-red-500";
      case "blue": return "bg-blue-500";
      case "green": return "bg-green-500";
      case "yellow": return "bg-yellow-500";
    }
  };

  if (gameStatus === "nickname") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-uno-blue via-uno-purple to-uno-red flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white/95 backdrop-blur-sm shadow-2xl">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <Button
                variant="ghost"
                onClick={() => setLocation("/")}
                className="mb-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <h1 className="font-fredoka text-3xl bg-gradient-to-r from-uno-red to-uno-yellow bg-clip-text text-transparent mb-2">
                Play vs Bot
              </h1>
              <p className="text-gray-600">1 vs 1 UNO against AI</p>
            </div>

            <div className="space-y-6">
              <div>
                <Label htmlFor="nickname">Your Nickname</Label>
                <Input
                  id="nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Enter your nickname..."
                  maxLength={20}
                  className="mt-2"
                  onKeyDown={(e) => e.key === "Enter" && startGame()}
                  data-testid="input-nickname"
                />
              </div>

              <div>
                <Label className="block mb-3">Choose Avatar</Label>
                <div className="flex justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => setSelectedAvatar('male')}
                    className={`w-16 h-16 rounded-full border-4 transition-all flex items-center justify-center text-2xl ${
                      selectedAvatar === 'male' 
                        ? 'border-blue-500 bg-blue-50 shadow-lg scale-110' 
                        : 'border-gray-300 bg-white hover:border-gray-400'
                    }`}
                    data-testid="button-avatar-male"
                  >
                    👨
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedAvatar('female')}
                    className={`w-16 h-16 rounded-full border-4 transition-all flex items-center justify-center text-2xl ${
                      selectedAvatar === 'female' 
                        ? 'border-pink-500 bg-pink-50 shadow-lg scale-110' 
                        : 'border-gray-300 bg-white hover:border-gray-400'
                    }`}
                    data-testid="button-avatar-female"
                  >
                    👩
                  </button>
                </div>
              </div>

              <Button
                onClick={startGame}
                disabled={!nickname.trim()}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-medium text-lg h-14"
                data-testid="button-start-game"
              >
                <Bot className="w-5 h-5 mr-2" />
                Start Game
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!gameState) return null;

  const topCard = gameState.discardPile[gameState.discardPile.length - 1];
  const playableCards = gameState.currentTurn === "player" && !gameState.winner
    ? getPlayableCards(gameState.playerHand, topCard, gameState.currentColor)
    : [];

  const isMyTurn = gameState.currentTurn === "player" && !gameState.winner;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 via-green-700 to-green-900 p-4 flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <Button
          variant="outline"
          onClick={() => setLocation("/")}
          className="bg-white/20 text-white border-white/30 hover:bg-white/30"
          data-testid="button-home"
        >
          <Home className="w-4 h-4 mr-2" />
          Home
        </Button>
        
        <div className="text-white text-center">
          <div className="font-bold text-lg">{message}</div>
        </div>
        
        <Button
          variant="outline"
          onClick={initializeGame}
          className="bg-white/20 text-white border-white/30 hover:bg-white/30"
          data-testid="button-restart"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Restart
        </Button>
      </div>

      <div className="flex-1 flex flex-col justify-between">
        <div className="mb-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-2xl border-4 border-gray-600">
              🤖
            </div>
            <div className="text-white font-bold">
              Bot {gameState.botHand.length === 1 && gameState.botCalledUno && <span className="text-yellow-400 ml-2">UNO!</span>}
            </div>
            <div className="text-white/70 text-sm">({gameState.botHand.length} cards)</div>
            {botThinking && <div className="text-yellow-300 animate-pulse ml-2">Thinking...</div>}
          </div>
          <div className="flex justify-center gap-1 flex-wrap max-w-md mx-auto">
            {gameState.botHand.map((_, index) => (
              <div
                key={index}
                className="w-10 h-14 bg-gradient-to-br from-red-600 via-red-500 to-red-700 rounded-lg border-2 border-red-800 shadow-lg flex items-center justify-center"
              >
                <span className="text-white font-bold text-[8px] transform -rotate-12">UNO</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center items-center gap-8 my-6">
          <div className="text-center">
            <div className="text-white/70 text-sm mb-2">Deck ({gameState.deck.length})</div>
            <button
              onClick={handlePlayerDraw}
              disabled={gameState.currentTurn !== "player" || !!gameState.winner || gameState.playerJustDrew}
              className="w-20 h-28 bg-gradient-to-br from-red-600 via-red-500 to-red-700 rounded-xl border-4 border-red-800 shadow-xl hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center"
              data-testid="button-draw"
            >
              <span className="text-white font-bold text-lg transform -rotate-12 drop-shadow-lg">UNO</span>
              <span className="text-white/80 font-medium text-[10px] mt-1">DRAW</span>
            </button>
            {gameState.playerJustDrew && gameState.lastDrawnCard && canPlayCard(gameState.lastDrawnCard, topCard, gameState.currentColor) && (
              <Button
                onClick={handlePassTurn}
                className="mt-2 bg-orange-500 hover:bg-orange-600 text-white font-bold"
                size="sm"
                data-testid="button-pass-turn"
              >
                Pass Turn
              </Button>
            )}
          </div>

          <div className="text-center">
            {topCard && (
              <GameCard card={topCard} size="medium" />
            )}
            <div className={`w-10 h-10 rounded-full ${getColorClass(gameState.currentColor)} border-3 border-white shadow-lg mx-auto mt-2`} />
            <div className="text-white capitalize text-sm mt-1">{gameState.currentColor}</div>
            
            {/* YOUR TURN Indicator - centered under current color with good spacing */}
            {!gameState.winner && isMyTurn && (
              <div className={`mt-6 px-5 py-3 rounded-full shadow-lg border-2 transition-all ${
                gameState.pendingDraw > 0 ? 'bg-red-600 border-red-400 animate-pulse' : 'bg-green-600 border-green-400 animate-pulse'
              }`}>
                <div className="text-white font-bold text-base text-center">
                  {gameState.pendingDraw > 0 ? (
                    <span>⚠️ MUST DRAW {gameState.pendingDraw} CARDS! ⚠️</span>
                  ) : (
                    <span>⭐ YOUR TURN ⭐</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-auto">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className={`w-12 h-12 rounded-full ${selectedAvatar === 'male' ? 'bg-blue-500' : 'bg-pink-500'} flex items-center justify-center text-2xl border-4 border-white`}>
              {selectedAvatar === 'male' ? '👨' : '👩'}
            </div>
            <div className="text-white font-bold">{nickname}</div>
            <div className="text-white/70 text-sm">({gameState.playerHand.length} cards)</div>
            <Button
              onClick={callUno}
              disabled={gameState.playerCalledUno}
              className={`ml-2 font-bold ${
                gameState.playerCalledUno 
                  ? 'bg-green-500 text-white cursor-default' 
                  : gameState.playerHand.length <= 2 
                    ? 'bg-yellow-500 hover:bg-yellow-600 text-black animate-pulse' 
                    : 'bg-yellow-500 hover:bg-yellow-600 text-black'
              }`}
              size="sm"
              data-testid="button-call-uno"
            >
              {gameState.playerCalledUno ? '✓ UNO!' : 'Call UNO!'}
            </Button>
          </div>
          
          <div className="flex justify-center gap-2 flex-wrap px-4 pb-4">
            {gameState.playerHand.map((card, index) => (
              <div
                key={index}
                className={`transition-all ${playableCards.includes(index) ? 'ring-2 ring-yellow-400 rounded-xl' : ''}`}
              >
                <GameCard
                  card={card}
                  size="medium"
                  interactive={gameState.currentTurn === "player" && !gameState.winner}
                  disabled={gameState.currentTurn !== "player" || !!gameState.winner}
                  onClick={() => handleCardClick(index)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={showColorPicker} onOpenChange={setShowColorPicker}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Choose a Color</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 p-4">
            {COLORS.map((color) => (
              <button
                key={color}
                onClick={() => handleColorChoice(color)}
                className={`${getColorClass(color)} h-20 rounded-xl text-white font-bold text-lg capitalize hover:scale-105 transition-transform shadow-lg`}
                data-testid={`button-color-${color}`}
              >
                {color}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {gameState.winner && (
        <Dialog open={true}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center text-2xl">
                {gameState.winner === "player" ? "🎉 You Won! 🎉" : "🤖 Bot Wins!"}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 pt-4">
              <Button
                onClick={initializeGame}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                data-testid="button-play-again"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Play Again
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/")}
                data-testid="button-back-home"
              >
                <Home className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
