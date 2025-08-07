import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, Home } from "lucide-react";

function getPositionText(position: number | string): string {
  if (typeof position === 'string') return position;
  switch (position) {
    case 1: return '1st';
    case 2: return '2nd';
    case 3: return '3rd';
    default: return `${position}th`;
  }
}

interface GameEndModalProps {
  winner: string;
  rankings?: Array<{
    nickname: string;
    position: number | string;
    hasLeft: boolean;
  }>;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
}

export default function GameEndModal({ winner, rankings, onPlayAgain, onBackToLobby }: GameEndModalProps) {
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

          {/* Rankings */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <h3 className="text-lg font-bold text-gray-800 mb-3 text-center">Final Rankings</h3>
            <div className="space-y-2">
              {rankings?.map((player, index) => (
                <div key={index} className="flex items-center justify-between bg-white rounded-lg p-3">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                      player.position === 1 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                      player.position === 2 ? 'bg-gradient-to-br from-gray-400 to-gray-600' :
                      player.position === 3 ? 'bg-gradient-to-br from-amber-600 to-amber-800' :
                      'bg-gradient-to-br from-gray-500 to-gray-700'
                    }`}>
                      {player.position === 1 ? '🥇' : 
                       player.position === 2 ? '🥈' : 
                       player.position === 3 ? '🥉' : 
                       player.hasLeft ? '❌' : '4️⃣'}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800">{player.nickname}</div>
                      <div className="text-xs text-gray-500">
                        {player.hasLeft ? 'Left Game' : `${getPositionText(player.position)} Place`}
                      </div>
                    </div>
                  </div>
                  <div className="text-lg font-bold text-gray-600">
                    #{player.position}
                  </div>
                </div>
              )) || (
                <div className="text-center text-gray-500">
                  <div className="text-sm">Great game everyone!</div>
                  <div className="font-semibold">Thanks for playing</div>
                </div>
              )}
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
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
