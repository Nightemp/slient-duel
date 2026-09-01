// server/bot.js
const { Bot, InlineKeyboard } = require('grammy');

const BOT_TOKEN = process.env.BOT_TOKEN;
const APP_URL = process.env.APP_URL;

if (!BOT_TOKEN) {
  console.warn('BOT_TOKEN не задан — бот не запущен (сайт при этом всё равно работает).');
  module.exports = null;
  return;
}

const bot = new Bot(BOT_TOKEN);

bot.command('start', async (ctx) => {
  const keyboard = new InlineKeyboard().webApp('🔫 Начать дуэль', APP_URL);
  await ctx.reply(
    'SILENT DUEL 🤠\n\nОдин на один. Пистолеты с глушителем. Пыльная улица на закате.\nПобеждает не тот, кто выстрелил первым — а тот, кто остался стоять.\n\nНажми кнопку ниже, чтобы выйти на площадь.',
    { reply_markup: keyboard }
  );
});

bot.catch((err) => console.error('Ошибка бота:', err));

bot.start();
console.log('Telegram-бот запущен');

module.exports = bot;