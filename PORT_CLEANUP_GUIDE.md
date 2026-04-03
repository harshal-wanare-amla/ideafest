# Port Management - Automatic Cleanup

## Overview
The project now includes **automatic port cleanup** - when you start the backend or frontend, if the port is in use, it will automatically kill the blocking process and restart on the same port.

## How It Works

### Backend (Port 5000)
- **File**: `backend/src/port-manager.js` - Reusable port cleanup utilities
- **Integration**: `backend/src/server.js` - Automatically called on startup
- **Cross-platform**: Works on Windows (PowerShell), Mac, and Linux (lsof)

**Startup Flow**:
```
1. Initialize Gemini & Elasticsearch
2. 🔧 Check if port 5000 is available
3. Kill any processes using port (if needed)
4. Wait for port to become available (with retry)
5. ✅ Start Express server
```

### Frontend (Port 5173)
- **File**: `frontend/vite-plugins/port-cleanup.js` - Vite plugin
- **Integration**: `frontend/vite.config.js` - Integrated as plugin
- Runs automatically when you do `npm run dev`

## Benefits
✅ No more manual port killing  
✅ No more "port already in use" errors  
✅ Automatic retry with exponential backoff  
✅ Works across Windows, Mac, Linux  
✅ Minimal configuration needed  

## Running the Servers

### Backend
```bash
cd backend
npm start
# Automatically checks/cleans port 5000
```

### Frontend
```bash
cd frontend
npm run dev
# Automatically checks/cleans port 5173
```

## Port Manager API

```javascript
import { killProcessOnPort, waitForPortAvailable } from './port-manager.js';

// Kill process on a specific port
await killProcessOnPort(3000);

// Wait for port to become available
await waitForPortAvailable(3000, 15, 200);
```

### Parameters
- **port** (number): Port number to manage
- **maxRetries** (number, optional): How many times to retry (default: 15 for frontend, 15 for wait)
- **delay** (number, optional): Initial retry delay in milliseconds (default: 200)
  - Uses exponential backoff: delay × 1.3^retryCount

## How Port Detection Works

### Windows
- Uses PowerShell `Get-NetTCPConnection` to find processes
- Handles both IPv4 and IPv6 connections
- Uses `taskkill /PID /F` to terminate processes

### Mac/Linux
- Uses `lsof -ti:port` to find process IDs
- Uses `kill -9 PID` to terminate processes

## Fallback: Manual Cleanup
If automatic cleanup doesn't work, manually free the port:

**Windows**:
```powershell
Get-NetTCPConnection -LocalPort 5000 | Stop-Process -Force
```

**Mac/Linux**:
```bash
lsof -ti:5000 | xargs kill -9
```

## Troubleshooting

### Backend won't start despite port cleanup
1. Check if Elasticsearch is running: `curl http://localhost:9200`
2. Manually verify port is free:
   ```powershell
   Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue
   ```
3. If process still exists, kill it manually
4. Restart backend

### Frontend won't start on port 5173
1. Check if port is free:
   ```powershell
   Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
   ```
2. Vite may use fallback ports (5174, 5175, etc.) if 5173 is unavailable
3. Check terminal output for actual port being used

## Architecture

```
┌─────────────────────────────────────┐
│     Backend Server (5000)           │
│  ┌────────────────────────────────┐ │
│  │  Port Manager                  │ │
│  │  • Check port availability    │ │
│  │  • Kill blocking processes    │ │
│  │  • Wait with exponential BO   │ │
│  └────────────────────────────────┘ │
│            ↓                         │
│  ┌────────────────────────────────┐ │
│  │  Express.js Server             │ │
│  │  (API endpoints, Elasticsearch)│ │
│  └────────────────────────────────┘ │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│     Frontend App (5173)             │
│  ┌────────────────────────────────┐ │
│  │  Vite Plugin: Port Cleanup     │ │
│  │  (Same cleanup utilities)      │ │
│  └────────────────────────────────┘ │
│            ↓                         │
│  ┌────────────────────────────────┐ │
│  │  Vite Dev Server               │ │
│  │  (React + HMR)                 │ │
│  └────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Testing
Start backend: `npm start` in backend folder
Check it's running: `curl http://localhost:5000/search?q=test`
If port is in use, it will auto-kill and restart ✅
