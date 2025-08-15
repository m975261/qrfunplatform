# QRFun Games Platform

## Overview
QRFun is a full-stack multiplayer gaming platform that currently features a complete UNO card game for up to 4 players, with plans to expand to other games like Tic-Tac-Toe. The platform enables real-time play with instant QR code room sharing, comprehensive ranking systems, and spectator-centric lobby systems. It includes a secure hidden admin panel for managing games and guru users. The vision is to create a seamless, engaging multiplayer experience with robust real-time synchronization and intuitive user interactions.

## User Preferences
Preferred communication style: Simple, everyday language.

**Critical Player State Management Rule**: Always design player-related features with full awareness that users can be joined, kicked, rejoined, kicked again, and join as different players in complex sequences. All player functionality must handle these dynamic state changes robustly without conflicts or data inconsistencies.

**CRITICAL - AVATAR ATTACHMENT CODE**
- **Working Avatar Positioning**: `top-16/right-16/bottom-16/left-16` with `-translate-x-1/2 -translate-y-1/2` etc
- **Key Fix**: Position at circle edge (64px) not container edge (288-384px) for true attachment
- **Button Positioning**: Position-specific buttons - 12 o'clock (top), 3 o'clock (right), 6 o'clock (bottom), 9 o'clock (left)
- **Avatar Display**: Shows male/female emoji avatars (👨👩) instead of first letters when selected
- **Never Change**: This positioning calculation ensures perfect circle edge attachment without gaps
- **Return Point**: If avatar positioning breaks, restore this exact positioning logic

**CRITICAL - DO NOT MODIFY**: Real-time Lobby Synchronization System
- **Solution**: All lobby operations (kick, assign spectator, replace player) MUST use WebSocket exclusively
- **Implementation**: `kickPlayer`, `assignSpectator`, `replacePlayer` functions in useSocket.ts with corresponding server handlers
- **Requirement**: Any future lobby-related changes must maintain WebSocket-only communication for real-time sync

**CRITICAL - VERIFIED WORKING**: Wild Card Color Selection System
- **Status**: FULLY FUNCTIONAL as of August 15, 2025
- **Solution**: Complete server-client wild card color choice flow with proper player validation
- **Implementation**: Server sends `choose_color_request` message, client handles via `colorChoiceRequested` state in ColorPickerModal
- **Wild Card Flow**: Play card → server validates turn → server requests color → client shows picker → player chooses → server updates game state
- **Key Fix**: Proper host player identification prevents duplicate players and ensures game start validation passes
- **Test Results**: E2E test confirms choose_color_request and wild_card_played messages work correctly
- **Requirement**: Do not modify the wild card message handling logic - system is working as designed

**CRITICAL - DO NOT MODIFY**: CSS Grid Layout System
- **Solution**: Implemented 12x12 CSS Grid layout replacing absolute positioning for game elements
- **Implementation**: Draw button positioned in `col-start-10 col-end-12 row-start-10 row-end-12` grid cells
- **Requirement**: All future game UI positioning must use this grid system to prevent overlap issues

**CRITICAL - DO NOT MODIFY**: Direction Indicator Design
- **Position**: Fixed at `top-12 left-12` between 12 and 9 o'clock avatar slots
- **Design**: Circular yellow gradient button (w-16 h-16) with "GAME DIRECTION" label
- **Visual**: Directional arrows (↻ clockwise, ↺ counterclockwise) with border, shadow, and pulse animation
- **Behavior**: Only shows during active gameplay (`room?.status === 'playing'`)
- **Layout**: Separate positioning from draw button - NO container wrapping
- **Implementation**: Simple UI button approach after SVG circle positioning failed
- **Status**: FROZEN - Working design saved as fallback, do not modify positioning or container approach

## System Architecture

### Core Design Principles
The platform is designed as a full-stack, real-time multiplayer gaming system with a focus on modularity, responsiveness, and a consistent user experience. It leverages a modern web stack for both frontend and backend, with a strong emphasis on WebSocket communication for seamless real-time interactions.

### Frontend
- **Framework**: React with TypeScript (Vite).
- **UI/UX**: Radix UI primitives and shadcn/ui for consistent components, styled with Tailwind CSS for UNO-themed colors and responsive layouts. Fredoka One is the primary font.
- **State Management**: React Query for server state and custom hooks for game logic.
- **Routing**: Wouter, supporting multi-game navigation (`/`, `/uno`, `/xo`, `/room/:roomId`, `/game/:roomId`).
- **Real-time**: Custom `useSocket` hook for WebSocket communication.
- **Responsiveness**: Responsive design for various screen sizes, utilizing CSS variables with `clamp()` for scaling, and specific optimizations for mobile (e.g., iPhone horizontal card layout).
- **Avatar System**: Mathematically precise avatar positioning ensuring circular attachment without overlap, supporting male/female emoji avatars and persistence via local storage.
- **Game UI**: 12x12 CSS Grid layout for game elements to prevent overlaps, with features like animated penalties, single-click card playing, and a streamlined wild card color selection flow.

### Backend
- **Server**: Express.js with TypeScript (Node.js).
- **Real-time**: Native WebSocket Server (`ws`) for high-performance multiplayer synchronization.
- **Game Logic**: Custom UNO game engine handling rules, deck management, and turn validation.
- **Storage**: In-memory storage for active game data, with an abstract interface for future database integration.

### Data Storage
- **Primary Database**: PostgreSQL via Neon Database.
- **ORM**: Drizzle ORM for schema definition and migrations.
- **Schema**: Normalized tables for `admins`, `guru_users`, `game_sessions`, `rooms`, `players`, and `game messages`.

### Authentication and Authorization
- **Regular Players**: Nickname-based access without registration.
- **Guru Users**: Special authenticated players created and managed via the admin dashboard, with hidden username/password authentication.
- **Admin System**: Secure, hidden `/man` route with 2FA (Google Authenticator) and Gmail-based email functionality for password resets.
- **Room Security**: JWT tokens for secure room access and player identification.
- **Session Management**: Socket-based session tracking with player validation and browser fingerprinting.
- **Host Privileges**: Room creators have administrative controls (kick, start games).

### Key Features
- **Multi-Game Architecture**: Centralized home page for game selection.
- **Real-time Multiplayer**: Synchronized game state, spectator-centric lobbies, and seamless player transitions.
- **QR Code Integration**: Instant room joining via QR code scan or photo upload.
- **Ranking System**: Tracks player performance (1st, 2nd, 3rd, 4th).
- **Admin System**: Secure access for game and user management, including "guru user" creation.
- **UNO Specifics**: Classic UNO rules, action cards, position-based card memory, enhanced UNO call system with visual/auditory feedback, and penalty animations.

## External Dependencies
- **Database**: Neon Database (PostgreSQL)
- **UI Framework**: Radix UI
- **Real-time**: Native WebSocket
- **QR Code Generation**: QRCode library
- **Build Tools**: Vite
- **ORM**: Drizzle ORM