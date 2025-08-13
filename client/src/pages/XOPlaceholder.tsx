import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function XOPlaceholder() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900 dark:to-pink-900 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-0 shadow-lg">
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4 transition-colors">
            <ArrowLeft size={20} />
            Back to Games
          </Link>
          <div className="text-6xl mb-4">⭕</div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
            XO Game
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Coming Soon!
          </p>
        </div>
        
        <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
          <p>
            The XO (Tic Tac Toe) multiplayer game is currently under development.
          </p>
          <p>
            It will feature real-time multiplayer gameplay, room sharing via QR codes, 
            and all the great features you love from our UNO game.
          </p>
        </div>
        
        <div className="mt-8">
          <Link href="/">
            <button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200">
              Explore Other Games
            </button>
          </Link>
        </div>
      </Card>
    </div>
  );
}