/* ==========================================================================
   HERO CINEMATIC 3D ENGINE v5 — PDF Studio Pro
   
   Crafted with /img2threejs, /impeccable, /motion-design
   - Letter P: Cornflower Denim Fabric with gentle interactive wave displacement
   - Letter D: Warm Golden Sandstone with sculpted Zen dune ridges & sand rake particles
   - Letter F: Crystal Water with swirling caustics, fluid wave ripples & splash droplets
   - Suspended Rope: Vertical 90° on left, natural pendulum sway physics
   - GSAP Scrolltelling: P, D, F scale down & dock into top-left navbar logo
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
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(
        35, window.innerWidth / window.innerHeight, 0.1, 100
    );
    camera.position.set(0, 0, 7.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    container.appendChild(renderer.domElement);

    // ═══════════════════════════════════════════════════════════════════
    // 2. STUDIO LIGHTING — Warm key, soft blue fill, ground shadow
    // ═══════════════════════════════════════════════════════════════════

    scene.add(new THREE.AmbientLight(0xEAEFF6, 0.7));

    const keyLight = new THREE.DirectionalLight(0xFFF6EA, 1.5);
    keyLight.position.set(4.0, 5.5, 4.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.bias = -0.0015;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xB8D4F0, 0.6);
    fillLight.position.set(-4.5, 2.5, 3.5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xD0EEFF, 0.45);
    rimLight.position.set(0, -3, -3);
    scene.add(rimLight);

    scene.add(new THREE.HemisphereLight(0xF0F4FF, 0xD4DAE8, 0.45));

    // Ground plane for realistic contact shadows
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(28, 28),
        new THREE.ShadowMaterial({ opacity: 0.12 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.2;
    ground.receiveShadow = true;
    scene.add(ground);

    // ═══════════════════════════════════════════════════════════════════
    // 3. TEXTURES: DENIM (P), SAND (D), WATER (F)
    // ═══════════════════════════════════════════════════════════════════

    // 3.1 Denim Twill Texture for P
    function createDenimTexture(size) {
        var canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');

        ctx.fillStyle = '#6B9FCC';
        ctx.fillRect(0, 0, size, size);

        ctx.globalAlpha = 0.06;
        ctx.strokeStyle = '#5585B0';
        ctx.lineWidth = 1;
        var step = 3;
        for (var i = -size; i < size * 2; i += step) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + size, size); ctx.stroke();
        }
        ctx.globalAlpha = 0.03;
        ctx.strokeStyle = '#7AAFD8';
        for (var j = -size; j < size * 2; j += step * 2) {
            ctx.beginPath(); ctx.moveTo(j + size, 0); ctx.lineTo(j, size); ctx.stroke();
        }

        ctx.globalAlpha = 0.025;
        for (var k = 0; k < 80; k++) {
            var gx = Math.random() * size, gy = Math.random() * size, gr = 10 + Math.random() * 30;
            var grd = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
            grd.addColorStop(0, Math.random() > 0.5 ? '#8CC0E8' : '#4A7098');
            grd.addColorStop(1, 'transparent');
            ctx.fillStyle = grd;
            ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
        }

        var tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(4, 4);
        return tex;
    }

    // 3.2 Golden Sandstone Texture for D (Matching reference: sculpted wavy Zen ridges)
    function createSandTexture(size) {
        var canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');

        ctx.fillStyle = '#C99E44';
        ctx.fillRect(0, 0, size, size);

        var imgData = ctx.getImageData(0, 0, size, size);
        var d = imgData.data;

        for (var y = 0; y < size; y++) {
            var ny = (y / size) * 2.0 - 1.0;
            for (var x = 0; x < size; x++) {
                var nx = (x / size) * 2.0 - 1.0;
                var idx = (y * size + x) * 4;

                var warp = Math.sin(ny * 4.2 + Math.sin(nx * 3.5) * 1.5) * 0.35 
                         + Math.cos(nx * 4.5 - ny * 2.5) * 0.22;
                var dist = Math.sqrt(nx * nx * 0.85 + ny * ny * 0.7);

                var dune1 = Math.sin((dist + warp) * 16.0);
                var dune2 = Math.sin((ny + warp * 0.8) * 24.0 + Math.sin(nx * 8.0) * 0.8) * 0.45;
                var ridge = Math.pow(Math.max(0.0, (dune1 + 1.0) * 0.5), 1.6) - 0.45 + dune2 * 0.25;

                var grain = (Math.random() - 0.5) * 24;

                var r = 206 + ridge * 48 + grain;
                var g = 162 + ridge * 38 + grain * 0.85;
                var b = 74 + ridge * 20 + grain * 0.6;

                if (ridge < -0.08) {
                    r -= 28; g -= 24; b -= 16;
                }

                d[idx]     = Math.min(255, Math.max(0, r));
                d[idx + 1] = Math.min(255, Math.max(0, g));
                d[idx + 2] = Math.min(255, Math.max(0, b));
                d[idx + 3] = 255;
            }
        }
        ctx.putImageData(imgData, 0, 0);

        ctx.globalAlpha = 0.45;
        ctx.fillStyle = '#FFF8E4';
        for (var s = 0; s < 350; s++) {
            ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5);
        }

        var tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(1.5, 1.5);
        return tex;
    }

    // 3.3 Crystal Water Texture for F (Matching reference: swirling liquid vortex & caustics)
    function createWaterTexture(size) {
        var canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');

        // Deep aqua base
        ctx.fillStyle = '#65C2EE';
        ctx.fillRect(0, 0, size, size);

        var imgData = ctx.getImageData(0, 0, size, size);
        var d = imgData.data;

        for (var y = 0; y < size; y++) {
            var ny = (y / size) * 2.0 - 1.0;
            for (var x = 0; x < size; x++) {
                var nx = (x / size) * 2.0 - 1.0;
                var idx = (y * size + x) * 4;

                // Swirling vortex fluid flow
                var angle = Math.atan2(ny, nx);
                var radius = Math.sqrt(nx * nx + ny * ny);
                var flow = Math.sin(radius * 18.0 - angle * 3.5 + Math.sin(ny * 5.0) * 1.8);
                var fineCaustic = Math.sin(nx * 26.0 + ny * 22.0 + flow * 2.0) * 0.4;
                var intensity = flow * 0.65 + fineCaustic * 0.35;

                // Aqua color spectrum with caustic white highlights and deep blue depths
                var r = 100 + intensity * 85;
                var g = 190 + intensity * 60;
                var b = 238 + intensity * 18;

                if (intensity > 0.55) {
                    // Brilliant caustic flash
                    r += 60; g += 50; b += 20;
                } else if (intensity < -0.3) {
                    // Deep liquid absorption
                    r -= 40; g -= 35; b -= 25;
                }

                d[idx]     = Math.min(255, Math.max(0, r));
                d[idx + 1] = Math.min(255, Math.max(0, g));
                d[idx + 2] = Math.min(255, Math.max(0, b));
                d[idx + 3] = 255;
            }
        }
        ctx.putImageData(imgData, 0, 0);

        // Caustic ripple gleams
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#FFFFFF';
        for (var w = 0; w < 120; w++) {
            var cx = Math.random() * size, cy = Math.random() * size;
            ctx.beginPath();
            ctx.arc(cx, cy, 1.5 + Math.random() * 3.5, 0, Math.PI * 2);
            ctx.fill();
        }

        var tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(1.5, 1.5);
        return tex;
    }

    // 3.4 Authentic Manila / Sisal Fiber Texture for 3-Strand Hawser Rope
    function createManilaFiberTexture(size) {
        var canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');

        // Warm dry Manila hemp / sisal tone matching reference image
        ctx.fillStyle = '#B49762';
        ctx.fillRect(0, 0, size, size);

        var imgData = ctx.getImageData(0, 0, size, size);
        var d = imgData.data;

        for (var y = 0; y < size; y++) {
            var ny = y / size;
            for (var x = 0; x < size; x++) {
                var nx = x / size;
                var idx = (y * size + x) * 4;

                // Fine directional sisal fibers along the length of each strand
                var fiber1 = Math.sin(nx * 80.0 * Math.PI + Math.sin(ny * 20.0) * 2.0) * 0.25;
                var fiber2 = Math.sin(nx * 140.0 * Math.PI) * 0.15;
                var fiberTotal = fiber1 + fiber2;

                // Micro-fiber fuzz and natural color variation
                var fuzz = (Math.random() - 0.5) * 28;

                // Natural straw / khaki-tan palette
                var r = 180 + fiberTotal * 45 + fuzz;
                var g = 151 + fiberTotal * 38 + fuzz * 0.85;
                var b = 98 + fiberTotal * 24 + fuzz * 0.6;

                // Subtle darker fiber strands interspersed
                if (Math.sin(nx * 32.0 * Math.PI) > 0.7) {
                    r -= 22; g -= 18; b -= 12;
                }

                d[idx]     = Math.min(255, Math.max(0, r));
                d[idx + 1] = Math.min(255, Math.max(0, g));
                d[idx + 2] = Math.min(255, Math.max(0, b));
                d[idx + 3] = 255;
            }
        }
        ctx.putImageData(imgData, 0, 0);

        // Dry straw flecks
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#DFCCA2';
        for (var s = 0; s < 400; s++) {
            var fx = Math.random() * size, fy = Math.random() * size;
            ctx.fillRect(fx, fy, 1.5, 3.0);
        }

        var tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(1, 8);
        return tex;
    }

    function createManilaFiberBump(size) {
        var canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');

        var imgData = ctx.getImageData(0, 0, size, size);
        var d = imgData.data;

        for (var y = 0; y < size; y++) {
            var ny = y / size;
            for (var x = 0; x < size; x++) {
                var nx = x / size;
                var idx = (y * size + x) * 4;

                var fiber = Math.sin(nx * 80.0 * Math.PI + Math.sin(ny * 20.0) * 2.0) * 0.35 + Math.sin(nx * 140.0 * Math.PI) * 0.2;
                var grain = (Math.random() - 0.5) * 0.2;
                var bump = Math.min(255, Math.max(0, Math.floor((fiber * 0.5 + 0.5 + grain) * 255)));

                d[idx] = bump;
                d[idx + 1] = bump;
                d[idx + 2] = bump;
                d[idx + 3] = 255;
            }
        }
        ctx.putImageData(imgData, 0, 0);

        var tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(1, 8);
        return tex;
    }

    // ═══════════════════════════════════════════════════════════════════
    // 4. INTERACTIVE SIMULATIONS: P (FABRIC), D (SAND), F (WATER)
    // ═══════════════════════════════════════════════════════════════════

    // 4.1 Fabric Simulation for P
    const WAVE_RES = 256;
    const waveData = new Float32Array(WAVE_RES * WAVE_RES);
    const wavePrev = new Float32Array(WAVE_RES * WAVE_RES);
    const waveRGBA = new Uint8Array(WAVE_RES * WAVE_RES * 4);
    for (let wi = 0; wi < WAVE_RES * WAVE_RES; wi++) {
        waveRGBA[wi * 4] = 128; waveRGBA[wi * 4 + 1] = 128; waveRGBA[wi * 4 + 2] = 128; waveRGBA[wi * 4 + 3] = 255;
    }
    const waveTexture = new THREE.DataTexture(waveRGBA, WAVE_RES, WAVE_RES, THREE.RGBAFormat);
    waveTexture.needsUpdate = true;

    function stepFabricWave() {
        var temp = new Float32Array(WAVE_RES * WAVE_RES);
        for (var y = 1; y < WAVE_RES - 1; y++) {
            for (var x = 1; x < WAVE_RES - 1; x++) {
                var idx = y * WAVE_RES + x;
                var lap = waveData[(y - 1) * WAVE_RES + x] + waveData[(y + 1) * WAVE_RES + x] +
                    waveData[y * WAVE_RES + (x - 1)] + waveData[y * WAVE_RES + (x + 1)] - 4 * waveData[idx];
                temp[idx] = (2 * waveData[idx] - wavePrev[idx] + 0.38 * lap) * 0.97;
            }
        }
        for (var i = 0; i < WAVE_RES * WAVE_RES; i++) {
            wavePrev[i] = waveData[i]; waveData[i] = temp[i];
            var v = Math.max(0, Math.min(255, 128 + waveData[i] * 128));
            waveRGBA[i * 4] = v; waveRGBA[i * 4 + 1] = v; waveRGBA[i * 4 + 2] = v; waveRGBA[i * 4 + 3] = 255;
        }
        waveTexture.needsUpdate = true;
    }

    function addFabricTouch(uvX, uvY, radius, strength) {
        var cx = Math.floor(uvX * WAVE_RES), cy = Math.floor(uvY * WAVE_RES), r = Math.floor(radius * WAVE_RES);
        for (var dy = -r; dy <= r; dy++) {
            for (var dx = -r; dx <= r; dx++) {
                var px = cx + dx, py = cy + dy;
                if (px < 0 || px >= WAVE_RES || py < 0 || py >= WAVE_RES) continue;
                var dist = Math.sqrt(dx * dx + dy * dy) / r;
                if (dist > 1) continue;
                waveData[py * WAVE_RES + px] += strength * (1 - dist * dist);
            }
        }
    }

    // 4.2 Sand Simulation for D
    const SAND_RES = 256;
    const sandGrid = new Float32Array(SAND_RES * SAND_RES);
    const sandRGBA = new Uint8Array(SAND_RES * SAND_RES * 4);
    for (let si = 0; si < SAND_RES * SAND_RES; si++) {
        sandRGBA[si * 4] = 128; sandRGBA[si * 4 + 1] = 128; sandRGBA[si * 4 + 2] = 128; sandRGBA[si * 4 + 3] = 255;
    }
    const sandTexture = new THREE.DataTexture(sandRGBA, SAND_RES, SAND_RES, THREE.RGBAFormat);
    sandTexture.needsUpdate = true;

    function stepSandSimulation() {
        var needsUpdate = false;
        for (var i = 0; i < SAND_RES * SAND_RES; i++) {
            if (Math.abs(sandGrid[i]) > 0.002) {
                sandGrid[i] *= 0.985;
                needsUpdate = true;
            } else {
                sandGrid[i] = 0;
            }
            var v = Math.max(0, Math.min(255, 128 + sandGrid[i] * 128));
            sandRGBA[i * 4] = v; sandRGBA[i * 4 + 1] = v; sandRGBA[i * 4 + 2] = v; sandRGBA[i * 4 + 3] = 255;
        }
        if (needsUpdate) sandTexture.needsUpdate = true;
    }

    function addSandTouch(uvX, uvY, radius, depth) {
        var cx = Math.floor(uvX * SAND_RES), cy = Math.floor(uvY * SAND_RES), r = Math.floor(radius * SAND_RES);
        for (var dy = -r * 1.5; dy <= r * 1.5; dy++) {
            for (var dx = -r * 1.5; dx <= r * 1.5; dx++) {
                var px = cx + dx, py = cy + dy;
                if (px < 0 || px >= SAND_RES || py < 0 || py >= SAND_RES) continue;
                var dist = Math.sqrt(dx * dx + dy * dy) / r;
                if (dist > 1.4) continue;
                var profile = (dist < 0.7) ? -depth * (1.0 - dist / 0.7) : (depth * 0.45 * (1.0 - Math.abs(dist - 1.0) / 0.4));
                sandGrid[py * SAND_RES + px] = Math.max(-1.0, Math.min(1.0, sandGrid[py * SAND_RES + px] + profile));
            }
        }
        sandTexture.needsUpdate = true;
    }

    // 4.3 Fluid Water Ripple Simulation for F
    const WATER_RES = 256;
    const waterData = new Float32Array(WATER_RES * WATER_RES);
    const waterPrev = new Float32Array(WATER_RES * WATER_RES);
    const waterRGBA = new Uint8Array(WATER_RES * WATER_RES * 4);
    for (let wi = 0; wi < WATER_RES * WATER_RES; wi++) {
        waterRGBA[wi * 4] = 128; waterRGBA[wi * 4 + 1] = 128; waterRGBA[wi * 4 + 2] = 128; waterRGBA[wi * 4 + 3] = 255;
    }
    const waterTexture = new THREE.DataTexture(waterRGBA, WATER_RES, WATER_RES, THREE.RGBAFormat);
    waterTexture.needsUpdate = true;

    function stepWaterSimulation() {
        var temp = new Float32Array(WATER_RES * WATER_RES);
        for (var y = 1; y < WATER_RES - 1; y++) {
            for (var x = 1; x < WATER_RES - 1; x++) {
                var idx = y * WATER_RES + x;
                var lap = waterData[(y - 1) * WATER_RES + x] + waterData[(y + 1) * WATER_RES + x] +
                    waterData[y * WATER_RES + (x - 1)] + waterData[y * WATER_RES + (x + 1)] - 4 * waterData[idx];
                temp[idx] = (2 * waterData[idx] - waterPrev[idx] + 0.42 * lap) * 0.98;
            }
        }
        for (var i = 0; i < WATER_RES * WATER_RES; i++) {
            waterPrev[i] = waterData[i]; waterData[i] = temp[i];
            var v = Math.max(0, Math.min(255, 128 + waterData[i] * 128));
            waterRGBA[i * 4] = v; waterRGBA[i * 4 + 1] = v; waterRGBA[i * 4 + 2] = v; waterRGBA[i * 4 + 3] = 255;
        }
        waterTexture.needsUpdate = true;
    }

    function addWaterTouch(uvX, uvY, radius, strength) {
        var cx = Math.floor(uvX * WATER_RES), cy = Math.floor(uvY * WATER_RES), r = Math.floor(radius * WATER_RES);
        for (var dy = -r; dy <= r; dy++) {
            for (var dx = -r; dx <= r; dx++) {
                var px = cx + dx, py = cy + dy;
                if (px < 0 || px >= WATER_RES || py < 0 || py >= WATER_RES) continue;
                var dist = Math.sqrt(dx * dx + dy * dy) / r;
                if (dist > 1) continue;
                waterData[py * WATER_RES + px] += strength * (1 - dist * dist);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 5. SHADERS: FABRIC (P), SAND (D), WATER (F)
    // ═══════════════════════════════════════════════════════════════════

    // 5.1 Fabric Material for P
    const denimTex = createDenimTexture(512);
    const fabricMat = new THREE.MeshStandardMaterial({
        map: denimTex,
        color: 0x6B9FCC,
        roughness: 0.82,
        metalness: 0.0
    });

    fabricMat.onBeforeCompile = function (shader) {
        shader.uniforms.uWaveMap = { value: waveTexture };
        shader.uniforms.uTime = { value: 0.0 };
        shader.uniforms.uWaveStrength = { value: 0.012 };
        fabricMat._shader = shader;

        shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            [
                '#include <common>',
                'varying vec2 vCustomUV;',
                'uniform sampler2D uWaveMap;',
                'uniform float uTime;',
                'uniform float uWaveStrength;',
                '',
                'float fbNoise(vec3 p) {',
                '  vec3 i = floor(p); vec3 f = fract(p);',
                '  f = f * f * (3.0 - 2.0 * f);',
                '  float n = dot(i, vec3(1.0, 57.0, 113.0));',
                '  return mix(mix(mix(fract(sin(n)*43758.5453), fract(sin(n+1.0)*43758.5453), f.x),',
                '                 mix(fract(sin(n+57.0)*43758.5453), fract(sin(n+58.0)*43758.5453), f.x), f.y),',
                '             mix(mix(fract(sin(n+113.0)*43758.5453), fract(sin(n+114.0)*43758.5453), f.x),',
                '                 mix(fract(sin(n+170.0)*43758.5453), fract(sin(n+171.0)*43758.5453), f.x), f.y), f.z);',
                '}'
            ].join('\n')
        );

        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            [
                '#include <begin_vertex>',
                'vCustomUV = uv;',
                'vec2 wUV = uv;',
                'float waveSample = texture2D(uWaveMap, wUV).r;',
                'float waveDisp = (waveSample - 0.5) * 2.0 * uWaveStrength;',
                'float ridges = 0.0;',
                'ridges += fbNoise(position * 1.8 + vec3(0.0, uTime * 0.015, 0.0)) * 0.006;',
                'ridges += fbNoise(position * 3.5 + vec3(uTime * 0.008, 0.0, 0.0)) * 0.003;',
                'ridges += fbNoise(position * 7.0) * 0.0015;',
                'float totalDisp = clamp(waveDisp + ridges, -0.04, 0.04);',
                'transformed += normal * totalDisp;'
            ].join('\n')
        );

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            [
                '#include <common>',
                'varying vec2 vCustomUV;',
                'uniform sampler2D uWaveMap;'
            ].join('\n')
        );

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            [
                'vec4 wFrag = texture2D(uWaveMap, vCustomUV);',
                'float wShade = (wFrag.r - 0.5) * 0.04;',
                'gl_FragColor.rgb += wShade;',
                'gl_FragColor.rgb *= 1.0 + sin((vCustomUV.x + vCustomUV.y) * 80.0) * 0.003;',
                '#include <dithering_fragment>'
            ].join('\n')
        );
    };

    // 5.2 Sand Material for D
    const sandTex = createSandTexture(512);
    const sandMat = new THREE.MeshStandardMaterial({
        map: sandTex,
        color: 0xD4B062,
        roughness: 0.94,
        metalness: 0.0
    });

    sandMat.onBeforeCompile = function (shader) {
        shader.uniforms.uSandMap = { value: sandTexture };
        shader.uniforms.uTime = { value: 0.0 };
        shader.uniforms.uSandStrength = { value: 0.024 };
        sandMat._shader = shader;

        shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            [
                '#include <common>',
                'varying vec2 vCustomUV;',
                'uniform sampler2D uSandMap;',
                'uniform float uTime;',
                'uniform float uSandStrength;',
                '',
                'float sdNoise(vec3 p) {',
                '  vec3 i = floor(p); vec3 f = fract(p);',
                '  f = f * f * (3.0 - 2.0 * f);',
                '  float n = dot(i, vec3(1.0, 57.0, 113.0));',
                '  return mix(mix(mix(fract(sin(n)*43758.5453), fract(sin(n+1.0)*43758.5453), f.x),',
                '                 mix(fract(sin(n+57.0)*43758.5453), fract(sin(n+58.0)*43758.5453), f.x), f.y),',
                '             mix(mix(fract(sin(n+113.0)*43758.5453), fract(sin(n+114.0)*43758.5453), f.x),',
                '                 mix(fract(sin(n+170.0)*43758.5453), fract(sin(n+171.0)*43758.5453), f.x), f.y), f.z);',
                '}'
            ].join('\n')
        );

        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            [
                '#include <begin_vertex>',
                'vCustomUV = uv;',
                'vec2 sUV = uv;',
                'float sandSample = texture2D(uSandMap, sUV).r;',
                'float sandFurrow = (sandSample - 0.5) * 2.0 * uSandStrength;',
                'float frontFactor = smoothstep(0.2, 0.75, normal.z);',
                'vec2 sp = position.xy;',
                'float pWarp = sin(sp.y * 3.8 + sin(sp.x * 3.2) * 1.4) * 0.32 + cos(sp.x * 4.2 - sp.y * 2.2) * 0.22;',
                'float dLoop = length(vec2(sp.x * 0.9, sp.y * 0.75));',
                'float primaryDune = sin((dLoop + pWarp) * 14.0);',
                'float fineDune = sin((sp.y + pWarp * 0.8) * 22.0) * 0.4;',
                'float duneHeight = (pow(max(0.0, (primaryDune + 1.0) * 0.5), 1.6) - 0.28) * 0.032 + fineDune * 0.009;',
                'float microSand = sdNoise(position * 20.0) * 0.004;',
                'float totalSand = clamp(sandFurrow + (duneHeight + microSand) * frontFactor, -0.045, 0.05);',
                'transformed += normal * totalSand;'
            ].join('\n')
        );

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            [
                '#include <common>',
                'varying vec2 vCustomUV;',
                'uniform sampler2D uSandMap;'
            ].join('\n')
        );

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            [
                'vec4 sFrag = texture2D(uSandMap, vCustomUV);',
                'float sDepth = (sFrag.r - 0.5);',
                'gl_FragColor.rgb += vec3(0.06, 0.035, -0.02) * sDepth;',
                'gl_FragColor.rgb *= 1.0 + sin((vCustomUV.x * 70.0 + vCustomUV.y * 50.0)) * 0.006;',
                '#include <dithering_fragment>'
            ].join('\n')
        );
    };

    // 5.3 Crystal Water Material for F (Matching reference: swirling liquid vortex & caustics)
    const waterTex = createWaterTexture(512);
    const waterMat = new THREE.MeshStandardMaterial({
        map: waterTex,
        color: 0x90E2FC,
        roughness: 0.1,
        metalness: 0.12,
        transparent: true,
        opacity: 0.86,
        side: THREE.FrontSide
    });

    waterMat.onBeforeCompile = function (shader) {
        shader.uniforms.uWaterMap = { value: waterTexture };
        shader.uniforms.uTime = { value: 0.0 };
        shader.uniforms.uWaterStrength = { value: 0.028 };
        waterMat._shader = shader;

        shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            [
                '#include <common>',
                'varying vec2 vCustomUV;',
                'varying vec3 vCustomNormal;',
                'uniform sampler2D uWaterMap;',
                'uniform float uTime;',
                'uniform float uWaterStrength;',
                '',
                'float wtNoise(vec3 p) {',
                '  vec3 i = floor(p); vec3 f = fract(p);',
                '  f = f * f * (3.0 - 2.0 * f);',
                '  float n = dot(i, vec3(1.0, 57.0, 113.0));',
                '  return mix(mix(mix(fract(sin(n)*43758.5453), fract(sin(n+1.0)*43758.5453), f.x),',
                '                 mix(fract(sin(n+57.0)*43758.5453), fract(sin(n+58.0)*43758.5453), f.x), f.y),',
                '             mix(mix(fract(sin(n+113.0)*43758.5453), fract(sin(n+114.0)*43758.5453), f.x),',
                '                 mix(fract(sin(n+170.0)*43758.5453), fract(sin(n+171.0)*43758.5453), f.x), f.y), f.z);',
                '}'
            ].join('\n')
        );

        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            [
                '#include <begin_vertex>',
                'vCustomUV = uv;',
                'vCustomNormal = normal;',
                'vec2 wtUV = uv;',
                'float waterSample = texture2D(uWaterMap, wtUV).r;',
                'float rippleDisp = (waterSample - 0.5) * 2.0 * uWaterStrength;',
                '',
                '// Continuous fluid vortex surface current flow',
                'vec2 fp = position.xy;',
                'float swirl = sin(length(fp) * 8.0 - uTime * 1.8 + atan(fp.y, fp.x) * 2.0) * 0.015;',
                'float flowStream = wtNoise(position * 3.0 + vec3(0.0, uTime * 0.1, 0.0)) * 0.012;',
                '',
                'float totalWaterDisp = clamp(rippleDisp + swirl + flowStream, -0.05, 0.05);',
                'transformed += normal * totalWaterDisp;'
            ].join('\n')
        );

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            [
                '#include <common>',
                'varying vec2 vCustomUV;',
                'varying vec3 vCustomNormal;',
                'uniform sampler2D uWaterMap;',
                'uniform float uTime;'
            ].join('\n')
        );

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            [
                'vec4 wtFrag = texture2D(uWaterMap, vCustomUV);',
                'float wtVal = (wtFrag.r - 0.5);',
                '// Liquid refraction caustic shimmer',
                'gl_FragColor.rgb += vec3(0.12, 0.22, 0.35) * wtVal;',
                '// Fresnel water edge highlight',
                'float fresnel = pow(1.0 - abs(dot(vCustomNormal, vec3(0.0, 0.0, 1.0))), 2.2) * 0.35;',
                'gl_FragColor.rgb += vec3(0.2, 0.45, 0.6) * fresnel;',
                '#include <dithering_fragment>'
            ].join('\n')
        );
    };

    // ═══════════════════════════════════════════════════════════════════
    // 6. PARTICLE SYSTEMS: SAND (D) & WATER SPLASHES (F)
    // ═══════════════════════════════════════════════════════════════════

    // 6.1 Sand Grains (D)
    const SAND_PARTICLE_COUNT = 160;
    const sandPositions = new Float32Array(SAND_PARTICLE_COUNT * 3);
    const sandVelocities = [];
    const sandLifetimes = new Float32Array(SAND_PARTICLE_COUNT);

    for (let i = 0; i < SAND_PARTICLE_COUNT; i++) {
        sandPositions[i * 3] = 0; sandPositions[i * 3 + 1] = -100; sandPositions[i * 3 + 2] = 0;
        sandVelocities.push(new THREE.Vector3());
        sandLifetimes[i] = 0;
    }

    const sandGeo = new THREE.BufferGeometry();
    sandGeo.setAttribute('position', new THREE.BufferAttribute(sandPositions, 3));
    const sandPointsMat = new THREE.PointsMaterial({
        color: 0xFAD070, size: 0.065, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false
    });
    const sandPoints = new THREE.Points(sandGeo, sandPointsMat);
    scene.add(sandPoints);

    function emitSandGrains(worldX, worldY, worldZ) {
        const pos = sandGeo.attributes.position.array;
        for (let k = 0; k < 6; k++) {
            const idx = Math.floor(Math.random() * SAND_PARTICLE_COUNT);
            pos[idx * 3] = worldX + (Math.random() - 0.5) * 0.15;
            pos[idx * 3 + 1] = worldY + (Math.random() - 0.5) * 0.15;
            pos[idx * 3 + 2] = worldZ + (Math.random() - 0.5) * 0.1;

            sandVelocities[idx].set(
                (Math.random() - 0.5) * 0.03,
                0.015 + Math.random() * 0.025,
                (Math.random() - 0.5) * 0.03
            );
            sandLifetimes[idx] = 1.0;
        }
        sandGeo.attributes.position.needsUpdate = true;
    }

    // 6.2 Water Splash Droplets (F)
    const WATER_PARTICLE_COUNT = 180;
    const waterPositions = new Float32Array(WATER_PARTICLE_COUNT * 3);
    const waterVelocities = [];
    const waterLifetimes = new Float32Array(WATER_PARTICLE_COUNT);

    for (let j = 0; j < WATER_PARTICLE_COUNT; j++) {
        waterPositions[j * 3] = 0; waterPositions[j * 3 + 1] = -100; waterPositions[j * 3 + 2] = 0;
        waterVelocities.push(new THREE.Vector3());
        waterLifetimes[j] = 0;
    }

    const waterParticlesGeo = new THREE.BufferGeometry();
    waterParticlesGeo.setAttribute('position', new THREE.BufferAttribute(waterPositions, 3));
    const waterParticlesMat = new THREE.PointsMaterial({
        color: 0xA8EFFF, size: 0.075, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false
    });
    const waterPoints = new THREE.Points(waterParticlesGeo, waterParticlesMat);
    scene.add(waterPoints);

    function emitWaterSplashes(worldX, worldY, worldZ) {
        const pos = waterParticlesGeo.attributes.position.array;
        for (let k = 0; k < 8; k++) {
            const idx = Math.floor(Math.random() * WATER_PARTICLE_COUNT);
            pos[idx * 3] = worldX + (Math.random() - 0.5) * 0.2;
            pos[idx * 3 + 1] = worldY + (Math.random() - 0.5) * 0.2;
            pos[idx * 3 + 2] = worldZ + (Math.random() - 0.5) * 0.12;

            waterVelocities[idx].set(
                (Math.random() - 0.5) * 0.045,
                0.025 + Math.random() * 0.035,
                (Math.random() - 0.5) * 0.045
            );
            waterLifetimes[idx] = 1.0;
        }
        waterParticlesGeo.attributes.position.needsUpdate = true;
    }

    // ═══════════════════════════════════════════════════════════════════
    // 7. SUSPENDED 3-STRAND MANILA HAWSER ROPE (1:1 Match Reference Image)
    // ═══════════════════════════════════════════════════════════════════

    const ropeGroup = new THREE.Group();
    scene.add(ropeGroup);

    let ROPE_X = -5.05;
    let initialLetterScale = 1.0;
    let initialPosX_P = -2.55;
    let initialPosX_D = 0.0;
    let initialPosX_F = 2.55;
    let dockPosX_P = -4.72;
    let dockPosX_D = -4.50;
    let dockPosX_F = -4.28;
    let dockPosY = 2.19;
    let logoScale = 0.095;

    const ROPE_TOP_Y = 4.2;
    const ROPE_BOT_Y = -3.2;
    const ROPE_NODES = 45;
    const ropeNodes = [];
    const ropeRestDistance = (ROPE_TOP_Y - ROPE_BOT_Y) / (ROPE_NODES - 1);

    for (let ri = 0; ri < ROPE_NODES; ri++) {
        const rt = ri / (ROPE_NODES - 1);
        const ry = THREE.MathUtils.lerp(ROPE_TOP_Y, ROPE_BOT_Y, rt);
        ropeNodes.push({
            pos: new THREE.Vector3(ROPE_X, ry, 0),
            oldPos: new THREE.Vector3(ROPE_X, ry, 0),
            basePos: new THREE.Vector3(ROPE_X, ry, 0),
            weight: 0.15 + rt * 0.85
        });
    }

    function updateResponsiveLayout() {
        const aspect = window.innerWidth / Math.max(1, window.innerHeight);
        const visibleHeight = 2.0 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
        const visibleWidth = visibleHeight * aspect;

        if (window.innerWidth <= 768) {
            initialLetterScale = Math.min(0.55, Math.max(0.36, (visibleWidth * 0.70) / 5.2));
            const spacing = Math.min(1.05, (visibleWidth * 0.30));
            initialPosX_P = -spacing;
            initialPosX_D = 0.0;
            initialPosX_F = spacing;

            ROPE_X = - (visibleWidth / 2) + 0.22;

            dockPosY = (visibleHeight / 2) - 0.30;
            dockPosX_P = - (visibleWidth / 2) + 0.32;
            dockPosX_D = - (visibleWidth / 2) + 0.46;
            dockPosX_F = - (visibleWidth / 2) + 0.60;
            logoScale = 0.052;
        } else {
            initialLetterScale = 1.0;
            initialPosX_P = -2.55;
            initialPosX_D = 0.0;
            initialPosX_F = 2.55;

            ROPE_X = -5.05;
            dockPosY = 2.19;
            dockPosX_P = -4.72;
            dockPosX_D = -4.50;
            dockPosX_F = -4.28;
            logoScale = 0.095;
        }

        for (let ri = 0; ri < ROPE_NODES; ri++) {
            ropeNodes[ri].basePos.x = ROPE_X;
            if (!isDraggingRope) {
                ropeNodes[ri].pos.x = THREE.MathUtils.lerp(ropeNodes[ri].pos.x, ROPE_X, 0.4);
            }
        }
        if (typeof topKnot !== 'undefined' && topKnot) topKnot.position.x = ROPE_X;
    }

    const manilaTex = createManilaFiberTexture(512);
    const manilaBump = createManilaFiberBump(512);

    const ropeMat = new THREE.MeshStandardMaterial({
        map: manilaTex,
        bumpMap: manilaBump,
        bumpScale: 0.05,
        color: 0xBFAC7E,
        roughness: 0.90,
        metalness: 0.0
    });

    // 3 Individual Meshes for the 3 Helical Hawser Strands
    const STRAND_RADIUS = 0.046;
    const STRAND_OFFSET = 0.036;
    const TWIST_TURNS = 22; // Tight hawser twist pitch matching reference photo

    const strandMeshes = [];
    for (let k = 0; k < 3; k++) {
        const sm = new THREE.Mesh(new THREE.BufferGeometry(), ropeMat);
        sm.castShadow = true;
        sm.receiveShadow = true;
        ropeGroup.add(sm);
        strandMeshes.push(sm);
    }

    // Sailor's Stopper Knots (Barrel Knots at ends, matching reference)
    function createStopperKnot(yPos) {
        const knotGroup = new THREE.Group();
        knotGroup.position.set(ROPE_X, yPos, 0);
        for (let w = 0; w < 3; w++) {
            const wrapGeo = new THREE.TorusGeometry(0.10, 0.042, 10, 20);
            const wrapMesh = new THREE.Mesh(wrapGeo, ropeMat);
            wrapMesh.position.set(0, (w - 1) * 0.065, 0);
            wrapMesh.rotation.x = Math.PI / 2 + (w - 1) * 0.12;
            wrapMesh.rotation.z = w * 0.8;
            wrapMesh.castShadow = true;
            knotGroup.add(wrapMesh);
        }
        ropeGroup.add(knotGroup);
        return knotGroup;
    }

    const topKnot = createStopperKnot(ROPE_TOP_Y);
    const bottomKnot = createStopperKnot(ROPE_BOT_Y);

    let prevMousePhysics = new THREE.Vector3(0, 0, 0);

    // ═══════════════════════════════════════════════════════════════════
    // 8. ASSEMBLE LETTERS P, D, F (Synchronous High-Precision Geometry)
    // ═══════════════════════════════════════════════════════════════════

    function createGeometryP() {
        const s = new THREE.Shape();
        s.moveTo(-0.9, -1.35);
        s.lineTo(-0.9, 1.35);
        s.lineTo(0.3, 1.35);
        s.bezierCurveTo(1.25, 1.35, 1.25, 0.05, 0.3, 0.05);
        s.lineTo(-0.15, 0.05);
        s.lineTo(-0.15, -1.35);
        s.closePath();

        const hole = new THREE.Path();
        hole.moveTo(-0.15, 0.95);
        hole.lineTo(-0.15, 0.45);
        hole.lineTo(0.2, 0.45);
        hole.bezierCurveTo(0.65, 0.45, 0.65, 0.95, 0.2, 0.95);
        hole.closePath();
        s.holes.push(hole);

        const geo = new THREE.ExtrudeGeometry(s, {
            depth: 0.58, bevelEnabled: true, bevelSegments: 6, steps: 1, bevelSize: 0.07, bevelThickness: 0.07
        });
        geo.center();
        geo.computeVertexNormals();
        return geo;
    }

    function createGeometryD() {
        const s = new THREE.Shape();
        s.moveTo(-0.85, -1.35);
        s.lineTo(-0.85, 1.35);
        s.lineTo(0.05, 1.35);
        s.bezierCurveTo(1.35, 1.35, 1.35, -1.35, 0.05, -1.35);
        s.closePath();

        const hole = new THREE.Path();
        hole.moveTo(-0.15, 0.75);
        hole.lineTo(-0.15, -0.75);
        hole.lineTo(0.05, -0.75);
        hole.bezierCurveTo(0.7, -0.75, 0.7, 0.75, 0.05, 0.75);
        hole.closePath();
        s.holes.push(hole);

        const geo = new THREE.ExtrudeGeometry(s, {
            depth: 0.58, bevelEnabled: true, bevelSegments: 6, steps: 1, bevelSize: 0.07, bevelThickness: 0.07
        });
        geo.center();
        geo.computeVertexNormals();
        return geo;
    }

    function createGeometryF() {
        const s = new THREE.Shape();
        s.moveTo(-0.85, -1.35);
        s.lineTo(-0.85, 1.35);
        s.lineTo(1.15, 1.35);
        s.bezierCurveTo(1.35, 1.35, 1.35, 0.75, 1.15, 0.75);
        s.lineTo(-0.15, 0.75);
        s.lineTo(-0.15, 0.15);
        s.lineTo(0.9, 0.15);
        s.bezierCurveTo(1.1, 0.15, 1.1, -0.45, 0.9, -0.45);
        s.lineTo(-0.15, -0.45);
        s.lineTo(-0.15, -1.35);
        s.closePath();

        const geo = new THREE.ExtrudeGeometry(s, {
            depth: 0.58, bevelEnabled: true, bevelSegments: 6, steps: 1, bevelSize: 0.07, bevelThickness: 0.07
        });
        geo.center();
        geo.computeVertexNormals();
        return geo;
    }

    // 1. Build Letter P (Denim Fabric) — Left position
    const geoP = createGeometryP();
    const letterP = new THREE.Mesh(geoP, fabricMat);
    letterP.castShadow = true;
    letterP.receiveShadow = true;
    letterP.position.set(-2.55, 0, 0);
    scene.add(letterP);

    // 2. Build Letter D (Sandstone Dunes) — Center position
    const geoD = createGeometryD();
    const letterD = new THREE.Mesh(geoD, sandMat);
    letterD.castShadow = true;
    letterD.receiveShadow = true;
    letterD.position.set(0.0, 0, 0);
    scene.add(letterD);

    // 3. Build Letter F (Crystal Water) — Right position
    const geoF = createGeometryF();
    const letterF = new THREE.Mesh(geoF, waterMat);
    letterF.castShadow = true;
    letterF.receiveShadow = true;
    letterF.position.set(2.55, 0, 0);
    scene.add(letterF);

    console.log('[hero] ✅ Letters P (denim), D (sand), F (water) synchronously initialized');

    // ═══════════════════════════════════════════════════════════════════
    // 8.5 DUOLINGO PLAYFUL 3D FLOATING ACCENTS (Pure Peripheral Accents)
    // ═══════════════════════════════════════════════════════════════════

    const playfulGroup = new THREE.Group();
    scene.add(playfulGroup);
    playfulGroup.position.set(0, -6.0, 0); // Initially hidden below hero

    const playfulItems = [];

    // 1. Duolingo Green Candy Sphere (Top Right Margin)
    const sphereGeo = new THREE.SphereGeometry(0.32, 28, 28);
    const greenMat = new THREE.MeshStandardMaterial({
        color: 0x58CC02, roughness: 0.15, metalness: 0.18
    });
    const sphereGreen = new THREE.Mesh(sphereGeo, greenMat);
    sphereGreen.castShadow = true;
    sphereGreen.position.set(5.2, 1.8, 1.0);
    playfulGroup.add(sphereGreen);
    playfulItems.push({
        mesh: sphereGreen,
        basePos: new THREE.Vector3(5.2, 1.8, 1.0),
        rotSpeed: 0.6,
        floatSpeed: 0.9,
        floatPhase: 0.2,
        scale: 0.85
    });
    sphereGreen.scale.setScalar(0.85);

    // 2. Sky Blue Rounded Cube (Bottom Right Margin)
    const cubeGeo = new THREE.BoxGeometry(0.42, 0.42, 0.42);
    const blueMat = new THREE.MeshStandardMaterial({
        color: 0x1CB0F6, roughness: 0.20, metalness: 0.12
    });
    const cubeBlue = new THREE.Mesh(cubeGeo, blueMat);
    cubeBlue.castShadow = true;
    cubeBlue.position.set(5.3, -1.9, 1.1);
    playfulGroup.add(cubeBlue);
    playfulItems.push({
        mesh: cubeBlue,
        basePos: new THREE.Vector3(5.3, -1.9, 1.1),
        rotSpeed: -0.8,
        floatSpeed: 0.8,
        floatPhase: 1.4,
        scale: 0.75
    });
    cubeBlue.scale.setScalar(0.75);

    // 3. Golden Star Coin (Top Left Margin)
    const coinGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.07, 24);
    const goldMat = new THREE.MeshStandardMaterial({
        color: 0xFFC800, metalness: 0.82, roughness: 0.22
    });
    const starCoin = new THREE.Mesh(coinGeo, goldMat);
    starCoin.castShadow = true;
    starCoin.position.set(-5.2, 2.0, 1.0);
    starCoin.rotation.x = Math.PI / 2 + 0.3;
    playfulGroup.add(starCoin);
    playfulItems.push({
        mesh: starCoin,
        basePos: new THREE.Vector3(-5.2, 2.0, 1.0),
        rotSpeed: 1.2,
        floatSpeed: 1.0,
        floatPhase: 2.5,
        scale: 0.8
    });
    starCoin.scale.setScalar(0.8);

    // 4. Sunshine Yellow Candy Sphere (Bottom Left Margin)
    const yellowMat = new THREE.MeshStandardMaterial({
        color: 0xFFC800, roughness: 0.15, metalness: 0.18
    });
    const sphereYellow = new THREE.Mesh(sphereGeo, yellowMat);
    sphereYellow.castShadow = true;
    sphereYellow.position.set(-5.25, -2.1, 0.9);
    playfulGroup.add(sphereYellow);
    playfulItems.push({
        mesh: sphereYellow,
        basePos: new THREE.Vector3(-5.25, -2.1, 0.9),
        rotSpeed: -0.5,
        floatSpeed: 0.85,
        floatPhase: 3.8,
        scale: 0.8
    });
    sphereYellow.scale.setScalar(0.8);

    // ═══════════════════════════════════════════════════════════════════
    // 9. MOUSE, RAYCASTER & INTERACTION
    // ═══════════════════════════════════════════════════════════════════
    // 9. POINTER & INTERACTIVE ROPE DRAGGING / SCROLLING
    // ═══════════════════════════════════════════════════════════════════

    const mouse = new THREE.Vector2(0, 0);
    let mouseActive = false;
    const mouseWorld = new THREE.Vector3(0, 0, 0);
    const raycaster = new THREE.Raycaster();
    let lastP_UV = null;
    let lastD_UV = null;
    let lastF_UV = null;

    // Interactive Rope Dragging State
    let isDraggingRope = false;
    let dragStartY = 0;
    let dragStartScrollY = 0;
    let grabbedNodeIndex = -1;
    let isHoveringRope = false;

    function updateMouseWorld(clientX, clientY) {
        mouse.x = (clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(clientY / window.innerHeight) * 2 + 1;

        // Project mouse into 3D world plane at z=0
        const vec = new THREE.Vector3(mouse.x, mouse.y, 0.5);
        vec.unproject(camera);
        const dir = vec.sub(camera.position).normalize();
        const dist = -camera.position.z / dir.z;
        mouseWorld.copy(camera.position).add(dir.multiplyScalar(dist));
    }

    function checkRopeHit(pos3D) {
        const dx = Math.abs(pos3D.x - ROPE_X);
        const dy = pos3D.y;
        return (dx < 1.15 && dy <= (ROPE_TOP_Y + 0.8) && dy >= (ROPE_BOT_Y - 1.2));
    }

    function findClosestRopeNode(pos3D) {
        let minDist = Infinity;
        let idx = 1;
        for (let i = 1; i < ROPE_NODES; i++) {
            const d = ropeNodes[i].pos.distanceTo(pos3D);
            if (d < minDist) {
                minDist = d;
                idx = i;
            }
        }
        return idx;
    }

    function onPointerDown(e) {
        const cx = e.clientX !== undefined ? e.clientX : (e.touches ? e.touches[0].clientX : 0);
        const cy = e.clientY !== undefined ? e.clientY : (e.touches ? e.touches[0].clientY : 0);
        updateMouseWorld(cx, cy);

        if (checkRopeHit(mouseWorld)) {
            isDraggingRope = true;
            dragStartY = cy;
            dragStartScrollY = window.scrollY;
            grabbedNodeIndex = findClosestRopeNode(mouseWorld);

            document.body.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none';

            if (ropeNodes[grabbedNodeIndex]) {
                ropeNodes[grabbedNodeIndex].pos.x = THREE.MathUtils.lerp(ropeNodes[grabbedNodeIndex].pos.x, mouseWorld.x, 0.65);
                ropeNodes[grabbedNodeIndex].pos.y = THREE.MathUtils.lerp(ropeNodes[grabbedNodeIndex].pos.y, mouseWorld.y, 0.65);
            }
        }
    }

    function onPointerMove(e) {
        mouseActive = true;
        const cx = e.clientX !== undefined ? e.clientX : (e.touches ? e.touches[0].clientX : 0);
        const cy = e.clientY !== undefined ? e.clientY : (e.touches ? e.touches[0].clientY : 0);
        updateMouseWorld(cx, cy);

        if (isDraggingRope) {
            const deltaY = cy - dragStartY;
            // Dragging DOWN (deltaY > 0) pulls down and scrolls page down
            // 1 px drag = 2.4 px scroll
            const scrollDelta = deltaY * 2.4;
            const maxScroll = Math.max(0, document.body.scrollHeight - window.innerHeight);
            const targetY = Math.max(0, Math.min(maxScroll, dragStartScrollY + scrollDelta));

            window.scrollTo({
                top: targetY,
                behavior: 'auto'
            });

            if (grabbedNodeIndex >= 1 && grabbedNodeIndex < ROPE_NODES) {
                ropeNodes[grabbedNodeIndex].pos.x = THREE.MathUtils.lerp(ropeNodes[grabbedNodeIndex].pos.x, mouseWorld.x, 0.65);
                ropeNodes[grabbedNodeIndex].pos.y = THREE.MathUtils.lerp(ropeNodes[grabbedNodeIndex].pos.y, mouseWorld.y, 0.65);
            }
        } else {
            const nearRope = checkRopeHit(mouseWorld);
            if (nearRope && !isHoveringRope) {
                isHoveringRope = true;
                document.body.style.cursor = 'grab';
            } else if (!nearRope && isHoveringRope) {
                isHoveringRope = false;
                document.body.style.cursor = '';
            }
        }
    }

    function onPointerUp() {
        if (isDraggingRope) {
            isDraggingRope = false;
            grabbedNodeIndex = -1;
            document.body.style.cursor = isHoveringRope ? 'grab' : '';
            document.body.style.userSelect = '';
        }
    }

    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('mousemove', onPointerMove, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchend', onPointerUp);
    window.addEventListener('mouseleave', onPointerUp);

    // ═══════════════════════════════════════════════════════════════════
    // 10. GSAP SCROLLTELLING (P, D, F dock into top-left navbar logo)
    // ═══════════════════════════════════════════════════════════════════

    let scrollProgress = 0;

    if (window.ScrollTrigger) {
        ScrollTrigger.create({
            trigger: '#heroScrollWrapper',
            start: 'top top',
            end: '+=1400',
            scrub: 1.0,
            onUpdate: function (self) {
                scrollProgress = self.progress;

                // Transparent Clean Navbar reveal (staggers in as letters complete docking)
                const nav = document.getElementById('mainLandingNavbar');
                if (nav) {
                    const navAlpha = Math.max(0, (scrollProgress - 0.35) / 0.30);
                    nav.style.opacity = Math.min(1, navAlpha);
                    nav.style.pointerEvents = navAlpha > 0.6 ? 'all' : 'none';
                    nav.style.transform = 'translateY(' + ((1 - Math.min(1, navAlpha)) * -20) + 'px)';
                    if (scrollProgress > 0.45) {
                        nav.classList.add('is-scrolled');
                    } else {
                        nav.classList.remove('is-scrolled');
                    }
                }

                // Floating hint fade
                const hint = document.getElementById('heroScrollHint');
                if (hint) {
                    hint.style.opacity = Math.max(0, 1 - scrollProgress * 4);
                }

                // Section 2 reveal (pulled up smoothly by the rope)
                const sec2 = document.getElementById('landingSection2');
                if (sec2) {
                    const secAlpha = Math.max(0, (scrollProgress - 0.30) / 0.60);
                    sec2.style.opacity = Math.min(1, secAlpha);
                    sec2.style.transform = 'translateY(' + ((1 - Math.min(1, secAlpha)) * 80) + 'px)';
                }
            }
        });

        window.addEventListener('scroll', function () {
            const nav = document.getElementById('mainLandingNavbar');
            if (nav && window.scrollY > 180) {
                nav.classList.add('is-scrolled');
            } else if (nav && scrollProgress <= 0.45) {
                nav.classList.remove('is-scrolled');
            }
        }, { passive: true });
    }

    // ═══════════════════════════════════════════════════════════════════
    // 11. ANIMATION LOOP
    // ═══════════════════════════════════════════════════════════════════

    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        const dt = Math.min(clock.getDelta(), 0.05);
        const t = clock.getElapsedTime();

        // 11.1 Raycasting against letters P, D, F
        const interactTargets = [];
        if (letterP) interactTargets.push(letterP);
        if (letterD) interactTargets.push(letterD);
        if (letterF) interactTargets.push(letterF);

        if (mouseActive && interactTargets.length > 0) {
            raycaster.setFromCamera(mouse, camera);
            const hits = raycaster.intersectObjects(interactTargets);

            let hitP = false, hitD = false, hitF = false;

            for (let hi = 0; hi < hits.length; hi++) {
                const hit = hits[hi];

                // Hit Letter P (Denim waves)
                if (hit.object === letterP && hit.uv) {
                    hitP = true;
                    addFabricTouch(hit.uv.x, hit.uv.y, 0.045, 0.28);
                    if (lastP_UV) {
                        const dpx = hit.uv.x - lastP_UV.x, dpy = hit.uv.y - lastP_UV.y;
                        const distP = Math.sqrt(dpx * dpx + dpy * dpy);
                        if (distP > 0.005 && distP < 0.25) {
                            const steps = Math.ceil(distP / 0.015);
                            for (let s = 0; s < steps; s++) {
                                const st = s / steps;
                                addFabricTouch(lastP_UV.x + dpx * st, lastP_UV.y + dpy * st, 0.035, 0.18);
                            }
                        }
                    }
                    lastP_UV = { x: hit.uv.x, y: hit.uv.y };
                }

                // Hit Letter D (Sand dunes rake & particles)
                if (hit.object === letterD && hit.uv) {
                    hitD = true;
                    addSandTouch(hit.uv.x, hit.uv.y, 0.05, 0.35);
                    emitSandGrains(hit.point.x, hit.point.y, hit.point.z);

                    if (lastD_UV) {
                        const ddx = hit.uv.x - lastD_UV.x, ddy = hit.uv.y - lastD_UV.y;
                        const distD = Math.sqrt(ddx * ddx + ddy * ddy);
                        if (distD > 0.005 && distD < 0.25) {
                            const stepsD = Math.ceil(distD / 0.015);
                            for (let sd = 0; sd < stepsD; sd++) {
                                const sdt = sd / stepsD;
                                addSandTouch(lastD_UV.x + ddx * sdt, lastD_UV.y + ddy * sdt, 0.04, 0.24);
                            }
                        }
                    }
                    lastD_UV = { x: hit.uv.x, y: hit.uv.y };
                }

                // Hit Letter F (Water ripples & splashes)
                if (hit.object === letterF && hit.uv) {
                    hitF = true;
                    addWaterTouch(hit.uv.x, hit.uv.y, 0.055, 0.38);
                    emitWaterSplashes(hit.point.x, hit.point.y, hit.point.z);

                    if (lastF_UV) {
                        const dfx = hit.uv.x - lastF_UV.x, dfy = hit.uv.y - lastF_UV.y;
                        const distF = Math.sqrt(dfx * dfx + dfy * dfy);
                        if (distF > 0.005 && distF < 0.25) {
                            const stepsF = Math.ceil(distF / 0.015);
                            for (let sf = 0; sf < stepsF; sf++) {
                                const sft = sf / stepsF;
                                addWaterTouch(lastF_UV.x + dfx * sft, lastF_UV.y + dfy * sft, 0.045, 0.26);
                            }
                        }
                    }
                    lastF_UV = { x: hit.uv.x, y: hit.uv.y };
                }
            }

            if (!hitP) lastP_UV = null;
            if (!hitD) lastD_UV = null;
            if (!hitF) lastF_UV = null;
        }

        // 11.2 Step physics simulations
        stepFabricWave();
        stepSandSimulation();
        stepWaterSimulation();

        // 11.3 Update shader uniforms
        if (fabricMat._shader) {
            fabricMat._shader.uniforms.uWaveMap.value = waveTexture;
            fabricMat._shader.uniforms.uTime.value = t;
        }
        if (sandMat._shader) {
            sandMat._shader.uniforms.uSandMap.value = sandTexture;
            sandMat._shader.uniforms.uTime.value = t;
        }
        if (waterMat._shader) {
            waterMat._shader.uniforms.uWaterMap.value = waterTexture;
            waterMat._shader.uniforms.uTime.value = t;
        }

        // 11.4 Update sand particles (D)
        const sandPosArr = sandGeo.attributes.position.array;
        let activeSandCount = 0;
        for (let pi = 0; pi < SAND_PARTICLE_COUNT; pi++) {
            if (sandLifetimes[pi] > 0) {
                activeSandCount++;
                sandLifetimes[pi] -= dt * 1.5;
                sandPosArr[pi * 3] += sandVelocities[pi].x;
                sandPosArr[pi * 3 + 1] += sandVelocities[pi].y;
                sandPosArr[pi * 3 + 2] += sandVelocities[pi].z;
                sandVelocities[pi].y -= dt * 0.06;
            } else {
                sandPosArr[pi * 3 + 1] = -100;
            }
        }
        if (activeSandCount > 0) {
            sandGeo.attributes.position.needsUpdate = true;
            sandPointsMat.opacity = Math.min(0.9, sandPointsMat.opacity + 0.1);
        } else {
            sandPointsMat.opacity = Math.max(0, sandPointsMat.opacity - 0.05);
        }

        // 11.5 Update water splash particles (F)
        const waterPosArr = waterParticlesGeo.attributes.position.array;
        let activeWaterCount = 0;
        for (let pj = 0; pj < WATER_PARTICLE_COUNT; pj++) {
            if (waterLifetimes[pj] > 0) {
                activeWaterCount++;
                waterLifetimes[pj] -= dt * 1.6;
                waterPosArr[pj * 3] += waterVelocities[pj].x;
                waterPosArr[pj * 3 + 1] += waterVelocities[pj].y;
                waterPosArr[pj * 3 + 2] += waterVelocities[pj].z;
                waterVelocities[pj].y -= dt * 0.07;
            } else {
                waterPosArr[pj * 3 + 1] = -100;
            }
        }
        if (activeWaterCount > 0) {
            waterParticlesGeo.attributes.position.needsUpdate = true;
            waterParticlesMat.opacity = Math.min(0.95, waterParticlesMat.opacity + 0.1);
        } else {
            waterParticlesMat.opacity = Math.max(0, waterParticlesMat.opacity - 0.05);
        }

        // 11.6 Realistic Verlet Rope Physics & Local Mouse Interaction
        const mouseDelta = new THREE.Vector3().subVectors(mouseWorld, prevMousePhysics);
        prevMousePhysics.copy(mouseWorld);

        // 1. Verlet integration for each rope node
        for (let i = 1; i < ROPE_NODES; i++) {
            const node = ropeNodes[i];
            
            // If this node is being grabbed by mouse drag, anchor it to mouseWorld with slight inertia
            if (isDraggingRope && i === grabbedNodeIndex) {
                node.oldPos.copy(node.pos);
                node.pos.x = THREE.MathUtils.lerp(node.pos.x, mouseWorld.x, 0.75);
                node.pos.y = THREE.MathUtils.lerp(node.pos.y, mouseWorld.y, 0.75);
                node.pos.z = THREE.MathUtils.lerp(node.pos.z, 0.0, 0.5);
                continue;
            }

            // Verlet velocity with heavy rope air damping
            const vx = (node.pos.x - node.oldPos.x) * 0.94;
            const vy = (node.pos.y - node.oldPos.y) * 0.94;
            const vz = (node.pos.z - node.oldPos.z) * 0.94;
            node.oldPos.copy(node.pos);

            // Gravity pulls rope down naturally
            const gravity = -0.016 * node.weight;

            // Elastic restoring spring toward vertical hanging axis
            const restoreX = (node.basePos.x - node.pos.x) * 0.055;
            const restoreZ = (0 - node.pos.z) * 0.055;
            // Ambient micro-draft
            const ambientBreeze = Math.sin(t * 1.5 + i * 0.12) * 0.0018 * node.weight;

            // Local Mouse Brush Collision (reacts exactly where mouse passes)
            if (mouseActive && !isDraggingRope) {
                const dx = node.pos.x - mouseWorld.x;
                const dy = node.pos.y - mouseWorld.y;
                const dz = node.pos.z - mouseWorld.z;
                const distToMouse = Math.sqrt(dx * dx + dy * dy + dz * dz);
                const interactRadius = 0.85;

                if (distToMouse < interactRadius) {
                    const influence = Math.pow(1.0 - distToMouse / interactRadius, 1.4);
                    // Push rope in mouse sweep direction, clamped to realistic swing range
                    const rawPushX = (mouseDelta.x * 1.8 + Math.sign(dx || 1) * 0.05) * influence * 0.25;
                    const rawPushZ = (mouseDelta.z * 1.5 + Math.abs(mouseDelta.x) * 0.5) * influence * 0.25;
                    node.pos.x += Math.max(-0.35, Math.min(0.35, rawPushX));
                    node.pos.z += Math.max(-0.35, Math.min(0.35, rawPushZ));
                }
            }

            node.pos.x += vx + restoreX + ambientBreeze;
            node.pos.y += vy + gravity;
            node.pos.z += vz + restoreZ;
        }

        // 2. Inextensible distance constraints (Relaxation from top to bottom)
        ropeNodes[0].pos.copy(ropeNodes[0].basePos); // Top anchor fixed
        for (let iter = 0; iter < 10; iter++) {
            for (let i = 0; i < ROPE_NODES - 1; i++) {
                const n1 = ropeNodes[i];
                const n2 = ropeNodes[i + 1];
                const delta = new THREE.Vector3().subVectors(n2.pos, n1.pos);
                const curDist = delta.length();
                if (curDist > 0.0001) {
                    const diff = (curDist - ropeRestDistance) / curDist;
                    if (i === 0) {
                        n2.pos.sub(delta.multiplyScalar(diff));
                    } else if (isDraggingRope && (i + 1) === grabbedNodeIndex) {
                        n1.pos.add(delta.clone().multiplyScalar(diff * 0.85));
                    } else if (isDraggingRope && i === grabbedNodeIndex) {
                        n2.pos.sub(delta.clone().multiplyScalar(diff * 0.85));
                    } else {
                        n1.pos.add(delta.clone().multiplyScalar(diff * 0.35));
                        n2.pos.sub(delta.clone().multiplyScalar(diff * 0.65));
                    }
                }
            }
        }

        // Scroll pull: pulls the bottom of the rope up
        const scrollPull = scrollProgress * 1.4;
        for (let i = 1; i < ROPE_NODES; i++) {
            const rt = i / (ROPE_NODES - 1);
            if (!isDraggingRope || i !== grabbedNodeIndex) {
                ropeNodes[i].pos.y = THREE.MathUtils.lerp(ropeNodes[i].pos.y, ropeNodes[i].basePos.y + scrollPull * rt, scrollProgress * 0.4);
            }
        }

        // Rebuild all 3 helical hawser strands along the CatmullRom curve
        const ropePoints = ropeNodes.map(n => n.pos);
        const centerCurve = new THREE.CatmullRomCurve3(ropePoints);
        const numSamples = 100;
        const curvePts = centerCurve.getPoints(numSamples);
        const frenetFrames = centerCurve.computeFrenetFrames(numSamples, false);

        for (let k = 0; k < 3; k++) {
            const kAngle = (k * 2.0 * Math.PI) / 3.0;
            const strandPts = [];
            for (let i = 0; i <= numSamples; i++) {
                const tNorm = i / numSamples;
                const pt = curvePts[i];
                const N = frenetFrames.normals[i];
                const B = frenetFrames.binormals[i];
                const angle = tNorm * TWIST_TURNS * 2.0 * Math.PI + kAngle;
                const offsetVec = new THREE.Vector3()
                    .addScaledVector(N, Math.cos(angle) * STRAND_OFFSET)
                    .addScaledVector(B, Math.sin(angle) * STRAND_OFFSET);
                strandPts.push(new THREE.Vector3().addVectors(pt, offsetVec));
            }
            const sCurve = new THREE.CatmullRomCurve3(strandPts);
            strandMeshes[k].geometry.dispose();
            strandMeshes[k].geometry = new THREE.TubeGeometry(sCurve, 60, STRAND_RADIUS, 8, false);
        }

        // Update bottom stopper knot position
        bottomKnot.position.copy(ropeNodes[ROPE_NODES - 1].pos);

        // Ground shadow fade on scroll
        if (ground) {
            ground.material.opacity = Math.max(0, (1.0 - scrollProgress * 2.5) * 0.12);
        }

        // 11.7 Letter motions & Scroll telling (PDF Trio Docking into Navbar)
        const fAmp = (1 - scrollProgress) * 0.065;
        const sEase = Math.min(1.0, Math.pow(scrollProgress, 0.75));

        if (letterP) {
            const pIdleY = Math.sin(t * 1.2) * fAmp;
            const targetRotXP = (1 - sEase) * Math.cos(t * 0.5) * 0.02;
            const targetRotYP = (1 - sEase) * Math.sin(t * 0.7) * 0.05;
            letterP.rotation.x = targetRotXP;
            letterP.rotation.y = targetRotYP;

            if (scrollProgress > 0.005) {
                letterP.position.x = THREE.MathUtils.lerp(initialPosX_P, dockPosX_P, sEase);
                letterP.position.y = THREE.MathUtils.lerp(pIdleY, dockPosY, sEase);
                const scP = THREE.MathUtils.lerp(initialLetterScale, logoScale, sEase);
                letterP.scale.setScalar(scP);
            } else {
                letterP.position.set(initialPosX_P, pIdleY, 0);
                letterP.scale.setScalar(initialLetterScale);
            }
        }

        if (letterD) {
            const dIdleY = Math.sin(t * 1.1 + 1.2) * fAmp;
            const targetRotXD = (1 - sEase) * Math.cos(t * 0.55 + 0.8) * 0.02;
            const targetRotYD = (1 - sEase) * Math.sin(t * 0.65 + 1.0) * 0.05;
            letterD.rotation.x = targetRotXD;
            letterD.rotation.y = targetRotYD;

            if (scrollProgress > 0.005) {
                letterD.position.x = THREE.MathUtils.lerp(initialPosX_D, dockPosX_D, sEase);
                letterD.position.y = THREE.MathUtils.lerp(dIdleY, dockPosY, sEase);
                const scD = THREE.MathUtils.lerp(initialLetterScale, logoScale, sEase);
                letterD.scale.setScalar(scD);
            } else {
                letterD.position.set(initialPosX_D, dIdleY, 0);
                letterD.scale.setScalar(initialLetterScale);
            }
        }

        if (letterF) {
            const fIdleY = Math.sin(t * 1.3 + 2.4) * fAmp;
            const targetRotXF = (1 - sEase) * Math.cos(t * 0.6 + 1.6) * 0.02;
            const targetRotYF = (1 - sEase) * Math.sin(t * 0.75 + 2.0) * 0.05;
            letterF.rotation.x = targetRotXF;
            letterF.rotation.y = targetRotYF;

            if (scrollProgress > 0.005) {
                letterF.position.x = THREE.MathUtils.lerp(initialPosX_F, dockPosX_F, sEase);
                letterF.position.y = THREE.MathUtils.lerp(fIdleY, dockPosY, sEase);
                const scF = THREE.MathUtils.lerp(initialLetterScale, logoScale, sEase);
                letterF.scale.setScalar(scF);
            } else {
                letterF.position.set(initialPosX_F, fIdleY, 0);
                letterF.scale.setScalar(initialLetterScale);
            }
        }
        // 11.75 Animate Playful 3D Duolingo Objects (Rise with Section 2)
        if (playfulGroup) {
            const targetGroupY = THREE.MathUtils.lerp(-6.0, 0.0, Math.min(1.0, scrollProgress * 1.5));
            playfulGroup.position.y += (targetGroupY - playfulGroup.position.y) * 0.08;
            playfulGroup.visible = scrollProgress > 0.04;

            for (let pi = 0; pi < playfulItems.length; pi++) {
                const item = playfulItems[pi];
                const bobY = Math.sin(t * item.floatSpeed + item.floatPhase) * 0.18;
                const bobX = Math.cos(t * item.floatSpeed * 0.7 + item.floatPhase) * 0.08;
                item.mesh.position.x = item.basePos.x + bobX;
                item.mesh.position.y = item.basePos.y + bobY;
                item.mesh.rotation.x += item.rotSpeed * dt * 0.8;
                item.mesh.rotation.y += item.rotSpeed * dt;

                // Mouse repulsion / proximity bounce
                if (mouseActive) {
                    const mdx = item.mesh.position.x - mouseWorld.x;
                    const mdy = (item.mesh.position.y + playfulGroup.position.y) - mouseWorld.y;
                    const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
                    if (mDist < 1.2) {
                        const mForce = (1.2 - mDist) * 0.15;
                        item.mesh.position.x += mdx * mForce;
                        item.mesh.position.y += mdy * mForce;
                    }
                }
            }
        }

        // 11.8 Camera parallax
        const targetCamX = mouseActive ? mouse.x * 0.22 : 0;
        const targetCamY = mouseActive ? mouse.y * 0.15 : 0;
        camera.position.x += (targetCamX - camera.position.x) * 0.05;
        camera.position.y += (targetCamY - camera.position.y) * 0.05;
        camera.position.z = 7.8;
        camera.lookAt(0, 0, 0);

        renderer.render(scene, camera);
    }

    updateResponsiveLayout();
    animate();

    window.addEventListener('resize', function () {
        camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        updateResponsiveLayout();
    });

    console.log('[hero] ✅ Hero Engine v5 Complete: Responsive Layout Initialized');
})();
