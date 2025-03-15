// Connect to Socket.IO server
const socket = io();

// DOM Elements
const screens = {
    home: document.getElementById('home-screen'),
    lobby: document.getElementById('lobby-screen'),
    countdown: document.getElementById('countdown-screen'),
    race: document.getElementById('race-screen'),
    results: document.getElementById('results-screen')
};

// Form inputs
const usernameInput = document.getElementById('username-input');
const roomIdInput = document.getElementById('room-id-input');
const textCategorySelect = document.getElementById('text-category');
const typingInput = document.getElementById('typing-input');

// Buttons
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const startRaceBtn = document.getElementById('start-race-btn');
const leaveLobbyBtn = document.getElementById('leave-lobby-btn');
const copyRoomIdBtn = document.getElementById('copy-room-id');
const backToLobbyBtn = document.getElementById('back-to-lobby-btn');
const newRaceBtn = document.getElementById('new-race-btn');

// Display elements
const roomIdDisplay = document.getElementById('room-id-display');
const playersContainer = document.getElementById('players-container');
const countdownDisplay = document.getElementById('countdown');
const raceTextDisplay = document.getElementById('race-text');
const timerDisplay = document.getElementById('timer');
const wpmDisplay = document.getElementById('wpm');
const accuracyDisplay = document.getElementById('accuracy');
const progressBarsContainer = document.getElementById('progress-bars');
const resultsTableBody = document.getElementById('results-table-body');
const firstPlacePlayer = document.getElementById('first-place-player');
const secondPlacePlayer = document.getElementById('second-place-player');
const thirdPlacePlayer = document.getElementById('third-place-player');

// Additional element references
const customTextContainer = document.getElementById('custom-text-container');
const customTextInput = document.getElementById('custom-text-input');
const submitCustomTextBtn = document.getElementById('submit-custom-text');
const toggleLockBtn = document.getElementById('toggle-lock-btn');
const toggleReadyBtn = document.getElementById('toggle-ready-btn');
const raceTimeoutInput = document.getElementById('race-timeout');
const forceFinishBtn = document.getElementById('force-finish-btn');
const hostRaceControls = document.getElementById('host-race-controls');
const roomControls = document.getElementById('room-controls');

// Social sharing buttons
const shareTwitterBtn = document.getElementById('share-twitter');
const shareFacebookBtn = document.getElementById('share-facebook');
const shareWhatsappBtn = document.getElementById('share-whatsapp');

// Game state
let gameState = {
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

// Helper Functions
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function calculateWPM(charCount, seconds) {
    // Average word length is considered to be 5 characters
    const words = charCount / 5;
    const minutes = seconds / 60;
    return Math.round(words / minutes);
}

function calculateAccuracy(errors, totalChars) {
    if (totalChars === 0) return 100;
    return Math.round((1 - errors / totalChars) * 100);
}

function showScreen(screenName) {
    // Hide all screens
    Object.values(screens).forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show the requested screen
    screens[screenName].classList.add('active');
    gameState.currentScreen = screenName;
    
    // Special screen initialization
    if (screenName === 'race') {
        typingInput.focus();
        typingInput.value = '';
        
        // Show host controls if host
        if (gameState.isHost) {
            hostRaceControls.style.display = 'block';
        } else {
            hostRaceControls.style.display = 'none';
        }
    }
    
    // Apply special behavior for lobby screen
    if (screenName === 'lobby') {
        // Show host controls
        if (gameState.isHost) {
            startRaceBtn.style.display = 'block';
            raceTimeoutInput.disabled = false;
            toggleLockBtn.style.display = 'block';
            textCategorySelect.disabled = false;
            document.querySelector('.select-wrapper').classList.remove('disabled');
        } else {
            startRaceBtn.style.display = 'none';
            raceTimeoutInput.disabled = true;
            toggleLockBtn.style.display = 'none';
            textCategorySelect.disabled = true;
            document.querySelector('.select-wrapper').classList.add('disabled');
        }
        
        // Init custom text container visibility
        if (textCategorySelect.value === 'custom') {
            customTextContainer.style.display = 'block';
        } else {
            customTextContainer.style.display = 'none';
        }
    }
}

function levenshteinDistance(a, b) {
    const matrix = [];
    
    // Initialize matrix
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }
    
    return matrix[b.length][a.length];
}

