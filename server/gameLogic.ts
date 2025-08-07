import { Card } from "@shared/schema";

export class UnoGameLogic {
  static createDeck(): Card[] {
    const deck: Card[] = [];
    const colors = ["red", "blue", "green", "yellow"] as const;
    
    // Number cards (0-9)
    for (const color of colors) {
      // One 0 card per color
      deck.push({ type: "number", color, number: 0 });
      
      // Two of each number 1-9 per color
      for (let number = 1; number <= 9; number++) {
        deck.push({ type: "number", color, number });
        deck.push({ type: "number", color, number });
      }
      
      // Action cards (2 of each per color)
      deck.push({ type: "skip", color });
      deck.push({ type: "skip", color });
      deck.push({ type: "reverse", color });
      deck.push({ type: "reverse", color });
      deck.push({ type: "draw2", color });
      deck.push({ type: "draw2", color });
    }
    
    // Wild cards (4 of each)
    for (let i = 0; i < 4; i++) {
      deck.push({ type: "wild", color: "wild" });
      deck.push({ type: "wild4", color: "wild" });
    }
    
    return this.shuffleDeck(deck);
  }
  
  static shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  
  static dealInitialHands(deck: Card[], playerCount: number): { hands: Card[][], remainingDeck: Card[] } {
    const hands: Card[][] = Array(playerCount).fill(null).map(() => []);
    let deckIndex = 0;
    
    // Deal 7 cards to each player
    for (let card = 0; card < 7; card++) {
      for (let player = 0; player < playerCount; player++) {
        hands[player].push(deck[deckIndex++]);
      }
    }
    
    return {
      hands,
      remainingDeck: deck.slice(deckIndex)
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
  
  static getNextPlayerIndex(currentIndex: number, playerCount: number, direction: string, skip = false): number {
    const step = direction === "clockwise" ? 1 : -1;
    const skipStep = skip ? step * 2 : step;
    return (currentIndex + skipStep + playerCount) % playerCount;
  }
  
  static generateRoomCode(): string {
    // Generate codes like 22033, 44055, 55066 - format: AABCC where A and B are repeated digits
    const digits = "0123456789";
    
    // First two digits are the same
    const firstDigit = digits.charAt(Math.floor(Math.random() * digits.length));
    
    // Third digit is different from first
    let secondDigit;
    do {
      secondDigit = digits.charAt(Math.floor(Math.random() * digits.length));
    } while (secondDigit === firstDigit);
    
    // Last two digits are the same and different from the middle digit
    let thirdDigit;
    do {
      thirdDigit = digits.charAt(Math.floor(Math.random() * digits.length));
    } while (thirdDigit === secondDigit);
    
    return `${firstDigit}${firstDigit}${secondDigit}${thirdDigit}${thirdDigit}`;
  }
}
