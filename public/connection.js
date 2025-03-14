// Connection status management

// Create connection status indicator
document.addEventListener('DOMContentLoaded', () => {
    // Create indicator element
    const indicator = document.createElement('div');
    indicator.className = 'connection-status';
    document.body.appendChild(indicator);
    
    // Create connection interrupted message
    const interruptedMsg = document.createElement('div');
    interruptedMsg.className = 'connection-interrupted';
    interruptedMsg.textContent = 'Connection lost. Attempting to reconnect...';
    document.body.appendChild(interruptedMsg);
    
    // Create loading overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = `
        <div class="loading-spinner"></div>
        <div class="loading-text">Connecting to server...</div>
    `;
    document.body.appendChild(loadingOverlay);
    
    // Track connection state
    let isConnected = false;
    let connectionLost = false;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    
    // Socket.IO connection events
    socket.on('connect', () => {
        console.log('Connected to server');
        isConnected = true;
        connectionLost = false;
        reconnectAttempts = 0;
        
        // Update indicator
        indicator.classList.add('connected');
        
        // Hide interrupted message if visible
        interruptedMsg.classList.remove('visible');
        
        // Hide loading overlay after a short delay
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
        }, 500);
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        isConnected = false;
        
        // Update indicator
        indicator.classList.remove('connected');
        
        // Only show interrupted message if we were previously connected
        // (to avoid showing on initial load)
        if (connectionLost) {
            interruptedMsg.classList.add('visible');
        }
        
        connectionLost = true;
    });
    
    socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`Attempting to reconnect (${attemptNumber})`);
        reconnectAttempts = attemptNumber;
        
        // Show loading overlay after multiple failed attempts
        if (reconnectAttempts >= 3) {
            loadingOverlay.querySelector('.loading-text').textContent = 
                `Connection issues detected. Reconnecting (${reconnectAttempts}/${maxReconnectAttempts})...`;
            loadingOverlay.style.display = 'flex';
        }
    });
    
    socket.on('reconnect_failed', () => {
        console.log('Failed to reconnect after multiple attempts');
        
        // Update loading overlay
        loadingOverlay.querySelector('.loading-spinner').style.display = 'none';
        loadingOverlay.querySelector('.loading-text').textContent = 
            'Connection failed. Please refresh the page to try again.';
    });
    
    socket.on('reconnect', (attemptNumber) => {
        console.log(`Reconnected after ${attemptNumber} attempts`);
        
        // Check if we need to rejoin the room
        if (gameState.roomId) {
            // If we were in a room, try to rejoin
            socket.emit('rejoinRoom', {
                roomId: gameState.roomId,
                username: gameState.username
            });
        }
    });
    
    // Add custom event for room rejoining result
    socket.on('roomRejoinResult', (data) => {
        if (data.success) {
            console.log('Successfully rejoined room');
            
            // Update game state with latest data
            gameState.players = data.players;
            gameState.isHost = data.isHost;
            
            // Update UI
            updatePlayersList();
            
            // Show appropriate screen based on room status
            if (data.status === 'waiting') {
                showScreen('lobby');
            } else if (data.status === 'racing') {
                // If race is in progress, join as spectator
                showScreen('race');
                typingInput.disabled = true;
                typingInput.placeholder = "Race in progress, you're now spectating...";
            } else if (data.status === 'finished') {
                showScreen('results');
            }
            
            // Show notification
            showNotification('Reconnected successfully');
        } else {
            console.log('Failed to rejoin room');
            
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
            
            // Show error notification
            showNotification('Could not rejoin previous room');
        }
    });
});