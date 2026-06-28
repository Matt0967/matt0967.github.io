const DATA_PATH = 'portfolio-data.json';
const DRAFT_KEY = 'portfolio-admin-draft';
const GITHUB_CONFIG_KEY = 'portfolio-admin-github-config';
const GITHUB_TOKEN_KEY = 'portfolio-admin-github-token';
const AI_CONFIG_KEY = 'portfolio-admin-ai-config';
const AI_LOCAL_KEY = 'portfolio-admin-ai-key';
const AI_SESSION_KEY = 'portfolio-admin-ai-session-key';
const AUTH_HASH_KEY = 'portfolio-admin-password-hash';
const AUTH_SALT_KEY = 'portfolio-admin-password-salt';
const AUTH_SESSION_KEY = 'portfolio-admin-session-unlocked';
const LOCALES = ['fr', 'en', 'es'];
const DEFAULT_AI_CONFIG = {
    provider: 'manual',
    openaiModel: 'gpt-4o-mini',
    geminiModel: 'gemini-1.5-flash',
    anthropicModel: 'claude-3-5-haiku-latest',
    customModel: 'gpt-4o-mini',
    customEndpoint: '',
    sourceLocale: 'fr',
    targetLocales: ['en', 'es'],
    rememberKey: false
};
const ADMIN_PAGES = {
    content: ['projects', 'skills', 'interests', 'education', 'languages', 'contact'],
    tools: ['ai', 'publish', 'stats']
};
const PBKDF2_ITERATIONS = 210000;

const state = {
    data: null,
    activePage: 'content',
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
const authScreen = document.getElementById('authScreen');
const authPassword = document.getElementById('authPassword');
const authCurrentPassword = document.getElementById('authCurrentPassword');
const authConfirmPassword = document.getElementById('authConfirmPassword');
const authCurrentPasswordField = document.getElementById('authCurrentPasswordField');
const authConfirmField = document.getElementById('authConfirmField');
const authSubmit = document.getElementById('authSubmit');
const authChangePassword = document.getElementById('authChangePassword');
const authCancelChange = document.getElementById('authCancelChange');
const authError = document.getElementById('authError');
const authHelp = document.getElementById('authHelp');
const lockButton = document.getElementById('lockButton');
let authMode = localStorage.getItem(AUTH_HASH_KEY) ? 'unlock' : 'setup';

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

    const nextList = [];

    for (let index = 0; index < nextValues.length; index += 1) {
        const existing = record[key]?.[index];
        const localizedItem = emptyLocalizedValue();

        LOCALES.forEach((availableLocale) => {
            localizedItem[availableLocale] = getLocalizedValue(existing, availableLocale);
        });

        localizedItem[locale] = nextValues[index];

        if (LOCALES.some((availableLocale) => localizedItem[availableLocale])) {
            const values = LOCALES.map((availableLocale) => localizedItem[availableLocale]);
            const sameValue = values.every((value) => value === values[0]);
            nextList.push(sameValue ? values[0] : localizedItem);
        }
    }

    record[key] = nextList;
}

