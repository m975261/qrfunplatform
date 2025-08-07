import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Circle } from "lucide-react";

interface ColorPickerModalProps {
  onChooseColor: (color: string) => void;
  onClose: () => void;
}

export default function ColorPickerModal({ onChooseColor, onClose }: ColorPickerModalProps) {
  const colors = [
    { name: "red", class: "from-uno-red to-red-500" },
    { name: "blue", class: "from-uno-blue to-blue-500" },
    { name: "green", class: "from-uno-green to-emerald-500" },
    { name: "yellow", class: "from-uno-yellow to-yellow-500" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="max-w-sm w-full mx-4 animate-slide-up">
        <CardContent className="p-8 text-center">
          <h3 className="text-xl font-bold text-gray-800 mb-6">Choose a Color</h3>
          
          <div className="grid grid-cols-2 gap-4">
            {colors.map((color) => (
              <Button
                key={color.name}
                onClick={() => onChooseColor(color.name)}
                className={`aspect-square bg-gradient-to-br ${color.class} hover:scale-110 transition-all shadow-lg border-0`}
              >
                <Circle className="h-8 w-8" />
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
