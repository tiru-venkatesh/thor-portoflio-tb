// Interactive 3D Mjölnir (Three.js). Drag to rotate, click to call lightning.
(() => {
  const el = document.getElementById("hammer");
  if (!el || typeof THREE === "undefined") return;

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  /* ---------- Scene ---------- */
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0.4, 9);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  el.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0x2a3d54, 1.4));
  const key = new THREE.DirectionalLight(0x8ecbff, 2.6);
  key.position.set(4, 5, 4);
  scene.add(key);
  const rim = new THREE.PointLight(0xff2d46, 2.5, 18);
  rim.position.set(-4, -2, -2);
  scene.add(rim);
  const glow = new THREE.PointLight(0x2f9bff, 3, 12);
  glow.position.set(0, 1, 2);
  scene.add(glow);

  /* ---------- Hammer ---------- */
  const mat = {
    dark:   new THREE.MeshPhongMaterial({ color: 0x22262d, specular: 0x8ecbff, shininess: 80 }),
    silver: new THREE.MeshPhongMaterial({ color: 0x7a8594, specular: 0xdff4ff, shininess: 90 }),
    gold:   new THREE.MeshPhongMaterial({ color: 0xe5a93b, specular: 0xffe6a3, shininess: 100 }),
    leather:new THREE.MeshPhongMaterial({ color: 0x4a2e1b, specular: 0x22130c, shininess: 15 }),
    rune:   new THREE.MeshBasicMaterial({ color: 0x67e8f9, wireframe: true, transparent: true, opacity: 0.85 }),
  };
  const hammer = new THREE.Group();
  scene.add(hammer);

  function part(geometry, material, x, y, z = 0) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    hammer.add(mesh);
    return mesh;
  }

  part(new THREE.BoxGeometry(2.4, 1.5, 1.5), mat.dark, 0, 1.2);                       // head
  part(new THREE.BoxGeometry(0.2, 1.35, 1.35), mat.silver, -1.25, 1.2);               // end caps
  part(new THREE.BoxGeometry(0.2, 1.35, 1.35), mat.silver, 1.25, 1.2);
  part(new THREE.BoxGeometry(0.6, 1.54, 1.54), mat.rune, 0, 1.2);                     // rune band
  part(new THREE.CylinderGeometry(0.35, 0.45, 0.25, 16), mat.gold, 0, 2.05);          // top knob
  part(new THREE.CylinderGeometry(0.16, 0.16, 3.2, 16), mat.leather, 0, -0.6);        // handle
  for (let i = 0; i < 6; i++) {                                                       // grip rings
    const ring = part(new THREE.TorusGeometry(0.18, 0.03, 8, 24), mat.gold, 0, -1.8 + i * 0.45);
    ring.rotation.x = Math.PI / 2;
  }
  part(new THREE.CylinderGeometry(0.28, 0.22, 0.35, 16), mat.gold, 0, -2.25);         // pommel
  const strap = part(new THREE.TorusGeometry(0.25, 0.06, 8, 20, Math.PI * 1.5), mat.leather, 0, -2.55);
  strap.rotation.z = Math.PI / 2;

  /* ---------- Sparks ---------- */
  const SPARKS = 45;
  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkVel = [];
  for (let i = 0; i < SPARKS; i++) {
    sparkPos.set([(Math.random() - 0.5) * 3.5, 1.2 + (Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 3.5], i * 3);
    sparkVel.push([0, 1, 2].map(() => (Math.random() - 0.5) * 0.04));
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  hammer.add(new THREE.Points(sparkGeo, new THREE.PointsMaterial({
    color: 0x2f9bff, size: 0.12, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending,
  })));

  /* ---------- Lightning ---------- */
  const bolts = [];
  let flash = 0;

  function strike() {
    for (let k = 0; k < 3; k++) {
      const x0 = (Math.random() - 0.5) * 3, steps = 14, pts = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, wobble = i > 0 && i < steps ? 0.8 : 0;
        pts.push(new THREE.Vector3(
          x0 * (1 - t) + (Math.random() - 0.5) * wobble,
          7 * (1 - t) + 2.1 * t,
          (Math.random() - 0.5) * wobble
        ));
      }
      const material = new THREE.LineBasicMaterial({ color: 0xbfe3ff, transparent: true });
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), material);
      scene.add(line);
      bolts.push({ line, material, life: 1 });
    }
    flash = 1;
  }

  /* ---------- Drag to rotate ---------- */
  let rotX = 0.15, rotY = 0.5, velY = 0;
  let dragging = false, lastX = 0, lastY = 0, moved = 0;

  el.addEventListener("pointerdown", (e) => {
    dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY;
    el.setPointerCapture(e.pointerId);
    el.classList.add("grabbing");
  });
  el.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    moved += Math.abs(dx) + Math.abs(dy);
    velY = dx * 0.01;
    rotY += dx * 0.01;
    rotX = clamp(rotX + dy * 0.006, -0.8, 0.8);
    lastX = e.clientX; lastY = e.clientY;
  });
  const release = () => { dragging = false; el.classList.remove("grabbing"); };
  el.addEventListener("pointerup", () => { release(); if (moved < 6) strike(); });
  el.addEventListener("pointercancel", release);

  /* ---------- Render loop (only runs while on screen) ---------- */
  const idleSpin = reduceMotion ? 0 : 0.006;
  let raf = 0;

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const time = now / 1000;

    if (!dragging) {
      rotY += velY;
      velY += (idleSpin - velY) * 0.03;
    }
    hammer.rotation.set(rotX, rotY, 0.3);
    hammer.position.y = reduceMotion ? 0 : Math.sin(time * 1.6) * 0.12;

    if (!reduceMotion) {
      for (let i = 0; i < SPARKS; i++) {
        for (let a = 0; a < 3; a++) sparkPos[i * 3 + a] += sparkVel[i][a];
        if (Math.abs(sparkPos[i * 3]) > 1.8) sparkVel[i][0] *= -1;
        if (sparkPos[i * 3 + 1] < 0.2 || sparkPos[i * 3 + 1] > 2.5) sparkVel[i][1] *= -1;
        if (Math.abs(sparkPos[i * 3 + 2]) > 1.8) sparkVel[i][2] *= -1;
      }
      sparkGeo.attributes.position.needsUpdate = true;
    }

    flash *= 0.9;
    glow.intensity = 3 + Math.sin(time * 5) + flash * 12;

    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.life -= 0.06;
      b.material.opacity = Math.max(b.life, 0);
      if (b.life <= 0) {
        scene.remove(b.line);
        b.line.geometry.dispose();
        b.material.dispose();
        bolts.splice(i, 1);
      }
    }
    renderer.render(scene, camera);
  }

  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !raf) raf = requestAnimationFrame(loop);
    else if (!entry.isIntersecting) { cancelAnimationFrame(raf); raf = 0; }
  }).observe(el);

  new ResizeObserver(() => {
    const w = el.clientWidth, h = el.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }).observe(el);
})();
