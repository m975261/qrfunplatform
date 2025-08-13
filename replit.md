# QRFun Games Platform

## Overview
This is a full-stack multiplayer gaming platform featuring multiple games with instant QR code sharing. Currently includes a complete UNO card game supporting up to 4 players per room with classic UNO rules and all action cards. Players can create rooms, join via codes or QR, and play in real-time. The platform features a main home page for game selection, with individual games accessible via dedicated routes (/uno, /xo). Key features include complete ranking systems, spectator-centric lobby systems, and streamlined multiplayer interactions across all games.

**Admin System**: Includes a secure hidden admin system at `/man` route with Google Authenticator 2FA, Gmail-based email functionality, and a complete guru user management system where special authenticated users can be created per game with email/username/playername credentials.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript (Vite).
- **UI Components**: Radix UI primitives and shadcn/ui with custom Badge component.
- **Styling**: Tailwind CSS with custom UNO-themed colors, gradient backgrounds, and Fredoka One font.
- **State Management**: React Query for server state and custom hooks for game logic.
- **Routing**: Wouter with multi-game routing structure:
  - `/` - Main home page with game selection
  - `/uno` - UNO game home and lobby
  - `/xo` - XO (Tic Tac Toe) game placeholder
  - `/room/:roomId` - Game lobbies
  - `/game/:roomId` - Active game sessions
- **Real-time Communication**: Custom `useSocket` hook for WebSocket.

### Backend Architecture
- **Server**: Express.js with TypeScript (Node.js).
- **Real-time Communication**: WebSocket Server (`ws`) for multiplayer synchronization.
- **Game Logic**: Custom UNO game engine for deck management, turn handling, and rule validation.
- **Storage**: In-memory storage with an abstract interface for future database migration.
- **API Design**: RESTful endpoints for room management, complemented by WebSocket for game actions.

### Data Storage Solutions
- **Current**: In-memory storage for game data.
- **Database**: PostgreSQL with Drizzle ORM for admin system, guru users, and game sessions.
- **Schema**: Normalized tables for admins, guru_users, game_sessions, rooms, players, and game messages.
- **Management**: Drizzle Kit for schema migrations and management.

### Authentication and Authorization
- **Player Access**: Nickname-based, no user registration for regular players.
- **Guru User System**: Special authenticated players created via admin dashboard with hidden username/password authentication.
- **Admin System**: Secure 2FA authentication system at hidden `/man` route with Gmail integration.
- **Room Security**: JWT tokens for secure room access and player identification.
- **Session Management**: Socket-based session tracking with player validation and browser fingerprinting.
- **Host Privileges**: Room creators have administrative controls (kick, start games).

### UI/UX Decisions
- Consistent design using Radix UI and shadcn/ui.
- UNO-themed color palette and Fredoka One font.
- Responsive design for various screen sizes (mobile-first approach).
- Clear visual indicators for game direction, player status, and turn management.
- Animated elements for user feedback (e.g., UNO messages, penalties).

### Feature Specifications

#### Platform Features
- **Multi-Game Architecture**: Main home page with game selection and navigation
- **Consistent UI/UX**: Shared design system across all games with gradient backgrounds
- **Game Status Indicators**: Visual badges showing game availability (Available/Coming Soon)
- **Navigation System**: Back links and breadcrumb navigation between games and main page

#### UNO Game Features
- Support for classic UNO rules, including Skip, Reverse, Draw Two, Wild, and Draw Four cards.
- Room creation with 5-digit codes, join via code, QR scan, or QR photo upload.
- Real-time game state synchronization.
- Ranking system (1st, 2nd, 3rd, 4th) for finished players, who are excluded from turn rotation.
- **Spectator-centric lobby system** - All new joiners start as spectators and can click avatar slots to join
- **Streamlined end-game flow** - Single "Close" button returns all to lobby as spectators (host keeps position 0)
- Seamless QR code integration for direct room joining.
- Position-based card memory system for persistent card storage across reconnections or kicks.
- Enhanced UNO call system with visual and auditory feedback (voice synthesis).
- **Improved spectator table** - Prevents 3 o'clock avatar overlap, includes separator lines, scroll container
- **Duplicate player protection** - Prevents kick/rejoin issues that caused offline/online conflicts

#### XO Game Features (Planned)
- Real-time multiplayer Tic Tac Toe
- Room sharing via QR codes
- Smart AI opponent mode
- Tournament functionality
- Statistics tracking

#### Admin System Features
- **Hidden Admin Access**: Secure login at `/man` route with username/password + 2FA
- **Google Authenticator**: Time-based 2FA for enhanced security
- **Gmail Integration**: Password reset emails via Gmail SMTP
- **Game Management**: View active games, restart specific rooms, monitor player counts
- **Guru User System**: Create special authenticated players per game type
- **User Management**: Create/deactivate guru users with email, hidden username, and visible player name
- **Guru Authentication**: Players entering guru usernames are prompted for password authentication

## External Dependencies
- **Database**: Neon Database (PostgreSQL).
- **UI Framework**: Radix UI.
- **Real-time**: Native WebSocket.
- **QR Code Generation**: QRCode library.
- **Build Tools**: Vite.