import React from 'react';
import { Button } from '@/components/ui/button';

interface Player {
  id?: string;
  nickname: string;
  position?: number;
}

interface WinnerModalProps {
  isOpen: boolean;
  players: Player[];
  isSpectator: boolean;
  onClose: () => void;
}

export function WinnerModal({ isOpen, players, isSpectator, onClose }: WinnerModalProps) {
  if (!isOpen) return null;

  const sortedPlayers = [...players].sort((a, b) => (a.position || 0) - (b.position || 0));

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl border-2 border-slate-600 shadow-2xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-t-2xl p-4 text-center">
          <div className="text-2xl font-bold text-white mb-1">🏆 Game Complete!</div>
          <div className="text-yellow-100 text-sm">Final Rankings</div>
        </div>

        {/* Rankings */}
        <div className="p-6">
          <div className="space-y-3 mb-6">
            {sortedPlayers.map((player, index) => (
              <div 
                key={player.id || index}
                className={`flex items-center justify-between p-3 rounded-lg border-2 ${
                  index === 0 
                    ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border-yellow-500' 
                    : 'bg-slate-700/50 border-slate-600'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    index === 0 
                      ? 'bg-yellow-500 text-white' 
                      : 'bg-slate-600 text-slate-200'
                  }`}>
                    {index + 1}
                  </div>
                  <span className="text-white font-medium">{player.nickname}</span>
                </div>
                {index === 0 && (
                  <div className="text-yellow-500 text-xl">👑</div>
                )}
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={onClose}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}