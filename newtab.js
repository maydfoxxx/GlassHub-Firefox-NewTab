// --- 1. Calendrier / Horloge en temps réel ---
function applyBackground() {
    const slideshowEnabled = localStorage.getItem('slideshowEnabled') === 'true';
    if (slideshowEnabled) {
        const count = parseInt(localStorage.getItem('slideshowCount')) || 1;
        let lastTime = parseInt(localStorage.getItem('lastSlideshowTime')) || 0;
        let currentIdx = parseInt(localStorage.getItem('currentSlideshowIdx')) || 1;
        
        const now = Date.now();
        // 1 heure = 3600000 ms
        if (now - lastTime > 3600000) {
            currentIdx = Math.floor(Math.random() * count) + 1;
            localStorage.setItem('lastSlideshowTime', now);
            localStorage.setItem('currentSlideshowIdx', currentIdx);
        }
        document.body.style.backgroundImage = `url('backgrounds/${currentIdx}.jpg')`;
    } else {
        const bg = localStorage.getItem('customBackground');
        if (bg) {
            document.body.style.backgroundImage = `url('${bg}')`;
        } else {
            document.body.style.backgroundImage = ''; // Reverts to CSS default
        }
    }
}

function updateClock() {
    const now = new Date();
    
    // Format Heure (24h)
    let hours = now.getHours();
    let minutes = now.getMinutes();
    
    const hoursStr = hours < 10 ? '0' + hours : hours;
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    
    document.getElementById('timeDisplay').textContent = `${hoursStr}:${minutesStr}`;
    
    // Format Date
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    document.getElementById('dateDisplay').textContent = now.toLocaleDateString(undefined, options);
}

// --- Météo (Open-Meteo) ---
function getWeatherEmoji(code) {
    if (code === 0) return '☀️';
    if (code === 1) return '🌤️';
    if (code === 2) return '⛅';
    if (code === 3) return '☁️';
    if ([45, 48].includes(code)) return '🌫️';
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return '🌧️';
    if ([56, 57, 66, 67].includes(code)) return '🌧️❄️';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return '❄️';
    if ([95, 96, 99].includes(code)) return '⛈️';
    return '🌡️';
}

function renderWeather(display, emoji, temp, cityName) {
    display.textContent = '';
    const spanEmoji = document.createElement('span');
    spanEmoji.textContent = emoji;
    
    const spanTemp = document.createElement('span');
    spanTemp.textContent = `${temp}°C`;
    
    const spanCity = document.createElement('span');
    spanCity.style.opacity = '0.8';
    spanCity.style.marginLeft = '8px';
    spanCity.style.fontWeight = '400';
    spanCity.style.fontSize = '0.9em';
    spanCity.textContent = cityName;
    
    display.appendChild(spanEmoji);
    display.appendChild(document.createTextNode(' '));
    display.appendChild(spanTemp);
    display.appendChild(document.createTextNode(' '));
    display.appendChild(spanCity);
}

async function initWeather() {
    const weatherDisplay = document.getElementById('weatherDisplay');
    const enabled = localStorage.getItem('weatherEnabled') === 'true';
    const city = localStorage.getItem('weatherCity');

    if (!enabled || !city) {
        weatherDisplay.style.display = 'none';
        return;
    }

    const cachedData = localStorage.getItem('weatherCache');
    const cachedTime = parseInt(localStorage.getItem('weatherCacheTime')) || 0;
    const now = Date.now();

    if (cachedData && (now - cachedTime < 3600000)) {
        try {
            const parsed = JSON.parse(cachedData);
            if (parsed.emoji && parsed.temp !== undefined && parsed.realCityName) {
                renderWeather(weatherDisplay, parsed.emoji, parsed.temp, parsed.realCityName);
                weatherDisplay.style.display = 'flex';
                return;
            }
        } catch(e) {
            // Ignorer si l'ancien format HTML était en cache
        }
    }

    try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
        const geoData = await geoRes.json();
        
        if (!geoData.results || geoData.results.length === 0) {
            weatherDisplay.textContent = 'City not found';
            weatherDisplay.style.display = 'flex';
            return;
        }

        const { latitude, longitude } = geoData.results[0];
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
        const weatherData = await weatherRes.json();
        
        const current = weatherData.current_weather;
        const emoji = getWeatherEmoji(current.weathercode);
        const temp = Math.round(current.temperature);
        const realCityName = geoData.results[0].name;
        
        localStorage.setItem('weatherCache', JSON.stringify({ emoji, temp, realCityName }));
        localStorage.setItem('weatherCacheTime', now);
        
        renderWeather(weatherDisplay, emoji, temp, realCityName);
        weatherDisplay.style.display = 'flex';
    } catch (e) {
        console.error('Weather error:', e);
        weatherDisplay.style.display = 'none';
    }
}

