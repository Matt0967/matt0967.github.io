const TERMINAL_COPY = {
    fr: {
        welcome: "Terminal portfolio prêt. Tape help pour afficher les commandes.",
        help: "Commandes: whoami, skills, projects, status, contact, cv, clear",
        unknown: "Commande inconnue. Tape help.",
        loading: "Chargement de portfolio-data.json...",
        loaded: "Données portfolio chargées.",
        loadError: "Impossible de charger portfolio-data.json.",
        whoami: "Perez Matthieu // Développeur junior // Administrateur réseaux",
        contact: "Contact: utilise le formulaire Notion dans la section Contact.",
        cv: "Ouverture de l'export PDF...",
        ready: "HTTP 200 // GitHub Pages // portfolio-data.json ready"
    },
    en: {
        welcome: "Portfolio terminal ready. Type help to list commands.",
        help: "Commands: whoami, skills, projects, status, contact, cv, clear",
        unknown: "Unknown command. Type help.",
        loading: "Loading portfolio-data.json...",
        loaded: "Portfolio data loaded.",
        loadError: "Unable to load portfolio-data.json.",
        whoami: "Perez Matthieu // Junior developer // Network administrator",
        contact: "Contact: use the Notion form in the Contact section.",
        cv: "Opening PDF export...",
        ready: "HTTP 200 // GitHub Pages // portfolio-data.json ready"
    },
    es: {
        welcome: "Terminal del portfolio listo. Escribe help para ver los comandos.",
        help: "Comandos: whoami, skills, projects, status, contact, cv, clear",
        unknown: "Comando desconocido. Escribe help.",
        loading: "Cargando portfolio-data.json...",
        loaded: "Datos del portfolio cargados.",
        loadError: "No se puede cargar portfolio-data.json.",
        whoami: "Perez Matthieu // Desarrollador junior // Administrador de redes",
        contact: "Contacto: usa el formulario de Notion en la sección Contacto.",
        cv: "Abriendo exportación PDF...",
        ready: "HTTP 200 // GitHub Pages // portfolio-data.json ready"
    }
};

let portfolioData = null;
const language = TERMINAL_COPY[localStorage.getItem('language')] ? localStorage.getItem('language') : 'fr';
const copy = TERMINAL_COPY[language];
const terminalOutput = document.getElementById('terminalOutput');
const terminalForm = document.getElementById('terminalForm');
const terminalInput = document.getElementById('terminalInput');

function getLocalizedValue(value, locale) {
    if (typeof value === 'string') {
        return value;
    }

    if (value && typeof value === 'object') {
        return value[locale] || value.fr || value.en || Object.values(value)[0] || '';
    }

    return '';
}

function getSkillLabel(skill, locale) {
    if (skill && typeof skill === 'object' && 'label' in skill) {
        return getLocalizedValue(skill.label, locale);
    }

    return getLocalizedValue(skill, locale);
}

function getSkillLevel(skill, locale) {
    if (skill && typeof skill === 'object' && 'level' in skill) {
        return getLocalizedValue(skill.level, locale);
    }

    return '';
}

function appendLine(text, type = 'output') {
    const line = document.createElement('div');
    line.className = `terminal-line terminal-line-${type}`;
    line.textContent = text;
    terminalOutput.append(line);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

function resetTerminal() {
    terminalOutput.replaceChildren();
    appendLine(copy.welcome, 'system');
}

function listSkills() {
    if (!Array.isArray(portfolioData?.skills)) {
        return copy.loadError;
    }

    return portfolioData.skills
        .flatMap((category) => category.items || [])
        .map((skill) => {
            const label = getSkillLabel(skill, language);
            const level = getSkillLevel(skill, language);
            return level ? `${label} (${level})` : label;
        })
        .filter(Boolean)
        .slice(0, 14)
        .join(', ');
}

function listProjects() {
    if (!Array.isArray(portfolioData?.projects)) {
        return copy.loadError;
    }

    return portfolioData.projects
        .map((project) => {
            const title = getLocalizedValue(project.title, language);
            const status = getLocalizedValue(project.status, language);
            return status ? `${title} [${status}]` : title;
        })
        .filter(Boolean)
        .join(' // ');
}

function openEasterEgg(mode) {
    const openedWindow = window.open(`easter-egg.html?mode=${encodeURIComponent(mode)}`, '_blank');

    if (!openedWindow) {
        window.location.href = `easter-egg.html?mode=${encodeURIComponent(mode)}`;
    } else {
        openedWindow.opener = null;
    }
}

function handleCommand(rawCommand) {
    const command = rawCommand.trim().toLowerCase();

    if (!command) {
        return;
    }

    appendLine(`> ${rawCommand}`, 'input');

    if (command === 'clear') {
        resetTerminal();
        return;
    }

    if (command === 'help') {
        appendLine(copy.help);
    } else if (command === 'whoami') {
        appendLine(copy.whoami);
    } else if (command === 'skills') {
        appendLine(listSkills());
    } else if (command === 'projects') {
        appendLine(listProjects());
    } else if (command === 'status') {
        appendLine(copy.ready);
    } else if (command === 'contact') {
        appendLine(copy.contact);
    } else if (command === 'cv') {
        appendLine(copy.cv);
        window.print();
    } else if (['matrix', 'sudo hire me', 'arduino', '42', 'deploy'].includes(command)) {
        const modeMap = {
            matrix: 'matrix',
            'sudo hire me': 'root',
            arduino: 'circuit',
            '42': 'answer',
            deploy: 'deploy'
        };
        appendLine('opening hidden module...');
        openEasterEgg(modeMap[command]);
    } else {
        appendLine(copy.unknown, 'error');
    }
}

async function loadPortfolioData() {
    appendLine(copy.loading, 'system');

    try {
        const response = await fetch('portfolio-data.json', { cache: 'no-cache' });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        portfolioData = await response.json();
        appendLine(copy.loaded, 'system');
    } catch (error) {
        appendLine(copy.loadError, 'error');
    }
}

terminalForm.addEventListener('submit', (event) => {
    event.preventDefault();
    handleCommand(terminalInput.value);
    terminalInput.value = '';
});

document.addEventListener('click', () => {
    terminalInput.focus();
});

resetTerminal();
loadPortfolioData();
