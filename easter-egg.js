const MODES = {
    build: {
        className: 'mode-build',
        eyebrow: 'build pipeline',
        title: 'Portfolio build',
        subtitle: 'Compilation du profil, des compétences et des projets.',
        logs: [
            '> load portfolio-data.json',
            '> compile skills badges',
            '> link GitHub Pages',
            '> status: ready'
        ],
        tiles: 24
    },
    matrix: {
        className: 'mode-matrix',
        eyebrow: 'console mode',
        title: 'Data stream',
        subtitle: 'Lecture des signaux faibles du portfolio.',
        logs: [
            '> scanning projects',
            '> mapping skills',
            '> rendering green channel',
            '> stream stabilized'
        ],
        tiles: 40
    },
    circuit: {
        className: 'mode-circuit',
        eyebrow: 'hardware mode',
        title: 'Circuit check',
        subtitle: 'Simulation d’un bus logique entre code, réseau et électronique.',
        logs: [
            '> gpio: active',
            '> solder joints: nominal',
            '> pwm: stable',
            '> circuit route complete'
        ],
        tiles: 30
    },
    root: {
        className: 'mode-root',
        eyebrow: 'privilege escalation',
        title: 'sudo accepted',
        subtitle: 'Accès symbolique aux couches basses du CV.',
        logs: [
            '> sudo validate profile',
            '> permission granted',
            '> recruiter mode: armed',
            '> return code 0'
        ],
        tiles: 18
    },
    answer: {
        className: 'mode-answer',
        eyebrow: 'debug answer',
        title: '42',
        subtitle: 'La réponse est simple. Le chemin de debug l’est moins.',
        logs: [
            '> question received',
            '> context indexed',
            '> ambiguity preserved',
            '> answer emitted'
        ],
        tiles: 42
    },
    deploy: {
        className: 'mode-deploy',
        eyebrow: 'release mode',
        title: 'Deploy complete',
        subtitle: 'Le portfolio est prêt pour publication statique.',
        logs: [
            '> npm: not needed',
            '> backend: skipped',
            '> static assets: ok',
            '> GitHub Pages: ready'
        ],
        tiles: 28
    }
};

function getMode() {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode') || 'build';
    return MODES[mode] || MODES.build;
}

function renderMode() {
    const mode = getMode();
    const shell = document.getElementById('eggShell');
    const grid = document.getElementById('eggGrid');
    const log = document.getElementById('eggLog');

    shell.classList.add(mode.className);
    document.getElementById('eggEyebrow').textContent = mode.eyebrow;
    document.getElementById('eggTitle').textContent = mode.title;
    document.getElementById('eggSubtitle').textContent = mode.subtitle;
    document.title = `Portfolio // ${mode.title}`;

    for (let index = 0; index < mode.tiles; index += 1) {
        grid.append(document.createElement('span'));
    }

    mode.logs.forEach((line, index) => {
        window.setTimeout(() => {
            log.textContent += `${line}\n`;
        }, index * 360);
    });
}

renderMode();