function dedupeLocalizedList(list) {
    const seen = new Set();

    return (Array.isArray(list) ? list : []).filter((item) => {
        const values = LOCALES
            .map((locale) => getSkillLabel(item, locale).trim().toLowerCase())
            .filter(Boolean);
        const key = values[0] || '';

        if (!key || seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

function normalizeSkills(skills) {
    return (Array.isArray(skills) ? skills : []).map((category) => ({
        ...category,
        items: dedupeLocalizedList(category.items)
    }));
}

function createId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function getPageForTab(tabName) {
    return Object.entries(ADMIN_PAGES).find(([, tabs]) => tabs.includes(tabName))?.[0] || 'content';
}

function setActivePage(pageName) {
    const nextPage = ADMIN_PAGES[pageName] ? pageName : 'content';
    state.activePage = nextPage;

    if (!ADMIN_PAGES[nextPage].includes(state.activeTab)) {
        state.activeTab = ADMIN_PAGES[nextPage][0];
    }

    render();
}

function bytesToBase64(bytes) {
    let binary = '';
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary);
}

function base64ToBytes(value) {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function hashPassword(password, salt) {
    const passwordKey = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            hash: 'SHA-256',
            salt,
            iterations: PBKDF2_ITERATIONS
        },
        passwordKey,
        256
    );

    return bytesToBase64(new Uint8Array(bits));
}

function timingSafeEqual(left, right) {
    if (left.length !== right.length) {
        return false;
    }

    let diff = 0;

    for (let index = 0; index < left.length; index += 1) {
        diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }

    return diff === 0;
}

function hasLocalPassword() {
    return Boolean(localStorage.getItem(AUTH_HASH_KEY) && localStorage.getItem(AUTH_SALT_KEY));
}

function setAuthError(message = '') {
    authError.textContent = message;
}

function clearAuthInputs() {
    authPassword.value = '';
    authConfirmPassword.value = '';
    authCurrentPassword.value = '';
}

function updateAuthScreen() {
    const hasPassword = hasLocalPassword();

    if (!hasPassword) {
        authMode = 'setup';
    }

    const setupMode = authMode === 'setup';
    const changeMode = authMode === 'change';
    authConfirmField.hidden = !setupMode && !changeMode;
    authCurrentPasswordField.hidden = !changeMode;
    authChangePassword.hidden = !hasPassword || changeMode;
    authCancelChange.hidden = !changeMode;
    authSubmit.textContent = setupMode ? 'Créer le mot de passe' : changeMode ? 'Changer le mot de passe' : 'Déverrouiller';
    authPassword.autocomplete = setupMode || changeMode ? 'new-password' : 'current-password';
    authHelp.textContent = setupMode
        ? 'Choisis un mot de passe local pour ce navigateur. Il ne sera pas écrit dans le code du site.'
        : changeMode
            ? 'Saisis l’ancien mot de passe, puis le nouveau. Le hash local sera remplacé.'
            : 'Saisis le mot de passe local de ce navigateur. La publication GitHub demandera toujours un token valide.';
}

async function verifyPassword(password) {
    const savedHash = localStorage.getItem(AUTH_HASH_KEY);
    const savedSalt = localStorage.getItem(AUTH_SALT_KEY);

    if (!savedHash || !savedSalt) {
        return false;
    }

    const nextHash = await hashPassword(password, base64ToBytes(savedSalt));
    return timingSafeEqual(nextHash, savedHash);
}

async function savePassword(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await hashPassword(password, salt);
    localStorage.setItem(AUTH_SALT_KEY, bytesToBase64(salt));
    localStorage.setItem(AUTH_HASH_KEY, hash);
}

function unlockDashboard() {
    sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
    document.body.classList.remove('auth-locked');
    clearAuthInputs();
    setAuthError();
    loadInitialData();
}

function lockDashboard() {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    document.body.classList.add('auth-locked');
    updateAuthScreen();
    window.setTimeout(() => authPassword.focus(), 0);
}

function validatePasswordStrength(password) {
    if (password.length < 10) {
        return 'Utilise au moins 10 caractères.';
    }

    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
        return 'Mélange au moins lettres et chiffres.';
    }

    return '';
}

async function handleAuthSubmit() {
    const password = authPassword.value;
    setAuthError();

    try {
        if (!window.crypto?.subtle) {
            setAuthError('Web Crypto est indisponible ici. Ouvre le dashboard depuis GitHub Pages en HTTPS pour activer le verrouillage.');
            return;
        }

        if (authMode === 'unlock') {
            if (await verifyPassword(password)) {
                unlockDashboard();
            } else {
                setAuthError('Mot de passe incorrect.');
            }
            return;
        }

        if (authMode === 'change' && !(await verifyPassword(authCurrentPassword.value))) {
            setAuthError('Mot de passe actuel incorrect.');
            return;
        }

        const strengthError = validatePasswordStrength(password);

        if (strengthError) {
            setAuthError(strengthError);
            return;
        }

        if (password !== authConfirmPassword.value) {
            setAuthError('La confirmation ne correspond pas.');
            return;
        }

        await savePassword(password);
        authMode = 'unlock';
        unlockDashboard();
    } catch (error) {
        setAuthError('Verrouillage indisponible dans ce navigateur.');
    }
}

function setStatus(message, type = 'ready') {
    state.status = type;
    statusText.textContent = message;
    statusDot.classList.toggle('is-ready', type === 'ready');
    statusDot.classList.toggle('is-error', type === 'error');
}

function setCounter(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function updateCounts() {
    setCounter('projectCount', state.data?.projects?.length || 0);
    setCounter('skillCount', state.data?.skills?.length || 0);
    setCounter('interestCount', state.data?.interests?.length || 0);
    setCounter('educationCount', state.data?.education?.length || 0);
    setCounter('languageCount', state.data?.languages?.length || 0);
    setCounter('contactStatus', state.data?.contact?.notionFormUrl ? 'Oui' : 'Non');
}

function renderLocalizedInputs(record, key, label, multiline = false) {
    return LOCALES.map((locale) => {
        const value = getLocalizedValue(record[key], locale);
        const inputId = `${record.id || 'settings'}-${key}-${locale}`;
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

function getSkillListText(list, locale) {
    return (list || [])
        .map((skill) => {
            const label = getSkillLabel(skill, locale);
            const level = getSkillLevel(skill, locale);
            return level ? `${label} | ${level}` : label;
        })
        .filter(Boolean)
        .join('\n');
}

function setSkillList(record, locale, text) {
    const nextValues = text.split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const [label, ...levelParts] = line.split('|');
            return {
                label: label.trim(),
                level: levelParts.join('|').trim()
            };
        })
        .filter((item) => item.label);

    record.items = nextValues.map((nextValue, index) => {
        const existing = record.items?.[index];
        const label = emptyLocalizedValue();
        const level = emptyLocalizedValue();

        LOCALES.forEach((availableLocale) => {
            label[availableLocale] = getSkillLabel(existing, availableLocale);
            level[availableLocale] = getSkillLevel(existing, availableLocale);
        });

        label[locale] = nextValue.label;
        level[locale] = nextValue.level;

        return { label, level };
    });
}

function renderSkillListInputs(record) {
    return LOCALES.map((locale) => {
        const inputId = `${record.id}-skills-${locale}`;
        const field = document.createElement('div');
        field.className = 'field';

        const labelElement = document.createElement('label');
        labelElement.setAttribute('for', inputId);
        labelElement.textContent = `Compétences (${locale.toUpperCase()}, une par ligne: Nom | Niveau)`;

        const input = document.createElement('textarea');
        input.id = inputId;
        input.value = getSkillListText(record.items, locale);
        input.addEventListener('input', () => {
            setSkillList(record, locale, input.value);
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
        renderLocalizedInputs(project, 'status', 'Statut').forEach((field) => body.append(field));
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
        renderSkillListInputs(category).forEach((field) => body.append(field));

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

function renderInterests() {
    state.data.interests = Array.isArray(state.data.interests) ? state.data.interests : [];
    tabEyebrow.textContent = 'Centres d’intérêt';
    tabTitle.textContent = 'Centres d’intérêt';
    addButton.hidden = false;
    addButton.textContent = 'Ajouter un centre d’intérêt';
    editor.replaceChildren();

    if (!state.data.interests.length) {
        editor.append(createEmptyState('Aucun centre d’intérêt pour le moment.'));
    }

    state.data.interests.forEach((interest, index) => {
        const body = document.createElement('div');
        body.className = 'field-grid';
        renderLocalizedInputs(interest, 'label', 'Centre d’intérêt').forEach((field) => body.append(field));

        editor.append(createEditorCard(
            getLocalizedValue(interest.label, 'fr'),
            interest.id,
            [
                createButton('Monter', 'mini-button', () => moveItem(state.data.interests, index, -1)),
                createButton('Descendre', 'mini-button', () => moveItem(state.data.interests, index, 1)),
                createButton('Supprimer', 'danger-button', () => removeItem(state.data.interests, index))
            ],
            body
        ));
    });
}

function renderEducation() {
    state.data.education = Array.isArray(state.data.education) ? state.data.education : [];
    tabEyebrow.textContent = 'Formation';
    tabTitle.textContent = 'Formation - Éducation';
    addButton.hidden = false;
    addButton.textContent = 'Ajouter une formation';
    editor.replaceChildren();

    if (!state.data.education.length) {
        editor.append(createEmptyState('Aucune formation pour le moment.'));
    }

    state.data.education.forEach((educationItem, index) => {
        const body = document.createElement('div');
        body.className = 'field-grid';
        renderLocalizedInputs(educationItem, 'title', 'Titre').forEach((field) => body.append(field));
        renderLocalizedInputs(educationItem, 'school', 'École / organisme', true).forEach((field) => body.append(field));

        const yearField = document.createElement('div');
        yearField.className = 'field full';
        const yearLabel = document.createElement('label');
        yearLabel.setAttribute('for', `${educationItem.id}-year`);
        yearLabel.textContent = 'Années';
        const yearInput = document.createElement('input');
        yearInput.id = `${educationItem.id}-year`;
        yearInput.value = educationItem.year || '';
        yearInput.placeholder = '2025 - 2026';
        yearInput.addEventListener('input', () => {
            educationItem.year = yearInput.value;
        });
        yearField.append(yearLabel, yearInput);
        body.append(yearField);

        editor.append(createEditorCard(
            getLocalizedValue(educationItem.title, 'fr'),
            educationItem.id,
            [
                createButton('Monter', 'mini-button', () => moveItem(state.data.education, index, -1)),
                createButton('Descendre', 'mini-button', () => moveItem(state.data.education, index, 1)),
                createButton('Supprimer', 'danger-button', () => removeItem(state.data.education, index))
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

function renderContactSettings() {
    state.data.contact = state.data.contact || {
        notionFormUrl: '',
        iframeTitle: emptyLocalizedValue(),
        openLabel: emptyLocalizedValue()
    };

    tabEyebrow.textContent = 'Notion';
    tabTitle.textContent = 'Formulaire de contact';
    addButton.hidden = true;
    editor.replaceChildren();

    const panel = document.createElement('section');
    panel.className = 'publish-panel';

    const intro = document.createElement('p');
    intro.className = 'dashboard-note';
    intro.textContent = 'Utilise une URL de formulaire Notion public. Ne mets pas de token Notion ici: sur GitHub Pages, un token serait visible côté navigateur.';

    const body = document.createElement('div');
    body.className = 'field-grid';

    const urlField = document.createElement('div');
    urlField.className = 'field full';
    const urlLabel = document.createElement('label');
    urlLabel.setAttribute('for', 'notionFormUrl');
    urlLabel.textContent = 'URL publique du formulaire Notion';
    const urlInput = document.createElement('input');
    urlInput.id = 'notionFormUrl';
    urlInput.type = 'url';
    urlInput.placeholder = 'https://www.notion.so/forms/...';
    urlInput.value = state.data.contact.notionFormUrl || '';
    urlInput.addEventListener('input', () => {
        state.data.contact.notionFormUrl = urlInput.value.trim();
        updateCounts();
    });
    urlField.append(urlLabel, urlInput);
    body.append(urlField);

    renderLocalizedInputs(state.data.contact, 'iframeTitle', 'Titre iframe').forEach((field) => body.append(field));
    renderLocalizedInputs(state.data.contact, 'openLabel', 'Lien de secours').forEach((field) => body.append(field));

    const actions = document.createElement('div');
    actions.className = 'toolbar-actions';
    actions.append(createButton('Ouvrir le formulaire', 'secondary-button', () => {
        if (state.data.contact.notionFormUrl) {
            window.open(state.data.contact.notionFormUrl, '_blank', 'noreferrer');
        }
    }));

    panel.append(intro, body, actions);
    editor.append(panel);
}

function renderPublish() {
    const savedConfig = JSON.parse(localStorage.getItem(GITHUB_CONFIG_KEY) || '{}');
    state.data.cv = state.data.cv || { pdfUrl: '', printLabel: emptyLocalizedValue() };
    tabEyebrow.textContent = 'GitHub Pages';
    tabTitle.textContent = 'Publication';
    addButton.hidden = true;
    editor.replaceChildren();

    const panel = document.createElement('section');
    panel.className = 'publish-panel';
    panel.innerHTML = `
        <div class="settings-block">
            <h3>CV / PDF</h3>
            <div class="field-grid">
                <div class="field full">
                    <label for="cvPdfUrl">URL d'un PDF existant (optionnel)</label>
                    <input id="cvPdfUrl" type="url" placeholder="assets/cv.pdf ou https://...">
                </div>
                <div id="cvLabelFields" class="field-grid full"></div>
            </div>
        </div>
        <div class="publish-grid">
            <div class="field">
                <label for="githubOwner">Propriétaire GitHub</label>
                <input id="githubOwner" autocomplete="username">
            </div>
            <div class="field">
                <label for="githubRepo">Dépôt</label>
                <input id="githubRepo">
            </div>
            <div class="field">
                <label for="githubBranch">Branche</label>
                <input id="githubBranch">
            </div>
            <div class="field">
                <label for="githubPath">Fichier à publier</label>
                <input id="githubPath">
            </div>
            <div class="field full">
                <label for="githubToken">Token GitHub personnel</label>
                <input id="githubToken" type="password" autocomplete="off">
            </div>
            <label class="checkbox-row field full">
                <input id="rememberToken" type="checkbox">
                Garder le token dans ce navigateur
            </label>
        </div>
    `;

    panel.querySelector('#cvPdfUrl').value = state.data.cv.pdfUrl || '';
    panel.querySelector('#cvPdfUrl').addEventListener('input', (event) => {
        state.data.cv.pdfUrl = event.target.value.trim();
    });
    const cvLabelFields = panel.querySelector('#cvLabelFields');
    renderLocalizedInputs(state.data.cv, 'printLabel', 'Libellé du bouton PDF').forEach((field) => cvLabelFields.append(field));

    panel.querySelector('#githubOwner').value = savedConfig.owner || 'Matt0967';
    panel.querySelector('#githubRepo').value = savedConfig.repo || 'portefolio';
    panel.querySelector('#githubBranch').value = savedConfig.branch || 'main';
    panel.querySelector('#githubPath').value = savedConfig.path || DATA_PATH;
    panel.querySelector('#githubToken').value = localStorage.getItem(GITHUB_TOKEN_KEY) || '';
    panel.querySelector('#rememberToken').checked = Boolean(localStorage.getItem(GITHUB_TOKEN_KEY));

    const actions = document.createElement('div');
    actions.className = 'toolbar-actions';
    actions.append(
        createButton('Tester la configuration', 'secondary-button', testGitHubConfig),
        createButton('Aperçu avant publication', 'secondary-button', renderPublicationPreview),
        createButton('Publier sur GitHub', 'primary-button', publishToGitHub)
    );

    const previewMount = document.createElement('div');
    previewMount.id = 'publishPreview';
    previewMount.className = 'preview-panel';
    previewMount.append(createEmptyState('Aucun aperçu généré.'));

    panel.append(actions);
    panel.append(previewMount);
    editor.append(panel);
}

function renderStats() {
    const savedConfig = JSON.parse(localStorage.getItem(GITHUB_CONFIG_KEY) || '{}');
    state.data.analytics = state.data.analytics || { provider: 'none', domain: '', siteId: '', scriptUrl: '' };
    tabEyebrow.textContent = 'Trafic GitHub';
    tabTitle.textContent = 'Stats';
    addButton.hidden = true;
    editor.replaceChildren();

    const panel = document.createElement('section');
    panel.className = 'publish-panel';
    panel.innerHTML = `
        <p class="dashboard-note">GitHub ne donne les stats de trafic que pour les 14 derniers jours et seulement avec un token autorisé sur le dépôt. Sans backend, il n'y a pas de compteur de visites permanent fiable.</p>
        <div class="settings-block">
            <h3>Analytics public optionnel</h3>
            <p class="dashboard-note">Configure Plausible, Umami ou GoatCounter si tu veux de vraies stats de visite du site. Aucun token secret ne doit être mis ici.</p>
            <div class="publish-grid">
                <div class="field">
                    <label for="analyticsProvider">Provider</label>
                    <select id="analyticsProvider">
                        <option value="none">Aucun</option>
                        <option value="plausible">Plausible</option>
                        <option value="umami">Umami</option>
                        <option value="goatcounter">GoatCounter</option>
                    </select>
                </div>
                <div class="field">
                    <label for="analyticsDomain">Domaine Plausible</label>
                    <input id="analyticsDomain" placeholder="matt0967.github.io">
                </div>
                <div class="field">
                    <label for="analyticsSiteId">Site ID / endpoint</label>
                    <input id="analyticsSiteId" placeholder="ID Umami ou URL GoatCounter">
                </div>
                <div class="field">
                    <label for="analyticsScriptUrl">Script URL optionnelle</label>
                    <input id="analyticsScriptUrl" placeholder="https://.../script.js">
                </div>
            </div>
        </div>
        <div class="publish-grid">
            <div class="field">
                <label for="statsOwner">Propriétaire GitHub</label>
                <input id="statsOwner" autocomplete="username">
            </div>
            <div class="field">
                <label for="statsRepo">Dépôt</label>
                <input id="statsRepo">
            </div>
            <div class="field full">
                <label for="statsToken">Token GitHub personnel</label>
                <input id="statsToken" type="password" autocomplete="off">
            </div>
            <label class="checkbox-row field full">
                <input id="statsRememberToken" type="checkbox">
                Réutiliser ce token dans ce navigateur
            </label>
        </div>
    `;

    panel.querySelector('#analyticsProvider').value = state.data.analytics.provider || 'none';
    panel.querySelector('#analyticsDomain').value = state.data.analytics.domain || '';
    panel.querySelector('#analyticsSiteId').value = state.data.analytics.siteId || '';
    panel.querySelector('#analyticsScriptUrl').value = state.data.analytics.scriptUrl || '';
    panel.querySelector('#analyticsProvider').addEventListener('change', (event) => {
        state.data.analytics.provider = event.target.value;
    });
    panel.querySelector('#analyticsDomain').addEventListener('input', (event) => {
        state.data.analytics.domain = event.target.value.trim();
    });
    panel.querySelector('#analyticsSiteId').addEventListener('input', (event) => {
        state.data.analytics.siteId = event.target.value.trim();
    });
    panel.querySelector('#analyticsScriptUrl').addEventListener('input', (event) => {
        state.data.analytics.scriptUrl = event.target.value.trim();
    });

    panel.querySelector('#statsOwner').value = savedConfig.owner || 'Matt0967';
    panel.querySelector('#statsRepo').value = savedConfig.repo || 'portefolio';
    panel.querySelector('#statsToken').value = localStorage.getItem(GITHUB_TOKEN_KEY) || '';
    panel.querySelector('#statsRememberToken').checked = Boolean(localStorage.getItem(GITHUB_TOKEN_KEY));

    const actions = document.createElement('div');
    actions.className = 'toolbar-actions';
    actions.append(createButton('Rafraîchir les stats', 'primary-button', loadGitHubStats));

    const statsMount = document.createElement('div');
    statsMount.id = 'statsMount';
    statsMount.append(createEmptyState('Renseigne le token puis rafraîchis les stats.'));

    panel.append(actions, statsMount);
    editor.append(panel);
}

function getAiConfig() {
    try {
        return {
            ...DEFAULT_AI_CONFIG,
            ...JSON.parse(localStorage.getItem(AI_CONFIG_KEY) || '{}')
        };
    } catch (error) {
        return { ...DEFAULT_AI_CONFIG };
    }
}

function saveAiConfig(config, apiKey) {
    const safeConfig = {
        provider: config.provider,
        openaiModel: config.openaiModel,
        geminiModel: config.geminiModel,
        anthropicModel: config.anthropicModel,
        customModel: config.customModel,
        customEndpoint: config.customEndpoint,
        sourceLocale: config.sourceLocale,
        targetLocales: config.targetLocales,
        rememberKey: config.rememberKey
    };

    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(safeConfig));

    if (apiKey) {
        if (config.rememberKey) {
            localStorage.setItem(AI_LOCAL_KEY, apiKey);
            sessionStorage.removeItem(AI_SESSION_KEY);
        } else {
            sessionStorage.setItem(AI_SESSION_KEY, apiKey);
            localStorage.removeItem(AI_LOCAL_KEY);
        }
    } else if (!config.rememberKey) {
        localStorage.removeItem(AI_LOCAL_KEY);
    }
}

function getSavedAiKey() {
    return sessionStorage.getItem(AI_SESSION_KEY) || localStorage.getItem(AI_LOCAL_KEY) || '';
}

function isLocalizedRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }

    const keys = Object.keys(value);
    return keys.length > 0 && keys.every((key) => LOCALES.includes(key)) && keys.some((key) => typeof value[key] === 'string');
}

function collectTranslationItems(sourceLocale, targetLocales, overwriteExisting) {
    const items = [];

    function walk(value, path) {
        if (isLocalizedRecord(value)) {
            const sourceText = (value[sourceLocale] || '').trim();

            if (!sourceText) {
                return;
            }

            targetLocales.forEach((targetLocale) => {
                if (targetLocale === sourceLocale) {
                    return;
                }

                if (!overwriteExisting && (value[targetLocale] || '').trim()) {
                    return;
                }

                items.push({
                    id: `translation-${items.length + 1}`,
                    path: path.join('.'),
                    sourceLocale,
                    targetLocale,
                    sourceText,
                    record: value
                });
            });
            return;
        }

        if (Array.isArray(value)) {
            value.forEach((item, index) => walk(item, [...path, String(index)]));
            return;
        }

        if (value && typeof value === 'object') {
            Object.entries(value).forEach(([key, nextValue]) => walk(nextValue, [...path, key]));
        }
    }

    walk(state.data, ['portfolio']);
    return items;
}

function createTranslationPrompt(items) {
    const payload = items.map(({ id, path, sourceLocale, targetLocale, sourceText }) => ({
        id,
        path,
        sourceLocale,
        targetLocale,
        sourceText
    }));

    return [
        'Tu es un assistant de traduction pour un portfolio professionnel.',
        'Traduis chaque sourceText dans targetLocale.',
        'Garde les termes techniques, noms propres, URLs, marques, langages et tokens comme HTML, CSS, JS, API, GitHub, Arduino.',
        'Retourne uniquement un JSON valide au format: {"translations":[{"id":"...","targetLocale":"...","text":"..."}]}',
        '',
        JSON.stringify({ translationsToDo: payload }, null, 2)
    ].join('\n');
}

function extractOpenAiText(payload) {
    if (payload.output_text) {
        return payload.output_text;
    }

    return (payload.output || [])
        .flatMap((item) => item.content || [])
        .map((content) => content.text || '')
        .filter(Boolean)
        .join('\n');
}

function extractAnthropicText(payload) {
    return (payload.content || [])
        .map((part) => part.text || '')
        .filter(Boolean)
        .join('\n');
}

function extractChatCompletionText(payload) {
    return payload.choices?.[0]?.message?.content || payload.choices?.[0]?.text || '';
}

function parseTranslationResponse(text) {
    const cleaned = text.trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '');
    const parsed = JSON.parse(cleaned);
    const translations = Array.isArray(parsed) ? parsed : parsed.translations;

    if (!Array.isArray(translations)) {
        throw new Error('Réponse IA invalide: tableau translations introuvable.');
    }

    return translations;
}

async function generateWithOpenAI(config, apiKey, prompt) {
    const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: config.openaiModel || DEFAULT_AI_CONFIG.openaiModel,
            input: prompt,
            temperature: 0
        })
    });

    if (!response.ok) {
        throw new Error(`OpenAI a refusé la demande (${response.status}). Vérifie la clé, le modèle et les permissions.`);
    }

    return extractOpenAiText(await response.json());
}

async function generateWithGemini(config, apiKey, prompt, options = {}) {
    const model = encodeURIComponent(config.geminiModel || DEFAULT_AI_CONFIG.geminiModel);
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
            contents: [
                {
                    parts: [
                        { text: prompt }
                    ]
                }
            ],
            generationConfig: {
                ...(options.json ? { responseMimeType: 'application/json' } : {}),
                temperature: 0
            }
        })
    });

    if (!response.ok) {
        throw new Error(`Gemini a refusé la demande (${response.status}). Vérifie la clé, le modèle et les restrictions API.`);
    }

    const payload = await response.json();
    return (payload.candidates?.[0]?.content?.parts || [])
        .map((part) => part.text || '')
        .filter(Boolean)
        .join('\n');
}

async function generateWithAnthropic(config, apiKey, prompt) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: config.anthropicModel || DEFAULT_AI_CONFIG.anthropicModel,
            max_tokens: 4096,
            temperature: 0,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ]
        })
    });

    if (!response.ok) {
        throw new Error(`Anthropic a refusé la demande (${response.status}). Vérifie la clé, le modèle et les permissions.`);
    }

    return extractAnthropicText(await response.json());
}

