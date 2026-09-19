import './style.css';
import iconSet from '@iconify-json/k8s/icons.json';

/* ------------------------------------------------------------------ */
/*  Icon helpers                                                       */
/* ------------------------------------------------------------------ */

type IconEntry = { body: string; width?: number; height?: number };

const ICON_SET_W = (iconSet as { width: number }).width;
const ICON_SET_H = (iconSet as { height: number }).height;
const ICONS = (iconSet as { icons: Record<string, IconEntry> }).icons;

function iconSvg(name: string, size: number, color = '#e5edff'): string {
  const entry = ICONS[name];
  if (!entry) return '';
  const w = entry.width ?? ICON_SET_W;
  const h = entry.height ?? ICON_SET_H;
  return `<svg viewBox="0 0 ${w} ${h}" width="${size}" height="${size}" fill="${color}" xmlns="http://www.w3.org/2000/svg">${entry.body}</svg>`;
}

/* ------------------------------------------------------------------ */
/*  Scenario                                                           */
/* ------------------------------------------------------------------ */

type StepId =
  | 'kubectl'
  | 'api'
  | 'etcd'
  | 'controller'
  | 'scheduler'
  | 'kubelet'
  | 'runtime'
  | 'ready';

type Step = {
  id: StepId;
  title: string;
  desc: string;
  ms: number;
  path: string; // id of the connection path (SVG element id)
  highlight: string[]; // ids of components to highlight
};

/* IDs used throughout */
const N_TARGET = 'node2'; // middle node = deployment target

const STEPS: Step[] = [
  {
    id: 'kubectl',
    title: '1. kubectl apply',
    desc: 'User submits a Deployment manifest to the API server.',
    ms: 2400,
    path: 'p-user-api',
    highlight: ['user', 'api'],
  },
  {
    id: 'api',
    title: '2. API Server writes to etcd',
    desc: 'kube-apiserver validates and persists the object into etcd.',
    ms: 2400,
    path: 'p-api-etcd',
    highlight: ['api', 'etcd'],
  },
  {
    id: 'etcd',
    title: '3. etcd confirms the write',
    desc: 'etcd stores the desired state and acknowledges the API server.',
    ms: 2400,
    path: 'p-etcd-api',
    highlight: ['etcd', 'api'],
  },
  {
    id: 'controller',
    title: '4. Controller Manager reconciles',
    desc: 'Deployment → ReplicaSet → Pod objects are created.',
    ms: 2600,
    path: 'p-api-controller',
    highlight: ['api', 'controller'],
  },
  {
    id: 'scheduler',
    title: '5. Scheduler picks a node',
    desc: 'kube-scheduler scores nodes and binds the pending pod.',
    ms: 2600,
    path: 'p-controller-scheduler',
    highlight: ['controller', 'scheduler'],
  },
  {
    id: 'kubelet',
    title: '6. Kubelet accepts the pod',
    desc: 'Kubelet on the chosen node pulls the pod spec from API server.',
    ms: 2600,
    path: `p-scheduler-${N_TARGET}`,
    highlight: ['scheduler', N_TARGET],
  },
  {
    id: 'runtime',
    title: '7. Container runtime starts pod',
    desc: 'containerd creates the sandbox and starts containers.',
    ms: 2400,
    path: `p-${N_TARGET}-newpod`,
    highlight: [N_TARGET],
  },
  {
    id: 'ready',
    title: '8. Pod is Ready',
    desc: 'Pod passes readiness probes and joins the Service.',
    ms: 3000,
    path: 'p-idle',
    highlight: [N_TARGET, 'api'],
  },
];

/* ------------------------------------------------------------------ */
/*  Geometry                                                           */
/* ------------------------------------------------------------------ */

const VBW = 1200;
const VBH = 780;

const cp = { x: 130, y: 130, w: 940, h: 210 };
const nodes = {
  y: 470,
  h: 260,
  boxes: [
    { id: 'node1', label: 'Worker Node 1', x: 460, w: 200 },
    { id: 'node2', label: 'Worker Node 2', x: 680, w: 200 },
    { id: 'node3', label: 'Worker Node 3', x: 900, w: 200 },
  ],
};

