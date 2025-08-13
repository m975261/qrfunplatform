import { Card } from "@shared/schema";
import { useState, useRef, useEffect } from "react";

interface GameCardProps {
  card: Card;
  onClick?: () => void;
  onGuruReplace?: (cardIndex: number) => void;
  cardIndex?: number;
  disabled?: boolean;
  interactive?: boolean;
  size?: "extra-small" | "small" | "medium" | "large";
  isGuruUser?: boolean;
}

export default function GameCard({ card, onClick, onGuruReplace, cardIndex, disabled = false, interactive = false, size = "medium", isGuruUser = false }: GameCardProps) {
  const [isLongPressing, setIsLongPressing] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout>();
  const pressStart = useRef<number>(0);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  const getCardColors = () => {
    switch (card.color) {
      case "red":
        return {
          bg: "bg-red-600",
          border: "border-red-700",
          shadow: "shadow-red-500/30"
        };
      case "blue":
        return {
          bg: "bg-blue-600", 
          border: "border-blue-700",
          shadow: "shadow-blue-500/30"
        };
      case "green":
        return {
          bg: "bg-green-600",
          border: "border-green-700", 
          shadow: "shadow-green-500/30"
        };
      case "yellow":
        return {
          bg: "bg-yellow-500",
          border: "border-yellow-600",
          shadow: "shadow-yellow-500/30"
        };
      case "wild":
        return {
          bg: "bg-black",
          border: "border-gray-900",
          shadow: "shadow-black/40"
        };
      default:
        return {
          bg: "bg-gray-600",
          border: "border-gray-700", 
          shadow: "shadow-gray-500/30"
        };
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case "extra-small":
        return "w-12 h-16 sm:w-14 sm:h-18";
      case "small":
        return "w-16 h-22 sm:w-18 sm:h-24";
      case "large":
        return "w-28 h-36 sm:w-32 sm:h-40";
      default:
        return "w-20 h-28 sm:w-22 sm:h-30";
    }
  };

  const getNumberSize = () => {
    switch (size) {
      case "small":
        return "text-xl font-black";
      case "large":
        return "text-4xl font-black";
      default:
        return "text-2xl font-black";
    }
  };

  const getCornerSize = () => {
    switch (size) {
      case "small":
        return "text-xs";
      case "large":
        return "text-sm";
      default:
        return "text-xs";
    }
  };

  const getActionTextSize = () => {
    switch (size) {
      case "small":
        return "text-xs";
      case "large":
        return "text-lg";
      default:
        return "text-sm";
    }
  };

  const getCardContent = () => {
    switch (card.type) {
      case "number":
        return (
          <div className="w-full h-full flex items-center justify-center">
            {/* Main oval content area */}
            <div className="relative w-3/4 h-3/4 bg-white rounded-full flex items-center justify-center shadow-inner">
              <span className={`${getNumberSize()} text-black ${card.number === 6 || card.number === 9 ? 'underline decoration-2' : ''}`}>
                {card.number}
              </span>
            </div>
          </div>
        );
      case "skip":
        return (
          <div className="w-full h-full flex items-center justify-center">
            <div className="relative w-3/4 h-3/4 bg-white rounded-full flex items-center justify-center shadow-inner">
              {/* Skip symbol - circle with diagonal line */}
              <div className="relative">
                <div className="w-8 h-8 border-4 border-black rounded-full"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-1 bg-black rotate-45 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        );
      case "reverse":
        return (
          <div className="w-full h-full flex items-center justify-center">
            <div className="relative w-3/4 h-3/4 bg-white rounded-full flex items-center justify-center shadow-inner">
              {/* Reverse arrows */}
              <div className="flex space-x-1">
                <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 9H17a1 1 0 110 2h-5.586l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
                <svg className="w-6 h-6 text-black rotate-180" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 9H17a1 1 0 110 2h-5.586l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
        );
      case "draw2":
        return (
          <div className="w-full h-full flex items-center justify-center">
            <div className="relative w-3/4 h-3/4 bg-white rounded-full flex items-center justify-center shadow-inner">
              <span className={`${getNumberSize()} text-black`}>+2</span>
            </div>
          </div>
        );
      case "wild":
        return (
          <div className="w-full h-full flex items-center justify-center">
            <div className="relative w-3/4 h-3/4 bg-white rounded-full flex items-center justify-center shadow-inner">
              {/* Wild card symbol - four colored quarters */}
              <div className="relative w-8 h-8">
                <div className="absolute top-0 left-0 w-4 h-4 bg-red-500 rounded-tl-full"></div>
                <div className="absolute top-0 right-0 w-4 h-4 bg-blue-500 rounded-tr-full"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 bg-yellow-500 rounded-bl-full"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-br-full"></div>
              </div>
            </div>
          </div>
        );
      case "wild4":
        return (
          <div className="w-full h-full flex items-center justify-center">
            <div className="relative w-3/4 h-3/4 bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
              {/* Wild Draw Four */}
              <div className="relative w-6 h-6 mb-1">
                <div className="absolute top-0 left-0 w-3 h-3 bg-red-500 rounded-tl-full"></div>
                <div className="absolute top-0 right-0 w-3 h-3 bg-blue-500 rounded-tr-full"></div>
                <div className="absolute bottom-0 left-0 w-3 h-3 bg-yellow-500 rounded-bl-full"></div>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-br-full"></div>
              </div>
              <span className="text-black font-black text-sm">+4</span>
            </div>
          </div>
        );
      default:
        return (
          <div className="w-full h-full flex items-center justify-center">
            <div className="relative w-3/4 h-3/4 bg-white rounded-full flex items-center justify-center shadow-inner">
              <span className="text-black font-bold text-xs">Cards</span>
            </div>
          </div>
        );
    }
  };

  const colors = getCardColors();

  if (interactive) {
    return (
      <button
        className={`
          ${colors.bg} ${getSizeClasses()} ${colors.border} ${colors.shadow}
          rounded-xl border-4 shadow-lg relative cursor-pointer
          ${!disabled ? "hover:scale-105 hover:-translate-y-1 transition-all duration-200" : ""}
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
        onClick={onClick}
        disabled={disabled}
      >
        {/* Card Content */}
        {getCardContent()}

        {/* Corner symbols for number cards and some action cards */}
        {(card.type === "number" || card.type === "draw2") && (
          <>
            {/* Top-left corner */}
            <div className={`absolute top-1 left-1 ${getCornerSize()} font-bold text-white`}>
              {card.type === "number" ? (
                <span className={card.number === 6 || card.number === 9 ? 'underline' : ''}>
                  {card.number}
                </span>
              ) : (
                "+2"
              )}
            </div>
            {/* Bottom-right corner (rotated) */}
            <div className={`absolute bottom-1 right-1 ${getCornerSize()} font-bold text-white rotate-180`}>
              {card.type === "number" ? (
                <span className={card.number === 6 || card.number === 9 ? 'underline' : ''}>
                  {card.number}
                </span>
              ) : (
                "+2"
              )}
            </div>
          </>
        )}

        {/* Special corner symbols for action cards */}
        {card.type === "skip" && (
          <>
            <div className="absolute top-1 left-1 text-white text-xs font-bold">⊘</div>
            <div className="absolute bottom-1 right-1 text-white text-xs font-bold rotate-180">⊘</div>
          </>
        )}

        {card.type === "reverse" && (
          <>
            <div className="absolute top-1 left-1 text-white text-xs font-bold">↻</div>
            <div className="absolute bottom-1 right-1 text-white text-xs font-bold rotate-180">↻</div>
          </>
        )}
      </button>
    );
  }

  return (
    <div className="relative flex flex-col items-center">
      <div 
        className={`
          ${colors.bg} ${getSizeClasses()} ${colors.border} ${colors.shadow}
          rounded-xl border-4 shadow-lg relative cursor-pointer transition-all duration-200 select-none
          ${disabled ? "opacity-50" : ""}
          ${isGuruUser && !disabled ? 'ring-1 ring-purple-300' : ''}
        `}
        onClick={onClick}
      >
      {/* Card Content */}
      {getCardContent()}

      {/* Corner symbols for number cards and some action cards */}
      {(card.type === "number" || card.type === "draw2") && (
        <>
          {/* Top-left corner */}
          <div className={`absolute top-1 left-1 ${getCornerSize()} font-bold text-white`}>
            {card.type === "number" ? (
              <span className={card.number === 6 || card.number === 9 ? 'underline' : ''}>
                {card.number}
              </span>
            ) : (
              "+2"
            )}
          </div>
          {/* Bottom-right corner (rotated) */}
          <div className={`absolute bottom-1 right-1 ${getCornerSize()} font-bold text-white rotate-180`}>
            {card.type === "number" ? (
              <span className={card.number === 6 || card.number === 9 ? 'underline' : ''}>
                {card.number}
              </span>
            ) : (
              "+2"
            )}
          </div>
        </>
      )}

      {/* Special corner symbols for action cards */}
      {card.type === "skip" && (
        <>
          <div className="absolute top-1 left-1 text-white text-xs font-bold">⊘</div>
          <div className="absolute bottom-1 right-1 text-white text-xs font-bold rotate-180">⊘</div>
        </>
      )}

      {card.type === "reverse" && (
        <>
          <div className="absolute top-1 left-1 text-white text-xs font-bold">↻</div>
          <div className="absolute bottom-1 right-1 text-white text-xs font-bold rotate-180">↻</div>
        </>
      )}
      </div>
      
      {/* Guru Replace Button */}
      {(() => {
        console.log('Card debug:', { isGuruUser, disabled, onGuruReplace: !!onGuruReplace, cardIndex });
        return isGuruUser && !disabled && onGuruReplace && cardIndex !== undefined;
      })() && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onGuruReplace(cardIndex);
          }}
          className="mt-1 w-6 h-4 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded-full flex items-center justify-center transition-colors shadow-sm"
          title="Replace this card"
        >
          ✨
        </button>
      )}
    </div>
  );
}
