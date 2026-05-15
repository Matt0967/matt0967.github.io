const DATA_PATH = 'portfolio-data.json';
const DRAFT_KEY = 'portfolio-admin-draft';
const GITHUB_CONFIG_KEY = 'portfolio-admin-github-config';
const GITHUB_TOKEN_KEY = 'portfolio-admin-github-token';
const LOCALES = ['fr', 'en', 'es'];

const state = {
    data: null,
    activeTab: 'projects',
    status: 'loading'
};

const editor = document.getElementById('editor');
const addButton = document.getElementById('addButton');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const tabTitle = document.getElementById('tabTitle');
const tabEyebrow = document.getElementById('tabEyebrow');
const jsonFileInput = document.getElementById('jsonFileInput');

function emptyLocalizedValue() {
    return LOCALES.reduce((copy, locale) => {
        copy[locale] = '';
        return copy;
    }, {});
}

function getLocalizedValue(value, locale) {
    if (typeof value === 'string') {
        return value;
    }

    if (value && typeof value === 'object') {
        return value[locale] || value.fr || value.en || Object.values(value)[0] || '';
    }

    return '';
}

function setLocalizedValue(record, key, locale, value) {
    if (!record[key] || typeof record[key] === 'string') {
        const previousValue = record[key] || '';
        record[key] = emptyLocalizedValue();
        LOCALES.forEach((availableLocale) => {
            record[key][availableLocale] = previousValue;
        });
    }

    record[key][locale] = value;
}

function getLocalizedList(list, locale) {
    return (list || []).map((item) => getLocalizedValue(item, locale)).filter(Boolean);
}

function setLocalizedList(record, key, locale, text) {
    const nextValues = text.split(',')
        .map((item) => item.trim())
        .filter(Boolean);

    const maxLength = Math.max(record[key]?.length || 0, nextValues.length);
    const nextList = [];

    for (let index = 0; index < maxLength; index += 1) {
        const existing = record[key]?.[index];
        const localizedItem = emptyLocalizedValue();

        LOCALES.forEach((availableLocale) => {
            localizedItem[availableLocale] = getLocalizedValue(existing, availableLocale);
        });

        localizedItem[locale] = nextValues[index] || '';

        if (LOCALES.some((availableLocale) => localizedItem[availableLocale])) {
            const values = LOCALES.map((availableLocale) => localizedItem[availableLocale]);
            const sameValue = values.every((value) => value === values[0]);
            nextList.push(sameValue ? values[0] : localizedItem);
        }
    }

    record[key] = nextList;
}

function createId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function setStatus(message, type = 'ready') {
    state.status = type;
    statusText.textContent = message;
    statusDot.classList.toggle('is-ready', type === 'ready');
    statusDot.classList.toggle('is-error', type === 'error');
}

function updateCounts() {
    document.getElementById('projectCount').textContent = state.data?.projects?.length || 0;
    document.getElementById('skillCount').textContent = state.data?.skills?.length || 0;
    document.getElementById('languageCount').textContent = state.data?.languages?.length || 0;
}

function renderLocalizedInputs(record, key, label, multiline = false) {
    return LOCALES.map((locale) => {
        const value = getLocalizedValue(record[key], locale);
        const inputId = `${record.id}-${key}-${locale}`;
        const field = document.createElement('div');
        field.className = multiline ? 'field full' : 'field';

        const labelElement = document.createElement('label');
        labelElement.setAttribute('for', inputId);
        labelElement.textContent = `${label} (${locale.toUpperCase()})`;

        const input = document.createElement(multiline ? 'textarea' : 'input');
        input.id = inputId;
        input.value = value;
        input.addEventListener('input', () => {
            setLocalizedValue(record, key, locale, input.value);
            updateCounts();
        });

        field.append(labelElement, input);
        return field;
    });
}

function renderLocalizedListInputs(record, key, label) {
    return LOCALES.map((locale) => {
        const inputId = `${record.id}-${key}-${locale}`;
        const field = document.createElement('div');
        field.className = 'field';

        const labelElement = document.createElement('label');
        labelElement.setAttribute('for', inputId);
        labelElement.textContent = `${label} (${locale.toUpperCase()}, séparés par virgules)`;

        const input = document.createElement('textarea');
        input.id = inputId;
        input.value = getLocalizedList(record[key], locale).join(', ');
        input.addEventListener('input', () => {
            setLocalizedList(record, key, locale, input.value);
        });

        field.append(labelElement, input);
        return field;
    });
}

function createButton(label, className, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
}

function moveItem(collection, index, direction) {
    const nextIndex = index + direction;

    if (nextIndex < 0 || nextIndex >= collection.length) {
        return;
    }

    const [item] = collection.splice(index, 1);
    collection.splice(nextIndex, 0, item);
    render();
}

