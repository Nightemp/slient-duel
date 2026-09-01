// server/game/matchmaking.js
// Простая очередь "на двоих": первый + второй игрок = дуэль.

const { Room } = require('./Room');

const queue = []; // [{ id, name, socketId }]
const rooms = new Map(); // roomId -> Room
let roomCounter = 1;

function addToQueue(player) {
  queue.push(player);
  if (queue.length >= 2) {
    const a = queue.shift();
    const b = queue.shift();
    const roomId = 'room_' + roomCounter++;
    const room = new Room(roomId, a, b);
    rooms.set(roomId, room);
    return room;
  }
  return null;
}

function removeFromQueue(id) {
  const idx = queue.findIndex((p) => p.id === id);
  if (idx !== -1) queue.splice(idx, 1);
}

function getRoom(roomId) {
  return rooms.get(roomId);
}

function findRoomByPlayer(playerId) {
  for (const room of rooms.values()) {
    if (room.players[playerId]) return room;
  }
  return null;
}

function deleteRoom(roomId) {
  rooms.delete(roomId);
}

module.exports = { addToQueue, removeFromQueue, getRoom, findRoomByPlayer, deleteRoom };