// UI Update Functions
function updateRaceText() {
    const words = gameState.selectedText.split(' ');
    let html = '';
    
    words.forEach((word, wordIndex) => {
        if (wordIndex < gameState.currentWordIndex) {
            // Completed words
            html += `<span class="typed">${word}</span> `;
        } else if (wordIndex === gameState.currentWordIndex) {
            // Current word
            let currentWordHtml = '';
            
            for (let i = 0; i < word.length; i++) {
                if (i < gameState.currentCharIndex) {
                    // Typed characters
                    currentWordHtml += `<span class="typed">${word[i]}</span>`;
                } else if (i === gameState.currentCharIndex) {
                    // Current character
                    currentWordHtml += `<span class="current">${word[i]}</span>`;
                } else {
                    // Upcoming characters
                    currentWordHtml += word[i];
                }
            }
            
            html += `${currentWordHtml} `;
        } else {
            // Upcoming words
            html += `${word} `;
        }
    });
    
    raceTextDisplay.innerHTML = html;
}

function updateProgressBars() {
    progressBarsContainer.innerHTML = '';
    
    gameState.players.forEach(player => {
        const playerInitial = player.username.charAt(0).toUpperCase();
        const isCurrentPlayer = player.id === socket.id ? 'current-player' : '';
        const typingIndicator = player.isTyping ? `<span class="typing-indicator"><span class="material-icons">keyboard</span></span>` : '';
        const finishedIndicator = player.finished ? `<span class="finished-icon"><span class="material-icons">emoji_events</span></span>` : '';
        
        const progressBar = `
            <div class="progress-bar ${isCurrentPlayer}">
                <div class="player-info">
                    <div class="player-avatar">${playerInitial}</div>
                    <div class="player-name">${player.username}</div>
                    ${typingIndicator}
                    ${finishedIndicator}
                </div>
                <div class="progress-track">
                    <div class="progress-fill" style="width: ${player.progress}%"></div>
                </div>
                <div class="progress-percentage">${player.progress}%</div>
            </div>
        `;
        
        progressBarsContainer.innerHTML += progressBar;
    });
}

function updatePlayersList() {
    // Check if playersContainer exists to prevent potential errors
    if (!playersContainer) {
        console.error('Players container not found');
        return;
    }

    // Use document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    gameState.players.forEach(player => {
        // Safely handle username
        const username = player.username || 'Anonymous';
        const playerInitial = username.charAt(0).toUpperCase();
        
        // Create player list item element
        const playerItem = document.createElement('li');
        
        // Add ready state class
        if (player.isReady) {
            playerItem.classList.add('ready');
        }
        
        // Create player content with updated UI
        playerItem.innerHTML = `
            <div class="player-avatar">${playerInitial}</div>
            <div class="player-name">${username}</div>
            ${player.isHost ? '<span class="host-badge">Host</span>' : ''}
            ${player.isReady ? '<span class="ready-indicator"><span class="material-icons">check_circle</span></span>' : ''}
            ${gameState.isHost && player.id !== socket.id ? 
                `<button class="icon-btn small kick-player" data-player-id="${player.id}" title="Kick Player">
                    <span class="material-icons">person_remove</span>
                </button>` : ''}
        `;
        
        // Add kick event listener if applicable
        if (gameState.isHost && player.id !== socket.id) {
            const kickButton = playerItem.querySelector('.kick-player');
            if (kickButton) {
                kickButton.addEventListener('click', function() {
                    const playerId = this.getAttribute('data-player-id');
                    if (confirm('Are you sure you want to kick this player?')) {
                        socket.emit('kickPlayer', { playerId });
                    }
                });
            }
        }
        
        // Append to fragment
        fragment.appendChild(playerItem);
    });
    
    // Clear and append all players at once
    playersContainer.innerHTML = '';
    playersContainer.appendChild(fragment);
}