function removeItem(collection, index) {
    collection.splice(index, 1);
    render();
}

function createEditorCard(title, subtitle, actions, body) {
    const card = document.createElement('article');
    card.className = 'editor-card';

    const header = document.createElement('div');
    header.className = 'card-header';

    const titleBlock = document.createElement('div');
    titleBlock.className = 'card-title';
    const heading = document.createElement('h3');
    heading.textContent = title || 'Nouvel élément';
    const subheading = document.createElement('span');
    subheading.textContent = subtitle;
    titleBlock.append(heading, subheading);

    const actionRow = document.createElement('div');
    actionRow.className = 'row-actions';
    actions.forEach((action) => actionRow.append(action));

    header.append(titleBlock, actionRow);
    card.append(header, body);
    return card;
}

function renderProjects() {
    tabEyebrow.textContent = 'Timeline';
    tabTitle.textContent = 'Projets';
    addButton.hidden = false;
    addButton.textContent = 'Ajouter un projet';
    editor.replaceChildren();

    if (!state.data.projects.length) {
        editor.append(createEmptyState('Aucun projet pour le moment.'));
    }

    state.data.projects.forEach((project, index) => {
        const body = document.createElement('div');
        body.className = 'field-grid';
        renderLocalizedInputs(project, 'date', 'Date').forEach((field) => body.append(field));
        renderLocalizedInputs(project, 'title', 'Titre').forEach((field) => body.append(field));
        renderLocalizedInputs(project, 'role', 'Rôle').forEach((field) => body.append(field));
        renderLocalizedInputs(project, 'description', 'Description', true).forEach((field) => body.append(field));
        renderLocalizedListInputs(project, 'tech', 'Technos').forEach((field) => body.append(field));

        editor.append(createEditorCard(
            getLocalizedValue(project.title, 'fr'),
            project.id,
            [
                createButton('Monter', 'mini-button', () => moveItem(state.data.projects, index, -1)),
                createButton('Descendre', 'mini-button', () => moveItem(state.data.projects, index, 1)),
                createButton('Supprimer', 'danger-button', () => removeItem(state.data.projects, index))
            ],
            body
        ));
    });
}

function renderSkills() {
    tabEyebrow.textContent = 'Compétences';
    tabTitle.textContent = 'Catégories de compétences';
    addButton.hidden = false;
    addButton.textContent = 'Ajouter une catégorie';
    editor.replaceChildren();

    if (!state.data.skills.length) {
        editor.append(createEmptyState('Aucune catégorie pour le moment.'));
    }

    state.data.skills.forEach((category, index) => {
        const body = document.createElement('div');
        body.className = 'field-grid';
        renderLocalizedInputs(category, 'title', 'Nom de catégorie').forEach((field) => body.append(field));
        renderLocalizedListInputs(category, 'items', 'Compétences').forEach((field) => body.append(field));

        editor.append(createEditorCard(
            getLocalizedValue(category.title, 'fr'),
            category.id,
            [
                createButton('Monter', 'mini-button', () => moveItem(state.data.skills, index, -1)),
                createButton('Descendre', 'mini-button', () => moveItem(state.data.skills, index, 1)),
                createButton('Supprimer', 'danger-button', () => removeItem(state.data.skills, index))
            ],
            body
        ));
    });
}

function renderLanguages() {
    tabEyebrow.textContent = 'Langues parlées';
    tabTitle.textContent = 'Langues';
    addButton.hidden = false;
    addButton.textContent = 'Ajouter une langue';
    editor.replaceChildren();

    if (!state.data.languages.length) {
        editor.append(createEmptyState('Aucune langue pour le moment.'));
    }

    state.data.languages.forEach((language, index) => {
        const body = document.createElement('div');
        body.className = 'field-grid two';
        renderLocalizedInputs(language, 'label', 'Langue').forEach((field) => body.append(field));
        renderLocalizedInputs(language, 'level', 'Niveau').forEach((field) => body.append(field));

        editor.append(createEditorCard(
            getLocalizedValue(language.label, 'fr'),
            language.id,
            [
                createButton('Monter', 'mini-button', () => moveItem(state.data.languages, index, -1)),
                createButton('Descendre', 'mini-button', () => moveItem(state.data.languages, index, 1)),
                createButton('Supprimer', 'danger-button', () => removeItem(state.data.languages, index))
            ],
            body
        ));
    });
}

