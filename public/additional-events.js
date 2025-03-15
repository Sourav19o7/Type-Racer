// Add additional client-side event handlers
// Include this file after script.js

// Handle player rejoining event
socket.on('playerRejoined', (data) => {
    // Update players list
    gameState.players = data.players;
    updatePlayersList();
    
    // Show notification
    showNotification(`${data.username} reconnected`);
});

// Handle when races are inactive too long
socket.on('roomInactive', () => {
    // Show notification
    showNotification('This room will be closed soon due to inactivity');
    
    // Show warning in UI
    const inactiveWarning = document.createElement('div');
    inactiveWarning.className = 'error-message';
    inactiveWarning.innerHTML = '<span class="material-icons">timer_off</span> This room is inactive and will close soon. Start a race to keep it alive.';
    
    // Add warning to appropriate screen
    if (gameState.currentScreen === 'lobby') {
        document.querySelector('.card').prepend(inactiveWarning);
    } else if (gameState.currentScreen === 'results') {
        document.querySelector('.result-card').prepend(inactiveWarning);
    }
});

// Handle race stats updates
socket.on('raceStats', (data) => {
    // If we're on the results screen, show global stats
    if (gameState.currentScreen === 'results') {
        const statsContainer = document.createElement('div');
        statsContainer.className = 'global-stats';
        statsContainer.innerHTML = `
            <h3>Global Stats</h3>
            <p>Total races completed: ${data.totalRaces}</p>
            <p>Average WPM across all players: ${data.averageWpm.toFixed(1)}</p>
            <p>Highest WPM: ${data.highestWpm} by ${data.fastestPlayer}</p>
        `;
        
        // Add after results table
        const resultsTable = document.querySelector('.results-table');
        resultsTable.parentNode.insertBefore(statsContainer, resultsTable.nextSibling);
    }
});

// Add these additional Socket.IO event handlers to your server.js file

// Handle player typing event
socket.on('playerTyping', () => {
    const roomId = socket.roomId;
    
    // Check if user is in a room
    if (!roomId || !rooms.has(roomId)) return;
    
    // Notify other players in the room
    socket.to(roomId).emit('playerTyping', {
        playerId: socket.id
    });
});

// Handle force finish race (timeout)
socket.on('forceFinishRace', () => {
    const roomId = socket.roomId;
    
    // Check if user is in a room
    if (!roomId || !rooms.has(roomId)) return;
    
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
    
    // Force finish race
    room.status = 'finished';
    
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
        forcedByHost: true
    });
    
    // Update race stats
    updateRaceStats(room);
    
    console.log(`Race in room ${roomId} force finished by host`);
});

// Handle kick player (host only)
socket.on('kickPlayer', ({ playerId }) => {
    const roomId = socket.roomId;
    
    // Check if user is in a room
    if (!roomId || !rooms.has(roomId)) return;
    
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
    
    console.log(`Player ${kickedUsername} kicked from room ${roomId} by host`);
});

// Handle room lock/unlock (host only)
socket.on('toggleRoomLock', ({ locked }) => {
    const roomId = socket.roomId;
    
    // Check if user is in a room
    if (!roomId || !rooms.has(roomId)) return;
    
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
    
    console.log(`Room ${roomId} ${locked ? 'locked' : 'unlocked'} by host`);
});

// When joining, check if room is locked
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
    
    // Continue with existing join logic...
});

// Handle player ready status
socket.on('toggleReady', ({ ready }) => {
    const roomId = socket.roomId;
    
    // Check if user is in a room
    if (!roomId || !rooms.has(roomId)) return;
    
    const room = rooms.get(roomId);
    
    // Find player
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    
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
            // Double-check that everyone is still ready
            if (rooms.has(roomId) && 
                rooms.get(roomId).status === 'waiting' && 
                rooms.get(roomId).players.every(p => p.isReady)) {
                
                // Start the race countdown
                startRaceCountdown(room, roomId);
            }
        }, 2000);
    }
});

// Extract race start logic into a reusable function
function startRaceCountdown(room, roomId) {
    // Select a random text based on category
    room.text = getRandomText(room.category);
    
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
            
            console.log(`Race started in room ${roomId}`);
        }
    }, 1000);
    
    console.log(`Race countdown started in room ${roomId}`);
}

// Handle client requests for text practice
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
            shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(`https://type-racer-ho3m.onrender.com/join/${roomId}`)}`;
            break;
        case 'facebook':
            shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://type-racer-ho3m.onrender.com/join/${roomId}`)}&quote=${encodeURIComponent(shareText)}`;
            break;
        case 'whatsapp':
            shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + `https://type-racer-ho3m.onrender.com/join/${roomId}`)}`;
            break;
        default:
            shareUrl = `https://type-racer-ho3m.onrender.com/join/${roomId}`;
            break;
    }
    
    // Send share URL back to client
    socket.emit('shareResultsUrl', {
        url: shareUrl,
        platform
    });
});

