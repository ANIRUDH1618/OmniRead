window.appState = { user: null, books: [], allBooks: [], progress: null };

// --- 1. THEME ---
window.initTheme = function() {
    const localTheme = localStorage.getItem('theme');
    const html = document.documentElement;
    if (localTheme === 'dark' || !localTheme) html.classList.add('dark');
    else html.classList.remove('dark');
    window.updateThemeIcon();
};

window.updateThemeIcon = function() {
    const icon = document.getElementById('theme-icon');
    if(icon) {
        icon.className = document.documentElement.classList.contains('dark') ? 'ri-sun-line text-lg' : 'ri-moon-line text-lg';
    }
};

window.toggleTheme = async function() {
    const html = document.documentElement;
    const isDark = html.classList.contains('dark');
    const newTheme = isDark ? 'light' : 'dark';
    if (newTheme === 'dark') html.classList.add('dark');
    else html.classList.remove('dark');
    window.updateThemeIcon();
    localStorage.setItem('theme', newTheme);
    if (window.appState.user) {
        try { await API.put('/api/me/theme', { theme: newTheme }); } catch (e) {}
    }
};

// --- 2. USER DATA ---
window.loadUser = async function() {
    try {
        if (window.appState.user) return window.appState.user;
        const res = await API.get("/api/me");
        if (res.success) {
            window.appState.user = res.data;
            window.appState.progress = res.progress;
            if (typeof LayoutManager !== 'undefined') LayoutManager.updateUser(res.data);
            if (typeof StreakManager !== 'undefined') StreakManager.init(res.data._id);
            if (res.data.preferences?.theme) window.syncThemeWithDB(res.data.preferences.theme);
            return res.data;
        }
    } catch (e) { console.warn("User load failed", e); }
    return null;
};

window.syncThemeWithDB = function(dbTheme) {
    if (!dbTheme) return;
    const currentLocal = localStorage.getItem('theme');
    if (dbTheme !== currentLocal) {
        const html = document.documentElement;
        if (dbTheme === 'dark') { html.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
        else { html.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
        window.updateThemeIcon();
    }
};

// --- 3. API WRAPPER ---
const API = {
    async request(method, url, body = null) {
        const options = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) options.body = JSON.stringify(body);
        try {
            const res = await fetch(url, options);
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") === -1) {
                if(res.status === 401) window.location.href = '/login';
                throw new Error("Server Error");
            }
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Request failed');
            return data;
        } catch (err) {
            if (url !== '/api/me') console.error(err);
            throw err;
        }
    },
    get: (url) => API.request('GET', url),
    post: (url, body) => API.request('POST', url, body),
    put: (url, body) => API.request('PUT', url, body),
    delete: (url) => API.request('DELETE', url)
};
window.API = API;

// --- 4. RENDERERS ---
window.getStatusBanner = () => `
  <div class="w-10 h-14 bg-vermilion shadow-vermilion/40 shadow-xl flex items-center justify-center rounded-b-2xl backdrop-blur-md border-x border-b border-white/10 pb-1">
       <i class="ri-check-line text-white font-bold text-xl drop-shadow-md"></i>
  </div>
`;

window.showToast = function(title, message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = "fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none";
        document.body.appendChild(container);
    }
    const div = document.createElement('div');
    div.className = "animate-slide-in pointer-events-auto flex items-start gap-4 px-6 py-4 rounded-md shadow-xl max-w-sm border-l-4 backdrop-blur-md";
    if (type === 'error') {
        div.classList.add('bg-red-50/95', 'border-red-500', 'text-red-900');
        div.innerHTML = `<div class="shrink-0 pt-0.5"><i class="ri-error-warning-fill text-xl text-red-500"></i></div><div><h4 class="font-serif font-bold text-red-800 mb-1">${title}</h4><p class="text-xs font-medium text-red-700 leading-relaxed">${message}</p></div>`;
    } else {
        div.classList.add('bg-green-50/95', 'border-green-500', 'text-green-900');
        div.innerHTML = `<div class="shrink-0 pt-0.5"><i class="ri-checkbox-circle-fill text-xl text-green-500"></i></div><div><h4 class="font-serif font-bold text-green-800 mb-1">${title}</h4><p class="text-xs font-medium text-green-700 leading-relaxed">${message}</p></div>`;
    }
    container.appendChild(div);
    setTimeout(() => {
        div.classList.add('animate-fade-out');
        div.addEventListener('animationend', () => div.remove());
    }, 3500);
};

