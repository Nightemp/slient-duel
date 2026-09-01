// server/game/Room.js
// Вся "физика" дуэли на сервере — сервер решает кто жив, кто ранен, кто умер.
// Клиент только красиво это показывает (ragdoll, кровь), но урон считает сервер,
// иначе игроки смогут читерить.

// Части тела и их "живучесть" (сколько попаданий держат, дикий запад — не с одного выстрела)
const BODY_PARTS = {
  head: { hp: 40, label: 'Голова' },
  torso: { hp: 100, label: 'Торс' },
  leftArm: { hp: 35, label: 'Левая рука' },
  rightArm: { hp: 35, label: 'Правая рука' },
  leftLeg: { hp: 45, label: 'Левая нога' },
  rightLeg: { hp: 45, label: 'Правая нога' },
};

// Урон в зависимости от части тела за одно попадание из глушителя
const DAMAGE_PER_HIT = {
  head: 40,      // выстрел в голову — почти сразу критично, но не мгновенная смерть с 1 пули по всей игре
  torso: 22,
  leftArm: 25,
  rightArm: 25,
  leftLeg: 25,
  rightLeg: 25,
};

function freshBody() {
  const body = {};
  for (const part in BODY_PARTS) {
    body[part] = { hp: BODY_PARTS[part].hp, maxHp: BODY_PARTS[part].hp, broken: false };
  }
  return body;
}

class Room {
  constructor(id, playerA, playerB) {
    this.id = id;
    this.players = {
      [playerA.id]: { ...playerA, body: freshBody(), shootingHand: 'right', canStand: true, alive: true },
      [playerB.id]: { ...playerB, body: freshBody(), shootingHand: 'right', canStand: true, alive: true },
    };
    this.order = [playerA.id, playerB.id];
    this.finished = false;
  }

  getOpponentId(id) {
    return this.order.find((pid) => pid !== id);
  }

  // Обрабатываем выстрел: shooterId попал в targetId в часть тела part
  applyHit(shooterId, targetId, part) {
    if (this.finished) return null;
    const target = this.players[targetId];
    if (!target || !target.alive) return null;
    if (!BODY_PARTS[part]) return null;

    const bodyPart = target.body[part];
    if (bodyPart.broken) {
      // по уже "отключённой" конечности можно стрелять, но это не добивает конечность дальше —
      // урон идёт в торс как компенсация (реалистичнее: расколотая кость всё равно болит)
      target.body.torso.hp -= Math.round(DAMAGE_PER_HIT[part] * 0.4);
    } else {
      bodyPart.hp -= DAMAGE_PER_HIT[part];
      if (bodyPart.hp <= 0) {
        bodyPart.hp = 0;
        bodyPart.broken = true;
        this.applyBrokenPartEffect(target, part);
      }
    }

    if (target.body.torso.hp <= 0) target.body.torso.hp = 0;

    const isDead =
      target.body.head.broken ||
      target.body.torso.hp <= 0 ||
      (target.body.leftLeg.broken && target.body.rightLeg.broken && target.body.leftArm.broken && target.body.rightArm.broken);

    if (isDead) {
      target.alive = false;
      this.finished = true;
      this.winnerId = shooterId;
    }

    return {
      targetId,
      part,
      hp: bodyPart.hp,
      broken: bodyPart.broken,
      dead: !target.alive,
      shootingHand: target.shootingHand,
      canStand: target.canStand,
    };
  }

  applyBrokenPartEffect(target, part) {
    if (part === 'rightArm') {
      target.shootingHand = 'left'; // рука упала — стреляем с другой руки
    } else if (part === 'leftArm') {
      target.shootingHand = 'right';
    } else if (part === 'leftLeg' || part === 'rightLeg') {
      target.canStand = false; // стоит/хромает на одной ноге, если сломаны обе — падает
      if (target.body.leftLeg.broken && target.body.rightLeg.broken) {
        target.alive = false;
        this.finished = true;
      }
    }
  }

  toPublicState() {
    const state = {};
    for (const id of this.order) {
      const p = this.players[id];
      state[id] = {
        name: p.name,
        equippedSkin: p.equippedSkin,
        body: p.body,
        shootingHand: p.shootingHand,
        canStand: p.canStand,
        alive: p.alive,
      };
    }
    return state;
  }
}

module.exports = { Room, BODY_PARTS, DAMAGE_PER_HIT };