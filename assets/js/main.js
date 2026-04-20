import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import Stats from "three/addons/libs/stats.module.js";

import { ANIMATIONS } from "./animations.js";

let camera;
let scene;
let renderer;
let controls;
let stats;
let clock;

let character = null;
let mixer = null;
let currentAction = null;

const actions = {};
const sceneContainer = document.getElementById("scene-container");
const currentAnimationLabel = document.getElementById("currentAnimation");

const MODEL_PATH = "assets/models/fbx/character.fbx";
const ANIMS_PATH = "assets/models/fbx/";

init();
loadCharacter();

function init() {
  clock = new THREE.Clock();

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f172a);
  scene.fog = new THREE.Fog(0x0f172a, 300, 1100);

  camera = new THREE.PerspectiveCamera(
    45,
    sceneContainer.clientWidth / sceneContainer.clientHeight,
    1,
    2000
  );
  camera.position.set(180, 140, 260);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.setAnimationLoop(animate);
  sceneContainer.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 90, 0);
  controls.enableDamping = true;
  controls.update();

  createLights();
  createFloor();

  stats = new Stats();
  document.body.appendChild(stats.dom);

  window.addEventListener("resize", onWindowResize);
  window.addEventListener("keydown", onKeyDown);
}

function createLights() {
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x223344, 2.8);
  hemiLight.position.set(0, 200, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 3.5);
  dirLight.position.set(120, 220, 120);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.top = 220;
  dirLight.shadow.camera.bottom = -180;
  dirLight.shadow.camera.left = -180;
  dirLight.shadow.camera.right = 180;
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0x88bbff, 1.2);
  fillLight.position.set(-120, 100, -80);
  scene.add(fillLight);
}

function createFloor() {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshPhongMaterial({
      color: 0x1e293b,
      depthWrite: false
    })
  );

  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(1200, 24, 0x5aa9ff, 0x355070);
  grid.material.transparent = true;
  grid.material.opacity = 0.25;
  scene.add(grid);
}

function loadCharacter() {
  const loader = new FBXLoader();

  currentAnimationLabel.textContent = "Cargando personaje...";

  loader.load(
    MODEL_PATH,
    (fbx) => {
      character = fbx;
      character.scale.setScalar(1);

      character.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Ajusta posición si hiciera falta
      character.position.set(0, 0, 0);

      scene.add(character);

      mixer = new THREE.AnimationMixer(character);

      loadAnimations();
    },
    undefined,
    (error) => {
      console.error("Error al cargar el personaje base:", error);
      currentAnimationLabel.textContent = "Error al cargar personaje";
    }
  );
}

function loadAnimations() {
  const loader = new FBXLoader();
  let loadedCount = 0;

  ANIMATIONS.forEach((animData) => {
    loader.load(
      ANIMS_PATH + animData.file,
      (animFbx) => {
        if (!animFbx.animations || animFbx.animations.length === 0) {
          console.warn(`El archivo ${animData.file} no contiene animación.`);
          loadedCount++;
          checkAllAnimationsLoaded(loadedCount);
          return;
        }

        const clip = animFbx.animations[0];
        const action = mixer.clipAction(clip);

        action.enabled = true;
        action.loop = THREE.LoopRepeat;
        action.clampWhenFinished = false;

        actions[animData.name] = action;

        loadedCount++;
        checkAllAnimationsLoaded(loadedCount);
      },
      undefined,
      (error) => {
        console.error(`Error al cargar la animación ${animData.file}:`, error);
        loadedCount++;
        checkAllAnimationsLoaded(loadedCount);
      }
    );
  });
}

function checkAllAnimationsLoaded(loadedCount) {
  if (loadedCount === ANIMATIONS.length) {
    // Iniciamos con la primera animación
    const firstAnimation = ANIMATIONS[0].name;
    playAnimation(firstAnimation, 0);
  }
}

function playAnimation(name, fadeDuration = 0.4) {
  const nextAction = actions[name];
  if (!nextAction) return;

  if (currentAction === nextAction) return;

  nextAction.reset();
  nextAction.enabled = true;
  nextAction.setEffectiveTimeScale(1);
  nextAction.setEffectiveWeight(1);

  if (currentAction) {
    currentAction.crossFadeTo(nextAction, fadeDuration, true);
  } else {
    nextAction.fadeIn(fadeDuration);
  }

  nextAction.play();
  currentAction = nextAction;
  currentAnimationLabel.textContent = name;
}

function onKeyDown(event) {
  const animation = ANIMATIONS.find((item) => item.key === event.key);

  if (!animation) return;

  playAnimation(animation.name, 0.5);
}

function onWindowResize() {
  camera.aspect = sceneContainer.clientWidth / sceneContainer.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
}

function animate() {
  const delta = clock.getDelta();

  if (mixer) {
    mixer.update(delta);
  }

  controls.update();
  renderer.render(scene, camera);
  stats.update();
}