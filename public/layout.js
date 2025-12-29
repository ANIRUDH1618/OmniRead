const LayoutManager = {
    init(activePage) {
        this.injectFavicon();
        this.injectGlobalStyles();
        this.renderNavigation(activePage);
        this.renderHeader(activePage);
        this.enableZoom();
        this.initPullToRefresh();

        if (window.appState && window.appState.user) {
            this.updateUser(window.appState.user);
        }
    },

    injectFavicon() {
        if (document.querySelector('link[rel="icon"]')) return;
        const link = document.createElement("link");
        link.rel = "icon";
        link.type = "image/svg+xml";
        link.href = "/favicon.svg";
        document.head.appendChild(link);
    },

    // [FIX] Smart Zoom: Disable browser zoom ONLY on Reader to prioritize Book Zoom
    enableZoom() {
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            const isReader = window.location.pathname.includes('reader.html');
            if (isReader) {
                // Reader: Lock viewport so +/- buttons control content
                viewport.setAttribute("content", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no");
            } else {
                // Everywhere else: Allow pinch-to-zoom
                viewport.setAttribute("content", "width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes");
            }
        }
    },

    injectGlobalStyles() {
        if (document.getElementById("mobile-scroll-fix")) return;
        const style = document.createElement("style");
        style.id = "mobile-scroll-fix";
        style.innerHTML = `
            @media (max-width: 1024px) {
                .overflow-y-auto { padding-bottom: 150px !important; }
                #main-scroll-container { padding-bottom: 150px !important; }
            }
            @keyframes spin-slow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `;
        document.head.appendChild(style);
    },

    initPullToRefresh() {
        let touchStartY = 0;
        let isPulling = false;
        const scrollContainer = document.getElementById("view-library") || document.getElementById("main-scroll-container");
        if (!scrollContainer) return;

        if (!document.getElementById("ptr-spinner")) {
            const spinner = document.createElement("div");
            spinner.id = "ptr-spinner";
            spinner.innerHTML = '<i class="ri-loader-4-line text-vermilion text-2xl"></i>';
            spinner.style.cssText = `position: absolute; top: -50px; left: 50%; transform: translateX(-50%); z-index: 50; transition: top 0.2s ease; background: white; border-radius: 50%; padding: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);`;
            scrollContainer.parentElement.appendChild(spinner);
            if (getComputedStyle(scrollContainer.parentElement).position === "static") {
                scrollContainer.parentElement.style.position = "relative";
            }
        }

        const spinner = document.getElementById("ptr-spinner");

        scrollContainer.addEventListener("touchstart", (e) => {
            if (scrollContainer.scrollTop === 0) {
                touchStartY = e.touches[0].clientY;
                isPulling = true;
            }
        }, { passive: true });

        scrollContainer.addEventListener("touchmove", (e) => {
            if (!isPulling) return;
            const touchY = e.touches[0].clientY;
            const pullDistance = touchY - touchStartY;

            if (pullDistance > 0 && scrollContainer.scrollTop === 0) {
                if (pullDistance < 150) {
                    spinner.style.top = `${10 + pullDistance / 3}px`;
                    spinner.style.transform = `translateX(-50%) rotate(${pullDistance * 2}deg)`;
                }
            } else {
                isPulling = false;
                spinner.style.top = "-50px";
            }
        }, { passive: true });

        scrollContainer.addEventListener("touchend", (e) => {
            if (!isPulling) return;
            isPulling = false;
            const touchY = e.changedTouches[0].clientY;
            const pullDistance = touchY - touchStartY;

            if (pullDistance > 100 && scrollContainer.scrollTop === 0) {
                spinner.style.top = "50px";
                spinner.children[0].classList.add("animate-spin");
                setTimeout(() => { window.location.reload(); }, 500);
            } else {
                spinner.style.top = "-50px";
            }
        });
    },

    renderNavigation(activePage) {
        const container = document.getElementById("app-sidebar");
        if (!container) return;

        const links = {
            dashboard: { id: "dashboard", icon: "ri-home-5-line", label: "Home" },
            library: { id: "library", icon: "ri-book-2-line", label: "Library" },
            bookshelf: { id: "bookshelf", icon: "ri-book-open-line", label: "Shelf" },
            community: { id: "community", icon: "ri-discuss-line", label: "Symposium" },
            inscribe: { id: "inscribe", icon: "ri-quill-pen-line", label: "Inscribe" },
        };

        let menuItems = activePage === "profile" ? [links.dashboard] : Object.values(links);

        const desktopNavHtml = menuItems.map((item) => {
            const isActive = item.id === activePage;
            return `
                <button onclick="window.location.href='/${item.id}'" class="w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${isActive ? "bg-cream-100 dark:bg-ink-700 text-vermilion font-bold" : "text-gray-500 hover:bg-cream-100 dark:hover:bg-ink-700"}">
                    <i class="${item.icon} text-xl"></i><span class="font-medium">${item.label}</span>
                </button>
            `;
        }).join("");

        // [FIX] Removed Profile Button from Mobile Bottom Nav
        const mobileNavHtml = menuItems.map((item) => {
            const isActive = item.id === activePage;
            return `
                <button onclick="window.location.href='/${item.id}'" class="flex-1 flex flex-col items-center justify-center py-2 gap-1 ${isActive ? "text-vermilion" : "text-gray-400"}">
                    <i class="${item.icon} text-2xl ${isActive ? "drop-shadow-sm" : ""}"></i>
                    <span class="text-[10px] font-medium tracking-wide">${item.label}</span>
                </button>
            `;
        }).join("");

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
            </nav>
        `;

        if (window.toggleTheme) document.getElementById("theme-toggle").addEventListener("click", () => window.toggleTheme());
        const profBtn = document.getElementById("sidebar-profile-btn");
        if (profBtn) profBtn.addEventListener("click", () => (window.location.href = "/profile"));
        if (window.updateThemeIcon) window.updateThemeIcon();
    },

    renderHeader(activePage) {
        const container = document.getElementById("app-header");
        if (!container) return;

        let title = "Personal Archives"; let subtitle = "Query the Archives";
        if (activePage === "dashboard") { title = "Welcome back"; subtitle = "Your reading overview"; } 
        else if (activePage === "library") { title = "Full Catalog"; subtitle = "Explore the complete collection"; } 
        else if (activePage === "bookshelf") { title = "My Bookshelf"; subtitle = "Your curated reading list"; } 
        else if (activePage === "inscribe") { title = "Inscribe Tome"; subtitle = "Upload new knowledge"; } 
        else if (activePage === "profile") { title = "Identity Ledger"; subtitle = "Manage your digital signature"; } 
        else if (activePage === "community") { title = "The Symposium"; subtitle = "A Gathering of Minds"; } 
        else if (activePage === "reviews") { title = "Literary Critique"; subtitle = "Discourse & Reflections"; }

        const showSearch = !['inscribe', 'profile', 'community', 'reviews'].includes(activePage);

        container.innerHTML = `
            <header class="sticky top-0 z-40 bg-cream-50/90 dark:bg-ink-900/90 backdrop-blur-md border-b border-cream-200 dark:border-ink-700 transition-all duration-300">
                <div class="px-4 lg:px-8 py-3 lg:py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    
                    <div class="flex items-center justify-between lg:w-auto gap-4">
                        <div>
                            <h2 id="header-title" class="font-serif text-lg lg:text-xl font-bold text-ink-900 dark:text-white leading-tight">${title}</h2>
                            <p id="header-subtitle" class="text-[10px] lg:text-xs text-gray-500 font-mono uppercase tracking-widest">${subtitle}</p>
                        </div>
                        
                        <div class="flex items-center gap-2 lg:hidden">
                            <button onclick="window.location.href='/profile'" class="relative rounded-full overflow-hidden w-8 h-8 ring-2 ring-transparent active:ring-vermilion transition-all">
                                <img id="mobile-header-profile-img" src="" class="w-full h-full object-cover">
                            </button>
                            <button onclick="window.toggleNotifications()" class="relative p-2 rounded-full bg-cream-100 dark:bg-ink-800 text-gray-500 dark:text-gray-300">
                                <i class="ri-notification-3-line text-lg"></i>
                                <span id="mobile-notif-dot" class="hidden absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-ink-900"></span>
                            </button>
                            <button onclick="window.toggleTheme()" class="p-2 rounded-full bg-cream-100 dark:bg-ink-800 text-gray-500 dark:text-gray-300">
                                <i id="mobile-theme-icon" class="ri-sun-line text-lg"></i>
                            </button>
                        </div>
                    </div>

                    <div class="flex items-center gap-4 w-full lg:w-auto">
                        ${ showSearch ? `
                        <div class="relative w-full lg:w-64 hidden lg:block">
                            <i class="ri-search-2-line absolute left-3 top-1/2 -translate-y-1/2 text-vermilion"></i>
                            <input id="search-input" type="text" placeholder="Search..." class="w-full pl-10 pr-4 py-2 bg-white dark:bg-ink-800 border border-cream-200 dark:border-ink-700 rounded-xl text-sm focus:border-vermilion focus:ring-1 outline-none transition-all">
                        </div>` : '' }
                        
                        <button onclick="window.toggleNotifications()" class="hidden lg:flex relative p-2.5 rounded-xl border border-cream-200 dark:border-ink-600 hover:bg-cream-100 dark:hover:bg-ink-700 transition-colors text-gray-500 dark:text-gray-400">
                            <i class="ri-notification-3-line text-xl"></i>
                            <span id="desktop-notif-dot" class="hidden absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full"></span>
                        </button>
                    </div>
                </div>
            </header>
            
            <div id="notif-drawer" class="fixed top-0 right-0 h-full w-80 bg-white dark:bg-ink-800 shadow-2xl transform translate-x-full transition-transform duration-300 z-[60] border-l border-cream-200 dark:border-ink-700 flex flex-col">
                <div class="p-4 border-b border-cream-200 dark:border-ink-700 flex justify-between items-center bg-cream-50/50 dark:bg-ink-900/50 backdrop-blur">
                    <h3 class="font-bold text-sm text-ink-900 dark:text-white uppercase tracking-widest">Notifications</h3>
                    <button onclick="window.toggleNotifications()" class="text-gray-500 hover:text-ink-900 dark:hover:text-white"><i class="ri-close-line text-xl"></i></button>
                </div>
                <div id="notif-list" class="flex-1 overflow-y-auto p-4 space-y-3"></div>
                <div class="p-3 border-t border-cream-200 dark:border-ink-700 text-center">
                    <button onclick="window.markAllRead()" class="text-xs font-bold text-vermilion hover:underline">Mark all as read</button>
                </div>
            </div>
            <div id="notif-overlay" onclick="window.toggleNotifications()" class="fixed inset-0 z-[55] bg-black/20 backdrop-blur-[1px] hidden transition-opacity"></div>
        `;
        
        if (window.initNotifications) window.initNotifications();
    },

    updateUser(user) {
        const img = document.getElementById("sidebar-user-img");
        const mobileImg = document.getElementById("mobile-header-profile-img");
        const name = document.getElementById("sidebar-user-name");
        const title = document.getElementById("header-title");

        const setImg = (el) => {
            if (!el) return;
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
        const mobileThemeIcon = document.getElementById("mobile-theme-icon");
        if (mobileThemeIcon) {
            mobileThemeIcon.className = document.documentElement.classList.contains("dark") ? "ri-sun-line text-lg" : "ri-moon-line text-lg";
        }
    },
};

// --- GLOBAL NOTIFICATION LOGIC ---
window.initNotifications = async function() {
    window.toggleNotifications = () => {
        const drawer = document.getElementById('notif-drawer');
        const overlay = document.getElementById('notif-overlay');
        if (drawer.classList.contains('translate-x-full')) {
            drawer.classList.remove('translate-x-full');
            overlay.classList.remove('hidden');
            window.loadNotifications(); 
        } else {
            drawer.classList.add('translate-x-full');
            overlay.classList.add('hidden');
        }
    };

    window.loadNotifications = async () => {
        const list = document.getElementById('notif-list');
        if (!list) return;
        list.innerHTML = '<div class="text-center py-4"><i class="ri-loader-4-line animate-spin text-vermilion"></i></div>';
        
        try {
            const res = await API.get('/api/notifications');
            if (res.success) {
                const hasUnread = res.unread > 0;
                const deskDot = document.getElementById('desktop-notif-dot');
                const mobDot = document.getElementById('mobile-notif-dot');
                if (deskDot) deskDot.classList.toggle('hidden', !hasUnread);
                if (mobDot) mobDot.classList.toggle('hidden', !hasUnread);

                if (res.data.length === 0) {
                    list.innerHTML = '<p class="text-center text-gray-500 text-xs py-4">No new signals.</p>';
                    return;
                }

                list.innerHTML = res.data.map(n => {
                    // Fallback logic for older notifications + Handle New Types
                    let summary = n.summary;
                    if (!summary) {
                        if (n.type === 'comment_post') summary = 'commented on your post';
                        else if (n.type === 'comment_book') summary = 'commented on your book';
                        else if (n.type === 'reply_comment') summary = 'replied to your comment';
                    }
                    
                    const relatedId = n.relatedId || '';
                    const bgClass = n.isRead ? 'opacity-60' : 'bg-cream-100 dark:bg-ink-700 border-vermilion/30';
                    
                    return `
                    <div id="notif-${n._id}" class="relative p-3 rounded-lg ${bgClass} border border-cream-200 dark:border-ink-600 flex gap-3 items-start group transition-all hover:border-vermilion">
                        <img src="${n.sender.photo}" class="w-8 h-8 rounded-full object-cover border border-gray-300 dark:border-ink-500 mt-1">
                        <div class="flex-1 min-w-0">
                            <div class="cursor-pointer" onclick="handleNotifClick('${n._id}', '${n.type}', '${n.resourceId}', '${relatedId}')">
                                <p class="text-xs text-ink-900 dark:text-gray-200 leading-snug pr-6">
                                    <span class="font-bold">${n.sender.name}</span> ${summary}
                                </p>
                                <p class="text-[10px] text-gray-400 mt-1">${new Date(n.createdAt).toLocaleDateString()}</p>
                            </div>
                            
                            <div class="relative mt-2">
                                <p id="notif-ctx-${n._id}" class="text-xs text-gray-500 italic line-clamp-1 transition-all duration-300 pr-6 border-l-2 border-vermilion/30 pl-2">"${n.context}"</p>
                                <button onclick="toggleNotifExpand('${n._id}', this)" class="absolute top-0 right-0 text-gray-400 hover:text-vermilion p-0.5"><i class="ri-arrow-down-s-line"></i></button>
                            </div>
                        </div>

                        <button onclick="deleteNotification('${n._id}', event)" class="absolute top-2 right-2 text-gray-400 hover:text-red-500 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" title="Remove">
                            <i class="ri-close-line"></i>
                        </button>
                    </div>
                `}).join('');
            }
        } catch(e) { if(list) list.innerHTML = '<p class="text-red-500 text-center text-xs">Connection failed.</p>'; }
    };

    window.markAllRead = async () => {
        await API.put('/api/notifications/read-all');
        window.loadNotifications();
    };
    
    window.deleteNotification = async (id, event) => {
        event.stopPropagation(); 
        const el = document.getElementById(`notif-${id}`);
        if(el) el.style.opacity = '0.2';
        try {
            await API.delete(`/api/notifications/${id}`);
            if(el) el.remove();
            const list = document.getElementById('notif-list');
            if(list && list.children.length === 0) list.innerHTML = '<p class="text-center text-gray-500 text-xs py-4">No new signals.</p>';
        } catch(e) { if(el) el.style.opacity = '1'; }
    };

    // [FIX] Redirect to REVIEW PAGE
    window.handleNotifClick = async (notifId, type, resourceId, relatedId) => {
        // 1. Mark Read
        await API.put(`/api/notifications/${notifId}/read`);
        
        // 2. Redirect
        if (type === 'comment_book' || type === 'reply_comment') {
            // [CHANGE] Redirect to Review Page instead of Reader
            let url = `/review.html?bookId=${resourceId}`;
            if (relatedId && relatedId !== 'null' && relatedId !== 'undefined') {
                url += `&chapterId=${relatedId}`;
            }
            window.location.href = url;
        } else if (type === 'comment_post') {
            window.location.href = '/community';
        }
    };

    window.toggleNotifExpand = (id, btn) => {
        const p = document.getElementById(`notif-ctx-${id}`);
        if (p.classList.contains('line-clamp-1')) {
            p.classList.remove('line-clamp-1');
            btn.innerHTML = '<i class="ri-arrow-up-s-line"></i>';
        } else {
            p.classList.add('line-clamp-1');
            btn.innerHTML = '<i class="ri-arrow-down-s-line"></i>';
        }
    };
    
    window.loadNotifications();
};