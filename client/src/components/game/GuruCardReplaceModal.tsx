import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card as UICard } from "@/components/ui/card";
import { Wand2, Hash, Palette } from "lucide-react";

interface GuruCardReplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReplaceCard: (replacementType: string, replacementValue?: string, specificCard?: any) => void;
  currentCard?: any;
}

const CARD_TYPES = [
  { type: "number", label: "Number Card", icon: Hash },
  { type: "skip", label: "Skip", icon: Wand2 },
  { type: "reverse", label: "Reverse", icon: Wand2 },
  { type: "draw2", label: "Draw Two", icon: Wand2 },
  { type: "wild", label: "Wild", icon: Wand2 },
  { type: "wild4", label: "Wild Draw Four", icon: Wand2 },
];

const COLORS = [
  { color: "red", label: "Red", bg: "bg-red-500" },
  { color: "blue", label: "Blue", bg: "bg-blue-500" },
  { color: "green", label: "Green", bg: "bg-green-500" },
  { color: "yellow", label: "Yellow", bg: "bg-yellow-500" },
];

const NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function GuruCardReplaceModal({ isOpen, onClose, onReplaceCard, currentCard }: GuruCardReplaceModalProps) {
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);

  const handleReplaceCard = () => {
    if (selectedType === "special") {
      onReplaceCard("special");
    } else if (selectedType === "number") {
      onReplaceCard("number");
    } else if (selectedType === "color") {
      onReplaceCard("color", selectedColor);
    } else if (selectedType === "specific") {
      // Create specific card based on selections
      const specificCard = {
        type: selectedType === "number" ? "number" : selectedType,
        color: selectedColor || "red",
        number: selectedNumber,
        value: selectedNumber
      };
      onReplaceCard("specific", undefined, specificCard);
    } else if (selectedType && selectedColor) {
      // Specific card type with color
      const specificCard = {
        type: selectedType,
        color: selectedColor,
        number: selectedType === "number" ? selectedNumber : undefined,
        value: selectedType === "number" ? selectedNumber : undefined
      };
      onReplaceCard("specific", undefined, specificCard);
    }
    
    // Reset and close
    setSelectedType("");
    setSelectedColor("");
    setSelectedNumber(null);
    onClose();
  };

  const isValidSelection = () => {
    if (selectedType === "special" || selectedType === "number") return true;
    if (selectedType === "color" && selectedColor) return true;
    if (selectedType && selectedColor) {
      if (selectedType === "number") return selectedNumber !== null;
      return true;
    }
    return false;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-purple-600">
            🔮 Guru Card Replacement
          </DialogTitle>
          <p className="text-center text-sm text-gray-600">
            Replace your card with a new one
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Quick Replace Options */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Quick Replace</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={selectedType === "special" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedType("special")}
                className="h-auto py-3 flex-col"
              >
                <Wand2 className="w-4 h-4 mb-1" />
                <span className="text-xs">Random Special</span>
              </Button>
              <Button
                variant={selectedType === "number" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedType("number")}
                className="h-auto py-3 flex-col"
              >
                <Hash className="w-4 h-4 mb-1" />
                <span className="text-xs">Random Number</span>
              </Button>
            </div>
          </div>

          {/* Color Selection */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Replace by Color</h3>
            <div className="grid grid-cols-4 gap-2">
              {COLORS.map(({ color, label, bg }) => (
                <Button
                  key={color}
                  variant={selectedColor === color ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSelectedColor(color);
                    if (selectedType !== "color") setSelectedType("color");
                  }}
                  className="h-auto py-3 flex-col"
                >
                  <div className={`w-4 h-4 ${bg} rounded-full mb-1`} />
                  <span className="text-xs">{label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Specific Card Selection */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Specific Card</h3>
            
            {/* Card Type Selection */}
            <div className="grid grid-cols-3 gap-2">
              {CARD_TYPES.map(({ type, label, icon: Icon }) => (
                <Button
                  key={type}
                  variant={selectedType === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedType(type)}
                  className="h-auto py-2 flex-col text-xs"
                >
                  <Icon className="w-3 h-3 mb-1" />
                  {label}
                </Button>
              ))}
            </div>

            {/* Number Selection (if number card selected) */}
            {selectedType === "number" && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Select Number:</p>
                <div className="grid grid-cols-5 gap-2">
                  {NUMBERS.map((num) => (
                    <Button
                      key={num}
                      variant={selectedNumber === num ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedNumber(num)}
                      className="h-8 text-sm"
                    >
                      {num}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between gap-3 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleReplaceCard}
              disabled={!isValidSelection()}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              Replace Card
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}