async function generateWithCustomEndpoint(config, apiKey, prompt) {
    const endpoint = (config.customEndpoint || '').trim();

    if (!endpoint) {
        throw new Error('Ajoute une URL complète pour l’endpoint compatible OpenAI.');
    }

    const headers = { 'Content-Type': 'application/json' };

    if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            model: config.customModel || DEFAULT_AI_CONFIG.customModel,
            temperature: 0,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ]
        })
    });

    if (!response.ok) {
        throw new Error(`Endpoint compatible OpenAI refusé (${response.status}). Vérifie l’URL, la clé et le CORS.`);
    }

    return extractChatCompletionText(await response.json());
}

async function generateAiText(config, apiKey, prompt, options = {}) {
    if (config.provider === 'openai') {
        return generateWithOpenAI(config, apiKey, prompt);
    }

    if (config.provider === 'gemini') {
        return generateWithGemini(config, apiKey, prompt, options);
    }

    if (config.provider === 'anthropic') {
        return generateWithAnthropic(config, apiKey, prompt);
    }

    if (config.provider === 'custom') {
        return generateWithCustomEndpoint(config, apiKey, prompt);
    }

    throw new Error('Sélectionne un fournisseur IA direct ou utilise le mode gratuit par prompt.');
}

function applyTranslationResults(items, translations) {
    const itemsById = new Map(items.map((item) => [item.id, item]));
    let applied = 0;

    translations.forEach((translation) => {
        const item = itemsById.get(translation.id);
        const text = typeof translation.text === 'string' ? translation.text.trim() : '';

        if (!item || !text) {
            return;
        }

        item.record[item.targetLocale] = text;
        applied += 1;
    });

    return applied;
}

