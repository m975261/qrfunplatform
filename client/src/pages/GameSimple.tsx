import { useEffect, useState } from "react";
import { useRoute } from "wouter";

export default function GameSimple() {
  const [, params] = useRoute("/game/:roomId");
  const roomId = params?.roomId;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-red-500 to-red-600 relative overflow-hidden">
      <div className="flex items-center justify-center h-screen">
        <div className="text-white text-center">
          <h1 className="text-4xl font-bold mb-4">UNO Game</h1>
          <p className="text-xl">Room: {roomId}</p>
          <p className="text-lg mt-4">Game loading...</p>
          <div className="mt-8 w-64 h-64 bg-yellow-300 rounded-full mx-auto flex items-center justify-center">
            <div className="text-red-600 text-2xl font-bold">UNO</div>
          </div>
        </div>
      </div>
    </div>
  );
}