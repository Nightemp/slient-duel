// public/js/game/Blood.js
import * as THREE from 'three';

// Простая, но эффектная система крови: при попадании выпускаем пучок
// маленьких красных плоскостей-спрайтов, которые падают и гаснут.
// Плюс — оставляем "пятно" на земле под точкой попадания.

export class BloodSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.spriteMaterial = new THREE.SpriteMaterial({ color: 0x8a0000, transparent: true, opacity: 0.9 });
  }

  spawnHit(position) {
    const count = 14;
    for (let i = 0; i < count; i++) {
      const sprite = new THREE.Sprite(this.spriteMaterial.clone());
      const scale = 0.05 + Math.random() * 0.08;
      sprite.scale.set(scale, scale, scale);
      sprite.position.copy(position);
      this.scene.add(sprite);

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2.2,
        Math.random() * 2.5,
        (Math.random() - 0.5) * 2.2
      );
      this.particles.push({ sprite, velocity, life: 1.0 });
    }
    this.spawnGroundStain(position);
  }

  spawnGroundStain(position) {
    const geo = new THREE.CircleGeometry(0.15 + Math.random() * 0.15, 12);
    const mat = new THREE.MeshBasicMaterial({ color: 0x5a0000, transparent: true, opacity: 0.7 });
    const stain = new THREE.Mesh(geo, mat);
    stain.rotation.x = -Math.PI / 2;
    stain.position.set(position.x, 0.01, position.z);
    this.scene.add(stain);
    // пятна остаются насовсем (как и должно быть в дикой пустыне после дуэли)
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.velocity.y -= 9.8 * dt; // гравитация
      p.sprite.position.addScaledVector(p.velocity, dt);
      p.life -= dt * 0.9;
      p.sprite.material.opacity = Math.max(0, p.life);

      if (p.life <= 0 || p.sprite.position.y <= 0) {
        this.scene.remove(p.sprite);
        this.particles.splice(i, 1);
      }
    }
  }
}