function readAiFormConfig() {
    const targetLocales = Array.from(document.querySelectorAll('[data-ai-target-locale]:checked'))
        .map((input) => input.dataset.aiTargetLocale);

    return {
        provider: document.getElementById('aiProvider')?.value || 'manual',
        openaiModel: document.getElementById('aiOpenAIModel')?.value.trim() || DEFAULT_AI_CONFIG.openaiModel,
        geminiModel: document.getElementById('aiGeminiModel')?.value.trim() || DEFAULT_AI_CONFIG.geminiModel,
        anthropicModel: document.getElementById('aiAnthropicModel')?.value.trim() || DEFAULT_AI_CONFIG.anthropicModel,
        customModel: document.getElementById('aiCustomModel')?.value.trim() || DEFAULT_AI_CONFIG.customModel,
        customEndpoint: document.getElementById('aiCustomEndpoint')?.value.trim() || '',
        sourceLocale: document.getElementById('aiSourceLocale')?.value || 'fr',
        targetLocales: targetLocales.length ? targetLocales : ['en', 'es'],
        rememberKey: Boolean(document.getElementById('aiRememberKey')?.checked),
        overwriteExisting: Boolean(document.getElementById('aiOverwrite')?.checked)
    };
}

function getAiTranslationContext() {
    const config = readAiFormConfig();
    const apiKey = document.getElementById('aiApiKey')?.value.trim() || getSavedAiKey();
    const items = collectTranslationItems(config.sourceLocale, config.targetLocales, config.overwriteExisting);
    saveAiConfig(config, apiKey);
    return { apiKey, config, items };
}

