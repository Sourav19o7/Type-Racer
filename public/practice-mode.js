// Practice Mode JavaScript
// This file contains the functionality for the practice mode in TypeRacer

// DOM Elements - Practice Screen
const practiceScreen = document.getElementById('practice-screen');
const practiceTextCategorySelect = document.getElementById('practice-text-category');
const newPracticeTextBtn = document.getElementById('new-practice-text-btn');
const practiceTypingInput = document.getElementById('practice-typing-input');
const practiceTextDisplay = document.getElementById('practice-text');
const practiceTimerDisplay = document.getElementById('practice-timer');
const practiceWpmDisplay = document.getElementById('practice-wpm');
const practiceAccuracyDisplay = document.getElementById('practice-accuracy');
const exitPracticeBtn = document.getElementById('exit-practice-btn');
const restartPracticeBtn = document.getElementById('restart-practice-btn');
const practiceBtn = document.getElementById('practice-btn');

// Practice game state
let practiceState = {
    selectedText: '',
    startTime: null,
    endTime: null,
    currentWordIndex: 0,
    currentCharIndex: 0,
    errors: 0,
    totalCharacters: 0,
    completedWords: 0,
    isPracticeComplete: false,
    timerInterval: null
};

// Sample texts for practice mode
const practiceTexts = {
    quotes: [
        "The only way to do great work is to love what you do. If you haven't found it yet, keep looking. Don't settle.",
        "Success is not final, failure is not fatal: It is the courage to continue that counts.",
        "Life is what happens when you're busy making other plans.",
        "The future belongs to those who believe in the beauty of their dreams.",
        "The best time to plant a tree was 20 years ago. The second best time is now."
    ],
    programming: [
        "A programmer is a person who fixed a problem that you don't know you have, in a way you don't understand.",
        "There are two ways to write error-free programs; only the third one works.",
        "Programming isn't about what you know; it's about what you can figure out.",
        "The code you write makes you a programmer. The code you delete makes you a good one.",
        "First, solve the problem. Then, write the code."
    ],
    random: [
        "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.",
        "How vexingly quick daft zebras jump! Sphinx of black quartz, judge my vow.",
        "Amazingly few discotheques provide jukeboxes. Jackdaws love my big sphinx of quartz.",
        "We promptly judged antique ivory buckles for the next prize. Fix problem quickly with galvanized jets.",
        "The five boxing wizards jump quickly. Crazy Fredrick bought many very exquisite opal jewels."
    ]
};

// Initialize practice mode
function initPracticeMode() {
    // Practice button in home screen
    practiceBtn.addEventListener('click', startPracticeMode);
    
    // New practice text button
    newPracticeTextBtn.addEventListener('click', getNewPracticeText);
    
    // Exit practice button
    exitPracticeBtn.addEventListener('click', exitPracticeMode);
    
    // Restart practice button
    restartPracticeBtn.addEventListener('click', restartPractice);
    
    // Text category selection
    practiceTextCategorySelect.addEventListener('change', getNewPracticeText);
    
    // Typing input handler
    practiceTypingInput.addEventListener('input', handlePracticeTyping);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Alt+R to restart practice
        if (e.altKey && e.key === 'r' && practiceState.startTime !== null && gameState.currentScreen === 'practice') {
            restartPractice();
            e.preventDefault();
        }
    });
}

// Start practice mode
function startPracticeMode() {
    resetPracticeState();
    getNewPracticeText();
    
    // Show countdown before starting practice
    showPracticeCountdown(3);
}

// Get new practice text based on selected category
function getNewPracticeText() {
    const category = practiceTextCategorySelect.value;
    const texts = practiceTexts[category];
    const randomIndex = Math.floor(Math.random() * texts.length);
    
    // Reset practice state
    resetPracticeState();
    
    // Set the selected text
    practiceState.selectedText = texts[randomIndex];
    
    // Update the text display
    updatePracticeTextDisplay();
    
    // Focus on input
    practiceTypingInput.focus();
    practiceTypingInput.value = '';
}

