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
  const getCardColors = () => {
    switch (card.color) {
      case "red":
        return {
          bg: "bg-uno-red",
          border: "border-red-600",
          shadow: "shadow-red-400/50"
        };
      case "blue":
        return {
          bg: "bg-uno-blue", 
          border: "border-blue-600",
          shadow: "shadow-blue-400/50"
        };
      case "green":
        return {
          bg: "bg-uno-green",
          border: "border-green-600", 
          shadow: "shadow-green-400/50"
        };
      case "yellow":
        return {
          bg: "bg-uno-yellow",
          border: "border-yellow-600",
          shadow: "shadow-yellow-400/50"
        };
      case "wild":
        return {
          bg: "bg-gradient-to-br from-red-500 via-yellow-500 via-green-500 to-blue-500",
          border: "border-gray-800",
          shadow: "shadow-gray-600/50"
        };
      default:
        return {
          bg: "bg-gray-400",
          border: "border-gray-500", 
          shadow: "shadow-gray-400/50"
        };
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case "small":
        return "w-12 h-16";
      case "large":
        return "w-20 h-28";
      default:
        return "w-16 h-24";
    }
  };

  const getContentSize = () => {
    switch (size) {
      case "small":
        return "text-xs";
      case "large":
        return "text-2xl";
      default:
        return "text-lg";
    }
  };

  const getIconSize = () => {
    switch (size) {
      case "small":
        return "w-3 h-3";
      case "large":
        return "w-8 h-8";
      default:
        return "w-5 h-5";
    }
  };

  const getCardContent = () => {
    const iconClass = getIconSize();
    
    switch (card.type) {
      case "number":
        return (
          <div className="flex flex-col items-center">
            <span className={`font-black ${getContentSize()} ${card.number === 6 || card.number === 9 ? 'underline' : ''}`}>
              {card.number}
            </span>
          </div>
        );
      case "skip":
        return (
          <div className="flex flex-col items-center">
            <Ban className={iconClass} />
            <span className="text-xs font-bold mt-1">SKIP</span>
          </div>
        );
      case "reverse":
        return (
          <div className="flex flex-col items-center">
            <Undo className={iconClass} />
            <span className="text-xs font-bold mt-1">REVERSE</span>
          </div>
        );
      case "draw2":
        return (
          <div className="flex flex-col items-center">
            <span className={`font-black ${getContentSize()}`}>+2</span>
            <span className="text-xs font-bold">DRAW TWO</span>
          </div>
        );
      case "wild":
        return (
          <div className="flex flex-col items-center">
            <Palette className={iconClass} />
            <span className="text-xs font-bold mt-1">WILD</span>
          </div>
        );
      case "wild4":
        return (
          <div className="flex flex-col items-center">
            <span className={`font-black ${getContentSize()}`}>+4</span>
            <span className="text-xs font-bold">WILD DRAW</span>
          </div>
        );
      default:
        return "?";
    }
  };

  const colors = getCardColors();

  if (interactive) {
    return (
      <button
        className={`
          ${colors.bg} ${getSizeClasses()} ${colors.border} ${colors.shadow}
          rounded-2xl border-4 shadow-lg relative cursor-pointer
          flex items-center justify-center text-white font-bold
          ${!disabled ? "hover:scale-105 hover:-translate-y-1 transition-all duration-200" : ""}
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          overflow-hidden
        `}
        onClick={onClick}
        disabled={disabled}
      >
        {/* UNO Card Background Pattern */}
        <div className="absolute inset-2 rounded-xl bg-white/20 border-2 border-white/30"></div>
        
        {/* Card Content */}
        <div className="relative z-10 text-center">
          {getCardContent()}
        </div>

        {/* Small corner symbols */}
        {card.type === "number" && (
          <>
            <div className={`absolute top-1 left-1 text-xs font-bold opacity-80 ${card.number === 6 || card.number === 9 ? 'underline' : ''}`}>
              {card.number}
            </div>
            <div className={`absolute bottom-1 right-1 text-xs font-bold opacity-80 rotate-180 ${card.number === 6 || card.number === 9 ? 'underline' : ''}`}>
              {card.number}
            </div>
          </>
        )}
      </button>
    );
  }

  return (
    <div className={`
      ${colors.bg} ${getSizeClasses()} ${colors.border} ${colors.shadow}
      rounded-2xl border-4 shadow-lg relative
      flex items-center justify-center text-white font-bold
      ${disabled ? "opacity-50" : ""}
      overflow-hidden
    `}>
      {/* UNO Card Background Pattern */}
      <div className="absolute inset-2 rounded-xl bg-white/20 border-2 border-white/30"></div>
      
      {/* Card Content */}
      <div className="relative z-10 text-center">
        {getCardContent()}
      </div>

      {/* Small corner symbols */}
      {card.type === "number" && (
        <>
          <div className={`absolute top-1 left-1 text-xs font-bold opacity-80 ${card.number === 6 || card.number === 9 ? 'underline' : ''}`}>
            {card.number}
          </div>
          <div className={`absolute bottom-1 right-1 text-xs font-bold opacity-80 rotate-180 ${card.number === 6 || card.number === 9 ? 'underline' : ''}`}>
            {card.number}
          </div>
        </>
      )}
    </div>
  );
}