function setAiOutput(message) {
    const output = document.getElementById('aiTranslationOutput');

    if (output) {
        output.textContent = message;
    }
}

async function copyManualTranslationPrompt() {
    try {
        const { items } = getAiTranslationContext();

        if (!items.length) {
            setAiOutput('Rien à traduire. Active "remplacer les traductions existantes" si tu veux tout retraduire.');
            return;
        }

        const prompt = createTranslationPrompt(items);
        await navigator.clipboard.writeText(prompt);
        setAiOutput(`Prompt copié. ${items.length} traduction(s) à produire. Colle-le dans ChatGPT/Gemini gratuit, puis colle le JSON de réponse ici.`);
        setStatus('Prompt de traduction copié.', 'ready');
    } catch (error) {
        setAiOutput(`Copie impossible: ${error.message}`);
        setStatus('Copie du prompt impossible.', 'error');
    }
}

function createWritingPrompt(instruction, sourceText, locale) {
    return [
        'Tu es un assistant de rédaction pour un portfolio professionnel de développeur junior et administrateur réseaux.',
        `Langue demandée: ${locale.toUpperCase()}.`,
        'Écris un texte clair, crédible, professionnel, sans exagérer le niveau.',
        'Garde les termes techniques exacts quand ils sont utiles.',
        'Retourne uniquement le texte final, sans guillemets, sans markdown, sans explication.',
        '',
        `Objectif: ${instruction || 'améliorer le texte fourni'}`,
        '',
        'Texte de départ:',
        sourceText || '(aucun texte fourni)'
    ].join('\n');
}

function setWritingOutput(message) {
    const output = document.getElementById('aiWritingOutput');

    if (output) {
        output.value = message;
    }
}

async function runWritingAssistant() {
    const config = readAiFormConfig();
    const apiKey = document.getElementById('aiApiKey')?.value.trim() || getSavedAiKey();
    const instruction = document.getElementById('aiWritingInstruction')?.value.trim() || '';
    const sourceText = document.getElementById('aiWritingSource')?.value.trim() || '';
    const locale = document.getElementById('aiWritingLocale')?.value || config.sourceLocale || 'fr';
    const prompt = createWritingPrompt(instruction, sourceText, locale);

    saveAiConfig(config, apiKey);

    if (config.provider === 'manual') {
        try {
            await navigator.clipboard.writeText(prompt);
            setWritingOutput('Prompt de rédaction copié. Colle-le dans une IA gratuite, puis récupère le texte obtenu.');
            setStatus('Prompt de rédaction copié.', 'ready');
        } catch (error) {
            setWritingOutput(`Copie impossible: ${error.message}`);
            setStatus('Copie du prompt impossible.', 'error');
        }
        return;
    }

    if (!apiKey && config.provider !== 'custom') {
        setWritingOutput('Ajoute une clé API ou passe en mode gratuit par prompt.');
        return;
    }

    try {
        setWritingOutput('Rédaction en cours...');
        const text = await generateAiText(config, apiKey, prompt);
        setWritingOutput(text.trim());
        setStatus('Texte généré.', 'ready');
    } catch (error) {
        setWritingOutput(`${error.message}\n\nSi le navigateur bloque la requête, utilise le mode gratuit par prompt.`);
        setStatus('Rédaction IA impossible.', 'error');
    }
}

async function runDirectAiTranslation() {
    const { apiKey, config, items } = getAiTranslationContext();

    if (!items.length) {
        setAiOutput('Rien à traduire. Active "remplacer les traductions existantes" si tu veux tout retraduire.');
        return;
    }

    if (config.provider === 'manual') {
        setAiOutput('Le mode actuel est gratuit: utilise "Copier le prompt gratuit", puis colle le JSON de réponse dans la zone d’import.');
        return;
    }

    if (!apiKey && config.provider !== 'custom') {
        setAiOutput('Ajoute une clé API ou utilise le mode gratuit avec prompt à copier.');
        return;
    }

    try {
        setAiOutput(`Traduction en cours: ${items.length} élément(s)...`);
        const translatedText = await generateAiText(config, apiKey, createTranslationPrompt(items), { json: true });
        const translations = parseTranslationResponse(translatedText);
        state.activePage = 'tools';
        state.activeTab = 'ai';
        const applied = applyTranslationResults(items, translations);
        render();
        setAiOutput(`${applied} traduction(s) appliquée(s). Pense à sauvegarder le brouillon ou publier le JSON.`);
        setStatus('Traductions IA appliquées.', 'ready');
    } catch (error) {
        setAiOutput(`${error.message}\n\nSi le navigateur bloque la requête ou si tu veux éviter les coûts, utilise le mode gratuit: copie le prompt, colle-le dans une interface IA gratuite, puis importe le JSON de réponse.`);
        setStatus('Traduction IA impossible.', 'error');
    }
}

