import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface PlayerAvatarProps {
  nickname: string;
  size?: "small" | "medium" | "large";
  className?: string;
}

export default function PlayerAvatar({ nickname, size = "medium", className = "" }: PlayerAvatarProps) {
  // Generate a consistent avatar style based on nickname
  const getAvatarStyle = (name: string) => {
    const hash = name.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const avatarIndex = hash % 8;
    
    const avatarStyles = [
      {
        bg: "bg-gradient-to-br from-uno-red to-red-600",
        icon: "🎮",
        border: "border-red-300"
      },
      {
        bg: "bg-gradient-to-br from-uno-blue to-blue-600", 
        icon: "🎯",
        border: "border-blue-300"
      },
      {
        bg: "bg-gradient-to-br from-uno-green to-green-600",
        icon: "⭐",
        border: "border-green-300"
      },
      {
        bg: "bg-gradient-to-br from-uno-yellow to-yellow-600",
        icon: "⚡",
        border: "border-yellow-300"
      },
      {
        bg: "bg-gradient-to-br from-purple-500 to-purple-700",
        icon: "🔥",
        border: "border-purple-300"
      },
      {
        bg: "bg-gradient-to-br from-pink-500 to-rose-600",
        icon: "💫",
        border: "border-pink-300"
      },
      {
        bg: "bg-gradient-to-br from-orange-500 to-red-600",
        icon: "🎊",
        border: "border-orange-300"
      },
      {
        bg: "bg-gradient-to-br from-indigo-500 to-blue-700",
        icon: "🎪",
        border: "border-indigo-300"
      }
    ];
    
    return avatarStyles[avatarIndex];
  };

  const getSizeClasses = () => {
    switch (size) {
      case "small":
        return "h-8 w-8 text-xs";
      case "large":
        return "h-16 w-16 text-2xl";
      default:
        return "h-10 w-10 text-lg";
    }
  };

  const style = getAvatarStyle(nickname);

  return (
    <Avatar className={`${getSizeClasses()} ${className}`}>
      <AvatarFallback 
        className={`
          ${style.bg} ${style.border} 
          border-2 text-white font-bold
          flex items-center justify-center
          shadow-lg
        `}
      >
        <div className="flex flex-col items-center">
          <span className="text-white font-black">
            {nickname[0]?.toUpperCase() || "?"}
          </span>
          <span className="text-xs opacity-80">
            {style.icon}
          </span>
        </div>
      </AvatarFallback>
    </Avatar>
  );
}