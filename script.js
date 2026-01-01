// State
let currentUser = null;
let movies = [];
let users = [];
let currentView = 'home'; // home, movie, series

// --- Security Logic ---
const securityScreen = document.getElementById('security-screen');

// 1. Block Context Menu
document.addEventListener('contextmenu', event => event.preventDefault());

// 2. Block Shortcuts
document.addEventListener('keydown', (e) => {
    if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C' || e.key === 'U')) ||
        (e.ctrlKey && e.key === 'S')
    ) {
        e.preventDefault();
        return false;
    }
});

// 3. DevTools Detection Loop

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const appContainer = document.getElementById('app-container');
const btnLogin = document.getElementById('login-btn');
const inputPass = document.getElementById('password-input');
const errorMsg = document.getElementById('login-error');

const heroTitle = document.getElementById('hero-title');
const heroDesc = document.getElementById('hero-desc');
const heroBg = document.getElementById('hero');
let heroPlayBtn = document.getElementById('hero-play-btn');
let heroDownloadBtn = document.getElementById('hero-download-btn');

const gridNew = document.getElementById('new-releases-grid');
const gridTrending = document.getElementById('trending-grid');
const gridContinue = document.getElementById('continue-watching-grid');

const playerOverlay = document.getElementById('video-player');
const iframe = document.getElementById('main-video-frame');
const closePlayer = document.getElementById('close-player');

const uploadBtn = document.getElementById('upload-btn');
const membersBtn = document.getElementById('members-btn'); // New
const uploadModal = document.getElementById('upload-modal');
const membersModal = document.getElementById('members-modal'); // New
const closeUpload = document.getElementById('close-upload');
const closeMembers = document.getElementById('close-members'); // New
const uploadForm = document.getElementById('upload-form');
const addMemberForm = document.getElementById('add-member-form'); // New

const fileInput = document.getElementById('m-thumb-file');
const fileNameDisplay = document.getElementById('file-name');
const uploadStatus = document.getElementById('upload-progress');

// --- Sync Data ---
// 1. Sync Users
window.onValue(window.usersRef, (snapshot) => {
    const data = snapshot.val();
    users = [];
    if (data) {
        Object.keys(data).forEach(key => {
            users.push({ key: key, ...data[key] });
        });
    }

    // Refresh Current User on Sync (Fixes stale history)
    if (currentUser) {
        const updatedUser = users.find(u => u.key === currentUser.key);
        if (updatedUser) {
            currentUser = updatedUser;
            // Safe-guard re-render if needed
            renderMovies();
        }
    }
});

// 2. Sync Movies
window.onValue(window.moviesRef, (snapshot) => {
    const data = snapshot.val();
    movies = []; // Raw list (flat)
    if (data) {
        Object.keys(data).forEach(key => {
            movies.push({ firebaseKey: key, ...data[key] });
        });
    }
    if (currentUser) {
        renderMovies();
        const filtered = getFilteredMovies(); // Returns grouped items
        // If hero is empty, pick first one
        if (filtered.length > 0 && !document.getElementById('main-video-frame').src) {
            setHeroMovie(filtered[filtered.length - 1]);
        }

        // --- Series Page Auto-Refresh ---
        // If the Series Page is open, we need to refresh its content because data changed (e.g., episode deleted)
        if (!seriesScreen.classList.contains('hidden')) {
            const currentTitle = sTitle.innerText;
            // Find the updated series object
            const updatedSeries = filtered.find(item => (item.seriesName === currentTitle) || (item.title === currentTitle));

            if (updatedSeries && updatedSeries.episodes && updatedSeries.episodes.length > 0) {
                // Refresh the list (keep current season selection)
                const currentSeason = sSeasonSelect.value;

                // Re-bind hero details just in case
                sDesc.innerText = updatedSeries.desc;

                // Refresh Grid
                renderSeriesEpisodes(updatedSeries, currentSeason);

                // Re-init select if seasons changed? (Simplification: just re-render select)
                const seasons = [...new Set(updatedSeries.episodes.map(e => e.season))].sort((a, b) => a - b);
                sSeasonSelect.innerHTML = '';
                seasons.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s;
                    opt.innerText = `Season ${s}`;
                    if (s == currentSeason) opt.selected = true;
                    sSeasonSelect.appendChild(opt);
                });
            } else {
                // If series was deleted or is empty, close page
                closeSeriesPage();
            }
        }
    }
});

