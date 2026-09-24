import './style.css';
import iconSet from '@iconify-json/k8s/icons.json';

/* ================================================================== */
/*  Icon helpers                                                       */
/* ================================================================== */

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

/* ================================================================== */
/*  Scenario data model                                                */
/* ================================================================== */

type PodRef = { node: string; slot: number };

type StepAction = {
  title: string;
  desc: string;
  ms: number;
  path?: string;          // packet path id (optional)
  highlight?: string[];   // component ids to highlight
  reveal?: PodRef[];      // ghost pods to show (cumulative in a run)
  pulse?: PodRef[];       // pods to pulse this step
  failNode?: string;      // mark a node as failed (hide its base pods)
};

type Scenario = {
  id: string;
  title: string;
  category: string;
  blurb: string;
  icon: string;
  steps: StepAction[];
};

/* ================================================================== */
/*  Geometry                                                           */
/* ================================================================== */

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

const CP_COMPONENTS = [
  { id: 'api',        icon: 'api-server',         label: 'API Server',         sub: 'kube-apiserver' },
  { id: 'etcd',       icon: 'etcd-cluster',       label: 'etcd',               sub: 'key-value store' },
  { id: 'controller', icon: 'controller-manager', label: 'Controller Manager', sub: 'kube-controller-manager' },
  { id: 'scheduler',  icon: 'scheduler',          label: 'Scheduler',          sub: 'kube-scheduler' },
];

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

/* Pod slot positions inside a node: 0-2 = base row, 3-5 = ghost row */
type PodSlot = { cx: number; cy: number };
function podSlots(nx: number, ny: number, w: number, h: number): PodSlot[] {
  const colGap = 54;
  const startX = nx + w / 2 - colGap;
  const bottomY = ny + h - 60;
  const topY = ny + h - 116;
  const slots: PodSlot[] = [];
  for (let i = 0; i < 3; i++) slots.push({ cx: startX + i * colGap, cy: bottomY });
  for (let i = 0; i < 3; i++) slots.push({ cx: startX + i * colGap, cy: topY });
  return slots;
}

/* ================================================================== */
/*  SVG builders                                                       */
/* ================================================================== */

const userBox = { x: 520, y: 20, w: 160, h: 70 };

function componentBox(slot: Slot, comp: typeof CP_COMPONENTS[number]) {
  const iconSize = 48;
  return `
    <g class="comp" data-id="${comp.id}">
      <rect class="comp-bg" x="${slot.x}" y="${slot.y}" width="${slot.w}" height="${slot.h}" rx="14" ry="14"></rect>
      <g class="comp-icon" transform="translate(${slot.cx - iconSize / 2}, ${slot.y + 22})">
        ${iconSvg(comp.icon, iconSize, '#7dd3fc')}
      </g>
      <text class="comp-title" x="${slot.cx}" y="${slot.y + 22 + iconSize + 24}" text-anchor="middle">${comp.label}</text>
      <text class="comp-sub"   x="${slot.cx}" y="${slot.y + 22 + iconSize + 43}" text-anchor="middle">${comp.sub}</text>
    </g>`;
}

function nodeBox(n: typeof nodes.boxes[number]) {
  const y = nodes.y;
  const h = nodes.h;
  const inner = n.w - 32;
  const rowY = y + 54;
  const iconSize = 22;

  const ps = podSlots(n.x, y, n.w, h);

  const basePods = ps
    .slice(0, 3)
    .map(
      (p, i) => `
      <g class="pod base-pod" data-node="${n.id}" data-slot="${i}">
        <rect x="${p.cx - 23}" y="${p.cy - 23}" width="46" height="46" rx="9" ry="9"></rect>
        <g transform="translate(${p.cx - 15}, ${p.cy - 15})">${iconSvg('pod', 30, '#fbbf24')}</g>
      </g>`,
    )
    .join('');

  const ghostPods = ps
    .slice(3, 6)
    .map(
      (p, i) => `
      <g class="pod ghost-pod" data-node="${n.id}" data-slot="${i + 3}">
        <rect x="${p.cx - 23}" y="${p.cy - 23}" width="46" height="46" rx="9" ry="9"></rect>
        <g transform="translate(${p.cx - 15}, ${p.cy - 15})">${iconSvg('pod', 30, '#22d3ee')}</g>
      </g>`,
    )
    .join('');

  return `
    <g class="node" data-id="${n.id}">
      <rect class="node-bg" x="${n.x}" y="${y}" width="${n.w}" height="${h}" rx="18" ry="18"></rect>
      <text class="node-title" x="${n.x + 16}" y="${y + 28}">${n.label}</text>
      <text class="node-status" x="${n.x + n.w - 16}" y="${y + 28}" text-anchor="end">Ready</text>

      <g class="node-modules" transform="translate(${n.x + 16}, ${rowY - 10})">
        <g transform="translate(0, 0)">${iconSvg('kubelet', iconSize, '#a5f3fc')}</g>
        <text class="mod-text" x="${iconSize + 6}" y="${iconSize - 6}">kubelet</text>
        <g transform="translate(${inner / 2}, 0)">${iconSvg('kube-proxy', iconSize, '#a5f3fc')}</g>
        <text class="mod-text" x="${inner / 2 + iconSize + 6}" y="${iconSize - 6}">kube-proxy</text>
      </g>

      ${ghostPods}
      ${basePods}
    </g>`;
}

