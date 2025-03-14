# TypeRacer - Multiplayer Typing Race Game

TypeRacer is a real-time multiplayer typing race game where friends can compete to see who types the fastest. Players join rooms using unique room IDs and race against each other by typing provided text as quickly and accurately as possible.

![TypeRacer Screenshot](https://via.placeholder.com/800x450.png?text=TypeRacer+Screenshot)

## Features

- **Multiplayer Racing**: Create rooms and invite friends using a unique room ID
- **Real-time Competition**: See everyone's progress as they type
- **Multiple Text Categories**: Choose from quotes, programming terms, or random words
- **Custom Texts**: Hosts can input their own text for races
- **Performance Metrics**: Track WPM (Words Per Minute), accuracy, and time
- **Host Controls**: Only the host can start races and control room settings
- **Practice Mode**: Solo practice option to improve typing skills
- **Race Results**: Detailed statistics and podium display after each race
- **Share Results**: Share your achievements on social media
- **Reconnection**: Automatically reconnect if you lose connection
- **Responsive Design**: Works on desktop and mobile devices
- **Dark UI Theme**: Modern, dark design with yellowish-brown accents

## Technology Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express
- **Real-time Communication**: Socket.IO
- **Font**: Lexend (Google Fonts)
- **Icons**: Material Icons

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/typeracer.git
cd typeracer
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Access the application in your browser:
```
http://localhost:3000
```

## Project Structure

```
typeracer/
├── public/                  # Static frontend files
│   ├── index.html           # Main HTML structure
│   ├── styles.css           # CSS styles
│   ├── script.js            # Main client-side logic
│   ├── connection.js        # Connection management
│   └── additional-events.js # Additional event handlers
├── server.js                # Express and Socket.IO server
├── textSamples.js           # Text samples for races
├── package.json             # Project metadata and dependencies
└── README.md                # This file
```

## How to Play

### Creating a Room
1. Enter your username
2. Click "Create Room"
3. Share the room ID with friends

### Joining a Room
1. Enter your username
2. Enter the room ID
3. Click "Join Room"

### Starting a Race
1. As the host, select a text category
2. Click "Start Race"
3. Wait for the countdown
4. Type the displayed text as quickly and accurately as possible
5. View results when all players finish or time expires

### Practice Mode
1. Click "Start Practice" from the home screen
2. Select a text category
3. Type the displayed text to practice
4. Click "Restart" to try again or "Exit Practice" to return to the home screen

## Keyboard Shortcuts

- **Alt+C**: Copy room ID (in lobby)
- **Alt+S**: Start race (host only, in lobby)
- **Esc**: Leave room (in lobby)

## Room Host Capabilities

As a room host, you can:
- Start races
- Change text categories
- Submit custom text for races
- Set race timeout duration
- Lock/unlock the room
- Kick players
- Force finish a race

## Deployment

See the [Deployment Guide](deployment-guide.md) for instructions on deploying the application to various platforms.

## Development

To run in development mode with automatic server restarting:
```bash
npm run dev
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- Lexend font by Bonnie Shaver-Troup
- Material Icons by Google
- Socket.IO for real-time communication
- Express.js team