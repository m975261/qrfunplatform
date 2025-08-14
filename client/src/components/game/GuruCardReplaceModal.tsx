import { useState } from "react";
import { Card } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GuruCardReplaceModalProps {
  isOpen: boolean;
  currentCard?: Card;
  availableCards?: Card[]; // Available cards in current deck
  onClose: () => void;
  onReplaceCard: (newCard: Card) => void;
  refreshGameState?: () => void;
}

export default function GuruCardReplaceModal({
  isOpen,
  currentCard,
  availableCards,
  onClose,
  onReplaceCard,
  refreshGameState
}: GuruCardReplaceModalProps) {
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedNumber, setSelectedNumber] = useState<string>("");

  // Get available options from deck if provided, otherwise use all standard cards
  const getAvailableTypes = () => {
    if (!availableCards || availableCards.length === 0) {
      return ["number", "skip", "reverse", "draw2", "wild", "wild4"];
    }
    const types = new Set(availableCards.map(card => card.type));
    return Array.from(types).sort();
  };

  const getAvailableColors = () => {
    if (selectedType === "wild" || selectedType === "wild4") {
      return ["red", "blue", "green", "yellow"];
    }
    if (!availableCards || availableCards.length === 0) {
      return ["red", "blue", "green", "yellow"];
    }
    const colors = new Set(
      availableCards
        .filter(card => card.type === selectedType && card.color !== "wild")
        .map(card => card.color)
    );
    const colorArray = Array.from(colors);
    return colorArray.length > 0 ? colorArray : ["red", "blue", "green", "yellow"];
  };

  const getAvailableNumbers = () => {
    if (selectedType !== "number") {
      return ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
    }
    if (!availableCards || availableCards.length === 0) {
      return ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
    }
    const numbers = new Set(
      availableCards
        .filter(card => card.type === "number" && (!selectedColor || card.color === selectedColor))
        .map(card => (card as any).number?.toString())
        .filter(Boolean)
    );
    const numberArray = Array.from(numbers).sort();
    return numberArray.length > 0 ? numberArray : ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  };

  const cardTypes = getAvailableTypes();
  const cardColors = getAvailableColors(); 
  const cardNumbers = getAvailableNumbers();

  const handleReplaceCard = () => {
    if (!selectedType) return;

    let newCard: Card = {
      type: selectedType as any,
      color: selectedType === "wild" || selectedType === "wild4" ? "wild" : (selectedColor as any),
    };

    if (selectedType === "number" && selectedNumber) {
      (newCard as any).number = parseInt(selectedNumber);
    }

    onReplaceCard(newCard);
    
    // Close modal immediately but don't reset form until after successful replacement
    onClose();
    
    // Trigger multiple rapid refreshes for sub-1-second updates
    let refreshCount = 0;
    const refreshIntervals = [100, 300, 600, 1000]; // Staggered refresh attempts
    
    refreshIntervals.forEach((delay, index) => {
      setTimeout(() => {
        refreshCount++;
        console.log(`🔄 Rapid refresh ${refreshCount}/4 for card replacement`);
        if (typeof refreshGameState === 'function') {
          refreshGameState();
        }
      }, delay);
    });
    
    // Reset form after processing
    setTimeout(() => {
      resetForm();
    }, 500);
  };

  const resetForm = () => {
    setSelectedType("");
    setSelectedColor("");
    setSelectedNumber("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Replace Card (Guru Mode)</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {currentCard && (
            <div className="text-sm text-gray-600">
              Current card: {currentCard.type} {currentCard.color} {(currentCard as any).number || ""}
            </div>
          )}

          {/* Card Type Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Card Type</label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue placeholder="Select card type" />
              </SelectTrigger>
              <SelectContent>
                {cardTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Color Selection (if not wild) */}
          {selectedType && selectedType !== "wild" && selectedType !== "wild4" && (
            <div>
              <label className="text-sm font-medium mb-2 block">Color</label>
              <Select value={selectedColor} onValueChange={setSelectedColor}>
                <SelectTrigger>
                  <SelectValue placeholder="Select color" />
                </SelectTrigger>
                <SelectContent>
                  {cardColors.map((color) => (
                    <SelectItem key={color} value={color}>
                      {color.charAt(0).toUpperCase() + color.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Number Selection (if number card) */}
          {selectedType === "number" && (
            <div>
              <label className="text-sm font-medium mb-2 block">Number</label>
              <Select value={selectedNumber} onValueChange={setSelectedNumber}>
                <SelectTrigger>
                  <SelectValue placeholder="Select number" />
                </SelectTrigger>
                <SelectContent>
                  {cardNumbers.map((number) => (
                    <SelectItem key={number} value={number}>
                      {number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Debug Info */}
          {availableCards && (
            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
              Available in deck: {availableCards.length} cards
              {selectedType && availableCards && ` | ${selectedType} available: ${availableCards.filter(c => c.type === selectedType).length}`}
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleReplaceCard}
              disabled={
                !selectedType ||
                (selectedType !== "wild" && selectedType !== "wild4" && !selectedColor) ||
                (selectedType === "number" && !selectedNumber)
              }
              className="bg-yellow-500 hover:bg-yellow-600 text-white"
            >
              Replace Card
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}