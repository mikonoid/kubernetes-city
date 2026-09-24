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
/*  Data model                                                         */
/* ================================================================== */

type LinkState = 'active' | 'allow' | 'deny';

type StepAction = {
  title: string;
  desc: string;
  ms: number;
  path?: string;                            // packet path id
  highlight?: string[];                     // data-id -> .active
  reveal?: string[];                        // data-el -> .visible (cumulative)
  pulse?: string[];                         // data-el -> .pulsing
  fail?: string[];                          // data-id (node) -> .failed
  links?: { id: string; state: LinkState }[];
  status?: { id: string; text: string }[]; // data-status text override
};

type StageKind = 'control' | 'service' | 'netpol' | 'config';

type Scenario = {
  id: string;
  title: string;
  category: string;
  blurb: string;
  icon: string;
  stage: StageKind;
  steps: StepAction[];
};

/* ================================================================== */
/*  Shared SVG helpers                                                 */
/* ================================================================== */

const VBW = 1200;
const VBH = 780;

const DEFS = `
  <defs>
    <linearGradient id="cp-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1e3a5c"/><stop offset="1" stop-color="#122544"/>
    </linearGradient>
    <linearGradient id="node-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0f3a30"/><stop offset="1" stop-color="#0a2620"/>
    </linearGradient>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;

const PACKET = `
  <g id="packet-group" class="packet" style="display:none">
    <circle id="packet-halo" r="16" cx="0" cy="0" fill="#7dd3fc" opacity="0.18"></circle>
    <circle id="packet" r="7" cx="0" cy="0" fill="#7dd3fc" filter="url(#glow)"></circle>
  </g>`;

function link(id: string, ax: number, ay: number, bx: number, by: number, curve = 40) {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2 - curve;
  return `<path id="${id}" class="link" d="M ${ax} ${ay} Q ${mx} ${my} ${bx} ${by}" fill="none"></path>`;
}

/* Generic box with an icon on top and title/sub beneath */
function box(id: string, x: number, y: number, w: number, h: number, icon: string, title: string, sub: string) {
  const cx = x + w / 2;
  const is = 40;
  return `
    <g class="comp" data-id="${id}">
      <rect class="comp-bg" x="${x}" y="${y}" width="${w}" height="${h}" rx="14" ry="14"></rect>
      <g transform="translate(${cx - is / 2}, ${y + 14})">${iconSvg(icon, is, '#7dd3fc')}</g>
      <text class="comp-title" x="${cx}" y="${y + 14 + is + 22}" text-anchor="middle">${title}</text>
      <text class="comp-sub"   x="${cx}" y="${y + 14 + is + 40}" text-anchor="middle">${sub}</text>
    </g>`;
}

/* A pod tile that can be highlighted (data-id), revealed (data-el+ghost) or pulsed (data-el) */
function podTile(opts: { id?: string; el?: string; ghost?: boolean; cx: number; cy: number; color?: string; label?: string }) {
  const color = opts.color ?? '#fbbf24';
  const cls = ['pod', opts.ghost ? 'ghost' : ''].filter(Boolean).join(' ');
  const attrs = [opts.id ? `data-id="${opts.id}"` : '', opts.el ? `data-el="${opts.el}"` : ''].join(' ');
  const label = opts.label
    ? `<text class="ep-label" x="${opts.cx}" y="${opts.cy + 46}" text-anchor="middle">${opts.label}</text>`
    : '';
  return `
    <g class="${cls}" ${attrs}>
      <rect x="${opts.cx - 28}" y="${opts.cy - 28}" width="56" height="56" rx="12" ry="12"></rect>
      <g transform="translate(${opts.cx - 16}, ${opts.cy - 16})">${iconSvg('pod', 32, color)}</g>
      ${label}
    </g>`;
}

/* ================================================================== */
/*  Stage: control plane + worker nodes                                */
/* ================================================================== */

const cp = { x: 130, y: 130, w: 940, h: 210 };
const cpNodes = {
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
const userBox = { x: 520, y: 20, w: 160, h: 70 };

type Slot = { id: string; cx: number; cy: number; x: number; y: number; w: number; h: number };
function cpSlots(): Slot[] {
  const gap = 24;
  const inner = cp.w - 40;
  const each = (inner - gap * (CP_COMPONENTS.length - 1)) / CP_COMPONENTS.length;
  const y0 = cp.y + 60;
  const h = cp.h - 80;
  return CP_COMPONENTS.map((c, i) => {
    const x = cp.x + 20 + i * (each + gap);
    return { id: c.id, x, y: y0, w: each, h, cx: x + each / 2, cy: y0 + h / 2 };
  });
}
const CP_SLOTS = cpSlots();

function cpComponentBox(slot: Slot, comp: typeof CP_COMPONENTS[number]) {
  const is = 48;
  return `
    <g class="comp" data-id="${comp.id}">
      <rect class="comp-bg" x="${slot.x}" y="${slot.y}" width="${slot.w}" height="${slot.h}" rx="14" ry="14"></rect>
      <g transform="translate(${slot.cx - is / 2}, ${slot.y + 22})">${iconSvg(comp.icon, is, '#7dd3fc')}</g>
      <text class="comp-title" x="${slot.cx}" y="${slot.y + 22 + is + 24}" text-anchor="middle">${comp.label}</text>
      <text class="comp-sub"   x="${slot.cx}" y="${slot.y + 22 + is + 43}" text-anchor="middle">${comp.sub}</text>
    </g>`;
}

function cpNodeBox(n: typeof cpNodes.boxes[number]) {
  const y = cpNodes.y;
  const h = cpNodes.h;
  const inner = n.w - 32;
  const iconSize = 22;
  const colGap = 54;
  const startX = n.x + n.w / 2 - colGap;
  const bottomY = y + h - 60;
  const topY = y + h - 116;

  const basePods = [0, 1, 2]
    .map((i) => podTile({ id: `${n.id}-b${i}`, cx: startX + i * colGap, cy: bottomY, color: '#fbbf24' }))
    .join('');
  const ghostPods = [3, 4, 5]
    .map((i) => podTile({ el: `${n.id}-g${i}`, ghost: true, cx: startX + (i - 3) * colGap, cy: topY, color: '#22d3ee' }))
    .join('');

  return `
    <g class="node" data-id="${n.id}">
      <rect class="node-bg" x="${n.x}" y="${y}" width="${n.w}" height="${h}" rx="18" ry="18"></rect>
      <text class="node-title" x="${n.x + 16}" y="${y + 28}">${n.label}</text>
      <text class="node-status" data-status="${n.id}" data-default="Ready" x="${n.x + n.w - 16}" y="${y + 28}" text-anchor="end">Ready</text>
      <g class="node-modules" transform="translate(${n.x + 16}, ${y + 44})">
        <g transform="translate(0, 0)">${iconSvg('kubelet', iconSize, '#a5f3fc')}</g>
        <text class="mod-text" x="${iconSize + 6}" y="${iconSize - 6}">kubelet</text>
        <g transform="translate(${inner / 2}, 0)">${iconSvg('kube-proxy', iconSize, '#a5f3fc')}</g>
        <text class="mod-text" x="${inner / 2 + iconSize + 6}" y="${iconSize - 6}">kube-proxy</text>
      </g>
      ${ghostPods}
      ${basePods}
    </g>`;
}

function stageControl(): string {
  const cc: Record<string, { topX: number; topY: number; botX: number; botY: number }> = {};
  for (const s of CP_SLOTS) cc[s.id] = { topX: s.cx, topY: s.y, botX: s.cx, botY: s.y + s.h };
  for (const n of cpNodes.boxes) cc[n.id] = { topX: n.x + n.w / 2, topY: cpNodes.y, botX: n.x + n.w / 2, botY: cpNodes.y + cpNodes.h };
  cc['user'] = { topX: userBox.x + userBox.w / 2, topY: userBox.y, botX: userBox.x + userBox.w / 2, botY: userBox.y + userBox.h };

  const c = (id: string, from: string, to: string, fe: 'top' | 'bot', te: 'top' | 'bot', curve: number) => {
    const a = cc[from];
    const b = cc[to];
    return link(id, fe === 'top' ? a.topX : a.botX, fe === 'top' ? a.topY : a.botY, te === 'top' ? b.topX : b.botX, te === 'top' ? b.topY : b.botY, curve);
  };

  return `
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
      ${CP_SLOTS.map((s, i) => cpComponentBox(s, CP_COMPONENTS[i])).join('')}
    </g>

    <g class="cluster cluster-nodes">
      ${cpNodes.boxes.map((n) => cpNodeBox(n)).join('')}
    </g>

    <g class="links">
      ${c('p-user-api', 'user', 'api', 'bot', 'top', 30)}
      ${c('p-api-etcd', 'api', 'etcd', 'top', 'top', -60)}
      ${c('p-etcd-api', 'etcd', 'api', 'top', 'top', -80)}
      ${c('p-api-controller', 'api', 'controller', 'top', 'top', -110)}
      ${c('p-controller-scheduler', 'controller', 'scheduler', 'top', 'top', -80)}
      ${c('p-scheduler-node1', 'scheduler', 'node1', 'bot', 'top', 60)}
      ${c('p-scheduler-node2', 'scheduler', 'node2', 'bot', 'top', 40)}
      ${c('p-scheduler-node3', 'scheduler', 'node3', 'bot', 'top', 60)}
    </g>`;
}

/* ================================================================== */
/*  Stage: service / traffic                                           */
/* ================================================================== */

function stageService(): string {
  const internet = { x: 500, y: 20, w: 200, h: 78 };
  const lb = { x: 250, y: 150, w: 220, h: 116 };
  const nodeport = { x: 730, y: 150, w: 220, h: 116 };
  const svc = { x: 460, y: 330, w: 280, h: 120 };
  const eps = [
    { id: 'ep1', cx: 420, cy: 620, label: 'pod · v1' },
    { id: 'ep2', cx: 600, cy: 620, label: 'pod · v1' },
    { id: 'ep3', cx: 780, cy: 620, label: 'pod · v1' },
  ];

  const iCx = internet.x + internet.w / 2;
  const iBot = internet.y + internet.h;
  const lbCx = lb.x + lb.w / 2;
  const npCx = nodeport.x + nodeport.w / 2;
  const svcCx = svc.x + svc.w / 2;
  const svcTop = svc.y;
  const svcBot = svc.y + svc.h;

  return `
    ${box('internet', internet.x, internet.y, internet.w, internet.h, 'user', 'Internet / Client', 'external request')}
    ${box('lb', lb.x, lb.y, lb.w, lb.h, 'service', 'LoadBalancer', 'cloud load balancer')}
    ${box('nodeport', nodeport.x, nodeport.y, nodeport.w, nodeport.h, 'kube-proxy', 'NodePort', 'port 30007 on every node')}
    ${box('svc', svc.x, svc.y, svc.w, svc.h, 'service', 'Service', 'ClusterIP 10.96.0.10')}

    <g class="endpoints">
      ${eps.map((e) => podTile({ id: e.id, el: e.id, cx: e.cx, cy: e.cy, color: '#fbbf24', label: e.label })).join('')}
    </g>

    <g class="links">
      ${link('p-internet-lb', iCx, iBot, lbCx, lb.y, 30)}
      ${link('p-internet-nodeport', iCx, iBot, npCx, nodeport.y, 30)}
      ${link('p-internet-svc', iCx, iBot, svcCx, svcTop, 120)}
      ${link('p-lb-svc', lbCx, lb.y + lb.h, svcCx - 40, svcTop, 30)}
      ${link('p-nodeport-svc', npCx, nodeport.y + nodeport.h, svcCx + 40, svcTop, 30)}
      ${link('p-svc-ep1', svcCx, svcBot, eps[0].cx, eps[0].cy - 28, 40)}
      ${link('p-svc-ep2', svcCx, svcBot, eps[1].cx, eps[1].cy - 28, 30)}
      ${link('p-svc-ep3', svcCx, svcBot, eps[2].cx, eps[2].cy - 28, 40)}
    </g>`;
}

/* ================================================================== */
/*  Stage: NetworkPolicy                                               */
/* ================================================================== */

function stageNetpol(): string {
  const ns = { x: 120, y: 150, w: 960, h: 470 };
  const fe = { x: 180, y: 320, w: 190, h: 150 };
  const be = { x: 505, y: 320, w: 190, h: 150 };
  const db = { x: 830, y: 320, w: 190, h: 150 };

  const feR = fe.x + fe.w;
  const beL = be.x;
  const beR = be.x + be.w;
  const dbL = db.x;
  const midY = fe.y + fe.h / 2;
  const feBot = fe.y + fe.h;
  const dbBot = db.y + db.h;
  const feCx = fe.x + fe.w / 2;
  const dbCx = db.x + db.w / 2;

  return `
    <g class="cluster">
      <rect class="cluster-bg" fill="url(#cp-grad)" x="${ns.x}" y="${ns.y}" width="${ns.w}" height="${ns.h}" rx="20" ry="20"></rect>
      <text class="cluster-title" x="${ns.x + 24}" y="${ns.y + 34}">Namespace: shop</text>
      <text class="cluster-sub" x="${ns.x + ns.w - 24}" y="${ns.y + 34}" text-anchor="end">NetworkPolicy demo</text>
    </g>

    ${box('frontend', fe.x, fe.y, fe.w, fe.h, 'pod', 'frontend', 'app=frontend')}
    ${box('backend', be.x, be.y, be.w, be.h, 'pod', 'backend', 'app=backend')}
    ${box('database', db.x, db.y, db.w, db.h, 'pod', 'database', 'app=db')}

    <g class="links">
      ${link('p-fe-be', feR, midY, beL, midY, 0)}
      ${link('p-be-db', beR, midY, dbL, midY, 0)}
      ${link('p-fe-db', feCx, feBot, dbCx, dbBot, -150)}
    </g>

    <g class="ghost deny-badge" data-el="deny-badge">
      <circle cx="600" cy="560" r="20" fill="rgba(80,20,24,0.9)" stroke="#f87171" stroke-width="2"></circle>
      <text x="600" y="567" text-anchor="middle" fill="#f87171" font-size="22" font-weight="700">✕</text>
      <text class="deny-text" x="600" y="605" text-anchor="middle">blocked by policy</text>
    </g>`;
}

/* ================================================================== */
/*  Stage: ConfigMap / Secret                                          */
/* ================================================================== */

function stageConfig(): string {
  const cm = { x: 150, y: 250, w: 210, h: 120 };
  const sec = { x: 150, y: 420, w: 210, h: 120 };
  const pod = { x: 620, y: 250, w: 300, h: 300 };

  const podL = pod.x;
  const cmR = cm.x + cm.w;
  const secR = sec.x + sec.w;
  const cmMidY = cm.y + cm.h / 2;
  const secMidY = sec.y + sec.h / 2;
  const uCx = userBox.x + userBox.w / 2;
  const uBot = userBox.y + userBox.h;

  return `
    <g class="comp comp-user" data-id="user">
      <rect class="comp-bg user-bg" x="${userBox.x}" y="${userBox.y}" width="${userBox.w}" height="${userBox.h}" rx="14" ry="14"></rect>
      <g transform="translate(${userBox.x + 12}, ${userBox.y + 15})">${iconSvg('user', 40, '#7dd3fc')}</g>
      <text class="comp-title" x="${userBox.x + 66}" y="${userBox.y + 35}">User</text>
      <text class="comp-sub"   x="${userBox.x + 66}" y="${userBox.y + 55}">kubectl apply</text>
    </g>

    ${box('configmap', cm.x, cm.y, cm.w, cm.h, 'configmap', 'ConfigMap', 'app-config')}
    ${box('secret', sec.x, sec.y, sec.w, sec.h, 'secret', 'Secret', 'db-credentials')}

    <g class="node" data-id="apppod">
      <rect class="node-bg" x="${pod.x}" y="${pod.y}" width="${pod.w}" height="${pod.h}" rx="18" ry="18"></rect>
      <text class="node-title" x="${pod.x + 18}" y="${pod.y + 32}">Pod: web</text>
      <text class="node-status" data-status="apppod" data-default="Running" x="${pod.x + pod.w - 18}" y="${pod.y + 32}" text-anchor="end">Running</text>

      <g class="ghost" data-el="cfg-mount">
        <rect class="mount-box" x="${pod.x + 30}" y="${pod.y + 70}" width="${pod.w - 60}" height="70" rx="10"></rect>
        <text class="mount-title" x="${pod.x + 46}" y="${pod.y + 100}">env: APP_CONFIG</text>
        <text class="mount-sub" x="${pod.x + 46}" y="${pod.y + 122}">from ConfigMap app-config</text>
      </g>

      <g class="ghost" data-el="sec-mount">
        <rect class="mount-box secret-mount" x="${pod.x + 30}" y="${pod.y + 160}" width="${pod.w - 60}" height="70" rx="10"></rect>
        <text class="mount-title" x="${pod.x + 46}" y="${pod.y + 190}">volume: /etc/secret</text>
        <text class="mount-sub" x="${pod.x + 46}" y="${pod.y + 212}">from Secret db-credentials</text>
      </g>
    </g>

    <g class="links">
      ${link('p-user-cm', uCx, uBot, cm.x + cm.w / 2, cm.y, 60)}
      ${link('p-cm-pod', cmR, cmMidY, podL, pod.y + 105, 30)}
      ${link('p-sec-pod', secR, secMidY, podL, pod.y + 195, -30)}
    </g>`;
}

/* ================================================================== */
/*  Scenarios                                                          */
/* ================================================================== */

const SCENARIOS: Scenario[] = [
  {
    id: 'deploy', title: 'Deploy a Pod', category: 'Workloads', icon: 'deployment', stage: 'control',
    blurb: 'Full path of a Deployment from kubectl to a running pod.',
    steps: [
      { title: '1. kubectl apply', desc: 'User submits a Deployment manifest to the API server.', ms: 2200, path: 'p-user-api', highlight: ['user', 'api'] },
      { title: '2. API Server writes to etcd', desc: 'kube-apiserver validates and persists the object into etcd.', ms: 2200, path: 'p-api-etcd', highlight: ['api', 'etcd'] },
      { title: '3. etcd confirms the write', desc: 'etcd stores desired state and acknowledges the API server.', ms: 2000, path: 'p-etcd-api', highlight: ['etcd', 'api'] },
      { title: '4. Controller Manager reconciles', desc: 'Deployment \u2192 ReplicaSet \u2192 Pod objects are created.', ms: 2400, path: 'p-api-controller', highlight: ['api', 'controller'] },
      { title: '5. Scheduler picks a node', desc: 'kube-scheduler scores nodes and binds the pending pod.', ms: 2400, path: 'p-controller-scheduler', highlight: ['controller', 'scheduler'] },
      { title: '6. Kubelet accepts the pod', desc: 'Kubelet on the chosen node pulls the pod spec.', ms: 2400, path: 'p-scheduler-node2', highlight: ['scheduler', 'node2'] },
      { title: '7. Container runtime starts pod', desc: 'containerd creates the sandbox and starts containers.', ms: 2200, highlight: ['node2'], reveal: ['node2-g3'] },
      { title: '8. Pod is Ready', desc: 'Pod passes readiness probes and joins the Service.', ms: 2800, highlight: ['node2', 'api'], reveal: ['node2-g3'], pulse: ['node2-g3'] },
    ],
  },
  {
    id: 'scale', title: 'Scale Deployment', category: 'Workloads', icon: 'replicaset', stage: 'control',
    blurb: 'replicas: 1 \u2192 3. Controller creates pods, scheduler spreads them.',
    steps: [
      { title: '1. kubectl scale --replicas=3', desc: 'User updates the desired replica count.', ms: 2200, path: 'p-user-api', highlight: ['user', 'api'] },
      { title: '2. Controller updates ReplicaSet', desc: 'ReplicaSet controller notices missing pods and creates them.', ms: 2400, path: 'p-api-controller', highlight: ['api', 'controller'] },
      { title: '3. Replica scheduled on Node 1', desc: 'Scheduler binds the first new pod to Node 1.', ms: 2200, path: 'p-scheduler-node1', highlight: ['scheduler', 'node1'], reveal: ['node1-g3'] },
      { title: '4. Replica scheduled on Node 2', desc: 'The second new pod is bound to Node 2.', ms: 2200, path: 'p-scheduler-node2', highlight: ['scheduler', 'node2'], reveal: ['node1-g3', 'node2-g3'] },
      { title: '5. Replica scheduled on Node 3', desc: 'The third new pod is bound to Node 3.', ms: 2200, path: 'p-scheduler-node3', highlight: ['scheduler', 'node3'], reveal: ['node1-g3', 'node2-g3', 'node3-g3'] },
      { title: '6. All replicas Ready', desc: 'Deployment reaches the desired state of 3 replicas.', ms: 2800, highlight: ['controller'], reveal: ['node1-g3', 'node2-g3', 'node3-g3'], pulse: ['node1-g3', 'node2-g3', 'node3-g3'] },
    ],
  },
  {
    id: 'rolling', title: 'Rolling Update', category: 'Workloads', icon: 'deployment', stage: 'control',
    blurb: 'v1 \u2192 v2 with a new ReplicaSet, one pod replaced at a time.',
    steps: [
      { title: '1. kubectl set image (v2)', desc: 'User triggers a rolling update to a new image version.', ms: 2200, path: 'p-user-api', highlight: ['user', 'api'] },
      { title: '2. New ReplicaSet created', desc: 'Controller creates a v2 ReplicaSet next to the v1 one.', ms: 2400, path: 'p-api-controller', highlight: ['api', 'controller'] },
      { title: '3. Surge v2 pod on Node 1', desc: 'A v2 pod starts while v1 keeps serving (maxSurge).', ms: 2200, path: 'p-scheduler-node1', highlight: ['scheduler', 'node1'], reveal: ['node1-g3'] },
      { title: '4. Surge v2 pod on Node 2', desc: 'Next v2 pod comes up as an old pod is drained.', ms: 2200, path: 'p-scheduler-node2', highlight: ['scheduler', 'node2'], reveal: ['node1-g3', 'node2-g3'] },
      { title: '5. Surge v2 pod on Node 3', desc: 'Last v2 pod replaces the final v1 pod.', ms: 2200, path: 'p-scheduler-node3', highlight: ['scheduler', 'node3'], reveal: ['node1-g3', 'node2-g3', 'node3-g3'] },
      { title: '6. Update complete', desc: 'All traffic now flows to v2; old ReplicaSet scales to zero.', ms: 2800, highlight: ['controller'], reveal: ['node1-g3', 'node2-g3', 'node3-g3'], pulse: ['node1-g3', 'node2-g3', 'node3-g3'] },
    ],
  },
  {
    id: 'selfheal', title: 'Node Failure & Self-Healing', category: 'Reliability', icon: 'worker-node', stage: 'control',
    blurb: 'A node dies and the control plane reschedules its pods.',
    steps: [
      { title: '1. Node 2 goes down', desc: 'The node stops sending heartbeats to the API server.', ms: 2400, highlight: ['node2'], fail: ['node2'] },
      { title: '2. Controller detects the loss', desc: 'Node controller marks the node NotReady and its pods as lost.', ms: 2400, path: 'p-api-controller', highlight: ['api', 'controller'], fail: ['node2'] },
      { title: '3. Reschedule pod to Node 1', desc: 'Replacement pods are scheduled onto healthy nodes.', ms: 2200, path: 'p-scheduler-node1', highlight: ['scheduler', 'node1'], fail: ['node2'], reveal: ['node1-g3'] },
      { title: '4. Reschedule pod to Node 3', desc: 'The remaining replica lands on Node 3.', ms: 2200, path: 'p-scheduler-node3', highlight: ['scheduler', 'node3'], fail: ['node2'], reveal: ['node1-g3', 'node3-g3'] },
      { title: '5. Desired state restored', desc: 'Self-healing complete: replica count is back to normal.', ms: 2800, highlight: ['controller'], fail: ['node2'], reveal: ['node1-g3', 'node3-g3'], pulse: ['node1-g3', 'node3-g3'] },
    ],
  },
  {
    id: 'schedule', title: 'How the Scheduler Decides', category: 'Scheduling', icon: 'scheduler', stage: 'control',
    blurb: 'Filtering and scoring nodes for a single pending pod.',
    steps: [
      { title: '1. Pending pod created', desc: 'Controller creates a pod with no node assigned yet.', ms: 2200, path: 'p-api-controller', highlight: ['api', 'controller'] },
      { title: '2. Scheduler evaluates nodes', desc: 'kube-scheduler runs filter + score plugins on every node.', ms: 2600, path: 'p-controller-scheduler', highlight: ['scheduler', 'node1', 'node2', 'node3'] },
      { title: '3. Node 1 filtered out', desc: 'Node 1 fails a predicate (insufficient CPU) and is discarded.', ms: 2400, highlight: ['scheduler', 'node1'], status: [{ id: 'node1', text: 'Filtered' }] },
      { title: '4. Node 2 wins the score', desc: 'Node 2 has the best score, so the pod is bound to it.', ms: 2400, path: 'p-scheduler-node2', highlight: ['scheduler', 'node2'], reveal: ['node2-g3'] },
      { title: '5. Pod bound and Running', desc: 'The binding is written back and kubelet starts the pod.', ms: 2800, highlight: ['node2'], reveal: ['node2-g3'], pulse: ['node2-g3'] },
    ],
  },

  /* ---- Networking ---- */
  {
    id: 'svc-types', title: 'ClusterIP vs NodePort vs LoadBalancer', category: 'Networking', icon: 'service', stage: 'service',
    blurb: 'Three ways to expose a Service and how traffic reaches pods.',
    steps: [
      { title: '1. ClusterIP — in-cluster only', desc: 'The default type. Reachable only from inside the cluster via a stable virtual IP.', ms: 2600, path: 'p-svc-ep1', highlight: ['svc', 'ep1'], pulse: ['ep1'] },
      { title: '2. ClusterIP load-balances pods', desc: 'kube-proxy spreads requests across all Service endpoints.', ms: 2600, highlight: ['svc', 'ep1', 'ep2', 'ep3'] },
      { title: '3. NodePort opens a node port', desc: 'A static port (30007) is opened on every node for external access.', ms: 2600, path: 'p-internet-nodeport', highlight: ['internet', 'nodeport'] },
      { title: '4. NodePort → Service → pod', desc: 'External traffic hits the node port and is forwarded to the Service.', ms: 2600, path: 'p-nodeport-svc', highlight: ['nodeport', 'svc', 'ep2'], pulse: ['ep2'] },
      { title: '5. LoadBalancer provisions a cloud LB', desc: 'The cloud provider creates an external load balancer with a public IP.', ms: 2600, path: 'p-internet-lb', highlight: ['internet', 'lb'] },
      { title: '6. LoadBalancer → Service → pod', desc: 'The LB forwards to NodePort/Service, which routes to a healthy pod.', ms: 2800, path: 'p-lb-svc', highlight: ['lb', 'svc', 'ep3'], pulse: ['ep3'] },
    ],
  },
  {
    id: 'svc-lb', title: 'Service Load Balancing', category: 'Networking', icon: 'service', stage: 'service',
    blurb: 'How kube-proxy spreads requests across pod endpoints.',
    steps: [
      { title: '1. Client hits the Service IP', desc: 'A request arrives at the Service ClusterIP.', ms: 2400, path: 'p-internet-svc', highlight: ['internet', 'svc'] },
      { title: '2. Request → pod 1', desc: 'kube-proxy forwards the first connection to endpoint 1.', ms: 2200, path: 'p-svc-ep1', highlight: ['svc', 'ep1'], pulse: ['ep1'] },
      { title: '3. Request → pod 2', desc: 'The next connection is balanced to endpoint 2.', ms: 2200, path: 'p-svc-ep2', highlight: ['svc', 'ep2'], pulse: ['ep2'] },
      { title: '4. Request → pod 3', desc: 'A third connection lands on endpoint 3.', ms: 2200, path: 'p-svc-ep3', highlight: ['svc', 'ep3'], pulse: ['ep3'] },
      { title: '5. Traffic spread evenly', desc: 'Over many requests, load is distributed across all healthy pods.', ms: 2800, highlight: ['svc', 'ep1', 'ep2', 'ep3'], pulse: ['ep1', 'ep2', 'ep3'] },
    ],
  },
  {
    id: 'netpol', title: 'NetworkPolicy Allow / Deny', category: 'Networking', icon: 'networkpolicy', stage: 'netpol',
    blurb: 'frontend → backend allowed, frontend → database blocked.',
    steps: [
      { title: '1. No policy — all traffic allowed', desc: 'Without a NetworkPolicy, every pod can talk to every other pod.', ms: 2600, highlight: ['frontend', 'backend', 'database'], links: [{ id: 'p-fe-be', state: 'allow' }, { id: 'p-be-db', state: 'allow' }] },
      { title: '2. Apply NetworkPolicy on database', desc: 'Policy: database only accepts traffic from pods labelled app=backend.', ms: 2600, highlight: ['database'] },
      { title: '3. frontend → backend: allowed', desc: 'Frontend to backend is permitted by policy.', ms: 2400, path: 'p-fe-be', highlight: ['frontend', 'backend'], links: [{ id: 'p-fe-be', state: 'active' }], pulse: [] },
      { title: '4. backend → database: allowed', desc: 'Backend matches the allowed selector, so the connection succeeds.', ms: 2400, path: 'p-be-db', highlight: ['backend', 'database'], links: [{ id: 'p-be-db', state: 'active' }] },
      { title: '5. frontend → database: DENIED', desc: 'Frontend is not in the allowed selector — the packet is dropped.', ms: 3000, highlight: ['frontend', 'database'], links: [{ id: 'p-fe-db', state: 'deny' }], reveal: ['deny-badge'] },
    ],
  },

  /* ---- Configuration ---- */
  {
    id: 'configsecret', title: 'ConfigMap / Secret Mount', category: 'Configuration', icon: 'configmap', stage: 'config',
    blurb: 'Injecting config as env vars and secrets as mounted volumes.',
    steps: [
      { title: '1. Apply ConfigMap & Secret', desc: 'User creates a ConfigMap and a Secret in the cluster.', ms: 2600, path: 'p-user-cm', highlight: ['configmap', 'secret'] },
      { title: '2. Pod references them', desc: 'The pod spec declares envFrom the ConfigMap and a volume from the Secret.', ms: 2400, highlight: ['apppod'] },
      { title: '3. ConfigMap injected as env vars', desc: 'Kubelet turns ConfigMap keys into environment variables in the container.', ms: 2600, path: 'p-cm-pod', highlight: ['configmap', 'apppod'], reveal: ['cfg-mount'] },
      { title: '4. Secret mounted as a volume', desc: 'Kubelet mounts the Secret as files under /etc/secret (tmpfs).', ms: 2600, path: 'p-sec-pod', highlight: ['secret', 'apppod'], reveal: ['cfg-mount', 'sec-mount'] },
      { title: '5. App reads config at runtime', desc: 'The container reads env vars and secret files without a restart on updates.', ms: 2800, highlight: ['apppod'], reveal: ['cfg-mount', 'sec-mount'], pulse: ['cfg-mount', 'sec-mount'] },
    ],
  },
];

const STAGE_BUILDERS: Record<StageKind, () => string> = {
  control: stageControl,
  service: stageService,
  netpol: stageNetpol,
  config: stageConfig,
};

/* ================================================================== */
/*  App shell                                                          */
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
      <svg id="scene" viewBox="0 0 ${VBW} ${VBH}" preserveAspectRatio="xMidYMid meet"></svg>
    </div>

    <section class="story">
      <div class="story-card">
        <div class="story-label"><span id="story-cat">Workloads</span> · <span id="story-name">Deploy a Pod</span></div>
        <h1 id="step-title"></h1>
        <p id="step-desc"></p>
        <ol id="step-list" class="step-list"></ol>
      </div>
    </section>

    <footer class="legend" id="legend"></footer>

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
const legendEl  = document.querySelector<HTMLElement>('#legend')!;
const btnPlay   = document.querySelector<HTMLButtonElement>('#btn-play')!;
const btnReset  = document.querySelector<HTMLButtonElement>('#btn-reset')!;
const btnMenu   = document.querySelector<HTMLButtonElement>('#btn-menu')!;
const menuEl    = document.querySelector<HTMLDivElement>('#scenario-menu')!;
const menuClose = document.querySelector<HTMLButtonElement>('#menu-close')!;

let packetG: SVGGElement;
let scenario: Scenario = SCENARIOS[0];
let stepIndex = 0;
let stepStart = performance.now();
let paused = false;
let pauseAt = 0;

const LEGENDS: Record<StageKind, { cls: string; label: string }[]> = {
  control: [
    { cls: 'lg-cp', label: 'Control Plane' },
    { cls: 'lg-node', label: 'Worker Nodes' },
    { cls: 'lg-pod', label: 'Pods' },
    { cls: 'lg-user', label: 'User (kubectl)' },
  ],
  service: [
    { cls: 'lg-user', label: 'Internet / Client' },
    { cls: 'lg-cp', label: 'LoadBalancer / NodePort' },
    { cls: 'lg-node', label: 'Service' },
    { cls: 'lg-pod', label: 'Pod endpoints' },
  ],
  netpol: [
    { cls: 'lg-node', label: 'Pods' },
    { cls: 'lg-allow', label: 'Allowed' },
    { cls: 'lg-deny', label: 'Denied' },
  ],
  config: [
    { cls: 'lg-user', label: 'User (kubectl)' },
    { cls: 'lg-cp', label: 'ConfigMap / Secret' },
    { cls: 'lg-node', label: 'Pod' },
  ],
};

function renderStage(kind: StageKind) {
  sceneEl.innerHTML = DEFS + STAGE_BUILDERS[kind]() + PACKET;
  packetG = sceneEl.querySelector<SVGGElement>('#packet-group')!;
  legendEl.innerHTML = LEGENDS[kind].map((l) => `<span class="lg ${l.cls}">${l.label}</span>`).join('');
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
  sceneEl.querySelectorAll<SVGGElement>('[data-id]').forEach((g) => {
    const id = g.getAttribute('data-id');
    g.classList.toggle('active', !!id && hi.has(id));
  });

  /* failed nodes + status text reset */
  const failSet = new Set(step.fail ?? []);
  sceneEl.querySelectorAll<SVGGElement>('.node').forEach((g) => {
    const id = g.getAttribute('data-id') ?? '';
    g.classList.toggle('failed', failSet.has(id));
  });
  sceneEl.querySelectorAll<SVGTextElement>('[data-status]').forEach((t) => {
    const id = t.getAttribute('data-status') ?? '';
    const def = t.getAttribute('data-default') ?? '';
    t.textContent = failSet.has(id) ? 'NotReady' : def;
  });
  for (const s of step.status ?? []) {
    const t = sceneEl.querySelector<SVGTextElement>(`[data-status="${s.id}"]`);
    if (t) t.textContent = s.text;
  }

  /* reveal (cumulative) + pulse */
  sceneEl.querySelectorAll<SVGGElement>('.ghost').forEach((g) => g.classList.remove('visible'));
  sceneEl.querySelectorAll<SVGGElement>('.pulsing').forEach((g) => g.classList.remove('pulsing'));
  const revealed = new Set<string>();
  for (let i = 0; i <= stepIndex; i++) for (const r of scenario.steps[i].reveal ?? []) revealed.add(r);
  revealed.forEach((el) => sceneEl.querySelector(`[data-el="${el}"]`)?.classList.add('visible'));
  for (const el of step.pulse ?? []) sceneEl.querySelector(`[data-el="${el}"]`)?.classList.add('pulsing');

  /* links */
  sceneEl.querySelectorAll<SVGPathElement>('.link').forEach((l) => l.classList.remove('active', 'allow', 'deny'));
  for (const l of step.links ?? []) sceneEl.querySelector(`#${l.id}`)?.classList.add(l.state);
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

  renderStage(scenario.stage);
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

  const pathEl = step.path ? (sceneEl.querySelector<SVGPathElement>(`#${step.path}`)) : null;
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
