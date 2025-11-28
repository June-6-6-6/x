const TicTacToe = require('../lib/tictactoe');

// Store games globally
const games = {};

// Emoji mapping for rendering the board
const emojiMap = {
    'X': '❎',
    'O': '⭕',
    '1': '1️⃣',
    '2': '2️⃣',
    '3': '3️⃣',
    '4': '4️⃣',
    '5': '5️⃣',
    '6': '6️⃣',
    '7': '7️⃣',
    '8': '8️⃣',
    '9': '9️⃣',
};

/**
 * Render the TicTacToe board with emojis
 * @param {TicTacToe} game
 * @returns {string}
 */
function renderBoard(game) {
    const arr = game.render().map(v => emojiMap[v]);
    return `${arr.slice(0, 3).join('')}\n${arr.slice(3, 6).join('')}\n${arr.slice(6).join('')}`;
}

/**
 * Create a new game room
 * @param {string} chatId
 * @param {string} senderId
 * @param {string} [name]
 * @returns {object} room
 */
function createRoom(chatId, senderId, name) {
    const room = {
        id: `tictactoe-${Date.now()}`,
        x: chatId,
        o: '',
        game: new TicTacToe(senderId, 'o'),
        state: 'WAITING',
        name: name || null,
    };
    games[room.id] = room;
    return room;
}

/**
 * Start or join a TicTacToe game
 */
async function tictactoeCommand(sock, chatId, senderId, text) {
    try {
        // Prevent player from joining multiple games
        const activeGame = Object.values(games).find(room =>
            room.id.startsWith('tictactoe') &&
            [room.game.playerX, room.game.playerO].includes(senderId)
        );
        if (activeGame) {
            return sock.sendMessage(chatId, {
                text: '❌ You are still in a game. Type *surrender* to quit.'
            });
        }

        // Look for existing waiting room
        let room = Object.values(games).find(room =>
            room.state === 'WAITING' &&
            (text ? room.name === text : true)
        );

        if (room) {
            // Join existing room
            room.o = chatId;
            room.game.playerO = senderId;
            room.state = 'PLAYING';

            const str = `
🎮 *TicTacToe Game Started!*

Waiting for @${room.game.currentTurn.split('@')[0]} to play...

${renderBoard(room.game)}

▢ *Room ID:* ${room.id}
▢ *Rules:*
• Make 3 rows of symbols vertically, horizontally or diagonally to win
• Type a number (1-9) to place your symbol
• Type *surrender* to give up
`;

            await sock.sendMessage(chatId, {
                text: str,
                mentions: [room.game.currentTurn, room.game.playerX, room.game.playerO]
            });

        } else {
            // Create new room
            room = createRoom(chatId, senderId, text);

            await sock.sendMessage(chatId, {
                text: `⏳ *Waiting for opponent*\nType *.ttt ${text || ''}* to join!`
            });
        }

    } catch (error) {
        console.error('Error in tictactoe command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Error starting game. Please try again.'
        });
    }
}

/**
 * Handle TicTacToe moves
 */
async function handleTicTacToeMove(sock, chatId, senderId, text) {
    try {
        const room = Object.values(games).find(room =>
            room.id.startsWith('tictactoe') &&
            [room.game.playerX, room.game.playerO].includes(senderId) &&
            room.state === 'PLAYING'
        );

        if (!room) return;

        const isSurrender = /^(surrender|give up)$/i.test(text);
        if (!isSurrender && !/^[1-9]$/.test(text)) return;

        // Enforce turn order unless surrender
        if (senderId !== room.game.currentTurn && !isSurrender) {
            return sock.sendMessage(chatId, { text: '❌ Not your turn!' });
        }

        const moveOk = isSurrender ? true : room.game.turn(
            senderId === room.game.playerO,
            parseInt(text) - 1
        );

        if (!moveOk) {
            return sock.sendMessage(chatId, { text: '❌ Invalid move! That position is already taken.' });
        }

        let winner = room.game.winner;
        const isTie = room.game.turns === 9;

        if (isSurrender) {
            winner = senderId === room.game.playerX ? room.game.playerO : room.game.playerX;
            await sock.sendMessage(chatId, {
                text: `🏳️ @${senderId.split('@')[0]} has surrendered! @${winner.split('@')[0]} wins the game!`,
                mentions: [senderId, winner]
            });
            delete games[room.id];
            return;
        }

        const gameStatus = winner
            ? `🎉 @${winner.split('@')[0]} wins the game!`
            : isTie
                ? `🤝 Game ended in a draw!`
                : `🎲 Turn: @${room.game.currentTurn.split('@')[0]} (${senderId === room.game.playerX ? '❎' : '⭕'})`;

        const str = `
🎮 *TicTacToe Game*

${gameStatus}

${renderBoard(room.game)}

▢ Player ❎: @${room.game.playerX.split('@')[0]}
▢ Player ⭕: @${room.game.playerO.split('@')[0]}

${!winner && !isTie ? '• Type a number (1-9) to make your move\n• Type *surrender* to give up' : ''}
`;

        const mentions = [
            room.game.playerX,
            room.game.playerO,
            ...(winner ? [winner] : [room.game.currentTurn])
        ];

        // Send updates to both chats
        await sock.sendMessage(room.x, { text: str, mentions });
        if (room.x !== room.o) {
            await sock.sendMessage(room.o, { text: str, mentions });
        }

        if (winner || isTie) {
            delete games[room.id];
        }

    } catch (error) {
        console.error('Error in tictactoe move:', error);
    }
}

module.exports = {
    tictactoeCommand,
    handleTicTacToeMove
};
