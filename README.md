# TypeRacer - Typing Race Game

A modern, dark-themed typing race web application that allows friends to compete in typing races using room IDs.

## Features

- **Room-based multiplayer**: Create rooms and invite friends using a unique room ID
- **Real-time racing**: See your friends' progress as you type
- **Multiple text categories**: Choose from quotes, programming terms, or random words
- **Performance metrics**: Track WPM (Words Per Minute), accuracy, and time
- **Responsive design**: Works on desktop and mobile devices
- **Modern dark UI**: Yellow/brown accent color scheme with the Lexend font

## File Structure

- `index.html` - Main HTML structure
- `styles.css` - Complete styling with CSS variables for theming
- `script.js` - JavaScript for game logic and UI interactions

## Implementation Notes

This is a client-side only implementation for demonstration purposes. In a production environment, you'd want to:

1. Implement a backend server using Node.js, Express, and Socket.io for real-time updates
2. Store room and player data in a database
3. Add authentication for player accounts
4. Implement rate limiting and other security measures
5. Add more text categories and customization options

## How To Use

1. Open `index.html` in a web browser
2. Enter your username and either create a new room or join an existing one with a room ID
3. If you're the host, select a text category and start the race
4. After the countdown, type the text as quickly and accurately as possible
5. View results at the end and choose to race again or return to the lobby

## Customization

The color scheme and styling can be easily modified by changing the CSS variables in the `:root` selector in `styles.css`. The current theme uses a dark background with yellow/brown accents, but you can adjust these to match your preferences.

## License

This project is available for personal and commercial use.

## Credits

- Uses the [Lexend](https://fonts.google.com/specimen/Lexend) font from Google Fonts
- Uses [Material Icons](https://fonts.google.com/icons) for UI elements