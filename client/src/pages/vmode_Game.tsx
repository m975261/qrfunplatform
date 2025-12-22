import { useEffect, useState, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Menu, ArrowRight, ArrowLeft, Users, MessageCircle, Share2, Pencil, QrCode, Copy, GripVertical, X } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { useToast } from "@/hooks/use-toast";
import PlayerArea from "@/components/game/PlayerArea";
import GameCard from "@/components/game/Card";
import ChatPanel from "@/components/game/ChatPanel";
import GameEndModal from "@/components/game/GameEndModal";
import ColorPickerModal from "@/components/game/ColorPickerModal";
import NicknameEditor from "@/components/NicknameEditor";

import { WinnerModal } from "@/components/game/WinnerModal";
import GuruCardReplaceModal from "@/components/game/GuruCardReplaceModal";

export default function VmodeGame() {
  const [, params] = useRoute("/vmode/game/:roomId");
  const [, setLocation] = useLocation();
  const roomId = params?.roomId;
  const playerId = localStorage.getItem("playerId") || localStorage.getItem("userId");
  const { toast } = useToast();
  

  
  const {
    gameState,
    setGameState,
    avatarMessages,
    joinRoom,
    playCard,
    drawCard,
    callUno,
    chooseColor,
    sendChatMessage,
    sendEmoji,
    sendAvatarChange,
    exitGame,
    kickPlayer,
    continueGame,
    replacePlayer,
    playAgain,
    submitHostVote,
    assignHost,
    hostEndGame,
    hostExitRoom,
    voteNoHost,
    streamSubscribe,
    isConnected,
    refreshGameState
  } = useSocket();
  
  // Track if this is the room creator (no playerId in Viewer Mode)
  const isRoomCreator = !playerId && !!roomId;

  const [showChat, setShowChat] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showGameEnd, setShowGameEnd] = useState(false);
  const [gameEndData, setGameEndData] = useState<any>(null);
  const [pendingWildCard, setPendingWildCard] = useState<number | null>(null);
  const [timer, setTimer] = useState(30);
  const [hasCalledUno, setHasCalledUno] = useState(false);
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);
  const [showNicknameEditor, setShowNicknameEditor] = useState(false);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winnerData, setWinnerData] = useState<any>(null);
  const [showGuruReplaceModal, setShowGuruReplaceModal] = useState(false);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
  const [selectedAvatarPlayerId, setSelectedAvatarPlayerId] = useState<string | null>(null);
  const [unoPenaltyAnimation, setUnoPenaltyAnimation] = useState<{ playerName: string; show: boolean } | null>(null);
  const [handRefreshKey, setHandRefreshKey] = useState(0);
  const [showConnectionError, setShowConnectionError] = useState(false);
  const [cardAnimation, setCardAnimation] = useState<{
    card: any;
    from: 'player' | 'opponent' | 'deck';
    to: 'discard' | 'player';
    show: boolean;
  } | null>(null);
  
  // Host election state - voting happens during countdown, no separate modal
  const [electionCandidates, setElectionCandidates] = useState<{id: string, nickname: string}[]>([]);
  const [electionVotes, setElectionVotes] = useState<{[id: string]: number}>({});
  const [hasVoted, setHasVoted] = useState(false);
  const [hostDisconnectedWarning, setHostDisconnectedWarning] = useState<string | null>(null);
  const [electionCountdown, setElectionCountdown] = useState(30);
  const [hostCanReturn, setHostCanReturn] = useState(true);
  const [bannerDragOffset, setBannerDragOffset] = useState({ x: 0, y: 0 });
  const [isDraggingBanner, setIsDraggingBanner] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [showVotingWindow, setShowVotingWindow] = useState(false);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // QR Code state
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeData, setQRCodeData] = useState<string | null>(null);
  
  // Viewer panel toggle state
  const [showViewers, setShowViewers] = useState(false);
  const [viewerPanelPosition, setViewerPanelPosition] = useState({ x: -1, y: -1 }); // -1 means use default position
  const [viewerPanelSize, setViewerPanelSize] = useState({ width: 210, height: 280 });
  const [isDraggingViewerPanel, setIsDraggingViewerPanel] = useState(false);
  const [isResizingViewerPanel, setIsResizingViewerPanel] = useState(false);
  const [viewerPanelDragStart, setViewerPanelDragStart] = useState({ x: 0, y: 0, panelX: 0, panelY: 0 });
  const [viewerPanelResizeStart, setViewerPanelResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const viewerPanelRef = useRef<HTMLDivElement>(null);
  const [qrPosition, setQrPosition] = useState({ x: 20, y: 100 });
  const [isDraggingQR, setIsDraggingQR] = useState(false);
  const [dragStartPosQR, setDragStartPosQR] = useState({ x: 0, y: 0 });
  const qrButtonRef = useRef<HTMLButtonElement>(null);
  const qrPanelRef = useRef<HTMLDivElement>(null);

  // Debug logs for troubleshooting

  useEffect(() => {
    if (roomId && isConnected) {
      if (playerId) {
        // Player joining game
        joinRoom(playerId, roomId);
      } else {
        // Room creator subscribing as viewer (no playerId)
        const roomCode = new URLSearchParams(window.location.search).get('code');
        streamSubscribe(roomId, roomCode || undefined);
      }
    }
  }, [roomId, playerId, isConnected, joinRoom, streamSubscribe]);

  // Fetch QR code when room data is available
  useEffect(() => {
    if (gameState?.room?.id) {
      fetch(`/api/rooms/${gameState.room.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.qrCode) {
            setQRCodeData(data.qrCode);
          }
        })
        .catch(err => console.error("Failed to fetch QR code:", err));
    }
  }, [gameState?.room?.id]);

  // QR Code drag handlers
  const handleQRDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDraggingQR(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragStartPosQR({ x: clientX - qrPosition.x, y: clientY - qrPosition.y });
  };

  // Global mouse/touch move and end for QR dragging
  useEffect(() => {
    if (!isDraggingQR) return;
    
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      setQrPosition({
        x: Math.max(0, Math.min(window.innerWidth - 200, clientX - dragStartPosQR.x)),
        y: Math.max(0, Math.min(window.innerHeight - 300, clientY - dragStartPosQR.y))
      });
    };
    
    const handleEnd = () => setIsDraggingQR(false);
    
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);
    
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDraggingQR, dragStartPosQR]);

  useEffect(() => {
    // Sync voting window visibility with host disconnection state
    if (hostDisconnectedWarning && electionCandidates.length > 0) {
      setShowVotingWindow(true);
    } else {
      setShowVotingWindow(false);
    }
  }, [hostDisconnectedWarning, electionCandidates]);

  useEffect(() => {
    if (gameState?.gameEndData) {
      // Map the server data to what the component expects
      const mappedData = {
        ...gameState.gameEndData,
        finalRankings: gameState.gameEndData.rankings || gameState.gameEndData.finalRankings || []
      };
      setWinnerData(mappedData);
      setShowWinnerModal(true);
      
      // Additional fix for disconnected players - force modal show after delay
      setTimeout(() => {
        if (mappedData && !showWinnerModal) {
          setShowWinnerModal(true);
        }
      }, 1000);
    }
    
    // CRITICAL FIX: Check if room is finished but no gameEndData (disconnected player case)
    if (gameState?.room?.status === 'finished' && !gameState?.gameEndData && !showWinnerModal) {
      // Request game end data from server for this specific case
      if (roomId) {
        fetch(`/api/rooms/${roomId}/game-end-data`, {
          headers: { 'Authorization': `Bearer ${playerId}` }
        })
        .then(res => res.json())
        .then(data => {
          if (data.winner && data.rankings) {
            setWinnerData({
              winner: data.winner,
              finalRankings: data.rankings,
              timestamp: Date.now()
            });
            setShowWinnerModal(true);
          }
        })
        .catch(err => console.error("Failed to fetch game end data:", err));
      }
    }
    
    if (gameState?.needsContinue) {
      setShowContinuePrompt(true);
    }
    
    // Handle UNO penalty animation
    if (gameState?.unoPenaltyAnimation?.show) {
      setUnoPenaltyAnimation({
        playerName: gameState.unoPenaltyAnimation.playerName,
        show: true
      });
      
      // Hide animation after 4 seconds
      setTimeout(() => {
        setUnoPenaltyAnimation(null);
      }, 4000);
    }
  }, [gameState?.gameEndData, gameState?.needsContinue, gameState?.room?.status, showWinnerModal, roomId, playerId, gameState?.unoPenaltyAnimation]);

  // Handle card replacement visual updates
  useEffect(() => {
    if (gameState?.cardReplacementTrigger) {
      setHandRefreshKey(prev => prev + 1);
    }
  }, [gameState?.cardReplacementTrigger]);

  // Handle server color choice request - only show for the player who needs to choose, not viewers
  useEffect(() => {
    // Viewers (no playerId or room creators) should never see color picker
    if (!playerId) {
      setShowColorPicker(false);
      return;
    }
    
    // If color is already set, don't show the picker (guru already chose color)
    if (gameState?.room?.currentColor && gameState?.room?.currentColor !== 'wild') {
      setShowColorPicker(false);
      return;
    }
    
    // Only show color picker if this specific player is the one who needs to choose
    // Check waitingForColorChoice explicitly matches this player's ID
    if (gameState?.room?.waitingForColorChoice === playerId) {
      setShowColorPicker(true);
    } else if (gameState?.colorChoiceRequested && gameState?.room?.currentPlayerIndex !== undefined) {
      // Secondary check: only if colorChoiceRequested and this is the current player
      const players = gameState?.players?.filter((p: any) => !p.isSpectator).sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
      const currentPlayer = players?.[gameState.room.currentPlayerIndex];
      if (currentPlayer?.id === playerId && gameState?.room?.waitingForColorChoice === playerId) {
        setShowColorPicker(true);
      }
    }
  }, [gameState?.colorChoiceRequested, gameState?.room?.waitingForColorChoice, gameState?.room?.currentPlayerIndex, gameState?.room?.currentColor, gameState?.players, playerId]);

  // Handle active color updates for visual refresh
  useEffect(() => {
    if (gameState?.colorUpdate || gameState?.activeColorUpdate || gameState?.colorUpdateTimestamp) {
      // Force component refresh when color changes
      setHandRefreshKey(prev => prev + 1);
    }
  }, [gameState?.colorUpdate, gameState?.activeColorUpdate, gameState?.colorUpdateTimestamp, gameState?.room?.currentColor]);

  // VIEWER AUTO-FOLLOW: When room status changes to 'waiting' (host reset game), 
  // auto-close winner modal and redirect to lobby to follow host
  useEffect(() => {
    if (gameState?.room?.status === 'waiting' && showWinnerModal) {
      // Host has reset the game - auto-close winner modal and follow to lobby
      setShowWinnerModal(false);
      setWinnerData(null);
      // Redirect to lobby page to follow host
      if (roomId) {
        window.location.href = `/vmode/room/${roomId}`;
      }
    }
  }, [gameState?.room?.status, showWinnerModal, roomId]);

  // Handle host election messages
  useEffect(() => {
    if (gameState?.hostDisconnectedWarning) {
      setHostDisconnectedWarning(gameState.hostDisconnectedWarning);
      setElectionCountdown(gameState.electionStartsIn || 30);
      
      // Clear any existing interval first
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      
      // Start countdown timer
      countdownIntervalRef.current = setInterval(() => {
        setElectionCountdown(prev => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      };
    } else {
      // Host has returned - clear election state immediately and stop timer
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setHostDisconnectedWarning(null);
      setElectionCountdown(30);
      setElectionCandidates([]);
      setElectionVotes({});
      setHasVoted(false);
      setShowVotingWindow(false);
    }
  }, [gameState?.hostDisconnectedWarning]);

  useEffect(() => {
    if (gameState?.hostElectionActive) {
      // Election is active - candidates come from the warning message now
      setElectionCandidates(gameState.electionCandidates || []);
      setHostCanReturn(gameState.hostCanReturn ?? true);
      // Don't reset hasVoted here - let it persist until election ends
    } else {
      // Reset all election state when election ends or host returns
      setHasVoted(false);
      setElectionCandidates([]);
      setElectionVotes({});
      setHostDisconnectedWarning(null);
      setHostCanReturn(true);
      setShowVotingWindow(false); // Force close voting window
      // Stop countdown timer
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setElectionCountdown(30);
    }
  }, [gameState?.hostElectionActive]);

  useEffect(() => {
    if (gameState?.electionVotes) {
      setElectionVotes(gameState.electionVotes);
    }
  }, [gameState?.electionVotes]);

  // Clear newHostName when new host is elected
  useEffect(() => {
    if (gameState?.newHostName) {
      setGameState((prev: any) => ({
        ...prev,
        newHostName: null
      }));
    }
  }, [gameState?.newHostName]);

  const handleVoteForHost = (candidateId: string) => {
    if (hasVoted) return;
    submitHostVote(candidateId);
    setHasVoted(true);
  };

  const handlePlayCard = (cardIndex: number) => {
    const player = gameState?.players?.find((p: any) => p.id === playerId);
    const card = player?.hand?.[cardIndex];
    
    // Show card animation
    if (card) {
      setCardAnimation({
        card: { ...card },
        from: 'player',
        to: 'discard',
        show: true
      });
      setTimeout(() => setCardAnimation(null), 400);
    }
    
    if (card?.type === "wild" || card?.type === "wild4") {
      // Play the wild card first, server will request color choice
      playCard(cardIndex);
    } else {
      playCard(cardIndex);
    }
  };

  const handleColorChoice = (color: string) => {
    const isGuruUserLocal = localStorage.getItem("isGuruUser") === "true";
    
    chooseColor(color);
    setShowColorPicker(false);
    
    // Clear the colorChoiceRequested flag immediately and update current color
    setGameState((prev: any) => ({
      ...prev,
      colorChoiceRequested: false,
      selectedColor: color,
      room: {
        ...prev?.room,
        currentColor: color, // Update the current color immediately for all players
        waitingForColorChoice: null // Clear waiting state
      },
      forceRefresh: Math.random(),
      colorUpdate: Date.now(), // Add color update trigger
      activeColorUpdate: Date.now() // Specific trigger for active color display
    }));
    
    // Force immediate visual refresh after color choice
    setHandRefreshKey(prev => prev + 1);
    
    // For guru/admin users - instant update, no delays
    // For regular users - use gradual refresh intervals
    if (!isGuruUserLocal) {
      setTimeout(() => setHandRefreshKey(prev => prev + 1), 1);
      setTimeout(() => setHandRefreshKey(prev => prev + 1), 5);
      setTimeout(() => setHandRefreshKey(prev => prev + 1), 10);
      setTimeout(() => setHandRefreshKey(prev => prev + 1), 20);
      setTimeout(() => setHandRefreshKey(prev => prev + 1), 30);
    }
  };

  const handleUnoCall = () => {
    const player = gameState?.players?.find((p: any) => p.id === playerId);
    if (!player?.hasCalledUno) {
      callUno();
      setHasCalledUno(true);
      // UNO call will be validated on the server and work only when playing second-to-last card
    }
  };

  // New unified end game handler - return all players to lobby as spectators
  const handleEndGameClose = async () => {
    setShowWinnerModal(false);
    setWinnerData(null);
    
    // First trigger the end-game reset on server
    if (roomId) {
      try {
        const response = await fetch(`/api/rooms/${roomId}/end-game-reset`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${playerId}`
          }
        });
        
      } catch (error) {
        // Silent error handling
      }
      
      // Navigate back to room lobby
      window.location.href = `/vmode/room/${roomId}`;
    } else {
      setLocation("/");
    }
  };

  // Guru card replacement handlers
  const handleGuruCardReplace = (cardIndex: number) => {
    setSelectedCardIndex(cardIndex);
    setShowGuruReplaceModal(true);
  };

  // Guru Wild Draw 4 response - allows guru to instantly play +4 when facing a pending draw
  const [showGuruWild4ColorPicker, setShowGuruWild4ColorPicker] = useState(false);
  
  // Guru +2/+4/Color with card sacrifice - new flow
  const [guruCardMode, setGuruCardMode] = useState<'+2' | '+4' | 'color' | null>(null);
  const [guruSelectedColor, setGuruSelectedColor] = useState<string | null>(null);
  const [showGuruCardPicker, setShowGuruCardPicker] = useState(false);
  
  const handleGuruWild4Response = async (color: string) => {
    if (!roomId || !playerId) return;
    
    try {
      const response = await fetch(`/api/rooms/${roomId}/guru-wild4-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${playerId}`
        },
        body: JSON.stringify({ color })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setShowGuruWild4ColorPicker(false);
      }
    } catch (error) {
      // Silent error handling
    }
  };

  // Guru +2/+4/Color with card sacrifice - color selection step
  const handleGuruStartCard = (mode: '+2' | '+4' | 'color') => {
    setGuruCardMode(mode);
    setGuruSelectedColor(null);
    // Show inline color options in the buttons area
  };

  // Guru color selected - now show card sacrifice picker
  const handleGuruColorSelect = (color: string) => {
    setGuruSelectedColor(color);
    setShowGuruCardPicker(true);
  };

  // Guru card sacrifice - execute the +2, +4, or color change
  const handleGuruCardSacrifice = async (sacrificeCardIndex: number) => {
    if (!roomId || !playerId || !guruSelectedColor || !guruCardMode) return;
    
    try {
      let endpoint: string;
      if (guruCardMode === '+2') {
        endpoint = `/api/rooms/${roomId}/guru-plus2`;
      } else if (guruCardMode === '+4') {
        endpoint = `/api/rooms/${roomId}/guru-plus4`;
      } else {
        endpoint = `/api/rooms/${roomId}/guru-color`;
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${playerId}`
        },
        body: JSON.stringify({ 
          color: guruSelectedColor,
          sacrificeCardIndex: sacrificeCardIndex
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setGuruCardMode(null);
        setGuruSelectedColor(null);
        setShowGuruCardPicker(false);
      }
    } catch (error) {
      // Silent error handling
    }
  };

  // Cancel guru card flow
  const handleGuruCardCancel = () => {
    setGuruCardMode(null);
    setGuruSelectedColor(null);
    setShowGuruCardPicker(false);
  };

  // Viewer panel drag handlers (mouse)
  const handleViewerPanelDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = viewerPanelRef.current?.getBoundingClientRect();
    if (!rect) return;
    setIsDraggingViewerPanel(true);
    setViewerPanelDragStart({ 
      x: e.clientX, 
      y: e.clientY, 
      panelX: viewerPanelPosition.x === -1 ? rect.left : viewerPanelPosition.x,
      panelY: viewerPanelPosition.y === -1 ? rect.top : viewerPanelPosition.y
    });
  };

  // Viewer panel drag handlers (touch for mobile)
  const handleViewerPanelTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const rect = viewerPanelRef.current?.getBoundingClientRect();
    if (!rect) return;
    setIsDraggingViewerPanel(true);
    setViewerPanelDragStart({ 
      x: touch.clientX, 
      y: touch.clientY, 
      panelX: viewerPanelPosition.x === -1 ? rect.left : viewerPanelPosition.x,
      panelY: viewerPanelPosition.y === -1 ? rect.top : viewerPanelPosition.y
    });
  };

  // Viewer panel resize handlers (mouse)
  const handleViewerPanelResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingViewerPanel(true);
    setViewerPanelResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: viewerPanelSize.width,
      height: viewerPanelSize.height
    });
  };

  // Viewer panel resize handlers (touch for mobile)
  const handleViewerPanelResizeTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    e.stopPropagation();
    const touch = e.touches[0];
    setIsResizingViewerPanel(true);
    setViewerPanelResizeStart({
      x: touch.clientX,
      y: touch.clientY,
      width: viewerPanelSize.width,
      height: viewerPanelSize.height
    });
  };

  // Mouse and touch move/up handlers for viewer panel
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingViewerPanel) {
        const newX = viewerPanelDragStart.panelX + (e.clientX - viewerPanelDragStart.x);
        const newY = viewerPanelDragStart.panelY + (e.clientY - viewerPanelDragStart.y);
        setViewerPanelPosition({ x: newX, y: newY });
      }
      if (isResizingViewerPanel) {
        const newWidth = Math.max(160, viewerPanelResizeStart.width + (e.clientX - viewerPanelResizeStart.x));
        const newHeight = Math.max(120, viewerPanelResizeStart.height + (e.clientY - viewerPanelResizeStart.y));
        setViewerPanelSize({ width: newWidth, height: newHeight });
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (isDraggingViewerPanel) {
        const newX = viewerPanelDragStart.panelX + (touch.clientX - viewerPanelDragStart.x);
        const newY = viewerPanelDragStart.panelY + (touch.clientY - viewerPanelDragStart.y);
        setViewerPanelPosition({ x: newX, y: newY });
      }
      if (isResizingViewerPanel) {
        const newWidth = Math.max(160, viewerPanelResizeStart.width + (touch.clientX - viewerPanelResizeStart.x));
        const newHeight = Math.max(120, viewerPanelResizeStart.height + (touch.clientY - viewerPanelResizeStart.y));
        setViewerPanelSize({ width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      setIsDraggingViewerPanel(false);
      setIsResizingViewerPanel(false);
    };

    const handleTouchEnd = () => {
      setIsDraggingViewerPanel(false);
      setIsResizingViewerPanel(false);
    };

    if (isDraggingViewerPanel || isResizingViewerPanel) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDraggingViewerPanel, isResizingViewerPanel, viewerPanelDragStart, viewerPanelResizeStart]);

  // Host spectator assignment for active games - with robust player state handling
  // Also allows self-assignment during election (for old host to return)
  const handleHostAssignSpectatorToGame = async (spectatorId: string) => {
    const isSelfDuringElection = spectatorId === playerId && hostDisconnectedWarning;
    if ((!isHost && !isSelfDuringElection) || !roomId) return;
    
    try {
      const spectator = players.find((p: any) => p.id === spectatorId);
      if (!spectator) return;
      
      const activeGamePlayers = players.filter((p: any) => 
        !p.isSpectator && 
        !p.hasLeft && 
        p.position !== null && 
        p.position !== undefined
      );
      const takenPositions = activeGamePlayers.map((p: any) => p.position).sort();
      
      let availablePosition = null;
      for (let i = 0; i < 4; i++) {
        if (!takenPositions.includes(i)) {
          availablePosition = i;
          break;
        }
      }
      
      if (availablePosition === null) return;
      
      const endpoint = room.status === 'playing' 
        ? `/api/rooms/${roomId}/assign-spectator-to-game`
        : `/api/rooms/${roomId}/assign-spectator`;
        
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${playerId}`
        },
        body: JSON.stringify({
          spectatorId,
          position: availablePosition
        })
      });
    } catch (error) {
      // Silent error handling
    }
  };

  const handleGuruReplaceCard = async (newCard: any) => {
    if (selectedCardIndex === null || !currentPlayer) return;
    
    try {
      const response = await fetch(`/api/rooms/${roomId}/guru-replace-card`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${playerId}`
        },
        body: JSON.stringify({
          cardIndex: selectedCardIndex,
          newCard: newCard
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setShowGuruReplaceModal(false);
        setSelectedCardIndex(null);
        
        // Force immediate visual update - INSTANT (multiple immediate triggers)
        if (refreshGameState) {
          refreshGameState(); // Immediate refresh
          refreshGameState(); // Double immediate
          setTimeout(() => refreshGameState(), 1);
          setTimeout(() => refreshGameState(), 5);
          setTimeout(() => refreshGameState(), 10);
          setTimeout(() => refreshGameState(), 20);
          setTimeout(() => refreshGameState(), 30);
        }
        
        // Force hand re-render by updating key - INSTANT visual update (multiple immediate)
        setHandRefreshKey(prev => prev + 1);
        setHandRefreshKey(prev => prev + 1); // Double immediate
        setTimeout(() => setHandRefreshKey(prev => prev + 1), 1);
        setTimeout(() => setHandRefreshKey(prev => prev + 1), 5);
        setTimeout(() => setHandRefreshKey(prev => prev + 1), 10);
        setTimeout(() => setHandRefreshKey(prev => prev + 1), 20);
        
        // Force immediate component re-render triggers
        setHandRefreshKey(prev => prev + Math.random()); // Additional random trigger
      }
    } catch (error) {
      // Silent error handling
    }
  };

  // Connection error timeout effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isConnected && (!gameState || !gameState.room)) {
        setShowConnectionError(true);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [isConnected, gameState]);

  // For Viewer Mode room creator, they have no playerId but should still see the game
  // Only redirect if NOT the room creator in viewer mode

  if (!gameState || !gameState.room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-400 via-red-500 to-red-600 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-4">Loading game...</div>
          {!isConnected && (
            <div className="text-white/80 text-sm mb-2">Connecting to server...</div>
          )}
          {showConnectionError && (
            <div className="text-white bg-red-600/80 px-4 py-2 rounded-lg">
              <div className="text-sm mb-2">Connection issue detected</div>
              <button 
                onClick={() => window.location.reload()} 
                className="bg-white text-red-600 px-3 py-1 rounded text-sm hover:bg-gray-100"
              >
                Refresh Page
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const room = gameState.room;
  const players = gameState.players || [];
  // CRITICAL: Sort by position to match server-side order for correct turn tracking
  const gamePlayers = players.filter((p: any) => !p.isSpectator).sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
  
  // Helper function for checking online status - MUST BE DEFINED BEFORE USAGE
  const isPlayerOnline = (player: any) => {
    if (!gameState?.players || !player) return false;
    // Find the player in gameState.players and check their isOnline property
    const playerData = gameState.players.find((p: any) => p.id === player.id);
    return playerData?.isOnline || false;
  };

  const currentPlayer = players.find((p: any) => p.id === playerId);
  const currentGamePlayer = gamePlayers[room.currentPlayerIndex || 0];
  const isMyTurn = currentGamePlayer?.id === playerId;
  const isPaused = room.status === "paused";
  // Room creator (no playerId) has host controls, or actual host player
  const isHost = isRoomCreator || currentPlayer?.id === room?.hostId;
  const topCard = room.discardPile?.[0];
  const isGuruUser = localStorage.getItem("isGuruUser") === "true";
  
  // Check if guru is under a +4 penalty - only +4 can respond to +4, not +2 or color change
  const isUnderWild4Penalty = room.pendingDraw > 0 && topCard?.type === 'wild4';
  
  // Helper function to get avatar emoji
  const getPlayerAvatar = (playerId: string, nickname: string) => {
    const savedAvatar = localStorage.getItem(`avatar_${playerId}`);
    if (savedAvatar === 'male') return '👨';
    if (savedAvatar === 'female') return '👩';
    return '👨'; // Default to male avatar instead of first letter
  };
  
  const spectators = players.filter((p: any) => p.isSpectator);
  const onlineSpectators = spectators.filter((p: any) => isPlayerOnline(p));
  const activePositions = room.activePositions || []; // Positions that were active when game started

  // Helper functions for circular avatar layout
  const getPlayerAtPosition = (position: number) => {
    return gamePlayers.find((player: any) => player.position === position) || null;
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden pt-16 sm:pt-20 md:pt-24">
      {/* Card Animation Overlay */}
      {cardAnimation?.show && (
        <div className="fixed inset-0 pointer-events-none z-[60] flex items-center justify-center">
          <div 
            className={`transition-all duration-300 ease-out ${
              cardAnimation.from === 'player' && cardAnimation.to === 'discard'
                ? 'animate-card-play-up'
                : cardAnimation.from === 'opponent' && cardAnimation.to === 'discard'
                ? 'animate-card-play-down'
                : cardAnimation.from === 'deck' && cardAnimation.to === 'player'
                ? 'animate-card-draw-player'
                : ''
            }`}
          >
            {cardAnimation.from === 'deck' ? (
              <div className="w-16 h-24 bg-gradient-to-br from-red-600 via-red-500 to-red-700 rounded-xl border-3 border-red-800 shadow-2xl flex items-center justify-center">
                <span className="text-white font-bold text-sm transform -rotate-12">UNO</span>
              </div>
            ) : (
              <div className="transform scale-125">
                <GameCard card={cardAnimation.card} size="large" />
              </div>
            )}
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes cardPlayUp {
          0% { transform: translateY(200px) scale(0.8); opacity: 0.5; }
          50% { transform: translateY(0) scale(1.1); opacity: 1; }
          100% { transform: translateY(-50px) scale(1); opacity: 0; }
        }
        @keyframes cardPlayDown {
          0% { transform: translateY(-200px) scale(0.8); opacity: 0.5; }
          50% { transform: translateY(0) scale(1.1); opacity: 1; }
          100% { transform: translateY(50px) scale(1); opacity: 0; }
        }
        @keyframes cardDrawPlayer {
          0% { transform: translateY(-100px) translateX(-100px) scale(0.8); opacity: 0.5; }
          50% { transform: translateY(50px) translateX(0) scale(1.1); opacity: 1; }
          100% { transform: translateY(200px) scale(0.9); opacity: 0; }
        }
        .animate-card-play-up { animation: cardPlayUp 0.4s ease-out forwards; }
        .animate-card-play-down { animation: cardPlayDown 0.4s ease-out forwards; }
        .animate-card-draw-player { animation: cardDrawPlayer 0.35s ease-out forwards; }
      `}</style>
      

      {/* Guru Wild4 Color Picker Modal */}
      {showGuruWild4ColorPicker && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-slate-800 rounded-lg border-2 border-purple-500 p-6 max-w-sm mx-4 shadow-2xl">
            <div className="text-center mb-4">
              <div className="text-2xl font-bold text-purple-400 mb-2">🧙‍♂️ GURU POWER</div>
              <div className="text-white">Play Wild Draw 4 - Choose Color:</div>
              <div className="text-sm text-slate-400 mt-1">Stack +4 onto next player!</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {['red', 'blue', 'green', 'yellow'].map(color => (
                <button
                  key={color}
                  onClick={() => handleGuruWild4Response(color)}
                  className={`p-4 rounded-lg font-bold text-white text-lg shadow-lg transform hover:scale-105 transition-transform ${
                    color === 'red' ? 'bg-red-600 hover:bg-red-500' :
                    color === 'blue' ? 'bg-blue-600 hover:bg-blue-500' :
                    color === 'green' ? 'bg-green-600 hover:bg-green-500' :
                    'bg-yellow-500 hover:bg-yellow-400 text-black'
                  }`}
                  data-testid={`button-guru-color-${color}`}
                >
                  {color.charAt(0).toUpperCase() + color.slice(1)}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowGuruWild4ColorPicker(false)}
              className="mt-4 w-full py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Guru Card Sacrifice Modal - Select which card to remove from hand */}
      {showGuruCardPicker && guruSelectedColor && guruCardMode && currentPlayer?.hand && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-lg border-2 border-purple-500 p-4 max-w-lg w-full shadow-2xl">
            <div className="text-center mb-4">
              <div className="text-2xl font-bold text-purple-400 mb-2">🧙‍♂️ GURU POWER</div>
              <div className="text-white">
                Playing {guruCardMode} with 
                <span className={`ml-1 px-2 py-0.5 rounded text-white font-bold ${
                  guruSelectedColor === 'red' ? 'bg-red-500' :
                  guruSelectedColor === 'blue' ? 'bg-blue-500' :
                  guruSelectedColor === 'green' ? 'bg-green-500' :
                  'bg-yellow-400 text-black'
                }`}>{guruSelectedColor}</span>
              </div>
              <div className="text-sm text-slate-400 mt-2">Select a card to sacrifice:</div>
            </div>
            
            <div className="max-h-48 overflow-x-auto overflow-y-hidden">
              <div className="flex gap-2 min-w-max p-2 justify-center">
                {currentPlayer.hand.map((card: any, index: number) => (
                  <div 
                    key={index}
                    className="cursor-pointer hover:scale-110 hover:-translate-y-2 transition-all"
                    onClick={() => handleGuruCardSacrifice(index)}
                  >
                    <GameCard
                      card={card}
                      size="extra-small"
                      selected={false}
                      disabled={false}
                      interactive={true}
                    />
                  </div>
                ))}
              </div>
            </div>
            
            <button
              onClick={handleGuruCardCancel}
              className="mt-4 w-full py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Host Disconnected Warning with Voting Buttons - Draggable & Positioned Away from Host Slot */}
      {showVotingWindow && (() => {
        // Find the host's position to avoid overlapping their slot
        const hostPlayer = players.find((p: any) => p.isHost || room?.hostId === p.id);
        const hostPosition = hostPlayer?.position ?? 0;
        
        // Position banner away from host slot:
        // Host at 0 (top) -> banner at bottom
        // Host at 1 (right) -> banner at left
        // Host at 2 (bottom) -> banner at top
        // Host at 3 (left) -> banner at right
        const getBannerPosition = () => {
          switch (hostPosition) {
            case 0: return 'bottom-20 left-1/2 -translate-x-1/2'; // Host at top, banner at bottom
            case 1: return 'top-1/2 left-4 -translate-y-1/2'; // Host at right, banner at left
            case 2: return 'top-20 left-1/2 -translate-x-1/2'; // Host at bottom, banner at top
            case 3: return 'top-1/2 right-4 -translate-y-1/2'; // Host at left, banner at right
            default: return 'bottom-20 left-1/2 -translate-x-1/2';
          }
        };
        
        // After voting, show only timer; when countdown reaches 0, hide everything
        if (electionCountdown <= 0) {
          return null; // Timer finished, hide window completely
        }
        
        // If already voted, show only the timer
        if (hasVoted) {
          return (
            <div 
              className={`fixed ${getBannerPosition()} z-50 select-none`}
            >
              <div className="bg-slate-800/95 backdrop-blur-sm rounded-lg border-2 border-green-500 px-4 py-2 shadow-2xl">
                <div className="text-center">
                  <div className="text-xs font-bold text-green-400">✓ Vote Submitted</div>
                  <div className="text-lg font-bold text-yellow-400">
                    {electionCountdown}s
                  </div>
                  <div className="text-[10px] text-slate-400">Waiting for results...</div>
                </div>
              </div>
            </div>
          );
        }
        
        // Not voted yet - show full voting window
        return (
          <div 
            className={`fixed ${getBannerPosition()} z-50 w-72 select-none`}
          >
            <div className="bg-slate-800/95 backdrop-blur-sm rounded-lg border-2 border-orange-500 p-3 shadow-2xl">
              {/* Header with close button and timer */}
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex-1 text-center">
                  <div className="text-xs font-bold text-orange-400">⚠️ Host Left - Vote!</div>
                  <div className="text-sm font-bold text-white">
                    <span className="text-yellow-400">{electionCountdown}s remaining</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowVotingWindow(false)}
                  className="ml-2 text-red-400 hover:text-red-300 font-bold text-lg leading-none"
                  data-testid="button-close-voting-window"
                  aria-label="Close voting window"
                >
                  ✕
                </button>
              </div>
              
              {/* Voting buttons - vertical layout */}
              <div className="space-y-2">
                {/* Player candidates - each on new line (exclude self) */}
                {electionCandidates.filter(c => c.id !== 'NO_HOST' && c.id !== playerId).map((candidate) => (
                  <button
                    key={candidate.id}
                    onClick={(e) => { e.stopPropagation(); handleVoteForHost(candidate.id); }}
                    className="w-full px-2 py-1.5 rounded text-xs font-semibold transition-all flex items-center justify-between bg-blue-600 hover:bg-blue-500 cursor-pointer text-white"
                    data-testid={`button-vote-${candidate.id}`}
                  >
                    <span className="font-bold">{candidate.nickname}</span>
                    <span className="text-[10px]">Click to vote for hoster</span>
                    <span className="text-[10px] font-bold">({electionVotes[candidate.id] || 0})</span>
                  </button>
                ))}
                
                {/* Continue without host button - two lines format */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleVoteForHost('NO_HOST'); }}
                  className="w-full px-2 py-1.5 rounded text-xs font-semibold transition-all border border-dashed flex flex-col items-center justify-center gap-0.5 bg-green-700 border-green-400 hover:bg-green-600 cursor-pointer text-white"
                  data-testid="button-vote-no-host"
                >
                  <span>Continue without host</span>
                  <span className="text-[10px] font-bold">👆 Click Here ({electionVotes['NO_HOST'] || 0})</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Header */}
      <div className="absolute top-2 left-2 right-2 sm:top-4 sm:left-4 sm:right-4 z-10">
        <div className="flex flex-col gap-2">
          {/* Row 1: Buttons */}
          <div className="flex items-center justify-end flex-wrap gap-1 sm:gap-2">
            <Button
              ref={qrButtonRef}
              variant="outline"
              size="sm"
              className="bg-green-600 border-green-500 text-white hover:bg-green-700 p-2 sm:px-3"
              data-testid="button-qr-code"
              onClick={() => {
                if (!showQRCode && qrButtonRef.current) {
                  const rect = qrButtonRef.current.getBoundingClientRect();
                  setQrPosition({ x: rect.left, y: rect.bottom + 8 });
                }
                setShowQRCode(!showQRCode);
              }}
            >
              <QrCode className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline sm:ml-2">QR Code</span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="bg-green-900/50 border-green-700 text-green-300 hover:bg-green-800/50 p-2 sm:px-3"
              data-testid="button-share-game"
              onClick={() => {
                const baseUrl = window.location.origin;
                const joinUrl = `${baseUrl}?room=${room.code}`;
                navigator.clipboard.writeText(joinUrl);
              }}
            >
              <Share2 className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline sm:ml-2">Share</span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="bg-slate-800/90 border-slate-700 text-slate-300 hover:bg-slate-700 p-2 sm:px-3"
              onClick={() => setShowChat(!showChat)}
            >
              <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline sm:ml-2">Chat</span>
            </Button>
            
            <Button
              variant="outline" 
              size="sm"
              className="bg-blue-900/50 border-blue-700 text-blue-300 hover:bg-blue-800/50 px-2 sm:px-3"
              onClick={() => {
                // Direct navigation to home without confirmation
                localStorage.removeItem("currentRoomId");
                localStorage.removeItem("playerId");
                localStorage.removeItem("playerNickname");
                window.location.replace("/");
              }}
            >
              Home
            </Button>
            
            {/* Exit Game button - Takes player to UNO entry page */}
            <Button
              variant="outline"
              size="sm"
              className="bg-purple-900/50 border-purple-600 text-purple-300 hover:bg-purple-800/50 px-2 sm:px-3"
              onClick={() => {
                localStorage.removeItem("currentRoomId");
                localStorage.removeItem("playerId");
                localStorage.removeItem("playerNickname");
                window.location.replace("/uno");
              }}
              data-testid="button-exit-game"
            >
              Exit Game
            </Button>
            
            {/* End Game button - Only show for active players during gameplay */}
            {room?.status === "playing" && currentPlayer && !currentPlayer.isSpectator && !currentPlayer.hasLeft && (
              <Button
                variant="outline"
                size="sm"
                className="bg-orange-900/50 border-orange-600 text-orange-300 hover:bg-orange-800/50 px-2 sm:px-3"
                onClick={() => {
                  if (isHost) {
                    // Host ending game triggers voting for new host
                    if (confirm("End your game? Other players will vote for a new host.")) {
                      hostEndGame();
                    }
                  } else {
                    // Non-host just becomes a viewer
                    if (confirm("End your game and become a viewer? You'll be able to watch but not play.")) {
                      exitGame();
                    }
                  }
                }}
                data-testid="button-end-game"
              >
                End Gameplay
              </Button>
            )}
            
            {/* Exit button - Only show for host when NOT playing (in lobby or finished) */}
            {room?.status !== "playing" && isHost && (
              <Button
                variant="outline"
                size="sm"
                className="bg-red-900/50 border-red-700 text-red-300 hover:bg-red-800/50 px-2 sm:px-3"
                onClick={() => {
                  if (confirm("Exit and close the room for everyone?")) {
                    hostExitRoom();
                  }
                }}
              >
                Exit
              </Button>
            )}
          </div>
          
          {/* Row 2: Room info */}
          <div className="bg-slate-800/90 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-700/50 w-fit">
            <div className="text-xs sm:text-sm font-medium text-white mb-1">
              Room <span className="font-mono text-blue-400">{room.code}</span>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2">
              <Users className="h-3 w-3 text-slate-400 flex-shrink-0" />
              <span className="text-xs text-slate-300">{players.length} players</span>
            </div>
          </div>
        </div>
      </div>







      {/* === UNO TABLE (Centered + Responsive) === */}
      <section className="relative w-full h-full flex items-center justify-center bg-transparent p-4 pb-32">
        {/* Responsive square board centered in viewport - offset 3cm (~113px) downward */}
        <div
          className="relative aspect-square w-[min(80vmin,450px)]"
          style={{
            marginTop: '113px',
            // Board ring radius - Attached to circle edge with proper spacing (center radius + avatar radius + gap)
            ['--r' as any]: 'calc(var(--center) / 2 + var(--avatar) / 2 + 8px)',
            // Avatar diameter (clamped for phone → desktop)
            ['--avatar' as any]: 'clamp(60px, 11vmin, 76px)',
            // Center play area size (the round table behind top card)
            ['--center' as any]: 'clamp(90px, 16vmin, 130px)',
            // Corner padding for draw pile / direction
            ['--gap' as any]: 'clamp(8px, 2vmin, 16px)',
          }}
        >
          {/* === CENTER AREA === */}
          <div className="absolute inset-0 grid place-items-center z-10">
            <div className="relative">
              {/* Circular background for center area */}
              <div
                className="absolute -z-10 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-slate-600 shadow-2xl bg-gradient-to-br from-slate-700 to-slate-800"
                style={{ width: 'var(--center)', height: 'var(--center)' }}
              />
              <div className="flex flex-col items-center space-y-2">
                {topCard ? (
                  <div className="flex flex-col items-center">
                    <GameCard card={topCard} size="small" interactive={false} onClick={() => {}} />
                    {room?.currentColor && (topCard.type === 'wild' || topCard.type === 'wild4') && (
                      <div className="flex flex-col items-center mt-2">
                        <div
                          className={`w-6 h-6 rounded-full border-2 border-white ${
                            room.currentColor === 'red'
                              ? 'bg-red-500'
                              : room.currentColor === 'yellow'
                              ? 'bg-yellow-500'
                              : room.currentColor === 'blue'
                              ? 'bg-blue-500'
                              : room.currentColor === 'green'
                              ? 'bg-green-500'
                              : 'bg-gray-500'
                          }`}
                        />
                        <span className="text-xs text-white font-bold mt-1">
                          Active: {room.currentColor}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-16 h-24 bg-gradient-to-br from-red-500 to-red-700 rounded-lg border-2 border-red-300 shadow-xl flex items-center justify-center">
                    <div className="text-white font-bold text-lg">UNO</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* VIEWER MODE: Turn Indicator - Above 12 o'clock position */}
          {room.status === "playing" && currentGamePlayer && (
            <div 
              className="absolute z-30 left-1/2 -translate-x-1/2"
              style={{ top: 'calc(50% - var(--r) - 70px)' }}
            >
              <div className={`px-3 py-1.5 rounded-full shadow-lg border-2 ${
                room.pendingDraw > 0 
                  ? 'bg-red-600 border-red-400 animate-pulse' 
                  : 'bg-yellow-500 border-yellow-300'
              }`}>
                <div className="text-white font-bold text-sm text-center whitespace-nowrap">
                  {room.pendingDraw > 0 ? (
                    <span>⚠️ {currentGamePlayer.nickname} draws {room.pendingDraw} ⚠️</span>
                  ) : (
                    <span>⭐ {currentGamePlayer.nickname}'s turn ⭐</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* === 4 AVATAR POSITIONS AROUND THE CIRCLE === */}
          {[0, 1, 2, 3].map((position) => {
            const player = getPlayerAtPosition(position);
            const isOnline = player ? isPlayerOnline(player) : false;
            const isPlayerTurn = currentGamePlayer?.id === player?.id;

            // Absolute positions using a single radius var --r - Equal distance for all avatars
            const posClass =
              position === 0
                ? 'top-[calc(50%-var(--r))] left-1/2 -translate-x-1/2 -translate-y-1/2'
                : position === 1
                ? 'left-[calc(50%+var(--r))] top-1/2 -translate-x-1/2 -translate-y-1/2'
                : position === 2
                ? 'top-[calc(50%+var(--r))] left-1/2 -translate-x-1/2 -translate-y-1/2'
                : 'left-[calc(50%-var(--r))] top-1/2 -translate-x-1/2 -translate-y-1/2';

            return (
              <div key={position} className={`absolute ${posClass} pointer-events-auto z-20`}>
                <div className="relative">
                  {player ? (
                    <div className="relative">
                      {/* Avatar Circle */}
                      <button
                        className={`rounded-full flex items-center justify-center text-white font-bold shadow-lg border-4 bg-gradient-to-br from-uno-blue to-uno-purple hover:scale-[1.04] transition-transform ${
                          isPlayerTurn ? 'border-green-400 ring-2 ring-green-400/50' : 'border-white/20'
                        }`}
                        style={{ width: 'var(--avatar)', height: 'var(--avatar)' }}
                        onClick={() => {
                          if (player.id === playerId || isHost) {
                            setSelectedAvatarPlayerId(player.id);
                            setShowAvatarSelector(true);
                          }
                        }}
                        aria-label={`${player.nickname} avatar`}
                        title={player.nickname}
                      >
                        <div className="text-2xl">{getPlayerAvatar(player.id, player.nickname)}</div>
                      </button>

                      {/* Nickname pill – position varies per slot */}
                      <div
                        className={`absolute text-xs font-semibold text-white bg-black/70 px-2 py-1 rounded-full whitespace-nowrap ${
                          position === 0 ? 'left-full top-1/2 -translate-y-1/2 ml-2'
                          : position === 1 ? 'top-full left-1/2 -translate-x-1/2 mt-2'
                          : position === 2 ? 'right-full top-1/2 -translate-y-1/2 mr-1'
                          : 'left-1/2 -translate-x-1/2 -top-8'
                        }`}
                      >
                        {player.nickname}
                      </div>

                      {/* Online badge */}
                      <div
                        className={`absolute -top-1 -right-1 w-6 h-6 rounded-full border-2 border-white ${
                          isOnline ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />

                      {/* Host crown */}
                      {player.id === room?.hostId && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">👑</div>
                      )}

                      {/* Floating chat/emoji message bubble */}
                      {avatarMessages?.filter((m: any) => m.playerId === player.id).slice(-1).map((msg: any) => (
                        <div
                          key={msg.id}
                          className={`absolute z-50 animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                            position === 3 
                              ? 'right-full top-1/2 -translate-y-1/2 mr-4'
                              : 'left-full top-1/2 -translate-y-1/2 ml-4'
                          }`}
                        >
                          <div className="bg-white/95 dark:bg-gray-800/95 rounded-xl px-3 py-2 shadow-lg border border-gray-200 dark:border-gray-600 max-w-[150px]">
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium truncate">
                              {msg.playerNickname}
                            </div>
                            <div className={`${msg.contentType === 'emoji' ? 'text-2xl text-center' : 'text-sm text-gray-800 dark:text-white break-words'}`}>
                              {msg.content}
                            </div>
                          </div>
                          {/* Speech bubble pointer */}
                          <div className={`absolute w-0 h-0 ${
                            position === 3 
                              ? 'left-full top-1/2 -translate-y-1/2 border-t-8 border-b-8 border-l-8 border-t-transparent border-b-transparent border-l-white/95 dark:border-l-gray-800/95'
                              : 'right-full top-1/2 -translate-y-1/2 border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent border-r-white/95 dark:border-r-gray-800/95'
                          }`} />
                        </div>
                      ))}

                      {/* Finish badge */}
                      {player.finishPosition && (
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-xs px-2 py-1 rounded-full font-bold shadow-lg">
                          {player.finishPosition === 1
                            ? '1ST'
                            : player.finishPosition === 2
                            ? '2ND'
                            : player.finishPosition === 3
                            ? '3RD'
                            : `${player.finishPosition}TH`}
                        </div>
                      )}

                      {/* Face-down card fan - same design as Stream Mode */}
                      {!player.finishPosition && (() => {
                        const cardCount = player.hand?.length || 0;
                        const displayCardCount = Math.min(cardCount, 10);
                        
                        const getCardFanStyle = (pos: number, cardIndex: number, totalCards: number) => {
                          const fanSpread = totalCards > 1 ? 8 : 0;
                          const centerOffset = (totalCards - 1) / 2;
                          const rotation = (cardIndex - centerOffset) * fanSpread;
                          
                          if (pos === 0) {
                            return { transform: `rotate(${rotation}deg) translateY(-2px)`, marginLeft: cardIndex > 0 ? '-8px' : '0' };
                          } else if (pos === 1) {
                            return { transform: `rotate(${rotation + 90}deg)`, marginTop: cardIndex > 0 ? '-8px' : '0' };
                          } else if (pos === 2) {
                            return { transform: `rotate(${rotation + 180}deg) translateY(2px)`, marginLeft: cardIndex > 0 ? '-8px' : '0' };
                          } else {
                            return { transform: `rotate(${rotation - 90}deg)`, marginTop: cardIndex > 0 ? '-8px' : '0' };
                          }
                        };
                        
                        const getCardFanPosition = (pos: number) => {
                          if (pos === 0) return 'absolute -top-16 left-1/2 -translate-x-1/2 flex flex-row';
                          if (pos === 1) return 'absolute top-1/2 -right-16 -translate-y-1/2 flex flex-col';
                          if (pos === 2) return 'absolute -bottom-16 left-1/2 -translate-x-1/2 flex flex-row';
                          return 'absolute top-1/2 -left-16 -translate-y-1/2 flex flex-col';
                        };
                        
                        return (
                          <div className={getCardFanPosition(position)}>
                            {Array.from({ length: displayCardCount }).map((_, i) => (
                              <div
                                key={i}
                                className="w-7 h-10 md:w-10 md:h-14 bg-gradient-to-br from-red-600 to-red-800 rounded-sm border border-red-400 shadow-md"
                                style={{
                                  ...getCardFanStyle(position, i, displayCardCount),
                                  zIndex: i,
                                }}
                              >
                                <div className="w-full h-full flex items-center justify-center">
                                  <span className="text-yellow-300 text-[6px] md:text-[8px] font-bold">UNO</span>
                                </div>
                              </div>
                            ))}
                            {cardCount > 10 && (
                              <div className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[7px] px-1 rounded-full font-bold z-20">
                                +{cardCount - 10}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Controls */}
                      {player.id === playerId && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowNicknameEditor(true);
                          }}
                          className={`absolute w-5 h-5 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-lg border border-white pointer-events-auto z-30 cursor-pointer ${
                            position === 0 ? '-top-7 left-1/2 -translate-x-1/2'
                            : position === 1 ? 'top-1/2 -right-7 -translate-y-1/2'
                            : position === 2 ? '-bottom-7 left-1/2 -translate-x-1/2'
                            : '-left-7 top-1/2 -translate-y-1/2'
                          }`}
                          title="Edit nickname"
                        >
                          E
                        </button>
                      )}

                      {isHost && player.id !== playerId && (
                        <div className={`absolute flex gap-1 pointer-events-auto z-30 ${
                          position === 0 ? '-top-7 left-1/2 -translate-x-1/2'
                          : position === 1 ? 'top-1/2 -right-7 -translate-y-1/2 flex-col'
                          : position === 2 ? '-bottom-7 left-1/2 -translate-x-1/2'
                          : '-left-7 top-1/2 -translate-y-1/2 flex-col'
                        }`}>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              kickPlayer(player.id);
                            }}
                            className="w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-lg border border-white cursor-pointer"
                            title={isOnline ? 'Remove player' : 'Remove offline player'}
                          >
                            K
                          </button>
                          
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              assignHost(player.id);
                            }}
                            className="w-5 h-5 bg-yellow-500 hover:bg-yellow-600 text-black rounded-full flex items-center justify-center text-[10px] font-bold shadow-lg border border-white cursor-pointer"
                            title="Make this player the host"
                            data-testid={`button-make-host-${player.id}`}
                          >
                            👑
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Empty / joinable slot
                    (() => {
                      // Check if this is the host's slot during election countdown
                      const isHostSlot = gameState?.hostElectionActive && 
                        gameState?.disconnectedHostPosition === position && 
                        hostCanReturn;
                      const isCurrentPlayerHost = playerId === gameState?.disconnectedHostId;
                      const canHostReturn = isHostSlot && isCurrentPlayerHost;
                      
                      return (
                        <div
                          className={`rounded-full flex items-center justify-center border-4 ${
                            canHostReturn 
                              ? 'border-yellow-400 cursor-pointer hover:bg-yellow-500/40 transition-colors animate-pulse'
                              : currentPlayer?.isSpectator && isPaused && activePositions.includes(position)
                                ? 'cursor-pointer hover:bg-gray-500/40 transition-colors border-white/20'
                                : 'border-white/20'
                          } bg-gray-500/30`}
                          style={{ width: 'var(--avatar)', height: 'var(--avatar)' }}
                          onClick={() => {
                            // Host returning to their slot
                            if (canHostReturn) {
                              replacePlayer(position);
                              return;
                            }
                            if (currentPlayer?.isSpectator && isPaused && activePositions.includes(position)) {
                              replacePlayer(position);
                            } else if (!currentPlayer) {
                              const roomCode = room?.code;
                              if (roomCode) window.location.href = `/?room=${roomCode}&position=${position}`;
                            }
                          }}
                        >
                          <div className="text-center">
                            {canHostReturn ? (
                              <>
                                <div className="w-8 h-8 rounded-full bg-yellow-400 mx-auto flex items-center justify-center">
                                  <span className="text-black text-sm font-bold">👑</span>
                                </div>
                                <div className="text-xs text-yellow-400 mt-1 font-bold">Return</div>
                              </>
                            ) : (currentPlayer?.isSpectator && isPaused && activePositions.includes(position)) ||
                            (!currentPlayer && activePositions.includes(position)) ? (
                              <>
                                <div className="w-8 h-8 rounded-full bg-blue-400 mx-auto flex items-center justify-center">
                                  <span className="text-white text-sm font-bold">+</span>
                                </div>
                                <div className="text-xs text-blue-400 mt-1">
                                  {currentPlayer?.isSpectator ? 'Join' : 'Click to Join'}
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="w-8 h-8 rounded-full bg-gray-400 mx-auto" />
                                <div className="text-xs text-gray-400 mt-1">Closed</div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              </div>
            );
          })}

          {/* === DIRECTION INDICATOR (top-left of board) === */}
          {room?.direction && room?.status === 'playing' && (
            <div className="absolute z-20 top-2 left-2">
              <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full border-2 border-yellow-300 shadow-lg w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex items-center justify-center animate-pulse">
                <div className="text-white text-[9px] font-bold text-center leading-tight">
                  {room.direction === 'clockwise' ? (
                    <div className="flex flex-col items-center">
                      <span className="text-sm">↻</span>
                      <span>GAME</span>
                      <span>DIR</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <span className="text-sm">↺</span>
                      <span>GAME</span>
                      <span>DIR</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* === DRAW PILE (left of 6 o'clock avatar, under 9 o'clock avatar) === */}
          <div className="absolute z-20" style={{ left: '21%', bottom: '22%' }}>
            <div className="relative cursor-pointer group" onClick={drawCard}>
              <div className="bg-gradient-to-br from-amber-600 to-orange-700 rounded-lg border-2 border-amber-500 shadow-xl group-hover:shadow-amber-500/50 transition-all w-10 h-14 sm:w-11 sm:h-15 md:w-12 md:h-16"></div>
              <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg border-2 border-amber-400 shadow-xl absolute -top-0.5 -left-0.5 w-10 h-14 sm:w-11 sm:h-15 md:w-12 md:h-16"></div>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-white font-bold text-xs drop-shadow-md">Draw</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Player Hand Area - Fixed at bottom with no space, horizontal cards for iPhone */}
      {currentPlayer && !currentPlayer.isSpectator && (
        <div className="fixed bottom-0 left-0 right-0 z-30">
          {/* Horizontal layout optimized for iPhone portrait - reserve space for R button */}
          <div className="bg-gradient-to-t from-slate-800/95 to-slate-800/90 backdrop-blur-md px-2 pb-10" style={{
            height: 'max(20vh, 120px)'
          }}>
            
            {/* Player Info Header - Horizontal layout */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm border-2 cursor-pointer hover:scale-105 transition-all ${
                    isMyTurn ? 'bg-gradient-to-br from-green-400 to-green-600 border-green-300' : 'bg-gradient-to-br from-blue-400 to-blue-600 border-blue-300'
                  }`}
                  onClick={() => {
                    setSelectedAvatarPlayerId(currentPlayer.id);
                    setShowAvatarSelector(true);
                  }}
                >
                  {getPlayerAvatar(currentPlayer.id, currentPlayer.nickname)}
                </div>
                <div className="ml-2">
                  <div className={`font-semibold text-white text-sm ${isMyTurn ? 'text-green-400' : ''}`}>
                    {currentPlayer.nickname}
                  </div>
                  <div className="text-xs text-slate-400">
                    {currentPlayer.hand?.length || 0} cards
                  </div>
                </div>
                {isMyTurn && (
                  <div className="ml-3">
                    <div className="bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs font-bold border border-green-500/30 animate-pulse shadow-lg shadow-green-500/50">
                      ⭐ YOUR TURN ⭐
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* UNO Button - Positioned at top right for horizontal layout */}
            <div className="absolute top-2 right-2">
              <Button
                variant="outline"
                size="sm"
                className="font-bold border-2 transition-all bg-red-600 border-red-500 text-white hover:bg-red-700 animate-pulse text-xs px-2 py-1"
                onClick={handleUnoCall}
              >
                🔥 UNO! 🔥
              </Button>
            </div>

            {/* Guru Power Buttons - Centered above player deck, only for guru users when it's their turn */}
            {isGuruUser && isMyTurn && (
              <div className="flex justify-center mb-2">
                {guruCardMode === null ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => !isUnderWild4Penalty && handleGuruStartCard('+2')}
                      disabled={isUnderWild4Penalty}
                      className={`px-3 py-1.5 text-white font-bold text-sm rounded-lg border-2 border-white/50 shadow-lg transition-transform ${
                        isUnderWild4Penalty 
                          ? 'bg-gray-500 opacity-50 cursor-not-allowed' 
                          : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 hover:scale-105'
                      }`}
                      data-testid="button-guru-plus2"
                    >
                      🧙‍♂️ +2
                    </button>
                    <button
                      onClick={() => handleGuruStartCard('+4')}
                      className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-sm rounded-lg border-2 border-white/50 shadow-lg hover:scale-105 transition-transform"
                      data-testid="button-guru-plus4"
                    >
                      🧙‍♂️ +4
                    </button>
                    <button
                      onClick={() => !isUnderWild4Penalty && handleGuruStartCard('color' as any)}
                      disabled={isUnderWild4Penalty}
                      className={`px-3 py-1.5 text-white font-bold text-sm rounded-lg border-2 border-white/50 shadow-lg transition-transform ${
                        isUnderWild4Penalty 
                          ? 'bg-gray-500 opacity-50 cursor-not-allowed' 
                          : 'bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 hover:scale-105'
                      }`}
                      data-testid="button-guru-color"
                    >
                      🎨 Color
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-800/95 rounded-lg p-3 border-2 border-purple-500/50 shadow-xl">
                    <div className="text-white text-sm font-bold mb-2 text-center">
                      {guruCardMode === 'color' ? 'Choose Color:' : `${guruCardMode} - Choose Color:`}
                    </div>
                    <div className="flex gap-2 justify-center mb-2">
                      {['red', 'blue', 'green', 'yellow'].map(color => (
                        <button
                          key={color}
                          onClick={() => handleGuruColorSelect(color)}
                          className={`w-10 h-10 rounded-lg shadow-lg border-2 border-white/50 hover:scale-110 transition-transform ${
                            color === 'red' ? 'bg-red-500 hover:bg-red-400' :
                            color === 'blue' ? 'bg-blue-500 hover:bg-blue-400' :
                            color === 'green' ? 'bg-green-500 hover:bg-green-400' :
                            'bg-yellow-400 hover:bg-yellow-300'
                          }`}
                          data-testid={`button-guru-color-${color}`}
                        />
                      ))}
                    </div>
                    <button
                      onClick={handleGuruCardCancel}
                      className="w-full py-1 text-sm text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Player Cards - Horizontal layout centered at bottom */}
            <div className="overflow-x-auto overflow-y-visible px-1">
              {currentPlayer.hand && currentPlayer.hand.length > 0 ? (
                <div key={`hand-${handRefreshKey}-${gameState?.cardReplacementTrigger || 0}`} className="flex space-x-1 min-w-max h-full items-center py-1 justify-center">
                  {currentPlayer.hand.map((card: any, index: number) => (
                    <div 
                      key={index} 
                      className={`transition-all duration-200 flex-shrink-0 ${
                        isMyTurn ? 'hover:scale-105 hover:-translate-y-2 cursor-pointer' : 'opacity-60'
                      }`}
                      onClick={() => {
                        if (!isMyTurn) return;
                        handlePlayCard(index);
                      }}
                    >
                      <GameCard
                        card={card}
                        size="extra-small"
                        selected={false}
                        disabled={!isMyTurn}
                        isGuruUser={isGuruUser}
                        cardIndex={index}
                        onGuruReplace={isGuruUser ? () => {
                          setSelectedCardIndex(index);
                          setShowGuruReplaceModal(true);
                        } : undefined}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-slate-400 text-lg">No cards in hand</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Viewers Panel - Draggable, Resizable, Hideable */}
      {/* Protruding tab on right edge when hidden - positioned opposite slot 1 (top-right) */}
      {!showViewers && (
        <button
          onClick={() => setShowViewers(true)}
          className="fixed z-40 bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center gap-1 transition-all"
          style={{ 
            top: '4.5rem', 
            right: 0,
            padding: '8px 6px 8px 10px',
            borderTopLeftRadius: '12px',
            borderBottomLeftRadius: '12px'
          }}
          data-testid="button-show-viewers"
          title="Show Viewers Panel"
        >
          <span className="text-sm font-bold">👥 {players.filter((p: any) => p.isSpectator && isPlayerOnline(p)).length}</span>
        </button>
      )}
      
      {showViewers && (
        <div 
          ref={viewerPanelRef}
          className="fixed z-30 bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-gray-200 flex flex-col select-none"
          style={{
            top: viewerPanelPosition.y === -1 ? '4rem' : viewerPanelPosition.y,
            right: viewerPanelPosition.x === -1 ? '0.5rem' : 'auto',
            left: viewerPanelPosition.x === -1 ? 'auto' : viewerPanelPosition.x,
            width: viewerPanelSize.width,
            height: viewerPanelSize.height,
            cursor: isDraggingViewerPanel ? 'grabbing' : 'auto'
          }}
          data-testid="panel-viewers"
        >
          {/* Drag handle / Header */}
          <div 
            className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-xl cursor-grab active:cursor-grabbing touch-none"
            onMouseDown={handleViewerPanelDragStart}
            onTouchStart={handleViewerPanelTouchStart}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">
                👥 Viewers ({players.filter((p: any) => p.isSpectator && isPlayerOnline(p)).length})
              </span>
            </div>
            <div className="flex items-center gap-1">
              {/* Minimize button */}
              <button
                onClick={() => setShowViewers(false)}
                className="p-1 hover:bg-white/20 rounded transition-colors"
                title="Hide Panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {players.filter((p: any) => p.isSpectator && isPlayerOnline(p)).length > 0 ? (
              players.filter((p: any) => p.isSpectator && isPlayerOnline(p)).map((spectator: any, index: number, arr: any[]) => {
                const isOwnNameDuringElection = spectator.id === playerId && hostDisconnectedWarning;
                const canClick = isHost || isOwnNameDuringElection;
                
                return (
                  <div key={spectator.id}>
                    <div 
                      className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                        canClick ? 'hover:bg-blue-50 cursor-pointer' : ''
                      }`}
                      onClick={canClick ? () => handleHostAssignSpectatorToGame(spectator.id) : undefined}
                      title={isOwnNameDuringElection ? "Click to rejoin the game" : isHost ? "Click to assign to next available slot" : ""}
                    >
                      <span className="text-sm text-gray-700 font-medium flex-1">{spectator.nickname}</span>
                      {spectator.id === playerId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowNicknameEditor(true);
                          }}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                          title="Edit your nickname"
                        >
                          <Pencil className="w-3 h-3 text-gray-500" />
                        </button>
                      )}
                      {isHost && (
                        <div className="text-blue-600 text-sm font-bold bg-blue-100 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">+</div>
                      )}
                    </div>
                    {index < arr.length - 1 && <hr className="border-gray-200 mx-1 my-1" />}
                  </div>
                );
              })
            ) : (
              <div className="flex items-center justify-center h-16 text-gray-400 text-sm">
                No viewers watching
              </div>
            )}
          </div>
          
          {/* Resize Handle */}
          <div 
            className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize touch-none"
            onMouseDown={handleViewerPanelResizeStart}
            onTouchStart={handleViewerPanelResizeTouchStart}
            style={{
              background: 'linear-gradient(135deg, transparent 50%, rgba(100,100,100,0.4) 50%)',
              borderBottomRightRadius: '0.75rem'
            }}
            title="Drag to resize"
          />
        </div>
      )}

      {/* Chat Panel */}
      {showChat && (
        <ChatPanel
          messages={gameState?.messages || []}
          players={players}
          onSendMessage={sendChatMessage}
          onSendEmoji={sendEmoji}
          onClose={() => setShowChat(false)}
        />
      )}

      {/* Color Picker Modal - Only show for active players, never for viewers */}
      {showColorPicker && playerId && (
        <ColorPickerModal
          onChooseColor={handleColorChoice}
          onClose={() => setShowColorPicker(false)}
        />
      )}


      


      {/* Spectator View */}
      {currentPlayer && currentPlayer.isSpectator && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-slate-800/95 to-slate-800/90 backdrop-blur-md">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-center">
              <div className="bg-slate-700/80 px-6 py-3 rounded-lg border border-slate-600">
                <div className="text-center">
                  <div className="text-slate-300 text-sm mb-2">You are watching as a spectator</div>
                  <div className="flex items-center justify-center space-x-4">
                    <div className="text-xs text-slate-400">
                      Current turn: <span className="text-green-400 font-medium">{currentGamePlayer?.nickname || 'Unknown'}</span>
                    </div>
                    {isPaused && (
                      <div className="text-xs text-orange-400 font-medium">Game Paused - Click empty slots to join!</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Host Continue Game Prompt - Only show to host */}
      {isPaused && currentPlayer?.isHost && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-40">
          <div className="bg-orange-600/90 backdrop-blur-sm px-6 py-3 rounded-lg border border-orange-500 shadow-lg">
            <div className="text-center">
              <div className="text-white text-sm font-medium mb-2">Game is paused</div>
              <div className="text-orange-200 text-xs mb-2">A player disconnected</div>
              <Button
                onClick={() => continueGame()}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm"
              >
                Continue Game
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Non-host pause message - subtle banner at top, not a popup */}
      {isPaused && !currentPlayer?.isHost && (
        <div className="fixed top-28 left-1/2 transform -translate-x-1/2 z-30">
          <div className="bg-slate-700/80 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-600 text-center">
            <div className="text-slate-300 text-xs">⏸️ Waiting for host to continue...</div>
          </div>
        </div>
      )}

      {/* False UNO Penalty Message */}
      {gameState?.falseUnoMessage && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          <div className="bg-gradient-to-r from-red-600 via-red-500 to-orange-500 text-white text-xl sm:text-2xl md:text-3xl font-bold px-6 py-4 rounded-2xl shadow-2xl border-4 border-white animate-bounce">
            <div className="flex items-center space-x-3">
              <span className="animate-pulse">❌</span>
              <span>{gameState.falseUnoMessage}</span>
              <span className="animate-pulse">❌</span>
            </div>
          </div>
        </div>
      )}

      {/* Penalty Animation Overlay - Don't show during game end */}
      {gameState?.penaltyAnimation?.isActive && !gameState?.gameEndData && !showWinnerModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-slate-800 rounded-lg border border-slate-600 p-6 max-w-md mx-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400 mb-2 animate-pulse">⚠️ Penalty Cards</div>
              <div className="text-slate-300 mb-4 text-lg">
                {gameState.penaltyAnimation.drawnCards === 0 ? (
                  <>
                    <span className="font-semibold text-white">{gameState.penaltyAnimation.player}</span> must draw{' '}
                    <span className="text-red-400 font-bold text-2xl animate-pulse">{gameState.penaltyAnimation.totalCards}</span> cards!
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-white">{gameState.penaltyAnimation.player}</span> is drawing penalty cards...
                  </>
                )}
              </div>
              
              {/* Progress indicator */}
              <div className="bg-slate-700 rounded-full h-6 mb-4 relative overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-red-500 to-red-400 h-6 rounded-full transition-all duration-1000 ease-out relative"
                  style={{
                    width: `${(gameState.penaltyAnimation.drawnCards / gameState.penaltyAnimation.totalCards) * 100}%`
                  }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full"></div>
                </div>
              </div>
              
              <div className="text-lg font-medium text-white">
                {gameState.penaltyAnimation.drawnCards} / {gameState.penaltyAnimation.totalCards} cards
              </div>
              
              {/* Animated card stack */}
              <div className="flex justify-center mt-4">
                <div className="relative">
                  {Array.from({ length: gameState.penaltyAnimation.totalCards }, (_, i) => (
                    <div
                      key={i}
                      className={`absolute w-12 h-16 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg border border-slate-500 transition-all duration-300 ${
                        i < gameState.penaltyAnimation.drawnCards 
                          ? 'opacity-100 transform translate-y-0 scale-100' 
                          : 'opacity-30 transform translate-y-4 scale-95'
                      }`}
                      style={{
                        left: `${i * 4}px`,
                        zIndex: gameState.penaltyAnimation.totalCards - i,
                        animationDelay: `${i * 100}ms`
                      }}
                    >
                      {i < gameState.penaltyAnimation.drawnCards && (
                        <div className="w-full h-full bg-gradient-to-br from-red-400 to-red-600 rounded-lg flex items-center justify-center text-white text-xs font-bold animate-bounce">
                          <div className="animate-ping absolute w-2 h-2 bg-white rounded-full"></div>
                          ✓
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}




      {/* Winner Modal */}
      <WinnerModal
        isOpen={showWinnerModal}
        players={winnerData?.finalRankings || []}
        isSpectator={currentPlayer?.isSpectator || false}
        onClose={handleEndGameClose}
      />



      {/* Nickname Editor Modal */}
      {currentPlayer && (
        <NicknameEditor
          currentNickname={currentPlayer.nickname}
          playerId={playerId!}
          isOpen={showNicknameEditor}
          onClose={() => setShowNicknameEditor(false)}
          onNicknameChanged={() => {}}
        />
      )}

      {/* Guru Card Replace Modal */}
      {showGuruReplaceModal && (
        <GuruCardReplaceModal
          isOpen={showGuruReplaceModal}
          currentCard={selectedCardIndex !== null && selectedCardIndex >= 0 ? currentPlayer?.hand?.[selectedCardIndex] : undefined}
          availableCards={room?.drawPile || []}
          onClose={() => {
            setShowGuruReplaceModal(false);
            setSelectedCardIndex(null);
          }}
          onReplaceCard={handleGuruReplaceCard}
        />
      )}

      {/* Avatar Selection Modal */}
      {showAvatarSelector && selectedAvatarPlayerId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold mb-4 text-center">Choose Avatar</h3>
            <div className="flex justify-center space-x-6">
              <button
                onClick={() => {
                  localStorage.setItem(`avatar_${selectedAvatarPlayerId}`, 'male');
                  // Broadcast avatar change to all players via WebSocket
                  sendAvatarChange(selectedAvatarPlayerId!, 'male');
                  setShowAvatarSelector(false);
                  setSelectedAvatarPlayerId(null);
                }}
                className="text-6xl hover:scale-110 transition-transform p-4 rounded-lg hover:bg-gray-100"
              >
                👨
              </button>
              <button
                onClick={() => {
                  localStorage.setItem(`avatar_${selectedAvatarPlayerId}`, 'female');
                  // Broadcast avatar change to all players via WebSocket
                  sendAvatarChange(selectedAvatarPlayerId!, 'female');
                  setShowAvatarSelector(false);
                  setSelectedAvatarPlayerId(null);
                }}
                className="text-6xl hover:scale-110 transition-transform p-4 rounded-lg hover:bg-gray-100"
              >
                👩
              </button>
            </div>
            <button
              onClick={() => {
                setShowAvatarSelector(false);
                setSelectedAvatarPlayerId(null);
              }}
              className="mt-4 w-full px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* UNO Penalty Animation */}
      {(gameState?.unoPenaltyAnimation?.show || unoPenaltyAnimation?.show) && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-red-500 to-red-700 text-white p-8 rounded-lg shadow-2xl animate-bounce max-w-lg mx-4 text-center">
            <div className="text-6xl mb-4">😱</div>
            <h2 className="text-2xl font-bold mb-2">UNO PENALTY!</h2>
            <p className="text-xl mb-4">
              {gameState?.unoPenaltyAnimation?.playerName || unoPenaltyAnimation?.playerName} forgot to call UNO!
            </p>
            <p className="text-lg opacity-90">
              Must draw 2 penalty cards for not calling UNO before playing second-to-last card
            </p>
          </div>
        </div>
      )}

      {/* QR Code Panel */}
      {showQRCode && qrCodeData && (
        <div
          ref={qrPanelRef}
          className="fixed z-40 select-none"
          style={{ left: qrPosition.x, top: qrPosition.y, cursor: isDraggingQR ? 'grabbing' : 'default' }}
        >
          <Card className="w-64 shadow-2xl border-2 border-green-500/50 bg-white/98 backdrop-blur-sm animate-in slide-in-from-top-2 duration-200">
            <CardContent className="p-4">
              <div
                className="flex items-center justify-between mb-2 cursor-grab active:cursor-grabbing bg-green-600 rounded-lg px-3 py-2"
                onMouseDown={handleQRDragStart}
                onTouchStart={handleQRDragStart}
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-white/70" />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white">Room {room?.code}</span>
                    <span className="text-xs font-bold text-white">QrFun.net</span>
                  </div>
                </div>
                <button onClick={() => setShowQRCode(false)} className="text-white/70 hover:text-white p-1">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Button
                onClick={() => { if (room?.code) navigator.clipboard.writeText(room.code); }}
                variant="outline"
                size="sm"
                className="w-full mb-3 bg-green-600 text-white hover:bg-green-700"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy Code
              </Button>
              <div className="bg-white p-3 rounded-lg shadow-inner border border-gray-100">
                <img src={qrCodeData} alt={`QR Code for room ${room?.code}`} className="w-full h-auto" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}