function updateRaceStats() {
    if (!gameState.raceStartTime) return;
    
    const currentTime = new Date().getTime();
    const elapsedSeconds = Math.floor((currentTime - gameState.raceStartTime) / 1000);
    
    // Update timer
    timerDisplay.textContent = formatTime(elapsedSeconds);
    
    // Update WPM
    const wpm = calculateWPM(gameState.totalCharacters, elapsedSeconds);
    wpmDisplay.textContent = `${wpm} WPM`;
    
    // Update accuracy
    const accuracy = calculateAccuracy(gameState.errors, gameState.totalCharacters + gameState.errors);
    accuracyDisplay.textContent = `${accuracy}%`;
    
    // Send progress update to server
    const progress = Math.round((gameState.completedWords / gameState.selectedText.split(' ').length) * 100);
    socket.emit('updateProgress', {
        progress,
        wpm,
        accuracy
    });
}

function updateResultsScreen() {
    // Sort players by WPM (highest first)
    const sortedPlayers = [...gameState.players]
        .filter(player => player.finished)
        .sort((a, b) => b.wpm - a.wpm);
    
    // Update podium
    if (sortedPlayers.length >= 1) {
        const first = sortedPlayers[0];
        firstPlacePlayer.querySelector('.avatar').textContent = first.username.charAt(0).toUpperCase();
        firstPlacePlayer.querySelector('.name').textContent = first.username;
        firstPlacePlayer.querySelector('.wpm').textContent = `${first.wpm} WPM`;
    } else {
        // Hide first place if no finishers
        firstPlacePlayer.style.visibility = 'hidden';
    }
    
    if (sortedPlayers.length >= 2) {
        const second = sortedPlayers[1];
        secondPlacePlayer.querySelector('.avatar').textContent = second.username.charAt(0).toUpperCase();
        secondPlacePlayer.querySelector('.name').textContent = second.username;
        secondPlacePlayer.querySelector('.wpm').textContent = `${second.wpm} WPM`;
        secondPlacePlayer.style.visibility = 'visible';
    } else {
        // Hide second place if less than 2 finishers
        secondPlacePlayer.style.visibility = 'hidden';
    }
    
    if (sortedPlayers.length >= 3) {
        const third = sortedPlayers[2];
        thirdPlacePlayer.querySelector('.avatar').textContent = third.username.charAt(0).toUpperCase();
        thirdPlacePlayer.querySelector('.name').textContent = third.username;
        thirdPlacePlayer.querySelector('.wpm').textContent = `${third.wpm} WPM`;
        thirdPlacePlayer.style.visibility = 'visible';
    } else {
        // Hide third place if less than 3 finishers
        thirdPlacePlayer.style.visibility = 'hidden';
    }
    
    // Update results table
    resultsTableBody.innerHTML = '';
    
    // Show all players in the table, even non-finishers
    const allPlayers = [...gameState.players].sort((a, b) => {
        // Finishers first, sorted by WPM
        if (a.finished && b.finished) return b.wpm - a.wpm;
        if (a.finished) return -1;
        if (b.finished) return 1;
        // Non-finishers sorted by progress
        return b.progress - a.progress;
    });
    
    allPlayers.forEach((player, index) => {
        const row = `
            <tr class="${player.finished ? 'finished' : ''}">
                <td>${index + 1}</td>
                <td>${player.username}${player.isHost ? ' (Host)' : ''}</td>
                <td>${player.wpm}</td>
                <td>${player.accuracy}%</td>
                <td>${player.finishTime || (player.progress < 100 ? `${player.progress}%` : '-')}</td>
            </tr>
        `;
        resultsTableBody.innerHTML += row;
    });
    
    // Setup share buttons
    setupShareButtons();
}

// Social sharing setup
function setupShareButtons() {
    // Find current player
    const player = gameState.players.find(p => p.id === socket.id);
    if (!player) return;
    
    // Twitter share
    shareTwitterBtn.addEventListener('click', () => {
        socket.emit('shareResults', { platform: 'twitter' });
    });
    
    // Facebook share
    shareFacebookBtn.addEventListener('click', () => {
        socket.emit('shareResults', { platform: 'facebook' });
    });
    
    // WhatsApp share
    shareWhatsappBtn.addEventListener('click', () => {
        socket.emit('shareResults', { platform: 'whatsapp' });
    });
}

// Socket.IO Event Handlers

