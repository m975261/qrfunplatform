import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function MainHome() {
  const games = [
    {
      id: "uno",
      name: "UNO",
      path: "/uno",
      logo: "🎴",
      status: "available",
      description: "Classic multiplayer card game",
      rules: [
        "Match cards by color or number",
        "Use action cards: Skip, Reverse, Draw Two",
        "Wild cards change the color",
        "Draw Four cards force next player to draw 4",
        "Say 'UNO' when you have one card left",
        "First player to empty their hand wins"
      ],
      players: "2-4 players",
      features: ["Real-time multiplayer", "Room codes & QR sharing", "Spectator mode", "Ranking system"]
    },
    {
      id: "xo",
      name: "XO",
      path: "/xo",
      logo: "⭕",
      status: "coming-soon",
      description: "Strategic Tic Tac Toe game",
      rules: [
        "Get three in a row to win",
        "Play on a 3x3 grid",
        "Take turns placing X or O",
        "Block your opponent's winning moves",
        "First to get three in a line wins",
        "Game ends in draw if grid fills without winner"
      ],
      players: "2 players",
      features: ["Real-time multiplayer", "Smart AI opponent", "Tournament mode", "Statistics tracking"]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900 dark:to-pink-900">
      {/* Header */}
      <header className="relative overflow-hidden bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
              QRFun Games
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-2">
              Multiplayer games with instant QR code sharing
            </p>
            <p className="text-gray-500 dark:text-gray-400">
              Create rooms, share QR codes, and play with friends instantly
            </p>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-blue-200 dark:bg-blue-800 rounded-full opacity-20"></div>
          <div className="absolute top-1/2 -left-8 w-32 h-32 bg-purple-200 dark:bg-purple-800 rounded-full opacity-20"></div>
          <div className="absolute -bottom-4 right-1/3 w-20 h-20 bg-pink-200 dark:bg-pink-800 rounded-full opacity-20"></div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {/* Games Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {games.map((game) => (
            <Card key={game.id} className="relative group hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-0 shadow-lg">
              <div className="p-8">
                {/* Game Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="text-6xl">{game.logo}</div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-800 dark:text-white">
                        {game.name}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300">
                        {game.description}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <Badge 
                      variant={game.status === "available" ? "default" : "secondary"}
                      className="mb-2"
                    >
                      {game.status === "available" ? "Available" : "Coming Soon"}
                    </Badge>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {game.players}
                    </p>
                  </div>
                </div>

                {/* Game Rules */}
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-800 dark:text-white mb-3">
                    Game Rules
                  </h4>
                  <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                    {game.rules.map((rule, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-blue-500 mt-1.5 w-1.5 h-1.5 rounded-full bg-current flex-shrink-0"></span>
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Features */}
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-800 dark:text-white mb-3">
                    Features
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {game.features.map((feature, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Play Button */}
                {game.status === "available" ? (
                  <Link href={game.path}>
                    <button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] shadow-lg hover:shadow-xl">
                      Play {game.name}
                    </button>
                  </Link>
                ) : (
                  <button 
                    disabled 
                    className="w-full bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 font-semibold py-4 px-6 rounded-xl cursor-not-allowed"
                  >
                    Coming Soon
                  </button>
                )}
              </div>

              {/* Hover Effect Gradient */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-purple-600/5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
            </Card>
          ))}
        </div>

        {/* About Section */}
        <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-0 shadow-lg">
          <div className="p-8 text-center">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">
              Why QRFun Games?
            </h2>
            <div className="grid md:grid-cols-3 gap-8 mt-8">
              <div className="space-y-2">
                <div className="text-3xl">📱</div>
                <h3 className="font-semibold text-gray-800 dark:text-white">
                  Instant Sharing
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Share game rooms instantly with QR codes - no complex setup required
                </p>
              </div>
              <div className="space-y-2">
                <div className="text-3xl">🌐</div>
                <h3 className="font-semibold text-gray-800 dark:text-white">
                  Cross-Platform
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Play on any device - mobile, tablet, or desktop with the same experience
                </p>
              </div>
              <div className="space-y-2">
                <div className="text-3xl">⚡</div>
                <h3 className="font-semibold text-gray-800 dark:text-white">
                  Real-Time
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Lightning-fast multiplayer with live synchronization across all players
                </p>
              </div>
            </div>
          </div>
        </Card>
      </main>

      {/* Footer */}
      <footer className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-600 dark:text-gray-300">
            QRFun Games - Bringing people together through instant multiplayer gaming
          </p>
        </div>
      </footer>
    </div>
  );
}