function renderPublish() {
    const savedConfig = JSON.parse(localStorage.getItem(GITHUB_CONFIG_KEY) || '{}');
    tabEyebrow.textContent = 'GitHub Pages';
    tabTitle.textContent = 'Publication';
    addButton.hidden = true;
    editor.replaceChildren();

    const panel = document.createElement('section');
    panel.className = 'publish-panel';
    panel.innerHTML = `
        <div class="publish-grid">
            <div class="field">
                <label for="githubOwner">Propriétaire GitHub</label>
                <input id="githubOwner" value="${savedConfig.owner || 'Matt0967'}" autocomplete="username">
            </div>
            <div class="field">
                <label for="githubRepo">Dépôt</label>
                <input id="githubRepo" value="${savedConfig.repo || 'portefolio'}">
            </div>
            <div class="field">
                <label for="githubBranch">Branche</label>
                <input id="githubBranch" value="${savedConfig.branch || 'main'}">
            </div>
            <div class="field">
                <label for="githubPath">Fichier à publier</label>
                <input id="githubPath" value="${savedConfig.path || DATA_PATH}">
            </div>
            <div class="field full">
                <label for="githubToken">Token GitHub personnel</label>
                <input id="githubToken" type="password" value="${localStorage.getItem(GITHUB_TOKEN_KEY) || ''}" autocomplete="off">
            </div>
            <label class="checkbox-row field full">
                <input id="rememberToken" type="checkbox" ${localStorage.getItem(GITHUB_TOKEN_KEY) ? 'checked' : ''}>
                Garder le token dans ce navigateur
            </label>
        </div>
    `;

    const actions = document.createElement('div');
    actions.className = 'toolbar-actions';
    actions.append(
        createButton('Tester la configuration', 'secondary-button', testGitHubConfig),
        createButton('Publier sur GitHub', 'primary-button', publishToGitHub)
    );

    panel.append(actions);
    editor.append(panel);
}

function createEmptyState(text) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = text;
    return empty;
}

function render() {
    if (!state.data) {
        return;
    }

    updateCounts();

    document.querySelectorAll('.tab').forEach((tab) => {
        tab.classList.toggle('is-active', tab.dataset.tab === state.activeTab);
    });

    const renderers = {
        projects: renderProjects,
        skills: renderSkills,
        languages: renderLanguages,
        publish: renderPublish
    };

    renderers[state.activeTab]();
}

function addCurrentItem() {
    const defaults = {
        projects: () => state.data.projects.push({
            id: createId('project'),
            date: emptyLocalizedValue(),
            title: emptyLocalizedValue(),
            role: emptyLocalizedValue(),
            description: emptyLocalizedValue(),
            tech: []
        }),
        skills: () => state.data.skills.push({
            id: createId('skills'),
            title: emptyLocalizedValue(),
            items: []
        }),
        languages: () => state.data.languages.push({
            id: createId('language'),
            label: emptyLocalizedValue(),
            level: emptyLocalizedValue()
        })
    };

    defaults[state.activeTab]?.();
    render();
}

function serializeData() {
    return `${JSON.stringify(state.data, null, 2)}\n`;
}

function saveDraft() {
    localStorage.setItem(DRAFT_KEY, serializeData());
    setStatus('Brouillon sauvegardé dans ce navigateur.', 'ready');
}

function downloadJson() {
    const blob = new Blob([serializeData()], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = DATA_PATH;
    link.click();
    URL.revokeObjectURL(link.href);
    setStatus('Fichier JSON préparé au téléchargement.', 'ready');
}

function importJson(file) {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
        try {
            state.data = normalizeData(JSON.parse(reader.result));
            setStatus('JSON importé.', 'ready');
            render();
        } catch (error) {
            setStatus('Import impossible: JSON invalide.', 'error');
        }
    });
    reader.readAsText(file);
}

function normalizeData(data) {
    return {
        schemaVersion: data.schemaVersion || 1,
        projects: Array.isArray(data.projects) ? data.projects : [],
        skills: Array.isArray(data.skills) ? data.skills : [],
        languages: Array.isArray(data.languages) ? data.languages : []
    };
}

function collectGitHubConfig() {
    const config = {
        owner: document.getElementById('githubOwner')?.value.trim(),
        repo: document.getElementById('githubRepo')?.value.trim(),
        branch: document.getElementById('githubBranch')?.value.trim(),
        path: document.getElementById('githubPath')?.value.trim() || DATA_PATH
    };
    const token = document.getElementById('githubToken')?.value.trim();
    const rememberToken = document.getElementById('rememberToken')?.checked;

    if (!config.owner || !config.repo || !config.branch || !token) {
        throw new Error('Configuration GitHub incomplète.');
    }

    localStorage.setItem(GITHUB_CONFIG_KEY, JSON.stringify(config));

    if (rememberToken) {
        localStorage.setItem(GITHUB_TOKEN_KEY, token);
    } else {
        localStorage.removeItem(GITHUB_TOKEN_KEY);
    }

    return { ...config, token };
}