setInterval(updateClock, 1000);
updateClock();

// --- 2. Barre de recherche fonctionnelle & Autocomplétion ---
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const searchWrapper = document.getElementById('searchWrapper');
const suggestionsBox = document.getElementById('suggestionsBox');

let debounceTimer;
let currentSuggestions = [];
let selectedIndex = -1;

// Function to fetch local history
async function fetchHistory(query) {
    // Check if chrome.history is available (depends on manifest permissions)
    if (typeof chrome === 'undefined' || !chrome.history) return [];
    return new Promise((resolve) => {
        chrome.history.search({ text: query, maxResults: 8 }, (results) => {
            resolve(results || []);
        });
    });
}

function closeSuggestions() {
    searchWrapper.classList.remove('active');
    suggestionsBox.innerHTML = '';
    currentSuggestions = [];
    selectedIndex = -1;
}

function executeSearch(query) {
    if (!query) return;
    const isUrl = /^https?:\/\//i.test(query) || /^([a-z0-9\-]+\.)+[a-z]{2,}(\/.*)?$/i.test(query);
    if (isUrl) {
        let url = query;
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        window.open(url, '_blank');
    } else {
        window.open('https://www.google.com/search?q=' + encodeURIComponent(query), '_blank');
    }
}

function renderSuggestions(historyItems) {
    suggestionsBox.innerHTML = '';
    currentSuggestions = [];
    selectedIndex = -1;

    // Add history items
    historyItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        
        const iconSpan = document.createElement('span');
        iconSpan.className = 'suggestion-icon';
        iconSpan.textContent = '🕒';
        
        const textSpan = document.createElement('span');
        textSpan.className = 'suggestion-text';
        textSpan.textContent = item.title || item.url;
        
        const urlSpan = document.createElement('span');
        urlSpan.className = 'suggestion-url';
        urlSpan.textContent = item.url;
        
        div.appendChild(iconSpan);
        div.appendChild(textSpan);
        div.appendChild(urlSpan);
        
        div.addEventListener('click', () => {
            window.open(item.url, '_blank');
            closeSuggestions();
            searchInput.value = '';
        });
        suggestionsBox.appendChild(div);
        currentSuggestions.push({ type: 'url', value: item.url, element: div });
    });

    if (currentSuggestions.length > 0) {
        searchWrapper.classList.add('active');
    } else {
        closeSuggestions();
    }
}

searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(debounceTimer);
    
    if (!query) {
        closeSuggestions();
        return;
    }

    debounceTimer = setTimeout(async () => {
        const historyResults = await fetchHistory(query);
        
        // On affiche jusqu'à 8 résultats d'historique
        const topHistory = historyResults.slice(0, 8);
        
        renderSuggestions(topHistory);
    }, 100); // Réduit le délai pour plus de réactivité
});

// Keyboard navigation and form submit
searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (selectedIndex >= 0 && selectedIndex < currentSuggestions.length) {
        const selected = currentSuggestions[selectedIndex];
        if (selected.type === 'url') {
            window.open(selected.value, '_blank');
        } else {
            window.open('https://www.google.com/search?q=' + encodeURIComponent(selected.value), '_blank');
        }
        closeSuggestions();
        searchInput.value = '';
    } else {
        const query = searchInput.value.trim();
        executeSearch(query);
        closeSuggestions();
    }
});

