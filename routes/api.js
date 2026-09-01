// server/routes/api.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// Каталог магазина. type: 'skin' — косметика, 'mod' — игровая модификация.
const SHOP_ITEMS = [
  { id: 'classic_black', type: 'skin', name: 'Классический чёрный костюм', price: 0 },
  { id: 'ash_grey', type: 'skin', name: 'Пепельно-серый костюм', price: 150 },
  { id: 'crimson_lining', type: 'skin', name: 'Костюм с алой подкладкой', price: 300 },
  { id: 'desert_duster', type: 'skin', name: 'Пыльник цвета пустыни', price: 250 },
  { id: 'fast_reload', type: 'mod', name: 'Быстрая перезарядка (-30% времени)', price: 400 },
  { id: 'steady_hand', type: 'mod', name: 'Твёрдая рука (меньше разброс прицела)', price: 400 },
  { id: 'thick_coat', type: 'mod', name: 'Плотное пальто (+15% HP торса)', price: 500 },
];

// живой счётчик онлайна прокидывается из index.js через app.locals
router.get('/online', (req, res) => {
  res.json({ online: req.app.locals.onlineCount || 0 });
});

router.get('/profile/:id', (req, res) => {
  const player = db.getPlayer(req.params.id, req.query.name);
  res.json(player);
});

router.get('/shop', (req, res) => {
  res.json(SHOP_ITEMS);
});

router.post('/buy', (req, res) => {
  const { id, itemId } = req.body;
  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) return res.status(404).json({ ok: false, error: 'Товар не найден' });
  const result = db.buyItem(id, itemId, item.price, item.type);
  res.json(result);
});

router.post('/equip', (req, res) => {
  const { id, skinId } = req.body;
  const player = db.getPlayer(id);
  if (!player.ownedSkins.includes(skinId)) {
    return res.status(400).json({ ok: false, error: 'Скин не куплен' });
  }
  player.equippedSkin = skinId;
  db.savePlayer(player);
  res.json({ ok: true, player });
});

module.exports = router;