/* Component slots inside control plane */
const CP_COMPONENTS = [
  { id: 'api',        icon: 'api-server',         label: 'API Server',         sub: 'kube-apiserver' },
  { id: 'etcd',       icon: 'etcd-cluster',       label: 'etcd',               sub: 'key-value store' },
  { id: 'controller', icon: 'controller-manager', label: 'Controller Manager', sub: 'kube-controller-manager' },
  { id: 'scheduler',  icon: 'scheduler',          label: 'Scheduler',          sub: 'kube-scheduler' },
];

/* Compute the pixel center of each control-plane component */
type Slot = { id: string; cx: number; cy: number; x: number; y: number; w: number; h: number };

function cpSlots(): Slot[] {
  const gap = 24;
  const inner = cp.w - 2 * 20;
  const each = (inner - gap * (CP_COMPONENTS.length - 1)) / CP_COMPONENTS.length;
  const y0 = cp.y + 60;
  const h = cp.h - 80;
  return CP_COMPONENTS.map((c, i) => {
    const x = cp.x + 20 + i * (each + gap);
    return { id: c.id, x, y: y0, w: each, h, cx: x + each / 2, cy: y0 + h / 2 };
  });
}

const CP_SLOTS = cpSlots();

/* Pod slot positions inside a node */
type PodSlot = { cx: number; cy: number };
function podSlots(nx: number, ny: number, w: number, h: number): PodSlot[] {
  const px = nx + w / 2 - 90;
  const py = ny + h - 70;
  const slots: PodSlot[] = [];
  for (let i = 0; i < 3; i++) {
    slots.push({ cx: px + i * 60, cy: py });
  }
  slots.push({ cx: px + 60, cy: py - 60 }); // slot 3 = new pod (top row)
  return slots;
}

/* ------------------------------------------------------------------ */
/*  Build the SVG scene                                                */
/* ------------------------------------------------------------------ */

const app = document.querySelector<HTMLDivElement>('#app')!;

const userBox = { x: 520, y: 20, w: 160, h: 70 };

function componentBox(slot: Slot, comp: typeof CP_COMPONENTS[number]) {
  const iconSize = 48;
  return `
    <g class="comp" data-id="${comp.id}" data-cx="${slot.cx}" data-cy="${slot.cy}">
      <rect class="comp-bg" x="${slot.x}" y="${slot.y}" width="${slot.w}" height="${slot.h}" rx="14" ry="14"></rect>
      <g class="comp-icon" transform="translate(${slot.cx - iconSize / 2}, ${slot.y + 24})">
        ${iconSvg(comp.icon, iconSize, '#7dd3fc')}
      </g>
      <text class="comp-title" x="${slot.cx}" y="${slot.y + 24 + iconSize + 26}" text-anchor="middle">${comp.label}</text>
      <text class="comp-sub"   x="${slot.cx}" y="${slot.y + 24 + iconSize + 46}" text-anchor="middle">${comp.sub}</text>
    </g>`;
}