searchInput.addEventListener('keydown', (e) => {
    if (!searchWrapper.classList.contains('active') || currentSuggestions.length === 0) {
        return; // Let default form submit handle it if no suggestions are open
    }

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % currentSuggestions.length;
        updateSelection();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + currentSuggestions.length) % currentSuggestions.length;
        updateSelection();
    } else if (e.key === 'Escape') {
        closeSuggestions();
    }
});

function updateSelection() {
    currentSuggestions.forEach((item, index) => {
        if (index === selectedIndex) {
            item.element.classList.add('selected');
            if (item.type === 'search') {
                searchInput.value = item.value;
            }
        } else {
            item.element.classList.remove('selected');
        }
    });
}

// Close suggestions when clicking outside
document.addEventListener('click', (e) => {
    if (!searchWrapper.contains(e.target)) {
        closeSuggestions();
    }
});

// --- 3. Liens Customisables via LocalStorage ---
const defaultMainShortcuts = [
    { name: "Gmail", url: "https://mail.google.com/mail/u/0/#inbox", icon: "https://www.google.com/s2/favicons?domain=mail.google.com&sz=64" },
    { name: "Proton Mail", url: "https://mail.proton.me/", icon: "https://www.google.com/s2/favicons?domain=proton.me&sz=64" },
    { name: "YouTube", url: "https://www.youtube.com/", icon: "https://www.google.com/s2/favicons?domain=youtube.com&sz=64" },
    { name: "ChatGPT", url: "https://chatgpt.com/", icon: "https://www.google.com/s2/favicons?domain=chatgpt.com&sz=64" },
    { name: "Gemini", url: "https://gemini.google.com/app", icon: "https://www.google.com/s2/favicons?domain=gemini.google.com&sz=64" },
    { name: "Perplexity", url: "https://www.perplexity.ai/", icon: "https://www.google.com/s2/favicons?domain=perplexity.ai&sz=64" }
];

const defaultSmallShortcuts = [
    { url: "https://reddit.com", icon: "https://www.google.com/s2/favicons?domain=reddit.com&sz=64" },
    { url: "https://x.com", icon: "https://www.google.com/s2/favicons?domain=x.com&sz=64" },
    { url: "https://web.telegram.org", icon: "https://www.google.com/s2/favicons?domain=web.telegram.org&sz=64" },
    { url: "https://linkedin.com", icon: "https://www.google.com/s2/favicons?domain=linkedin.com&sz=64" },
    { url: "https://grok.com", icon: "https://www.google.com/s2/favicons?domain=grok.com&sz=64" },
    { url: "https://onlyfans.com", icon: "https://www.google.com/s2/favicons?domain=onlyfans.com&sz=64" }
];

function loadLinks() {
    let mainLinks = JSON.parse(localStorage.getItem('customMainShortcuts')) || defaultMainShortcuts;
    let smallLinks = JSON.parse(localStorage.getItem('customSmallShortcuts')) || defaultSmallShortcuts;
    return { mainLinks, smallLinks };
}

