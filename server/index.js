// server/index.js
require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const db = require('./db');
const apiRoutes = require('./routes/api');
const matchmaking = require('./game/matchmaking');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api', apiRoutes);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.locals.onlineCount = 0;

io.on('connection', (socket) => {
  app.locals.onlineCount++;
  io.emit('online_update', app.locals.onlineCount);

  let currentPlayer = null;
  let currentRoomId = null;

  socket.on('join_queue', ({ id, name }) => {
    const player = db.getPlayer(id, name);
    currentPlayer = { id: player.id, name: player.name, socketId: socket.id };
    socket.data.playerId = player.id;

    const room = matchmaking.addToQueue(currentPlayer);
    if (room) {
      currentRoomId = room.id;
      for (const pid of room.order) {
        const p = room.players[pid];
        io.to(p.socketId).emit('match_found', {
          roomId: room.id,
          you: pid,
          opponent: room.order.find((x) => x !== pid),
          state: room.toPublicState(),
        });
      }
    } else {
      socket.emit('queue_waiting');
    }
  });

  socket.on('cancel_queue', () => {
    if (currentPlayer) matchmaking.removeFromQueue(currentPlayer.id);
  });

  // выстрел: клиент сообщает по какой части тела попал (raycast делает клиент,
  // но финальное решение об уроне — сервер, чтобы не читерили)
  socket.on('shoot', ({ roomId, targetId, part }) => {
    const room = matchmaking.getRoom(roomId);
    if (!room || !socket.data.playerId) return;
    const shooterId = socket.data.playerId;

    const result = room.applyHit(shooterId, targetId, part);
    if (!result) return;

    for (const pid of room.order) {
      const p = room.players[pid];
      io.to(p.socketId).emit('hit_update', { shooterId, ...result });
    }

    if (room.finished) {
      const loserId = room.getOpponentId(room.winnerId);
      db.registerWin(room.winnerId);
      db.registerLoss(loserId);
      for (const pid of room.order) {
        const p = room.players[pid];
        io.to(p.socketId).emit('duel_over', {
          winnerId: room.winnerId,
          youWon: pid === room.winnerId,
        });
      }
      matchmaking.deleteRoom(room.id);
    }
  });

  socket.on('disconnect', () => {
    app.locals.onlineCount = Math.max(0, app.locals.onlineCount - 1);
    io.emit('online_update', app.locals.onlineCount);
    if (currentPlayer) matchmaking.removeFromQueue(currentPlayer.id);

    if (currentRoomId) {
      const room = matchmaking.getRoom(currentRoomId);
      if (room && !room.finished) {
        const opponentId = room.getOpponentId(socket.data.playerId);
        const opponent = room.players[opponentId];
        if (opponent) {
          db.registerWin(opponentId);
          io.to(opponent.socketId).emit('duel_over', { winnerId: opponentId, youWon: true, reason: 'opponent_left' });
        }
        matchmaking.deleteRoom(currentRoomId);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('SILENT DUEL server запущен на порту ' + PORT));

// Бот запускаем в этом же процессе, чтобы на бесплатном Render не поднимать два сервиса
require('./bot');