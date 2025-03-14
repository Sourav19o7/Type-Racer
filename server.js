const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Text samples for races
const textSamples = require('./textSamples');

// Setup express app
const app = express();
const server = http.createServer(app);
// Update your Socket.IO initialization with these options
// Update your Socket.IO initialization with these options
const io = socketIO(server, {
    pingTimeout: 30000, // Reduce from 60000 to 30000
    pingInterval: 10000, // Reduce from 25000 to 10000
    upgradeTimeout: 5000, // Reduce from 10000 to 5000
    transports: ['websocket', 'polling'], // Keep both transport methods
    allowUpgrades: true,
    cookie: false,
    connectTimeout: 10000, // Add explicit connect timeout
    path: '/socket.io/', // Ensure path is explicitly set
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

// This line should be in your server.js file
app.use(express.static(path.join(__dirname, 'public')));

// Add Helmet for enhanced security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'", "wss:"]
        }
    }
}));

// Add compression middleware
app.use(compression());

// Add rate limiting for API endpoints
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: 'Too many requests from this IP, please try again after 15 minutes'
});

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Store active rooms
const rooms = new Map();

// Race statistics for analytics
const raceStats = {
    totalRaces: 0,
    totalPlayers: 0,
    averageWpm: 0,
    highestWpm: 0,
    fastestPlayer: ''
};

// Generate a random room ID
function generateRoomId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar looking characters
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Get a random text sample based on category
function getRandomText(category) {
    const texts = textSamples[category] || textSamples.quotes;
    return texts[Math.floor(Math.random() * texts.length)];
}

// Create a new room with standard structure
function createNewRoom(roomId, hostSocketId, hostUsername) {
    return {
        id: roomId,
        host: hostSocketId,
        category: 'quotes',
        text: '',
        customText: null,
        locked: false,
        voiceChatEnabled: false,
        raceTimeout: 180, // 3 minutes default
        status: 'waiting',
        startTime: null,
        raceEndTime: null,
        lastActivity: Date.now(),
        players: [
            {
                id: hostSocketId,
                username: hostUsername,
                isHost: true,
                progress: 0,
                wpm: 0,
                accuracy: 100,
                isReady: false,
                finished: false,
                finishTime: null,
                isTyping: false
            }
        ],
        countdownInterval: null,
        raceTimeoutTimer: null,
        createdAt: Date.now(),
        gamesPlayed: 0
    };
}

// Update race statistics when a race completes
function updateRaceStats(room) {
    raceStats.totalRaces++;
    raceStats.totalPlayers += room.players.length;
    
    // Calculate average WPM for this race
    const wpmSum = room.players.reduce((sum, player) => sum + player.wpm, 0);
    const raceAvgWpm = wpmSum / room.players.length;
    
    // Update overall average WPM
    raceStats.averageWpm = 
        ((raceStats.averageWpm * (raceStats.totalRaces - 1)) + raceAvgWpm) / 
        raceStats.totalRaces;
    
    // Check for highest WPM
    const fastestPlayer = room.players.reduce(
        (fastest, player) => player.wpm > fastest.wpm ? player : fastest, 
        { wpm: 0 }
    );
    
    if (fastestPlayer.wpm > raceStats.highestWpm) {
        raceStats.highestWpm = fastestPlayer.wpm;
        raceStats.fastestPlayer = fastestPlayer.username;
    }
    
    // Store race end time for cleanup
    room.raceEndTime = Date.now();
    room.gamesPlayed++;
}

// Force finish a race
function forceFinishRace(room, roomId) {
    // Set room status to finished
    room.status = 'finished';
    
    // Clear any race timeout timer
    if (room.raceTimeoutTimer) {
        clearTimeout(room.raceTimeoutTimer);
        room.raceTimeoutTimer = null;
    }
    
    // For any players who haven't finished, mark them as finished with their current progress
    room.players.forEach(player => {
        if (!player.finished) {
            player.finished = true;
            player.finishTime = formatTime(Math.floor((Date.now() - room.startTime) / 1000));
        }
    });
    
    // Send final results to all players
    io.to(roomId).emit('raceCompleted', {
        players: room.players,
        forcedByTimeout: true
    });
    
    // Update race stats
    updateRaceStats(room);
    
    console.log(`Race in room ${roomId} force finished due to timeout`);
}