// Handle voice chat toggle
socket.on('toggleVoiceChat', ({ enabled }) => {
    const roomId = socket.roomId;
    
    // Check if user is in a room
    if (!roomId || !rooms.has(roomId)) return;
    
    const room = rooms.get(roomId);
    
    // Check if user is the host
    if (socket.id !== room.host) {
        socket.emit('error', { message: 'Only the host can toggle voice chat' });
        return;
    }
    
    // Update room voice chat status
    room.voiceChatEnabled = enabled;
    
    // Notify all players in the room
    io.to(roomId).emit('voiceChatChanged', {
        enabled
    });
    
    console.log(`Voice chat ${enabled ? 'enabled' : 'disabled'} in room ${roomId} by host`);
});

// Handle custom text submission
socket.on('submitCustomText', ({ text }) => {
    const roomId = socket.roomId;
    
    // Check if user is in a room
    if (!roomId || !rooms.has(roomId)) return;
    
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
    
    console.log(`Custom text submitted in room ${roomId} by host`);
});

// Handle race timeout setting
socket.on('setRaceTimeout', ({ timeout }) => {
    const roomId = socket.roomId;
    
    // Check if user is in a room
    if (!roomId || !rooms.has(roomId)) return;
    
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
    
    console.log(`Race timeout set to ${timeout} seconds in room ${roomId} by host`);
});

// Add race auto-finish timer when race starts
socket.on('startRace', () => {
    const roomId = socket.roomId;
    
    // Check if user is in a room
    if (!roomId || !rooms.has(roomId)) return;
    
    const room = rooms.get(roomId);
    
    // Check if user is the host
    if (socket.id !== room.host) return;
    
    // When race starts, set a timeout to automatically finish
    // This will be triggered in startRaceCountdown function
    
    // Modify the startRaceCountdown function to include timeout
    // (This modification should be done above where startRaceCountdown is defined)
    
    /*
    // Add this at the end of the startRaceCountdown function:
    
    // Set a timeout to automatically finish the race
    if (room.raceTimeout) {
        room.raceTimeoutTimer = setTimeout(() => {
            // Only force finish if race is still in progress
            if (room.status === 'racing') {
                // Force finish the race
                forceFinishRace(room, roomId);
            }
        }, room.raceTimeout * 1000);
    }
    */
});

// Add a function for force-finishing a race
function forceFinishRace(room, roomId) {
    // Set room status to finished
    room.status = 'finished';
    
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

// Format time helper (mm:ss)
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Enhance typing input to notify others
typingInput.addEventListener('input', (e) => {
    // Notify other players that this player is typing
    if (!gameState.isRaceComplete && gameState.raceStartTime) {
        socket.emit('playerTyping');
    }
});

// Add race countdown audio
let countdownAudio;

function createCountdownAudio() {
    // Create audio context
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();
    
    // Create oscillator
    const oscillator = audioCtx.createOscillator();
    oscillator.type = 'sine';
    
    // Create gain node for volume control
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.2; // Low volume
    
    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    return {
        highBeep() {
            oscillator.frequency.value = 880; // A5
            oscillator.start();
            setTimeout(() => oscillator.stop(), 200);
        },
        lowBeep() {
            oscillator.frequency.value = 440; // A4
            oscillator.start();
            setTimeout(() => oscillator.stop(), 200);
        }
    };
}

// Play countdown sounds
socket.on('raceCountdown', () => {
    // Create audio if not exists
    if (!countdownAudio) {
        try {
            countdownAudio = createCountdownAudio();
        } catch (error) {
            console.log('Audio not supported');
        }
    }
    
    // Play low beep for initial countdown
    if (countdownAudio) {
        countdownAudio.lowBeep();
    }
});

socket.on('raceCountdownUpdate', (data) => {
    // Play low beep for countdown
    if (countdownAudio) {
        countdownAudio.lowBeep();
    }
});

socket.on('raceStarted', () => {
    // Play high beep for race start
    if (countdownAudio) {
        countdownAudio.highBeep();
    }
});

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Alt+C to copy room code when in lobby
    if (e.altKey && e.key === 'c' && gameState.currentScreen === 'lobby') {
        navigator.clipboard.writeText(gameState.roomId)
            .then(() => {
                showNotification('Room ID copied to clipboard');
            })
            .catch(() => {
                showNotification('Failed to copy room ID');
            });
    }
    
    // Alt+S to start race (host only)
    if (e.altKey && e.key === 's' && gameState.currentScreen === 'lobby' && gameState.isHost) {
        socket.emit('startRace');
    }
    
    // Escape to leave room
    if (e.key === 'Escape' && gameState.currentScreen === 'lobby') {
        if (confirm('Are you sure you want to leave this room?')) {
            socket.emit('leaveRoom');
            
            // Reset game state
            gameState = {
                currentScreen: 'home',
                roomId: '',
                players: [],
                isHost: false,
                username: '',
                selectedText: '',
                raceStartTime: null,
                raceEndTime: null,
                currentWordIndex: 0,
                currentCharIndex: 0,
                errors: 0,
                totalCharacters: 0,
                completedWords: 0,
                isRaceComplete: false,
                timerInterval: null
            };
            
            // Go back to home screen
            showScreen('home');
        }
    }
});