function applyPastedTranslations() {
    try {
        const { config, items } = getAiTranslationContext();
        const pasted = document.getElementById('aiPasteJson')?.value || '';

        if (!pasted.trim()) {
            setAiOutput('Colle d’abord le JSON retourné par l’IA.');
            return;
        }

        const translations = parseTranslationResponse(pasted);
        state.activePage = 'tools';
        state.activeTab = 'ai';
        const applied = applyTranslationResults(items, translations);
        render();
        setAiOutput(`${applied} traduction(s) importée(s) depuis le JSON. Source: ${config.sourceLocale.toUpperCase()}.`);
        setStatus('Traductions importées.', 'ready');
    } catch (error) {
        setAiOutput(`JSON invalide: ${error.message}`);
        setStatus('Import des traductions impossible.', 'error');
    }
}

function renderAITranslation() {
    const config = getAiConfig();
    tabEyebrow.textContent = 'Outils';
    tabTitle.textContent = 'Traduction IA';
    addButton.hidden = true;
    editor.replaceChildren();

    const panel = document.createElement('section');
    panel.className = 'publish-panel';
    panel.innerHTML = `
        <p class="ai-warning">Ne mets jamais une clé API dans <code>portfolio-data.json</code> ou dans un commit. Ici, la clé reste seulement dans ton navigateur. Le mode session est le plus prudent.</p>
        <div class="admin-card-grid">
            <div class="admin-mini-card"><strong>Direct</strong><span>OpenAI, Gemini, Anthropic ou endpoint compatible OpenAI.</span></div>
            <div class="admin-mini-card"><strong>Gratuit</strong><span>Copie un prompt, utilise une interface gratuite, puis colle le JSON.</span></div>
            <div class="admin-mini-card"><strong>Statique</strong><span>Aucun backend ajouté, compatible GitHub Pages.</span></div>
        </div>
        <div class="settings-block">
            <h3>Configuration IA</h3>
            <div class="ai-grid">
                <div class="field">
                    <label for="aiProvider">Mode</label>
                    <select id="aiProvider">
                        <option value="manual">Gratuit: prompt à copier</option>
                        <option value="openai">OpenAI API</option>
                        <option value="gemini">Gemini API</option>
                        <option value="anthropic">Anthropic API</option>
                        <option value="custom">Endpoint compatible OpenAI</option>
                    </select>
                </div>
                <div class="field">
                    <label for="aiSourceLocale">Source</label>
                    <select id="aiSourceLocale">
                        <option value="fr">Français</option>
                        <option value="en">Anglais</option>
                        <option value="es">Espagnol</option>
                    </select>
                </div>
                <div class="field">
                    <label>Langues cibles</label>
                    <div class="ai-targets">
                        <label><input type="checkbox" data-ai-target-locale="fr"> FR</label>
                        <label><input type="checkbox" data-ai-target-locale="en"> EN</label>
                        <label><input type="checkbox" data-ai-target-locale="es"> ES</label>
                    </div>
                </div>
                <div class="field ai-provider-field" data-ai-provider-field="openai">
                    <label for="aiOpenAIModel">Modèle OpenAI</label>
                    <input id="aiOpenAIModel" placeholder="gpt-4o-mini">
                </div>
                <div class="field ai-provider-field" data-ai-provider-field="gemini">
                    <label for="aiGeminiModel">Modèle Gemini</label>
                    <input id="aiGeminiModel" placeholder="gemini-1.5-flash">
                </div>
                <div class="field ai-provider-field" data-ai-provider-field="anthropic">
                    <label for="aiAnthropicModel">Modèle Anthropic</label>
                    <input id="aiAnthropicModel" placeholder="claude-3-5-haiku-latest">
                </div>
                <div class="field ai-provider-field" data-ai-provider-field="custom">
                    <label for="aiCustomModel">Modèle endpoint compatible</label>
                    <input id="aiCustomModel" placeholder="gpt-4o-mini">
                </div>
                <div class="field full ai-provider-field" data-ai-provider-field="custom">
                    <label for="aiCustomEndpoint">URL endpoint compatible OpenAI</label>
                    <input id="aiCustomEndpoint" type="url" placeholder="https://exemple.com/v1/chat/completions">
                </div>
                <div class="field full ai-api-field">
                    <label for="aiApiKey">Clé API</label>
                    <input id="aiApiKey" type="password" autocomplete="off" placeholder="Coller une clé API uniquement si tu utilises un fournisseur direct">
                </div>
                <label class="checkbox-row field full ai-api-field">
                    <input id="aiRememberKey" type="checkbox">
                    Garder la clé dans ce navigateur
                </label>
                <label class="checkbox-row field full">
                    <input id="aiOverwrite" type="checkbox">
                    Remplacer aussi les traductions déjà existantes
                </label>
            </div>
        </div>
        <div class="ai-actions">
            <button class="secondary-button" type="button" id="copyTranslationPrompt">Copier le prompt gratuit</button>
            <button class="primary-button" type="button" id="runAiTranslation">Traduire directement</button>
            <button class="ghost-button" type="button" id="clearAiKey">Effacer la clé locale</button>
        </div>
        <div class="settings-block">
            <h3>Rédaction assistée</h3>
            <div class="field-grid">
                <div class="field">
                    <label for="aiWritingLocale">Langue du texte</label>
                    <select id="aiWritingLocale">
                        <option value="fr">Français</option>
                        <option value="en">Anglais</option>
                        <option value="es">Espagnol</option>
                    </select>
                </div>
                <div class="field full">
                    <label for="aiWritingInstruction">Ce que l’IA doit écrire ou améliorer</label>
                    <input id="aiWritingInstruction" placeholder="Ex: améliorer mon texte À propos en restant simple et professionnel">
                </div>
                <div class="field full">
                    <label for="aiWritingSource">Texte de départ optionnel</label>
                    <textarea id="aiWritingSource" placeholder="Colle ici un brouillon à améliorer, ou laisse vide pour générer depuis l’objectif."></textarea>
                </div>
                <div class="field full">
                    <label for="aiWritingOutput">Résultat</label>
                    <textarea id="aiWritingOutput" readonly placeholder="Le texte généré apparaîtra ici."></textarea>
                </div>
            </div>
            <button class="secondary-button" type="button" id="runAiWriting">Générer / copier le prompt</button>
        </div>
        <div class="settings-block">
            <h3>Importer une réponse gratuite</h3>
            <div class="field">
                <label for="aiPasteJson">JSON retourné par l’IA</label>
                <textarea id="aiPasteJson" placeholder='{"translations":[{"id":"translation-1","targetLocale":"en","text":"..."}]}'></textarea>
            </div>
            <button class="secondary-button" type="button" id="applyPastedTranslations">Appliquer le JSON collé</button>
        </div>
        <pre class="translation-output" id="aiTranslationOutput">Prêt. Choisis un mode puis lance une action.</pre>
    `;

    panel.querySelector('#aiProvider').value = config.provider || 'manual';
    panel.querySelector('#aiSourceLocale').value = config.sourceLocale || 'fr';
    panel.querySelector('#aiOpenAIModel').value = config.openaiModel || DEFAULT_AI_CONFIG.openaiModel;
    panel.querySelector('#aiGeminiModel').value = config.geminiModel || DEFAULT_AI_CONFIG.geminiModel;
    panel.querySelector('#aiAnthropicModel').value = config.anthropicModel || DEFAULT_AI_CONFIG.anthropicModel;
    panel.querySelector('#aiCustomModel').value = config.customModel || DEFAULT_AI_CONFIG.customModel;
    panel.querySelector('#aiCustomEndpoint').value = config.customEndpoint || '';
    panel.querySelector('#aiApiKey').value = getSavedAiKey();
    panel.querySelector('#aiRememberKey').checked = Boolean(config.rememberKey && localStorage.getItem(AI_LOCAL_KEY));
    (config.targetLocales || ['en', 'es']).forEach((locale) => {
        const input = panel.querySelector(`[data-ai-target-locale="${locale}"]`);
        if (input) {
            input.checked = true;
        }
    });

    function updateProviderFields() {
        const selectedProvider = panel.querySelector('#aiProvider').value;
        panel.querySelectorAll('[data-ai-provider-field]').forEach((field) => {
            field.hidden = field.dataset.aiProviderField !== selectedProvider;
        });
        panel.querySelectorAll('.ai-api-field').forEach((field) => {
            field.hidden = selectedProvider === 'manual';
        });
    }

    updateProviderFields();
    panel.querySelector('#aiProvider').addEventListener('change', updateProviderFields);
    panel.querySelector('#copyTranslationPrompt').addEventListener('click', copyManualTranslationPrompt);
    panel.querySelector('#runAiTranslation').addEventListener('click', runDirectAiTranslation);
    panel.querySelector('#runAiWriting').addEventListener('click', runWritingAssistant);
    panel.querySelector('#applyPastedTranslations').addEventListener('click', applyPastedTranslations);
    panel.querySelector('#clearAiKey').addEventListener('click', () => {
        localStorage.removeItem(AI_LOCAL_KEY);
        sessionStorage.removeItem(AI_SESSION_KEY);
        panel.querySelector('#aiApiKey').value = '';
        setAiOutput('Clé API effacée de ce navigateur.');
    });

    editor.append(panel);
}

