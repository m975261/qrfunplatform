import React from 'react';

interface GameDirectionIndicatorProps {
  direction: 'clockwise' | 'counterclockwise';
  isVisible: boolean;
}

export function GameDirectionIndicator({ direction, isVisible }: GameDirectionIndicatorProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed top-16 left-4 z-30">
      <div className="bg-slate-800/95 backdrop-blur-sm border-2 border-slate-600 rounded-full p-2 shadow-lg">
        <div className="flex items-center justify-center">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center border-2 border-white shadow-md">
            <span className="text-white text-xl font-bold select-none">
              {direction === 'clockwise' ? '↻' : '↺'}
            </span>
          </div>
        </div>
        <div className="text-center mt-1">
          <span className="text-white text-xs font-medium">
            {direction === 'clockwise' ? 'Clockwise' : 'Counter'}
          </span>
        </div>
      </div>
    </div>
  );
}