async function getGitHubFile(config, options = {}) {
    const encodedPath = config.path.split('/').map((part) => encodeURIComponent(part)).join('/');
    const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${encodedPath}?ref=${encodeURIComponent(config.branch)}`;
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${config.token}`,
            Accept: 'application/vnd.github+json'
        }
    });

    if (response.status === 404 && options.allowMissing) {
        return null;
    }

    if (!response.ok) {
        throw new Error(await createGitHubErrorMessage(response, 'Lecture GitHub impossible'));
    }

    return response.json();
}

async function getGitHubRepo(config) {
    const url = `https://api.github.com/repos/${config.owner}/${config.repo}`;
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${config.token}`,
            Accept: 'application/vnd.github+json'
        }
    });

    if (!response.ok) {
        throw new Error(await createGitHubErrorMessage(response, 'Dépôt GitHub inaccessible'));
    }

    return response.json();
}

async function getGitHubBranch(config) {
    const url = `https://api.github.com/repos/${config.owner}/${config.repo}/branches/${encodeURIComponent(config.branch)}`;
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${config.token}`,
            Accept: 'application/vnd.github+json'
        }
    });

    if (!response.ok) {
        throw new Error(await createGitHubErrorMessage(response, 'Branche GitHub inaccessible'));
    }

    return response.json();
}

async function createGitHubErrorMessage(response, fallback) {
    let details = '';

    try {
        const payload = await response.json();
        details = payload.message ? ` ${payload.message}` : '';
    } catch (error) {
        details = '';
    }

    if (response.status === 404) {
        return `${fallback} (404). Vérifie le propriétaire, le dépôt, la branche et surtout que le token a bien le droit Contents: Read and write.${details}`;
    }

    if (response.status === 401 || response.status === 403) {
        return `${fallback} (${response.status}). Le token est refusé ou n'a pas assez de droits. Il faut Contents: Read and write sur ce dépôt.${details}`;
    }

    return `${fallback} (${response.status}).${details}`;
}

function toBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary);
}

async function testGitHubConfig() {
    try {
        const config = collectGitHubConfig();
        await getGitHubRepo(config);
        await getGitHubBranch(config);
        await getGitHubFile(config);
        setStatus('Configuration GitHub valide: dépôt, branche, fichier et lecture OK. Pour publier, le token doit avoir Contents: Read and write.', 'ready');
    } catch (error) {
        setStatus(error.message, 'error');
    }
}

async function publishToGitHub() {
    try {
        const config = collectGitHubConfig();
        await getGitHubRepo(config);
        await getGitHubBranch(config);
        const currentFile = await getGitHubFile(config, { allowMissing: true });
        const encodedPath = config.path.split('/').map((part) => encodeURIComponent(part)).join('/');
        const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${encodedPath}`;
        const body = {
            message: 'Update portfolio data from admin dashboard',
            branch: config.branch,
            content: toBase64(serializeData())
        };

        if (currentFile?.sha) {
            body.sha = currentFile.sha;
        }

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${config.token}`,
                Accept: 'application/vnd.github+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(await createGitHubErrorMessage(response, 'Publication refusée par GitHub'));
        }

        localStorage.removeItem(DRAFT_KEY);
        setStatus('Portfolio publié sur GitHub.', 'ready');
    } catch (error) {
        setStatus(error.message, 'error');
    }
}

async function loadInitialData() {
    const draft = localStorage.getItem(DRAFT_KEY);

    try {
        const response = await fetch(DATA_PATH, { cache: 'no-cache' });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        state.data = normalizeData(await response.json());
        setStatus('Données chargées depuis portfolio-data.json.', 'ready');
    } catch (error) {
        state.data = normalizeData({ schemaVersion: 1, projects: [], skills: [], languages: [] });
        setStatus('portfolio-data.json introuvable. Import possible via JSON.', 'error');
    }

    if (draft) {
        try {
            state.data = normalizeData(JSON.parse(draft));
            setStatus('Brouillon local restauré.', 'ready');
        } catch (error) {
            localStorage.removeItem(DRAFT_KEY);
        }
    }

    render();
}

document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
        state.activeTab = tab.dataset.tab;
        render();
    });
});

addButton.addEventListener('click', addCurrentItem);
document.getElementById('saveDraftButton').addEventListener('click', saveDraft);
document.getElementById('downloadButton').addEventListener('click', downloadJson);
document.getElementById('importButton').addEventListener('click', () => jsonFileInput.click());
jsonFileInput.addEventListener('change', (event) => {
    const [file] = event.target.files;

    if (file) {
        importJson(file);
    }
});

loadInitialData();
