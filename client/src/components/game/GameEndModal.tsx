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
  // MAXIMUM Safari compatibility with extensive debugging
  useEffect(() => {
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    console.log("🏆 GameEndModal MOUNTED - Maximum Safari Debug", {
      winner,
      rankings,
      isSafari,
      modalMounted: true,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      timestamp: new Date().toISOString()
    });

    // Safari-specific aggressive rendering techniques
    const originalStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      width: document.body.style.width,
      height: document.body.style.height,
      touchAction: document.body.style.touchAction
    };
    
    // Immediately lock body scroll
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100vh';
    document.body.style.touchAction = 'none';
    
    // Force viewport meta for Safari
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) {
      viewportMeta = document.createElement('meta');
      viewportMeta.setAttribute('name', 'viewport');
      document.head.appendChild(viewportMeta);
    }
    viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover, maximum-scale=1.0, minimum-scale=1.0');
    
    // Aggressive Safari rendering with multiple techniques
    const modalElement = document.querySelector('.gameEndModalOverlay') as HTMLElement;
    if (modalElement) {
      console.log("🏆 Modal element found, forcing Safari visibility");
      modalElement.style.display = 'flex';
      modalElement.style.visibility = 'visible';
      modalElement.style.opacity = '1';
    }
    
    // Multiple forced reflow techniques for Safari
    const forceMultipleRenders = () => {
      console.log("🏆 Safari render force pass");
      document.body.offsetHeight;
      if (modalElement) {
        modalElement.offsetHeight;
        modalElement.style.transform = 'translateZ(0) scale(1.0001)';
        setTimeout(() => modalElement.style.transform = 'translateZ(0) scale(1)', 10);
      }
    };
    
    // Immediate render
    forceMultipleRenders();
    // Animation frame render
    requestAnimationFrame(forceMultipleRenders);
    // Multiple timeout renders
    setTimeout(forceMultipleRenders, 16);
    setTimeout(forceMultipleRenders, 50);
    setTimeout(forceMultipleRenders, 100);
    setTimeout(forceMultipleRenders, 200);
    
    return () => {
      console.log("🏆 GameEndModal UNMOUNTING");
      document.body.style.overflow = originalStyles.overflow;
      document.body.style.position = originalStyles.position;
      document.body.style.width = originalStyles.width;
      document.body.style.height = originalStyles.height;
      document.body.style.touchAction = originalStyles.touchAction;
    };
  }, [winner, rankings]);

  // MAXIMUM SAFARI COMPATIBILITY with emergency fallback
  return (
    <>
      {/* Emergency Safari Fallback - Simple div with native styling */}
      <div 
        style={{
          position: 'fixed',
          top: '0',
          left: '0', 
          right: '0',
          bottom: '0',
          width: '100%',
          height: '100%',
          zIndex: 999999,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          display: 'flex !important',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div 
          style={{
            maxWidth: '350px',
            width: '90%',
            minHeight: '300px',
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            border: '3px solid #ffd700'
          }}
        >
          {/* Simple inline content for Safari */}
          <div style={{ marginBottom: '20px', fontSize: '24px' }}>🏆</div>
          <h2 style={{ color: '#333', margin: '0 0 10px 0', fontSize: '20px' }}>
            {winner} Wins!
          </h2>
          <p style={{ color: '#666', margin: '0 0 20px 0', fontSize: '14px' }}>
            Congratulations! 🎉
          </p>
          
          {/* Rankings */}
          <div style={{ marginBottom: '30px' }}>
            {rankings.map((player, index) => (
              <div key={index} style={{ 
                padding: '8px', 
                margin: '4px 0',
                backgroundColor: index === 0 ? '#ffd700' : '#f5f5f5',
                borderRadius: '6px',
                color: index === 0 ? 'white' : '#333',
                fontSize: '14px',
                fontWeight: index === 0 ? 'bold' : 'normal'
              }}>
                {index + 1}. {player.nickname} {index === 0 ? '👑' : ''}
              </div>
            ))}
          </div>
          
          {/* Buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <Button
              onClick={onPlayAgain}
              style={{
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '6px',
                fontSize: '14px',
                minHeight: '44px'
              }}
            >
              Play Again
            </Button>
            <Button
              onClick={onBackToLobby}
              style={{
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '6px',
                fontSize: '14px',
                minHeight: '44px'
              }}
            >
              Back to Home
            </Button>
          </div>
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
      </>
  );
}