/* Component centers + edge anchors for connectors */
const cc: Record<string, { topX: number; topY: number; botX: number; botY: number }> = {};
for (const slot of CP_SLOTS) {
  cc[slot.id] = { topX: slot.cx, topY: slot.y, botX: slot.cx, botY: slot.y + slot.h };
}
for (const n of nodes.boxes) {
  cc[n.id] = { topX: n.x + n.w / 2, topY: nodes.y, botX: n.x + n.w / 2, botY: nodes.y + nodes.h };
}
cc['user'] = { topX: userBox.x + userBox.w / 2, topY: userBox.y, botX: userBox.x + userBox.w / 2, botY: userBox.y + userBox.h };

function connector(id: string, fromId: string, toId: string, opts?: { fromEdge?: 'top' | 'bot'; toEdge?: 'top' | 'bot'; curve?: number }) {
  const a = cc[fromId];
  const b = cc[toId];
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

/* ================================================================== */
/*  Scenarios                                                          */
/* ================================================================== */

const SCENARIOS: Scenario[] = [
  {
    id: 'deploy',
    title: 'Deploy a Pod',
    category: 'Workloads',
    icon: 'deployment',
    blurb: 'Full path of a Deployment from kubectl to a running pod.',
    steps: [
      { title: '1. kubectl apply', desc: 'User submits a Deployment manifest to the API server.', ms: 2200, path: 'p-user-api', highlight: ['user', 'api'] },
      { title: '2. API Server writes to etcd', desc: 'kube-apiserver validates and persists the object into etcd.', ms: 2200, path: 'p-api-etcd', highlight: ['api', 'etcd'] },
      { title: '3. etcd confirms the write', desc: 'etcd stores desired state and acknowledges the API server.', ms: 2000, path: 'p-etcd-api', highlight: ['etcd', 'api'] },
      { title: '4. Controller Manager reconciles', desc: 'Deployment \u2192 ReplicaSet \u2192 Pod objects are created.', ms: 2400, path: 'p-api-controller', highlight: ['api', 'controller'] },
      { title: '5. Scheduler picks a node', desc: 'kube-scheduler scores nodes and binds the pending pod.', ms: 2400, path: 'p-controller-scheduler', highlight: ['controller', 'scheduler'] },
      { title: '6. Kubelet accepts the pod', desc: 'Kubelet on the chosen node pulls the pod spec.', ms: 2400, path: 'p-scheduler-node2', highlight: ['scheduler', 'node2'] },
      { title: '7. Container runtime starts pod', desc: 'containerd creates the sandbox and starts containers.', ms: 2200, highlight: ['node2'], reveal: [{ node: 'node2', slot: 3 }] },
      { title: '8. Pod is Ready', desc: 'Pod passes readiness probes and joins the Service.', ms: 2800, highlight: ['node2', 'api'], reveal: [{ node: 'node2', slot: 3 }], pulse: [{ node: 'node2', slot: 3 }] },
    ],
  },
  {
    id: 'scale',
    title: 'Scale Deployment',
    category: 'Workloads',
    icon: 'replicaset',
    blurb: 'replicas: 1 \u2192 3. Controller creates pods, scheduler spreads them.',
    steps: [
      { title: '1. kubectl scale --replicas=3', desc: 'User updates the desired replica count.', ms: 2200, path: 'p-user-api', highlight: ['user', 'api'] },
      { title: '2. Controller updates ReplicaSet', desc: 'ReplicaSet controller notices missing pods and creates them.', ms: 2400, path: 'p-api-controller', highlight: ['api', 'controller'] },
      { title: '3. Scheduler places replica on Node 1', desc: 'Scheduler binds the first new pod to Node 1.', ms: 2200, path: 'p-scheduler-node1', highlight: ['scheduler', 'node1'], reveal: [{ node: 'node1', slot: 3 }] },
      { title: '4. Scheduler places replica on Node 2', desc: 'The second new pod is bound to Node 2.', ms: 2200, path: 'p-scheduler-node2', highlight: ['scheduler', 'node2'], reveal: [{ node: 'node1', slot: 3 }, { node: 'node2', slot: 3 }] },
      { title: '5. Scheduler places replica on Node 3', desc: 'The third new pod is bound to Node 3.', ms: 2200, path: 'p-scheduler-node3', highlight: ['scheduler', 'node3'], reveal: [{ node: 'node1', slot: 3 }, { node: 'node2', slot: 3 }, { node: 'node3', slot: 3 }] },
      { title: '6. All replicas Ready', desc: 'Deployment reaches the desired state of 3 running replicas.', ms: 2800, highlight: ['controller'], reveal: [{ node: 'node1', slot: 3 }, { node: 'node2', slot: 3 }, { node: 'node3', slot: 3 }], pulse: [{ node: 'node1', slot: 3 }, { node: 'node2', slot: 3 }, { node: 'node3', slot: 3 }] },
    ],
  },
  {
    id: 'rolling',
    title: 'Rolling Update',
    category: 'Workloads',
    icon: 'deployment',
    blurb: 'v1 \u2192 v2 with a new ReplicaSet, one pod replaced at a time.',
    steps: [
      { title: '1. kubectl set image (v2)', desc: 'User triggers a rolling update to a new image version.', ms: 2200, path: 'p-user-api', highlight: ['user', 'api'] },
      { title: '2. New ReplicaSet created', desc: 'Controller creates a v2 ReplicaSet next to the v1 one.', ms: 2400, path: 'p-api-controller', highlight: ['api', 'controller'] },
      { title: '3. Surge v2 pod on Node 1', desc: 'A v2 pod starts while v1 keeps serving (maxSurge).', ms: 2200, path: 'p-scheduler-node1', highlight: ['scheduler', 'node1'], reveal: [{ node: 'node1', slot: 3 }] },
      { title: '4. Surge v2 pod on Node 2', desc: 'Next v2 pod comes up as an old pod is drained.', ms: 2200, path: 'p-scheduler-node2', highlight: ['scheduler', 'node2'], reveal: [{ node: 'node1', slot: 3 }, { node: 'node2', slot: 3 }] },
      { title: '5. Surge v2 pod on Node 3', desc: 'Last v2 pod replaces the final v1 pod.', ms: 2200, path: 'p-scheduler-node3', highlight: ['scheduler', 'node3'], reveal: [{ node: 'node1', slot: 3 }, { node: 'node2', slot: 3 }, { node: 'node3', slot: 3 }] },
      { title: '6. Update complete', desc: 'All traffic now flows to v2; the old ReplicaSet scales to zero.', ms: 2800, highlight: ['controller'], reveal: [{ node: 'node1', slot: 3 }, { node: 'node2', slot: 3 }, { node: 'node3', slot: 3 }], pulse: [{ node: 'node1', slot: 3 }, { node: 'node2', slot: 3 }, { node: 'node3', slot: 3 }] },
    ],
  },
  {
    id: 'selfheal',
    title: 'Node Failure & Self-Healing',
    category: 'Reliability',
    icon: 'worker-node',
    blurb: 'A node dies and the control plane reschedules its pods.',
    steps: [
      { title: '1. Node 2 goes down', desc: 'The node stops sending heartbeats to the API server.', ms: 2400, highlight: ['node2'], failNode: 'node2' },
      { title: '2. Controller detects the loss', desc: 'Node controller marks the node NotReady and its pods as lost.', ms: 2400, path: 'p-api-controller', highlight: ['api', 'controller'], failNode: 'node2' },
      { title: '3. Reschedule pod to Node 1', desc: 'Replacement pods are scheduled onto healthy nodes.', ms: 2200, path: 'p-scheduler-node1', highlight: ['scheduler', 'node1'], failNode: 'node2', reveal: [{ node: 'node1', slot: 3 }] },
      { title: '4. Reschedule pod to Node 3', desc: 'The remaining replica lands on Node 3.', ms: 2200, path: 'p-scheduler-node3', highlight: ['scheduler', 'node3'], failNode: 'node2', reveal: [{ node: 'node1', slot: 3 }, { node: 'node3', slot: 3 }] },
      { title: '5. Desired state restored', desc: 'Self-healing complete: replica count is back to normal.', ms: 2800, highlight: ['controller'], failNode: 'node2', reveal: [{ node: 'node1', slot: 3 }, { node: 'node3', slot: 3 }], pulse: [{ node: 'node1', slot: 3 }, { node: 'node3', slot: 3 }] },
    ],
  },
  {
    id: 'schedule',
    title: 'How the Scheduler Decides',
    category: 'Scheduling',
    icon: 'scheduler',
    blurb: 'Filtering and scoring nodes for a single pending pod.',
    steps: [
      { title: '1. Pending pod created', desc: 'Controller creates a pod with no node assigned yet.', ms: 2200, path: 'p-api-controller', highlight: ['api', 'controller'] },
      { title: '2. Scheduler evaluates nodes', desc: 'kube-scheduler runs filter + score plugins on every node.', ms: 2600, path: 'p-controller-scheduler', highlight: ['scheduler', 'node1', 'node2', 'node3'] },
      { title: '3. Node 1 filtered out', desc: 'Node 1 fails a predicate (insufficient CPU) and is discarded.', ms: 2400, highlight: ['scheduler', 'node1'] },
      { title: '4. Node 2 wins the score', desc: 'Node 2 has the best score, so the pod is bound to it.', ms: 2400, path: 'p-scheduler-node2', highlight: ['scheduler', 'node2'], reveal: [{ node: 'node2', slot: 3 }] },
      { title: '5. Pod bound and Running', desc: 'The binding is written back and kubelet starts the pod.', ms: 2800, highlight: ['node2'], reveal: [{ node: 'node2', slot: 3 }], pulse: [{ node: 'node2', slot: 3 }] },
    ],
  },
];

/* ================================================================== */
/*  Static scene DOM                                                   */
/* ================================================================== */

const app = document.querySelector<HTMLDivElement>('#app')!;

const categories = [...new Set(SCENARIOS.map((s) => s.category))];
const menuMarkup = categories
  .map(
    (cat) => `
    <div class="menu-cat">
      <h3>${cat}</h3>
      <div class="menu-grid">
        ${SCENARIOS.filter((s) => s.category === cat)
          .map(
            (s) => `
          <button class="scenario-card" data-scenario="${s.id}" type="button">
            <span class="card-icon">${iconSvg(s.icon, 34, '#7dd3fc')}</span>
            <span class="card-body">
              <span class="card-title">${s.title}</span>
              <span class="card-blurb">${s.blurb}</span>
            </span>
            <span class="card-steps">${s.steps.length} steps</span>
          </button>`,
          )
          .join('')}
      </div>
    </div>`,
  )
  .join('');

app.innerHTML = `
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <span class="brand-dot"></span>
        <span class="brand-name">Kubernetes City</span>
        <span class="brand-tag" id="brand-tag">Workloads</span>
      </div>
      <div class="controls">
        <button id="btn-menu" class="btn" type="button">Scenarios</button>
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
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        <g class="comp comp-user" data-id="user">
          <rect class="comp-bg user-bg" x="${userBox.x}" y="${userBox.y}" width="${userBox.w}" height="${userBox.h}" rx="14" ry="14"></rect>
          <g transform="translate(${userBox.x + 12}, ${userBox.y + 15})">${iconSvg('user', 40, '#7dd3fc')}</g>
          <text class="comp-title" x="${userBox.x + 66}" y="${userBox.y + 35}">User</text>
          <text class="comp-sub"   x="${userBox.x + 66}" y="${userBox.y + 55}">kubectl</text>
        </g>

        <g class="cluster cluster-cp">
          <rect class="cluster-bg" fill="url(#cp-grad)" x="${cp.x}" y="${cp.y}" width="${cp.w}" height="${cp.h}" rx="20" ry="20"></rect>
          <text class="cluster-title" x="${cp.x + 24}" y="${cp.y + 34}">Control Plane</text>
          <text class="cluster-sub"   x="${cp.x + cp.w - 24}" y="${cp.y + 34}" text-anchor="end">master node</text>
          ${CP_SLOTS.map((s, i) => componentBox(s, CP_COMPONENTS[i])).join('')}
        </g>

        <g class="cluster cluster-nodes">
          ${nodes.boxes.map((n) => nodeBox(n)).join('')}
        </g>

        <g class="links">
          ${connector('p-user-api',            'user',       'api',        { fromEdge: 'bot', toEdge: 'top', curve: 30 })}
          ${connector('p-api-etcd',            'api',        'etcd',       { fromEdge: 'top', toEdge: 'top', curve: -60 })}
          ${connector('p-etcd-api',            'etcd',       'api',        { fromEdge: 'top', toEdge: 'top', curve: -80 })}
          ${connector('p-api-controller',      'api',        'controller', { fromEdge: 'top', toEdge: 'top', curve: -110 })}
          ${connector('p-controller-scheduler','controller', 'scheduler',  { fromEdge: 'top', toEdge: 'top', curve: -80 })}
          ${connector('p-scheduler-node1',     'scheduler',  'node1',      { fromEdge: 'bot', toEdge: 'top', curve: 60 })}
          ${connector('p-scheduler-node2',     'scheduler',  'node2',      { fromEdge: 'bot', toEdge: 'top', curve: 40 })}
          ${connector('p-scheduler-node3',     'scheduler',  'node3',      { fromEdge: 'bot', toEdge: 'top', curve: 60 })}
        </g>

        <g id="packet-group" class="packet" style="display:none">
          <circle id="packet-halo" r="16" cx="0" cy="0" fill="#7dd3fc" opacity="0.18"></circle>
          <circle id="packet" r="7" cx="0" cy="0" fill="#7dd3fc" filter="url(#glow)"></circle>
        </g>
      </svg>
    </div>

    <section class="story">
      <div class="story-card">
        <div class="story-label"><span id="story-cat">Workloads</span> · <span id="story-name">Deploy a Pod</span></div>
        <h1 id="step-title"></h1>
        <p id="step-desc"></p>
        <ol id="step-list" class="step-list"></ol>
      </div>
    </section>

    <footer class="legend">
      <span class="lg lg-cp">Control Plane</span>
      <span class="lg lg-node">Worker Nodes</span>
      <span class="lg lg-pod">Pods</span>
      <span class="lg lg-user">User (kubectl)</span>
    </footer>

    <div id="scenario-menu" class="scenario-menu">
      <div class="menu-panel">
        <div class="menu-head">
          <div>
            <div class="menu-eyebrow">Choose a scenario</div>
            <h2>What happens inside Kubernetes?</h2>
          </div>
          <button id="menu-close" class="btn" type="button">Close</button>
        </div>
        ${menuMarkup}
      </div>
    </div>
  </div>
`;

/* ================================================================== */
/*  Engine                                                             */
/* ================================================================== */

const sceneEl   = document.querySelector<SVGSVGElement>('#scene')!;
const stepTitle = document.querySelector<HTMLElement>('#step-title')!;
const stepDesc  = document.querySelector<HTMLElement>('#step-desc')!;
const stepList  = document.querySelector<HTMLElement>('#step-list')!;
const storyCat  = document.querySelector<HTMLElement>('#story-cat')!;
const storyName = document.querySelector<HTMLElement>('#story-name')!;
const brandTag  = document.querySelector<HTMLElement>('#brand-tag')!;
const btnPlay   = document.querySelector<HTMLButtonElement>('#btn-play')!;
const btnReset  = document.querySelector<HTMLButtonElement>('#btn-reset')!;
const btnMenu   = document.querySelector<HTMLButtonElement>('#btn-menu')!;
const menuEl    = document.querySelector<HTMLDivElement>('#scenario-menu')!;
const menuClose = document.querySelector<HTMLButtonElement>('#menu-close')!;
const packetG   = document.querySelector<SVGGElement>('#packet-group')!;

let scenario: Scenario = SCENARIOS[0];
let stepIndex = 0;
let stepStart = performance.now();
let paused = false;
let pauseAt = 0;

function resetSceneState() {
  sceneEl.querySelectorAll<SVGGElement>('.ghost-pod').forEach((g) => g.classList.remove('visible', 'pulsing'));
  sceneEl.querySelectorAll<SVGGElement>('.node').forEach((g) => g.classList.remove('failed'));
  sceneEl.querySelectorAll<SVGGElement>('.comp, .node').forEach((g) => g.classList.remove('active'));
}

function podEl(ref: PodRef): SVGGElement | null {
  return sceneEl.querySelector<SVGGElement>(`.ghost-pod[data-node="${ref.node}"][data-slot="${ref.slot}"]`);
}

function applyStep() {
  const step = scenario.steps[stepIndex];

  stepTitle.textContent = step.title;
  stepDesc.textContent  = step.desc;

  stepList.querySelectorAll<HTMLLIElement>('li').forEach((li, i) => {
    li.classList.toggle('active',   i === stepIndex);
    li.classList.toggle('done',     i <  stepIndex);
    li.classList.toggle('upcoming', i >  stepIndex);
  });

  const hi = new Set(step.highlight ?? []);
  sceneEl.querySelectorAll<SVGGElement>('.comp, .node').forEach((g) => {
    const id = g.getAttribute('data-id');
    g.classList.toggle('active', !!id && hi.has(id));
  });

  sceneEl.querySelectorAll<SVGGElement>('.node').forEach((g) => g.classList.remove('failed'));
  sceneEl.querySelectorAll<SVGTextElement>('.node-status').forEach((t) => (t.textContent = 'Ready'));
  if (step.failNode) {
    const failed = sceneEl.querySelector<SVGGElement>(`.node[data-id="${step.failNode}"]`);
    failed?.classList.add('failed');
    failed?.querySelector<SVGTextElement>('.node-status')?.replaceChildren('NotReady');
  }

  sceneEl.querySelectorAll<SVGGElement>('.ghost-pod').forEach((g) => g.classList.remove('visible', 'pulsing'));
  for (let i = 0; i <= stepIndex; i++) {
    for (const ref of scenario.steps[i].reveal ?? []) {
      podEl(ref)?.classList.add('visible');
    }
  }
  for (const ref of step.pulse ?? []) {
    podEl(ref)?.classList.add('pulsing');
  }
}

function renderStepList() {
  stepList.innerHTML = scenario.steps
    .map(
      (s, i) => `
      <li data-idx="${i}">
        <span class="idx">${i + 1}</span>
        <span class="txt">${s.title.replace(/^\d+\.\s*/, '')}</span>
      </li>`,
    )
    .join('');
}

function loadScenario(id: string) {
  const found = SCENARIOS.find((s) => s.id === id);
  if (!found) return;
  scenario = found;
  stepIndex = 0;
  stepStart = performance.now();
  paused = false;
  btnPlay.textContent = 'Pause';

  storyCat.textContent = scenario.category;
  storyName.textContent = scenario.title;
  brandTag.textContent = scenario.category;

  resetSceneState();
  renderStepList();
  applyStep();
}

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
  resetSceneState();
  applyStep();
});

