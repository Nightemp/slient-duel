// public/js/game/Scene.js
import * as THREE from 'three';
import { Ragdoll } from './Ragdoll.js';
import { BloodSystem } from './Blood.js';

export class DuelScene {
  constructor(canvas, { mySkin, enemySkin }, onShootHit) {
    this.onShootHit = onShootHit;
    this.clock = new THREE.Clock();

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    this.scene = new THREE.Scene();
    this._buildSky();
    this._buildGround();
    this._buildLights();

    // Камера от первого лица — стоит на месте локального игрока
    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 200);
    this.camera.position.set(0, 1.6, 4); // локальный игрок стоит тут, смотрит на соперника
    this.camera.lookAt(0, 1.3, -4);

    // Соперник — стоит напротив, в 8 метрах, как в дуэли на площади
    this.enemy = new Ragdoll(enemySkin);
    this.enemy.group.position.set(0, 0, -8);
    this.enemy.group.rotation.y = Math.PI;
    this.scene.add(this.enemy.group);

    // Наши руки/пистолет в кадре (простая заглушка, для реального вида — заменить на GLTF-руки)
    this._buildViewmodel();

    this.blood = new BloodSystem(this.scene);

    this.raycaster = new THREE.Raycaster();
    canvas.addEventListener('click', () => this._tryShoot());

    window.addEventListener('resize', () => this._onResize());
    this._animate();
  }

  _buildSky() {
    this.scene.background = new THREE.Color(0xd98a4a); // закатное небо дикого запада
    const fog = new THREE.Fog(0xd98a4a, 10, 60);
    this.scene.fog = fog;
  }

  _buildGround() {
    const geo = new THREE.PlaneGeometry(60, 60);
    const mat = new THREE.MeshStandardMaterial({ color: 0xa9865a, roughness: 1 });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  _buildLights() {
    const sun = new THREE.DirectionalLight(0xffddaa, 1.4);
    sun.position.set(-10, 12, 5);
    sun.castShadow = true;
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  }

  _buildViewmodel() {
    const gunGeo = new THREE.BoxGeometry(0.05, 0.07, 0.28);
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, metalness: 0.9, roughness: 0.2 });
    this.viewGun = new THREE.Mesh(gunGeo, gunMat);
    this.viewGun.position.set(0.18, -0.18, -0.4);
    this.camera.add(this.viewGun);
    this.scene.add(this.camera);
  }

  setShootingHandView(hand) {
    // если нашу руку выбили — пистолет в кадре смещается на другую сторону
    this.viewGun.position.x = hand === 'right' ? 0.18 : -0.18;
  }

  _tryShoot() {
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera); // стреляем строго по центру прицела
    const hits = this.raycaster.intersectObjects(this.enemy.hitboxMeshes);
    if (hits.length > 0) {
      const part = hits[0].object.userData.part;
      const point = hits[0].point;
      this.onShootHit(part, point);
    }
  }

  applyEnemyHit(part, worldPointGuess) {
    const point = this.enemy.getWorldHitPoint(part);
    this.blood.spawnHit(point);
  }

  applyEnemyState(body, shootingHand, canStand) {
    this.enemy.applyState(body, shootingHand, canStand);
  }

  _onResize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    const dt = this.clock.getDelta();
    this.blood.update(dt);
    this.renderer.render(this.scene, this.camera);
  }
}