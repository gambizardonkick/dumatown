# Dumatown Packdraw Leaderboard

## Overview
A leaderboard website for Dumatown that tracks user performance across multiple partner platforms (Packdraw, Solpump, Rugsfun). Users compete for prize pools by using referral codes on these platforms.

## Project Architecture
- **Runtime**: Node.js 20
- **Server**: Plain Node.js HTTP server (`server.js`) - serves both static files and API endpoints
- **Port**: 5000 (bound to 0.0.0.0)
- **Frontend**: Vanilla HTML/CSS/JS (no build step)
- **Config Storage**: JSON file (`admin-config.json`) for leaderboard settings and cached data

## Project Structure
- `server.js` - Main server file (static file serving + REST API)
- `index.html` - Homepage
- `admin.html` - Admin panel for managing leaderboards
- `admin-config.json` - Runtime configuration (auto-generated)
- `css/` - Stylesheets
- `js/` - Client-side JavaScript
- `assets/` - Images and media
- `leaderboard/` - Individual leaderboard pages (packdraw, solpump, rugsfun)

## API Endpoints
- `GET /api/config` - Get all leaderboard configurations
- `POST /api/admin-auth` - Admin authentication
- `POST /api/config` - Update leaderboard config (admin)
- `GET /api/leaderboard` - Packdraw leaderboard data (fetched from external API)
- `GET /api/leaderboard/solpump` - Solpump leaderboard data (manual entries)
- `GET /api/leaderboard/rugsfun` - Rugsfun leaderboard data (manual entries)
- `POST /api/leaderboard/{solpump|rugsfun}/entry` - Add/update entry (admin)
- `DELETE /api/leaderboard/{solpump|rugsfun}/entry` - Delete entry (admin)
- `POST /api/leaderboard/{solpump|rugsfun}/slots` - Bulk save entries (admin)

## Recent Changes
- 2026-02-17: Initial setup in Replit environment
