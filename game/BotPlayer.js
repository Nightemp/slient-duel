// server/game/BotPlayer.js
// Виртуальный соперник — используется, когда живой игрок не найден за разумное время,
// либо когда игрок сам жмёт "Играть с ботом".

const BOT_NAMES = [
  'Тень с ранчо',
  'Одноглазый Санчес',
  'Хромой Койот',
  'Вдова Джонсон',
  'Мясник из Тумбстоуна',
  'Пыльный Пит',
  'Гробовщик Мо',
];

let botCounter = 1;

function createBotOpponent(difficulty = 'normal') {
  return {
    id: 'bot_' + botCounter++,
    name: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)],
    isBot: true,
    socketId: null,
    difficulty,
  };
}

// Настройки поведения бота: точность попадания и разброс задержки между выстрелами (мс)
const DIFFICULTY_SETTINGS = {
  easy: { accuracy: 0.4, minDelay: 1800, maxDelay: 3000 },
  normal: { accuracy: 0.6, minDelay: 1300, maxDelay: 2200 },
  hard: { accuracy: 0.8, minDelay: 900, maxDelay: 1500 },
};

const BODY_PARTS = ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];

function pickRandomPart() {
  return BODY_PARTS[Math.floor(Math.random() * BODY_PARTS.length)];
}

module.exports = { createBotOpponent, DIFFICULTY_SETTINGS, pickRandomPart };