socket.on('roomCreated', (data) => {
    gameState.roomId = data.roomId;
    gameState.isHost = data.isHost;
    gameState.players = data.players;
    
    // Update UI
    roomIdDisplay.textContent = data.roomId;
    updatePlayersList();
    
    // Show/hide host-only controls
    startRaceBtn.style.display = data.isHost ? 'block' : 'none';
    
    // Show lobby screen
    showScreen('lobby');
});

socket.on('roomJoined', (data) => {
    gameState.roomId = data.roomId;
    gameState.isHost = data.isHost;
    gameState.players = data.players;
    gameState.category = data.category;
    
    // Update UI
    roomIdDisplay.textContent = data.roomId;
    textCategorySelect.value = data.category;
    updatePlayersList();
    
    // Show/hide host-only controls
    startRaceBtn.style.display = data.isHost ? 'block' : 'none';
    
    // Show lobby screen
    showScreen('lobby');
});

socket.on('playerJoined', (data) => {
    // Update players list
    gameState.players = data.players;
    updatePlayersList();
    
    // Show notification
    showNotification(`${data.players[data.players.length - 1].username} joined`);
});

socket.on('categoryUpdated', (data) => {
    // Update category select
    textCategorySelect.value = data.category;
    
    // Show/hide custom text container
    if (data.category === 'custom') {
        customTextContainer.style.display = 'block';
    } else {
        customTextContainer.style.display = 'none';
    }
});

socket.on('error', (data) => {
    // Show error message
    alert(data.message);
});

socket.on('raceCountdown', (data) => {
    // Store race text
    gameState.selectedText = data.text;
    
    // Reset race state
    gameState.currentWordIndex = 0;
    gameState.currentCharIndex = 0;
    gameState.errors = 0;
    gameState.totalCharacters = 0;
    gameState.completedWords = 0;
    gameState.isRaceComplete = false;
    
    // Show countdown screen
    showScreen('countdown');
    countdownDisplay.textContent = data.countdown;
});

socket.on('raceCountdownUpdate', (data) => {
    // Update countdown
    countdownDisplay.textContent = data.countdown;
});

socket.on('raceStarted', (data) => {
    // Store race start time
    gameState.raceStartTime = data.startTime;
    
    // Show race screen
    showScreen('race');
    
    // Set up race text
    updateRaceText();
    
    // Initialize progress bars
    updateProgressBars();
    
    // Start stats update interval
    gameState.timerInterval = setInterval(updateRaceStats, 1000);
});

socket.on('progressUpdated', (data) => {
    // Find player in game state and update their progress
    const player = gameState.players.find(p => p.id === data.playerId);
    if (player) {
        player.progress = data.progress;
        player.wpm = data.wpm;
        player.accuracy = data.accuracy;
        
        // Update progress bars
        updateProgressBars();
    }
});

socket.on('playerFinished', (data) => {
    // Find player and update their stats
    const player = gameState.players.find(p => p.id === data.playerId);
    if (player) {
        player.progress = 100;
        player.wpm = data.wpm;
        player.accuracy = data.accuracy;
        player.finished = true;
        player.finishTime = data.time;
        
        // Update progress bars
        updateProgressBars();
        
        // Show notification
        if (player.id !== socket.id) {
            // Only show notification for other players
            showNotification(`${player.username} finished with ${data.wpm} WPM!`);
        }
    }
});

socket.on('raceCompleted', (data) => {
    // Update players data
    gameState.players = data.players;
    
    // Clear timer interval
    clearInterval(gameState.timerInterval);
    
    // Update results screen and show it
    updateResultsScreen();
    showScreen('results');
    
    // Show notification if race was forced
    if (data.forcedByHost) {
        showNotification('Race was ended by the host');
    } else if (data.forcedByTimeout) {
        showNotification('Race ended due to time limit');
    }
});

socket.on('resetRace', (data) => {
    // Update players
    gameState.players = data.players;
    
    // Clear race state
    gameState.selectedText = '';
    gameState.raceStartTime = null;
    gameState.raceEndTime = null;
    gameState.currentWordIndex = 0;
    gameState.currentCharIndex = 0;
    gameState.errors = 0;
    gameState.totalCharacters = 0;
    gameState.completedWords = 0;
    gameState.isRaceComplete = false;
    
    // Clear timer interval if still active
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
    
    // Update UI
    updatePlayersList();
    
    // Show lobby screen
    showScreen('lobby');
});

