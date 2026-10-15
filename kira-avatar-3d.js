/* Kira's lightweight procedural 3D portrait.
   The existing illustration remains available as a fallback when WebGL is unavailable. */
(() => {
  'use strict';
  const active = new WeakMap();
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function material(color, roughness = 0.72, metalness = 0) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
  }

  function addMesh(parent, geometry, mat, position, scale, rotation) {
    const mesh = new THREE.Mesh(geometry, mat);
    if (position) mesh.position.set(...position);
    if (scale) mesh.scale.set(...scale);
    if (rotation) mesh.rotation.set(...rotation);
    parent.add(mesh);
    return mesh;
  }

  function roundedSphere(parent, mat, pos, scale, rot) {
    return addMesh(parent, new THREE.SphereGeometry(1, 32, 24), mat, pos, scale, rot);
  }

  function buildAvatar(canvas, host) {
    if (!window.THREE || active.has(canvas)) return;
    const T = window.THREE;
    let renderer;
    try {
      renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch (_) {
      canvas.dataset.state = 'fallback';
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(31, 1, 0.1, 100);
    camera.position.set(0, 0.2, 8.8);
    const root = new T.Group();
    scene.add(root);

    scene.add(new T.HemisphereLight(0xffe8f4, 0x26264b, 2.1));
    const key = new T.DirectionalLight(0xffe4f2, 3.2);
    key.position.set(-3, 4, 6);
    scene.add(key);
    const fill = new T.PointLight(0x9a8dff, 24, 20);
    fill.position.set(3, 1, 4);
    scene.add(fill);
    const rim = new T.PointLight(0xff46b5, 22, 16);
    rim.position.set(-3, 2.4, -2);
    scene.add(rim);

    const skin = material(0xe9b29b, 0.78);
    const skinLight = material(0xffd4bd, 0.72);
    const hair = material(0x302234, 0.42);
    const hairLight = material(0x56334c, 0.42);
    const jacket = material(0xe91b8e, 0.56);
    const jacketLight = material(0xff4aa9, 0.5);
    const blouse = material(0xffe8f2, 0.72);
    const dark = material(0x2b1b2b, 0.42);
    const iris = material(0x68456f, 0.36);
    const white = material(0xfff7f5, 0.38);
    const lip = material(0x9c4c61, 0.48);
    const gold = new T.MeshStandardMaterial({ color: 0xe8b96d, metalness: 0.78, roughness: 0.25 });

    // Shoulders and tailored jacket, framed as a portrait rather than a full body.
    roundedSphere(root, jacket, [0, -1.65, -0.04], [1.72, 1.16, 0.72], [0, 0, 0]);
    roundedSphere(root, jacketLight, [-0.92, -1.45, 0.24], [0.66, 0.88, 0.5], [0, 0, -0.3]);
    roundedSphere(root, jacket, [0.94, -1.45, 0.22], [0.67, 0.9, 0.5], [0, 0, 0.3]);
    roundedSphere(root, blouse, [0, -1.22, 0.53], [0.63, 0.76, 0.22]);
    const lapelL = addMesh(root, new T.BufferGeometry(), blouse, [-0.28, -1.2, 0.68], [1,1,1]);
    const lapelR = addMesh(root, new T.BufferGeometry(), blouse, [0.28, -1.2, 0.68], [1,1,1]);
    root.remove(lapelL, lapelR);
    const triangle = (points, mat) => {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(points.flat(), 3));
      g.setIndex([0,1,2]); g.computeVertexNormals();
      const m = new T.Mesh(g, mat); root.add(m); return m;
    };
    triangle([[-0.62,-0.82,0.65],[-0.1,-1.58,0.78],[-0.08,-0.88,0.72]], jacketLight);
    triangle([[0.62,-0.82,0.65],[0.1,-1.58,0.78],[0.08,-0.88,0.72]], jacket);
    roundedSphere(root, gold, [0, -1.85, 0.79], [0.055,0.055,0.035]);

    // Neck, ears and softly stylised face.
    roundedSphere(root, skin, [0, 0.18, 0], [0.34, 0.62, 0.32]);
    roundedSphere(root, skin, [0, 1.13, 0.08], [0.82, 1.04, 0.67]);
    roundedSphere(root, skinLight, [-0.2, 1.32, 0.58], [0.36,0.45,0.12]);
    roundedSphere(root, skin, [-0.82, 1.08, 0.02], [0.17,0.25,0.16]);
    roundedSphere(root, skin, [0.82, 1.08, 0.02], [0.17,0.25,0.16]);
    // Hair mass behind the head and sweeping side locks.
    roundedSphere(root, hair, [0, 1.55, -0.24], [0.93,1.12,0.63]);
    roundedSphere(root, hair, [-0.75, 0.72, -0.05], [0.3,1.18,0.39], [0,0,-0.08]);
    roundedSphere(root, hair, [0.75, 0.68, -0.05], [0.3,1.2,0.39], [0,0,0.08]);
    roundedSphere(root, hairLight, [-0.44, 2.04, 0.23], [0.56,0.44,0.44], [0,0,-0.24]);
    roundedSphere(root, hair, [0.16, 2.12, 0.24], [0.7,0.35,0.43], [0,0,0.08]);
    roundedSphere(root, hairLight, [0.48, 1.91, 0.29], [0.37,0.48,0.34], [0,0,0.35]);

    // Eyes are separate meshes so a natural blink can be animated.
    const eyes = [];
    [-0.31, 0.31].forEach((x) => {
      roundedSphere(root, white, [x, 1.24, 0.655], [0.205,0.115,0.065]);
      const irisMesh = roundedSphere(root, iris, [x + 0.012,1.235,0.714], [0.075,0.083,0.035]);
      roundedSphere(root, dark, [x + 0.015,1.235,0.743], [0.037,0.05,0.02]);
      roundedSphere(root, white, [x - 0.01,1.265,0.76], [0.018,0.022,0.012]);
      const lid = roundedSphere(root, skin, [x,1.24,0.77], [0.215,0.012,0.018]);
      lid.visible = false;
      eyes.push({ iris: irisMesh, lid, x });
      // Brows.
      const curve = new T.CatmullRomCurve3([
        new T.Vector3(x - 0.19,1.43,0.68),
        new T.Vector3(x,1.49,0.71),
        new T.Vector3(x + 0.17,1.44,0.68)
      ]);
      root.add(new T.Mesh(new T.TubeGeometry(curve,16,0.035,8,false),hair));
    });
    // Nose and a small confident smile.
    roundedSphere(root, skin, [0, 1.02, 0.69], [0.105,0.17,0.12]);
    roundedSphere(root, skinLight, [-0.025,0.97,0.78], [0.06,0.055,0.045]);
    const smile = new T.CatmullRomCurve3([
      new T.Vector3(-0.18,0.82,0.65),
      new T.Vector3(-0.08,0.78,0.7),
      new T.Vector3(0.04,0.78,0.7),
      new T.Vector3(0.18,0.83,0.65)
    ]);
    root.add(new T.Mesh(new T.TubeGeometry(smile,20,0.025,8,false),lip));
    // Earrings and subtle collar accents.
    [-0.86,0.86].forEach(x => {
      const ring = new T.Mesh(new T.TorusGeometry(0.09,0.018,8,24),gold);
      ring.position.set(x,0.82,0.1); root.add(ring);
    });

    // Tiny orbiting highlights keep the portrait alive without turning it into a toy.
    const accents = [];
    [[-1.55,1.75,-0.1,0xff64c5],[1.45,0.25,0.2,0x9da4ff]].forEach(([x,y,z,color]) => {
      const a = new T.Mesh(new T.SphereGeometry(0.035,12,10),new T.MeshBasicMaterial({color,transparent:true,opacity:.85}));
      a.position.set(x,y,z); root.add(a); accents.push(a);
    });

    const fit = () => {
      if (!host.isConnected) return;
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(fit);
    resizeObserver.observe(host);
    fit();

    let frame = 0, time = 0, targetX = 0, targetY = 0;
    const motionReduced = reducedMotion();
    const onMove = (e) => {
      if (motionReduced || e.pointerType === 'touch') return;
      const r = host.getBoundingClientRect();
      targetY = ((e.clientX-r.left)/Math.max(1,r.width)-.5)*.22;
      targetX = ((e.clientY-r.top)/Math.max(1,r.height)-.5)*-.12;
    };
    const onLeave = () => { targetX = 0; targetY = 0; };
    host.addEventListener('pointermove', onMove, { passive: true });
    host.addEventListener('pointerleave', onLeave, { passive: true });
    const clock = new T.Clock();
    const animate = () => {
      if (!host.isConnected) {
        cancelAnimationFrame(frame);
        resizeObserver.disconnect();
        host.removeEventListener('pointermove', onMove);
        host.removeEventListener('pointerleave', onLeave);
        renderer.dispose();
        active.delete(canvas);
        return;
      }
      frame = requestAnimationFrame(animate);
      if (document.hidden) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      if (!motionReduced) {
        time += dt;
        root.rotation.y += (targetY + Math.sin(time*.65)*.035 - root.rotation.y)*.045;
        root.rotation.x += (targetX + Math.sin(time*.9)*.018 - root.rotation.x)*.045;
        root.position.y = Math.sin(time*1.1)*.035;
        accents.forEach((a,i)=>{a.position.y += Math.sin(time*1.5+i)*.0008;});
        const blink = (Math.sin(time*.7+1.2) > .992) ? 1 : 0;
        eyes.forEach(e => { e.lid.visible = blink===1; e.iris.visible = blink===0; });
      }
      renderer.render(scene,camera);
    };
    canvas.dataset.state = 'ready';
    const svg = host.querySelector('svg');
    if (svg) svg.style.opacity = '0';
    active.set(canvas, { renderer, resizeObserver });
    animate();
  }

  function scan(root = document) {
    if (!window.THREE) return;
    root.querySelectorAll('.kira-avatar-large').forEach(host => {
      const canvas = host.querySelector('canvas.kira-avatar-3d-canvas');
      if (canvas && !active.has(canvas)) buildAvatar(canvas, host);
    });
  }

  const start = () => {
    scan();
    const observer = new MutationObserver(() => scan());
    observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