// Grouping Logic
function groupSeries(rawMovies) {
    const grouped = [];
    const seriesMap = {};

    rawMovies.forEach(m => {
        if (m.type === 'series' && m.seriesName) {
            // It's a series episode
            const sName = m.seriesName;
            if (!seriesMap[sName]) {
                // Register new series bundle
                seriesMap[sName] = {
                    ...m, // Inherit metadata from first seen ep (thumbnail, genre, etc)
                    isGroup: true,
                    episodes: []
                };
                grouped.push(seriesMap[sName]);
            }
            seriesMap[sName].episodes.push(m);
        } else {
            // It's a standard movie or independent item
            grouped.push(m);
        }
    });

    // Sort episodes in each series
    Object.values(seriesMap).forEach(s => {
        s.episodes.sort((a, b) => (a.season - b.season) || (a.episode - b.episode));
    });

    return grouped;
}

// --- Auth Logic ---
function login() {
    const pass = inputPass.value;
    // 1. Check against synced users
    let user = users.find(u => u.password === pass);

    // 2. Fallback / Emergency Admin Init
    // If DB is empty or sync is slow, allow default admin to bootstrap
    if (!user && pass === 'admin') {
        // Double check if admin name exists to avoid duplicates
        const adminExists = users.some(u => u.role === 'admin');
        if (!adminExists) {
            const newAdmin = { name: "Me (Admin)", password: "admin", role: "admin" };
            window.push(window.usersRef, newAdmin); // Save to DB
            user = newAdmin; // Allow login locally
        }
    }

    if (user) {
        currentUser = user;
        loginScreen.classList.add('hidden');
        loginScreen.classList.remove('active');
        appContainer.classList.remove('hidden');
        initApp();
    } else {
        errorMsg.innerText = "Incorrect Password";
        errorMsg.classList.remove('hidden');
        inputPass.classList.add('shake');
        setTimeout(() => inputPass.classList.remove('shake'), 500);
    }
}

btnLogin.addEventListener('click', login);
inputPass.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') login();
});

document.getElementById('logout-btn').addEventListener('click', () => {
    location.reload();
});

// --- App Logic ---
function initApp() {
    document.getElementById('user-name').innerText = currentUser.name;

    if (currentUser.role === 'admin') {
        uploadBtn.classList.remove('hidden');
        membersBtn.classList.remove('hidden');
    }
    renderMovies();
}

// Global Nav Switch
window.switchTab = function (tab) {
    currentView = tab;
    document.querySelectorAll('.nav-links li').forEach(li => {
        li.classList.remove('active');
        if (li.innerText.toLowerCase().includes(tab === 'series' ? 'tv' : tab)) {
            li.classList.add('active');
        }
    });
    renderMovies();
}

function getFilteredMovies() {
    // 1. Group first
    const groupedItems = groupSeries(movies);

    // 2. Filter
    if (currentView === 'home') return groupedItems;

    return groupedItems.filter(m => {
        if (currentView === 'series') return m.type === 'series';
        if (currentView === 'movie') return m.type === 'movie';
        return true;
    });
}


// --- History Logic ---
function addToHistory(item) {
    if (!currentUser || !currentUser.key) return;

    // Check if already in local history to avoid duplicate DB calls
    let history = currentUser.history ? Object.values(currentUser.history) : [];

    // Check by Series Name for series, or Title for movies
    const isPresent = history.some(h => (item.isGroup && h.seriesName === item.seriesName) || (!item.isGroup && h.title === item.title));

    if (!isPresent) {
        const historyItem = {
            firebaseKey: item.firebaseKey,
            title: item.title,
            seriesName: item.seriesName || null,
            isGroup: item.isGroup || false,
            type: item.type,
            thumbnail: item.thumbnail,
            genre: item.genre,
            desc: item.desc,
            video: item.video,
            timestamp: Date.now()
        };
        window.push(window.ref(window.db, `users/${currentUser.key}/history`), historyItem);
    }
}

