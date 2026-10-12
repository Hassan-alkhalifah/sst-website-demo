/* SST's illustrative hydraulic system. All geometry, textures and the studio
 * lighting are generated locally; nothing is fetched at runtime.
 * The page owns scheduling: this renderer draws only when render() is called.
 * The page also owns composition: setFrame() receives the rectangle the layout
 * reserves for the model, and the camera fits the whole story inside it. */
(function () {
  'use strict';

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const ease = (value) => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;

  // The story's on-screen extent is sampled once per layout and interpolated
  // while scrolling, so the camera follows the parts without jitter.
  const POSE_SAMPLES = 25;
  // Fractions of the canvas, measured from its top-left corner.
  const DEFAULT_FRAME = { x0: 0.04, y0: 0.06, x1: 0.96, y1: 0.94 };
  // Room left around the model inside that rectangle.
  const FRAME_MARGIN = 1.06;

  function create(canvas) {
    const T = window.THREE;
    if (!T || !canvas) throw new Error('The local 3D runtime is unavailable.');

    const renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setClearColor(0x0e1523, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;

    const scene = new T.Scene();
    const camera = new T.OrthographicCamera(-8, 8, 4.5, -4.5, 0.1, 100);
    camera.position.set(-5.9, 2.15, 18);
    camera.lookAt(0, 0, 0);

    const textures = [];
    function textureCanvas(width, height, draw) {
      const surface = document.createElement('canvas');
      surface.width = width;
      surface.height = height;
      draw(surface.getContext('2d'), width, height);
      const texture = new T.CanvasTexture(surface);
      texture.colorSpace = T.SRGBColorSpace;
      texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
      textures.push(texture);
      return texture;
    }

    // A local photo studio: a gradient dome plus four soft panels. The long
    // panels are what give the chrome its drawn-out highlight and the black
    // barrel its top sheen, the way a softbox does in product photography.
    const domeTexture = textureCanvas(8, 128, (ctx, w, h) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, '#9fb3cd');
      gradient.addColorStop(0.42, '#3f4f68');
      gradient.addColorStop(0.72, '#141b28');
      gradient.addColorStop(1, '#090d15');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    });

    function studioEnvironment() {
      const room = new T.Scene();
      room.add(new T.Mesh(new T.SphereGeometry(18, 32, 24), new T.MeshBasicMaterial({ map: domeTexture, side: T.BackSide })));
      const panel = (panelWidth, panelHeight, position, rotation, intensity) => {
        const material = new T.MeshBasicMaterial();
        material.color.multiplyScalar(intensity);
        const plane = new T.Mesh(new T.PlaneGeometry(panelWidth, panelHeight), material);
        plane.position.set(position[0], position[1], position[2]);
        plane.rotation.set(rotation[0], rotation[1], rotation[2]);
        room.add(plane);
      };
      panel(17, 3.4, [-1.5, 7.4, 2.2], [Math.PI / 2, 0, 0], 5.6);     // key softbox overhead
      panel(9, 6.5, [-9.5, 1.2, 5.5], [0, Math.PI / 2, 0], 1.9);      // left fill
      panel(12, 4.2, [9.5, 3.2, -2.5], [0, -Math.PI / 2, 0], 3.4);    // rim behind the parts
      panel(16, 5, [0, -6.2, 2], [-Math.PI / 2, 0, 0], 0.42);         // floor bounce
      return room;
    }

    const environmentSource = studioEnvironment();
    const pmrem = new T.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(environmentSource, 0.03);
    scene.environment = environment.texture;
    scene.environmentIntensity = 1.12;
    environmentSource.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) object.material.dispose();
    });
    pmrem.dispose();

    scene.add(new T.HemisphereLight(0xdde9ff, 0x0f1a2c, 0.55));
    const key = new T.DirectionalLight(0xf6f9ff, 2.05);
    key.position.set(-3.4, 8.5, 9);
    scene.add(key);
    const rim = new T.DirectionalLight(0x9dc0ff, 2.4);
    rim.position.set(5.5, 3.4, -6);
    scene.add(rim);
    const fill = new T.DirectionalLight(0xffffff, 0.5);
    fill.position.set(-8, -2.5, 5);
    scene.add(fill);

    const braidTexture = textureCanvas(128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#121820'; ctx.fillRect(0, 0, w, h);
      for (let offset = -w; offset < w * 2; offset += 16) {
        ctx.strokeStyle = '#2b333c'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(offset, 0); ctx.lineTo(offset + w, h); ctx.stroke();
        ctx.strokeStyle = '#1c232c'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(offset, 0); ctx.lineTo(offset - w, h); ctx.stroke();
        ctx.strokeStyle = '#4a545f'; ctx.lineWidth = 0.75;
        ctx.beginPath(); ctx.moveTo(offset + 3, 0); ctx.lineTo(offset + w + 3, h); ctx.stroke();
      }
    });
    braidTexture.wrapS = braidTexture.wrapT = T.RepeatWrapping;
    braidTexture.repeat.set(14, 2);

    // Fine, deterministic powder-coat grain; the texture is local and tileable.
    const powderNormal = textureCanvas(128, 128, (ctx, w, h) => {
      const pixels = ctx.createImageData(w, h);
      let seed = 7731;
      for (let i = 0; i < pixels.data.length; i += 4) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        pixels.data[i] = 120 + (seed & 15);
        pixels.data[i + 1] = 120 + ((seed >>> 8) & 15);
        pixels.data[i + 2] = 254;
        pixels.data[i + 3] = 255;
      }
      ctx.putImageData(pixels, 0, 0);
    });
    powderNormal.colorSpace = T.NoColorSpace;
    powderNormal.wrapS = powderNormal.wrapT = T.RepeatWrapping;
    powderNormal.repeat.set(5, 3);

    const mats = {
      chrome: new T.MeshStandardMaterial({ color: 0xdbe3ec, metalness: 1, roughness: 0.1 }),
      steel: new T.MeshStandardMaterial({ color: 0xa7b1bd, metalness: 0.95, roughness: 0.24 }),
      satin: new T.MeshStandardMaterial({ color: 0x6d7a88, metalness: 0.9, roughness: 0.33 }),
      graphite: new T.MeshPhysicalMaterial({ color: 0x14181d, metalness: 0.52, roughness: 0.44, normalMap: powderNormal, normalScale: new T.Vector2(0.22, 0.22), clearcoat: 0.4, clearcoatRoughness: 0.26 }),
      bore: new T.MeshStandardMaterial({ color: 0x141a22, metalness: 0.78, roughness: 0.3 }),
      honed: new T.MeshStandardMaterial({ color: 0x3d4855, metalness: 0.92, roughness: 0.16 }),
      cut: new T.MeshStandardMaterial({ color: 0xcfd7e0, metalness: 0.55, roughness: 0.42, side: T.DoubleSide }),
      rubber: new T.MeshStandardMaterial({ color: 0x0f151c, metalness: 0.03, roughness: 0.62 }),
      wear: new T.MeshStandardMaterial({ color: 0x272a2d, metalness: 0.02, roughness: 0.48 }),
      hose: new T.MeshStandardMaterial({ color: 0x8e969d, map: braidTexture, metalness: 0.2, roughness: 0.66 })
    };
    const model = new T.Group();
    scene.add(model);

    function mesh(geometry, material, parent, x = 0, y = 0, z = 0) {
      const object = new T.Mesh(geometry, material);
      object.position.set(x, y, z);
      parent.add(object);
      return object;
    }

    // A closed cross-section revolved around the hydraulic system's X axis.
    function lathe(profile, material, parent, x = 0, y = 0, z = 0, segments = 80, phiStart = 0, phiLength = Math.PI * 2) {
      const points = profile.map(([axial, radius]) => new T.Vector2(radius, axial));
      const area = points.reduce((sum, point, index) => {
        const next = points[(index + 1) % points.length];
        return sum + point.x * next.y - next.x * point.y;
      }, 0);
      // Closed profiles need the same winding for outward-facing lathe normals.
      if (area < 0) points.reverse();
      const geometry = new T.LatheGeometry(points, segments, phiStart, phiLength);
      geometry.rotateZ(-Math.PI / 2);
      return mesh(geometry, material, parent, x, y, z);
    }

    function ring(parent, x, outer, inner, width, material, bevel = 0.018) {
      const b = Math.min(bevel, width / 3, (outer - inner) / 3);
      return lathe([
        [0, inner + b], [b, inner], [width - b, inner], [width, inner + b],
        [width, outer - b], [width - b, outer], [b, outer], [0, outer - b], [0, inner + b]
      ], material, parent, x);
    }

    function cylinder(parent, x, radius, length, material, segments = 64) {
      const geometry = new T.CylinderGeometry(radius, radius, length, segments);
      geometry.rotateZ(-Math.PI / 2);
      return mesh(geometry, material, parent, x + length / 2);
    }

    function torus(parent, x, radius, tube, material, y = 0, z = 0) {
      const geometry = new T.TorusGeometry(radius, tube, 8, 80);
      geometry.rotateY(Math.PI / 2);
      return mesh(geometry, material, parent, x, y, z);
    }

    function sectionFaces(profile, parent, start, length, name) {
      [start, start + length].forEach((angle, index) => {
        const shape = new T.Shape(profile.map(([axial, radius]) => new T.Vector2(axial, radius)));
        const geometry = new T.ShapeGeometry(shape);
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i += 1) {
          const axial = positions.getX(i); const radius = positions.getY(i);
          positions.setXYZ(i, axial, -radius * Math.sin(angle), radius * Math.cos(angle));
        }
        geometry.computeVertexNormals();
        mesh(geometry, mats.cut, parent).name = name + '-' + index;
      });
    }

    function thread(parent, start, length, radius, turns, tube, material, name) {
      const path = new T.Curve();
      path.getPoint = function (t, target = new T.Vector3()) {
        const angle = t * Math.PI * 2 * turns;
        return target.set(start + t * length, Math.cos(angle) * radius, Math.sin(angle) * radius);
      };
      const object = mesh(new T.TubeGeometry(path, Math.ceil(turns * 24), tube, 5, false), material, parent);
      object.name = name;
      return object;
    }

    function hexRing(parent, x, radius, holeRadius, length, material, name) {
      const shape = new T.Shape();
      for (let i = 0; i <= 6; i += 1) {
        const angle = i * Math.PI / 3;
        if (i === 0) shape.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        else shape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      const bore = new T.Path();
      bore.absarc(0, 0, holeRadius, 0, Math.PI * 2, true);
      shape.holes.push(bore);
      const geometry = new T.ExtrudeGeometry(shape, { depth: length, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.01, bevelThickness: 0.009, curveSegments: 40 });
      geometry.rotateY(Math.PI / 2);
      const object = mesh(geometry, material, parent, x);
      object.name = name;
      return object;
    }

    function eye(parent, x, radius, hole, thickness) {
      const assembly = new T.Group(); assembly.position.x = x; parent.add(assembly);
      const shape = new T.Shape();
      shape.absarc(0, 0, radius, 0, Math.PI * 2, false);
      const cutout = new T.Path();
      cutout.absarc(0, 0, hole, 0, Math.PI * 2, true); shape.holes.push(cutout);
      const geometry = new T.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.055, bevelThickness: 0.05, curveSegments: 48 });
      mesh(geometry, mats.graphite, assembly, 0, 0, -thickness / 2).name = 'powder-coated-eye';
      // A machined bushing, with an actual open center, sits inside the eye.
      const bushing = ring(assembly, 0, hole + 0.037, hole - 0.05, thickness + 0.08, mats.chrome, 0.012);
      bushing.rotation.y = -Math.PI / 2;
      bushing.position.z = -thickness / 2 - 0.04;
      const edge = new T.TorusGeometry(hole + 0.018, 0.014, 8, 64);
      mesh(edge, mats.bore, assembly, 0, 0, thickness / 2 + 0.055);
      return assembly;
    }

    // Hollow barrel, rolled front lip, rear end cap and mounting eye.
    const barrel = new T.Group(); barrel.name = 'barrel'; model.add(barrel);
    const barrelProfile = [
      [1.2, 0.65], [1.25, 0.64], [4.65, 0.64], [4.77, 0.65],
      [4.77, 0.68], [4.72, 0.735], [1.28, 0.735], [1.2, 0.69], [1.2, 0.65]
    ];
    const barrelShell = lathe(barrelProfile, mats.graphite, barrel, 0, 0, 0, 112);
    barrelShell.name = 'barrel-full-shell';
    const cutawayBarrel = new T.Group(); cutawayBarrel.name = 'barrel-cutaway'; barrel.add(cutawayBarrel);
    const cutStart = Math.PI / 3;
    const cutLength = Math.PI * 4 / 3;
    lathe(barrelProfile, mats.graphite, cutawayBarrel, 0, 0, 0, 88, cutStart, cutLength).name = 'barrel-section-shell';
    const honedBoreProfile = [[1.27, 0.6395], [4.64, 0.6395], [4.64, 0.641], [1.27, 0.641], [1.27, 0.6395]];
    lathe(honedBoreProfile, mats.honed, cutawayBarrel, 0, 0, 0, 88, cutStart, cutLength).name = 'honed-inner-bore';
    // Close the two section boundaries with solid machined-metal faces.
    sectionFaces(barrelProfile, cutawayBarrel, cutStart, cutLength, 'barrel-cut-edge');
    cutawayBarrel.visible = false;
    ring(barrel, 1.19, 0.704, 0.64, 0.065, mats.satin);
    ring(barrel, 1.29, 0.744, 0.71, 0.06, mats.bore, 0.009);
    ring(barrel, 4.7, 0.739, 0.71, 0.065, mats.bore, 0.009);
    ring(barrel, 4.69, 0.739, 0.3, 0.25, mats.graphite, 0.025);
    ring(barrel, 4.925, 0.659, 0.33, 0.035, mats.satin, 0.01);
    cylinder(barrel, 4.91, 0.45, 0.3, mats.graphite);
    eye(barrel, 5.56, 0.58, 0.315, 0.36);
    // The rear piston face adds depth when looking inside the open bore.
    cylinder(barrel, 4.65, 0.64, 0.12, mats.satin).name = 'rear-closure';

    const plate = mesh(new T.BoxGeometry(1.34, 0.3, 0.015), mats.satin, barrel, 3.02, -0.1, 0.727);
    plate.rotation.x = 0.17;
    const plateTexture = textureCanvas(512, 128, (ctx, w, h) => {
      ctx.fillStyle = '#cdd5dd'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#b4bec8'; ctx.fillRect(0, h - 10, w, 10);
      ctx.fillStyle = '#16233a'; ctx.font = 'bold italic 62px Arial, Helvetica, sans-serif';
      ctx.fillText('SST', 22, 86);
      ctx.fillStyle = '#e6532b'; ctx.fillRect(152, 32, 9, 54);
      ctx.fillStyle = '#22303f'; ctx.font = 'bold 27px Arial, Helvetica, sans-serif';
      ctx.fillText('SIMPLE SOLUTIONS', 180, 58);
      ctx.fillStyle = '#4d5b6b'; ctx.font = '21px Arial, Helvetica, sans-serif';
      ctx.fillText('HYDRAULIC SYSTEMS', 180, 88);
      ctx.fillStyle = '#8b98a6';
      [18, w - 18].forEach((x) => { ctx.beginPath(); ctx.arc(x, h / 2, 5, 0, Math.PI * 2); ctx.fill(); });
    });
    const plateLabelMaterial = new T.MeshStandardMaterial({ map: plateTexture, metalness: 0.45, roughness: 0.4 });
    const plateLabel = mesh(new T.PlaneGeometry(1.28, 0.26), plateLabelMaterial, barrel, 3.02, -0.1, 0.74);
    plateLabel.rotation.x = 0.17;

    // Two bored service ports: a welded boss, a hex flat and a male thread.
    function port(x) {
      const group = new T.Group();
      group.position.set(x, 0.66, 0); group.rotation.z = Math.PI / 2;
      barrel.add(group);
      lathe([[0, 0.12], [0, 0.245], [0.1, 0.235], [0.14, 0.2], [0.14, 0.12], [0, 0.12]], mats.graphite, group, 0, 0, 0, 48).name = 'port-boss';
      hexRing(group, 0.14, 0.215, 0.095, 0.15, mats.steel, 'port-hex');
      ring(group, 0.29, 0.163, 0.095, 0.25, mats.steel, 0.012);
      for (let i = 0; i < 5; i += 1) torus(group, 0.315 + i * 0.045, 0.166, 0.013, mats.chrome);
      ring(group, 0.535, 0.168, 0.1, 0.03, mats.bore, 0.008);
      return group;
    }
    port(1.88); port(4.2);

    // A 90-degree adapter on the front port: a swivel nut screwed down over
    // the port thread, a solid bend, and a female union that swallows the
    // hose's male thread. Both ends of the bend sit inside fittings, so no
    // open pipe mouth is ever exposed.
    const elbowNut = new T.Group();
    elbowNut.position.set(1.88, 0.93, 0);
    elbowNut.rotation.z = Math.PI / 2;
    barrel.add(elbowNut);
    hexRing(elbowNut, 0, 0.239, 0.172, 0.27, mats.steel, 'elbow-swivel-nut');
    ring(elbowNut, 0.27, 0.218, 0.164, 0.07, mats.satin, 0.012).name = 'elbow-nut-shoulder';
    const elbowCurve = new T.CatmullRomCurve3([
      new T.Vector3(1.88, 1.06, 0), new T.Vector3(1.88, 1.36, 0.03),
      new T.Vector3(1.95, 1.55, 0.15), new T.Vector3(2.06, 1.55, 0.25),
      new T.Vector3(2.14, 1.52, 0.28), new T.Vector3(2.20, 1.52, 0.28)
    ]);
    mesh(new T.TubeGeometry(elbowCurve, 44, 0.155, 18, false), mats.steel, barrel).name = 'elbow-bend';
    // The union sits on the outlet axis the hose docks onto. Its seat closes
    // the bend behind a single machined passage.
    const elbowUnion = new T.Group();
    elbowUnion.position.set(0, 1.52, 0.28);
    barrel.add(elbowUnion);
    hexRing(elbowUnion, 2.01, 0.238, 0.19, 0.23, mats.steel, 'elbow-union-hex');
    ring(elbowUnion, 2.20, 0.19, 0.068, 0.045, mats.bore, 0.01).name = 'elbow-union-seat';
    ring(elbowUnion, 2.245, 0.252, 0.19, 0.33, mats.satin, 0.02).name = 'elbow-union-socket';

    // The unused rear port carries a plug rather than an open bore.
    const rearPlug = new T.Group();
    rearPlug.position.set(4.2, 0.93, 0);
    rearPlug.rotation.z = Math.PI / 2;
    barrel.add(rearPlug);
    hexRing(rearPlug, 0, 0.225, 0.15, 0.24, mats.steel, 'rear-port-plug-hex');
    lathe([[0.2, 0], [0.2, 0.152], [0.26, 0.152], [0.29, 0.12], [0.31, 0.06], [0.31, 0], [0.2, 0]], mats.satin, rearPlug, 0, 0, 0, 48).name = 'rear-port-plug-cap';

    // Polished rod with a machined shoulder and substantial mounting eye.
    const rod = new T.Group(); rod.name = 'rod'; model.add(rod);
    lathe([[0, 0], [0, 0.34], [0.09, 0.34], [0.15, 0.265], [4.18, 0.265], [4.20, 0.25], [4.20, 0.18], [5.22, 0.18], [5.25, 0.16], [5.25, 0], [0, 0]], mats.chrome, rod, 0, 0, 0, 112).name = 'chrome-rod-and-reduced-shoulder';
    thread(rod, 4.87, 0.35, 0.182, 10, 0.009, mats.steel, 'rod-retaining-thread');
    cylinder(rod, -0.26, 0.365, 0.28, mats.graphite);
    ring(rod, -0.045, 0.37, 0.3, 0.07, mats.bore, 0.014);
    eye(rod, -0.75, 0.625, 0.34, 0.43);
    for (let i = 0; i < 3; i += 1) torus(rod, 0.15 + i * 0.038, 0.27, 0.008, mats.satin);

    // The gland travels over the rod first. Its seals remain seated in their
    // own grooves throughout the sequence; no loose seal crosses solid metal.
    const gland = new T.Group(); gland.name = 'gland'; model.add(gland);
    const glandShape = new T.Shape(); glandShape.absarc(0, 0, 0.714, 0, Math.PI * 2, false);
    // Extrusion bevels extend into holes: leave clearance for the .265 rod
    // after the .021 flange bevel (minimum finished bore radius .274).
    const centerBore = new T.Path(); centerBore.absarc(0, 0, 0.295, 0, Math.PI * 2, true); glandShape.holes.push(centerBore);
    for (let i = 0; i < 8; i += 1) {
      const angle = i * Math.PI / 4;
      const hole = new T.Path(); hole.absarc(Math.cos(angle) * 0.545, Math.sin(angle) * 0.545, 0.057, 0, Math.PI * 2, true); glandShape.holes.push(hole);
    }
    const glandGeometry = new T.ExtrudeGeometry(glandShape, { depth: 0.2, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.021, bevelThickness: 0.019, curveSegments: 48 });
    glandGeometry.rotateY(Math.PI / 2);
    mesh(glandGeometry, mats.graphite, gland).name = 'gland-black-flange';
    const glandProfile = [
      [0.20, 0.282], [0.24, 0.282], [0.24, 0.322], [0.345, 0.322],
      [0.345, 0.282], [0.40, 0.282], [0.40, 0.321], [0.50, 0.321],
      [0.50, 0.282], [0.59, 0.282], [0.59, 0.598], [0.565, 0.619],
      [0.52, 0.619], [0.52, 0.593], [0.47, 0.593], [0.47, 0.619],
      [0.22, 0.619], [0.20, 0.601], [0.20, 0.282]
    ];
    const glandCartridge = lathe(glandProfile, mats.steel, gland);
    glandCartridge.name = 'gland-threaded-cartridge';
    const glandThread = thread(gland, 0.23, 0.22, 0.620, 7, 0.012, mats.chrome, 'gland-helical-thread');
    const cutawayGland = new T.Group(); cutawayGland.name = 'gland-cutaway'; gland.add(cutawayGland);
    lathe(glandProfile, mats.steel, cutawayGland, 0, 0, 0, 64, cutStart, cutLength).name = 'gland-section-cartridge';
    sectionFaces(glandProfile, cutawayGland, cutStart, cutLength, 'gland-cut-edge');
    // Keep the helical thread on the retained cartridge only, leaving its
    // pressure-seal and guide-bearing grooves visible through the window.
    for (let turn = 0; turn < 7; turn += 1) {
      [[0, 1 / 12], [5 / 12, 1]].forEach(([from, to]) => {
        const path = new T.Curve();
        path.getPoint = function (t, target = new T.Vector3()) {
          const phase = turn + mix(from, to, t);
          const angle = phase * Math.PI * 2;
          return target.set(0.23 + phase * 0.22 / 7, Math.cos(angle) * 0.620, Math.sin(angle) * 0.620);
        };
        mesh(new T.TubeGeometry(path, Math.max(4, Math.ceil((to - from) * 24)), 0.012, 5, false), mats.chrome, cutawayGland);
      });
    }
    cutawayGland.visible = false;
    torus(gland, 0.495, 0.611, 0.021, mats.rubber).name = 'gland-static-o-ring';
    ring(gland, 0.405, 0.320, 0.266, 0.09, mats.wear, 0.006).name = 'rod-guide-bushing';
    ring(gland, 0.245, 0.321, 0.264, 0.09, mats.rubber, 0.008).name = 'gland-pressure-seal';
    ring(gland, -0.035, 0.358, 0.275, 0.045, mats.chrome, 0.01).name = 'wiper-retaining-lip';
    ring(gland, -0.049, 0.313, 0.264, 0.024, mats.rubber, 0.008).name = 'rod-wiper';
    for (let i = 0; i < 8; i += 1) {
      const angle = i * Math.PI / 4;
      const screw = new T.Group(); screw.position.set(-0.018, Math.cos(angle) * 0.545, Math.sin(angle) * 0.545); gland.add(screw);
      ring(screw, -0.024, 0.056, 0.023, 0.042, mats.satin, 0.004).name = 'gland-socket-screw-' + i;
      cylinder(screw, 0.007, 0.024, 0.007, mats.bore, 6);
    }

    // A piston, rather than loose washers, locks onto the reduced rod shoulder.
    // Its two wear bands and central double-acting seal occupy machined grooves.
    const piston = new T.Group(); piston.name = 'piston'; model.add(piston);
    lathe([
      [0, 0.193], [0.59, 0.193], [0.59, 0.591], [0.57, 0.611],
      [0.53, 0.611], [0.53, 0.595], [0.45, 0.595], [0.45, 0.611],
      [0.38, 0.611], [0.38, 0.578], [0.18, 0.578], [0.18, 0.611],
      [0.145, 0.611], [0.145, 0.595], [0.07, 0.595], [0.07, 0.611],
      [0.02, 0.611], [0, 0.591], [0, 0.193]
    ], mats.steel, piston, 0, 0, 0, 112).name = 'machined-piston-body';
    ring(piston, 0.074, 0.631, 0.595, 0.067, mats.wear, 0.004).name = 'piston-front-wear-band';
    ring(piston, 0.455, 0.631, 0.595, 0.07, mats.wear, 0.004).name = 'piston-rear-wear-band';
    lathe([
      [0.185, 0.578], [0.375, 0.578], [0.375, 0.624], [0.36, 0.637],
      [0.327, 0.637], [0.315, 0.622], [0.245, 0.622], [0.233, 0.637],
      [0.2, 0.637], [0.185, 0.624], [0.185, 0.578]
    ], mats.rubber, piston, 0, 0, 0, 112).name = 'double-acting-piston-seal';
    ring(piston, 0.009, 0.259, 0.191, 0.014, mats.satin, 0.004).name = 'piston-shoulder-seat';
    const retainingNut = new T.Group(); retainingNut.name = 'nut'; model.add(retainingNut);
    ring(retainingNut, -0.05, 0.316, 0.19, 0.045, mats.chrome, 0.007).name = 'retaining-washer';
    hexRing(retainingNut, 0, 0.323, 0.185, 0.26, mats.satin, 'piston-locknut');
    thread(retainingNut, 0.024, 0.218, 0.188, 6, 0.006, mats.steel, 'locknut-inner-thread');

    // A crimped hose assembly: swivel fitting, braided hose and a second
    // crimped end, so the hose reads as a finished part, not cut tube.
    const hoseAssembly = new T.Group(); model.add(hoseAssembly);
    const connector = new T.Group(); hoseAssembly.add(connector);
    ring(connector, 0, 0.165, 0.093, 0.35, mats.steel, 0.012);
    for (let i = 0; i < 7; i += 1) torus(connector, 0.025 + i * 0.039, 0.164, 0.013, mats.chrome);
    const nutGeometry = new T.CylinderGeometry(0.246, 0.246, 0.28, 6);
    nutGeometry.rotateZ(-Math.PI / 2);
    mesh(nutGeometry, mats.steel, connector, 0.49);
    ring(connector, 0.33, 0.217, 0.098, 0.045, mats.chrome, 0.01);
    ring(connector, 0.635, 0.186, 0.09, 0.28, mats.satin, 0.021);
    ring(connector, 0.69, 0.194, 0.16, 0.036, mats.bore, 0.01);
    ring(connector, 0.94, 0.219, 0.11, 0.5, mats.satin, 0.024);
    for (let i = 0; i < 4; i += 1) ring(connector, 1.0 + i * 0.09, 0.225, 0.201, 0.032, mats.steel, 0.009);
    // The docked tail passes outside the barrel wall (radius .74) instead of
    // through it, so the hose never intersects the cylinder it feeds.
    const hoseCurve = new T.CatmullRomCurve3([
      new T.Vector3(1.4, 0, 0), new T.Vector3(2.2, -0.06, -0.38),
      new T.Vector3(2.85, -0.46, -0.87), new T.Vector3(3.12, -1.02, -1.22),
      new T.Vector3(3.06, -1.46, -1.36)
    ]);
    mesh(new T.TubeGeometry(hoseCurve, 90, 0.155, 16, false), mats.hose, connector);
    ring(connector, 1.34, 0.186, 0.1, 0.19, mats.rubber, 0.026);
    // The far end carries its own crimped ferrule and hex, aligned to the hose.
    const hoseTail = new T.Group();
    hoseTail.position.copy(hoseCurve.getPoint(1));
    hoseTail.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), hoseCurve.getTangent(1).normalize());
    connector.add(hoseTail);
    ring(hoseTail, -0.2, 0.186, 0.1, 0.2, mats.rubber, 0.026);
    ring(hoseTail, -0.04, 0.222, 0.11, 0.44, mats.satin, 0.024);
    for (let i = 0; i < 4; i += 1) ring(hoseTail, 0 + i * 0.09, 0.228, 0.204, 0.032, mats.steel, 0.009);
    hexRing(hoseTail, 0.4, 0.243, 0.1, 0.24, mats.steel, 'hose-tail-hex');
    ring(hoseTail, 0.64, 0.167, 0.094, 0.22, mats.chrome, 0.012);
    ring(hoseTail, 0.85, 0.17, 0.1, 0.03, mats.bore, 0.008);

    // A soft pool of light behind the parts. On a dark stage this separates the
    // silhouette far better than a black contact shadow can.
    const glowTexture = textureCanvas(128, 128, (ctx, w, h) => {
      const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gradient.addColorStop(0, 'rgba(124,162,212,.5)'); gradient.addColorStop(0.42, 'rgba(68,100,148,.2)'); gradient.addColorStop(1, 'rgba(22,34,54,0)');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
    });
    const glowMaterial = new T.MeshBasicMaterial({ map: glowTexture, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.5 });
    const glow = mesh(new T.PlaneGeometry(1, 1), glowMaterial, scene);
    glow.renderOrder = -1;

    let progress = 0;
    let cutaway = false;
    let pointerX = 0;
    let pointerY = 0;
    let width = 1;
    let height = 1;
    let disposed = false;
    let dirty = true;
    let measured = false;
    let frame = Object.assign({}, DEFAULT_FRAME);
    let tilt = 0.12;
    const poseTable = [];
    const poseBounds = new T.Box3();
    const corner = new T.Vector3();
    const glowAnchor = new T.Vector3();

    // A long, low rectangle gets a shallow diagonal; a tall one gets a steep
    // diagonal, so the assembly uses the height the layout gave it.
    function layoutTilt() {
      const boxWidth = Math.max(1, (frame.x1 - frame.x0) * width);
      const boxHeight = Math.max(1, (frame.y1 - frame.y0) * height);
      return clamp(0.82 - 0.25 * (boxWidth / boxHeight), 0.09, 0.72);
    }

    function measureBounds(target) {
      model.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      model.traverse((object) => {
        if (!object.geometry) return;
        if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
        const local = object.geometry.boundingBox;
        for (let i = 0; i < 8; i += 1) {
          corner.set(i & 1 ? local.max.x : local.min.x, i & 2 ? local.max.y : local.min.y, i & 4 ? local.max.z : local.min.z);
          corner.applyMatrix4(object.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
          target.expandByPoint(corner);
        }
      });
      return target;
    }

    // Measured once per layout: how wide, how tall and how far off-center the
    // assembly sits at each point in the story.
    function measureStory() {
      tilt = layoutTilt();
      applyLayout(0, 0);
      poseTable.length = 0;
      for (let i = 0; i < POSE_SAMPLES; i += 1) {
        applyPose(i / (POSE_SAMPLES - 1));
        poseBounds.makeEmpty();
        measureBounds(poseBounds);
        poseTable.push({
          centerX: (poseBounds.min.x + poseBounds.max.x) / 2,
          centerY: (poseBounds.min.y + poseBounds.max.y) / 2,
          width: poseBounds.max.x - poseBounds.min.x,
          height: poseBounds.max.y - poseBounds.min.y
        });
      }
      measured = true;
    }

    function sampleStory(value) {
      const position = clamp(value, 0, 1) * (POSE_SAMPLES - 1);
      const index = Math.min(POSE_SAMPLES - 2, Math.floor(position));
      const blend = position - index;
      const from = poseTable[index];
      const to = poseTable[index + 1];
      return {
        centerX: mix(from.centerX, to.centerX, blend),
        centerY: mix(from.centerY, to.centerY, blend),
        width: mix(from.width, to.width, blend),
        height: mix(from.height, to.height, blend)
      };
    }

    function frameModel() {
      const aspect = width / height;
      const boxWidth = Math.max(0.05, frame.x1 - frame.x0);
      const boxHeight = Math.max(0.05, frame.y1 - frame.y0);
      const story = sampleStory(progress);
      const modelWidth = story.width * FRAME_MARGIN;
      const modelHeight = story.height * FRAME_MARGIN;
      const visibleHeight = Math.max(modelHeight / boxHeight, modelWidth / (boxWidth * aspect));
      const visibleWidth = visibleHeight * aspect;
      const centerX = story.centerX;
      const centerY = story.centerY;
      // Put the reserved rectangle's center on the model's center.
      camera.left = centerX - ((frame.x0 + frame.x1) / 2) * visibleWidth;
      camera.right = camera.left + visibleWidth;
      camera.top = centerY + ((frame.y0 + frame.y1) / 2) * visibleHeight;
      camera.bottom = camera.top - visibleHeight;
      camera.updateProjectionMatrix();
    }

    function applyLayout(parallaxX, parallaxY) {
      model.rotation.set(parallaxY * 0.035, parallaxX * 0.06, tilt + parallaxX * 0.012);
    }

    // First slide the gland onto the free rod. Seat and lock the piston on
    // the reduced shoulder, then insert the complete rod train in the bore.
    // Reverse scrolling retraces these collision-free axial paths exactly.
    function applyPose(value) {
      const glandJoin = ease((value - 0.04) / 0.16);
      const pistonJoin = ease((value - 0.20) / 0.14);
      const nutJoin = ease((value - 0.34) / 0.06);
      const trainJoin = ease((value - 0.42) / 0.28);
      const connected = ease((value - 0.2) / 0.4);
      const stroke = ease((value - 0.78) / 0.22);
      const trainTravel = trainJoin * 6.8;
      const rodTravel = trainTravel - stroke * 1.35;
      rod.position.x = -8 + rodTravel;
      gland.position.x = mix(-2.0, -5.84, glandJoin) + trainTravel;
      piston.position.x = mix(-0.75, -3.75, pistonJoin) + rodTravel;
      retainingNut.position.x = mix(0.30, -3.09, nutJoin) + rodTravel;
      gland.rotation.x = (1 - glandJoin) * 0.16;
      // Lift the hose clear of the shell before it swings onto the top elbow.
      const hoseLift = ease(connected / 0.72);
      const hoseDock = ease((connected - 0.72) / 0.28);
      hoseAssembly.position.set(mix(-4.3, 2.25, connected), mix(2.9, 1.52, hoseLift), mix(1.15, 0.28, hoseDock));
      hoseAssembly.rotation.z = mix(0.28, 0, connected);
    }

    // The glow is a camera-facing gradient that tracks the parts on screen, so
    // it stays inside the rectangle the layout reserved.
    function placeGlow() {
      poseBounds.makeEmpty();
      measureBounds(poseBounds);
      const footprint = (poseBounds.max.x - poseBounds.min.x) * 1.15;
      glow.scale.set(footprint, footprint * 0.52, 1);
      glowAnchor.set((poseBounds.min.x + poseBounds.max.x) / 2, (poseBounds.min.y + poseBounds.max.y) / 2, poseBounds.min.z - 1.4);
      glow.position.copy(glowAnchor).applyMatrix4(camera.matrixWorld);
      glow.quaternion.copy(camera.quaternion);
    }

    function compose() {
      barrelShell.visible = !cutaway;
      cutawayBarrel.visible = cutaway;
      glandCartridge.visible = glandThread.visible = !cutaway;
      cutawayGland.visible = cutaway;
      plate.visible = plateLabel.visible = !cutaway;
      if (!measured) measureStory();
      applyPose(progress);
      applyLayout(pointerX, pointerY);
      placeGlow();
      frameModel();
    }

    const api = {
      setProgress(value) { if (!disposed) { progress = clamp(Number(value) || 0, 0, 1); dirty = true; } },
      setCutaway(value) { if (!disposed) { cutaway = Boolean(value); dirty = true; } },
      setPointer(x, y) { if (!disposed) { pointerX = clamp(Number(x) || 0, -1, 1); pointerY = clamp(Number(y) || 0, -1, 1); dirty = true; } },
      // The layout reserves a rectangle, in canvas fractions from the top-left.
      setFrame(box) {
        if (disposed || !box) return;
        const edges = [box.x0, box.y0, box.x1, box.y1].map(Number);
        if (!edges.every(Number.isFinite)) return;
        const [x0, y0, x1, y1] = edges.map((edge) => clamp(edge, 0, 1));
        // A collapsed or inverted rectangle keeps the last usable framing.
        if (x1 - x0 < 0.05 || y1 - y0 < 0.05) return;
        frame = { x0: x0, y0: y0, x1: x1, y1: y1 };
        measured = false;
        dirty = true;
      },
      resize(nextWidth, nextHeight) {
        if (disposed) return;
        width = Math.max(1, Number(nextWidth) || canvas.clientWidth || 1);
        height = Math.max(1, Number(nextHeight) || canvas.clientHeight || 1);
        renderer.setSize(width, height, false);
        measured = false;
        dirty = true;
      },
      render() {
        if (disposed) return;
        if (dirty) { compose(); dirty = false; }
        renderer.render(scene, camera);
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        const geometries = new Set();
        const materials = new Set();
        scene.traverse((object) => {
          if (object.geometry) geometries.add(object.geometry);
          if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => materials.add(material));
        });
        geometries.forEach((geometry) => geometry.dispose());
        materials.forEach((material) => material.dispose());
        textures.forEach((texture) => texture.dispose());
        environment.dispose();
        renderer.dispose();
      }
    };
    api.resize(canvas.clientWidth || 1200, canvas.clientHeight || 650);
    api.setProgress(0);
    return api;
  }

  window.SSTHydraulicScene = { create };
}());
