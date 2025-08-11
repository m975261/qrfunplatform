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
  // Enhanced Safari compatibility with forced rendering
  useEffect(() => {
    console.log("🏆 GameEndModal mounted - Safari compatibility mode", {
      winner,
      rankings,
      userAgent: navigator.userAgent,
      isSafari: /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)
    });

    // Force viewport and prevent scrolling - enhanced for Safari
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) {
      viewportMeta = document.createElement('meta');
      viewportMeta.setAttribute('name', 'viewport');
      document.head.appendChild(viewportMeta);
    }
    viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover, maximum-scale=1.0');
    
    // Prevent body scroll with Safari-specific fixes
    const originalStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      width: document.body.style.width,
      height: document.body.style.height,
      touchAction: document.body.style.touchAction
    };
    
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.body.style.touchAction = 'none'; // Prevent Safari scroll bounce
    
    // Force Safari to acknowledge the modal exists
    const forceRender = () => {
      console.log("🏆 Forcing Safari render acknowledgment");
      document.body.offsetHeight; // Force reflow
    };
    
    // Multiple render forcing techniques for Safari
    requestAnimationFrame(forceRender);
    setTimeout(forceRender, 50);
    setTimeout(forceRender, 100);
    
    return () => {
      document.body.style.overflow = originalStyles.overflow;
      document.body.style.position = originalStyles.position;
      document.body.style.width = originalStyles.width;
      document.body.style.height = originalStyles.height;
      document.body.style.touchAction = originalStyles.touchAction;
    };
  }, [winner, rankings]);

  // Safari-compatible modal container with maximum compatibility
  return (
    <div 
      className="gameEndModalOverlay"
      style={{ 
        // Use direct CSS properties for maximum Safari compatibility
        position: 'fixed',
        top: '0px',
        left: '0px', 
        right: '0px',
        bottom: '0px',
        width: '100vw',
        height: '100vh',
        zIndex: '99999',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box',
        // Safari-specific properties
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden',
        WebkitPerspective: '1000px',
        perspective: '1000px',
        WebkitTransform: 'translateZ(0)',
        transform: 'translateZ(0)',
        // Force Safari to render
        opacity: '1',
        visibility: 'visible',
        pointerEvents: 'auto',
        // Prevent touch events from propagating
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="gameEndModalCard"
        style={{
          // Direct styling for maximum Safari compatibility
          maxWidth: '400px',
          width: '90%',
          maxHeight: '80vh',
          minHeight: '400px',
          position: 'relative',
          zIndex: '100000',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
          transform: 'translateZ(0) scale(1)',
          WebkitTransform: 'translateZ(0) scale(1)',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
          border: '2px solid #e5e5e5',
          // Animation with Safari fallback
          animation: 'modalSlideUp 0.3s ease-out forwards',
          WebkitAnimation: 'modalSlideUp 0.3s ease-out forwards',
          // Force visibility
          opacity: '1',
          visibility: 'visible',
          display: 'block'
        }}
      >
        <div 
          className="gameEndModalContent"
          style={{
            padding: '32px',
            textAlign: 'center',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            position: 'relative',
            zIndex: '100001',
            minHeight: '300px',
            display: 'block',
            width: '100%',
            boxSizing: 'border-box'
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
        </div>
      </div>
    </div>
  );
}