// Update practice text display
function updatePracticeTextDisplay() {
    const words = practiceState.selectedText.split(' ');
    let html = '';
    
    words.forEach((word, wordIndex) => {
        if (wordIndex < practiceState.currentWordIndex) {
            // Completed words
            html += `<span class="typed">${word}</span> `;
        } else if (wordIndex === practiceState.currentWordIndex) {
            // Current word
            let currentWordHtml = '';
            
            for (let i = 0; i < word.length; i++) {
                if (i < practiceState.currentCharIndex) {
                    // Typed characters
                    currentWordHtml += `<span class="typed">${word[i]}</span>`;
                } else if (i === practiceState.currentCharIndex) {
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
    
    practiceTextDisplay.innerHTML = html;
    
    // Scroll to make current word visible if needed
    const currentSpan = practiceTextDisplay.querySelector('.current');
    if (currentSpan) {
        const container = practiceTextDisplay.parentElement;
        const spanTop = currentSpan.offsetTop;
        const containerTop = container.scrollTop;
        const containerHeight = container.clientHeight;
        
        if (spanTop < containerTop || spanTop > containerTop + containerHeight) {
            container.scrollTop = spanTop - containerHeight / 2;
        }
    }
}

// Handle practice typing input
function handlePracticeTyping(e) {
    if (practiceState.isPracticeComplete) return;
    
    // Start timer if this is the first keystroke
    if (practiceState.startTime === null) {
        practiceState.startTime = new Date().getTime();
        startPracticeTimer();
    }
    
    const words = practiceState.selectedText.split(' ');
    const currentWord = words[practiceState.currentWordIndex];
    const typedValue = e.target.value;
    
    if (typedValue.endsWith(' ')) {
        // Word completed
        const typedWord = typedValue.trim();
        
        // Count errors in the word
        if (typedWord !== currentWord) {
            const errorCount = levenshteinDistance(typedWord, currentWord);
            practiceState.errors += errorCount;
        }
        
        // Move to next word
        practiceState.currentWordIndex++;
        practiceState.currentCharIndex = 0;
        practiceState.completedWords++;
        practiceState.totalCharacters += currentWord.length + 1; // +1 for the space
        
        // Clear input
        e.target.value = '';
        
        // Check if practice is complete
        if (practiceState.currentWordIndex >= words.length) {
            completePractice();
            return;
        }
    } else {
        // Update current char index
        practiceState.currentCharIndex = typedValue.length;
    }
    
    // Update practice text display
    updatePracticeTextDisplay();
}

// Start practice timer
function startPracticeTimer() {
    // Clear any existing interval
    if (practiceState.timerInterval) {
        clearInterval(practiceState.timerInterval);
    }
    
    practiceState.timerInterval = setInterval(updatePracticeStats, 500);
}

// Update practice stats
function updatePracticeStats() {
    if (!practiceState.startTime) return;
    
    const currentTime = new Date().getTime();
    const elapsedSeconds = Math.floor((currentTime - practiceState.startTime) / 1000);
    
    // Update timer
    practiceTimerDisplay.textContent = formatTime(elapsedSeconds);
    
    // Update WPM
    const wpm = calculateWPM(practiceState.totalCharacters, elapsedSeconds);
    practiceWpmDisplay.textContent = `${wpm} WPM`;
    
    // Update accuracy
    const accuracy = calculateAccuracy(practiceState.errors, practiceState.totalCharacters + practiceState.errors);
    practiceAccuracyDisplay.textContent = `${accuracy}%`;
}

// Complete practice
function completePractice() {
    // Mark practice as complete
    practiceState.isPracticeComplete = true;
    practiceState.endTime = new Date().getTime();
    
    // Clear timer interval
    if (practiceState.timerInterval) {
        clearInterval(practiceState.timerInterval);
        practiceState.timerInterval = null;
    }
    
    // Calculate final stats
    const elapsedSeconds = Math.floor((practiceState.endTime - practiceState.startTime) / 1000);
    const wpm = calculateWPM(practiceState.totalCharacters, elapsedSeconds);
    const accuracy = calculateAccuracy(practiceState.errors, practiceState.totalCharacters + practiceState.errors);
    
    // Update stats one last time
    practiceTimerDisplay.textContent = formatTime(elapsedSeconds);
    practiceWpmDisplay.textContent = `${wpm} WPM`;
    practiceAccuracyDisplay.textContent = `${accuracy}%`;
    
    // Show completion notification
    showNotification(`Practice completed! ${wpm} WPM with ${accuracy}% accuracy`);
    
    // Highlight restart button to indicate completion
    restartPracticeBtn.classList.add('highlight-pulse');
    setTimeout(() => {
        restartPracticeBtn.classList.remove('highlight-pulse');
    }, 3000);
}

// Reset practice state
function resetPracticeState() {
    // Clear timer interval if active
    if (practiceState.timerInterval) {
        clearInterval(practiceState.timerInterval);
    }
    
    // Reset state
    practiceState = {
        selectedText: practiceState.selectedText,
        startTime: null,
        endTime: null,
        currentWordIndex: 0,
        currentCharIndex: 0,
        errors: 0,
        totalCharacters: 0,
        completedWords: 0,
        isPracticeComplete: false,
        timerInterval: null
    };
    
    // Reset UI
    practiceTimerDisplay.textContent = '00:00';
    practiceWpmDisplay.textContent = '0 WPM';
    practiceAccuracyDisplay.textContent = '100%';
    practiceTypingInput.value = '';
}

// Restart practice with same text
function restartPractice() {
    resetPracticeState();
    updatePracticeTextDisplay();
    practiceTypingInput.focus();
}

// Exit practice mode
function exitPracticeMode() {
    // Clear timer interval if active
    if (practiceState.timerInterval) {
        clearInterval(practiceState.timerInterval);
        practiceState.timerInterval = null;
    }
    
    // Reset practice state
    resetPracticeState();
    
    // Explicitly make practice screen inactive
    if (practiceScreen) {
        practiceScreen.classList.remove('active');
    }
    
    // Show home screen
    showScreen('home');
}

// Show practice countdown
function showPracticeCountdown(seconds) {
    // Show countdown screen
    showScreen('countdown');
    countdownDisplay.textContent = seconds;
    
    // Start countdown
    let remainingSeconds = seconds;
    const countdownInterval = setInterval(() => {
        remainingSeconds--;
        
        if (remainingSeconds <= 0) {
            // Countdown complete, show practice screen
            clearInterval(countdownInterval);
            
            // Debug - check if practice screen exists
            console.log("Practice screen element:", practiceScreen);
            
            // Force screen change with a slight delay
            setTimeout(() => {
                // Hide countdown screen explicitly
                Object.values(screens).forEach(screen => {
                    screen.classList.remove('active');
                });
                
                // Show practice screen explicitly
                practiceScreen.classList.add('active');
                gameState.currentScreen = 'practice';
                
                // Focus on typing input
                if (practiceTypingInput) {
                    practiceTypingInput.focus();
                } else {
                    console.error("Practice typing input not found");
                }
            }, 100);
        } else {
            // Update countdown display
            countdownDisplay.textContent = remainingSeconds;
        }
    }, 1000);
}

// Add local storage for practice history
function savePracticeResult(wpm, accuracy, textCategory) {
    // Get existing history or initialize new array
    const history = JSON.parse(localStorage.getItem('practiceHistory') || '[]');
    
    // Add new result
    history.push({
        date: new Date().toISOString(),
        wpm,
        accuracy,
        category: textCategory
    });
    
    // Keep only the latest 20 results
    while (history.length > 20) {
        history.shift();
    }
    
    // Save back to local storage
    localStorage.setItem('practiceHistory', JSON.stringify(history));
}

// Initialize practice mode when the page loads
document.addEventListener('DOMContentLoaded', () => {
    initPracticeMode();
    
    // Add CSS for the highlight pulse animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes highlightPulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
        }
        
        .highlight-pulse {
            animation: highlightPulse 0.5s ease-in-out infinite;
            box-shadow: 0 0 8px var(--primary);
        }
    `;
    document.head.appendChild(style);
});