socket.on('playerLeft', (data) => {
    // Update players
    gameState.players = data.players;
    
    // Update UI
    updatePlayersList();
    
    // Update progress bars if in race
    if (gameState.currentScreen === 'race') {
        updateProgressBars();
    }
    
    // Show notification
    showNotification(`${data.username} left the room`);
});

socket.on('hostChanged', (data) => {
    // Update host status
    gameState.isHost = data.isHost;
    
    // Show/hide host-only controls based on current screen
    if (gameState.currentScreen === 'lobby') {
        startRaceBtn.style.display = data.isHost ? 'block' : 'none';
        raceTimeoutInput.disabled = !data.isHost;
        toggleLockBtn.style.display = data.isHost ? 'block' : 'none';
        textCategorySelect.disabled = !data.isHost;
        
        if (data.isHost) {
            document.querySelector('.select-wrapper').classList.remove('disabled');
        } else {
            document.querySelector('.select-wrapper').classList.add('disabled');
        }
    } else if (gameState.currentScreen === 'race') {
        hostRaceControls.style.display = data.isHost ? 'block' : 'none';
    }
    
    // Update players list to reflect new host
    updatePlayersList();
    
    // Show notification
    if (data.isHost) {
        showNotification("You are now the host of this room");
    }
});

socket.on('playerKicked', (data) => {
    // Update players
    gameState.players = data.players;
    
    // Update UI
    updatePlayersList();
    
    // Show notification
    showNotification(`${data.kickedUsername} was kicked from the room`);
});

socket.on('kickedFromRoom', () => {
    // Show notification
    showNotification('You were kicked from the room');
    
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
});

socket.on('roomLockChanged', (data) => {
    // Update lock button icon
    if (toggleLockBtn) {
        toggleLockBtn.innerHTML = data.locked ? 
            '<span class="material-icons">lock</span>' : 
            '<span class="material-icons">lock_open</span>';
        
        toggleLockBtn.title = data.locked ? 'Unlock Room' : 'Lock Room';
    }
    
    // Show notification
    showNotification(`Room is now ${data.locked ? 'locked' : 'unlocked'}`);
    
    // Update room status display
    const roomStatusElem = document.querySelector('.room-status');
    if (!roomStatusElem) {
        // Create room status element if it doesn't exist
        const statusElem = document.createElement('div');
        statusElem.className = `room-status ${data.locked ? 'locked' : ''}`;
        statusElem.innerHTML = `
            <span class="material-icons">${data.locked ? 'lock' : 'lock_open'}</span>
            <span>Room is ${data.locked ? 'locked' : 'unlocked'}</span>
        `;
        
        // Add after room-id
        const roomHeader = document.querySelector('.room-header');
        roomHeader.appendChild(statusElem);
    } else {
        // Update existing status element
        roomStatusElem.className = `room-status ${data.locked ? 'locked' : ''}`;
        roomStatusElem.innerHTML = `
            <span class="material-icons">${data.locked ? 'lock' : 'lock_open'}</span>
            <span>Room is ${data.locked ? 'locked' : 'unlocked'}</span>
        `;
    }
});

socket.on('playerReadyChanged', (data) => {
    // Find player and update ready status
    const player = gameState.players.find(p => p.id === data.playerId);
    if (player) {
        player.isReady = data.ready;
        
        // Update players list
        updatePlayersList();
        
        // Update ready button if it's the current player
        if (data.playerId === socket.id) {
            toggleReadyBtn.innerHTML = data.ready ? 
                '<span class="material-icons">check_circle</span>' : 
                '<span class="material-icons">check_circle_outline</span>';
            
            toggleReadyBtn.title = data.ready ? 'Mark as Not Ready' : 'Mark as Ready';
        }
        
        // Show notification for other players
        if (data.playerId !== socket.id) {
            showNotification(`${player.username} is ${data.ready ? 'ready' : 'not ready'}`);
        }
    }
});

socket.on('customTextSubmitted', (data) => {
    // Update category
    textCategorySelect.value = data.category;
    
    // Show preview
    customTextContainer.style.display = 'block';
    
    // Show notification
    showNotification('Custom text has been set');
    
    // If custom text input exists, update placeholder
    if (customTextInput) {
        customTextInput.placeholder = `Current text: ${data.previewText}`;
        customTextInput.value = '';
    }
});

