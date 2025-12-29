const LayoutManager = {
    init(activePage) {
        this.injectFavicon();
        this.injectGlobalStyles(); 
        this.renderNavigation(activePage); 
        this.renderHeader(activePage);
        this.enableZoom(); // [FIX] Allow pinch-to-zoom
        this.initPullToRefresh(); // [FIX] Add pull-to-refresh
        
        if(window.appState && window.appState.user) {
            this.updateUser(window.appState.user);
        }
    },

    injectFavicon() {
        if (document.querySelector('link[rel="icon"]')) return;
        const link = document.createElement('link');
        link.rel = 'icon';
        link.type = 'image/svg+xml';
        link.href = '/favicon.svg';
        document.head.appendChild(link);
    },

    // [FIX] Force enable zoom by updating the viewport meta tag
    enableZoom() {
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes');
        }
    },

    injectGlobalStyles() {
        if (document.getElementById('mobile-scroll-fix')) return;
        const style = document.createElement('style');
        style.id = 'mobile-scroll-fix';
        // [FIX] Massive bottom padding for mobile to clear the nav bar
        style.innerHTML = `
            @media (max-width: 1024px) {
                .overflow-y-auto { padding-bottom: 150px !important; }
                #main-scroll-container { padding-bottom: 150px !important; }
            }
            /* PTR Spinner Animation */
            @keyframes spin-slow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `;
        document.head.appendChild(style);
    },

    // [FIX] Custom Pull-to-Refresh Logic
    initPullToRefresh() {
        let touchStartY = 0;
        let isPulling = false;
        
        // Find the main scrollable element (supports dashboard or profile)
        const scrollContainer = document.getElementById('view-library') || document.getElementById('main-scroll-container');
        if (!scrollContainer) return;

        // Create spinner if missing (for dashboard/library pages)
        if (!document.getElementById('ptr-spinner')) {
            const spinner = document.createElement('div');
            spinner.id = 'ptr-spinner';
            spinner.innerHTML = '<i class="ri-loader-4-line text-vermilion text-2xl"></i>';
            spinner.style.cssText = `
                position: absolute; top: -50px; left: 50%; transform: translateX(-50%);
                z-index: 50; transition: top 0.2s ease;
                background: white; border-radius: 50%; padding: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            `;
            scrollContainer.parentElement.appendChild(spinner);
            // Ensure container is relative so spinner positions correctly
            if (getComputedStyle(scrollContainer.parentElement).position === 'static') {
                scrollContainer.parentElement.style.position = 'relative';
            }
        }

        const spinner = document.getElementById('ptr-spinner');

        scrollContainer.addEventListener('touchstart', (e) => {
            if (scrollContainer.scrollTop === 0) {
                touchStartY = e.touches[0].clientY;
                isPulling = true;
            }
        }, { passive: true });

        scrollContainer.addEventListener('touchmove', (e) => {
            if (!isPulling) return;
            const touchY = e.touches[0].clientY;
            const pullDistance = touchY - touchStartY;

            if (pullDistance > 0 && scrollContainer.scrollTop === 0) {
                // Visual feedback: Drag spinner down
                if (pullDistance < 150) { // Limit drag visual
                    spinner.style.top = `${10 + (pullDistance / 3)}px`;
                    spinner.style.transform = `translateX(-50%) rotate(${pullDistance * 2}deg)`;
                }
            } else {
                isPulling = false;
                spinner.style.top = '-50px';
            }
        }, { passive: true });

        scrollContainer.addEventListener('touchend', (e) => {
            if (!isPulling) return;
            isPulling = false;
            
            const touchY = e.changedTouches[0].clientY;
            const pullDistance = touchY - touchStartY;

            if (pullDistance > 100 && scrollContainer.scrollTop === 0) {
                // Trigger Refresh
                spinner.style.top = '50px';
                spinner.children[0].classList.add('animate-spin');
                setTimeout(() => {
                    window.location.reload();
                }, 500);
            } else {
                // Reset
                spinner.style.top = '-50px';
            }
        });
    },

    renderNavigation(activePage) {
        const container = document.getElementById('app-sidebar');
        if (!container) return;

        const links = {
            dashboard: { id: 'dashboard', icon: 'ri-home-5-line', label: 'Home' },
            library: { id: 'library', icon: 'ri-book-2-line', label: 'Library' },
            bookshelf: { id: 'bookshelf', icon: 'ri-book-open-line', label: 'Shelf' },
            inscribe: { id: 'inscribe', icon: 'ri-quill-pen-line', label: 'Inscribe' }
        };

        let menuItems = [];
        if (activePage === 'profile') menuItems = [links.dashboard];
        else menuItems = [links.dashboard, links.library, links.bookshelf, links.inscribe];

        const desktopNavHtml = menuItems.map(item => {
            const isActive = item.id === activePage;
            return `
                <button onclick="window.location.href='/${item.id}'" class="w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${isActive ? 'bg-cream-100 dark:bg-ink-700 text-vermilion font-bold' : 'text-gray-500 hover:bg-cream-100 dark:hover:bg-ink-700'}">
                    <i class="${item.icon} text-xl"></i><span class="font-medium">${item.label}</span>
                </button>
            `;
        }).join('');

        const mobileNavHtml = menuItems.map(item => {
            const isActive = item.id === activePage;
            return `
                <button onclick="window.location.href='/${item.id}'" class="flex-1 flex flex-col items-center justify-center py-2 gap-1 ${isActive ? 'text-vermilion' : 'text-gray-400'}">
                    <i class="${item.icon} text-2xl ${isActive ? 'drop-shadow-sm' : ''}"></i>
                    <span class="text-[10px] font-medium tracking-wide">${item.label}</span>
                </button>
            `;
        }).join('');

        container.innerHTML = `
            <aside class="hidden lg:flex w-64 bg-white dark:bg-ink-800 border-r border-cream-200 dark:border-ink-700 flex-col justify-between py-6 h-full sticky top-0">
                <div class="px-6 flex items-center gap-3 mb-8 cursor-pointer" onclick="window.location.href='/dashboard'">
                    <svg class="w-8 h-8 text-vermilion" viewBox="0 0 40 40" fill="none"><path d="M20 8C14 8 8 12 8 20C8 28 14 32 20 32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M20 8C26 8 32 12 32 20C32 28 26 32 20 32" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity="0.7"/><path d="M20 8V32" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                    <span class="text-xl font-serif font-bold text-ink-900 dark:text-white">OmniRead</span>
                </div>
                <nav class="flex-1 px-4 space-y-1">${desktopNavHtml}</nav>
                <div class="px-4 space-y-2">
                    <button id="sidebar-profile-btn" class="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-cream-100 dark:hover:bg-ink-700 transition-all text-left">
                        <img id="sidebar-user-img" src="" class="w-8 h-8 rounded-full object-cover border border-cream-200 dark:border-ink-600">
                        <div class="overflow-hidden">
                            <p id="sidebar-user-name" class="text-xs font-bold text-ink-900 dark:text-gray-100 truncate">Loading...</p>
                        </div>
                    </button>
                    <button id="theme-toggle" class="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-500 hover:text-ink-900 dark:hover:text-white"><i id="theme-icon" class="ri-sun-line text-lg"></i><span>Theme</span></button>
                </div>
            </aside>

            <nav class="lg:hidden fixed bottom-0 left-0 z-50 w-full bg-white/95 dark:bg-ink-900/95 backdrop-blur-xl border-t border-cream-200 dark:border-ink-700 flex justify-around items-center pb-safe-area shadow-[0_-5px_15px_rgba(0,0,0,0.2)]">
                ${mobileNavHtml}
                <button onclick="window.location.href='/profile'" class="flex-1 flex flex-col items-center justify-center py-2 gap-1 text-gray-400">
                     <img id="mobile-user-img" src="https://ui-avatars.com/api/?background=ea580c&color=fff" 
                          onerror="this.src='https://ui-avatars.com/api/?background=ea580c&color=fff'"
                          class="w-6 h-6 rounded-full object-cover border border-gray-300 dark:border-gray-600">
                     <span class="text-[10px] font-medium">You</span>
                </button>
            </nav>
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
        let subtitle = "Query the Archives"; 

        if (activePage === 'dashboard') {
            title = "Welcome back";
            subtitle = "Your reading overview";
        } else if (activePage === 'library') {
            title = "Full Catalog";
            subtitle = "Explore the complete collection";
        } else if (activePage === 'bookshelf') {
            title = "My Bookshelf";
            subtitle = "Your curated reading list";
        } else if (activePage === 'inscribe') {
            title = "Inscribe Tome";
            subtitle = "Upload new knowledge";
        } else if (activePage === 'profile') {
            title = "Identity Ledger";
            subtitle = "Manage your digital signature";
        }

        const showSearch = activePage !== 'inscribe' && activePage !== 'profile';

        container.innerHTML = `
            <header class="sticky top-0 z-40 bg-cream-50/90 dark:bg-ink-900/90 backdrop-blur-md border-b border-cream-200 dark:border-ink-700 transition-all duration-300">
                <div class="px-4 lg:px-8 py-3 lg:py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    
                    <div class="flex items-center justify-between lg:w-auto">
                        <div>
                            <h2 id="header-title" class="font-serif text-lg lg:text-xl font-bold text-ink-900 dark:text-white leading-tight">${title}</h2>
                            <p id="header-subtitle" class="text-[10px] lg:text-xs text-gray-500 font-mono uppercase tracking-widest">${subtitle}</p>
                        </div>
                        <button onclick="window.toggleTheme()" class="lg:hidden p-2 rounded-full bg-cream-100 dark:bg-ink-800 text-gray-500 dark:text-gray-300">
                            <i id="mobile-theme-icon" class="ri-sun-line text-lg"></i>
                        </button>
                    </div>

                    ${ showSearch ? `
                    <div class="relative w-full lg:w-64">
                        <i class="ri-search-2-line absolute left-3 top-1/2 -translate-y-1/2 text-vermilion"></i>
                        <input id="search-input" type="text" placeholder="Search Archives..." 
                            class="w-full pl-10 pr-4 py-2.5 lg:py-2 bg-white dark:bg-ink-800 border border-cream-200 dark:border-ink-700 rounded-xl text-sm focus:border-vermilion focus:ring-1 focus:ring-vermilion outline-none transition-all placeholder-gray-400 shadow-sm">
                    </div>` : '' }
                </div>
            </header>
        `;
    },

    updateUser(user) {
        const img = document.getElementById('sidebar-user-img');
        const mobileImg = document.getElementById('mobile-user-img');
        const name = document.getElementById('sidebar-user-name');
        const title = document.getElementById('header-title');

        const setImg = (el) => {
            if(!el) return;
            el.src = user.photo;
            el.onerror = () => { el.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=ea580c&color=fff`; };
        };

        setImg(img);
        setImg(mobileImg);

        if (name) name.innerText = user.name;
        
        if (title && title.innerText.includes("Welcome")) {
            const hour = new Date().getHours();
            const timeText = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
            title.innerText = `${timeText}, ${user.name.split(" ")[0]}.`;
        }

        const mobileThemeIcon = document.getElementById('mobile-theme-icon');
        if(mobileThemeIcon) {
             mobileThemeIcon.className = document.documentElement.classList.contains('dark') ? 'ri-sun-line text-lg' : 'ri-moon-line text-lg';
        }
    }
};