// Player container functionality
document.addEventListener('DOMContentLoaded', function() {
    const playersContainer = document.getElementById('players-container');
    
    // Example player data (in a real app, this would come from your socket connection)
    const examplePlayers = [
        { id: 'player1', name: 'RacingQueen', isHost: true, isReady: true, avatar: 'R' },
        { id: 'player2', name: 'SpeedDemon', isHost: false, isReady: true, avatar: 'S' },
        { id: 'player3', name: 'KeyboardWarrior', isHost: false, isReady: false, avatar: 'K' },
        { id: 'player4', name: 'TypeMaster3000', isHost: false, isReady: false, avatar: 'T' }
    ];
    
    // Function to render a player item
    function renderPlayerItem(player) {
        const playerElement = document.createElement('li');
        playerElement.id = `player-${player.id}`;
        playerElement.classList.add('player-item');
        
        if (player.isReady) {
            playerElement.classList.add('ready');
        }
        
        if (player.isHost) {
            playerElement.classList.add('host');
        }
        
        playerElement.innerHTML = `
            <div class="player-avatar">${player.avatar}</div>
            <div class="player-info">
                <div class="player-info-row">
                    <div class="player-name">${player.name}</div>
                    ${player.isHost ? '<span class="host-badge">Host</span>' : ''}
                </div>
                <div class="player-status">
                    <span class="player-connection">Connected</span>
                </div>
            </div>
            <div class="player-metadata">
                ${player.isReady ? 
                    '<div class="ready-indicator"><span class="material-icons">check_circle</span>Ready</div>' : 
                    '<div class="waiting-indicator"></div>'}
            </div>
        `;
        
        return playerElement;
    }
    
    // Function to render all players
    function renderPlayers(players) {
        // Clear existing players
        playersContainer.innerHTML = '';
        
        // Add each player
        players.forEach(player => {
            const playerElement = renderPlayerItem(player);
            playersContainer.appendChild(playerElement);
        });
    }
    
    // Initial render
    renderPlayers(examplePlayers);
    
    // Example of adding a player (in real app, this would be triggered by socket event)
    window.addPlayer = function(player) {
        const playerElement = renderPlayerItem(player);
        // Set initial opacity to 0 for animation
        playerElement.style.opacity = '0';
        playersContainer.appendChild(playerElement);
        
        // Force reflow
        void playerElement.offsetWidth;
        
        // Reset opacity to trigger animation
        playerElement.style.opacity = '';
    };
    
    // Example of removing a player (in real app, this would be triggered by socket event)
    window.removePlayer = function(playerId) {
        const playerElement = document.getElementById(`player-${playerId}`);
        if (playerElement) {
            playerElement.classList.add('leaving');
            setTimeout(() => {
                playerElement.remove();
            }, 300); // Match animation duration
        }
    };
    
    // Example of updating player status (in real app, this would be triggered by socket event)
    window.updatePlayerStatus = function(playerId, isReady) {
        const playerElement = document.getElementById(`player-${playerId}`);
        if (playerElement) {
            if (isReady) {
                playerElement.classList.add('ready');
                const metadataDiv = playerElement.querySelector('.player-metadata');
                metadataDiv.innerHTML = '<div class="ready-indicator"><span class="material-icons">check_circle</span>Ready</div>';
            } else {
                playerElement.classList.remove('ready');
                const metadataDiv = playerElement.querySelector('.player-metadata');
                metadataDiv.innerHTML = '<div class="waiting-indicator"></div>';
            }
        }
    };
    
    // No demo controls - removed as requested
});

// Add keyboard shortcuts tooltip
document.addEventListener('DOMContentLoaded', () => {
    const shortcutsTooltip = document.createElement('div');
    shortcutsTooltip.className = 'shortcuts-tooltip';
    shortcutsTooltip.innerHTML = `
        <div class="tooltip-title">Keyboard Shortcuts</div>
        <div class="shortcut"><span>Alt+C</span> Copy room ID</div>
        <div class="shortcut"><span>Alt+S</span> Start race (host only)</div>
        <div class="shortcut"><span>Esc</span> Leave room</div>
    `;
    document.body.appendChild(shortcutsTooltip);
    
    // Add tooltip styles
    const style = document.createElement('style');
    style.textContent = `
        .shortcuts-tooltip {
            position: fixed;
            bottom: 10px;
            left: 10px;
            background-color: var(--bg-card);
            border-radius: var(--radius-md);
            padding: 10px;
            box-shadow: var(--shadow-md);
            font-size: 0.8rem;
            z-index: 1000;
            opacity: 0.2;
            transition: opacity 0.3s ease;
        }
        
        .shortcuts-tooltip:hover {
            opacity: 1;
        }
        
        .tooltip-title {
            font-weight: 600;
            margin-bottom: 5px;
            color: var(--primary);
        }
        
        .shortcut {
            display: flex;
            justify-content: space-between;
            margin: 3px 0;
        }
        
        .shortcut span {
            background-color: var(--bg-input);
            padding: 2px 5px;
            border-radius: 3px;
            margin-right: 5px;
            font-weight: 500;
        }
    `;
    document.head.appendChild(style);
});