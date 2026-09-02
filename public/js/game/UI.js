// public/js/game/UI.js

const PART_LABELS = {
  head: 'Голова',
  torso: 'Торс',
  leftArm: 'Л.рука',
  rightArm: 'П.рука',
  leftLeg: 'Л.нога',
  rightLeg: 'П.нога',
};

export function renderBodyHpPanel(body) {
  const panel = document.getElementById('body-hp-panel');
  panel.innerHTML = '';
  for (const part in body) {
    const { hp, maxHp, broken } = body[part];
    const pct = Math.max(0, Math.round((hp / maxHp) * 100));

    const wrap = document.createElement('div');
    wrap.className = 'hp-part';

    const label = document.createElement('div');
    label.textContent = PART_LABELS[part] || part;

    const barBg = document.createElement('div');
    barBg.className = 'hp-bar-bg';
    const barFill = document.createElement('div');
    barFill.className = 'hp-bar-fill';
    barFill.style.width = pct + '%';
    if (broken) barFill.style.background = '#444';

    barBg.appendChild(barFill);
    wrap.appendChild(label);
    wrap.appendChild(barBg);
    panel.appendChild(wrap);
  }
}

export function setOnlineCount(n) {
  document.getElementById('online-count').textContent = n;
}

export function setMoney(n) {
  document.getElementById('money-count').textContent = n;
}