function deleteHistoryItem(historyKey, e) {
    if (e) e.stopPropagation();
    if (confirm("Remove from Continue Watching?")) {
        const ref = window.ref(window.db, `users/${currentUser.key}/history/${historyKey}`);
        window.remove(ref);
        // UI auto-updates via onValue -> seedUsers -> global render
    }
}

function renderMovies() {
    const displayList = getFilteredMovies();

    // 1. Static Grids
    gridNew.innerHTML = '';
    gridTrending.innerHTML = '';

    [...displayList].reverse().forEach(item => {
        gridNew.appendChild(createMovieCard(item));
    });

    displayList.forEach(item => {
        gridTrending.appendChild(createMovieCard(item));
    });

    // 2. Continue Watching (Real History)
    gridContinue.innerHTML = '';
    const sectionContinue = document.getElementById('continue-watching-grid').parentElement; // Assuming structure

    // Hide section initially
    sectionContinue.classList.add('hidden');

    if (currentUser && currentUser.history) {
        const historyItems = Object.entries(currentUser.history)
            .map(([key, val]) => ({ historyKey: key, ...val })) // Include DB key for delete
            .sort((a, b) => b.timestamp - a.timestamp);

        if (historyItems.length > 0) {
            sectionContinue.classList.remove('hidden');
            // Ensure we use the proper selection for the parent section
            // In index.html, gridContinue is inside a .movie-slider, which is inside .category-row
            // So parentElement is .movie-slider, parentElement.parentElement is .category-row
            gridContinue.parentElement.classList.remove('hidden');

            historyItems.forEach(hItem => {
                gridContinue.appendChild(createMovieCard(hItem, true));
            });
        } else {
            gridContinue.parentElement.classList.add('hidden');
        }
    } else {
        gridContinue.parentElement.classList.add('hidden');
    }

    // 3. Dynamic Genre Rows
    const genreContainer = document.getElementById('genre-rows-container');
    if (genreContainer) {
        genreContainer.innerHTML = '';

        // Get unique genres
        const genres = [...new Set(displayList.map(m => m.genre).filter(g => g))];

        genres.forEach(genre => {
            const genreMovies = displayList.filter(m => m.genre === genre);
            if (genreMovies.length > 0) {
                const section = document.createElement('section');
                section.className = 'category-row';
                section.innerHTML = `<h2>${genre}</h2>`;

                const slider = document.createElement('div');
                slider.className = 'movie-slider';

                genreMovies.forEach(m => {
                    slider.appendChild(createMovieCard(m));
                });

                section.appendChild(slider);
                genreContainer.appendChild(section);
            }
        });
    }
}

