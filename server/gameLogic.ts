import { Card } from "@shared/types";

export class UnoGameLogic {
  static createDeck(): Card[] {
    const deck: Card[] = [];
    const colors = ["red", "blue", "green", "yellow"] as const;
    
    // Number cards (0-9) - Official UNO Distribution
    for (const color of colors) {
      // One 0 card per color (4 total)
      deck.push({ type: "number", color, number: 0 });
      
      // Two of each number 1-9 per color (72 total)
      for (let number = 1; number <= 9; number++) {
        deck.push({ type: "number", color, number });
        deck.push({ type: "number", color, number });
      }
      
      // Action cards (2 of each per color - 24 total)
      deck.push({ type: "skip", color });
      deck.push({ type: "skip", color });
      deck.push({ type: "reverse", color });
      deck.push({ type: "reverse", color });
      deck.push({ type: "draw2", color });
      deck.push({ type: "draw2", color });
    }
    
    // Wild cards (8 total)
    for (let i = 0; i < 4; i++) {
      deck.push({ type: "wild", color: "wild" });
      deck.push({ type: "wild4", color: "wild" });
    }
    
    // Verify deck size (should be 108 cards)
    if (deck.length !== 108) {
      console.warn(`Warning: UNO deck has ${deck.length} cards instead of 108`);
    }
    
    console.log(`Deck created with ${deck.length} cards including ${deck.filter(c => c.type === 'wild4').length} Wild Draw 4 cards`);
    
    return this.shuffleDeck(deck);
  }
  
  // Utility function to verify deck composition
  static verifyDeckComposition(deck: Card[]): void {
    const counts = {
      numbers: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
      skip: 0,
      reverse: 0,
      draw2: 0,
      wild: 0,
      wild4: 0
    };
    
    deck.forEach(card => {
      if (card.type === "number") {
        counts.numbers[card.number! as keyof typeof counts.numbers]++;
      } else {
        counts[card.type as keyof typeof counts]++;
      }
    });
    
    console.log("UNO Deck Composition:");
    console.log("Number 0:", counts.numbers[0], "(should be 4)");
    console.log("Numbers 1-9:", Object.entries(counts.numbers).slice(1).map(([num, count]) => `${num}: ${count}`).join(", "), "(each should be 8)");
    console.log("Skip:", counts.skip, "(should be 8)");
    console.log("Reverse:", counts.reverse, "(should be 8)");
    console.log("Draw 2:", counts.draw2, "(should be 8)");
    console.log("Wild:", counts.wild, "(should be 4)");
    console.log("Wild Draw 4:", counts.wild4, "(should be 4)");
    console.log("Total cards:", deck.length, "(should be 108)");
  }
  
