import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import GameCard from "./Card";
import { Wand2, Hash, Palette, ArrowLeft } from "lucide-react";

interface GuruCardReplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReplaceCard: (replacementType: string, replacementValue?: string, specificCard?: any) => void;
  currentCard?: any;
}



export default function GuruCardReplaceModal({ isOpen, onClose, onReplaceCard, currentCard }: GuruCardReplaceModalProps) {
  const [step, setStep] = useState<'type' | 'cards'>('type');
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [availableCards, setAvailableCards] = useState<any[]>([]);

  const generateAvailableCards = (type: string) => {
    let cards = [];
    
    if (type === "numbers") {
      // Generate number cards for all colors
      for (let color of ["red", "blue", "green", "yellow"]) {
        for (let num = 0; num <= 9; num++) {
          cards.push({
            type: "number",
            color,
            number: num,
            value: num
          });
        }
      }
    } else if (type === "special") {
      // Generate special action cards
      for (let color of ["red", "blue", "green", "yellow"]) {
        cards.push(
          { type: "skip", color },
          { type: "reverse", color },
          { type: "draw2", color }
        );
      }
    } else if (type === "wild") {
      // Generate wild cards
      cards.push(
        { type: "wild", color: "wild" },
        { type: "wild4", color: "wild" }
      );
    }
    
    return cards;
  };

  const handleTypeSelection = (type: string) => {
    setSelectedType(type);
    setAvailableCards(generateAvailableCards(type));
    setStep('cards');
  };

  const handleCardSelection = (card: any) => {
    onReplaceCard("specific", undefined, card);
    resetModal();
  };

  const resetModal = () => {
    setStep('type');
    setSelectedType("");
    setSelectedColor("");
    setAvailableCards([]);
    onClose();
  };

  const goBack = () => {
    setStep('type');
    setSelectedType("");
    setAvailableCards([]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={resetModal}>
      <DialogContent className="max-w-2xl mx-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-purple-600">
            🔮 Guru Card Replacement
          </DialogTitle>
          <p className="text-center text-sm text-gray-600">
            {step === 'type' ? 'Choose card type to replace with' : 'Select specific card to replace with'}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {step === 'type' ? (
            // Step 1: Choose Card Type
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-center">What type of card do you want?</h3>
              
              <div className="grid grid-cols-3 gap-4">
                <Button
                  onClick={() => handleTypeSelection('numbers')}
                  className="h-20 bg-blue-600 hover:bg-blue-700 flex flex-col items-center justify-center"
                >
                  <Hash className="w-8 h-8 mb-2" />
                  <span className="font-semibold">Numbers</span>
                  <span className="text-xs opacity-90">0-9 cards</span>
                </Button>
                
                <Button
                  onClick={() => handleTypeSelection('special')}
                  className="h-20 bg-red-600 hover:bg-red-700 flex flex-col items-center justify-center"
                >
                  <Wand2 className="w-8 h-8 mb-2" />
                  <span className="font-semibold">Special</span>
                  <span className="text-xs opacity-90">Skip, Reverse, +2</span>
                </Button>
                
                <Button
                  onClick={() => handleTypeSelection('wild')}
                  className="h-20 bg-black hover:bg-gray-800 flex flex-col items-center justify-center"
                >
                  <Palette className="w-8 h-8 mb-2" />
                  <span className="font-semibold">Wild</span>
                  <span className="text-xs opacity-90">Wild & +4</span>
                </Button>
              </div>
              
              <div className="flex justify-center">
                <Button variant="outline" onClick={resetModal} className="w-32">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            // Step 2: Choose Specific Card
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goBack}
                  className="flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
                <h3 className="font-semibold text-sm">
                  Select {selectedType === 'numbers' ? 'Number' : selectedType === 'special' ? 'Special' : 'Wild'} Card
                </h3>
              </div>
              
              <div className="grid grid-cols-5 gap-2 max-h-80 overflow-y-auto">
                {availableCards.map((card, index) => (
                  <div key={index} className="flex flex-col items-center">
                    <GameCard
                      card={card}
                      size="small"
                      onClick={() => handleCardSelection(card)}
                      interactive={true}
                    />
                  </div>
                ))}
              </div>
              
              <div className="flex justify-center">
                <Button variant="outline" onClick={resetModal} className="w-32">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}