socket.on('raceTimeoutSet', (data) => {
    // Update timeout input
    raceTimeoutInput.value = data.timeout;
    
    // Show notification
    showNotification(`Race timeout set to ${data.timeout} seconds`);
});

socket.on('shareResultsUrl', (data) => {
    // Open share URL in new window
    window.open(data.url, '_blank');
});

// Simple notification system
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Fade in
    setTimeout(() => {
        notification.classList.add('active');
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('active');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Event Listeners
createRoomBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    
    if (!username) {
        alert('Please enter a username');
        return;
    }
    
    // Store username
    gameState.username = username;
    
    // Create room on server
    socket.emit('createRoom', { username });
});

// Check room existence before joining
joinRoomBtn.addEventListener('click', (e) => {
    const roomId = roomIdInput.value.trim().toUpperCase();
    const username = usernameInput.value.trim();
    
    if (!username) {
        alert('Please enter a username');
        return;
    }
    
    if (!roomId) {
        alert('Please enter a room ID');
        return;
    }
    
    // Show loading state
    joinRoomBtn.disabled = true;
    joinRoomBtn.classList.add('waiting');
    joinRoomBtn.innerHTML = '<span class="material-icons">hourglass_empty</span>Checking...';
    
    // Use socket.io to check if room exists instead of fetch
    socket.emit('checkRoomExists', { roomId }, (response) => {
        // Reset button state
        joinRoomBtn.disabled = false;
        joinRoomBtn.classList.remove('waiting');
        joinRoomBtn.innerHTML = '<span class="material-icons">login</span>Join Room';
        
        if (response.exists) {
            if (response.status === 'racing') {
                // Show warning for rooms with race in progress
                const confirmJoin = confirm('This room has a race in progress. You will join as a spectator until the next race starts. Continue?');
                if (confirmJoin) {
                    // Proceed with join
                    gameState.username = username;
                    socket.emit('joinRoom', { roomId, username });
                }
            } else {
                // Normal join
                gameState.username = username;
                socket.emit('joinRoom', { roomId, username });
            }
        } else {
            alert('Room not found. Check the room ID and try again.');
        }
    });
    
    // Prevent default button click behavior
    e.preventDefault();
});


startRaceBtn.addEventListener('click', () => {
    // Request to start race
    socket.emit('startRace');
});

leaveLobbyBtn.addEventListener('click', () => {
    // Leave room on server
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
    
    // Clear inputs
    usernameInput.value = '';
    roomIdInput.value = '';
    
    // Go back to home screen
    showScreen('home');
});

copyRoomIdBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(gameState.roomId)
        .then(() => {
            // Provide visual feedback
            copyRoomIdBtn.querySelector('.material-icons').textContent = 'check';
            setTimeout(() => {
                copyRoomIdBtn.querySelector('.material-icons').textContent = 'content_copy';
            }, 2000);
            
            showNotification('Room ID copied to clipboard');
        })
        .catch(err => {
            console.error('Failed to copy room ID: ', err);
            alert('Failed to copy room ID to clipboard');
        });
});

backToLobbyBtn.addEventListener('click', () => {
    // In multiplayer, just go back to the lobby
    showScreen('lobby');
});

newRaceBtn.addEventListener('click', () => {
    // Request to start a new race (host only)
    if (gameState.isHost) {
        socket.emit('playAgain');
    } else {
        alert('Only the host can start a new race');
    }
});

textCategorySelect.addEventListener('change', () => {
    // Update category on server (host only)
    if (gameState.isHost) {
        const category = textCategorySelect.value;
        socket.emit('updateCategory', { category });
        
        // Show/hide custom text container
        if (category === 'custom') {
            customTextContainer.style.display = 'block';
        } else {
            customTextContainer.style.display = 'none';
        }
    } else {
        // Reset to previous value
        textCategorySelect.value = gameState.category;
        alert('Only the host can change the category');
    }
});

// Submit custom text button
if (submitCustomTextBtn) {
    submitCustomTextBtn.addEventListener('click', () => {
        if (!gameState.isHost) {
            alert('Only the host can submit custom text');
            return;
        }
        
        const text = customTextInput.value.trim();
        if (text.length < 20) {
            alert('Custom text must be at least 20 characters long');
            return;
        }
        
        socket.emit('submitCustomText', { text });
    });
}