function nodeBox(n: typeof nodes.boxes[number]) {
  const y = nodes.y;
  const h = nodes.h;
  const inner = n.w - 32;
  const rowY = y + 60;
  const iconSize = 24;

  const podSlotsPx = podSlots(n.x, y, n.w, h);
  const podHtml = podSlotsPx
    .slice(0, 3)
    .map(
      (p, i) => `
      <g class="pod" data-node="${n.id}" data-idx="${i}">
        <rect x="${p.cx - 26}" y="${p.cy - 26}" width="52" height="52" rx="10" ry="10"></rect>
        <g transform="translate(${p.cx - 16}, ${p.cy - 16})">${iconSvg('pod', 32, '#fbbf24')}</g>
      </g>`,
    )
    .join('');

  const newPodSlot = podSlotsPx[3];

  return `
    <g class="node" data-id="${n.id}" data-cx="${n.x + n.w / 2}" data-cy="${y + 40}">
      <rect class="node-bg" x="${n.x}" y="${y}" width="${n.w}" height="${h}" rx="18" ry="18"></rect>
      <text class="node-title" x="${n.x + 16}" y="${y + 30}">${n.label}</text>

      <g class="node-modules" transform="translate(${n.x + 16}, ${rowY - 10})">
        <g transform="translate(0, 0)">${iconSvg('kubelet', iconSize, '#a5f3fc')}</g>
        <text class="mod-text" x="${iconSize + 8}" y="${iconSize - 6}">kubelet</text>

        <g transform="translate(${(inner) / 2}, 0)">${iconSvg('kube-proxy', iconSize, '#a5f3fc')}</g>
        <text class="mod-text" x="${(inner) / 2 + iconSize + 8}" y="${iconSize - 6}">kube-proxy</text>
      </g>

      <text class="node-hint" x="${n.x + 16}" y="${y + h - 12}">Container runtime · pods</text>

      ${podHtml}

      <!-- placeholder for new pod (invisible until step 7) -->
      <g class="pod new-pod" data-node="${n.id}" data-cx="${newPodSlot.cx}" data-cy="${newPodSlot.cy}">
        <rect x="${newPodSlot.cx - 26}" y="${newPodSlot.cy - 26}" width="52" height="52" rx="10" ry="10"></rect>
        <g transform="translate(${newPodSlot.cx - 16}, ${newPodSlot.cy - 16})">${iconSvg('pod', 32, '#22d3ee')}</g>
      </g>
    </g>`;
}

/* Paths between elements (as SVG path strings; used for animation) */
const componentCenter: Record<string, { x: number; y: number; topX: number; topY: number; botX: number; botY: number }> = {};
for (const slot of CP_SLOTS) {
  componentCenter[slot.id] = {
    x: slot.cx,
    y: slot.cy,
    topX: slot.cx,
    topY: slot.y,
    botX: slot.cx,
    botY: slot.y + slot.h,
  };
}
for (const n of nodes.boxes) {
  componentCenter[n.id] = {
    x: n.x + n.w / 2,
    y: nodes.y + nodes.h / 2,
    topX: n.x + n.w / 2,
    topY: nodes.y,
    botX: n.x + n.w / 2,
    botY: nodes.y + nodes.h,
  };
}
componentCenter['user'] = {
  x: userBox.x + userBox.w / 2,
  y: userBox.y + userBox.h / 2,
  topX: userBox.x + userBox.w / 2,
  topY: userBox.y,
  botX: userBox.x + userBox.w / 2,
  botY: userBox.y + userBox.h,
};

function connector(id: string, fromId: string, toId: string, opts?: { fromEdge?: 'top' | 'bot'; toEdge?: 'top' | 'bot'; curve?: number }) {
  const a = componentCenter[fromId];
  const b = componentCenter[toId];
  const fromEdge = opts?.fromEdge ?? 'bot';
  const toEdge = opts?.toEdge ?? 'top';
  const curve = opts?.curve ?? 40;

  const ax = fromEdge === 'top' ? a.topX : a.botX;
  const ay = fromEdge === 'top' ? a.topY : a.botY;
  const bx = toEdge === 'top' ? b.topX : b.botX;
  const by = toEdge === 'top' ? b.topY : b.botY;

  const midX = (ax + bx) / 2;
  const midY = (ay + by) / 2 - curve;

  return `<path id="${id}" class="link" d="M ${ax} ${ay} Q ${midX} ${midY} ${bx} ${by}" fill="none"></path>`;
}

/* Build the whole DOM */

