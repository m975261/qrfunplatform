import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send } from "lucide-react";

interface ChatPanelProps {
  messages: any[];
  players: any[];
  onSendMessage: (message: string) => void;
  onSendEmoji: (emoji: string) => void;
  onClose: () => void;
}

export default function ChatPanel({ messages, players, onSendMessage, onSendEmoji, onClose }: ChatPanelProps) {
  const [chatMessage, setChatMessage] = useState("");

  const quickEmojis = ["😊", "😎", "🎉", "😅", "🔥", "👏"];

  const handleSendMessage = () => {
    if (chatMessage.trim()) {
      onSendMessage(chatMessage);
      setChatMessage("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  const getPlayerName = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    return player?.nickname || "Unknown";
  };

  return (
    <div className="fixed bottom-32 md:bottom-40 left-2 md:left-4 z-40">
      <Card className="bg-white/95 backdrop-blur-sm shadow-xl w-56 md:w-64 max-h-48 md:max-h-56">
        <CardContent className="p-3">
          {/* Chat Header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">Chat</h3>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages */}
          <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
            {messages.map((message: any, index: number) => (
              <div key={index} className="text-sm">
                {message.type === "chat" ? (
                  <>
                    <span className="font-medium text-uno-blue">{getPlayerName(message.playerId)}:</span>
                    <span className="text-gray-700 ml-1">{message.message}</span>
                  </>
                ) : message.type === "emoji" ? (
                  <>
                    <span className="font-medium text-uno-blue">{getPlayerName(message.playerId)}:</span>
                    <span className="ml-1">{message.emoji}</span>
                  </>
                ) : (
                  <span className="text-gray-500 italic">{message.message}</span>
                )}
              </div>
            ))}
            {messages.length === 0 && (
              <div className="text-gray-500 text-center text-sm">No messages yet</div>
            )}
          </div>

          {/* Emoji Quick Actions */}
          <div className="grid grid-cols-6 gap-2 mb-3">
            {quickEmojis.map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                className="text-2xl hover:scale-125 transition-all p-1 rounded hover:bg-gray-100"
                onClick={() => onSendEmoji(emoji)}
              >
                {emoji}
              </Button>
            ))}
          </div>

          {/* Message Input */}
          <div className="flex space-x-2">
            <Input
              type="text"
              placeholder="Type a message..."
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1 text-sm"
            />
            <Button size="sm" onClick={handleSendMessage}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