function openMenu() { menuEl.classList.add('open'); }
function closeMenu() { menuEl.classList.remove('open'); }

btnMenu.addEventListener('click', openMenu);
menuClose.addEventListener('click', closeMenu);
menuEl.addEventListener('click', (e) => {
  if (e.target === menuEl) closeMenu();
});

document.querySelectorAll<HTMLButtonElement>('.scenario-card').forEach((card) => {
  card.addEventListener('click', () => {
    const id = card.getAttribute('data-scenario');
    if (id) {
      loadScenario(id);
      closeMenu();
    }
  });
});

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function tick() {
  const now = performance.now();
  const step = scenario.steps[stepIndex];
  const elapsed = paused ? pauseAt - stepStart : now - stepStart;
  const t = Math.max(0, Math.min(1, elapsed / step.ms));

  const pathEl = step.path ? (document.getElementById(step.path) as SVGPathElement | null) : null;
  if (pathEl) {
    packetG.style.display = '';
    const len = pathEl.getTotalLength();
    const p = pathEl.getPointAtLength(easeInOut(t) * len);
    packetG.setAttribute('transform', `translate(${p.x} ${p.y})`);
  } else {
    packetG.style.display = 'none';
  }

  if (!paused && elapsed >= step.ms) {
    stepIndex = (stepIndex + 1) % scenario.steps.length;
    stepStart = now;
    applyStep();
  }

  requestAnimationFrame(tick);
}

loadScenario(SCENARIOS[0].id);
tick();