// [CRITICAL FIX] ID Comparison using .toString()
window.isBookmarked = (bookId) => {
    if (!window.appState.user || !window.appState.user.bookmarks) return false;
    return window.appState.user.bookmarks.some(b => {
        const idToCheck = b._id || b; // Handle object or string
        return idToCheck.toString() === bookId.toString();
    });
};

window.renderBookGrid = function(booksToRender) {
    const grid = document.getElementById("book-grid");
    if (!grid) return;
    grid.innerHTML = "";
    if (booksToRender.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center py-10 text-gray-500 italic">No matching tomes found.</div>';
        return;
    }
    booksToRender.forEach((book) => {
        const bookmarked = window.isBookmarked(book._id);
        const bannerState = bookmarked ? "active" : "inactive";
        const toggleIcon = bookmarked ? "ri-bookmark-fill" : "ri-bookmark-line";
        const toggleColor = bookmarked ? "text-vermilion" : "text-white";
        const div = document.createElement("div");
        div.className = "group relative flex flex-col gap-3 animate-fade-in";
        div.innerHTML = `
            <div class="aspect-[2/3] bg-ink-800 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all relative border border-ink-700 group-hover:border-vermilion/50">
                <img src="${book.coverImage}" class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105">
                <div id="status-banner-${book._id}" class="absolute top-0 left-5 z-20 bookmark-banner ${bannerState}">
                    ${window.getStatusBanner()}
                </div>
                <button onclick="handleBookmarkToggle(event, '${book._id}')" class="absolute top-3 right-3 p-2.5 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md transition-all duration-300 z-30 cursor-pointer opacity-0 group-hover:opacity-100 transform translate-y-[-10px] group-hover:translate-y-0 shadow-lg border border-white/10 group-hover:scale-100 active:scale-95">
                    <i id="toggle-icon-${book._id}" class="${toggleIcon} ${toggleColor} text-xl transition-all duration-300"></i>
                </button>
                <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10 pointer-events-none">
                    <button class="pointer-events-auto bg-white text-black px-6 py-2 rounded-full text-xs font-bold transform translate-y-4 group-hover:translate-y-0 transition-transform shadow-lg hover:bg-vermilion hover:text-white" onclick="window.location.href='/reader.html?bookId=${book._id}'">Read Now</button>
                </div>
            </div>
            <div>
                <h3 class="font-serif font-bold text-ink-900 dark:text-gray-200 truncate safe-title"></h3>
                <p class="text-xs text-gray-500 safe-author"></p>
            </div>`;
        div.querySelector('.safe-title').textContent = book.title;
        div.querySelector('.safe-author').textContent = book.author;
        grid.appendChild(div);
    });
};

window.handleBookmarkToggle = async function(event, bookId) {
    event.stopPropagation();
    if (!window.appState.user) return showToast("Access Denied", "Log in to manage archives.", "error");
    const banner = document.getElementById(`status-banner-${bookId}`);
    const toggleIcon = document.getElementById(`toggle-icon-${bookId}`);
    if (banner) {
        if (banner.classList.contains("active")) {
            banner.classList.remove("active"); banner.classList.add("inactive");
            if(toggleIcon) toggleIcon.className = "ri-bookmark-line text-white text-xl transition-all duration-300";
        } else {
            banner.classList.remove("inactive"); banner.classList.add("active"); 
            if(toggleIcon) toggleIcon.className = "ri-bookmark-fill text-vermilion text-xl transition-all duration-300";
        }
    }
    try {
        const data = await API.put(`/api/books/${bookId}/bookmark`);
        window.appState.user.bookmarks = data.bookmarks;
        const event = new CustomEvent('bookmarkUpdated', { detail: { bookId, bookmarks: data.bookmarks } });
        window.dispatchEvent(event);
    } catch (err) {}
};