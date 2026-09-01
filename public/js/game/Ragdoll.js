// public/js/game/Ragdoll.js
import * as THREE from 'three';

// Строим гуманоидное тело из примитивов (капсулы/боксы), каждая часть — отдельный
// mesh с userData.part = 'head' | 'torso' | 'leftArm' | ... — это и есть хитбокс
// для рейкаста при стрельбе. Материалы/цвет можно заменить на GLTF-модель в чёрном
// костюме позже — сейчас это МVP-геометрия, чтобы всё физически работало уже сейчас.

const SKIN_COLORS = {
  classic_black: 0x141414,
  ash_grey: 0x555555,
  crimson_lining: 0x2a0d0d,
  desert_duster: 0x6b5636,
};

export class Ragdoll {
  constructor(skinId = 'classic_black') {
    this.group = new THREE.Group();
    this.parts = {};
    this.skinColor = SKIN_COLORS[skinId] || SKIN_COLORS.classic_black;
    this._build();
  }

  _mesh(geometry, color, part) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1 });
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.userData.part = part;
    mesh.castShadow = true;
    this.parts[part] = mesh;
    return mesh;
  }

  _build() {
    const skin = 0xd9a066; // цвет кожи для головы/кистей

    // Голова
    const head = this._mesh(new THREE.SphereGeometry(0.14, 16, 16), skin, 'head');
    head.position.set(0, 1.65, 0);
    this.group.add(head);

    // Торс
    const torso = this._mesh(new THREE.CapsuleGeometry(0.18, 0.5, 4, 8), this.skinColor, 'torso');
    torso.position.set(0, 1.25, 0);
    this.group.add(torso);

    // Руки (плечо-локоть упрощённо одной капсулой)
    const leftArm = this._mesh(new THREE.CapsuleGeometry(0.06, 0.55, 4, 8), this.skinColor, 'leftArm');
    leftArm.position.set(-0.3, 1.15, 0);
    leftArm.rotation.z = 0.15;
    this.group.add(leftArm);

    const rightArm = this._mesh(new THREE.CapsuleGeometry(0.06, 0.55, 4, 8), this.skinColor, 'rightArm');
    rightArm.position.set(0.3, 1.15, 0);
    rightArm.rotation.z = -0.15;
    this.group.add(rightArm);

    // Ноги
    const leftLeg = this._mesh(new THREE.CapsuleGeometry(0.08, 0.65, 4, 8), 0x1c1c1c, 'leftLeg');
    leftLeg.position.set(-0.12, 0.6, 0);
    this.group.add(leftLeg);

    const rightLeg = this._mesh(new THREE.CapsuleGeometry(0.08, 0.65, 4, 8), 0x1c1c1c, 'rightLeg');
    rightLeg.position.set(0.12, 0.6, 0);
    this.group.add(rightLeg);

    // Пистолеты в обеих руках (второй активируется как основной, если первую руку "выбило")
    const gunGeo = new THREE.BoxGeometry(0.04, 0.05, 0.22);
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.3 });
    this.leftGun = new THREE.Mesh(gunGeo, gunMat);
    this.leftGun.position.set(-0.3, 1.0, 0.15);
    this.rightGun = new THREE.Mesh(gunGeo, gunMat);
    this.rightGun.position.set(0.3, 1.0, 0.15);
    this.group.add(this.leftGun, this.rightGun);

    // список хитбоксов для рейкаста
    this.hitboxMeshes = [head, torso, leftArm, rightArm, leftLeg, rightLeg];

    this._basePositions = {};
    for (const key in this.parts) this._basePositions[key] = this.parts[key].position.clone();
  }

  // Применяем состояние с сервера: hp по частям + сломанные конечности + стойка
  applyState(body, shootingHand, canStand) {
    for (const part in body) {
      const mesh = this.parts[part];
      if (!mesh) continue;
      if (body[part].broken) this._breakPart(part);
    }
    this.rightGun.visible = shootingHand === 'right';
    this.leftGun.visible = shootingHand === 'left';

    if (!canStand) this._applyLimp();
  }

  _breakPart(part) {
    const mesh = this.parts[part];
    if (!mesh || mesh.userData.isBroken) return;
    mesh.userData.isBroken = true;

    if (part === 'leftArm' || part === 'rightArm') {
      // рука безвольно повисает вдоль тела
      mesh.rotation.z = part === 'leftArm' ? 1.4 : -1.4;
      mesh.rotation.x = 0.3;
      mesh.material.color.setHex(0x4a0000); // след крови/повреждения
    }
    if (part === 'leftLeg' || part === 'rightLeg') {
      mesh.rotation.z = part === 'leftLeg' ? 0.6 : -0.6;
      mesh.material.color.setHex(0x4a0000);
    }
    if (part === 'head') {
      this.group.rotation.x = 1.2; // голова "падает"
    }
  }

  // Если одна нога сломана — персонаж стоит на одной ноге и слегка наклонён (хромает)
  _applyLimp() {
    this.group.position.y -= 0.06;
    this.group.rotation.z = (Math.random() > 0.5 ? 1 : -1) * 0.08;
  }

  getWorldHitPoint(part) {
    const mesh = this.parts[part];
    const pos = new THREE.Vector3();
    mesh.getWorldPosition(pos);
    return pos;
  }
}