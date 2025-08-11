# UNO Game Application

## Overview

This is a full-stack multiplayer UNO card game built with React, Express, and WebSocket for real-time gameplay. The application supports up to 4 players per room with classic UNO rules including all action cards (Skip, Reverse, Draw Two, Wild, Draw Four). Players can create rooms using 5-digit codes in format AABCC (e.g., 22033, 44055, 55066), join via room codes, QR code scanning, or QR code photo upload, and play in real-time with synchronized game state. Spectators can watch ongoing games and interact via animated emojis. The app features seamless QR code integration with direct room joining through nickname popup dialogs.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### UNO Button Stealth Mode & Game End Modal Fixes (Latest - Aug 11, 2025)
- **CRITICAL FIX**: UNO button now appears identical before and after calling (no visual reminder for players)
- **Stealth Mode**: Button always shows "🔥 UNO! 🔥" with same red color and pulsing animation 
- **Fixed in GameFixed.tsx**: Removed conditional styling that changed button based on hand size or UNO status
- **Penalty Strategy**: UNO call works anytime but only prevents penalty when playing second-to-last card
- **No Player Hints**: Removed green color change and "UNO CALLED" text that reminded players they called UNO
- **Enhanced Debugging**: Added comprehensive logging for game end modal detection and display
- **Voice Synthesis**: Voice says "UNO!" when any player calls UNO (browser speech synthesis)
- **Server Validation**: UNO calls validated server-side, work with any hand size, protection only on second-to-last card play

### Mobile Accessibility & Exit Button Fixes (Aug 11, 2025)
- Fixed draw button positioning for mobile devices (iPhone accessibility)
- Repositioned draw button from far left (-left-32) to bottom-right area (-bottom-20 -right-16)
- Ensured draw button is in clear space without overlapping other game elements
- Fixed exit button to properly redirect to main page with localStorage cleanup
- Added confirmation dialog and proper session cleanup on exit

### Position-Based Card System & Complete Kick Functionality (Aug 11, 2025)
- Implemented position-based card memory system where each game slot (0-3) remembers its cards
- Fixed kick system to be completely silent with proper card preservation and restoration
- Added positionHands field to room schema for persistent card storage by position
- Added activePositions field to track which positions were active when game started
- Cards tied to positions, not players - anyone joining a position gets that position's cards
- **CRITICAL RESTRICTION**: During games, only originally active positions can be rejoined
- Empty positions at game start become permanently closed until game ends
- Complete kick workflow: Player kicked → Cards saved to position → Only original players can rejoin same position
- Real-time position hand updates during gameplay (card play/draw operations)
- WebSocket validation prevents joining positions that weren't active at game start
- Comprehensive debugging logs for kick operations and card restoration

### UNO Call System Enhanced (Aug 11, 2025)
- **IMPROVED**: UNO button now always available instead of only during player's turn or with 2 cards
- **Button Behavior**: Changes from "🔥 UNO! 🔥" (red, pulsing) to "✅ UNO CALLED" (green, disabled) after clicking
- **Functionality**: UNO call works anytime but only prevents penalty when playing second-to-last card
- **Animated Messages**: Added funny animated UNO messages visible to all players when someone calls UNO
- **Message Display**: Large bouncing message "🔥 PlayerName says UNO! 🔥" appears for 3 seconds
- **Voice Synthesis**: Added voice that says "UNO!" when any player calls UNO (using browser's speech synthesis)
- **Audio Settings**: Voice configured with enhanced rate (1.2x), higher pitch (1.3x), and moderate volume (0.8)
- **WebSocket Enhancement**: Broadcasts `uno_called_success` message to all players for synchronized animation and audio
- **Complete Workflow**: Call UNO anytime → Voice says "UNO!" + Animation → Play second-to-last card → No penalty

### UNO Penalty System Completely Fixed (Aug 11, 2025)
- **RESOLVED**: Fixed critical UNO penalty bug where players received 2-card penalties even after calling UNO correctly
- **Root Cause**: Missing HTTP start game endpoint prevented games from entering "playing" status
- **Solution**: Added POST `/api/rooms/:roomId/start` endpoint for proper game initialization
- Fixed game state validation - rooms now properly transition from "waiting" to "playing" status
- Card play validation now works correctly when room status is "playing" with 2+ players
- UNO call workflow verified: Call UNO → Play card → Hand reduces from 2→1 → No penalty
- Added comprehensive debugging system with detailed console logging for UNO workflow
- Enhanced penalty animation system with proper timing (6 seconds total) and initial count display

### Session Management 
- Implemented browser fingerprinting to detect same user accessing from multiple tabs/browsers
- Automatic session management: old sessions become offline when new session starts from same device
- Enhanced connection tracking with user fingerprints and session IDs
- Improved online status detection to show most recent active session per user

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Components**: Radix UI primitives with shadcn/ui components for consistent design
- **Styling**: Tailwind CSS with custom UNO-themed color variables and Fredoka One font for game aesthetics
- **State Management**: React Query for server state management and custom hooks for game logic
- **Routing**: Wouter for lightweight client-side routing
- **Real-time Communication**: WebSocket connection via custom `useSocket` hook for game synchronization

### Backend Architecture
- **Server**: Express.js with TypeScript running on Node.js
- **Real-time Communication**: WebSocket Server (ws) for multiplayer game synchronization
- **Game Logic**: Custom UNO game engine with deck management, turn handling, and rule validation
- **Storage**: In-memory storage with abstract interface pattern for easy database migration
- **API Design**: RESTful endpoints for room creation/joining with WebSocket for game actions

### Data Storage Solutions
- **Current**: In-memory storage using Maps for development and testing
- **Database Ready**: Drizzle ORM configured for PostgreSQL with complete schema definitions
- **Schema**: Normalized tables for users, rooms, players, and game messages with JSON fields for game state
- **Migration Support**: Drizzle Kit configured for database schema management

### Authentication and Authorization
- **Simple Access**: No user registration required - players only need nicknames
- **Room Security**: JWT tokens for secure room access and player identification
- **Session Management**: Socket-based session tracking with player validation
- **Host Privileges**: Room creators have administrative controls (kick players, start games)

### External Dependencies
- **Database**: Neon Database (PostgreSQL) for production data persistence
- **UI Framework**: Radix UI for accessible component primitives
- **Real-time**: Native WebSocket implementation for low-latency game communication
- **QR Code Generation**: QRCode library for sharing room links
- **Development Tools**: Replit-specific plugins for development environment integration
- **Build Tools**: Vite for fast development and optimized production builds