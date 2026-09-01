// server/db.js
// Простое хранилище игроков в JSON-файле (деньги, скины, статистика).
// Для старта достаточно файла. Позже легко заменить на настоящую БД (Postgres/Mongo).

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');

const adapter = new FileSync(path.join(__dirname, 'db.json'));
const db = low(adapter);

db.defaults({ players: {}, onlineCount: 0, totalGamesPlayed: 0 }).write();

function getPlayer(id, name) {
  let player = db.get('players').get(String(id)).value();
  if (!player) {
    player = {
      id: String(id),
      name: name || 'Стрелок',
      money: 0,
      wins: 0,
      losses: 0,
      ownedSkins: ['classic_black'], // базовый костюм есть у всех
      equippedSkin: 'classic_black',
      ownedMods: [], // например: 'fast_reload', 'steady_hand'
    };
    db.get('players').set(String(id), player).write();
  }
  return player;
}

function savePlayer(player) {
  db.get('players').set(String(player.id), player).write();
}

function addMoney(id, amount) {
  const player = getPlayer(id);
  player.money += amount;
  savePlayer(player);
  return player;
}

function registerWin(id) {
  const player = getPlayer(id);
  player.wins += 1;
  player.money += 100; // +100$ за победу
  savePlayer(player);
  return player;
}

function registerLoss(id) {
  const player = getPlayer(id);
  player.losses += 1;
  savePlayer(player);
  return player;
}

function buyItem(id, itemId, price, type) {
  const player = getPlayer(id);
  if (player.money < price) return { ok: false, error: 'Недостаточно денег' };
  const list = type === 'skin' ? player.ownedSkins : player.ownedMods;
  if (list.includes(itemId)) return { ok: false, error: 'Уже куплено' };
  player.money -= price;
  list.push(itemId);
  savePlayer(player);
  return { ok: true, player };
}

module.exports = { getPlayer, savePlayer, addMoney, registerWin, registerLoss, buyItem, db };