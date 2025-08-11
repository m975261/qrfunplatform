import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, Home } from "lucide-react";
import { useEffect } from "react";

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
  // Enhanced Safari iOS modal compatibility
  useEffect(() => {
    console.log("🏆 GameEndModal mounted - applying Safari fixes");
    
    // Force viewport meta tag for iOS Safari
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) {
      viewportMeta = document.createElement('meta');
      viewportMeta.setAttribute('name', 'viewport');
      document.head.appendChild(viewportMeta);
    }
    const originalViewport = viewportMeta.getAttribute('content');
    viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, minimal-ui');
    
    // Store original body styles
    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyPosition = document.body.style.position;
    const originalBodyWidth = document.body.style.width;
    const originalBodyHeight = document.body.style.height;
    const originalDocumentOverflow = document.documentElement.style.overflow;
    
    // Apply Safari-specific body locking
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100vw';
    document.body.style.height = '100vh';
    document.body.style.top = '0';
    document.body.style.left = '0';
    document.documentElement.style.overflow = 'hidden';
    
    // Force reflow to ensure styles are applied
    document.body.offsetHeight;
    
    return () => {
      console.log("🏆 GameEndModal unmounting - restoring styles");
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.position = originalBodyPosition;
      document.body.style.width = originalBodyWidth;
      document.body.style.height = originalBodyHeight;
      document.body.style.top = '';
      document.body.style.left = '';
      document.documentElement.style.overflow = originalDocumentOverflow;
      
      if (originalViewport) {
        viewportMeta?.setAttribute('content', originalViewport);
      }
    };
  }, []);

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center"
      style={{ 
        position: 'fixed !important',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 99999,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex !important',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
        overflow: 'auto',
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden',
        WebkitTransform: 'translate3d(0, 0, 0)',
        transform: 'translate3d(0, 0, 0)',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'none'
      }}
      onClick={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.preventDefault()}
      data-testid="game-end-modal"
    >
      <Card 
        className="max-w-md w-full mx-4 animate-slide-up"
        style={{
          maxWidth: '400px',
          width: '100%',
          maxHeight: '90vh',
          margin: '0 auto',
          position: 'relative',
          zIndex: 10000,
          backgroundColor: 'white',
          borderRadius: '12px',
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
        }}
      >
        <CardContent 
          className="p-8 text-center"
          style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            position: 'relative',
            zIndex: 10001
          }}
        >
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
              style={{
                minHeight: '44px',
                fontSize: '16px',
                WebkitAppearance: 'none',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Play Again
            </Button>
            <Button
              onClick={onBackToLobby}
              variant="outline"
              className="w-full"
              style={{
                minHeight: '44px',
                fontSize: '16px',
                WebkitAppearance: 'none',
                WebkitTapHighlightColor: 'transparent'
              }}
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
