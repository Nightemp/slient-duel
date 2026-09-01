// public/js/main.js
import { DuelScene } from './game/Scene.js';
import { renderBodyHpPanel, setOnlineCount, setMoney } from './game/UI.js';
import { loadShop } from './game/Shop.js';

const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const tgUser = tg?.initDataUnsafe?.user;
const playerId = tgUser?.id || 'guest_' + Math.floor(Math.random() * 1e9);
const playerName = tgUser?.first_name || 'Стрелок';

let myProfile = null;
let scene = null;
let roomId = null;
let myId = null;
let enemyId = null;

const socket = io();

const screens = {
  menu: document.getElementById('menu-screen'),
  queue: document.getElementById('queue-screen'),
  shop: document.getElementById('shop-screen'),
  game: document.getElementById('game-screen'),
  result: document.getElementById('result-screen'),
};
function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.add('hidden'));
  screens[name].classList.remove('hidden');
}

async function loadProfile() {
  const res = await fetch(`/api/profile/${playerId}?name=${encodeURIComponent(playerName)}`);
  myProfile = await res.json();
  setMoney(myProfile.money);
  document.getElementById('stats-line').textContent = `Побед: ${myProfile.wins} · Поражений: ${myProfile.losses}`;
}
loadProfile();

socket.on('online_update', (n) => setOnlineCount(n));

document.getElementById('btn-play').onclick = () => {
  showScreen('queue');
  socket.emit('join_queue', { id: playerId, name: playerName });
};

document.getElementById('btn-cancel-queue').onclick = () => {
  socket.emit('cancel_queue');
  showScreen('menu');
};

document.getElementById('btn-shop').onclick = async () => {
  showScreen('shop');
  await loadShop(playerId, myProfile, (updated) => {
    myProfile = updated;
    setMoney(myProfile.money);
    loadShop(playerId, myProfile, arguments.callee);
  });
};
document.getElementById('btn-shop-back').onclick = () => showScreen('menu');

socket.on('match_found', ({ roomId: rid, you, opponent, state }) => {
  roomId = rid;
  myId = you;
  enemyId = opponent;
  showScreen('game');

  const canvas = document.getElementById('game-canvas');
  scene = new DuelScene(
    canvas,
    { mySkin: myProfile.equippedSkin, enemySkin: state[enemyId].equippedSkin },
    (part, point) => {
      socket.emit('shoot', { roomId, targetId: enemyId, part });
    }
  );

  renderBodyHpPanel(state[enemyId].body);
});

socket.on('queue_waiting', () => {
  // просто ждём — экран очереди уже показан
});

socket.on('hit_update', ({ shooterId, targetId, part, hp, broken, dead, shootingHand, canStand }) => {
  if (targetId === enemyId) {
    scene.applyEnemyHit(part);
    scene.applyEnemyState({ [part]: { hp, maxHp: 1, broken } }, shootingHand, canStand);
    // обновляем полную полоску — для простоты запрашиваем локально пересчитанное состояние
    const bar = document.querySelectorAll('.hp-bar-fill');
    // (в этом MVP полосу просто перерисовываем по последнему известному состоянию каждой части)
  }
  if (targetId === myId) {
    // по нам попали — тоже показываем на нашей стороне (тряска камеры/красная вспышка можно добавить)
    if (shootingHand) scene.setShootingHandView(shootingHand);
  }
});

socket.on('duel_over', ({ winnerId, youWon, reason }) => {
  document.getElementById('result-title').textContent = youWon ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ';
  document.getElementById('result-sub').textContent = youWon
    ? '+100$ на счёт'
    : reason === 'opponent_left'
    ? 'Соперник покинул дуэль'
    : 'В следующий раз повезёт больше';
  showScreen('result');
  loadProfile();
});

document.getElementById('btn-result-continue').onclick = () => showScreen('menu');