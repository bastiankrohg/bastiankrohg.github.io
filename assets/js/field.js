// Field: a small 2.5D scene. Fly a survey drone over a field to find
// markers about my background. No libraries; one canvas, one loop.
(function () {
  "use strict";

  var canvas = document.getElementById("field");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");

  var W = 2400, H = 1600;           // world size
  var FIND_R = 64;                  // discovery radius
  var SCAN_R = 78;                  // detector footprint over hazard areas
  var MAX_SPEED = 330;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------------------------------------------------------------- content

  var POIS = [
    { id: "uio", x: 1200, y: 800, kind: "flag-no",
      title: "PhD, University of Oslo", when: "Nov 2025 –",
      text: "Robotics for humanitarian mine action. Robotics and Autonomous Systems group, Department of Technology Systems.",
      link: "/#research", linkText: "Research",
      hint: "Start at the helipad. That's where I work now." },
    { id: "insa", x: 560, y: 430, kind: "flag-fr",
      title: "INSA Toulouse", when: "2019 – 2025",
      text: "Engineering degree (MSc) in embedded systems: real-time software, control, FPGAs and computer vision.",
      link: "/projects/insa-toulouse/", linkText: "INSA projects",
      hint: "Find a French flag. Where I trained as an engineer." },
    { id: "rover", x: 340, y: 1120, kind: "rover",
      title: "Autonomous rover", when: "Final-year project, INSA",
      text: "Led the team and built the vision pipeline, control and path planning for a small rover that navigates on its own.",
      link: "/projects/insa-toulouse/#rover", linkText: "Details",
      hint: "Something on wheels, at the end of the track." },
    { id: "sail", x: 830, y: 1300, kind: "boat",
      title: "RC sailboat", when: "INSA",
      text: "STM32 firmware that reads the wind and trims the sail automatically.",
      link: "/projects/insa-toulouse/#sailboat", linkText: "Details",
      hint: "Check the pond." },
    { id: "tsm", x: 820, y: 240, kind: "flag-fr",
      title: "Toulouse School of Management", when: "2023 – 2025",
      text: "Master of International Management, alongside the engineering degree.",
      link: "/#background", linkText: "Background",
      hint: "A second French flag. The business side." },
    { id: "snu", x: 1980, y: 330, kind: "flag-kr",
      title: "Seoul National University", when: "Fall 2021",
      text: "Exchange semester in Seoul.",
      link: "/#background", linkText: "Background",
      hint: "Look for the Korean flag." },
    { id: "inno", x: 2060, y: 1180, kind: "flag-us",
      title: "Innovation Norway, Silicon Valley", when: "Sep – Dec 2023",
      text: "Internship at Nordic Innovation House in Palo Alto. Startup programmes and an LLM assistant prototype.",
      link: "/projects/innovation-norway/", linkText: "Projects",
      hint: "An American flag." },
    { id: "lerobot", x: 1560, y: 1400, kind: "arm",
      title: "LeRobot hackathon", when: "Hugging Face",
      text: "Took part in the first LeRobot hackathon, organised by Hugging Face.",
      link: "/projects/independent/#lerobot", linkText: "More",
      hint: "A robot arm on a workbench." },
    { id: "contact", x: 1480, y: 170, kind: "mast",
      title: "Get in touch", when: "",
      text: "bastian.krohg@its.uio.no",
      link: "mailto:bastian.krohg@its.uio.no", linkText: "Email me",
      hint: "The radio mast." }
  ];

  var AREAS = [
    { x: 1450, y: 560, w: 300, h: 190 },
    { x: 220, y: 640, w: 250, h: 190 },
    { x: 1090, y: 1080, w: 280, h: 150 }
  ];

  var AREA_CARD = {
    title: "Suspected hazardous area",
    when: "Fenced and marked",
    text: "Ground like this can stay dangerous for decades. My research is on how drones can help survey teams find explosive ordnance so the land can be used again. Fly over it to scan.",
    link: "/#research", linkText: "Research"
  };

  // ------------------------------------------------------------ scene setup

  var seed = 11;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  function rr(a, b) { return a + (b - a) * rnd(); }
  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function inArea(x, y, pad) {
    for (var i = 0; i < AREAS.length; i++) {
      var a = AREAS[i];
      if (x > a.x - pad && x < a.x + a.w + pad && y > a.y - pad && y < a.y + a.h + pad) return a;
    }
    return null;
  }

  var TRACK = [[0, 930], [340, 1120], [620, 960], [900, 880], [1200, 870], [1500, 930], [1800, 860], [2100, 900], [2400, 870]];
  var POND = { x: 830, y: 1300, rx: 150, ry: 80 };

  function nearTrack(x, y, d) {
    for (var i = 0; i < TRACK.length - 1; i++) {
      var a = TRACK[i], b = TRACK[i + 1];
      var t = ((x - a[0]) * (b[0] - a[0]) + (y - a[1]) * (b[1] - a[1])) / ((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]));
      t = Math.max(0, Math.min(1, t));
      if (dist(x, y, a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])) < d) return true;
    }
    return false;
  }
  function free(x, y, pad) {
    if (inArea(x, y, pad + 30)) return false;
    if (nearTrack(x, y, pad + 26)) return false;
    if (((x - POND.x) / (POND.rx + pad)) * ((x - POND.x) / (POND.rx + pad)) + ((y - POND.y) / (POND.ry + pad)) * ((y - POND.y) / (POND.ry + pad)) < 1) return false;
    for (var i = 0; i < POIS.length; i++) if (dist(x, y, POIS[i].x, POIS[i].y) < 90 + pad) return false;
    return true;
  }

  // mines and craters inside/near the fenced areas
  AREAS.forEach(function (a) {
    a.mines = [];
    var n = Math.round((a.w * a.h) / 5200);
    for (var i = 0; i < n; i++) a.mines.push({ x: rr(a.x + 18, a.x + a.w - 18), y: rr(a.y + 18, a.y + a.h - 18), found: false });
    a.entered = false;
    a.done = false;
  });
  var craters = [];
  AREAS.forEach(function (a) {
    for (var i = 0; i < 2; i++) craters.push({ x: rr(a.x + 30, a.x + a.w - 30), y: rr(a.y + 30, a.y + a.h - 30), r: rr(14, 24) });
  });
  for (var c = 0; c < 6; c++) {
    var cx = rr(100, W - 100), cy = rr(100, H - 100);
    if (free(cx, cy, 10)) craters.push({ x: cx, y: cy, r: rr(10, 18) });
  }

  // trees in loose clusters, plus shrubs
  var props = [];
  var clusters = [[140, 180, 200], [1100, 380, 180], [2250, 640, 200], [1850, 1500, 180], [120, 1480, 170], [2300, 120, 150], [560, 780, 110], [1300, 1580, 140], [1750, 330, 90]];
  clusters.forEach(function (cl) {
    var n = Math.round(cl[2] / 11);
    for (var i = 0; i < n; i++) {
      var ang = rnd() * Math.PI * 2, rad = Math.sqrt(rnd()) * cl[2];
      var x = cl[0] + Math.cos(ang) * rad, y = cl[1] + Math.sin(ang) * rad * 0.8;
      if (x < 20 || x > W - 20 || y < 30 || y > H - 10 || !free(x, y, 16)) continue;
      props.push({ type: rnd() < 0.45 ? "pine" : "tree", x: x, y: y, r: rr(15, 26), s: rnd() });
    }
  });
  for (var s = 0; s < 150; s++) {
    var sx = rr(20, W - 20), sy = rr(20, H - 20);
    if (free(sx, sy, 4)) props.push({ type: "shrub", x: sx, y: sy, r: rr(6, 11), s: rnd() });
  }

  // fence segments: posts every ~32 units around each area
  AREAS.forEach(function (a) {
    var pts = [];
    var nx = Math.max(2, Math.round(a.w / 32)), ny = Math.max(2, Math.round(a.h / 32));
    var i;
    for (i = 0; i < nx; i++) pts.push([a.x + (a.w * i) / nx, a.y]);
    for (i = 0; i < ny; i++) pts.push([a.x + a.w, a.y + (a.h * i) / ny]);
    for (i = nx; i > 0; i--) pts.push([a.x + (a.w * i) / nx, a.y + a.h]);
    for (i = ny; i > 0; i--) pts.push([a.x, a.y + (a.h * i) / ny]);
    for (i = 0; i < pts.length; i++) {
      var p = pts[i], q = pts[(i + 1) % pts.length];
      props.push({ type: "fence", x: p[0], y: Math.max(p[1], q[1]), p: p, q: q, sign: i % 3 === 1 });
    }
  });

  POIS.forEach(function (p) { props.push({ type: "poi", x: p.x, y: p.y, poi: p }); });

  // --------------------------------------------------------- ground texture

  var ground = document.createElement("canvas");
  ground.width = W; ground.height = H;
  (function paintGround() {
    var g = ground.getContext("2d");
    g.fillStyle = "#9fae78";
    g.fillRect(0, 0, W, H);
    var i;
    for (i = 0; i < 160; i++) {
      g.fillStyle = rnd() < 0.5 ? "rgba(120,140,86,0.09)" : "rgba(190,196,140,0.08)";
      g.beginPath();
      g.ellipse(rr(0, W), rr(0, H), rr(40, 180), rr(25, 110), rr(0, 3), 0, Math.PI * 2);
      g.fill();
    }
    // rough, unmanaged ground inside hazard areas
    AREAS.forEach(function (a) {
      g.fillStyle = "rgba(150,132,92,0.28)";
      g.fillRect(a.x, a.y, a.w, a.h);
      for (var k = 0; k < 40; k++) {
        g.fillStyle = "rgba(110,98,66,0.18)";
        g.beginPath();
        g.ellipse(rr(a.x, a.x + a.w), rr(a.y, a.y + a.h), rr(8, 30), rr(5, 16), 0, 0, Math.PI * 2);
        g.fill();
      }
    });
    // dirt track
    g.lineCap = "round"; g.lineJoin = "round";
    [[34, "#c2ae84"], [26, "#cdb98f"]].forEach(function (st) {
      g.strokeStyle = st[1]; g.lineWidth = st[0];
      g.beginPath();
      g.moveTo(TRACK[0][0], TRACK[0][1]);
      for (var t = 1; t < TRACK.length - 1; t++) {
        var mx = (TRACK[t][0] + TRACK[t + 1][0]) / 2, my = (TRACK[t][1] + TRACK[t + 1][1]) / 2;
        g.quadraticCurveTo(TRACK[t][0], TRACK[t][1], mx, my);
      }
      g.lineTo(TRACK[TRACK.length - 1][0], TRACK[TRACK.length - 1][1]);
      g.stroke();
    });
    // pond
    g.fillStyle = "#8f9f6c";
    g.beginPath(); g.ellipse(POND.x, POND.y, POND.rx + 10, POND.ry + 8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#6f94a0";
    g.beginPath(); g.ellipse(POND.x, POND.y, POND.rx, POND.ry, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,255,255,0.12)";
    g.beginPath(); g.ellipse(POND.x - 30, POND.y - 20, POND.rx * 0.55, POND.ry * 0.4, 0, 0, Math.PI * 2); g.fill();
    // helipad
    var hp = POIS[0];
    g.fillStyle = "#b9b6a8";
    g.beginPath(); g.ellipse(hp.x, hp.y + 40, 58, 36, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#f2efe6"; g.lineWidth = 3;
    g.beginPath(); g.ellipse(hp.x, hp.y + 40, 48, 29, 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#f2efe6"; g.font = "bold 30px Archivo, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.save(); g.translate(hp.x, hp.y + 41); g.scale(1, 0.62); g.fillText("H", 0, 0); g.restore();
    // craters
    craters.forEach(function (c) {
      g.fillStyle = "rgba(170,150,110,0.9)";
      g.beginPath(); g.ellipse(c.x, c.y, c.r * 1.35, c.r * 0.85, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#6e5c43";
      g.beginPath(); g.ellipse(c.x, c.y + 1, c.r, c.r * 0.6, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#57482f";
      g.beginPath(); g.ellipse(c.x + 2, c.y + 3, c.r * 0.6, c.r * 0.34, 0, 0, Math.PI * 2); g.fill();
    });
    // grass tufts
    g.lineWidth = 1.2;
    for (i = 0; i < 1400; i++) {
      var x = rr(0, W), y = rr(0, H);
      if (nearTrack(x, y, 18)) continue;
      if (((x - POND.x) / POND.rx) * ((x - POND.x) / POND.rx) + ((y - POND.y) / POND.ry) * ((y - POND.y) / POND.ry) < 1.1) continue;
      g.strokeStyle = rnd() < 0.5 ? "rgba(92,114,62,0.55)" : "rgba(126,146,82,0.6)";
      g.beginPath();
      for (var b = -1; b <= 1; b++) { g.moveTo(x + b * 2, y); g.lineTo(x + b * 3.5, y - rr(4, 8)); }
      g.stroke();
    }
  })();

  // ------------------------------------------------------------------ state

  var drone = { x: 1200, y: 980, vx: 0, vy: 0, heading: 0 };
  var target = null;
  var keys = {};
  var found = {};
  var cam = { x: drone.x, y: drone.y, z: 1 };
  var vw = 0, vh = 0, dpr = 1;
  var time = 0;
  var started = false;

  try { found = JSON.parse(localStorage.getItem("field-found") || "{}") || {}; } catch (e) { found = {}; }
  function save() { try { localStorage.setItem("field-found", JSON.stringify(found)); } catch (e) { /* ignore */ } }

  // --------------------------------------------------------------------- UI

  var el = function (id) { return document.getElementById(id); };
  var ui = {
    count: el("fx-count"), hint: el("fx-hint"),
    card: el("fx-card"), cardWhen: el("fx-card-when"), cardTitle: el("fx-card-title"),
    cardText: el("fx-card-text"), cardLink: el("fx-card-link"), cardClose: el("fx-card-close"),
    list: el("fx-list"), listBtn: el("fx-list-btn"), listItems: el("fx-list-items"), reset: el("fx-reset"),
    intro: el("fx-intro"), start: el("fx-start")
  };

  function nextPoi() {
    for (var i = 0; i < POIS.length; i++) if (!found[POIS[i].id]) return POIS[i];
    return null;
  }
  function foundCount() { var n = 0; POIS.forEach(function (p) { if (found[p.id]) n++; }); return n; }

  function renderStatus() {
    var n = foundCount();
    ui.count.textContent = n + " / " + POIS.length + " found";
    var nx = nextPoi();
    ui.hint.textContent = nx ? nx.hint : "All found. Thanks for flying.";
    ui.listItems.innerHTML = "";
    POIS.forEach(function (p) {
      var li = document.createElement("li");
      if (found[p.id]) {
        var a = document.createElement("a");
        a.href = p.link; a.textContent = p.title;
        li.appendChild(a);
        if (p.when) { var s = document.createElement("span"); s.textContent = p.when; li.appendChild(s); }
      } else {
        li.className = "is-missing";
        li.textContent = p.hint;
      }
      ui.listItems.appendChild(li);
    });
  }

  function showCard(c) {
    ui.cardWhen.textContent = c.when || "";
    ui.cardWhen.hidden = !c.when;
    ui.cardTitle.textContent = c.title;
    ui.cardText.textContent = c.text;
    ui.cardLink.href = c.link;
    ui.cardLink.textContent = c.linkText + " →";
    ui.card.hidden = false;
  }

  ui.cardClose.addEventListener("click", function () { ui.card.hidden = true; canvas.focus(); });
  ui.listBtn.addEventListener("click", function () {
    var open = ui.list.hidden;
    ui.list.hidden = !open;
    ui.listBtn.setAttribute("aria-expanded", String(open));
  });
  ui.reset.addEventListener("click", function () {
    found = {}; save();
    AREAS.forEach(function (a) { a.entered = false; a.done = false; a.mines.forEach(function (m) { m.found = false; }); });
    drone.x = 1200; drone.y = 980; drone.vx = drone.vy = 0; target = null;
    ui.card.hidden = true;
    renderStatus();
  });
  function start() {
    started = true;
    ui.intro.hidden = true;
    canvas.focus();
  }
  ui.start.addEventListener("click", start);

  // ------------------------------------------------------------------ input

  function toWorld(clientX, clientY) {
    var r = canvas.getBoundingClientRect();
    return { x: (clientX - r.left - vw / 2) / cam.z + cam.x, y: (clientY - r.top - vh / 2) / cam.z + cam.y };
  }
  var pointerDown = false;
  canvas.addEventListener("pointerdown", function (e) {
    if (!started) start();
    pointerDown = true;
    canvas.setPointerCapture(e.pointerId);
    target = toWorld(e.clientX, e.clientY);
  });
  canvas.addEventListener("pointermove", function (e) { if (pointerDown) target = toWorld(e.clientX, e.clientY); });
  canvas.addEventListener("pointerup", function () { pointerDown = false; });
  canvas.addEventListener("pointercancel", function () { pointerDown = false; });

  var KEYMAP = { ArrowUp: "u", KeyW: "u", ArrowDown: "d", KeyS: "d", ArrowLeft: "l", KeyA: "l", ArrowRight: "r", KeyD: "r" };
  window.addEventListener("keydown", function (e) {
    var k = KEYMAP[e.code];
    if (!k) return;
    if (e.target && /INPUT|TEXTAREA|SELECT|BUTTON|A/.test(e.target.tagName) && e.target !== canvas) return;
    if (!started) start();
    keys[k] = true; target = null;
    e.preventDefault();
  });
  window.addEventListener("keyup", function (e) { var k = KEYMAP[e.code]; if (k) keys[k] = false; });
  window.addEventListener("blur", function () { keys = {}; });

  // ------------------------------------------------------------------ sizes

  function resize() {
    var header = document.querySelector(".site-header");
    var hh = header ? header.getBoundingClientRect().height : 0;
    canvas.parentElement.style.height = Math.max(420, window.innerHeight - hh) + "px";
    var r = canvas.getBoundingClientRect();
    vw = r.width; vh = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    cam.z = Math.max(0.6, Math.min(1.15, Math.min(vw / 1150, vh / 720)));
  }
  window.addEventListener("resize", resize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);

  // ----------------------------------------------------------------- update

  function update(dt) {
    var ax = 0, ay = 0;
    var kx = (keys.r ? 1 : 0) - (keys.l ? 1 : 0), ky = (keys.d ? 1 : 0) - (keys.u ? 1 : 0);
    if (kx || ky) {
      var kl = Math.sqrt(kx * kx + ky * ky);
      ax = (kx / kl) * 900; ay = (ky / kl) * 900;
      drone.vx *= 1 - Math.min(1, 1.5 * dt); drone.vy *= 1 - Math.min(1, 1.5 * dt);
    } else if (target) {
      var dx = target.x - drone.x, dy = target.y - drone.y, d = Math.sqrt(dx * dx + dy * dy);
      var sp = Math.min(MAX_SPEED, d * 2.4);
      var tvx = d > 1 ? (dx / d) * sp : 0, tvy = d > 1 ? (dy / d) * sp : 0;
      ax = (tvx - drone.vx) * 5; ay = (tvy - drone.vy) * 5;
      if (d < 3 && !pointerDown) target = null;
    } else {
      drone.vx *= 1 - Math.min(1, 3 * dt); drone.vy *= 1 - Math.min(1, 3 * dt);
    }
    drone.vx += ax * dt; drone.vy += ay * dt;
    var v = Math.sqrt(drone.vx * drone.vx + drone.vy * drone.vy);
    if (v > MAX_SPEED) { drone.vx *= MAX_SPEED / v; drone.vy *= MAX_SPEED / v; }
    drone.x = Math.max(30, Math.min(W - 30, drone.x + drone.vx * dt));
    drone.y = Math.max(60, Math.min(H - 20, drone.y + drone.vy * dt));
    if (v > 20) drone.heading = Math.atan2(drone.vy, drone.vx);

    // discoveries
    POIS.forEach(function (p) {
      if (!found[p.id] && dist(drone.x, drone.y, p.x, p.y) < FIND_R) {
        found[p.id] = true; save();
        showCard(p);
        renderStatus();
      }
    });
    // scanning hazard areas
    var a = inArea(drone.x, drone.y, 0);
    if (a && !a.entered) { a.entered = true; showCard(AREA_CARD); }
    AREAS.forEach(function (ar) {
      var left = 0;
      ar.mines.forEach(function (m) {
        if (!m.found && dist(drone.x, drone.y, m.x, m.y) < SCAN_R) m.found = true;
        if (!m.found) left++;
      });
      if (!ar.done && left === 0) ar.done = true;
    });

    // camera
    var lerp = reduce ? 1 : Math.min(1, dt * 4);
    cam.x += (drone.x - cam.x) * lerp;
    cam.y += (drone.y - cam.y) * lerp;
    var hw = vw / 2 / cam.z, hh = vh / 2 / cam.z;
    cam.x = hw * 2 >= W ? W / 2 : Math.max(hw, Math.min(W - hw, cam.x));
    cam.y = hh * 2 >= H ? H / 2 : Math.max(hh, Math.min(H - hh, cam.y));
  }

  // ------------------------------------------------------------------- draw

  function shadow(x, y, rx, ry, a) {
    ctx.fillStyle = "rgba(40,48,24," + (a || 0.22) + ")";
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawTree(p) {
    shadow(p.x + p.r * 0.5, p.y + 3, p.r * 1.1, p.r * 0.45);
    ctx.fillStyle = "#6b4f35";
    ctx.fillRect(p.x - 2.5, p.y - 14, 5, 15);
    var cy = p.y - 14 - p.r * 0.7;
    ctx.fillStyle = p.s < 0.5 ? "#5d7a45" : "#66804a";
    ctx.beginPath();
    ctx.arc(p.x - p.r * 0.35, cy + 4, p.r * 0.7, 0, Math.PI * 2);
    ctx.arc(p.x + p.r * 0.35, cy + 4, p.r * 0.7, 0, Math.PI * 2);
    ctx.arc(p.x, cy - p.r * 0.2, p.r * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(200,214,140,0.28)";
    ctx.beginPath(); ctx.arc(p.x - p.r * 0.25, cy - p.r * 0.35, p.r * 0.42, 0, Math.PI * 2); ctx.fill();
  }

  function drawPine(p) {
    var h = p.r * 2.6;
    shadow(p.x + p.r * 0.6, p.y + 3, p.r * 0.9, p.r * 0.38);
    ctx.fillStyle = "#5e4630";
    ctx.fillRect(p.x - 2, p.y - 8, 4, 9);
    for (var i = 0; i < 3; i++) {
      var w = p.r * (1 - i * 0.24), top = p.y - 8 - h * (0.42 + i * 0.26), base = p.y - 6 - h * i * 0.24;
      ctx.fillStyle = i % 2 ? "#4c6b40" : "#44613a";
      ctx.beginPath(); ctx.moveTo(p.x, top); ctx.lineTo(p.x + w, base); ctx.lineTo(p.x - w, base); ctx.closePath(); ctx.fill();
    }
  }

  function drawShrub(p) {
    shadow(p.x + 3, p.y + 1, p.r * 1.2, p.r * 0.45, 0.16);
    ctx.fillStyle = p.s < 0.5 ? "#728d4f" : "#7c9655";
    ctx.beginPath();
    ctx.arc(p.x - p.r * 0.5, p.y - p.r * 0.5, p.r * 0.7, 0, Math.PI * 2);
    ctx.arc(p.x + p.r * 0.5, p.y - p.r * 0.5, p.r * 0.7, 0, Math.PI * 2);
    ctx.arc(p.x, p.y - p.r * 0.9, p.r * 0.75, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawFence(f) {
    var p = f.p, q = f.q, h = 12;
    ctx.strokeStyle = "rgba(40,40,30,0.25)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p[0] + 3, p[1] + 1); ctx.lineTo(q[0] + 3, q[1] + 1); ctx.stroke();
    // tape
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "#f4f1ea";
    ctx.beginPath(); ctx.moveTo(p[0], p[1] - h); ctx.lineTo(q[0], q[1] - h); ctx.stroke();
    ctx.lineDashOffset = 5;
    ctx.strokeStyle = "#c8261b";
    ctx.beginPath(); ctx.moveTo(p[0], p[1] - h); ctx.lineTo(q[0], q[1] - h); ctx.stroke();
    ctx.setLineDash([]); ctx.lineDashOffset = 0;
    // post
    ctx.fillStyle = "#7d6446";
    ctx.fillRect(p[0] - 1.5, p[1] - h - 4, 3, h + 4);
    if (f.sign) {
      var sx = p[0], sy = p[1] - h - 6;
      ctx.fillStyle = "#c8261b";
      ctx.beginPath(); ctx.moveTo(sx, sy - 12); ctx.lineTo(sx + 8, sy + 2); ctx.lineTo(sx - 8, sy + 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 4px Archivo, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.fillText("MINES", sx, sy);
    }
  }

  function flag(x, top, kind, wave) {
    var fw = 30, fh = 20;
    ctx.save();
    ctx.translate(x + 1, top);
    ctx.transform(1, wave * 0.06, 0, 1, 0, 0);
    ctx.beginPath(); ctx.rect(0, 0, fw, fh); ctx.clip();
    if (kind === "flag-no") {
      ctx.fillStyle = "#ba0c2f"; ctx.fillRect(0, 0, fw, fh);
      ctx.fillStyle = "#fff"; ctx.fillRect(8, 0, 5, fh); ctx.fillRect(0, 7.5, fw, 5);
      ctx.fillStyle = "#00205b"; ctx.fillRect(9.4, 0, 2.2, fh); ctx.fillRect(0, 8.9, fw, 2.2);
    } else if (kind === "flag-fr") {
      ctx.fillStyle = "#0055a4"; ctx.fillRect(0, 0, 10, fh);
      ctx.fillStyle = "#fff"; ctx.fillRect(10, 0, 10, fh);
      ctx.fillStyle = "#ef4135"; ctx.fillRect(20, 0, 10, fh);
    } else if (kind === "flag-kr") {
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, fw, fh);
      ctx.fillStyle = "#cd2e3a"; ctx.beginPath(); ctx.arc(15, 10, 5, Math.PI, 0); ctx.fill();
      ctx.fillStyle = "#0047a0"; ctx.beginPath(); ctx.arc(15, 10, 5, 0, Math.PI); ctx.fill();
      ctx.fillStyle = "#222";
      ctx.fillRect(4, 3, 4, 1); ctx.fillRect(22, 3, 4, 1); ctx.fillRect(4, 16, 4, 1); ctx.fillRect(22, 16, 4, 1);
    } else {
      for (var i = 0; i < 7; i++) { ctx.fillStyle = i % 2 ? "#fff" : "#b22234"; ctx.fillRect(0, (i * fh) / 7, fw, fh / 7 + 0.5); }
      ctx.fillStyle = "#3c3b6e"; ctx.fillRect(0, 0, 13, 11);
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(0,0,0,0.15)"; ctx.lineWidth = 1;
  }

  function drawRover(x, y) {
    shadow(x + 6, y + 3, 24, 8);
    ctx.fillStyle = "#222";
    [-14, 0, 14].forEach(function (o) { ctx.beginPath(); ctx.ellipse(x + o, y, 5, 4, 0, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = "#d8d4c8"; ctx.fillRect(x - 18, y - 12, 36, 8);
    ctx.fillStyle = "#3a6e48"; ctx.fillRect(x - 8, y - 20, 14, 8);
    ctx.fillStyle = "#444"; ctx.fillRect(x + 8, y - 30, 3, 18);
    ctx.fillStyle = "#e8e6df"; ctx.fillRect(x + 4, y - 36, 12, 7);
    ctx.fillStyle = "#333"; ctx.beginPath(); ctx.arc(x + 7, y - 32.5, 2, 0, 7); ctx.arc(x + 13, y - 32.5, 2, 0, 7); ctx.fill();
  }

  function drawBoat(x, y, t) {
    var bob = reduce ? 0 : Math.sin(t * 1.6) * 1.5;
    y += bob;
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath(); ctx.ellipse(x, y + 3, 22, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e9e5da";
    ctx.beginPath(); ctx.moveTo(x - 16, y - 4); ctx.lineTo(x + 18, y - 4); ctx.lineTo(x + 10, y + 3); ctx.lineTo(x - 12, y + 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#555"; ctx.fillRect(x - 1, y - 40, 2, 36);
    ctx.fillStyle = "#c8261b"; ctx.beginPath(); ctx.moveTo(x + 1, y - 40); ctx.lineTo(x + 16, y - 8); ctx.lineTo(x + 1, y - 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#6fa0c8"; ctx.beginPath(); ctx.moveTo(x - 1, y - 34); ctx.lineTo(x - 12, y - 8); ctx.lineTo(x - 1, y - 8); ctx.closePath(); ctx.fill();
  }

  function drawArm(x, y, t) {
    shadow(x + 8, y + 3, 30, 9);
    ctx.fillStyle = "#8a6c4a"; ctx.fillRect(x - 26, y - 22, 52, 6);
    ctx.fillStyle = "#6e5538"; ctx.fillRect(x - 24, y - 16, 3, 16); ctx.fillRect(x + 21, y - 16, 3, 16);
    var a1 = -1.2 + (reduce ? 0 : Math.sin(t * 0.9) * 0.35), a2 = 1.1 + (reduce ? 0 : Math.sin(t * 1.3) * 0.3);
    var bx = x - 4, by = y - 24;
    var ex = bx + Math.cos(a1) * 18, ey = by + Math.sin(a1) * 18;
    var hx = ex + Math.cos(a1 + a2) * 15, hy = ey + Math.sin(a1 + a2) * 15;
    ctx.strokeStyle = "#f0b429"; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = "#333";
    [[bx, by], [ex, ey], [hx, hy]].forEach(function (j) { ctx.beginPath(); ctx.arc(j[0], j[1], 2.5, 0, 7); ctx.fill(); });
    ctx.fillStyle = "#c8261b"; ctx.fillRect(x + 10, y - 27, 6, 5);
  }

  function drawMast(x, y, t) {
    shadow(x + 20, y + 3, 26, 7);
    ctx.strokeStyle = "#6b6b66"; ctx.lineWidth = 1.5;
    var h = 110;
    ctx.beginPath();
    ctx.moveTo(x - 10, y); ctx.lineTo(x - 2, y - h); ctx.moveTo(x + 10, y); ctx.lineTo(x + 2, y - h);
    for (var i = 0; i < 8; i++) {
      var y1 = y - (h * i) / 8, y2 = y - (h * (i + 1)) / 8;
      var w1 = 10 - (8 * i) / 8, w2 = 10 - (8 * (i + 1)) / 8;
      ctx.moveTo(x - w1, y1); ctx.lineTo(x + w2, y2);
      ctx.moveTo(x + w1, y1); ctx.lineTo(x - w2, y2);
    }
    ctx.stroke();
    var on = reduce || Math.sin(t * 3) > 0;
    ctx.fillStyle = on ? "#e0321f" : "#6b2a22";
    ctx.beginPath(); ctx.arc(x, y - h - 3, 3, 0, 7); ctx.fill();
  }

  function drawPoi(p, t) {
    var isFound = !!found[p.id];
    // ground ring so markers are easy to spot
    ctx.strokeStyle = isFound ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    var pulse = isFound || reduce ? 0 : (Math.sin(t * 2.5) + 1) * 3;
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, 26 + pulse, 13 + pulse / 2, 0, 0, Math.PI * 2); ctx.stroke();

    if (p.kind.indexOf("flag") === 0) {
      shadow(p.x + 14, p.y + 2, 18, 4, 0.18);
      ctx.fillStyle = "#555"; ctx.fillRect(p.x - 1, p.y - 58, 2.2, 58);
      flag(p.x, p.y - 58, p.kind, reduce ? 0 : Math.sin(t * 2 + p.x));
    } else if (p.kind === "rover") drawRover(p.x, p.y);
    else if (p.kind === "boat") drawBoat(p.x, p.y, t);
    else if (p.kind === "arm") drawArm(p.x, p.y, t);
    else if (p.kind === "mast") drawMast(p.x, p.y, t);

    if (isFound) {
      var label = p.title;
      ctx.font = "500 11px 'IBM Plex Mono', monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      var tw = ctx.measureText(label).width + 12;
      ctx.fillStyle = "rgba(21,23,26,0.78)";
      ctx.fillRect(p.x - tw / 2, p.y + 18, tw, 17);
      ctx.fillStyle = "#f3f1ea";
      ctx.fillText(label, p.x, p.y + 27);
    }
  }

  function drawMines() {
    AREAS.forEach(function (a) {
      a.mines.forEach(function (m) {
        ctx.fillStyle = "#5e5d44";
        ctx.beginPath(); ctx.ellipse(m.x, m.y, 5, 3.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#7b7a5c";
        ctx.beginPath(); ctx.ellipse(m.x, m.y - 1, 2.6, 1.6, 0, 0, Math.PI * 2); ctx.fill();
        if (m.found) {
          ctx.strokeStyle = "#c8261b"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.ellipse(m.x, m.y, 11, 7, 0, 0, Math.PI * 2); ctx.stroke();
        }
      });
      if (a.done) {
        ctx.font = "500 11px 'IBM Plex Mono', monospace";
        ctx.textAlign = "left"; ctx.textBaseline = "top";
        ctx.fillStyle = "rgba(21,23,26,0.78)";
        var txt = a.mines.length + " items marked";
        var tw = ctx.measureText(txt).width + 12;
        ctx.fillRect(a.x + 6, a.y + 6, tw, 17);
        ctx.fillStyle = "#f3f1ea"; ctx.fillText(txt, a.x + 12, a.y + 9);
      }
    });
  }

  function drawDrone(t) {
    var alt = 40 + (reduce ? 0 : Math.sin(t * 2.2) * 2.5);
    // shadow + scan footprint on the ground
    shadow(drone.x + 6, drone.y + 2, 20, 8, 0.25);
    if (inArea(drone.x, drone.y, 0)) {
      ctx.strokeStyle = "rgba(200,38,27,0.7)"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.ellipse(drone.x, drone.y, SCAN_R, SCAN_R * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    // guidance chevron toward next marker
    var nx = nextPoi();
    if (nx && dist(drone.x, drone.y, nx.x, nx.y) > 220) {
      var ang = Math.atan2(nx.y - drone.y, nx.x - drone.x);
      var gx = drone.x + Math.cos(ang) * 44, gy = drone.y + Math.sin(ang) * 30;
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(ang);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-5, -7); ctx.lineTo(-2, 0); ctx.lineTo(-5, 7); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // body
    var bx = drone.x, by = drone.y - alt;
    var tiltX = Math.max(-4, Math.min(4, drone.vx / 80)), tiltY = Math.max(-3, Math.min(3, drone.vy / 100));
    ctx.save();
    ctx.translate(bx, by);
    var arms = [[-16, -10], [16, -10], [-16, 10], [16, 10]];
    ctx.strokeStyle = "#2a2d31"; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath();
    arms.forEach(function (a) { ctx.moveTo(0, 0); ctx.lineTo(a[0] + tiltX * (a[0] > 0 ? 1 : 0.4), a[1] * 0.7 + tiltY); });
    ctx.stroke();
    arms.forEach(function (a, i) {
      var rx = a[0] + tiltX * (a[0] > 0 ? 1 : 0.4), ry = a[1] * 0.7 + tiltY;
      ctx.fillStyle = "rgba(230,230,225,0.45)";
      ctx.beginPath(); ctx.ellipse(rx, ry - 2, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(40,40,40,0.55)"; ctx.lineWidth = 1.2;
      var sp = reduce ? 0.6 : t * 40 + i;
      ctx.beginPath(); ctx.moveTo(rx + Math.cos(sp) * 9, ry - 2 + Math.sin(sp) * 4.5); ctx.lineTo(rx - Math.cos(sp) * 9, ry - 2 - Math.sin(sp) * 4.5); ctx.stroke();
      ctx.fillStyle = "#2a2d31"; ctx.beginPath(); ctx.arc(rx, ry - 1, 2, 0, 7); ctx.fill();
    });
    ctx.fillStyle = "#33373c";
    ctx.beginPath(); ctx.ellipse(tiltX * 0.5, tiltY * 0.5, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#4a4f55";
    ctx.beginPath(); ctx.ellipse(tiltX * 0.5, tiltY * 0.5 - 2, 7, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = (reduce || Math.sin(t * 6) > 0) ? "#e0321f" : "#7a2a22";
    ctx.beginPath(); ctx.arc(tiltX * 0.5, tiltY * 0.5 + 3, 1.6, 0, 7); ctx.fill();
    ctx.restore();
  }

  function draw(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#8a9a66";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    var z = cam.z * dpr;
    ctx.setTransform(z, 0, 0, z, dpr * vw / 2 - cam.x * z, dpr * vh / 2 - cam.y * z);

    var x0 = Math.max(0, cam.x - vw / 2 / cam.z), y0 = Math.max(0, cam.y - vh / 2 / cam.z);
    var x1 = Math.min(W, cam.x + vw / 2 / cam.z), y1 = Math.min(H, cam.y + vh / 2 / cam.z);
    ctx.drawImage(ground, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);

    drawMines();

    var margin = 140;
    var vis = props.filter(function (p) { return p.x > x0 - margin && p.x < x1 + margin && p.y > y0 - 20 && p.y < y1 + margin; });
    vis.sort(function (a, b) { return a.y - b.y; });
    vis.forEach(function (p) {
      if (p.type === "tree") drawTree(p);
      else if (p.type === "pine") drawPine(p);
      else if (p.type === "shrub") drawShrub(p);
      else if (p.type === "fence") drawFence(p);
      else if (p.type === "poi") drawPoi(p.poi, t);
    });

    if (target && !(keys.u || keys.d || keys.l || keys.r)) {
      ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(target.x, target.y, 8, 5, 0, 0, Math.PI * 2); ctx.stroke();
    }
    drawDrone(t);
  }

  // ------------------------------------------------------------------- loop

  var last = null;
  function frame(now) {
    if (last === null) last = now;
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    update(dt);
    draw(time);
    requestAnimationFrame(frame);
  }

  resize();
  renderStatus();
  if (foundCount() > 0) ui.start.textContent = "Continue";
  requestAnimationFrame(frame);
})();
