# QRFun Games Platform

A real-time multiplayer gaming platform featuring UNO and XO (Tic-Tac-Toe) games with WebSocket-based synchronization, QR code room sharing, and spectator support.

## Features

- **UNO Card Game**: Complete implementation with classic rules, action cards, and penalty system
- **XO (Tic-Tac-Toe)**: Classic multiplayer game
- **Real-time Multiplayer**: WebSocket-based instant synchronization
- **QR Code Sharing**: Instant room joining via QR code scan
- **Spectator Mode**: Watch games in real-time
- **Ranking System**: Track player performance

## Development (Replit)

The application runs seamlessly in Replit with no additional configuration:

```bash
npm run dev
```

This starts the development server with hot-reloading on the Replit-assigned port.

## Production Build

```bash
npm run build
npm start
```

## Docker Deployment

The application is fully Docker-ready for deployment on Docker Hub, Unraid, and other container platforms.

### Build Docker Image

```bash
docker build -t qrfun .
```

### Run Container

```bash
docker run -d \
  -p 4322:4322 \
  -v /path/to/data:/app/data \
  --name qrfun \
  qrfun
```

### Docker Compose

```yaml
version: '3.8'
services:
  qrfun:
    build: .
    ports:
      - "4322:4322"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - PORT=4322
      - DATABASE_URL=postgresql://user:pass@db:5432/qrfun
    restart: unless-stopped
```

### Unraid Deployment

1. Pull or build the Docker image
2. Map port: `4322 → 4322`
3. Map volume: `/mnt/user/appdata/qrfun → /app/data`
4. Start container

No additional configuration or post-deployment steps required.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4322` | Server port (Replit overrides automatically) |
| `NODE_ENV` | `development` | Environment mode |
| `DATA_PATH` | `./data` | Persistent data directory |
| `DATABASE_URL` | - | PostgreSQL connection string |
| `SESSION_SECRET` | - | Session encryption secret |
| `SENDGRID_API_KEY` | - | SendGrid API key (optional) |

## Platform Compatibility

| Platform | Status | Notes |
|----------|--------|-------|
| Replit | ✅ Full Support | Development and production |
| Docker | ✅ Full Support | Production deployment |
| Unraid 7.0.1 | ✅ Full Support | Zero-touch deployment |
| Local Node.js | ✅ Full Support | Direct execution |

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Radix UI
- **Backend**: Express.js, WebSocket (ws)
- **Database**: PostgreSQL via Drizzle ORM
- **Real-time**: Native WebSocket

## License

MIT
