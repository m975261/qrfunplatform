# UNO Game Application

## Overview

This is a full-stack multiplayer UNO card game built with React, Express, and WebSocket for real-time gameplay. The application supports up to 4 players per room with classic UNO rules including all action cards (Skip, Reverse, Draw Two, Wild, Draw Four). Players can create rooms using 5-digit codes in format AABCC (e.g., 22033, 44055, 55066), join via room codes, QR code scanning, or QR code photo upload, and play in real-time with synchronized game state. Spectators can watch ongoing games and interact via animated emojis. The app features seamless QR code integration with direct room joining through nickname popup dialogs.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### Session Management (Latest)
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