app.innerHTML = `
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <span class="brand-dot"></span>
        <span class="brand-name">Kubernetes City</span>
        <span class="brand-tag">2D · Cluster Flow</span>
      </div>
      <div class="controls">
        <button id="btn-play" class="btn btn-primary" type="button">Pause</button>
        <button id="btn-reset" class="btn" type="button">Replay</button>
      </div>
    </header>

    <div class="scene-wrap">
      <svg id="scene" viewBox="0 0 ${VBW} ${VBH}" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="cp-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#1e3a5c"/>
            <stop offset="1" stop-color="#122544"/>
          </linearGradient>
          <linearGradient id="node-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#0f3a30"/>
            <stop offset="1" stop-color="#0a2620"/>
          </linearGradient>
          <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <!-- USER -->
        <g class="comp comp-user" data-id="user">
          <rect class="comp-bg user-bg" x="${userBox.x}" y="${userBox.y}" width="${userBox.w}" height="${userBox.h}" rx="14" ry="14"></rect>
          <g transform="translate(${userBox.x + 12}, ${userBox.y + 15})">${iconSvg('user', 40, '#7dd3fc')}</g>
          <text class="comp-title" x="${userBox.x + 66}" y="${userBox.y + 35}">User</text>
          <text class="comp-sub"   x="${userBox.x + 66}" y="${userBox.y + 55}">kubectl apply</text>
        </g>

        <!-- CONTROL PLANE -->
        <g class="cluster cluster-cp">
          <rect class="cluster-bg" fill="url(#cp-grad)" x="${cp.x}" y="${cp.y}" width="${cp.w}" height="${cp.h}" rx="20" ry="20"></rect>
          <text class="cluster-title" x="${cp.x + 24}" y="${cp.y + 34}">Control Plane</text>
          <text class="cluster-sub"   x="${cp.x + cp.w - 24}" y="${cp.y + 34}" text-anchor="end">master node</text>
          ${CP_SLOTS.map((s, i) => componentBox(s, CP_COMPONENTS[i])).join('')}
        </g>

        <!-- WORKER NODES -->
        <g class="cluster cluster-nodes">
          ${nodes.boxes.map((n) => nodeBox(n)).join('')}
        </g>

        <!-- CONNECTORS (drawn below components but computed from centers) -->
        <g class="links">
          ${connector('p-user-api',      'user',       'api',        { fromEdge: 'bot', toEdge: 'top', curve: 30 })}
          ${connector('p-api-etcd',      'api',        'etcd',       { fromEdge: 'top', toEdge: 'top', curve: -60 })}
          ${connector('p-etcd-api',      'etcd',       'api',        { fromEdge: 'top', toEdge: 'top', curve: -80 })}
          ${connector('p-api-controller','api',        'controller', { fromEdge: 'top', toEdge: 'top', curve: -110 })}
          ${connector('p-controller-scheduler','controller','scheduler', { fromEdge: 'top', toEdge: 'top', curve: -80 })}
          ${connector('p-scheduler-node1','scheduler', 'node1', { fromEdge: 'bot', toEdge: 'top', curve: 60 })}
          ${connector('p-scheduler-node2','scheduler', 'node2', { fromEdge: 'bot', toEdge: 'top', curve: 40 })}
          ${connector('p-scheduler-node3','scheduler', 'node3', { fromEdge: 'bot', toEdge: 'top', curve: 60 })}
          <path id="p-node2-newpod" class="link" fill="none"
                d="M ${componentCenter['node2'].x} ${nodes.y + 100} L ${(function(){
                    const n = nodes.boxes[1];
                    const ps = podSlots(n.x, nodes.y, n.w, nodes.h);
                    return ps[3].cx;
                  })()} ${(function(){
                    const n = nodes.boxes[1];
                    const ps = podSlots(n.x, nodes.y, n.w, nodes.h);
                    return ps[3].cy;
                  })()}"></path>
          <path id="p-idle" class="link" fill="none" d="M 0 0 L 0 0"></path>
        </g>

        <!-- PACKET (animated dot) -->
        <g id="packet-group" class="packet" style="display:none">
          <circle id="packet-halo" r="16" cx="0" cy="0" fill="#7dd3fc" opacity="0.18"></circle>
          <circle id="packet"      r="7"  cx="0" cy="0" fill="#7dd3fc" filter="url(#glow)"></circle>
        </g>
      </svg>
    </div>

    <section class="story">
      <div class="story-card">
        <div class="story-label">Live scenario</div>
        <h1 id="step-title"></h1>
        <p id="step-desc"></p>
        <ol id="step-list" class="step-list">
          ${STEPS.map(
            (s, i) => `
            <li data-idx="${i}">
              <span class="idx">${i + 1}</span>
              <span class="txt">${s.title.replace(/^\d+\.\s*/, '')}</span>
            </li>`,
          ).join('')}
        </ol>
      </div>
    </section>

    <footer class="legend">
      <span class="lg lg-cp">Control Plane</span>
      <span class="lg lg-node">Worker Nodes</span>
      <span class="lg lg-pod">Pods</span>
      <span class="lg lg-user">User (kubectl)</span>
    </footer>
  </div>
`;

