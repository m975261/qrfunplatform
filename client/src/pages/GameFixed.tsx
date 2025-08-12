import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Users, MessageCircle, Home } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import GameCard from '@/components/game/Card';

export default function GameFixed() {
  const params = useParams<{ roomId?: string }>();
  const [location, navigate] = useLocation();
  const roomId = params?.roomId || new URLSearchParams(window.location.search).get('room') || '';
  
  const {
    gameState,
    playerId,
    joinRoom,
    playCard,
    drawCard,
    callUno,
    chooseColor,
    sendChatMessage,
    sendEmoji,
    exitGame,
    kickPlayer,
    continueGame,
    replacePlayer,
    playAgain,
    isConnected
  } = useSocket();

  const [showChat, setShowChat] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showGameEnd, setShowGameEnd] = useState(false);
  const [gameEndData, setGameEndData] = useState<any>(null);
  const [pendingWildCard, setPendingWildCard] = useState<number | null>(null);
  const [timer, setTimer] = useState(30);
  const [hasCalledUno, setHasCalledUno] = useState(false);
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);
  const [showNicknameEditor, setShowNicknameEditor] = useState(false);

  useEffect(() => {
    if (roomId && playerId && isConnected) {
      joinRoom(playerId, roomId);
    }
  }, [roomId, playerId, isConnected, joinRoom]);

  // Universal winner modal - works on all browsers including iOS Safari
  useEffect(() => {
    if (gameState?.gameEndData) {
      const { winner, rankings } = gameState.gameEndData;
      console.log("🏆 Game ended - Winner:", winner, "Rankings:", rankings);
      
      // Create universal modal that works on all browsers
      const createWinnerModal = () => {
        // Remove any existing modal
        const existing = document.getElementById('winner-modal');
        if (existing) existing.remove();
        
        // Create modal container
        const modal = document.createElement('div');
        modal.id = 'winner-modal';
        modal.style.cssText = `
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          background-color: rgba(0, 0, 0, 0.8) !important;
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
          z-index: 10000 !important;
          font-family: system-ui, -apple-system, sans-serif !important;
        `;
        
        // Create modal content
        const content = document.createElement('div');
        content.style.cssText = `
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
          border-radius: 16px !important;
          padding: 32px !important;
          text-align: center !important;
          color: white !important;
          max-width: 90% !important;
          width: 400px !important;
          box-shadow: 0 20px 40px rgba(0,0,0,0.5) !important;
        `;
        
        // Trophy icon
        const trophy = document.createElement('div');
        trophy.textContent = '🏆';
        trophy.style.cssText = `
          font-size: 48px !important;
          margin-bottom: 16px !important;
        `;
        
        // Winner title
        const title = document.createElement('h2');
        title.textContent = `${winner} Wins!`;
        title.style.cssText = `
          font-size: 28px !important;
          margin: 0 0 16px 0 !important;
          font-weight: bold !important;
        `;
        
        // Rankings section
        const rankingsDiv = document.createElement('div');
        rankingsDiv.style.cssText = `
          background: rgba(255,255,255,0.2) !important;
          border-radius: 12px !important;
          padding: 20px !important;
          margin: 20px 0 !important;
        `;
        
        const rankingsTitle = document.createElement('h3');
        rankingsTitle.textContent = 'Final Rankings:';
        rankingsTitle.style.cssText = `
          margin: 0 0 16px 0 !important;
          font-size: 18px !important;
        `;
        
        rankingsDiv.appendChild(rankingsTitle);
        
        // Add each ranking
        rankings.forEach((player, index) => {
          const rankItem = document.createElement('div');
          rankItem.textContent = `${index + 1}${index === 0 ? 'st' : index === 1 ? 'nd' : index === 2 ? 'rd' : 'th'} - ${player.nickname}`;
          rankItem.style.cssText = `
            padding: 8px 0 !important;
            font-size: 16px !important;
            font-weight: ${index === 0 ? 'bold' : 'normal'} !important;
            border-bottom: ${index < rankings.length - 1 ? '1px solid rgba(255,255,255,0.3)' : 'none'} !important;
          `;
          rankingsDiv.appendChild(rankItem);
        });
        
        // Buttons container
        const buttonsDiv = document.createElement('div');
        buttonsDiv.style.cssText = `
          display: flex !important;
          gap: 12px !important;
          margin-top: 24px !important;
        `;
        
        // Play Again button
        const playAgainBtn = document.createElement('button');
        playAgainBtn.textContent = 'Play Again';
        playAgainBtn.style.cssText = `
          flex: 1 !important;
          background: #4CAF50 !important;
          color: white !important;
          border: none !important;
          padding: 16px !important;
          border-radius: 8px !important;
          font-size: 16px !important;
          font-weight: bold !important;
          cursor: pointer !important;
          min-height: 48px !important;
        `;
        playAgainBtn.onclick = () => {
          modal.remove();
          window.location.reload();
        };
        
        // Home button
        const homeBtn = document.createElement('button');
        homeBtn.textContent = 'Home';
        homeBtn.style.cssText = `
          flex: 1 !important;
          background: #f44336 !important;
          color: white !important;
          border: none !important;
          padding: 16px !important;
          border-radius: 8px !important;
          font-size: 16px !important;
          font-weight: bold !important;
          cursor: pointer !important;
          min-height: 48px !important;
        `;
        homeBtn.onclick = () => {
          modal.remove();
          localStorage.removeItem("roomId");
          localStorage.removeItem("playerId");
          window.location.href = "/";
        };
        
        // Assemble modal
        buttonsDiv.appendChild(playAgainBtn);
        buttonsDiv.appendChild(homeBtn);
        
        content.appendChild(trophy);
        content.appendChild(title);
        content.appendChild(rankingsDiv);
        content.appendChild(buttonsDiv);
        
        modal.appendChild(content);
        
        // Add to document
        document.body.appendChild(modal);
        console.log("🏆 Universal winner modal created and displayed");
      };
      
      // Create modal immediately
      createWinnerModal();
    }
    
    if (gameState?.needsContinue) {
      setShowContinuePrompt(true);
    }
  }, [gameState?.gameEndData, gameState?.needsContinue]);

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-teal-500 flex items-center justify-center">
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardContent className="p-8 text-center text-white">
            <div className="animate-spin w-8 h-8 border-4 border-white/30 border-t-white rounded-full mx-auto mb-4" />
            <p>Connecting to game...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const room = gameState.room;
  const players = gameState.players || [];
  const currentPlayer = players.find(p => p.id === playerId);
  const isHost = currentPlayer?.id === room.hostId;
  const isSpectator = currentPlayer?.isSpectator || false;
  const topCard = gameState.topCard;
  const direction = room.direction || 'clockwise';
  const currentPlayerIndex = room.currentPlayerIndex || 0;
  const activePlayer = players[currentPlayerIndex];
  const isMyTurn = activePlayer?.id === playerId && !isSpectator;
  const needsColorChoice = gameState.needsColorChoice;

  const handleUnoCall = async () => {
    if (!hasCalledUno && !currentPlayer?.hasCalledUno) {
      setHasCalledUno(true);
      await callUno();
    }
  };

  const handleColorChoice = async (color: string) => {
    if (pendingWildCard !== null) {
      await chooseColor(color);
      setPendingWildCard(null);
    }
    setShowColorPicker(false);
  };

  // Get player positions for circular layout
  const getPlayerPositions = () => {
    const positions = [
      { top: '10%', left: '50%', transform: 'translateX(-50%)' }, // Top
      { top: '50%', right: '5%', transform: 'translateY(-50%)' },  // Right
      { bottom: '10%', left: '50%', transform: 'translateX(-50%)' }, // Bottom
      { top: '50%', left: '5%', transform: 'translateY(-50%)' }   // Left
    ];

    // Find current player's index to adjust positioning
    const currentPlayerPos = players.findIndex(p => p.id === playerId);
    if (currentPlayerPos === -1) return positions;

    // Rotate positions so current player is at bottom
    const rotated = [];
    for (let i = 0; i < 4; i++) {
      const adjustedIndex = (i + currentPlayerPos) % 4;
      rotated[adjustedIndex] = positions[i];
    }
    return rotated;
  };

  const playerPositions = getPlayerPositions();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-teal-500 relative overflow-hidden">
      
      {/* Top Status Bar */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
        <div className="bg-purple-500/90 backdrop-blur-sm px-6 py-3 rounded-full border border-white/30 text-white text-center min-w-max">
          <div className="flex items-center space-x-4 text-lg font-semibold">
            <span>Status: {room.status}</span>
            <span>Dir: {direction === 'clockwise' ? '↻' : '↺'}</span>
          </div>
        </div>
      </div>

      {/* Players positioned around the circle */}
      {players.slice(0, 4).map((player, index) => {
        const position = playerPositions[index];
        const isCurrentPlayer = player.id === playerId;
        const isActivePlayer = activePlayer?.id === player.id;
        const isFinished = player.finishPosition !== null;
        
        return (
          <div
            key={player.id}
            className="absolute"
            style={position}
          >
            <div className={`relative ${isActivePlayer ? 'animate-pulse' : ''}`}>
              {/* Player circle */}
              <div className={`w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg ${
                isFinished 
                  ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' 
                  : isCurrentPlayer 
                    ? 'bg-gradient-to-r from-green-400 to-green-600' 
                    : 'bg-gradient-to-r from-blue-400 to-blue-600'
              }`}>
                {isFinished ? (
                  <div className="text-center">
                    <div className="text-xs font-bold">{player.finishPosition === 1 ? '1ST' : player.finishPosition === 2 ? '2ND' : player.finishPosition === 3 ? '3RD' : '4TH'}</div>
                  </div>
                ) : (
                  <span>{player.nickname.charAt(0).toUpperCase()}</span>
                )}
              </div>
              
              {/* Player name */}
              <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-center">
                <div className="text-white font-medium text-sm whitespace-nowrap">
                  {player.nickname}
                </div>
              </div>
              
              {/* Card count badge */}
              {!isFinished && player.hand && player.hand.length > 0 && (
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  {player.hand.length}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Center game area */}
      <div className="absolute inset-0 flex items-center justify-center">
        
        {/* Main game circle */}
        <div className="relative w-64 h-64 bg-white/10 backdrop-blur-sm rounded-full border-4 border-white/30 shadow-2xl">
          
          {/* Center card display */}
          <div className="absolute inset-0 flex items-center justify-center">
            {topCard && <GameCard card={topCard} />}
          </div>
          
        </div>

        {/* Draw pile - positioned to the right */}
        <div className="absolute left-full ml-8">
          <div 
            className="w-20 h-28 bg-gray-800 rounded-lg border-2 border-gray-600 cursor-pointer hover:bg-gray-700 transition-colors flex flex-col items-center justify-center text-white shadow-lg"
            onClick={() => isMyTurn && !needsColorChoice && drawCard()}
          >
            <div className="text-2xl font-bold mb-1">📚</div>
            <div className="text-xs font-medium">Cards</div>
          </div>
        </div>

        {/* UNO button - positioned below right */}
        {!isSpectator && room.status === "playing" && (
          <div className="absolute top-full mt-8 left-3/4">
            <Button
              onClick={handleUnoCall}
              disabled={hasCalledUno || currentPlayer?.hasCalledUno}
              className={`font-bold text-sm px-4 py-2 rounded-full shadow-lg transition-all ${
                hasCalledUno || currentPlayer?.hasCalledUno
                  ? 'bg-green-500 text-white cursor-not-allowed'
                  : 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
              }`}
            >
              {hasCalledUno || currentPlayer?.hasCalledUno ? '✅ UNO CALLED' : '🔥 UNO! 🔥'}
            </Button>
          </div>
        )}

      </div>

      {/* Player hand at bottom */}
      {currentPlayer?.hand && currentPlayer.hand.length > 0 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 max-w-full">
          <div className="flex space-x-2 overflow-x-auto pb-2 px-4" style={{ maxHeight: '120px' }}>
            {currentPlayer.hand.map((card, index) => (
              <div
                key={index}
                className="flex-shrink-0 cursor-pointer hover:scale-105 transition-transform"
                onClick={() => isMyTurn && playCard(index)}
              >
                <GameCard card={card} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Color picker modal */}
      {showColorPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="bg-white p-6">
            <CardContent>
              <h3 className="text-lg font-bold mb-4">Choose a color:</h3>
              <div className="grid grid-cols-2 gap-4">
                {['red', 'blue', 'green', 'yellow'].map(color => (
                  <Button
                    key={color}
                    onClick={() => handleColorChoice(color)}
                    className={`w-20 h-20 rounded-full ${
                      color === 'red' ? 'bg-red-500 hover:bg-red-600' :
                      color === 'blue' ? 'bg-blue-500 hover:bg-blue-600' :
                      color === 'green' ? 'bg-green-500 hover:bg-green-600' :
                      'bg-yellow-500 hover:bg-yellow-600'
                    }`}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}