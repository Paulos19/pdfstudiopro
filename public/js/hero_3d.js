/* ==========================================================================
   Hero 3D Stage - Three.js Procedural Chubby P D F & Fluid Suspended Rope
   Engineered using img2threejs procedural modeling and physics animation
   ========================================================================== */

(function () {
    'use strict';

    const container = document.getElementById('hero3dCanvasContainer');
    if (!container) return;

    // --- 1. Scene, Camera, Renderer ---
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
        38,
        container.clientWidth / container.clientHeight,
        0.1,
        100
    );
    camera.position.set(0, 0.5, 9.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // --- 2. Studio Lighting (Warm, alegre e suave) ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    // Main Key Light
    const keyLight = new THREE.DirectionalLight(0xfff5ea, 1.2);
    keyLight.position.set(5, 8, 7);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    // Soft Rim Light (Cyan/Mint)
    const rimCyan = new THREE.DirectionalLight(0x06B6D4, 0.9);
    rimCyan.position.set(-6, -2, -4);
    scene.add(rimCyan);

    // Warm Fill Light (Coral/Rose)
    const fillCoral = new THREE.DirectionalLight(0xFF4D6D, 0.7);
    fillCoral.position.set(6, -3, 3);
    scene.add(fillCoral);

    // Subtle Top Dome
    const hemiLight = new THREE.HemisphereLight(0xF8FBFF, 0xE2E8F0, 0.6);
    scene.add(hemiLight);

    // --- 3. Master Stage Group ---
    const masterGroup = new THREE.Group();
    scene.add(masterGroup);

    // Common Extrude Settings for Chubby 3D Rounded-Cubic Letters
    const extrudeSettings = {
        depth: 0.45,
        bevelEnabled: true,
        bevelSegments: 9,
        steps: 1,
        bevelSize: 0.18,
        bevelThickness: 0.22,
        bevelOffset: 0
    };

    // --- Helper: Create Letter P (Sunset Coral) ---
    function createLetterP() {
        const shape = new THREE.Shape();
        // Outer contour of P
        shape.moveTo(0, 0);
        shape.lineTo(0, 2.6);
        // Top curve
        shape.bezierCurveTo(0, 3.1, 1.8, 3.1, 1.8, 2.1);
        shape.bezierCurveTo(1.8, 1.2, 0.85, 1.2, 0.85, 1.2);
        shape.lineTo(0.85, 0);
        shape.lineTo(0, 0);

        // Inner hole of P
        const hole = new THREE.Path();
        hole.moveTo(0.85, 1.7);
        hole.lineTo(0.85, 2.5);
        hole.bezierCurveTo(0.85, 2.75, 1.35, 2.75, 1.35, 2.1);
        hole.bezierCurveTo(1.35, 1.55, 0.85, 1.55, 0.85, 1.7);
        shape.holes.push(hole);

        const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geo.center();

        const mat = new THREE.MeshPhysicalMaterial({
            color: 0xFF4D6D, // Coral vibrante alegre
            roughness: 0.18,
            metalness: 0.05,
            clearcoat: 0.85,
            clearcoatRoughness: 0.12,
            reflectivity: 0.9
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const group = new THREE.Group();
        group.add(mesh);
        group.name = 'letterP';
        return group;
    }

    // --- Helper: Create Letter D (Sunny Gold / Cyber Amber) ---
    function createLetterD() {
        const shape = new THREE.Shape();
        // Outer contour of D
        shape.moveTo(0, 0);
        shape.lineTo(0, 2.6);
        shape.bezierCurveTo(2.1, 2.6, 2.1, 0, 0, 0);

        // Inner hole of D
        const hole = new THREE.Path();
        hole.moveTo(0.85, 0.55);
        hole.lineTo(0.85, 2.05);
        hole.bezierCurveTo(1.5, 2.05, 1.5, 0.55, 0.85, 0.55);
        shape.holes.push(hole);

        const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geo.center();

        const mat = new THREE.MeshPhysicalMaterial({
            color: 0xFBBF24, // Amarelo sol alegre
            roughness: 0.16,
            metalness: 0.08,
            clearcoat: 0.9,
            clearcoatRoughness: 0.1
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const group = new THREE.Group();
        group.add(mesh);
        group.name = 'letterD';
        return group;
    }

    // --- Helper: Create Letter F (Electric Cyan / Mint) ---
    function createLetterF() {
        const shape = new THREE.Shape();
        // Outer contour of F
        shape.moveTo(0, 0);
        shape.lineTo(0, 2.6);
        shape.lineTo(1.8, 2.6);
        shape.lineTo(1.8, 2.0);
        shape.lineTo(0.85, 2.0);
        shape.lineTo(0.85, 1.55);
        shape.lineTo(1.6, 1.55);
        shape.lineTo(1.6, 1.0);
        shape.lineTo(0.85, 1.0);
        shape.lineTo(0.85, 0);
        shape.lineTo(0, 0);

        const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geo.center();

        const mat = new THREE.MeshPhysicalMaterial({
            color: 0x06B6D4, // Ciano piscina radiante
            roughness: 0.18,
            metalness: 0.05,
            clearcoat: 0.85,
            clearcoatRoughness: 0.12
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const group = new THREE.Group();
        group.add(mesh);
        group.name = 'letterF';
        return group;
    }

    // Build the 3 letters
    const letterP = createLetterP();
    const letterD = createLetterD();
    const letterF = createLetterF();

    // Initial Positions in 3D Space
    letterP.position.set(-2.5, 0.2, 0.2);
    letterD.position.set(0, -0.1, 0.4);
    letterF.position.set(2.5, 0.25, 0.1);

    masterGroup.add(letterP);
    masterGroup.add(letterD);
    masterGroup.add(letterF);

    const letters = [
        { obj: letterP, baseY: 0.2, speed: 1.8, offset: 0, rotOffset: 0, hoverScale: 1, spinAngle: 0 },
        { obj: letterD, baseY: -0.1, speed: 2.1, offset: 1.4, rotOffset: 0.8, hoverScale: 1, spinAngle: 0 },
        { obj: letterF, baseY: 0.25, speed: 1.7, offset: 2.8, rotOffset: 1.6, hoverScale: 1, spinAngle: 0 }
    ];

    // --- 4. A Corda Fluida Suspensa ao Ar ---
    // Base control points weaving around the letters
    const baseRopePoints = [
        new THREE.Vector3(-5.2, 1.4, -0.8),
        new THREE.Vector3(-3.8, 0.9, 0.6),
        new THREE.Vector3(-2.4, -0.5, 0.8),
        new THREE.Vector3(-1.2, 0.8, -0.4),
        new THREE.Vector3(0.0, -0.7, 0.9),
        new THREE.Vector3(1.2, 0.6, -0.3),
        new THREE.Vector3(2.4, -0.4, 0.7),
        new THREE.Vector3(3.8, 0.8, 0.5),
        new THREE.Vector3(5.2, 1.3, -0.7)
    ];

    const ropePoints = baseRopePoints.map(p => p.clone());
    const ropeCurve = new THREE.CatmullRomCurve3(ropePoints);
    ropeCurve.curveType = 'centripetal';
    ropeCurve.tension = 0.5;

    let ropeGeo = new THREE.TubeGeometry(ropeCurve, 180, 0.085, 16, false);

    // Joyful pearlescent / lavender cord material
    const ropeMat = new THREE.MeshPhysicalMaterial({
        color: 0x818CF8, // Lilás cósmico suave
        emissive: 0x312E81,
        emissiveIntensity: 0.15,
        roughness: 0.35,
        metalness: 0.1,
        clearcoat: 0.5,
        clearcoatRoughness: 0.2
    });

    const ropeMesh = new THREE.Mesh(ropeGeo, ropeMat);
    ropeMesh.castShadow = true;
    ropeMesh.receiveShadow = true;
    masterGroup.add(ropeMesh);

    // End Beads / Tassels on Rope Tips (Cute spheres)
    const beadGeo = new THREE.SphereGeometry(0.18, 24, 24);
    const beadMat = new THREE.MeshPhysicalMaterial({
        color: 0xF59E0B, // Dourado
        roughness: 0.15,
        metalness: 0.4,
        clearcoat: 0.8
    });

    const startBead = new THREE.Mesh(beadGeo, beadMat);
    const endBead = new THREE.Mesh(beadGeo, beadMat);
    masterGroup.add(startBead);
    masterGroup.add(endBead);

    // --- 5. Floating Playful Particles (Pastel orbs) ---
    const particlesGroup = new THREE.Group();
    const particleGeos = [
        new THREE.SphereGeometry(0.08, 16, 16),
        new THREE.BoxGeometry(0.12, 0.12, 0.12),
        new THREE.TorusGeometry(0.12, 0.04, 12, 24)
    ];
    const particleColors = [0xFF4D6D, 0xFBBF24, 0x10B981, 0x06B6D4, 0x8B5CF6];

    const particleObjects = [];
    for (let i = 0; i < 22; i++) {
        const pGeo = particleGeos[i % particleGeos.length];
        const pMat = new THREE.MeshStandardMaterial({
            color: particleColors[i % particleColors.length],
            roughness: 0.25,
            metalness: 0.1
        });
        const pMesh = new THREE.Mesh(pGeo, pMat);
        pMesh.position.set(
            (Math.random() - 0.5) * 11,
            (Math.random() - 0.5) * 6,
            (Math.random() - 0.5) * 4 - 0.5
        );
        pMesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);

        particlesGroup.add(pMesh);
        particleObjects.push({
            mesh: pMesh,
            initX: pMesh.position.x,
            initY: pMesh.position.y,
            initZ: pMesh.position.z,
            speed: 0.5 + Math.random() * 0.8,
            offset: Math.random() * Math.PI * 2
        });
    }
    masterGroup.add(particlesGroup);

    // --- 6. Interactive Raycaster & Mouse Parallax ---
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(-999, -999);
    let targetRotX = 0;
    let targetRotY = 0;

    function onPointerMove(e) {
        const rect = container.getBoundingClientRect();
        const clientX = e.clientX !== undefined ? e.clientX : (e.touches ? e.touches[0].clientX : 0);
        const clientY = e.clientY !== undefined ? e.clientY : (e.touches ? e.touches[0].clientY : 0);

        mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

        // Subtle stage tilt
        targetRotY = mouse.x * 0.18;
        targetRotX = -mouse.y * 0.12;
    }

    function onPointerClick() {
        raycaster.setFromCamera(mouse, camera);
        const letterMeshes = letters.map(l => l.obj.children[0]);
        const intersects = raycaster.intersectObjects(letterMeshes);

        if (intersects.length > 0) {
            const hitMesh = intersects[0].object;
            const targetLetter = letters.find(l => l.obj.children[0] === hitMesh);
            if (targetLetter) {
                // Playful full spin jump!
                targetLetter.spinAngle += Math.PI * 2;
                targetLetter.hoverScale = 1.35;
            }
        }
    }

    window.addEventListener('mousemove', onPointerMove, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    container.addEventListener('click', onPointerClick);

    // Resize Handler
    function onResize() {
        if (!container) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    // --- 7. Animation Loop ---
    let clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        const delta = clock.getDelta();
        const time = clock.getElapsedTime();

        // 1. Raycast for Hover Reactions
        raycaster.setFromCamera(mouse, camera);
        const letterMeshes = letters.map(l => l.obj.children[0]);
        const intersects = raycaster.intersectObjects(letterMeshes);
        const hoveredMesh = intersects.length > 0 ? intersects[0].object : null;

        // 2. Animate Letters (Bobbing + Tilt + Squish + Spin)
        letters.forEach((item, index) => {
            const isHovered = (item.obj.children[0] === hoveredMesh);

            // Target scale (elastic bouncy feel)
            const targetScale = isHovered ? 1.18 : 1.0;
            item.hoverScale += (targetScale - item.hoverScale) * 0.15;

            // Spin recovery
            item.spinAngle += (0 - item.spinAngle) * 0.1;

            // Gentle floating bob
            const bobY = item.baseY + Math.sin(time * item.speed + item.offset) * 0.18;
            item.obj.position.y += (bobY - item.obj.position.y) * 0.2;

            // Idle rotation
            const idleRotY = Math.sin(time * 1.3 + item.rotOffset) * 0.15 + item.spinAngle;
            const idleRotZ = Math.cos(time * 1.1 + item.rotOffset) * 0.08;
            const idleRotX = Math.sin(time * 0.9 + item.rotOffset) * 0.06;

            item.obj.rotation.y += (idleRotY - item.obj.rotation.y) * 0.15;
            item.obj.rotation.z += (idleRotZ - item.obj.rotation.z) * 0.15;
            item.obj.rotation.x += (idleRotX - item.obj.rotation.x) * 0.15;

            item.obj.scale.set(item.hoverScale, item.hoverScale, item.hoverScale);
        });

        // 3. Animate Suspended Fluid Rope Waves
        for (let i = 0; i < baseRopePoints.length; i++) {
            const base = baseRopePoints[i];
            const waveY = base.y + Math.sin(time * 2.2 + i * 0.8) * 0.35 + Math.cos(time * 1.4 + i * 0.4) * 0.15;
            const waveZ = base.z + Math.sin(time * 1.8 + i * 0.6) * 0.28;
            const waveX = base.x + Math.sin(time * 0.8 + i * 0.5) * 0.06;

            ropePoints[i].set(waveX, waveY, waveZ);
        }

        ropeCurve.points = ropePoints;
        ropeMesh.geometry.dispose();
        ropeMesh.geometry = new THREE.TubeGeometry(ropeCurve, 180, 0.085, 16, false);

        // Update end beads position
        startBead.position.copy(ropePoints[0]);
        endBead.position.copy(ropePoints[ropePoints.length - 1]);

        // 4. Animate Floating Particles
        particleObjects.forEach((p) => {
            p.mesh.position.y = p.initY + Math.sin(time * p.speed + p.offset) * 0.35;
            p.mesh.rotation.x += 0.01 * p.speed;
            p.mesh.rotation.y += 0.015 * p.speed;
        });

        // 5. Smooth Mouse Stage Parallax
        masterGroup.rotation.y += (targetRotY - masterGroup.rotation.y) * 0.08;
        masterGroup.rotation.x += (targetRotX - masterGroup.rotation.x) * 0.08;

        renderer.render(scene, camera);
    }

    animate();
})();
