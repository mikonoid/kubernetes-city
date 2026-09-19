import './style.css';
import * as THREE from 'three';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root not found');
}

app.innerHTML = `
  <div class="layout">
    <aside class="hud">
      <p class="eyebrow">Kubernetes City</p>
      <h1>Static 3D Kubernetes simulator</h1>
      <p class="lede">
        This starter runs entirely in the browser and is ready for GitHub Pages.
      </p>
      <ul class="legend">
        <li><span class="dot control-plane"></span> Control plane</li>
        <li><span class="dot node"></span> Worker nodes</li>
        <li><span class="dot pod"></span> Pods</li>
      </ul>
    </aside>
    <main class="viewport">
      <canvas id="scene"></canvas>
    </main>
  </div>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#scene');

if (!canvas) {
  throw new Error('Scene canvas not found');
}

const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x0a1220);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0a1220, 18, 42);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(8, 9, 14);
camera.lookAt(0, 0, 0);

const ambientLight = new THREE.AmbientLight(0xbfd4ff, 1.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2.2);
directionalLight.position.set(10, 16, 8);
scene.add(directionalLight);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(16, 64),
  new THREE.MeshStandardMaterial({ color: 0x122033, roughness: 0.95, metalness: 0.05 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1.6;
scene.add(ground);

const grid = new THREE.GridHelper(28, 28, 0x28435f, 0x1a2b42);
grid.position.y = -1.58;
scene.add(grid);

function makeBlock(width: number, height: number, depth: number, color: number) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.2 })
  );
}

const controlPlane = makeBlock(4.8, 2.8, 4.8, 0xe85d3f);
controlPlane.position.set(0, 0, -4);
scene.add(controlPlane);

const nodePositions = [-5.5, 0, 5.5];
const nodes = nodePositions.map((x) => {
  const node = makeBlock(3.2, 2.2, 3.2, 0x4aa3a2);
  node.position.set(x, -0.3, 3.2);
  scene.add(node);
  return node;
});

const pods: THREE.Mesh[] = [];
nodes.forEach((node, nodeIndex) => {
  for (let index = 0; index < 2; index += 1) {
    const pod = makeBlock(0.9, 0.7, 0.9, 0xf3c969);
    pod.position.set(node.position.x - 0.7 + index * 1.4, 1.35, node.position.z);
    pod.userData = { phase: (index + nodeIndex) * 0.6 };
    scene.add(pod);
    pods.push(pod);
  }
});

const flowMaterial = new THREE.MeshBasicMaterial({ color: 0x8cc8ff });
const flows = nodes.map((node, index) => {
  const flow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 20), flowMaterial);
  flow.userData = {
    start: new THREE.Vector3(0, 0.6, -1.4),
    end: new THREE.Vector3(node.position.x, 0.9, node.position.z - 1),
    offset: index / nodes.length,
  };
  scene.add(flow);
  return flow;
});

const clock = new THREE.Clock();

function animate() {
  const elapsed = clock.getElapsedTime();

  controlPlane.rotation.y = elapsed * 0.18;

  nodes.forEach((node, index) => {
    node.scale.y = 1 + Math.sin(elapsed * 1.2 + index * 0.8) * 0.04;
  });

  pods.forEach((pod) => {
    const phase = Number(pod.userData.phase ?? 0);
    pod.position.y = 1.25 + Math.sin(elapsed * 2.4 + phase) * 0.18;
  });

  flows.forEach((flow) => {
    const { start, end, offset } = flow.userData as {
      start: THREE.Vector3;
      end: THREE.Vector3;
      offset: number;
    };
    const t = (elapsed * 0.22 + offset) % 1;
    flow.position.lerpVectors(start, end, t);
  });

  scene.rotation.y = Math.sin(elapsed * 0.16) * 0.12;
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});
