const THREE_MODULE_URL = 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
const canvas = document.getElementById('cyberDiceCanvas');
const prefersReducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

let sceneState = null;
let scenePromise = null;
let animationFrame = null;

function getVisualStyle() {
    return document.documentElement.getAttribute('data-visual-style') || 'base';
}

function shouldReduceMotion() {
    return prefersReducedMotionQuery.matches || document.documentElement.getAttribute('data-a11y-motion') === 'reduced';
}

function getCssValue(name, fallback) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function makeTextMaterial(THREE, label, faceIndex) {
    const textureCanvas = document.createElement('canvas');
    const size = 512;
    const ctx = textureCanvas.getContext('2d');
    const accent = getCssValue('--accent', '#31f7a4');
    const textColor = getCssValue('--text-primary', '#ffffff');
    const panelColor = faceIndex % 2 === 0 ? 'rgba(3, 16, 29, 0.94)' : 'rgba(9, 25, 43, 0.94)';

    textureCanvas.width = size;
    textureCanvas.height = size;

    ctx.fillStyle = panelColor;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = accent;
    ctx.lineWidth = 14;
    ctx.strokeRect(26, 26, size - 52, size - 52);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    for (let i = 72; i < size; i += 72) {
        ctx.fillRect(i, 34, 2, size - 68);
        ctx.fillRect(34, i, size - 68, 2);
    }

    ctx.fillStyle = accent;
    ctx.font = '700 108px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, size / 2, size / 2 - 10);

    ctx.fillStyle = textColor;
    ctx.font = '600 28px JetBrains Mono, monospace';
    ctx.fillText('PORTFOLIO', size / 2, size / 2 + 92);

    const texture = new THREE.CanvasTexture(textureCanvas);

    if ('SRGBColorSpace' in THREE) {
        texture.colorSpace = THREE.SRGBColorSpace;
    }

    texture.anisotropy = 4;

    return new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.38,
        metalness: 0.2,
        emissive: new THREE.Color(accent),
        emissiveIntensity: 0.045
    });
}

function resizeScene() {
    if (!sceneState || !canvas.parentElement) {
        return;
    }

    const { camera, renderer } = sceneState;
    const rect = canvas.parentElement.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

async function createScene() {
    const THREE = await import(THREE_MODULE_URL);
    const accent = getCssValue('--accent', '#31f7a4');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true
    });

    camera.position.set(0, 0.2, 5.4);
    renderer.setClearColor(0x000000, 0);

    const dice = new THREE.Mesh(
        new THREE.BoxGeometry(2.15, 2.15, 2.15),
        ['AI', 'JS', 'API', 'NET', 'CV', '</>'].map((label, index) => makeTextMaterial(THREE, label, index))
    );

    const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(dice.geometry),
        new THREE.LineBasicMaterial({
            color: new THREE.Color(accent),
            transparent: true,
            opacity: 0.72
        })
    );

    const keyLight = new THREE.DirectionalLight(new THREE.Color(accent), 2.2);
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.4);
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);

    keyLight.position.set(4, 5, 5);
    fillLight.position.set(-3, -2, 4);

    dice.rotation.set(-0.28, 0.58, 0.18);
    edges.rotation.copy(dice.rotation);

    scene.add(ambientLight, keyLight, fillLight, dice, edges);

    sceneState = {
        camera,
        dice,
        edges,
        renderer,
        resizeObserver: new ResizeObserver(resizeScene),
        scene
    };

    sceneState.resizeObserver.observe(canvas.parentElement);
    resizeScene();
    return sceneState;
}

function renderScene() {
    if (!sceneState) {
        return;
    }

    const { camera, dice, edges, renderer, scene } = sceneState;
    dice.rotation.x += 0.0035;
    dice.rotation.y += 0.006;
    edges.rotation.copy(dice.rotation);
    renderer.render(scene, camera);
}

function animateScene() {
    renderScene();
    animationFrame = window.requestAnimationFrame(animateScene);
}

function stopScene() {
    if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }
}

function destroyScene() {
    stopScene();

    if (!sceneState) {
        return;
    }

    sceneState.resizeObserver.disconnect();
    sceneState.renderer.dispose();
    sceneState.scene.traverse((object) => {
        if (object.geometry) {
            object.geometry.dispose();
        }

        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.filter(Boolean).forEach((material) => {
            if (material.map) {
                material.map.dispose();
            }

            material.dispose();
        });
    });

    sceneState = null;
    scenePromise = null;
}

async function syncScene() {
    if (!canvas || getVisualStyle() !== 'cyber') {
        stopScene();
        return;
    }

    try {
        scenePromise = scenePromise || createScene();
        await scenePromise;
        canvas.closest('.hero-visual')?.classList.remove('hero-visual-unavailable');
        stopScene();

        if (shouldReduceMotion()) {
            renderScene();
        } else {
            animateScene();
        }
    } catch (error) {
        scenePromise = null;
        canvas.closest('.hero-visual')?.classList.add('hero-visual-unavailable');
    }
}

if (canvas) {
    window.addEventListener('portfolioVisualStyleChange', syncScene);
    window.addEventListener('portfolioThemeChange', () => {
        if (getVisualStyle() === 'cyber') {
            destroyScene();
            syncScene();
        }
    });
    window.addEventListener('resize', resizeScene);
    prefersReducedMotionQuery.addEventListener('change', syncScene);

    const motionObserver = new MutationObserver(syncScene);
    motionObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-a11y-motion', 'data-visual-style']
    });

    syncScene();
}
