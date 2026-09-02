cat > /home/claude/silent-duel/server/index.js << 'EOF'
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
const { DIFFICULTY_SETTINGS, pickRandomPart } = require('./game/BotPlayer');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api', apiRoutes);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.locals.onlineCount = 0;

// Сколько ждём реального соперника, прежде чем подставить бота
const BOT_FALLBACK_MS = 6000;

function getSocket(socketId) {
  return socketId ? io.sockets.sockets.get(socketId) : null;
}

// Общий запуск комнаты — не важно, живой там соперник или бот
function onRoomStart(room) {
  for (const pid of room.order) {
    const p = room.players[pid];
    if (!p.socketId) continue; // это бот, у него нет сокета
    const s = getSocket(p.socketId);
    if (!s) continue;
    s.data.playerId = pid;
    s.data.roomId = room.id;
    s.emit('match_found', {
      roomId: room.id,
      you: pid,
      opponent: room.getOpponentId(pid),
      state: room.toPublicState(),
    });
  }

  if (room.isBotRoom) startBotLoop(room);
}

// Единая обработка выстрела — используется и для игрока, и для бота,
// чтобы урон, победа и рассылка считались одинаково в обоих случаях.
function processHit(room, shooterId, targetId, part) {
  const result = room.applyHit(shooterId, targetId, part);
  if (!result) return;

  for (const pid of room.order) {
    const p = room.players[pid];
    if (!p.socketId) continue;
    const s = getSocket(p.socketId);
    if (s) s.emit('hit_update', { shooterId, ...result });
  }

  if (room.finished) finishRoom(room);
}

function finishRoom(room) {
  const loserId = room.getOpponentId(room.winnerId);
  const winner = room.players[room.winnerId];
  const loser = room.players[loserId];

  if (!winner.isBot) db.registerWin(room.winnerId);
  if (!loser.isBot) db.registerLoss(loserId);

  for (const pid of room.order) {
    const p = room.players[pid];
    if (!p.socketId) continue;
    const s = getSocket(p.socketId);
    if (s) {
      s.emit('duel_over', {
        winnerId: room.winnerId,
        youWon: pid === room.winnerId,
        vsBot: winner.isBot || loser.isBot,
      });
    }
  }

  if (room.botLoopTimer) clearTimeout(room.botLoopTimer);
  matchmaking.deleteRoom(room.id);
}

// Бот стреляет через случайные промежутки времени, иногда мажет —
// не как снайпер-читер, а как живой (не очень меткий) противник.
function startBotLoop(room) {
  const botId = room.botId;
  const humanId = room.getOpponentId(botId);
  const settings = DIFFICULTY_SETTINGS[room.players[botId].difficulty] || DIFFICULTY_SETTINGS.normal;

  const fire = () => {
    if (room.finished) return;
    if (Math.random() <= settings.accuracy) {
      processHit(room, botId, humanId, pickRandomPart());
    }
    if (!room.finished) {
      const delay = settings.minDelay + Math.random() * (settings.maxDelay - settings.minDelay);
      room.botLoopTimer = setTimeout(fire, delay);
    }
  };

  room.botLoopTimer = setTimeout(fire, settings.minDelay);
}

io.on('connection', (socket) => {
  app.locals.onlineCount++;
  io.emit('online_update', app.locals.onlineCount);

  let currentPlayer = null;

  socket.on('join_queue', ({ id, name }) => {
    const player = db.getPlayer(id, name);
    currentPlayer = { id: player.id, name: player.name, socketId: socket.id };
    socket.data.playerId = player.id;

    const room = matchmaking.addToQueue(currentPlayer);
    if (room) {
      onRoomStart(room);
      return;
    }

    socket.emit('queue_waiting');

    // если за BOT_FALLBACK_MS никто не найдётся — подставляем бота
    socket.data.botFallbackTimer = setTimeout(() => {
      const stillWaiting = matchmaking.removeFromQueueIfPresent(currentPlayer.id);
      if (stillWaiting) {
        const botRoom = matchmaking.createBotRoom(currentPlayer, 'normal');
        onRoomStart(botRoom);
      }
    }, BOT_FALLBACK_MS);
  });

  // мгновенная дуэль с ботом по кнопке, без ожидания
  socket.on('play_vs_bot', ({ id, name, difficulty }) => {
    clearTimeout(socket.data.botFallbackTimer);
    matchmaking.removeFromQueueIfPresent(id);

    const player = db.getPlayer(id, name);
    currentPlayer = { id: player.id, name: player.name, socketId: socket.id };
    socket.data.playerId = player.id;

    const botRoom = matchmaking.createBotRoom(currentPlayer, difficulty || 'normal');
    onRoomStart(botRoom);
  });

  socket.on('cancel_queue', () => {
    clearTimeout(socket.data.botFallbackTimer);
    if (currentPlayer) matchmaking.removeFromQueueIfPresent(currentPlayer.id);
  });

  socket.on('shoot', ({ roomId, targetId, part }) => {
    const room = matchmaking.getRoom(roomId);
    if (!room || !socket.data.playerId) return;
    processHit(room, socket.data.playerId, targetId, part);
  });

  socket.on('disconnect', () => {
    app.locals.onlineCount = Math.max(0, app.locals.onlineCount - 1);
    io.emit('online_update', app.locals.onlineCount);
    clearTimeout(socket.data.botFallbackTimer);
    if (currentPlayer) matchmaking.removeFromQueueIfPresent(currentPlayer.id);

    const roomId = socket.data.roomId;
    if (roomId) {
      const room = matchmaking.getRoom(roomId);
      if (room && !room.finished) {
        const opponentId = room.getOpponentId(socket.data.playerId);
        const opponent = room.players[opponentId];
        if (opponent && !opponent.isBot) {
          db.registerWin(opponentId);
          const s = getSocket(opponent.socketId);
          if (s) s.emit('duel_over', { winnerId: opponentId, youWon: true, reason: 'opponent_left' });
        }
        if (room.botLoopTimer) clearTimeout(room.botLoopTimer);
        matchmaking.deleteRoom(roomId);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('SILENT DUEL server запущен на порту ' + PORT));

// Телеграм-бот-приложение (не путать с ботами-соперниками в дуэли)
require('./bot');
EOF
echo done