function collectStatsConfig() {
    const config = {
        owner: document.getElementById('statsOwner')?.value.trim(),
        repo: document.getElementById('statsRepo')?.value.trim()
    };
    const token = document.getElementById('statsToken')?.value.trim();
    const rememberToken = document.getElementById('statsRememberToken')?.checked;

    if (!config.owner || !config.repo || !token) {
        throw new Error('Configuration stats incomplète.');
    }

    const savedConfig = JSON.parse(localStorage.getItem(GITHUB_CONFIG_KEY) || '{}');
    localStorage.setItem(GITHUB_CONFIG_KEY, JSON.stringify({ ...savedConfig, owner: config.owner, repo: config.repo }));

    if (rememberToken) {
        localStorage.setItem(GITHUB_TOKEN_KEY, token);
    } else {
        localStorage.removeItem(GITHUB_TOKEN_KEY);
    }

    return { ...config, token };
}

async function fetchGitHubJson(url, token, fallback) {
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json'
        }
    });

    if (!response.ok) {
        throw new Error(await createGitHubErrorMessage(response, fallback));
    }

    return response.json();
}

function createStatCard(value, label) {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.append(createText('strong', value), createText('span', label));
    return card;
}

function createText(tagName, text) {
    const element = document.createElement(tagName);
    element.textContent = text;
    return element;
}

function renderTrafficChart(days) {
    const chart = document.createElement('div');
    chart.className = 'traffic-chart';
    const maxCount = Math.max(1, ...days.map((day) => day.count || 0));

    days.forEach((day) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'traffic-bar-wrap';
        wrapper.title = `${new Date(day.timestamp).toLocaleDateString('fr-FR')}: ${day.count || 0} vues, ${day.uniques || 0} visiteurs`;

        const bar = document.createElement('div');
        bar.className = 'traffic-bar';
        bar.style.height = `${Math.max(8, ((day.count || 0) / maxCount) * 120)}px`;

        const label = document.createElement('span');
        label.className = 'traffic-bar-label';
        label.textContent = new Date(day.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

        wrapper.append(bar, label);
        chart.append(wrapper);
    });

    return chart;
}

function renderHeatmap(days) {
    const heatmap = document.createElement('div');
    heatmap.className = 'heatmap';
    const maxCount = Math.max(1, ...days.map((day) => day.count || 0));

    days.forEach((day) => {
        const cell = document.createElement('span');
        const ratio = (day.count || 0) / maxCount;
        const level = ratio === 0 ? 0 : ratio < 0.25 ? 1 : ratio < 0.5 ? 2 : ratio < 0.75 ? 3 : 4;
        cell.className = 'heatmap-cell';
        cell.dataset.level = String(level);
        cell.title = `${new Date(day.timestamp).toLocaleDateString('fr-FR')}: ${day.count || 0} vues`;
        heatmap.append(cell);
    });

    return heatmap;
}

function renderStatsList(title, items, primaryKey, valueKey) {
    const section = document.createElement('section');
    section.className = 'stats-section';
    section.append(createText('h3', title));

    const list = document.createElement('div');
    list.className = 'stats-list';

    if (!items.length) {
        list.append(createEmptyState('Aucune donnée disponible.'));
    }

    items.slice(0, 8).forEach((item) => {
        const row = document.createElement('div');
        row.className = 'stats-row';
        row.append(createText('span', item[primaryKey] || 'Inconnu'), createText('strong', String(item[valueKey] || 0)));
        list.append(row);
    });

    section.append(list);
    return section;
}