// Start race countdown
function startRaceCountdown(room, roomId) {
    // Select a random text based on category
    if (room.category === 'custom' && room.customText) {
        room.text = room.customText;
    } else {
        room.text = getRandomText(room.category);
    }
    
    // Set room status to countdown
    room.status = 'countdown';
    
    // Start countdown sequence
    let countdown = 3;
    
    // Notify all players about countdown start and send race text
    io.to(roomId).emit('raceCountdown', {
        countdown,
        text: room.text
    });
    
    // Store interval reference to clear it later if needed
    room.countdownInterval = setInterval(() => {
        countdown--;
        
        if (countdown > 0) {
            // Send countdown update
            io.to(roomId).emit('raceCountdownUpdate', {
                countdown
            });
        } else {
            // Clear interval
            clearInterval(room.countdownInterval);
            room.countdownInterval = null;
            
            // Set room status to racing
            room.status = 'racing';
            
            // Record race start time
            room.startTime = Date.now();
            
            // Reset player ready status
            room.players.forEach(player => {
                player.isReady = false;
            });
            
            // Notify all players that race has started
            io.to(roomId).emit('raceStarted', {
                startTime: room.startTime
            });
            
            // Set a timeout to automatically finish the race if configured
            if (room.raceTimeout) {
                room.raceTimeoutTimer = setTimeout(() => {
                    // Only force finish if race is still in progress
                    if (room.status === 'racing') {
                        // Force finish the race
                        forceFinishRace(room, roomId);
                    }
                }, room.raceTimeout * 1000);
            }
            
            console.log(`Race started in room ${roomId}`);
        }
    }, 1000);
    
    console.log(`Race countdown started in room ${roomId}`);
}

