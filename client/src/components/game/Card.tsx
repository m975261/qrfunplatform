import { Card } from "@shared/schema";
import { Ban, Undo, Palette } from "lucide-react";

interface GameCardProps {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
  interactive?: boolean;
  size?: "small" | "medium" | "large";
}

export default function GameCard({ card, onClick, disabled = false, interactive = false, size = "medium" }: GameCardProps) {
  const getColorClasses = () => {
    switch (card.color) {
      case "red":
        return "from-uno-red to-red-500";
      case "blue":
        return "from-uno-blue to-blue-500";
      case "green":
        return "from-uno-green to-emerald-500";
      case "yellow":
        return "from-uno-yellow to-yellow-500";
      case "wild":
        return "from-gray-800 to-gray-900";
      default:
        return "from-gray-400 to-gray-500";
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case "small":
        return "w-12 h-16 text-sm";
      case "large":
        return "w-20 h-28 text-2xl";
      default:
        return "w-16 h-24 text-xl";
    }
  };

  const getCardContent = () => {
    switch (card.type) {
      case "number":
        return card.number?.toString();
      case "skip":
        return <Ban className="w-6 h-6" />;
      case "reverse":
        return <Undo className="w-6 h-6" />;
      case "draw2":
        return "+2";
      case "wild":
        return <Palette className="w-6 h-6" />;
      case "wild4":
        return "+4";
      default:
        return "?";
    }
  };

  const baseClasses = `
    bg-gradient-to-br ${getColorClasses()} ${getSizeClasses()}
    rounded-lg border-2 border-white shadow-lg
    flex items-center justify-center text-white font-bold
    ${interactive ? "cursor-pointer" : ""}
    ${interactive && !disabled ? "hover:scale-110 hover:-translate-y-2 transition-all" : ""}
    ${disabled ? "opacity-50 cursor-not-allowed" : ""}
  `;

  if (interactive) {
    return (
      <button
        className={baseClasses}
        onClick={onClick}
        disabled={disabled}
      >
        {getCardContent()}
      </button>
    );
  }

  return (
    <div className={baseClasses}>
      {getCardContent()}
    </div>
  );
}