function renderLinks() {
    const { mainLinks, smallLinks } = loadLinks();
    
    const mainGrid = document.getElementById('shortcutsGrid');
    mainGrid.innerHTML = '';
    mainLinks.forEach(link => {
        const a = document.createElement('a');
        a.href = link.url;
        a.className = 'shortcut-btn';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        
        const spanIcon = document.createElement('span');
        spanIcon.className = 'shortcut-icon';
        
        let iconElem;
        if (!link.icon || link.icon.trim() === '') {
            try {
                let u = link.url;
                if (!u.startsWith('http')) u = 'https://' + u;
                const domain = new URL(u).hostname;
                iconElem = document.createElement('img');
                iconElem.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
                iconElem.alt = 'icon';
            } catch (err) {
                iconElem = document.createTextNode('🌐');
            }
        } else if (link.icon && link.icon.startsWith('http')) {
            iconElem = document.createElement('img');
            iconElem.src = link.icon;
            iconElem.alt = 'icon';
        } else {
            iconElem = document.createTextNode(link.icon);
        }
        
        spanIcon.appendChild(iconElem);
        a.appendChild(spanIcon);
        a.appendChild(document.createTextNode(' ' + link.name));
        mainGrid.appendChild(a);
    });

    const smallGrid = document.getElementById('smallShortcuts');
    smallGrid.innerHTML = '';
    smallLinks.forEach(link => {
        const a = document.createElement('a');
        a.href = link.url;
        a.className = 'small-btn';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        
        let iconElem;
        if (!link.icon || link.icon.trim() === '') {
            try {
                let u = link.url;
                if (!u.startsWith('http')) u = 'https://' + u;
                const domain = new URL(u).hostname;
                iconElem = document.createElement('img');
                iconElem.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
                iconElem.alt = 'icon';
            } catch (err) {
                iconElem = document.createTextNode('🌐');
            }
        } else if (link.icon && link.icon.startsWith('http')) {
            iconElem = document.createElement('img');
            iconElem.src = link.icon;
            iconElem.alt = 'icon';
        } else {
            iconElem = document.createTextNode(link.icon);
        }
        
        a.appendChild(iconElem);
        smallGrid.appendChild(a);
    });
}

// --- 4. Messages de bienvenue ---
const defaultGreetings = [
    "Ready for a new adventure?",
    "What's on your mind today?",
    "Let's get things done!",
    "Good to see you!",
    "Have a fantastic day!",
    "Here's to a productive day!",
    "Stay focused and awesome!",
    "Time to make things happen!",
    "Enjoy your browsing!",
    "Welcome to your customized space!"
];

function loadGreetings() {
    return JSON.parse(localStorage.getItem('customGreetings')) || defaultGreetings;
}

function initGreeting() {
    const greetings = loadGreetings();
    const randomMsg = greetings[Math.floor(Math.random() * greetings.length)] || "Welcome!";
    document.getElementById('greetingDisplay').textContent = randomMsg;
}

// --- Modal & Paramètres de configuration ---
const modal = document.getElementById('settingsModal');
const settingsBtn = document.getElementById('settingsBtn');
const closeBtn = document.getElementById('closeSettingsBtn');
const saveBtn = document.getElementById('saveSettingsBtn');
const addGreetingBtn = document.getElementById('addGreetingBtn');

function createGreetingRowDOM(text) {
    const div = document.createElement('div');
    div.className = 'link-edit-row greeting-row';
    div.draggable = true;
    
    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';
    dragHandle.title = 'Drag to reorder';
    dragHandle.textContent = '☰';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'greeting-input';
    input.value = text;
    input.placeholder = 'Message...';
    
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'delete-btn';
    btn.title = 'Delete';
    btn.textContent = '🗑️';
    
    div.appendChild(dragHandle);
    div.appendChild(input);
    div.appendChild(btn);
    return div;
}

function createMainShortcutRow(link) {
    const div = document.createElement('div');
    div.className = 'link-edit-row';
    div.draggable = true;
    
    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';
    dragHandle.title = 'Drag to reorder';
    dragHandle.textContent = '☰';
    
    const iconInput = document.createElement('input');
    iconInput.type = 'text';
    iconInput.className = 'icon-input';
    iconInput.value = link.icon || '';
    iconInput.placeholder = 'Icon';
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'name-input';
    nameInput.value = link.name || '';
    nameInput.placeholder = 'Name';
    
    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.className = 'url-input';
    urlInput.value = link.url || '';
    urlInput.placeholder = 'URL';
    
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fetch-favicon-btn';
    btn.title = 'Fetch Favicon';
    btn.textContent = '🌐';
    
    div.appendChild(dragHandle);
    div.appendChild(iconInput);
    div.appendChild(nameInput);
    div.appendChild(urlInput);
    div.appendChild(btn);
    return div;
}