function createMovieCard(item, isHistory = false) {
    const div = document.createElement('div');
    div.className = 'movie-card';
    div.style.backgroundImage = `url('${item.thumbnail}')`;

    // Series Badge
    let badgeHTML = '';
    if (item.isGroup && item.episodes) {
        badgeHTML = `<span style="position:absolute; top:10px; right:10px; background:#e50914; color:white; padding:2px 6px; font-size:0.7rem; border-radius:4px;">${item.episodes.length} Episodes</span>`;
    }

    // Delete Button (Admin) OR History Remove
    let actionBtnHTML = '';

    if (isHistory) {
        // Red X for history removal
        actionBtnHTML = `<button class="delete-btn" title="Remove from History" onclick="deleteHistoryItem('${item.historyKey}', event)"><i class="fa-solid fa-xmark"></i></button>`;
        // Force opacity for history items to identify them? No, keep style.
        // We override CSS for delete-btn to be visible? 
        // Existing CSS: .movie-card:hover .delete-btn { opacity: 1; }
    } else if (currentUser && currentUser.role === 'admin' && !item.isGroup) {
        // Admin Delete Content
        actionBtnHTML = `<button class="delete-btn" onclick="deleteMovie('${item.firebaseKey}', event)"><i class="fa-solid fa-trash"></i></button>`;
    }

    let progressHTML = '';
    if (isHistory) {
        // Fake progress for visual flair, or remove? User asked for delete icon.
        // Let's keep it clean
    }

    div.innerHTML = `
        ${actionBtnHTML}
        ${badgeHTML}
        <div class="card-info">
            <h4>${item.seriesName || item.title}</h4>
            <small>${item.genre || 'General'}</small>
        </div>
    `;

    div.addEventListener('click', () => {
        // If history item, it might barely have info.
        // Ideally we find the REAL item from 'movies' list to get latest episodes/links.
        // But if deleted, we fallback to history copy.
        let targetItem = item;

        // Try to match with live data for fresh links/episodes
        const liveMatch = movies.find(m => m.firebaseKey === item.firebaseKey || (item.isGroup && m.seriesName === item.seriesName));
        if (liveMatch) {
            // If live match is group, use groupSeries logic? 
            // getFilteredMovies() groups them. Let's find in getFilteredMovies result?
            // Optimized: Just use liveMatch but if group re-find in grouped list.
            // Simplest: pass history item logic.
            if (liveMatch.type === 'series') {
                // We need the full grouped object
                const groupedList = groupSeries(movies);
                const fullGroup = groupedList.find(g => g.seriesName === item.seriesName);
                if (fullGroup) targetItem = fullGroup;
            } else {
                targetItem = liveMatch;
            }
        }

        if (targetItem.isGroup) {
            openSeriesPage(targetItem);
        } else {
            setHeroMovie(targetItem);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // Update History Timestamp on re-watch
        addToHistory(targetItem);
    });

    return div;
}

window.deleteMovie = function (key, e) {
    if (e) e.stopPropagation();
    if (confirm("Are you sure you want to delete this content?")) {
        const movieRef = window.ref(window.db, 'movies/' + key);
        window.remove(movieRef);
    }
};

// --- Series Page Logic ---
const seriesScreen = document.getElementById('series-screen');
const closeSeriesBtn = document.getElementById('close-series-btn');
const sTitle = document.getElementById('s-title');
const sDesc = document.getElementById('s-desc');
const sHeroBg = document.getElementById('s-hero-bg');
const sPlayBtn = document.getElementById('s-play-btn');
const sDownloadBtn = document.getElementById('s-download-btn');
const sDeleteBtn = document.getElementById('s-delete-btn');
const sSeasonSelect = document.getElementById('s-season-select');
const sEpisodesGrid = document.getElementById('s-episodes-grid');

closeSeriesBtn.addEventListener('click', closeSeriesPage);

function closeSeriesPage() {
    seriesScreen.classList.add('hidden');
    appContainer.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openSeriesPage(seriesObj) {
    // 1. UI Toggle
    appContainer.classList.add('hidden');
    seriesScreen.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 2. Populate Hero
    sTitle.innerText = seriesObj.seriesName;
    sDesc.innerText = seriesObj.desc;
    sHeroBg.style.backgroundImage = `linear-gradient(to top, #141414, transparent), url('${seriesObj.thumbnail}')`;

    // 3. Admin Delete Button
    if (currentUser && currentUser.role === 'admin') {
        sDeleteBtn.classList.remove('hidden');
        sDeleteBtn.onclick = () => deleteSeries(seriesObj.seriesName);
    } else {
        sDeleteBtn.classList.add('hidden');
    }

    // 4. Render Seasons & Episodes
    const seasons = [...new Set(seriesObj.episodes.map(e => e.season))].sort((a, b) => a - b);

    sSeasonSelect.innerHTML = '';
    seasons.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.innerText = `Season ${s}`;
        sSeasonSelect.appendChild(opt);
    });

    sSeasonSelect.onchange = () => renderSeriesEpisodes(seriesObj, sSeasonSelect.value);

    // Initial Render
    if (seasons.length > 0) {
        renderSeriesEpisodes(seriesObj, seasons[0]);
        // Default Play Button action (S1 E1)
        updateSeriesHeroButtons(seriesObj.episodes[0]);
    }
}

