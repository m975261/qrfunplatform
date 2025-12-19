# QRFun Games Platform

A real-time multiplayer gaming platform featuring UNO and XO (Tic-Tac-Toe) games with WebSocket-based synchronization, QR code room sharing, and spectator support.

## Features

- **UNO Card Game**: Complete implementation with classic rules, action cards, and penalty system
- **XO (Tic-Tac-Toe)**: Classic multiplayer game
- **Real-time Multiplayer**: WebSocket-based instant synchronization
- **QR Code Sharing**: Instant room joining via QR code scan
- **Spectator Mode**: Watch games in real-time
- **Ranking System**: Track player performance

## Database

QRFun supports two database modes:

### SQLite (Default - Zero Config)
By default, QRFun uses an embedded SQLite database requiring no external database service. Data is stored at `${DATA_PATH}/qrfun.db` (default: `./data/qrfun.db`).

- No external database required
- Data persists across restarts
- Perfect for Docker/Unraid deployments
- Tables are created automatically on first run

### PostgreSQL (Optional)
Set the `DATABASE_URL` environment variable to use PostgreSQL instead:

```bash
DATABASE_URL=postgresql://user:pass@host:5432/qrfun
```

## Development (Replit)

The application runs seamlessly in Replit with no additional configuration:

```bash
npm run dev
```

This starts the development server with hot-reloading on the Replit-assigned port. In Replit, PostgreSQL is automatically provisioned.

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

### Run Container (SQLite - Recommended)

```bash
docker run -d \
  -p 4322:4322 \
  -v /path/to/data:/app/data \
  --name qrfun \
  qrfun
```

No database configuration needed - SQLite is used automatically.

### Run Container (PostgreSQL)

```bash
docker run -d \
  -p 4322:4322 \
  -v /path/to/data:/app/data \
  -e DATABASE_URL=postgresql://user:pass@host:5432/qrfun \
  --name qrfun \
  qrfun
```

### Docker Compose (SQLite)

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
    restart: unless-stopped
```

### Docker Compose (PostgreSQL)

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
    depends_on:
      - db
    restart: unless-stopped
  
  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=qrfun
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  pgdata:
```

### Unraid Deployment

1. Pull or build the Docker image
2. Map port: `4322 → 4322`
3. Map volume: `/mnt/user/appdata/qrfun → /app/data`
4. Start container

No database configuration required - SQLite database is created automatically in the mapped volume.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4322` | Server port (Replit overrides automatically) |
| `NODE_ENV` | `development` | Environment mode |
| `DATA_PATH` | `./data` | Persistent data directory (SQLite database location) |
| `DATABASE_URL` | - | PostgreSQL connection string (if set, uses PostgreSQL instead of SQLite) |
| `SESSION_SECRET` | - | Session encryption secret |
| `SENDGRID_API_KEY` | - | SendGrid API key (optional) |

## Platform Compatibility

| Platform | Status | Database | Notes |
|----------|--------|----------|-------|
| Replit | ✅ Full Support | PostgreSQL | Development and production |
| Docker | ✅ Full Support | SQLite/PostgreSQL | Zero-config with SQLite |
| Unraid 7.0.1 | ✅ Full Support | SQLite | Zero-touch deployment |
| Local Node.js | ✅ Full Support | SQLite/PostgreSQL | Direct execution |

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Radix UI
- **Backend**: Express.js, WebSocket (ws)
- **Database**: SQLite (default) or PostgreSQL via Drizzle ORM
- **Real-time**: Native WebSocket

## License

MIT