function createSmallShortcutRow(link) {
    const div = document.createElement('div');
    div.className = 'link-edit-row';
    div.draggable = true;
    
    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';
    dragHandle.title = 'Drag to reorder';
    dragHandle.textContent = '☰';
    
    const iconInput = document.createElement('input');
    iconInput.type = 'text';
    iconInput.className = 'icon-input';
    iconInput.value = link.icon || '';
    iconInput.placeholder = 'Icon';
    
    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.className = 'url-input';
    urlInput.value = link.url || '';
    urlInput.placeholder = 'URL';
    
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fetch-favicon-btn';
    btn.title = 'Fetch Favicon';
    btn.textContent = '🌐';
    
    div.appendChild(dragHandle);
    div.appendChild(iconInput);
    div.appendChild(urlInput);
    div.appendChild(btn);
    return div;
}

settingsBtn.addEventListener('click', () => {
    const { mainLinks, smallLinks } = loadLinks();
    const greetings = loadGreetings();
    
    // Remplir le formulaire des raccourcis principaux
    const mainEdit = document.getElementById('mainShortcutsEdit');
    mainEdit.textContent = '';
    mainLinks.forEach((link, i) => {
        mainEdit.appendChild(createMainShortcutRow(link));
    });

    // Remplir le formulaire des petits raccourcis
    const smallEdit = document.getElementById('smallShortcutsEdit');
    smallEdit.textContent = '';
    smallLinks.forEach((link, i) => {
        smallEdit.appendChild(createSmallShortcutRow(link));
    });

    // Remplir le formulaire des messages de bienvenue
    const greetingsEdit = document.getElementById('greetingsEdit');
    greetingsEdit.textContent = '';
    greetings.forEach(msg => {
        greetingsEdit.appendChild(createGreetingRowDOM(msg));
    });

    // Remplir le formulaire du background
    const bg = localStorage.getItem('customBackground');
    const bgUrlInput = document.getElementById('bgUrlInput');
    bgUrlInput.value = bg && bg.startsWith('http') ? bg : '';

    const slideshowEnabled = localStorage.getItem('slideshowEnabled') === 'true';
    const slideshowCount = localStorage.getItem('slideshowCount') || 1;
    document.getElementById('slideshowCheckbox').checked = slideshowEnabled;
    document.getElementById('slideshowCountInput').value = slideshowCount;
    document.getElementById('slideshowSettings').style.display = slideshowEnabled ? 'block' : 'none';

    // Remplir le formulaire Météo
    const weatherEnabled = localStorage.getItem('weatherEnabled') === 'true';
    const weatherCity = localStorage.getItem('weatherCity') || '';
    document.getElementById('weatherCheckbox').checked = weatherEnabled;
    document.getElementById('weatherCityInput').value = weatherCity;
    document.getElementById('weatherSettings').style.display = weatherEnabled ? 'block' : 'none';

    modal.classList.add('active');
});

document.getElementById('slideshowCheckbox').addEventListener('change', (e) => {
    document.getElementById('slideshowSettings').style.display = e.target.checked ? 'block' : 'none';
});

document.getElementById('weatherCheckbox').addEventListener('change', (e) => {
    document.getElementById('weatherSettings').style.display = e.target.checked ? 'block' : 'none';
});

let tempBgBase64 = null;

document.getElementById('uploadBgBtn').addEventListener('click', () => {
    document.getElementById('bgFileInput').click();
});

document.getElementById('bgFileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            // Compression & redimensionnement via Canvas
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1920;
            const MAX_HEIGHT = 1080;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            tempBgBase64 = canvas.toDataURL('image/jpeg', 0.85);
            document.getElementById('bgUrlInput').value = '[Local Image Ready to Save]';
            // Prévisualisation en direct
            document.body.style.backgroundImage = `url('${tempBgBase64}')`;
        }
        img.src = event.target.result;
    }
    reader.readAsDataURL(file);
});

document.getElementById('resetBgBtn').addEventListener('click', () => {
    tempBgBase64 = null;
    document.getElementById('bgUrlInput').value = '';
    document.body.style.backgroundImage = ''; // Prévisualisation par défaut
});