  static shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];
    
    // Use Fisher-Yates shuffle with extra randomization passes for better mixing
    for (let pass = 0; pass < 3; pass++) {
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
    }
    
    return shuffled;
  }
  
  static dealInitialHands(deck: Card[], playerCount: number): { hands: Card[][], remainingDeck: Card[] } {
    const hands: Card[][] = Array(playerCount).fill(null).map(() => []);
    const shuffledDeck = [...deck]; // Work with a copy
    let deckIndex = 0;
    
    // Deal 7 cards to each player in random order
    for (let card = 0; card < 7; card++) {
      for (let player = 0; player < playerCount; player++) {
        if (deckIndex < shuffledDeck.length) {
          hands[player].push(shuffledDeck[deckIndex++]);
        }
      }
    }
    
    return {
      hands,
      remainingDeck: shuffledDeck.slice(deckIndex)
    };
  }

  static findFirstNumberCard(deck: Card[]): { firstCard: Card, remainingDeck: Card[] } {
    // Find the first number card in the deck to start the discard pile
    // This ensures we never start with special cards like +2, +4, Wild, etc.
    for (let i = 0; i < deck.length; i++) {
      const card = deck[i];
      if (card.type === "number") {
        // Remove this card from the deck and return it along with the remaining deck
        const remainingDeck = [...deck.slice(0, i), ...deck.slice(i + 1)];
        return { firstCard: card, remainingDeck };
      }
    }
    
    // Fallback: if somehow no number cards are found, create a red 0
    console.warn("No number cards found in deck, using fallback red 0");
    return {
      firstCard: { type: "number", color: "red", number: 0 },
      remainingDeck: deck
    };
  }
  
  static canPlayCard(card: Card, topCard: Card, currentColor?: string, pendingDraw?: number): boolean {
    // If there's a pending draw effect, only allow stacking cards
    if (pendingDraw && pendingDraw > 0) {
      // Can only play +2 on +2, or +4 on either +2 or +4
      if (topCard.type === "draw2" && card.type === "draw2") {
        return true;
      }
      if (topCard.type === "wild4" && card.type === "wild4") {
        return true;
      }
      if (topCard.type === "draw2" && card.type === "wild4") {
        return true;
      }
      // Cannot play +2 on +4
      if (topCard.type === "wild4" && card.type === "draw2") {
        return false;
      }
      return false;
    }
    
    // Wild cards can always be played
    if (card.type === "wild" || card.type === "wild4") {
      return true;
    }
    
    // Must match color
    if (card.color === topCard.color || card.color === currentColor) {
      return true;
    }
    
    // Number cards must match number
    if (card.type === "number" && topCard.type === "number" && card.number === topCard.number) {
      return true;
    }
    
    // Action cards must match type
    if (card.type === topCard.type && card.type !== "number") {
      return true;
    }
    
    return false;
  }
  
  static getCardEffect(card: Card): {
    skip: boolean;
    reverse: boolean;
    draw: number;
    chooseColor: boolean;
  } {
    switch (card.type) {
      case "skip":
        return { skip: true, reverse: false, draw: 0, chooseColor: false };
      case "reverse":
        return { skip: false, reverse: true, draw: 0, chooseColor: false };
      case "draw2":
        return { skip: true, reverse: false, draw: 2, chooseColor: false };
      case "wild":
        return { skip: false, reverse: false, draw: 0, chooseColor: true };
      case "wild4":
        return { skip: true, reverse: false, draw: 4, chooseColor: true };
      default:
        return { skip: false, reverse: false, draw: 0, chooseColor: false };
    }
  }
  
  static getNextPlayerIndex(currentIndex: number, playerCount: number, direction: string, skip = false, isReverse = false, finishedPlayers: number[] = []): number {
    const activePlayerCount = playerCount - finishedPlayers.length;
    
    // If only one active player remains, they keep their turn
    if (activePlayerCount <= 1) {
      return currentIndex;
    }
    
    // Special 2-player rule: Skip and Reverse both result in same player playing again
    // But only apply this if both players are still active
    if (activePlayerCount === 2 && (skip || isReverse)) {
      return currentIndex; // Same player plays again
    }
    
    const step = direction === "clockwise" ? 1 : -1;
    const skipStep = skip ? step * 2 : step;
    let nextIndex = (currentIndex + skipStep + playerCount) % playerCount;
    
    // Skip finished players - keep advancing until we find a player who hasn't finished
    const maxIterations = playerCount * 2; // Prevent infinite loops with safety margin
    let iterations = 0;
    
    while (finishedPlayers.includes(nextIndex) && iterations < maxIterations) {
      nextIndex = (nextIndex + step + playerCount) % playerCount;
      iterations++;
    }
    
    // Fallback: if we can't find a valid next player, find first active player
    if (iterations >= maxIterations || finishedPlayers.includes(nextIndex)) {
      for (let i = 0; i < playerCount; i++) {
        if (!finishedPlayers.includes(i)) {
          return i;
        }
      }
    }
    
    return nextIndex;
  }

  static canPlayerStackDraw(playerHand: Card[], topCard: Card, pendingDraw: number): boolean {
    // Check if player can stack draw cards when facing a penalty
    if (!pendingDraw || pendingDraw === 0) return false;
    
    return playerHand.some(card => {
      // Can play +2 on +2, or +4 on either +2 or +4
      if (topCard.type === "draw2" && card.type === "draw2") return true;
      if (topCard.type === "wild4" && card.type === "wild4") return true;
      if (topCard.type === "draw2" && card.type === "wild4") return true;
      // Cannot play +2 on +4
      return false;
    });
  }
  
  static generateRoomCode(): string {
    // Generate codes in format XX1YY - first pair same, 1 in middle, last pair same but different from first
    // Examples: 22133, 44166, 99122
    const digits = "0123456789";
    
    const firstPair = digits.charAt(Math.floor(Math.random() * digits.length));
    let lastPair = digits.charAt(Math.floor(Math.random() * digits.length));
    
    // Ensure last pair is different from first pair
    while (lastPair === firstPair) {
      lastPair = digits.charAt(Math.floor(Math.random() * digits.length));
    }
    
    return `${firstPair}${firstPair}1${lastPair}${lastPair}`;
  }
}