function renderSeriesEpisodes(seriesObj, seasonNum) {
    sEpisodesGrid.innerHTML = '';
    const eps = seriesObj.episodes.filter(e => e.season == seasonNum);

    eps.forEach(ep => {
        const card = document.createElement('div');
        card.className = 'ep-card';

        let actionsHTML = '';
        // Download Button
        if (ep.downloadUrl) {
            actionsHTML += `<button class="ep-btn download" title="Download" onclick="downloadEp('${ep.downloadUrl}', event)"><i class="fa-solid fa-download"></i></button>`;
        }
        // Delete Button (Admin Only)
        if (currentUser && currentUser.role === 'admin') {
            actionsHTML += `<button class="ep-btn delete" title="Delete Episode" onclick="deleteEp('${ep.firebaseKey}', '${seriesObj.seriesName}', event)"><i class="fa-solid fa-trash"></i></button>`;
        }

        card.innerHTML = `
            <img src="${seriesObj.thumbnail}" alt="thumb">
            <div class="ep-info">
                <h4>${ep.episode}. ${ep.epTitle || 'Episode ' + ep.episode}</h4>
                <span>${ep.title}</span>
                <div class="ep-actions">
                    ${actionsHTML}
                </div>
            </div>
        `;

        // Card Click = Play
        card.onclick = (e) => {
            // If we clicked a button, ignore
            if (e.target.closest('button')) return;

            handlePlayClick(ep, ep.video);
            addToHistory(seriesObj);
            updateSeriesHeroButtons(ep);
        };
        sEpisodesGrid.appendChild(card);
    });
}

// Helper Functions for Buttons
window.downloadEp = function (url, e) {
    e.stopPropagation();
    if (confirm("Download this episode?")) {
        window.open(url, '_blank');
    }
}

window.deleteEp = function (key, seriesName, e) {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete this specific episode?`)) {
        const ref = window.ref(window.db, 'movies/' + key);
        window.remove(ref);

        // The onValue listener will trigger a re-render of 'movies'
        // But we need to update the Open Series Page manually or close it if empty.
        // We'll trust onValue to update 'movies' global, but we need to refresh the grid.
        // Wait for removal? onValue is async.
        // Quick fix: The standard onValue listener handles data sync.
        // We need to re-call renderSeriesEpisodes logic when data changes?
        // Let's rely on the global listener to catch it, but to show immediate feedback:
        // alert("Deleted."); // Optional

        // Hack: We need the series page to refresh content.
        // We will make the global listener detect if Series Page is open and refresh it.
    }
}

function updateSeriesHeroButtons(ep) {
    sPlayBtn.innerHTML = `<i class="fa-solid fa-play"></i> Play S${ep.season}:E${ep.episode}`;
    sPlayBtn.onclick = () => handlePlayClick(ep, ep.video);

    if (ep.downloadUrl) {
        sDownloadBtn.classList.remove('disabled');
        sDownloadBtn.onclick = () => downloadMovie(ep.downloadUrl);
        sDownloadBtn.style.opacity = '1';
        sDownloadBtn.innerHTML = '<i class="fa-solid fa-download"></i> Download';
    } else {
        sDownloadBtn.innerHTML = '<i class="fa-solid fa-ban"></i> No Download';
        sDownloadBtn.style.opacity = '0.5';
        sDownloadBtn.onclick = null;
    }
}

function deleteSeries(seriesName) {
    if (confirm(`WARNING: This will delete ALL episodes of "${seriesName}". Are you sure?`)) {
        // Find all keys to delete
        const targets = movies.filter(m => m.seriesName === seriesName && m.type === 'series');

        targets.forEach(m => {
            const ref = window.ref(window.db, 'movies/' + m.firebaseKey);
            window.remove(ref);
        });

        alert("Series Deleted.");
        closeSeriesPage();
    }
}

function setHeroMovie(item) {
    if (!item) return;

    // Reset Hero UI
    const episodesContainer = document.getElementById('hero-episodes');
    episodesContainer.classList.add('hidden');
    heroDownloadBtn.style.display = 'inline-block'; // default

    let displayTitle = item.title;
    if (item.isGroup) displayTitle = item.seriesName;

    heroTitle.innerText = displayTitle;
    heroDesc.innerText = item.desc;
    heroBg.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,1)), url('${item.thumbnail}')`;

    const newPlayBtn = heroPlayBtn.cloneNode(true);
    heroPlayBtn.parentNode.replaceChild(newPlayBtn, heroPlayBtn);
    heroPlayBtn = newPlayBtn; // Update reference

    // SERIES LOGIC
    if (item.isGroup) {
        // Render Series UI
        episodesContainer.classList.remove('hidden');
        renderEpisodeUI(item, episodesContainer);

        // Default Play = S1 E1
        const firstEp = item.episodes[0];
        newPlayBtn.addEventListener('click', () => {
            handlePlayClick(firstEp, firstEp.video);
            addToHistory(item);
        });
        updateHeroDownload(firstEp);
        heroDesc.innerText = `${item.desc} (S${firstEp.season}:E${firstEp.episode} - ${firstEp.epTitle || 'Episode ' + firstEp.episode})`;

    } else {
        // SINGLE MOVIE LOGIC
        newPlayBtn.addEventListener('click', () => {
            handlePlayClick(item, item.video);
            addToHistory(item);
        });
        updateHeroDownload(item);
    }
}

