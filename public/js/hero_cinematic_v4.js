/* ==========================================================================
   HERO CINEMATIC 3D ENGINE v4 — PDF Studio Pro
   
   Focused rebuild: Letter P with fabric shader, wave displacement,
   and interactive mouse trail (finger-through-fabric effect).
   
   Three.js r128-safe: MeshStandardMaterial + onBeforeCompile shader injection
   ========================================================================== */

(function () {
    'use strict';

    // ── GSAP ScrollTrigger Registration ──
    if (window.gsap && window.ScrollTrigger) {
        gsap.registerPlugin(ScrollTrigger);
    }

    const container = document.getElementById('hero3dCanvasContainer');
    if (!container) { console.error('[hero] #hero3dCanvasContainer not found'); return; }

    // ═══════════════════════════════════════════════════════════════════
    // 1. SCENE, CAMERA, RENDERER
    // ═══════════════════════════════════════════════════════════════════

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xF6FAFF);

    const camera = new THREE.PerspectiveCamera(
        35, window.innerWidth / window.innerHeight, 0.1, 100
    );
    camera.position.set(0, 0.3, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // ═══════════════════════════════════════════════════════════════════
    // 2. LIGHTING — Soft studio setup matching reference
    // ═══════════════════════════════════════════════════════════════════

    // Ambient fill
    scene.add(new THREE.AmbientLight(0xE8EDF5, 0.6));

    // Key light (upper-right, warm white — matching reference shadow direction)
    const keyLight = new THREE.DirectionalLight(0xFFF5E8, 1.5);
    keyLight.position.set(3, 5, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 20;
    keyLight.shadow.camera.left = -4;
    keyLight.shadow.camera.right = 4;
    keyLight.shadow.camera.top = 4;
    keyLight.shadow.camera.bottom = -4;
    keyLight.shadow.bias = -0.002;
    scene.add(keyLight);

    // Fill light (left, soft blue)
    const fillLight = new THREE.DirectionalLight(0xB8D4F0, 0.5);
    fillLight.position.set(-4, 2, 3);
    scene.add(fillLight);

    // Rim light (behind)
    const rimLight = new THREE.DirectionalLight(0xFFFFFF, 0.35);
    rimLight.position.set(0, 2, -5);
    scene.add(rimLight);

    // Hemisphere for environmental softness
    scene.add(new THREE.HemisphereLight(0xF0F4FF, 0xD4DAE8, 0.45));

    // Ground plane for shadow catching
    const groundGeo = new THREE.PlaneGeometry(20, 20);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.12 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.85;
    ground.receiveShadow = true;
    scene.add(ground);

    // ═══════════════════════════════════════════════════════════════════
    // 3. LINEN/FABRIC TEXTURE via Canvas (crosshatch weave)
    // ═══════════════════════════════════════════════════════════════════

    function createLinenTexture(size) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Base cornflower blue
        ctx.fillStyle = '#6495C8';
        ctx.fillRect(0, 0, size, size);

        // Crosshatch weave pattern
        ctx.globalAlpha = 0.08;
        ctx.strokeStyle = '#4A75A8';
        ctx.lineWidth = 1;

        const step = 4;
        for (let i = 0; i < size; i += step) {
            // Horizontal threads
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(size, i);
            ctx.stroke();

            // Vertical threads
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, size);
            ctx.stroke();
        }

        // Subtle noise for fabric imperfection
        ctx.globalAlpha = 0.04;
        for (let i = 0; i < size * size * 0.03; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            ctx.fillStyle = Math.random() > 0.5 ? '#7AB5E8' : '#4A6588';
            ctx.fillRect(x, y, 2, 2);
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(3, 3);
        return tex;
    }

    // ═══════════════════════════════════════════════════════════════════
    // 4. INTERACTIVE WAVE DISPLACEMENT — Render Target as touch map
    //    Mouse position is painted as ripples into a DataTexture,
    //    which the vertex shader reads for displacement.
    // ═══════════════════════════════════════════════════════════════════

    const WAVE_RES = 256;
    const waveData = new Float32Array(WAVE_RES * WAVE_RES);
    const wavePrev = new Float32Array(WAVE_RES * WAVE_RES);
    const waveDataRGBA = new Uint8Array(WAVE_RES * WAVE_RES * 4);

    const waveTexture = new THREE.DataTexture(
        waveDataRGBA, WAVE_RES, WAVE_RES, THREE.RGBAFormat
    );
    waveTexture.needsUpdate = true;

    // Wave simulation (2D wave equation)
    const WAVE_DAMPING = 0.97;
    const WAVE_SPEED = 0.38;

    function stepWaveSimulation() {
        const temp = new Float32Array(WAVE_RES * WAVE_RES);
        for (let y = 1; y < WAVE_RES - 1; y++) {
            for (let x = 1; x < WAVE_RES - 1; x++) {
                const idx = y * WAVE_RES + x;
                const laplacian =
                    waveData[(y - 1) * WAVE_RES + x] +
                    waveData[(y + 1) * WAVE_RES + x] +
                    waveData[y * WAVE_RES + (x - 1)] +
                    waveData[y * WAVE_RES + (x + 1)] -
                    4 * waveData[idx];

                temp[idx] = (2 * waveData[idx] - wavePrev[idx] + WAVE_SPEED * laplacian) * WAVE_DAMPING;
            }
        }

        for (let i = 0; i < WAVE_RES * WAVE_RES; i++) {
            wavePrev[i] = waveData[i];
            waveData[i] = temp[i];
            // Encode to RGBA for DataTexture (R channel = displacement)
            const v = Math.max(0, Math.min(255, 128 + waveData[i] * 128));
            waveDataRGBA[i * 4] = v;
            waveDataRGBA[i * 4 + 1] = v;
            waveDataRGBA[i * 4 + 2] = v;
            waveDataRGBA[i * 4 + 3] = 255;
        }
        waveTexture.needsUpdate = true;
    }

    function addWaveTouch(uvX, uvY, radius, strength) {
        const cx = Math.floor(uvX * WAVE_RES);
        const cy = Math.floor(uvY * WAVE_RES);
        const r = Math.floor(radius * WAVE_RES);
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                const px = cx + dx;
                const py = cy + dy;
                if (px < 0 || px >= WAVE_RES || py < 0 || py >= WAVE_RES) continue;
                const dist = Math.sqrt(dx * dx + dy * dy) / r;
                if (dist > 1) continue;
                const falloff = (1 - dist * dist);
                waveData[py * WAVE_RES + px] += strength * falloff;
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 5. LETTER P GEOMETRY — Bold rounded cushion shape
    //    Proportions matched to reference: ~3:4 ratio, heavy stem,
    //    elliptical bowl, highly rounded corners
    // ═══════════════════════════════════════════════════════════════════

    function buildLetterP() {
        const s = new THREE.Shape();

        // Scale factor for desired world size
        const sc = 0.65;

        // Outer contour — bold P with rounded corners
        // Bottom-left start
        s.moveTo(-0.7 * sc, -1.5 * sc);

        // Left stem (bottom to top)
        s.lineTo(-0.7 * sc, 1.3 * sc);

        // Top-left corner round
        s.quadraticCurveTo(-0.7 * sc, 1.5 * sc, -0.5 * sc, 1.5 * sc);

        // Top bar to bowl
        s.lineTo(0.3 * sc, 1.5 * sc);

        // Bowl outer curve (top to right to bottom)
        s.bezierCurveTo(
            1.1 * sc, 1.5 * sc,
            1.1 * sc, 0.2 * sc,
            0.3 * sc, 0.2 * sc
        );

        // Bowl bottom back to stem
        s.lineTo(0.0 * sc, 0.2 * sc);

        // Inner stem right edge going down
        s.lineTo(0.0 * sc, -1.3 * sc);

        // Bottom-right corner round
        s.quadraticCurveTo(0.0 * sc, -1.5 * sc, -0.2 * sc, -1.5 * sc);

        // Bottom edge back
        s.lineTo(-0.5 * sc, -1.5 * sc);

        // Bottom-left corner round
        s.quadraticCurveTo(-0.7 * sc, -1.5 * sc, -0.7 * sc, -1.5 * sc);

        s.closePath();

        // Bowl hole (counter)
        const hole = new THREE.Path();
        const hsc = 0.42; // Hole scale

        hole.moveTo(-0.0 * sc, 0.55 * sc);
        hole.lineTo(0.15 * sc, 0.55 * sc);
        hole.bezierCurveTo(
            0.65 * sc, 0.55 * sc,
            0.65 * sc, 1.15 * sc,
            0.15 * sc, 1.15 * sc
        );
        hole.lineTo(-0.0 * sc, 1.15 * sc);
        hole.closePath();
        s.holes.push(hole);

        // Cushion-like extrusion: deep bevel for soft edges
        const extrudeSettings = {
            depth: 0.5,
            bevelEnabled: true,
            bevelSegments: 8,
            steps: 1,
            bevelSize: 0.15,
            bevelThickness: 0.15
        };

        const geometry = new THREE.ExtrudeGeometry(s, extrudeSettings);
        geometry.center();
        geometry.computeVertexNormals();

        // Compute UV bounds for wave mapping
        geometry.computeBoundingBox();

        return geometry;
    }

    // ═══════════════════════════════════════════════════════════════════
    // 6. FABRIC MATERIAL with custom shader injection
    //    Base: MeshStandardMaterial (r128-safe)
    //    Injected: vertex displacement from wave texture + organic ridges
    // ═══════════════════════════════════════════════════════════════════

    const linenTex = createLinenTexture(512);

    const fabricMat = new THREE.MeshStandardMaterial({
        map: linenTex,
        color: 0x6495C8,
        roughness: 0.78,
        metalness: 0.0,
        side: THREE.FrontSide
    });

    // Shader injection for wave displacement
    fabricMat.userData.waveTexture = waveTexture;
    fabricMat.userData.time = { value: 0.0 };

    fabricMat.onBeforeCompile = function (shader) {
        // Add uniforms
        shader.uniforms.uWaveMap = { value: waveTexture };
        shader.uniforms.uTime = { value: 0.0 };
        shader.uniforms.uWaveStrength = { value: 0.12 };

        // Store reference for animation updates
        fabricMat.userData.shader = shader;

        // Vertex shader: add displacement from wave texture + organic ridges
        shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            `#include <common>
            uniform sampler2D uWaveMap;
            uniform float uTime;
            uniform float uWaveStrength;
            
            // Simple noise for organic fabric wrinkles
            float fabricNoise(vec3 p) {
                vec3 i = floor(p);
                vec3 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                float a = sin(dot(i, vec3(127.1, 311.7, 74.7))) * 43758.5453;
                float b = sin(dot(i + vec3(1,0,0), vec3(127.1, 311.7, 74.7))) * 43758.5453;
                float c = sin(dot(i + vec3(0,1,0), vec3(127.1, 311.7, 74.7))) * 43758.5453;
                float d = sin(dot(i + vec3(1,1,0), vec3(127.1, 311.7, 74.7))) * 43758.5453;
                float e = sin(dot(i + vec3(0,0,1), vec3(127.1, 311.7, 74.7))) * 43758.5453;
                float ff = sin(dot(i + vec3(1,0,1), vec3(127.1, 311.7, 74.7))) * 43758.5453;
                float g = sin(dot(i + vec3(0,1,1), vec3(127.1, 311.7, 74.7))) * 43758.5453;
                float h = sin(dot(i + vec3(1,1,1), vec3(127.1, 311.7, 74.7))) * 43758.5453;
                
                a = fract(a); b = fract(b); c = fract(c); d = fract(d);
                e = fract(e); ff = fract(ff); g = fract(g); h = fract(h);
                
                return mix(
                    mix(mix(a, b, f.x), mix(c, d, f.x), f.y),
                    mix(mix(e, ff, f.x), mix(g, h, f.x), f.y),
                    f.z
                );
            }
            `
        );

        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            
            // UV-based wave displacement from mouse interaction
            vec2 waveUV = uv;
            vec4 waveSample = texture2D(uWaveMap, waveUV);
            float waveDisp = (waveSample.r - 0.5) * 2.0 * uWaveStrength;
            
            // Organic fabric ridges (static wrinkles like in the reference)
            float ridges = 0.0;
            ridges += fabricNoise(position * 2.5 + vec3(0.0, uTime * 0.05, 0.0)) * 0.06;
            ridges += fabricNoise(position * 5.0 + vec3(uTime * 0.02, 0.0, 0.0)) * 0.03;
            ridges += fabricNoise(position * 10.0) * 0.015;
            
            // Apply displacement along normal
            transformed += normal * (waveDisp + ridges);
            `
        );

        // Fragment shader: subtle shading variation for fabric feel
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            `#include <common>
            uniform sampler2D uWaveMap;
            uniform float uTime;
            `
        );

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            `
            // Subtle color variation based on wave displacement for depth cue
            vec4 waveFrag = texture2D(uWaveMap, vUv);
            float waveShade = (waveFrag.r - 0.5) * 0.15;
            gl_FragColor.rgb += waveShade;
            gl_FragColor.rgb *= 1.0 + sin(vUv.x * 40.0 + vUv.y * 40.0) * 0.01; // micro weave
            
            #include <dithering_fragment>
            `
        );
    };

    // ═══════════════════════════════════════════════════════════════════
    // 7. ASSEMBLE THE LETTER P MESH
    // ═══════════════════════════════════════════════════════════════════

    const letterPGeo = buildLetterP();
    const letterP = new THREE.Mesh(letterPGeo, fabricMat);
    letterP.castShadow = true;
    letterP.receiveShadow = true;
    letterP.position.set(0, 0, 0);
    scene.add(letterP);

    // ═══════════════════════════════════════════════════════════════════
    // 8. MOUSE RAYCASTING & WAVE INTERACTION
    // ═══════════════════════════════════════════════════════════════════

    const mouse = new THREE.Vector2(-999, -999);
    const raycaster = new THREE.Raycaster();
    let lastTouchUV = null;

    function onPointerMove(e) {
        const cx = e.clientX !== undefined ? e.clientX : (e.touches ? e.touches[0].clientX : 0);
        const cy = e.clientY !== undefined ? e.clientY : (e.touches ? e.touches[0].clientY : 0);
        mouse.x = (cx / window.innerWidth) * 2 - 1;
        mouse.y = -(cy / window.innerHeight) * 2 + 1;
    }

    window.addEventListener('mousemove', onPointerMove, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });

    // ═══════════════════════════════════════════════════════════════════
    // 9. GSAP SCROLLTELLING
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

                // Navbar reveal
                const nav = document.getElementById('mainLandingNavbar');
                if (nav) {
                    const a = Math.max(0, (scrollProgress - 0.4) / 0.35);
                    nav.style.opacity = Math.min(1, a);
                    nav.style.pointerEvents = a > 0.7 ? 'all' : 'none';
                    nav.style.transform = 'translateY(' + ((1 - Math.min(1, a)) * -24) + 'px)';
                }

                // Hint fade
                const hint = document.getElementById('heroScrollHint');
                if (hint) {
                    hint.style.opacity = Math.max(0, 1 - scrollProgress * 4);
                }

                // Section 2 reveal
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
    // 10. ANIMATION LOOP
    // ═══════════════════════════════════════════════════════════════════

    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        const dt = Math.min(clock.getDelta(), 0.05); // Cap delta to prevent spiral
        const t = clock.getElapsedTime();

        // 10.1 — Raycast for mouse-on-letter interaction
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObject(letterP);

        if (hits.length > 0) {
            const hit = hits[0];
            if (hit.uv) {
                const uvX = hit.uv.x;
                const uvY = hit.uv.y;

                // Add ripple at mouse position
                addWaveTouch(uvX, uvY, 0.04, 1.8);

                // If we have a previous position, draw a trail between them
                if (lastTouchUV) {
                    const dx = uvX - lastTouchUV.x;
                    const dy = uvY - lastTouchUV.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > 0.005 && dist < 0.3) {
                        const steps = Math.ceil(dist / 0.01);
                        for (let i = 0; i < steps; i++) {
                            const t2 = i / steps;
                            addWaveTouch(
                                lastTouchUV.x + dx * t2,
                                lastTouchUV.y + dy * t2,
                                0.03,
                                1.2
                            );
                        }
                    }
                }
                lastTouchUV = { x: uvX, y: uvY };
            }
        } else {
            lastTouchUV = null;
        }

        // 10.2 — Step wave simulation
        stepWaveSimulation();

        // 10.3 — Update shader uniforms
        if (fabricMat.userData.shader) {
            fabricMat.userData.shader.uniforms.uWaveMap.value = waveTexture;
            fabricMat.userData.shader.uniforms.uTime.value = t;
        }

        // 10.4 — Gentle idle animation for the letter
        const floatAmp = (1 - scrollProgress) * 0.08;
        letterP.position.y = Math.sin(t * 1.2) * floatAmp + 0.1;
        letterP.rotation.y = Math.sin(t * 0.7) * 0.08 * (1 - scrollProgress);
        letterP.rotation.x = Math.cos(t * 0.5) * 0.03 * (1 - scrollProgress);

        // 10.5 — Scroll: letter moves up and shrinks toward logo position
        const logoTargetPos = new THREE.Vector3(-3.5, 2.5, 0);
        const logoScale = 0.22;

        if (scrollProgress > 0) {
            letterP.position.x = THREE.MathUtils.lerp(0, logoTargetPos.x, scrollProgress);
            letterP.position.y = THREE.MathUtils.lerp(
                Math.sin(t * 1.2) * floatAmp + 0.1,
                logoTargetPos.y,
                scrollProgress
            );
            const sc = THREE.MathUtils.lerp(1, logoScale, scrollProgress);
            letterP.scale.setScalar(sc);
        } else {
            letterP.scale.setScalar(1);
        }

        // 10.6 — Subtle camera parallax
        camera.position.x += (mouse.x * 0.15 - camera.position.x) * 0.04;
        camera.position.y += (mouse.y * 0.1 + 0.3 - camera.position.y) * 0.04;
        camera.lookAt(0, 0, 0);

        renderer.render(scene, camera);
    }

    animate();

    // ═══════════════════════════════════════════════════════════════════
    // 11. RESIZE
    // ═══════════════════════════════════════════════════════════════════

    window.addEventListener('resize', function () {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    console.log('[hero] ✅ Hero Cinematic v4 initialized — Letter P with fabric shader + wave interaction');
})();