async function loadGitHubStats() {
    const mount = document.getElementById('statsMount');

    try {
        const config = collectStatsConfig();
        mount.replaceChildren(createEmptyState('Chargement des stats GitHub...'));
        const baseUrl = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`;

        const [repo, views, clones, referrers, paths] = await Promise.all([
            fetchGitHubJson(baseUrl, config.token, 'Dépôt GitHub inaccessible'),
            fetchGitHubJson(`${baseUrl}/traffic/views`, config.token, 'Stats de vues indisponibles'),
            fetchGitHubJson(`${baseUrl}/traffic/clones`, config.token, 'Stats de clones indisponibles'),
            fetchGitHubJson(`${baseUrl}/traffic/popular/referrers`, config.token, 'Referrers indisponibles'),
            fetchGitHubJson(`${baseUrl}/traffic/popular/paths`, config.token, 'Pages populaires indisponibles')
        ]);

        const summary = document.createElement('div');
        summary.className = 'stats-grid';
        summary.append(
            createStatCard(String(views.count || 0), 'vues sur 14 jours'),
            createStatCard(String(views.uniques || 0), 'visiteurs uniques'),
            createStatCard(String(clones.count || 0), 'clones du dépôt'),
            createStatCard(String(repo.stargazers_count || 0), 'étoiles GitHub')
        );

        const chartSection = document.createElement('section');
        chartSection.className = 'stats-section';
        chartSection.append(createText('h3', 'Vues par jour'), renderTrafficChart(views.views || []));

        const heatmapSection = document.createElement('section');
        heatmapSection.className = 'stats-section';
        heatmapSection.append(createText('h3', 'Heatmap live des visites'), renderHeatmap(views.views || []));

        const updated = document.createElement('p');
        updated.className = 'stats-updated';
        updated.textContent = `Dernier rafraîchissement: ${new Date().toLocaleString('fr-FR')}. Données fournies par GitHub Traffic API.`;

        mount.replaceChildren(
            summary,
            chartSection,
            heatmapSection,
            renderStatsList('Sources de trafic', referrers || [], 'referrer', 'count'),
            renderStatsList('Pages les plus vues', paths || [], 'path', 'count'),
            updated
        );
        setStatus('Stats GitHub chargées.', 'ready');
    } catch (error) {
        mount.replaceChildren(createEmptyState(error.message));
        setStatus(error.message, 'error');
    }
}

function renderPublicationPreview() {
    const mount = document.getElementById('publishPreview');

    if (!mount) {
        return;
    }

    const summary = document.createElement('div');
    summary.className = 'preview-summary';
    summary.append(
        createStatCard(String(state.data.projects.length), 'projets'),
        createStatCard(String(state.data.skills.length), 'catégories de compétences'),
        createStatCard(String(state.data.interests.length), 'centres d’intérêt'),
        createStatCard(String(state.data.education.length), 'formations')
    );

    const projectList = document.createElement('div');
    projectList.className = 'stats-list';
    state.data.projects.slice(0, 5).forEach((project) => {
        const row = document.createElement('div');
        row.className = 'stats-row';
        row.append(
            createText('span', getLocalizedValue(project.title, 'fr') || 'Projet sans titre'),
            createText('strong', getLocalizedValue(project.status, 'fr') || 'Sans statut')
        );
        projectList.append(row);
    });

    const meta = document.createElement('p');
    meta.className = 'dashboard-note';
    meta.textContent = `Analytics: ${state.data.analytics?.provider || 'none'} // PDF: ${state.data.cv?.pdfUrl ? 'fichier externe' : 'export navigateur'}`;

    const jsonPreview = document.createElement('pre');
    jsonPreview.className = 'json-preview';
    jsonPreview.textContent = serializeData();

    mount.replaceChildren(
        createText('h3', 'Aperçu du contenu à publier'),
        summary,
        createText('h3', 'Projets visibles'),
        projectList,
        meta,
        jsonPreview
    );
    setStatus('Aperçu généré depuis les données actuelles.', 'ready');
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

    document.querySelectorAll('.page-tab').forEach((pageTab) => {
        pageTab.classList.toggle('is-active', pageTab.dataset.page === state.activePage);
    });

    document.querySelectorAll('.tab').forEach((tab) => {
        const belongsToCurrentPage = tab.dataset.page === state.activePage;
        tab.hidden = !belongsToCurrentPage;
        tab.classList.toggle('is-active', tab.dataset.tab === state.activeTab);
    });

    const renderers = {
        projects: renderProjects,
        skills: renderSkills,
        interests: renderInterests,
        education: renderEducation,
        languages: renderLanguages,
        contact: renderContactSettings,
        stats: renderStats,
        ai: renderAITranslation,
        publish: renderPublish
    };

    if (renderers[state.activeTab]) {
        renderers[state.activeTab]();
    } else {
        state.activeTab = 'projects';
        renderProjects();
    }
}

function addCurrentItem() {
    const defaults = {
        projects: () => state.data.projects.push({
            id: createId('project'),
            date: emptyLocalizedValue(),
            title: emptyLocalizedValue(),
            role: emptyLocalizedValue(),
            status: emptyLocalizedValue(),
            description: emptyLocalizedValue(),
            tech: []
        }),
        skills: () => state.data.skills.push({
            id: createId('skills'),
            title: emptyLocalizedValue(),
            items: []
        }),
        interests: () => state.data.interests.push({
            id: createId('interest'),
            label: emptyLocalizedValue()
        }),
        education: () => state.data.education.push({
            id: createId('education'),
            title: emptyLocalizedValue(),
            school: emptyLocalizedValue(),
            year: ''
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
        projects: (Array.isArray(data.projects) ? data.projects : []).map((project) => ({
            ...project,
            status: project.status || emptyLocalizedValue()
        })),
        skills: normalizeSkills(data.skills),
        interests: Array.isArray(data.interests) ? data.interests : [],
        education: Array.isArray(data.education) ? data.education : [],
        languages: Array.isArray(data.languages) ? data.languages : [],
        contact: data.contact && typeof data.contact === 'object' ? data.contact : {
            notionFormUrl: '',
            iframeTitle: emptyLocalizedValue(),
            openLabel: emptyLocalizedValue()
        },
        cv: data.cv && typeof data.cv === 'object' ? {
            pdfUrl: data.cv.pdfUrl || '',
            printLabel: data.cv.printLabel || emptyLocalizedValue()
        } : {
            pdfUrl: '',
            printLabel: emptyLocalizedValue()
        },
        analytics: data.analytics && typeof data.analytics === 'object' ? {
            provider: data.analytics.provider || 'none',
            domain: data.analytics.domain || '',
            siteId: data.analytics.siteId || '',
            scriptUrl: data.analytics.scriptUrl || ''
        } : {
            provider: 'none',
            domain: '',
            siteId: '',
            scriptUrl: ''
        }
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
        state.data = normalizeData({ schemaVersion: 1, projects: [], skills: [], interests: [], education: [], languages: [] });
        setStatus('portfolio-data.json introuvable. Import possible via JSON.', 'error');
    }

    if (draft) {
        try {
            const draftData = JSON.parse(draft);
            state.data = normalizeData({
                ...state.data,
                ...draftData,
                contact: { ...state.data.contact, ...(draftData.contact || {}) }
            });
            setStatus('Brouillon local restauré.', 'ready');
        } catch (error) {
            localStorage.removeItem(DRAFT_KEY);
        }
    }

    render();
}

document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
        state.activePage = getPageForTab(tab.dataset.tab);
        state.activeTab = tab.dataset.tab;
        render();
    });
});

document.querySelectorAll('.page-tab').forEach((pageTab) => {
    pageTab.addEventListener('click', () => {
        setActivePage(pageTab.dataset.page);
    });
});

authSubmit.addEventListener('click', handleAuthSubmit);
authPassword.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        handleAuthSubmit();
    }
});
authConfirmPassword.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        handleAuthSubmit();
    }
});
authCurrentPassword.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        handleAuthSubmit();
    }
});
authChangePassword.addEventListener('click', () => {
    authMode = 'change';
    clearAuthInputs();
    setAuthError();
    updateAuthScreen();
    authCurrentPassword.focus();
});
authCancelChange.addEventListener('click', () => {
    authMode = 'unlock';
    clearAuthInputs();
    setAuthError();
    updateAuthScreen();
    authPassword.focus();
});
lockButton.addEventListener('click', lockDashboard);
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

function initAdmin() {
    updateAuthScreen();

    if (sessionStorage.getItem(AUTH_SESSION_KEY) === 'true' && hasLocalPassword()) {
        document.body.classList.remove('auth-locked');
        loadInitialData();
        return;
    }

    document.body.classList.add('auth-locked');
    window.setTimeout(() => authPassword.focus(), 0);
}

initAdmin();