function updateHeroDownload(movie) {
    const newDownloadBtn = heroDownloadBtn.cloneNode(true);
    heroDownloadBtn.parentNode.replaceChild(newDownloadBtn, heroDownloadBtn);
    heroDownloadBtn = newDownloadBtn; // Update reference

    if (movie.downloadUrl) {
        newDownloadBtn.classList.remove('disabled');
        newDownloadBtn.innerHTML = '<i class="fa-solid fa-download"></i> Download';
        newDownloadBtn.style.opacity = '1';
        newDownloadBtn.style.display = 'inline-block';
        newDownloadBtn.addEventListener('click', () => downloadMovie(movie.downloadUrl));
    } else {
        newDownloadBtn.innerHTML = '<i class="fa-solid fa-ban"></i> No Download';
        newDownloadBtn.style.opacity = '0.5';
        newDownloadBtn.onclick = () => alert("No download link provided for this title.");
    }
}

function renderEpisodeUI(seriesObj, container) {
    // 1. Get Unique Seasons
    const seasons = [...new Set(seriesObj.episodes.map(e => e.season))].sort((a, b) => a - b);

    // Create Select
    let html = `<select id="season-select" class="season-selector">`;
    seasons.forEach(s => {
        html += `<option value="${s}">Season ${s}</option>`;
    });
    html += `</select>`;

    // Create List Container
    html += `<div id="ep-list-content"></div>`;
    container.innerHTML = html;

    const select = document.getElementById('season-select');
    const listContent = document.getElementById('ep-list-content');

    // Render Event
    select.addEventListener('change', () => {
        renderEpisodeList(seriesObj, select.value, listContent);
    });

    // Initial Render (First Season)
    if (seasons.length > 0) {
        renderEpisodeList(seriesObj, seasons[0], listContent);
    }
}

