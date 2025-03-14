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
    raceResults: [],
    timerInterval: null
};

// Helper Functions
function generateRoomId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar looking characters
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

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

function getRandomText(category) {
    const texts = textSamples[category];
    return texts[Math.floor(Math.random() * texts.length)];
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
    }
}

// Simulate player progress updates
function simulatePlayerProgress() {
    // In a real implementation, this would be replaced with real data from the network
    return gameState.players.map(player => {
        if (player.username === gameState.username) {
            // Use the actual progress for the current player
            return {
                username: player.username,
                progress: Math.round((gameState.completedWords / gameState.selectedText.split(' ').length) * 100)
            };
        } else {
            // Simulate progress for other players
            const randomProgress = Math.min(
                Math.floor(Math.random() * 5) + player.progress,
                100
            );
            player.progress = randomProgress;
            return {
                username: player.username,
                progress: randomProgress
            };
        }
    });
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
    const progressData = simulatePlayerProgress();
    progressBarsContainer.innerHTML = '';
    
    progressData.forEach(player => {
        const playerInitial = player.username.charAt(0).toUpperCase();
        
        const progressBar = `
            <div class="progress-bar">
                <div class="player-info">
                    <div class="player-avatar">${playerInitial}</div>
                    <div class="player-name">${player.username}</div>
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
    playersContainer.innerHTML = '';
    
    gameState.players.forEach(player => {
        const playerInitial = player.username.charAt(0).toUpperCase();
        const isHost = player.isHost ? '<span class="host-badge">Host</span>' : '';
        
        const playerItem = `
            <li>
                <div class="player-avatar">${playerInitial}</div>
                <div class="player-name">${player.username}</div>
                ${isHost}
            </li>
        `;
        
        playersContainer.innerHTML += playerItem;
    });
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
}

function updateResultsScreen() {
    // Sort results by WPM (highest first)
    const sortedResults = [...gameState.raceResults].sort((a, b) => b.wpm - a.wpm);
    
    // Update podium
    if (sortedResults.length >= 1) {
        const first = sortedResults[0];
        firstPlacePlayer.querySelector('.avatar').textContent = first.username.charAt(0).toUpperCase();
        firstPlacePlayer.querySelector('.name').textContent = first.username;
        firstPlacePlayer.querySelector('.wpm').textContent = `${first.wpm} WPM`;
    }
    
    if (sortedResults.length >= 2) {
        const second = sortedResults[1];
        secondPlacePlayer.querySelector('.avatar').textContent = second.username.charAt(0).toUpperCase();
        secondPlacePlayer.querySelector('.name').textContent = second.username;
        secondPlacePlayer.querySelector('.wpm').textContent = `${second.wpm} WPM`;
    }
    
    if (sortedResults.length >= 3) {
        const third = sortedResults[2];
        thirdPlacePlayer.querySelector('.avatar').textContent = third.username.charAt(0).toUpperCase();
        thirdPlacePlayer.querySelector('.name').textContent = third.username;
        thirdPlacePlayer.querySelector('.wpm').textContent = `${third.wpm} WPM`;
    }
    
    // Update results table
    resultsTableBody.innerHTML = '';
    sortedResults.forEach((result, index) => {
        const row = `
            <tr>
                <td>${index + 1}</td>
                <td>${result.username}</td>
                <td>${result.wpm}</td>
                <td>${result.accuracy}%</td>
                <td>${result.time}</td>
            </tr>
        `;
        resultsTableBody.innerHTML += row;
    });
}

// Game Logic Functions
function startRace() {
    // Set up race state
    gameState.selectedText = getRandomText(textCategorySelect.value);
    gameState.currentWordIndex = 0;
    gameState.currentCharIndex = 0;
    gameState.errors = 0;
    gameState.totalCharacters = 0;
    gameState.completedWords = 0;
    gameState.isRaceComplete = false;
    
    // Initialize player progress
    gameState.players.forEach(player => {
        player.progress = 0;
    });
    
    // Show countdown screen
    showScreen('countdown');
    
    // Countdown sequence
    let countdown = 3;
    countdownDisplay.textContent = countdown;
    
    const countdownInterval = setInterval(() => {
        countdown--;
        
        if (countdown > 0) {
            countdownDisplay.textContent = countdown;
        } else {
            clearInterval(countdownInterval);
            startActualRace();
        }
    }, 1000);
}

function startActualRace() {
    // Show race screen
    showScreen('race');
    
    // Set up race text
    updateRaceText();
    
    // Start race timer
    gameState.raceStartTime = new Date().getTime();
    
    // Start progress update interval
    const progressInterval = setInterval(() => {
        if (gameState.isRaceComplete) {
            clearInterval(progressInterval);
            return;
        }
        
        updateProgressBars();
    }, 500);
    
    // Start stats update interval
    gameState.timerInterval = setInterval(() => {
        if (gameState.isRaceComplete) {
            clearInterval(gameState.timerInterval);
            return;
        }
        
        updateRaceStats();
    }, 1000);
}

function completeRace() {
    // Mark race as complete
    gameState.isRaceComplete = true;
    gameState.raceEndTime = new Date().getTime();
    
    // Calculate final stats
    const elapsedSeconds = Math.floor((gameState.raceEndTime - gameState.raceStartTime) / 1000);
    const wpm = calculateWPM(gameState.totalCharacters, elapsedSeconds);
    const accuracy = calculateAccuracy(gameState.errors, gameState.totalCharacters + gameState.errors);
    
    // Add current player's result
    gameState.raceResults.push({
        username: gameState.username,
        wpm: wpm,
        accuracy: accuracy,
        time: formatTime(elapsedSeconds)
    });
    
    // Simulate results for other players
    gameState.players.forEach(player => {
        if (player.username !== gameState.username) {
            // Create simulated results for other players
            const simulatedWpm = Math.floor(Math.random() * 50) + 30; // Random WPM between 30-80
            const simulatedAccuracy = Math.floor(Math.random() * 15) + 85; // Random accuracy between 85-100%
            const simulatedTime = formatTime(Math.floor(Math.random() * 30) + elapsedSeconds - 10); // Random time around the player's time
            
            gameState.raceResults.push({
                username: player.username,
                wpm: simulatedWpm,
                accuracy: simulatedAccuracy,
                time: simulatedTime
            });
        }
    });
    
    // Clear timer interval
    clearInterval(gameState.timerInterval);
    
    // Update results screen and show it
    updateResultsScreen();
    showScreen('results');
}

// Event Handlers
createRoomBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    
    if (!username) {
        alert('Please enter a username');
        return;
    }
    
    // Generate room ID
    const roomId = generateRoomId();
    
    // Set up game state
    gameState.roomId = roomId;
    gameState.username = username;
    gameState.isHost = true;
    gameState.players = [
        { username: username, isHost: true, progress: 0 }
    ];
    
    // Update UI
    roomIdDisplay.textContent = roomId;
    updatePlayersList();
    
    // Show lobby screen
    showScreen('lobby');
});

joinRoomBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const roomId = roomIdInput.value.trim().toUpperCase();
    
    if (!username) {
        alert('Please enter a username');
        return;
    }
    
    if (!roomId) {
        alert('Please enter a room ID');
        return;
    }
    
    // In a real app, we would validate the room ID here
    // For demo purposes, we'll assume the room exists
    
    // Set up game state
    gameState.roomId = roomId;
    gameState.username = username;
    gameState.isHost = false;
    
    // Simulate existing players in the room
    const hostName = `Host_${roomId.substring(0, 3)}`;
    gameState.players = [
        { username: hostName, isHost: true, progress: 0 },
        { username: username, isHost: false, progress: 0 }
    ];
    
    // Add 0-2 more random players
    const extraPlayers = Math.floor(Math.random() * 3);
    for (let i = 0; i < extraPlayers; i++) {
        gameState.players.push({
            username: `Player${i + 1}`,
            isHost: false,
            progress: 0
        });
    }
    
    // Update UI
    roomIdDisplay.textContent = roomId;
    updatePlayersList();
    
    // Show lobby screen
    showScreen('lobby');
});

startRaceBtn.addEventListener('click', () => {
    if (!gameState.isHost) {
        alert('Only the host can start the race');
        return;
    }
    
    startRace();
});

leaveLobbyBtn.addEventListener('click', () => {
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
        raceResults: [],
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
        })
        .catch(err => {
            console.error('Failed to copy room ID: ', err);
            alert('Failed to copy room ID to clipboard');
        });
});

backToLobbyBtn.addEventListener('click', () => {
    // Reset race state but keep room info
    gameState.selectedText = '';
    gameState.raceStartTime = null;
    gameState.raceEndTime = null;
    gameState.currentWordIndex = 0;
    gameState.currentCharIndex = 0;
    gameState.errors = 0;
    gameState.totalCharacters = 0;
    gameState.completedWords = 0;
    gameState.isRaceComplete = false;
    gameState.raceResults = [];
    
    // Reset player progress
    gameState.players.forEach(player => {
        player.progress = 0;
    });
    
    // Update UI
    updatePlayersList();
    
    // Show lobby screen
    showScreen('lobby');
});

newRaceBtn.addEventListener('click', () => {
    // Start a new race
    startRace();
});

// Helper function to calculate edit distance for error detection
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

// The most important event handler: typing input
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

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Start with home screen
    showScreen('home');
    
    // Focus on username input
    usernameInput.focus();
});


// Text samples
const textSamples = {
    quotes: [
        "The greatest glory in living lies not in never falling, but in rising every time we fall. The way to get started is to quit talking and begin doing.",
        "Your time is limited, so don't waste it living someone else's life. Don't be trapped by dogma – which is living with the results of other people's thinking.",
        "If life were predictable it would cease to be life, and be without flavor. The purpose of our lives is to be happy and to help others find their happiness.",
        "If you look at what you have in life, you'll always have more. If you look at what you don't have in life, you'll never have enough. Be thankful for what you have.",
        "Life is what happens when you're busy making other plans. Sometimes the questions are complicated and the answers are simple."
    ],
    programming: [
        "A programmer is a person who fixed a problem that you don't know you have, in a way you don't understand. Good code is like a good joke: it needs no explanation.",
        "Programming is the art of telling another human being what one wants the computer to do. Always code as if the person who will maintain your code is a violent psychopath who knows where you live.",
        "Software and cathedrals are much the same; first we build them, then we pray. Any fool can write code that a computer can understand. Good programmers write code that humans can understand.",
        "The best error message is the one that never shows up. The most damaging phrase in the language is 'We've always done it this way'. Remember that there is no code faster than no code.",
        "Programming isn't about what you know; it's about what you can figure out. Debugging is twice as hard as writing the code in the first place. Therefore, if you write the code as cleverly as possible, you are, by definition, not smart enough to debug it."
    ],
    random: [
        "apple banana cherry dolphin elephant forest giraffe happiness island journey knowledge laughter mountain notebook octopus pineapple question rainbow strawberry television umbrella volcano waterfall xylophone yellow zebra",
        "computer keyboard mouse monitor printer scanner headphones microphone speaker webcam router modem battery charger cable adapter software hardware internet website email password username login logout",
        "pizza burger sandwich pasta salad soup noodles rice chicken beef pork fish vegetables fruits dessert cake cookies ice cream chocolate coffee tea juice water soda milk",
        "football basketball baseball soccer tennis golf swimming running cycling hiking skiing snowboarding surfing volleyball boxing wrestling martial arts gymnastics ballet dancing singing acting painting drawing",
        "sun moon stars planet galaxy universe earth sky cloud rain snow wind thunder lightning rainbow mountain valley river lake ocean beach desert forest jungle meadow"
    ]
};