// Race timeout input
if (raceTimeoutInput) {
    raceTimeoutInput.addEventListener('change', () => {
        if (!gameState.isHost) {
            // Reset to default if not host
            raceTimeoutInput.value = 180;
            return;
        }
        
        const timeout = parseInt(raceTimeoutInput.value);
        if (isNaN(timeout) || timeout < 30 || timeout > 600) {
            alert('Race timeout must be between 30 and 600 seconds');
            raceTimeoutInput.value = 180;
            return;
        }
        
        socket.emit('setRaceTimeout', { timeout });
    });
}

// Toggle room lock button
if (toggleLockBtn) {
    toggleLockBtn.addEventListener('click', () => {
        if (!gameState.isHost) {
            alert('Only the host can lock/unlock the room');
            return;
        }
        
        // Determine current lock state from button icon
        const isCurrentlyLocked = toggleLockBtn.querySelector('.material-icons').textContent === 'lock';
        
        // Toggle lock state
        socket.emit('toggleRoomLock', { locked: !isCurrentlyLocked });
    });
}

// Toggle ready button
if (toggleReadyBtn) {
    toggleReadyBtn.addEventListener('click', () => {
        // Determine current ready state from button icon
        const isCurrentlyReady = toggleReadyBtn.querySelector('.material-icons').textContent === 'check_circle';
        
        // Toggle ready state
        socket.emit('toggleReady', { ready: !isCurrentlyReady });
    });
}

// Force finish race button
if (forceFinishBtn) {
    forceFinishBtn.addEventListener('click', () => {
        if (!gameState.isHost) {
            alert('Only the host can force finish the race');
            return;
        }
        
        if (confirm('Are you sure you want to end the race for all players?')) {
            socket.emit('forceFinishRace');
        }
    });
}

// Typing input handler
typingInput.addEventListener('input', (e) => {
    if (gameState.isRaceComplete) return;
    
    const words = gameState.selectedText.split(' ');
    const currentWord = words[gameState.currentWordIndex];
    const typedValue = e.target.value;
    
    if (typedValue.endsWith(' ')) {
        // Word completed
        const typedWord = typedValue.trim();
        
        // Count errors in the word
        if (typedWord !== currentWord) {
            const errorCount = levenshteinDistance(typedWord, currentWord);
            gameState.errors += errorCount;
        }
        
        // Move to next word
        gameState.currentWordIndex++;
        gameState.currentCharIndex = 0;
        gameState.completedWords++;
        gameState.totalCharacters += currentWord.length + 1; // +1 for the space
        
        // Clear input
        e.target.value = '';
        
        // Check if race is complete
        if (gameState.currentWordIndex >= words.length) {
            completeRace();
            return;
        }
    } else {
        // Update current char index
        gameState.currentCharIndex = typedValue.length;
    }
    
    // Update race text display
    updateRaceText();
});

// Handle race completion
function completeRace() {
    // Mark race as complete
    gameState.isRaceComplete = true;
    gameState.raceEndTime = new Date().getTime();
    
    // Calculate final stats
    const elapsedSeconds = Math.floor((gameState.raceEndTime - gameState.raceStartTime) / 1000);
    const wpm = calculateWPM(gameState.totalCharacters, elapsedSeconds);
    const accuracy = calculateAccuracy(gameState.errors, gameState.totalCharacters + gameState.errors);
    const time = formatTime(elapsedSeconds);
    
    // Send race completion to server
    socket.emit('finishRace', {
        wpm,
        accuracy,
        time
    });
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Add notification styles
    const style = document.createElement('style');
    style.textContent = `
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: var(--primary);
            color: #000;
            padding: 12px 20px;
            border-radius: var(--radius-md);
            box-shadow: var(--shadow-md);
            z-index: 1000;
            opacity: 0;
            transform: translateY(-20px);
            transition: all 0.3s ease;
        }
        
        .notification.active {
            opacity: 1;
            transform: translateY(0);
        }
    `;
    document.head.appendChild(style);
    
    // Start with home screen
    showScreen('home');
    
    // Focus on username input
    usernameInput.focus();
});