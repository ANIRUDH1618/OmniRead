const LayoutManager = {
    init(activePage) {
        this.injectFavicon();
        this.renderSidebar(activePage);
        this.renderHeader(activePage);
        
        if(window.appState && window.appState.user) {
            this.updateUser(window.appState.user);
        }
    },

    injectFavicon() {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.href = '/favicon.svg';
    document.head.appendChild(link);
    },

    renderSidebar(activePage) {
        const container = document.getElementById('app-sidebar');
        if (!container) return;

        const links = {
            dashboard: { id: 'dashboard', icon: 'ri-home-5-line', label: 'Home' },
            library: { id: 'library', icon: 'ri-book-2-line', label: 'Library' },
            bookshelf: { id: 'bookshelf', icon: 'ri-book-open-line', label: 'My Bookshelf' },
            inscribe: { id: 'inscribe', icon: 'ri-quill-pen-line', label: 'Inscribe Tome' }
        };

        let menuItems = [];
        if (activePage === 'dashboard') {
            menuItems = [links.dashboard, links.library, links.bookshelf, links.inscribe];
        } else if (activePage === 'profile') {
            menuItems = [links.dashboard]; // Profile only needs Home
        } else {
            menuItems.push(links.dashboard);
            if (links[activePage]) menuItems.push(links[activePage]);
        }

        const navHtml = menuItems.map(item => {
            const isActive = item.id === activePage;
            const activeClasses = 'bg-cream-100 dark:bg-ink-700 text-ink-900 dark:text-white font-medium shadow-sm';
            const inactiveClasses = 'text-gray-500 dark:text-gray-400 hover:bg-cream-100 dark:hover:bg-ink-700';
            
            return `
                <button onclick="window.location.href='/${item.id}'" class="w-full nav-item flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${isActive ? activeClasses : inactiveClasses}">
                    <i class="${item.icon} text-lg"></i><span class="hidden lg:block">${item.label}</span>
                </button>
            `;
        }).join('');

        // [FIX] Explicitly exclude profile button if on Profile Page
        const profileButtonHtml = activePage === 'profile' ? '' : `
            <button id="sidebar-profile-btn" class="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-cream-100 dark:hover:bg-ink-700 transition-all group text-left border border-transparent hover:border-cream-200 dark:hover:border-ink-600">
                <img id="sidebar-user-img" src="" class="w-10 h-10 rounded-full object-cover border border-cream-200 dark:border-ink-600 shadow-sm opacity-0 transition-opacity duration-500">
                <div class="hidden lg:block overflow-hidden flex-1">
                    <p id="sidebar-user-name" class="text-sm font-bold text-ink-900 dark:text-gray-100 truncate">Loading...</p>
                    <p id="sidebar-user-role" class="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">Reader</p>
                </div>
            </button>
        `;

        container.innerHTML = `
            <aside class="w-20 lg:w-64 bg-white dark:bg-ink-800 border-r border-cream-200 dark:border-ink-700 flex flex-col justify-between py-6 z-40 shrink-0 h-full transition-colors duration-300">
                <div class="px-6 flex items-center gap-3 mb-8 cursor-pointer" onclick="window.location.href='/dashboard'">
                    <svg class="w-8 h-8 text-vermilion shrink-0" viewBox="0 0 40 40" fill="none">
                        <path d="M20 8C14 8 8 12 8 20C8 28 14 32 20 32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                        <path d="M20 8C26 8 32 12 32 20C32 28 26 32 20 32" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
                        <path d="M20 8V32" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <span class="text-xl font-serif font-bold tracking-tight hidden lg:block text-ink-900 dark:text-white">OmniRead</span>
                </div>
                
                <nav class="flex-1 px-3 space-y-1">
                    ${navHtml}
                </nav>

                <div class="mt-auto px-3 pb-2 space-y-4">
                    ${profileButtonHtml}
                    <button id="theme-toggle" class="w-full flex items-center justify-center lg:justify-start gap-3 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-ink-900 dark:hover:text-white transition-colors">
                        <i id="theme-icon" class="ri-sun-line text-lg"></i>
                        <span class="hidden lg:block">Toggle Theme</span>
                    </button>
                </div>
            </aside>
        `;

        if(window.toggleTheme) document.getElementById('theme-toggle').addEventListener('click', () => window.toggleTheme());
        const profBtn = document.getElementById('sidebar-profile-btn');
        if(profBtn) profBtn.addEventListener('click', () => window.location.href = '/profile');
        
        if(window.updateThemeIcon) window.updateThemeIcon();
    },

    renderHeader(activePage) {
        const container = document.getElementById('app-header');
        if (!container) return;

        let title = "Personal Archives";
        let subtitle = "Curated Collection";
        let searchPlaceholder = "Search...";

        if (activePage === 'dashboard') { title = "Welcome back"; subtitle = ""; searchPlaceholder = "Query the Archives..."; }
        else if (activePage === 'library') { title = "Full Catalog"; subtitle = "Explore all inscriptions"; searchPlaceholder = "Search the Great Hall..."; }
        else if (activePage === 'bookshelf') { title = "Personal Archives"; subtitle = "Your Collection"; searchPlaceholder = "Filter shelf..."; }
        else if (activePage === 'inscribe') { title = "Inscribe Tome"; subtitle = "Add to the collective knowledge"; }
        else if (activePage === 'profile') { title = "Identity Ledger"; subtitle = "Manage Credentials"; }

        const showSearch = activePage !== 'inscribe' && activePage !== 'profile';

        container.innerHTML = `
            <header class="h-20 flex items-center justify-between px-8 border-b border-cream-200 dark:border-ink-700 bg-cream-50/80 dark:bg-ink-900/80 backdrop-blur-md sticky top-0 z-30 transition-colors duration-300">
                <div>
                    <h2 id="header-title" class="font-serif text-lg font-bold text-ink-900 dark:text-white">${title}</h2>
                    ${subtitle ? `<p class="text-xs text-gray-500 font-mono uppercase tracking-widest mt-1">${subtitle}</p>` : ''}
                </div>
                
                ${ showSearch ? `
                <div class="flex items-center gap-6">
                    <div class="relative">
                        <i class="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                        <input id="search-input" type="text" placeholder="${searchPlaceholder}" class="pl-10 pr-4 py-2 bg-white dark:bg-ink-800 border border-cream-200 dark:border-ink-700 rounded-full text-sm w-64 focus:border-vermilion focus:ring-1 focus:ring-vermilion outline-none transition-all placeholder-gray-400">
                    </div>
                </div>` : '' }
            </header>
        `;
    },

    updateUser(user) {
        const img = document.getElementById('sidebar-user-img');
        const name = document.getElementById('sidebar-user-name');
        const role = document.getElementById('sidebar-user-role');
        const title = document.getElementById('header-title');

        if (img) {
            img.src = user.photo;
            img.onload = () => img.classList.remove('opacity-0');
            img.onerror = () => { img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=ea580c&color=fff`; img.classList.remove('opacity-0'); };
        }
        if (name) name.innerText = user.name;
        if (role) role.innerText = user.role === 'admin' ? 'Archivist' : 'Scholar';
        
        if (title && title.innerText === "Welcome back") {
            const hour = new Date().getHours();
            const timeText = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
            title.innerText = `${timeText}, ${user.name.split(" ")[0]}.`;
        }
    }
};