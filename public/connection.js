document.addEventListener('DOMContentLoaded', () => {
    // Use more resilient Socket.IO initialization with explicit options
    const socket = io({
        reconnection: true,
        reconnectionAttempts: 10, // Increase from 5 to 10
        reconnectionDelay: 1000, // Start with a shorter delay
        reconnectionDelayMax: 5000, // Cap at 5 seconds
        timeout: 10000, // Connection timeout
        autoConnect: true,
        transports: ['websocket', 'polling'] // Try websocket first, fallback to polling
    });
    
    console.log('Socket.IO initialized with enhanced reconnection settings');
    
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
    const maxReconnectAttempts = 10; // Increased from 5
    let pingInterval = null;
    let reconnectTimer = null;
    
    // Socket.IO connection events
    socket.on('connect', () => {
        console.log('Connected to server');
        isConnected = true;
        connectionLost = false;
        reconnectAttempts = 0;
        
        // Clear any pending reconnect timers
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        
        // Start the ping interval with a more frequent rate
        startPingInterval();
        
        // Update indicator
        indicator.classList.add('connected');
        
        // Hide interrupted message if visible
        interruptedMsg.classList.remove('visible');
        
        // Hide loading overlay after a short delay
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
        }, 500);
        
        // If we were in a room, attempt to rejoin
        if (gameState?.roomId && gameState?.username) {
            // Try to rejoin the room
            socket.emit('rejoinRoom', {
                roomId: gameState.roomId,
                username: gameState.username
            });
        }
    });
    
    socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        isConnected = false;
        
        // Handle specific disconnect reasons
        if (reason === 'io server disconnect') {
            // Server disconnected us, need to manually reconnect
            console.log('Server initiated disconnect, attempting manual reconnect');
            socket.connect();
        }
        
        // Update indicator
        indicator.classList.remove('connected');
        
        // Only show interrupted message if we were previously connected
        if (connectionLost) {
            interruptedMsg.classList.add('visible');
        }
        
        connectionLost = true;
        
        // Stop ping interval when disconnected
        if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
        }
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
        
        // Add a manual reconnect button
        const reconnectButton = document.createElement('button');
        reconnectButton.className = 'reconnect-button';
        reconnectButton.textContent = 'Try Again';
        reconnectButton.addEventListener('click', () => {
            // Reset reconnect attempts
            reconnectAttempts = 0;
            
            // Show spinner again
            loadingOverlay.querySelector('.loading-spinner').style.display = 'block';
            loadingOverlay.querySelector('.loading-text').textContent = 'Connecting to server...';
            
            // Manually attempt to reconnect
            socket.connect();
        });
        
        // Add button to overlay
        loadingOverlay.appendChild(reconnectButton);
    });
    
    socket.on('reconnect', (attemptNumber) => {
        console.log(`Reconnected after ${attemptNumber} attempts`);
        // Connection re-established, socket.on('connect') will handle the rest
    });
    
    socket.on('connect_error', (error) => {
        console.log('Connection error:', error);
        
        // If we get a transport error, force fallback to polling
        if (error.message && error.message.includes('websocket')) {
            console.log('WebSocket error, falling back to polling');
            socket.io.opts.transports = ['polling', 'websocket'];
        }
        
        // If we're not reconnecting automatically, schedule a manual reconnect
        if (!socket.io.reconnecting && reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = Math.min(1000 * reconnectAttempts, 5000);
            
            console.log(`Scheduling manual reconnect in ${delay}ms`);
            
            reconnectTimer = setTimeout(() => {
                console.log('Attempting manual reconnect');
                socket.connect();
            }, delay);
        }
    });
    
    // Add error handling for socket.io error events
    socket.on('error', (error) => {
        console.error('Socket.IO error:', error);
    });
    
    // Function to start the ping interval to keep connection alive
    function startPingInterval() {
        // Clear any existing interval
        if (pingInterval) {
            clearInterval(pingInterval);
        }

        // Start a new ping interval - send ping every 10 seconds (more frequent)
        pingInterval = setInterval(() => {
            if (socket.connected) {
                // Send ping with timeout to detect stalled connections
                const pingTimeout = setTimeout(() => {
                    console.log('Ping timed out, connection may be stalled');
                    // If ping times out, the connection might be stalled
                    // Force a reconnection
                    socket.disconnect().connect();
                }, 5000);
                
                socket.emit('ping', () => {
                    // Pong received, connection is still good
                    clearTimeout(pingTimeout);
                });
            } else if (reconnectAttempts < maxReconnectAttempts) {
                // If not connected and under max attempts, try reconnecting
                socket.connect();
            }
        }, 10000);
    }

    // Make socket available globally (needed for your other scripts)
    window.socket = socket;
});