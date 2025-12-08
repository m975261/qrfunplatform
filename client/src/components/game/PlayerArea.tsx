import { Card, CardContent } from "@/components/ui/card";

interface PlayerAreaProps {
  player: any;
  position: "top" | "left" | "right";
  isCurrentTurn: boolean;
}

export default function PlayerArea({ player, position, isCurrentTurn }: PlayerAreaProps) {
  const getPositionClasses = () => {
    switch (position) {
      case "top":
        return "absolute top-16 left-1/2 transform -translate-x-1/2 z-20";
      case "left":
        return "absolute left-4 top-1/2 transform -translate-y-1/2 z-20";
      case "right":
        return "absolute right-4 top-1/2 transform -translate-y-1/2 z-20";
      default:
        return "";
    }
  };

  const getCardClasses = (index: number) => {
    const baseClasses = "bg-gradient-to-br from-blue-800 to-blue-900 rounded border-2 border-white shadow-sm";
    
    if (position === "top") {
      const rotations = ["-rotate-3", "rotate-2", "-rotate-1", "rotate-3", "-rotate-2"];
      return `${baseClasses} w-8 h-12 transform ${rotations[index % rotations.length]} hover:rotate-0 transition-transform`;
    } else {
      const rotation = position === "left" ? "-rotate-90" : "rotate-90";
      return `${baseClasses} w-12 h-8 transform ${rotation}`;
    }
  };

  const cardCount = player?.hand?.length || 0;
  const cards = Array(Math.min(cardCount, 7)).fill(null); // Show max 7 cards

  return (
    <div className={getPositionClasses()}>
      <Card className="bg-white/95 backdrop-blur-sm shadow-xl">
        <CardContent className="p-4">
          {position === "top" ? (
            <>
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-uno-red to-red-500 rounded-full flex items-center justify-center text-white font-bold">
                  {player?.nickname?.[0]?.toUpperCase() || "?"}
                </div>
                <div>
                  <div className={`font-semibold text-gray-800 ${isCurrentTurn ? 'animate-pulse text-uno-red' : ''}`}>
                    {player?.nickname || "Player"} {isCurrentTurn && '⭐'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {cardCount} cards {isCurrentTurn && '• Their Turn!'}
                  </div>
                </div>
                {isCurrentTurn && (
                  <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" title="Current turn"></div>
                )}
              </div>
              <div className="flex space-x-1">
                {cards.map((_, index) => (
                  <div key={index} className={getCardClasses(index)}></div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center space-y-3">
              <div className="flex items-center space-x-2">
                <div className={`w-10 h-10 bg-gradient-to-br ${
                  position === "left" ? "from-uno-yellow to-yellow-500" : "from-uno-purple to-purple-500"
                } rounded-full flex items-center justify-center text-white font-bold`}>
                  {player?.nickname?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="text-center">
                  <div className={`font-semibold text-gray-800 ${isCurrentTurn ? 'animate-pulse text-uno-red' : ''}`}>
                    {player?.nickname || "Player"} {isCurrentTurn && '⭐'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {cardCount} cards {isCurrentTurn && '• Their Turn!'}
                  </div>
                </div>
                {isCurrentTurn && (
                  <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" title="Current turn"></div>
                )}
              </div>
              <div className="flex flex-col space-y-1">
                {cards.map((_, index) => (
                  <div key={index} className={getCardClasses(index)}></div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