document.getElementById('bgUrlInput').addEventListener('input', (e) => {
    tempBgBase64 = null;
    if (e.target.value.startsWith('http')) {
        document.body.style.backgroundImage = `url('${e.target.value}')`;
    }
});

addGreetingBtn.addEventListener('click', () => {
    const greetingsEdit = document.getElementById('greetingsEdit');
    greetingsEdit.appendChild(createGreetingRowDOM(""));
});

closeBtn.addEventListener('click', () => {
    applyBackground(); // Annuler la prévisualisation si non sauvegardé
    modal.classList.remove('active');
});

saveBtn.addEventListener('click', () => {
    // Sauvegarder les raccourcis principaux
    const mainRows = document.querySelectorAll('#mainShortcutsEdit .link-edit-row');
    const newMainLinks = [];
    mainRows.forEach(row => {
        newMainLinks.push({
            icon: row.querySelector('.icon-input').value,
            name: row.querySelector('.name-input').value,
            url: row.querySelector('.url-input').value
        });
    });

    // Sauvegarder les petits raccourcis
    const smallRows = document.querySelectorAll('#smallShortcutsEdit .link-edit-row');
    const newSmallLinks = [];
    smallRows.forEach(row => {
        newSmallLinks.push({
            icon: row.querySelector('.icon-input').value,
            url: row.querySelector('.url-input').value
        });
    });

    // Sauvegarder les messages de bienvenue
    const greetingInputs = document.querySelectorAll('#greetingsEdit .greeting-input');
    const newGreetings = [];
    greetingInputs.forEach(input => {
        if (input.value.trim()) newGreetings.push(input.value.trim());
    });

    // Sauvegarder le background
    const bgInputVal = document.getElementById('bgUrlInput').value.trim();
    if (tempBgBase64) {
        localStorage.setItem('customBackground', tempBgBase64);
    } else if (bgInputVal.startsWith('http') || bgInputVal.startsWith('data:')) {
        localStorage.setItem('customBackground', bgInputVal);
    } else {
        localStorage.removeItem('customBackground');
    }

    const slideshowEnabled = document.getElementById('slideshowCheckbox').checked;
    const slideshowCount = parseInt(document.getElementById('slideshowCountInput').value) || 1;
    
    // Si on vient d'activer ou de modifier, on force un changement d'image pour le preview
    if (slideshowEnabled && (localStorage.getItem('slideshowEnabled') !== 'true' || localStorage.getItem('slideshowCount') != slideshowCount)) {
        localStorage.setItem('lastSlideshowTime', 0);
    }

    localStorage.setItem('slideshowEnabled', slideshowEnabled);
    localStorage.setItem('slideshowCount', slideshowCount);

    // Sauvegarder la météo
    const weatherEnabled = document.getElementById('weatherCheckbox').checked;
    const weatherCity = document.getElementById('weatherCityInput').value.trim();
    
    if (weatherCity !== localStorage.getItem('weatherCity')) {
        // Clear cache if city changes
        localStorage.removeItem('weatherCache');
        localStorage.removeItem('weatherCacheTime');
    }

    localStorage.setItem('weatherEnabled', weatherEnabled);
    localStorage.setItem('weatherCity', weatherCity);

    localStorage.setItem('customMainShortcuts', JSON.stringify(newMainLinks));
    localStorage.setItem('customSmallShortcuts', JSON.stringify(newSmallLinks));
    if (newGreetings.length > 0) {
        localStorage.setItem('customGreetings', JSON.stringify(newGreetings));
    }
    
    applyBackground();
    renderLinks();
    initGreeting();
    initWeather();
    modal.classList.remove('active');
});

// Fermer la modale si on clique à l'extérieur
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.remove('active');
    }
});

