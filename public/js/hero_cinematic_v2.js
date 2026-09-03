/* ==========================================================================
   HERO CINEMATIC 3D ENGINE v3 — PDF Studio Pro
   Complete rewrite. Three.js r128-compatible (MeshStandardMaterial only).
   
   Architecture:
   1. Three robust block letters P, D, F — bold geometric, NOT caricature
   2. Braided hemp rope — vertical on left, sways on mouse proximity
   3. Mouse trail FX per letter: P=silk ribbons, D=golden sand, F=water drops
   4. GSAP ScrollTrigger scrolltelling: letters → logo, rope pulls, section 2 reveals
   ========================================================================== */

(function () {
    'use strict';

    // ── GSAP ScrollTrigger Registration ──
    if (window.gsap && window.ScrollTrigger) {
        gsap.registerPlugin(ScrollTrigger);
    }

    const container = document.getElementById('hero3dCanvasContainer');
    if (!container) return;

    // ═══════════════════════════════════════════════════════════════════
    // 1. SCENE, CAMERA, RENDERER
    // ═══════════════════════════════════════════════════════════════════

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
        40, window.innerWidth / window.innerHeight, 0.1, 100
    );
    camera.position.set(0, 0, 9);

    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // ═══════════════════════════════════════════════════════════════════
    // 2. STUDIO LIGHTING — Bright, clean, warm
    // ═══════════════════════════════════════════════════════════════════

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));

    const keyLight = new THREE.DirectionalLight(0xFFF8F0, 1.4);
    keyLight.position.set(4, 6, 6);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x06B6D4, 0.6);
    rimLight.position.set(-5, 2, -4);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0xFF6B8A, 0.45);
    fillLight.position.set(5, -3, 3);
    scene.add(fillLight);

    scene.add(new THREE.HemisphereLight(0xF0F4FF, 0xD4DAE8, 0.5));

    // Master group
    const stage = new THREE.Group();
    scene.add(stage);

    // ═══════════════════════════════════════════════════════════════════
    // 3. ROBUST BLOCK LETTERS P, D, F
    //    Bold geometric sans-serif — NOT rounded toy-like
    //    Using MeshStandardMaterial (r128-safe)
    // ═══════════════════════════════════════════════════════════════════

    const extrudeOpts = {
        depth: 0.55,
        bevelEnabled: true,
        bevelSegments: 6,
        steps: 1,
        bevelSize: 0.06,
        bevelThickness: 0.06
    };

    // ── Letter P: Coral #FF4D6D ──
    function buildP() {
        const s = new THREE.Shape();
        // Bold geometric P with thick stem and strong bowl
        s.moveTo(0, 0);
        s.lineTo(0, 3.0);
        s.lineTo(1.6, 3.0);
        s.bezierCurveTo(2.5, 3.0, 2.5, 1.5, 1.6, 1.5);
        s.lineTo(0.9, 1.5);
        s.lineTo(0.9, 0);
        s.lineTo(0, 0);

        // Bowl hole
        const hole = new THREE.Path();
        hole.moveTo(0.9, 2.0);
        hole.lineTo(1.4, 2.0);
        hole.bezierCurveTo(1.85, 2.0, 1.85, 2.55, 1.4, 2.55);
        hole.lineTo(0.9, 2.55);
        hole.lineTo(0.9, 2.0);
        s.holes.push(hole);

        const geo = new THREE.ExtrudeGeometry(s, extrudeOpts);
        geo.center();
        geo.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({
            color: 0xFF4D6D,
            roughness: 0.28,
            metalness: 0.05
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const grp = new THREE.Group();
        grp.add(mesh);
        grp.name = 'P';
        return grp;
    }

    // ── Letter D: Amber #FBBF24 ──
    function buildD() {
        const s = new THREE.Shape();
        s.moveTo(0, 0);
        s.lineTo(0, 3.0);
        s.lineTo(1.2, 3.0);
        s.bezierCurveTo(2.6, 3.0, 2.6, 0, 1.2, 0);
        s.lineTo(0, 0);

        const hole = new THREE.Path();
        hole.moveTo(0.9, 0.55);
        hole.lineTo(1.1, 0.55);
        hole.bezierCurveTo(1.8, 0.55, 1.8, 2.45, 1.1, 2.45);
        hole.lineTo(0.9, 2.45);
        hole.lineTo(0.9, 0.55);
        s.holes.push(hole);

        const geo = new THREE.ExtrudeGeometry(s, extrudeOpts);
        geo.center();
        geo.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({
            color: 0xFBBF24,
            roughness: 0.25,
            metalness: 0.1
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const grp = new THREE.Group();
        grp.add(mesh);
        grp.name = 'D';
        return grp;
    }

    // ── Letter F: Cyan #06B6D4 ──
    function buildF() {
        const s = new THREE.Shape();
        s.moveTo(0, 0);
        s.lineTo(0, 3.0);
        s.lineTo(2.0, 3.0);
        s.lineTo(2.0, 2.45);
        s.lineTo(0.9, 2.45);
        s.lineTo(0.9, 1.75);
        s.lineTo(1.7, 1.75);
        s.lineTo(1.7, 1.2);
        s.lineTo(0.9, 1.2);
        s.lineTo(0.9, 0);
        s.lineTo(0, 0);

        const geo = new THREE.ExtrudeGeometry(s, extrudeOpts);
        geo.center();
        geo.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({
            color: 0x06B6D4,
            roughness: 0.25,
            metalness: 0.08
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const grp = new THREE.Group();
        grp.add(mesh);
        grp.name = 'F';
        return grp;
    }

    const letterP = buildP();
    const letterD = buildD();
    const letterF = buildF();

    // Initial center positions (hero state)
    const heroPos = {
        P: new THREE.Vector3(-2.6, 0.0, 0),
        D: new THREE.Vector3(0.0, 0.0, 0),
        F: new THREE.Vector3(2.6, 0.0, 0)
    };
    // Logo dock positions (scrolled state — top-left corner, tiny)
    const logoPos = {
        P: new THREE.Vector3(-5.2, 3.3, 0),
        D: new THREE.Vector3(-4.5, 3.3, 0),
        F: new THREE.Vector3(-3.8, 3.3, 0)
    };

    letterP.position.copy(heroPos.P);
    letterD.position.copy(heroPos.D);
    letterF.position.copy(heroPos.F);

    stage.add(letterP);
    stage.add(letterD);
    stage.add(letterF);

    const letters = [
        { grp: letterP, hero: heroPos.P.clone(), logo: logoPos.P.clone(), speed: 1.8, phase: 0, trail: 'silk' },
        { grp: letterD, hero: heroPos.D.clone(), logo: logoPos.D.clone(), speed: 2.1, phase: 1.3, trail: 'sand' },
        { grp: letterF, hero: heroPos.F.clone(), logo: logoPos.F.clone(), speed: 1.7, phase: 2.6, trail: 'water' }
    ];

    // ═══════════════════════════════════════════════════════════════════
    // 4. BRAIDED HEMP ROPE — Vertical on left, sways on mouse proximity
    //    Modeled as 3 twisted strands helixing around a central spine
    // ═══════════════════════════════════════════════════════════════════

    const ropeGroup = new THREE.Group();
    stage.add(ropeGroup);

    const ROPE_ANCHOR_TOP = new THREE.Vector3(-5.5, 4.0, 0);
    const ROPE_ANCHOR_BOT = new THREE.Vector3(-5.5, -3.6, 0);
    const ROPE_SEGMENTS = 100;
    const ROPE_RADIUS = 0.065;
    const STRAND_COUNT = 3;
    const STRAND_ORBIT = 0.08;    // distance each strand orbits from center
    const HELIX_TWISTS = 5.5;     // number of full helix rotations along rope length

    const strandMat = new THREE.MeshStandardMaterial({
        color: 0xC9A96E,      // Natural hemp/jute color
        roughness: 0.82,
        metalness: 0.0
    });

    const strands = [];

    // Build 3 helixing strand tubes
    for (let s = 0; s < STRAND_COUNT; s++) {
        const strandPts = [];
        const phaseOffset = (s / STRAND_COUNT) * Math.PI * 2;

        for (let i = 0; i <= ROPE_SEGMENTS; i++) {
            const t = i / ROPE_SEGMENTS;
            const x = ROPE_ANCHOR_TOP.x + Math.cos(t * Math.PI * 2 * HELIX_TWISTS + phaseOffset) * STRAND_ORBIT;
            const y = THREE.MathUtils.lerp(ROPE_ANCHOR_TOP.y, ROPE_ANCHOR_BOT.y, t);
            const z = Math.sin(t * Math.PI * 2 * HELIX_TWISTS + phaseOffset) * STRAND_ORBIT;
            strandPts.push(new THREE.Vector3(x, y, z));
        }

        const curve = new THREE.CatmullRomCurve3(strandPts);
        const geo = new THREE.TubeGeometry(curve, ROPE_SEGMENTS, ROPE_RADIUS, 8, false);
        const mesh = new THREE.Mesh(geo, strandMat);
        mesh.castShadow = true;
        ropeGroup.add(mesh);
        strands.push({ mesh, basePts: strandPts.map(p => p.clone()), currentPts: strandPts, phaseOffset });
    }

    // ═══════════════════════════════════════════════════════════════════
    // 5. TRAIL EFFECTS — Particles for each letter type
    // ═══════════════════════════════════════════════════════════════════

    // 5.1 Silk Ribbons (P) — short-lived tube segments
    const silkGroup = new THREE.Group();
    stage.add(silkGroup);
    const silkPool = [];
    const silkMat = new THREE.MeshStandardMaterial({
        color: 0xFF6B8A,
        transparent: true,
        opacity: 0.7,
        roughness: 0.4,
        side: THREE.DoubleSide
    });

    for (let i = 0; i < 8; i++) {
        const pts = [new THREE.Vector3(), new THREE.Vector3(0, -0.3, 0), new THREE.Vector3(0.1, -0.6, 0.1)];
        const c = new THREE.CatmullRomCurve3(pts);
        const g = new THREE.TubeGeometry(c, 12, 0.035, 6, false);
        const m = new THREE.Mesh(g, silkMat.clone());
        m.visible = false;
        silkGroup.add(m);
        silkPool.push({ mesh: m, life: 0, active: false });
    }

    function spawnSilk(origin) {
        const r = silkPool.find(s => !s.active);
        if (!r) return;
        r.active = true;
        r.life = 1.0;
        r.mesh.visible = true;
        r.mesh.position.copy(origin);
        r.mesh.rotation.set(Math.random() * 0.5, Math.random() * 0.5, Math.random() * 0.5);
        r.mesh.material.opacity = 0.7;
    }

    // 5.2 Golden Sand Particles (D)
    const SAND_N = 200;
    const sandPositions = new Float32Array(SAND_N * 3);
    const sandVelocities = [];
    const sandLifetimes = new Float32Array(SAND_N);
    for (let i = 0; i < SAND_N; i++) {
        sandVelocities.push(new THREE.Vector3());
        sandLifetimes[i] = 0;
    }
    const sandGeo = new THREE.BufferGeometry();
    sandGeo.setAttribute('position', new THREE.BufferAttribute(sandPositions, 3));
    const sandMat = new THREE.PointsMaterial({
        color: 0xFCD34D,
        size: 0.08,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const sandPts = new THREE.Points(sandGeo, sandMat);
    stage.add(sandPts);

    function spawnSand(origin) {
        const pos = sandGeo.attributes.position.array;
        for (let i = 0; i < 12; i++) {
            const idx = Math.floor(Math.random() * SAND_N);
            pos[idx * 3] = origin.x + (Math.random() - 0.5) * 0.5;
            pos[idx * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.4;
            pos[idx * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.3;
            sandVelocities[idx].set(
                (Math.random() - 0.5) * 0.04,
                -(0.015 + Math.random() * 0.03),
                (Math.random() - 0.5) * 0.04
            );
            sandLifetimes[idx] = 1.0;
        }
        sandGeo.attributes.position.needsUpdate = true;
    }

    // 5.3 Water Droplets (F)
    const waterGroup = new THREE.Group();
    stage.add(waterGroup);
    const dropPool = [];
    const dropGeo = new THREE.SphereGeometry(0.05, 12, 12);
    const dropMat = new THREE.MeshStandardMaterial({
        color: 0x38BDF8,
        roughness: 0.1,
        metalness: 0.05,
        transparent: true,
        opacity: 0.85
    });

    for (let i = 0; i < 24; i++) {
        const dm = new THREE.Mesh(dropGeo, dropMat.clone());
        dm.visible = false;
        waterGroup.add(dm);
        dropPool.push({ mesh: dm, vel: new THREE.Vector3(), life: 0, active: false });
    }

    function spawnWater(origin) {
        for (let i = 0; i < 4; i++) {
            const d = dropPool.find(x => !x.active);
            if (!d) continue;
            d.active = true;
            d.life = 1.0;
            d.mesh.visible = true;
            d.mesh.position.set(
                origin.x + (Math.random() - 0.5) * 0.3,
                origin.y + (Math.random() - 0.5) * 0.3,
                origin.z + (Math.random() - 0.5) * 0.2
            );
            d.vel.set(
                (Math.random() - 0.5) * 0.035,
                0.02 + Math.random() * 0.03,
                (Math.random() - 0.5) * 0.035
            );
            d.mesh.scale.setScalar(1);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 6. MOUSE & RAYCASTER
    // ═══════════════════════════════════════════════════════════════════

    const mouse = new THREE.Vector2(-999, -999);
    const mouseWorld = new THREE.Vector3();
    const raycaster = new THREE.Raycaster();
    let trailTimer = 0;

    function onPointerMove(e) {
        const cx = e.clientX !== undefined ? e.clientX : (e.touches ? e.touches[0].clientX : 0);
        const cy = e.clientY !== undefined ? e.clientY : (e.touches ? e.touches[0].clientY : 0);
        mouse.x = (cx / window.innerWidth) * 2 - 1;
        mouse.y = -(cy / window.innerHeight) * 2 + 1;

        // Project mouse into world XY plane at z=0
        const vec = new THREE.Vector3(mouse.x, mouse.y, 0.5);
        vec.unproject(camera);
        const dir = vec.sub(camera.position).normalize();
        const dist = -camera.position.z / dir.z;
        mouseWorld.copy(camera.position).add(dir.multiplyScalar(dist));
    }

    window.addEventListener('mousemove', onPointerMove, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });

    // ═══════════════════════════════════════════════════════════════════
    // 7. GSAP SCROLLTELLING
    // ═══════════════════════════════════════════════════════════════════

    let scrollProgress = 0;

    if (window.ScrollTrigger) {
        ScrollTrigger.create({
            trigger: '#heroScrollWrapper',
            start: 'top top',
            end: '+=1400',
            scrub: 1.2,
            onUpdate: function (self) {
                scrollProgress = self.progress;

                // Navbar
                const nav = document.getElementById('mainLandingNavbar');
                if (nav) {
                    const a = Math.max(0, (scrollProgress - 0.4) / 0.35);
                    nav.style.opacity = Math.min(1, a);
                    nav.style.pointerEvents = a > 0.7 ? 'all' : 'none';
                    nav.style.transform = 'translateY(' + ((1 - Math.min(1, a)) * -24) + 'px)';
                }

                // Hint
                const hint = document.getElementById('heroScrollHint');
                if (hint) {
                    hint.style.opacity = Math.max(0, 1 - scrollProgress * 4);
                }

                // Section 2
                const sec2 = document.getElementById('landingSection2');
                if (sec2) {
                    const b = Math.max(0, (scrollProgress - 0.5) / 0.5);
                    sec2.style.opacity = b;
                    sec2.style.transform = 'translateY(' + ((1 - b) * 60) + 'px)';
                }
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    // 8. ANIMATION LOOP
    // ═══════════════════════════════════════════════════════════════════

    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        const dt = clock.getDelta();
        const t = clock.getElapsedTime();
        trailTimer += dt;

        // 8.1 — Raycast for hover detection on letters
        raycaster.setFromCamera(mouse, camera);
        const meshes = letters.map(l => l.grp.children[0]);
        const hits = raycaster.intersectObjects(meshes);
        const hitMesh = hits.length > 0 ? hits[0].object : null;

        // 8.2 — Animate letters
        const logoScale = 0.2;
        letters.forEach(function (L) {
            const isHovered = (L.grp.children[0] === hitMesh);

            // Position interpolation: hero → logo via scrollProgress
            const target = new THREE.Vector3().lerpVectors(L.hero, L.logo, scrollProgress);

            // Idle float (diminishes as scroll advances)
            const floatAmp = (1 - scrollProgress) * 0.1;
            target.y += Math.sin(t * L.speed + L.phase) * floatAmp;

            L.grp.position.lerp(target, 0.12);

            // Scale: 1 → logoScale
            const targetScale = THREE.MathUtils.lerp(1, logoScale, scrollProgress);
            const sc = isHovered && scrollProgress < 0.3 ? targetScale * 1.12 : targetScale;
            L.grp.scale.lerp(new THREE.Vector3(sc, sc, sc), 0.14);

            // Idle rotation (diminishes with scroll)
            const rAmp = (1 - scrollProgress);
            const ry = Math.sin(t * 1.1 + L.phase) * 0.1 * rAmp;
            const rz = Math.cos(t * 0.85 + L.phase) * 0.05 * rAmp;
            L.grp.rotation.y += (ry - L.grp.rotation.y) * 0.1;
            L.grp.rotation.z += (rz - L.grp.rotation.z) * 0.1;

            // Trail emissions (only when hero is visible, throttled)
            if (isHovered && scrollProgress < 0.3 && trailTimer > 0.08) {
                const o = L.grp.position;
                if (L.trail === 'silk') spawnSilk(o);
                if (L.trail === 'sand') spawnSand(o);
                if (L.trail === 'water') spawnWater(o);
            }
        });

        if (trailTimer > 0.08) trailTimer = 0;

        // 8.3 — Update trail effects

        // Silk ribbons
        silkPool.forEach(function (r) {
            if (!r.active) return;
            r.life -= dt * 1.6;
            r.mesh.material.opacity = Math.max(0, r.life * 0.7);
            r.mesh.position.y -= dt * 0.25;
            r.mesh.rotation.z += dt * 0.5;
            if (r.life <= 0) { r.active = false; r.mesh.visible = false; }
        });

        // Sand particles
        var sandArr = sandGeo.attributes.position.array;
        var hasSand = false;
        for (var i = 0; i < SAND_N; i++) {
            if (sandLifetimes[i] > 0) {
                hasSand = true;
                sandLifetimes[i] -= dt * 1.1;
                sandArr[i * 3] += sandVelocities[i].x;
                sandArr[i * 3 + 1] += sandVelocities[i].y;
                sandArr[i * 3 + 2] += sandVelocities[i].z;
            }
        }
        if (hasSand) {
            sandGeo.attributes.position.needsUpdate = true;
            sandMat.opacity = THREE.MathUtils.lerp(sandMat.opacity, 0.8, 0.15);
        } else {
            sandMat.opacity = THREE.MathUtils.lerp(sandMat.opacity, 0, 0.1);
        }

        // Water droplets
        dropPool.forEach(function (d) {
            if (!d.active) return;
            d.life -= dt * 1.3;
            d.mesh.position.add(d.vel);
            d.vel.y -= 0.0015;
            d.mesh.scale.setScalar(Math.max(0.1, d.life));
            if (d.life <= 0) { d.active = false; d.mesh.visible = false; }
        });

        // 8.4 — Rope sway based on mouse proximity
        var mouseDistToRope = Math.abs(mouseWorld.x - ROPE_ANCHOR_TOP.x);
        var ropeInfluence = Math.max(0, 1 - mouseDistToRope / 3.0);

        strands.forEach(function (strand) {
            for (var si = 0; si <= ROPE_SEGMENTS; si++) {
                var segT = si / ROPE_SEGMENTS;
                var base = strand.basePts[si];

                // Natural sway: sine waves, stronger at bottom (catenary-like)
                var swayAmp = segT * segT * 0.35 * ropeInfluence;
                var swayX = Math.sin(t * 2.5 + segT * 4) * swayAmp;
                var swayZ = Math.cos(t * 1.8 + segT * 3) * swayAmp * 0.6;

                // Scroll tension: rope gathers upward
                var pullY = scrollProgress * segT * 1.5;

                strand.currentPts[si].x = base.x + swayX;
                strand.currentPts[si].y = base.y + pullY;
                strand.currentPts[si].z = base.z + swayZ;
            }

            // Rebuild tube geometry
            var curve = new THREE.CatmullRomCurve3(strand.currentPts);
            strand.mesh.geometry.dispose();
            strand.mesh.geometry = new THREE.TubeGeometry(curve, ROPE_SEGMENTS, ROPE_RADIUS, 8, false);
        });

        // 8.5 — Subtle camera parallax from mouse
        camera.position.x += (mouse.x * 0.3 - camera.position.x) * 0.04;
        camera.position.y += (mouse.y * 0.2 + 0.0 - camera.position.y) * 0.04;
        camera.lookAt(0, 0, 0);

        renderer.render(scene, camera);
    }

    animate();

    // Resize
    window.addEventListener('resize', function () {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
})();