function renderEpisodeList(seriesObj, seasonNum, container) {
    const eps = seriesObj.episodes.filter(e => e.season == seasonNum);
    container.innerHTML = '';

    eps.forEach(ep => {
        const div = document.createElement('div');
        div.className = 'episode-item';
        div.innerHTML = `
            <div class="episode-number">${ep.episode}</div>
            <div class="episode-info">
                <h4>${ep.epTitle || 'Episode ' + ep.episode}</h4>
                <small>${ep.title}</small>
            </div>
            <i class="fa-solid fa-play" style="margin-left:auto; opacity:0.5;"></i>
        `;
        div.addEventListener('click', () => {
            // Play this ep
            handlePlayClick(ep, ep.video);
            addToHistory(seriesObj); // Add Series to History
            updateHeroDownload(ep);
            heroDesc.innerText = `${ep.desc} (S${ep.season}:E${ep.episode})`;

            // Update Active State
            document.querySelectorAll('.episode-item').forEach(d => d.classList.remove('active'));
            div.classList.add('active');
        });
        container.appendChild(div);
    });
}

function downloadMovie(url) {
    if (confirm("Open download link?")) {
        window.open(url, '_blank');
    }
}

// --- Caution Modal Logic ---
const cautionModal = document.getElementById('audio-caution-modal');
const cautionPlayBtn = document.getElementById('caution-play-btn');
const cautionDownloadBtn = document.getElementById('caution-download-btn');
const closeCaution = document.getElementById('close-caution');

let pendingVideoUrl = '';
let pendingDownloadUrl = '';

function handlePlayClick(item, videoUrl) {
    if (item.isMultiAudio) {
        // Show Caution
        pendingVideoUrl = videoUrl;
        pendingDownloadUrl = item.downloadUrl;
        cautionModal.classList.remove('hidden');
    } else {
        // Play Directly
        playVideo(videoUrl);
    }
}

cautionPlayBtn.onclick = () => {
    cautionModal.classList.add('hidden');
    playVideo(pendingVideoUrl);
};

cautionDownloadBtn.onclick = () => {
    cautionModal.classList.add('hidden');
    if (pendingDownloadUrl) downloadMovie(pendingDownloadUrl);
    else alert("No download link available.");
};

closeCaution.onclick = () => {
    cautionModal.classList.add('hidden');
    pendingVideoUrl = '';
    pendingDownloadUrl = '';
};

function playVideo(url) {
    playerOverlay.classList.remove('hidden');
    // ... URLs Logic ...
    if (url.includes('youtube.com/watch?v=')) {
        url = url.replace('watch?v=', 'embed/');
    } else if (url.includes('youtu.be/')) {
        url = url.replace('youtu.be/', 'youtube.com/embed/');
    }
    if (url.includes('drive.google.com') && (url.includes('/view') || url.includes('/edit'))) {
        url = url.replace('/view', '/preview').replace('/edit', '/preview');
    }
    iframe.src = url;
}

closePlayer.addEventListener('click', () => {
    playerOverlay.classList.add('hidden');
    iframe.src = '';
});

// --- Upload Logic ---
uploadBtn.addEventListener('click', () => { uploadModal.classList.remove('hidden'); });
closeUpload.addEventListener('click', () => { uploadModal.classList.add('hidden'); });

fileInput.addEventListener('change', (e) => {
    fileNameDisplay.innerText = fileInput.files.length > 0 ? fileInput.files[0].name : "Choose Image File";
});

window.toggleSeriesFields = function () {
    const type = document.getElementById('m-type').value;
    const fields = document.getElementById('series-fields');
    if (type === 'series') {
        fields.classList.remove('hidden');
    } else {
        fields.classList.add('hidden');
    }
}

uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('m-title').value;
    const type = document.getElementById('m-type').value;
    const genre = document.getElementById('m-genre').value;
    const desc = document.getElementById('m-desc').value;
    const videoUrl = document.getElementById('m-video').value;
    const downloadUrl = document.getElementById('m-download').value;
    const thumbUrlInput = document.getElementById('m-thumb-url').value;
    const seriesName = document.getElementById('m-series-name').value;
    const season = document.getElementById('m-season').value;
    const episode = document.getElementById('m-episode').value;
    const epTitle = document.getElementById('m-ep-title').value;
    const isMultiAudio = document.getElementById('m-multi-audio').checked;
    const thumbFile = fileInput.files[0];

    // ... (Thumbnail upload logic remains same) ...
    let finalThumbnail = thumbUrlInput;
    if (thumbFile) {
        // ... Re-implement upload copy to secure context ... 
        uploadStatus.classList.remove('hidden');
        uploadStatus.innerText = "Uploading Image...";
        try {
            const fileName = Date.now() + '_' + thumbFile.name;
            const storageRef = window.sRef(window.storage, 'thumbnails/' + fileName);
            await window.uploadBytes(storageRef, thumbFile);
            finalThumbnail = await window.getDownloadURL(storageRef);
        } catch (err) {
            console.error(err);
            alert("Upload Failed: " + err.message);
            uploadStatus.classList.add('hidden');
            return;
        }
    }

    if (!finalThumbnail) {
        alert("Please provide a Thumbnail URL or Upload an Image.");
        return;
    }

    const newItem = {
        id: Date.now(),
        title, type, genre, desc, video: videoUrl, downloadUrl, thumbnail: finalThumbnail,
        // New Metadata
        seriesName: (type === 'series') ? seriesName : null,
        season: (type === 'series') ? parseInt(season) : null,
        episode: (type === 'series') ? parseInt(episode) : null,
        epTitle: (type === 'series') ? epTitle : null,
        isMultiAudio: isMultiAudio || false
    };

    window.push(window.moviesRef, newItem);
    uploadStatus.classList.add('hidden');
    uploadModal.classList.add('hidden');
    uploadForm.reset();
    fileNameDisplay.innerText = "Choose Image File";
    alert('Content Added!');
    // Reset toggle
    document.getElementById('series-fields').classList.add('hidden');
});

// --- Members Logic ---
membersBtn.addEventListener('click', () => {
    membersModal.classList.remove('hidden');
    renderMembersList();
});
closeMembers.addEventListener('click', () => membersModal.classList.add('hidden'));

function renderMembersList() {
    const list = document.getElementById('members-list');
    list.innerHTML = '';

    users.forEach(u => {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.padding = '0.5rem';
        item.style.borderBottom = '1px solid #333';

        const info = document.createElement('div');
        info.innerHTML = `<strong>${u.name}</strong> <span style="color:#888; font-size:0.8rem">(${u.password})</span>`;

        // Edit Button
        const editBtn = document.createElement('button');
        editBtn.className = 'btn secondary';
        editBtn.style.padding = '0.2rem 0.5rem';
        editBtn.style.fontSize = '0.8rem';
        editBtn.innerText = 'Edit';
        editBtn.onclick = () => editMember(u);

        if (u.role === 'admin') {
            info.innerHTML += ` <span style="color:var(--primary-red); font-size:0.7rem">ADMIN</span>`;
        }

        item.appendChild(info);
        item.appendChild(editBtn);
        list.appendChild(item);
    });
}

addMemberForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('u-name').value;
    const pass = document.getElementById('u-pass').value;

    const newUser = {
        name: name,
        password: pass,
        role: 'viewer'
    };

    window.push(window.usersRef, newUser);
    addMemberForm.reset();
});

function editMember(user) {
    const newName = prompt("Enter new Name:", user.name);
    if (!newName) return;
    const newPass = prompt("Enter new Password:", user.password);
    if (!newPass) return;

    const payload = {
        name: newName,
        password: newPass,
        role: user.role
    };

    window.update(window.ref(window.db), { [`users/${user.key}`]: payload });
}
// --- Robust Security Loop (At end to ensure elements exist) ---
setInterval(() => {
    const widthThreshold = window.outerWidth - window.innerWidth > 160;
    const heightThreshold = window.outerHeight - window.innerHeight > 160;

    // Debugger Trap (Detects if DevTools is open largely independent of size)
    const start = Date.now();
    debugger; // Pauses execution if DevTools is open
    const end = Date.now();
    const debuggerDetected = (end - start > 100);

    if (widthThreshold || heightThreshold || debuggerDetected) {
        document.body.classList.add('security-lockout');
    } else {
        document.body.classList.remove('security-lockout');
    }
}, 1000);