// Auto-compléter le favicon quand on modifie l'URL
document.addEventListener('input', (e) => {
    if (e.target.classList.contains('url-input')) {
        const row = e.target.closest('.link-edit-row');
        if (!row) return;
        const iconInput = row.querySelector('.icon-input');
        if (!iconInput) return;
        
        let url = e.target.value.trim();
        if (url) {
            try {
                if (!url.startsWith('http')) url = 'https://' + url;
                const domain = new URL(url).hostname;
                // Si l'icône est vide ou si c'est déjà un favicon google, on le met à jour
                if (!iconInput.value || iconInput.value.includes('google.com/s2/favicons')) {
                    iconInput.value = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
                }
            } catch (err) {
                // Ignore invalid URL
            }
        }
    }
});

// Récupérer le favicon dynamiquement
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.fetch-favicon-btn');
    if (btn) {
        const row = btn.closest('.link-edit-row');
        const urlInput = row.querySelector('.url-input');
        const iconInput = row.querySelector('.icon-input');
        
        let url = urlInput.value.trim();
        if (url) {
            try {
                if (!url.startsWith('http')) url = 'https://' + url;
                const domain = new URL(url).hostname;
                iconInput.value = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
            } catch (err) {
                console.error('Invalid URL');
            }
        }
    }
    
    // Detele the Welcome Message
    const delBtn = e.target.closest('.delete-btn');
    if (delBtn) {
        delBtn.closest('.greeting-row').remove();
    }
});

// Page Initialisation
document.addEventListener('DOMContentLoaded', () => {
    applyBackground();
    renderLinks();
    initGreeting();
    initWeather();
});

// --- Export / Import Configuration ---
document.getElementById('exportBtn').addEventListener('click', () => {
    const data = {};
    const keysToExport = [
        'customMainShortcuts', 'customSmallShortcuts', 'customGreetings',
        'customBackground', 'slideshowEnabled', 'slideshowCount',
        'weatherEnabled', 'weatherCity'
    ];
    
    keysToExport.forEach(key => {
        const val = localStorage.getItem(key);
        if (val !== null) {
            data[key] = val;
        }
    });
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'glasshub_config.json';
    a.click();
    URL.revokeObjectURL(url);
});

document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFileInput').click();
});

document.getElementById('importFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const data = JSON.parse(event.target.result);
            Object.keys(data).forEach(key => {
                localStorage.setItem(key, data[key]);
            });
            alert('Configuration importée avec succès ! La page va être rechargée.');
            location.reload();
        } catch (err) {
            alert('Fichier de configuration invalide.');
        }
    };
    reader.readAsText(file);
});

// --- Drag & Drop (Reorganization of Shortcuts) ---
let draggedRow = null;

document.addEventListener('dragstart', (e) => {
    if (e.target.classList && e.target.classList.contains('link-edit-row')) {
        draggedRow = e.target;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => e.target.classList.add('dragging'), 0);
    }
});

document.addEventListener('dragend', (e) => {
    if (e.target.classList && e.target.classList.contains('link-edit-row')) {
        e.target.classList.remove('dragging');
        draggedRow = null;
        document.querySelectorAll('.link-edit-row').forEach(row => row.classList.remove('drag-over'));
    }
});

document.addEventListener('dragover', (e) => {
    const targetRow = e.target.closest('.link-edit-row');
    if (targetRow && targetRow !== draggedRow && draggedRow) {
        if (targetRow.parentNode === draggedRow.parentNode) {
            e.preventDefault();
            targetRow.classList.add('drag-over');
        }
    }
});

document.addEventListener('dragleave', (e) => {
    const targetRow = e.target.closest('.link-edit-row');
    if (targetRow) {
        targetRow.classList.remove('drag-over');
    }
});

document.addEventListener('drop', (e) => {
    const targetRow = e.target.closest('.link-edit-row');
    if (targetRow && targetRow !== draggedRow && draggedRow) {
        if (targetRow.parentNode === draggedRow.parentNode) {
            e.preventDefault();
            targetRow.classList.remove('drag-over');
            
            const bounding = targetRow.getBoundingClientRect();
            const offset = bounding.y + (bounding.height / 2);
            if (e.clientY > offset) {
                targetRow.parentNode.insertBefore(draggedRow, targetRow.nextSibling);
            } else {
                targetRow.parentNode.insertBefore(draggedRow, targetRow);
            }
        }
    }
});