/* ------------------------------------------------------------------ */
/*  Animation                                                          */
/* ------------------------------------------------------------------ */

const sceneEl    = document.querySelector<SVGSVGElement>('#scene')!;
const stepTitle  = document.querySelector<HTMLElement>('#step-title')!;
const stepDesc   = document.querySelector<HTMLElement>('#step-desc')!;
const stepList   = document.querySelector<HTMLElement>('#step-list')!;
const btnPlay    = document.querySelector<HTMLButtonElement>('#btn-play')!;
const btnReset   = document.querySelector<HTMLButtonElement>('#btn-reset')!;
const packetG    = document.querySelector<SVGGElement>('#packet-group')!;

/* Hide the new pod initially */
function hideNewPods() {
  sceneEl.querySelectorAll<SVGGElement>('.new-pod').forEach((g) => g.classList.remove('visible'));
}
hideNewPods();

let stepIndex = 0;
let stepStart = performance.now();
let paused = false;
let pauseAt = 0;

function currentStep(): Step {
  return STEPS[stepIndex];
}

function updateStepUi() {
  const s = currentStep();
  stepTitle.textContent = s.title;
  stepDesc.textContent  = s.desc;
  stepList.querySelectorAll<HTMLLIElement>('li').forEach((li, i) => {
    li.classList.toggle('active',   i === stepIndex);
    li.classList.toggle('done',     i <  stepIndex);
    li.classList.toggle('upcoming', i >  stepIndex);
  });

  /* highlight */
  sceneEl.querySelectorAll<SVGGElement>('.comp, .node').forEach((g) => {
    const id = g.getAttribute('data-id');
    g.classList.toggle('active', !!id && s.highlight.includes(id));
  });

  /* new pod visibility */
  if (s.id === 'runtime' || s.id === 'ready') {
    sceneEl.querySelector<SVGGElement>(`.new-pod[data-node="${N_TARGET}"]`)?.classList.add('visible');
  } else {
    hideNewPods();
  }
  sceneEl.querySelector<SVGGElement>(`.new-pod[data-node="${N_TARGET}"]`)?.classList.toggle('pulsing', s.id === 'ready');
}

updateStepUi();

btnPlay.addEventListener('click', () => {
  const now = performance.now();
  if (!paused) {
    paused = true;
    pauseAt = now;
    btnPlay.textContent = 'Play';
  } else {
    paused = false;
    stepStart += now - pauseAt;
    btnPlay.textContent = 'Pause';
  }
});
btnReset.addEventListener('click', () => {
  stepIndex = 0;
  stepStart = performance.now();
  hideNewPods();
  updateStepUi();
});

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function tick() {
  const now = performance.now();
  const step = currentStep();
  const elapsed = paused ? pauseAt - stepStart : now - stepStart;
  const t = Math.max(0, Math.min(1, elapsed / step.ms));

  const pathEl = document.getElementById(step.path) as SVGPathElement | null;
  if (pathEl && step.path !== 'p-idle') {
    packetG.style.display = '';
    const len = pathEl.getTotalLength();
    const p = pathEl.getPointAtLength(easeInOut(t) * len);
    packetG.setAttribute('transform', `translate(${p.x} ${p.y})`);
  } else {
    packetG.style.display = 'none';
  }

  if (!paused && elapsed >= step.ms) {
    stepIndex = (stepIndex + 1) % STEPS.length;
    stepStart = now;
    updateStepUi();
  }

  requestAnimationFrame(tick);
}
tick();
