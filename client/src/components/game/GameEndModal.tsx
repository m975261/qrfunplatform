import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, Home } from "lucide-react";

interface GameEndModalProps {
  winner: string;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
}

export default function GameEndModal({ winner, onPlayAgain, onBackToLobby }: GameEndModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="max-w-md w-full mx-4 animate-slide-up">
        <CardContent className="p-8 text-center">
          <div className="mb-6">
            {/* Winner Display */}
            <div className="w-20 h-20 bg-gradient-to-br from-uno-yellow to-yellow-500 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
              {winner[0]?.toUpperCase()}
            </div>
            <h2 className="text-3xl font-fredoka text-gray-800 mb-2">{winner} Wins!</h2>
            <p className="text-gray-600">Congratulations! 🎉</p>
          </div>

          {/* Game Stats */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <div className="text-center">
              <div className="text-gray-500 text-sm">Great game everyone!</div>
              <div className="font-semibold">Thanks for playing</div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={onPlayAgain}
              className="w-full bg-gradient-to-r from-uno-green to-emerald-500 hover:scale-105 transition-all"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Play Again
            </Button>
            <Button
              onClick={onBackToLobby}
              variant="outline"
              className="w-full"
            >
              <Home className="mr-2 h-4 w-4" />
              Back to Lobby
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