// Format time helper (mm:ss)
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Track room activity
function updateRoomActivity(roomId) {
    if (rooms.has(roomId)) {
        rooms.get(roomId).lastActivity = Date.now();
    }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Create a new room
    socket.on('createRoom', ({ username }) => {
        const roomId = generateRoomId();
        
        // Create a new room using our model
        const newRoom = createNewRoom(roomId, socket.id, username);
        
        // Store the room
        rooms.set(roomId, newRoom);
        
        // Add socket to room
        socket.join(roomId);
        
        // Set user's current room
        socket.roomId = roomId;
        
        // Send room info back to client
        socket.emit('roomCreated', {
            roomId,
            isHost: true,
            players: newRoom.players
        });
        
        console.log(`Room created: ${roomId} by ${username}`);
    });
    
    // Join an existing room
    socket.on('joinRoom', ({ roomId, username }) => {
        roomId = roomId.toUpperCase();
        
        // Check if room exists
        if (!rooms.has(roomId)) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }
        
        const room = rooms.get(roomId);
        
        // Check if room is locked
        if (room.locked) {
            socket.emit('error', { message: 'This room is locked by the host' });
            return;
        }
        
        // Check if race is already in progress
        if (room.status === 'racing') {
            socket.emit('error', { message: 'Race already in progress' });
            return;
        }
        
        // Check if username is already taken in this room
        const existingPlayer = room.players.find(p => p.username === username);
        if (existingPlayer) {
            socket.emit('error', { message: 'Username already taken in this room' });
            return;
        }
        
        // Add player to room
        room.players.push({
            id: socket.id,
            username: username,
            isHost: false,
            progress: 0,
            wpm: 0,
            accuracy: 100,
            isReady: false,
            finished: false,
            finishTime: null,
            isTyping: false
        });
        
        // Add socket to room
        socket.join(roomId);
        
        // Set user's current room
        socket.roomId = roomId;
        
        // Send room info back to client
        socket.emit('roomJoined', {
            roomId,
            isHost: false,
            players: room.players,
            category: room.category
        });
        
        // Notify other players in the room
        socket.to(roomId).emit('playerJoined', {
            players: room.players,
            username
        });
        
        // Update room activity timestamp
        updateRoomActivity(roomId);
        
        console.log(`Player ${username} joined room ${roomId}`);
    });
    
    // Update selected text category
    socket.on('updateCategory', ({ category }) => {
        const roomId = socket.roomId;
        
        // Check if user is in a room
        if (!roomId || !rooms.has(roomId)) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }
        
        const room = rooms.get(roomId);
        
        // Check if user is the host
        if (socket.id !== room.host) {
            socket.emit('error', { message: 'Only the host can change the category' });
            return;
        }
        
        // Update category
        room.category = category;
        
        // Notify all players in the room
        io.to(roomId).emit('categoryUpdated', {
            category: category
        });
        
        // Update room activity timestamp
        updateRoomActivity(roomId);
        
        console.log(`Category updated in room ${roomId}: ${category}`);
    });
    
    // Submit custom text
    socket.on('submitCustomText', ({ text }) => {
        const roomId = socket.roomId;
        
        // Check if user is in a room
        if (!roomId || !rooms.has(roomId)) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }
        
        const room = rooms.get(roomId);
        
        // Check if user is the host
        if (socket.id !== room.host) {
            socket.emit('error', { message: 'Only the host can submit custom text' });
            return;
        }
        
        // Validate text (minimum length, not empty, etc.)
        if (!text || text.trim().length < 20) {
            socket.emit('error', { message: 'Custom text is too short (minimum 20 characters)' });
            return;
        }
        
        // Clean and format the text
        const cleanText = text
            .trim()
            .replace(/\s+/g, ' ')  // Replace multiple spaces with a single space
            .replace(/[\r\n]+/g, ' '); // Replace line breaks with spaces
        
        // Set room custom text
        room.customText = cleanText;
        room.category = 'custom';
        
        // Notify all players in the room
        io.to(roomId).emit('customTextSubmitted', {
            category: 'custom',
            previewText: cleanText.substring(0, 50) + (cleanText.length > 50 ? '...' : '')
        });
        
        // Update room activity timestamp
        updateRoomActivity(roomId);
        
        console.log(`Custom text submitted in room ${roomId} by host`);
    });
    
    // Set race timeout
    socket.on('setRaceTimeout', ({ timeout }) => {
        const roomId = socket.roomId;
        
        // Check if user is in a room
        if (!roomId || !rooms.has(roomId)) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }
        
        const room = rooms.get(roomId);
        
        // Check if user is the host
        if (socket.id !== room.host) {
            socket.emit('error', { message: 'Only the host can set race timeout' });
            return;
        }
        
        // Validate timeout (between 30 seconds and 10 minutes)
        if (isNaN(timeout) || timeout < 30 || timeout > 600) {
            socket.emit('error', { message: 'Invalid timeout value (must be between 30 and 600 seconds)' });
            return;
        }
        
        // Set room race timeout
        room.raceTimeout = timeout;
        
        // Notify all players in the room
        io.to(roomId).emit('raceTimeoutSet', {
            timeout
        });
        
        // Update room activity timestamp
        updateRoomActivity(roomId);
        
        console.log(`Race timeout set to ${timeout} seconds in room ${roomId} by host`);
    });
    
    // Toggle room lock
    socket.on('toggleRoomLock', ({ locked }) => {
        const roomId = socket.roomId;
        
        // Check if user is in a room
        if (!roomId || !rooms.has(roomId)) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }
        
        const room = rooms.get(roomId);
        
        // Check if user is the host
        if (socket.id !== room.host) {
            socket.emit('error', { message: 'Only the host can lock/unlock the room' });
            return;
        }
        
        // Update room lock status
        room.locked = locked;
        
        // Notify all players in the room
        io.to(roomId).emit('roomLockChanged', {
            locked
        });
        
        // Update room activity timestamp
        updateRoomActivity(roomId);
        
        console.log(`Room ${roomId} ${locked ? 'locked' : 'unlocked'} by host`);
    });
    
    // Toggle player ready status
    socket.on('toggleReady', ({ ready }) => {
        const roomId = socket.roomId;
        
        // Check if user is in a room
        if (!roomId || !rooms.has(roomId)) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }
        
        const room = rooms.get(roomId);
        
        // Find player
        const player = room.players.find(p => p.id === socket.id);
        if (!player) {
            socket.emit('error', { message: 'Player not found' });
            return;
        }
        
        // Update ready status
        player.isReady = ready;
        
        // Notify all players in the room
        io.to(roomId).emit('playerReadyChanged', {
            playerId: socket.id,
            ready
        });
        
        // Check if host and all players are ready, and auto-start race
        const allReady = room.players.every(p => p.isReady);
        if (player.isHost && allReady && room.status === 'waiting' && room.players.length > 1) {
            // Auto-start the race after a short delay
            setTimeout(() => {
                // Double-check that everyone is still ready and room exists
                if (rooms.has(roomId) && 
                    rooms.get(roomId).status === 'waiting' && 
                    rooms.get(roomId).players.every(p => p.isReady)) {
                    
                    // Start the race countdown
                    startRaceCountdown(room, roomId);
                }
            }, 2000);
        }
        
        // Update room activity timestamp
        updateRoomActivity(roomId);
    });
    
    // Kick player (host only)
    socket.on('kickPlayer', ({ playerId }) => {
        const roomId = socket.roomId;
        
        // Check if user is in a room
        if (!roomId || !rooms.has(roomId)) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }
        
        const room = rooms.get(roomId);
        
        // Check if user is the host
        if (socket.id !== room.host) {
            socket.emit('error', { message: 'Only the host can kick players' });
            return;
        }
        
        // Find player
        const playerIndex = room.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) {
            socket.emit('error', { message: 'Player not found' });
            return;
        }
        
        // Cannot kick yourself
        if (playerId === socket.id) {
            socket.emit('error', { message: 'You cannot kick yourself' });
            return;
        }
        
        // Get player username before removing
        const kickedUsername = room.players[playerIndex].username;
        
        // Remove player from room
        room.players.splice(playerIndex, 1);
        
        // Notify the kicked player
        const kickedSocket = io.sockets.sockets.get(playerId);
        if (kickedSocket) {
            kickedSocket.emit('kickedFromRoom');
            kickedSocket.leave(roomId);
            kickedSocket.roomId = null;
        }
        
        // Notify remaining players
        io.to(roomId).emit('playerKicked', {
            players: room.players,
            kickedUsername
        });
        
        // Update room activity timestamp
        updateRoomActivity(roomId);
        
        console.log(`Player ${kickedUsername} kicked from room ${roomId} by host`);
    });
    
    // Start race countdown (host only)
    socket.on('startRace', () => {
        const roomId = socket.roomId;
        
        // Check if user is in a room
        if (!roomId || !rooms.has(roomId)) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }
        
        const room = rooms.get(roomId);
        
        // Check if user is the host
        if (socket.id !== room.host) {
            socket.emit('error', { message: 'Only the host can start the race' });
            return;
        }
        
        // Check if race is already in progress
        if (room.status === 'countdown' || room.status === 'racing') {
            socket.emit('error', { message: 'Race already starting or in progress' });
            return;
        }
        
        // Check if there are enough players (at least 1)
        if (room.players.length < 1) {
            socket.emit('error', { message: 'Need at least one player to start a race' });
            return;
        }
        
        // Start the race countdown
        startRaceCountdown(room, roomId);
        
        // Update room activity timestamp
        updateRoomActivity(roomId);
    });
    
    // Update player's race progress
    socket.on('updateProgress', ({ progress, wpm, accuracy }) => {
        const roomId = socket.roomId;
        
        // Check if user is in a room
        if (!roomId || !rooms.has(roomId)) return;
        
        const room = rooms.get(roomId);
        
        // Find player in room
        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;
        
        // Update player progress
        player.progress = progress;
        player.wpm = wpm;
        player.accuracy = accuracy;
        
        // Broadcast progress to all players in the room
        io.to(roomId).emit('progressUpdated', {
            playerId: socket.id,
            progress,
            wpm,
            accuracy
        });
        
        // Update room activity timestamp
        updateRoomActivity(roomId);
    });
    
    // Player finished race
    socket.on('finishRace', ({ wpm, accuracy, time }) => {
        const roomId = socket.roomId;
        
        // Check if user is in a room
        if (!roomId || !rooms.has(roomId)) return;
        
        const room = rooms.get(roomId);
        
        // Find player in room
        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;
        
        // Mark player as finished
        player.finished = true;
        player.finishTime = time;
        player.progress = 100;
        player.wpm = wpm;
        player.accuracy = accuracy;
        
        // Broadcast to all players in the room
        io.to(roomId).emit('playerFinished', {
            playerId: socket.id,
            wpm,
            accuracy,
            time
        });
        
        // Check if all players have finished
        const allFinished = room.players.every(p => p.finished);
        if (allFinished) {
            // Set room status to finished
            room.status = 'finished';
            
            // Clear race timeout timer if active
            if (room.raceTimeoutTimer) {
                clearTimeout(room.raceTimeoutTimer);
                room.raceTimeoutTimer = null;
            }
            
            // Send final results to all players
            io.to(roomId).emit('raceCompleted', {
                players: room.players
            });
            
            // Update race stats
            updateRaceStats(room);
            
            console.log(`Race completed in room ${roomId}`);
        }
        
        // Update room activity timestamp
        updateRoomActivity(roomId);
        
        console.log(`Player ${player.username} finished race in room ${roomId}`);
    });
    
    // Force finish race (host only)
    socket.on('forceFinishRace', () => {
        const roomId = socket.roomId;
        
        // Check if user is in a room
        if (!roomId || !rooms.has(roomId)) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }
        
        const room = rooms.get(roomId);
        
        // Check if user is the host
        if (socket.id !== room.host) {
            socket.emit('error', { message: 'Only the host can force finish the race' });
            return;
        }
        
        // Check if race is in progress
        if (room.status !== 'racing') {
            socket.emit('error', { message: 'No race in progress' });
            return;
        }
        
        // Force finish the race
        forceFinishRace(room, roomId);
        
        // Update room activity timestamp
        updateRoomActivity(roomId);
        
        // Emit with special flag to indicate host-forced finish
        io.to(roomId).emit('raceCompleted', {
            players: room.players,
            forcedByHost: true
        });
    });
    
    // Player requests to play again
    socket.on('playAgain', () => {
        const roomId = socket.roomId;
        
        // Check if user is in a room
        if (!roomId || !rooms.has(roomId)) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }
        
        const room = rooms.get(roomId);
        
        // Check if user is the host
        if (socket.id !== room.host) {
            socket.emit('error', { message: 'Only the host can start a new race' });
            return;
        }
        
        // Reset room state for a new race
        room.status = 'waiting';
        room.text = '';
        room.startTime = null;
        
        // Reset player stats
        room.players.forEach(player => {
            player.progress = 0;
            player.wpm = 0;
            player.accuracy = 100;
            player.isReady = false;
            player.finished = false;
            player.finishTime = null;
        });
        
        // Notify all players in the room
        io.to(roomId).emit('resetRace', {
            players: room.players
        });
        
        // Update room activity timestamp
        updateRoomActivity(roomId);
        
        console.log(`Room ${roomId} reset for a new race`);
    });
    
    // Player typing event
    socket.on('playerTyping', () => {
        const roomId = socket.roomId;
        
        // Check if user is in a room
        if (!roomId || !rooms.has(roomId)) return;
        
        // Notify other players in the room
        socket.to(roomId).emit('playerTyping', {
            playerId: socket.id
        });
    });
    
    // Get random text for practice
    socket.on('getRandomText', ({ category }) => {
        // Generate a random text for practice
        const text = getRandomText(category || 'quotes');
        
        // Send back to requesting client only
        socket.emit('practiceText', {
            text
        });
    });
    
    // Handle race result sharing
    socket.on('shareResults', ({ platform }) => {
        const roomId = socket.roomId;
        
        // Check if user is in a room
        if (!roomId || !rooms.has(roomId)) return;
        
        const room = rooms.get(roomId);
        
        // Find player
        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;
        
        // Generate share URL based on platform
        let shareUrl = '';
        let shareText = `I just scored ${player.wpm} WPM in TypeRacer! Join me for a race: `;
        
        switch (platform) {
            case 'twitter':
                shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(`https://yourdomain.com/join/${roomId}`)}`;
                break;
            case 'facebook':
                shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://yourdomain.com/join/${roomId}`)}&quote=${encodeURIComponent(shareText)}`;
                break;
            case 'whatsapp':
                shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + `https://yourdomain.com/join/${roomId}`)}`;
                break;
            default:
                shareUrl = `https://yourdomain.com/join/${roomId}`;
                break;
        }
        
        // Send share URL back to client
        socket.emit('shareResultsUrl', {
            url: shareUrl,
            platform
        });
    });
    
    // Handle room rejoining after disconnection
    socket.on('rejoinRoom', ({ roomId, username }) => {
        console.log(`Player ${username} attempting to rejoin room ${roomId}`);
        
        // Check if room exists
        if (!rooms.has(roomId)) {
            socket.emit('roomRejoinResult', { 
                success: false,
                message: 'Room no longer exists'
            });
            return;
        }
        
        const room = rooms.get(roomId);
        
        // Check if username exists in this room and is not already connected
        const existingPlayerIndex = room.players.findIndex(p => p.username === username);
        if (existingPlayerIndex === -1) {
            socket.emit('roomRejoinResult', { 
                success: false,
                message: 'Player not found in this room'
            });
            return;
        }
        
        // Check if there's already an active socket with this player's ID
        const existingPlayer = room.players[existingPlayerIndex];
        const existingSocket = io.sockets.sockets.get(existingPlayer.id);
        
        if (existingSocket && existingSocket.connected) {
            socket.emit('roomRejoinResult', { 
                success: false,
                message: 'Player already connected in this room'
            });
            return;
        }
        
        // Update the player's socket ID
        existingPlayer.id = socket.id;
        
        // Check if player was the host
        if (existingPlayer.isHost) {
            room.host = socket.id;
        }
        
        // Add socket to room
        socket.join(roomId);
        
        // Set user's current room
        socket.roomId = roomId;
        
        // Send room info back to client
        socket.emit('roomRejoinResult', {
            success: true,
            roomId,
            isHost: existingPlayer.isHost,
            players: room.players,
            status: room.status,
            category: room.category,
            text: room.text,
            startTime: room.startTime
        });
        
        // Notify other players in the room
        socket.to(roomId).emit('playerRejoined', {
            players: room.players,
            username
        });
        
        // Update room activity timestamp
        updateRoomActivity(roomId);
        
        console.log(`Player ${username} successfully rejoined room ${roomId}`);
    });
    
    // Leave room
    socket.on('leaveRoom', () => {
        handlePlayerLeave(socket);
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        handlePlayerLeave(socket);
    });
    
    // Helper function to handle player leaving
    function handlePlayerLeave(socket) {
        const roomId = socket.roomId;
        
        // Check if user is in a room
        if (!roomId || !rooms.has(roomId)) return;
        
        const room = rooms.get(roomId);
        
        // Remove player from room
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
            const player = room.players[playerIndex];
            const wasHost = player.isHost;
            
            // Remove player from array
            room.players.splice(playerIndex, 1);
            
            // Leave the room
            socket.leave(roomId);
            socket.roomId = null;
            
            // Clear countdown interval if active
            if (room.countdownInterval) {
                clearInterval(room.countdownInterval);
                room.countdownInterval = null;
            }
            
            // If there are no players left, delete the room
            if (room.players.length === 0) {
                rooms.delete(roomId);
                console.log(`Room ${roomId} deleted (no players left)`);
                return;
            }
            
            // If the host left, assign a new host
            if (wasHost) {
                const newHost = room.players[0];
                newHost.isHost = true;
                room.host = newHost.id;
                
                // Notify the new host
                io.to(newHost.id).emit('hostChanged', {
                    isHost: true
                });
            }
            
            // Notify remaining players
            io.to(roomId).emit('playerLeft', {
                players: room.players,
                playerId: socket.id
            });
            
            console.log(`Player ${player.username} left room ${roomId}`);
        }
    }
});


// Add ping/pong handler to keep connections alive
io.on('connection', (socket) => {
    // ... your existing socket.io connection handling code ...
    
    // Add ping/pong handler to keep connection alive (important for serverless)
    socket.on('ping', (callback) => {
        // If callback exists, call it (acting as a pong response)
        if (typeof callback === 'function') {
            callback();
        } else {
            // Otherwise, emit a pong event
            socket.emit('pong');
        }
    });
    
    // ... rest of your socket handlers ...
});



// Modification for Vercel deployment
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

// For Vercel serverless deployment
module.exports = server;