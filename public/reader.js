document.addEventListener('DOMContentLoaded', async () => {
    console.log("OmniRead Reader: v42.0 (Scroll Sync) Loaded"); 
    
    const params = new URLSearchParams(window.location.search);
    const bookId = params.get('bookId');

    if (!bookId) {
        window.location.href = '/dashboard';
        return;
    }

    // [FIX] Attach global scroll listener immediately
    const scrollContainer = document.getElementById('reader-scroll-container');
    if (scrollContainer) {
        scrollContainer.addEventListener('scroll', handleScrollSync);
    }

    await loadBookData(bookId);
});

const readerState = {
    book: null,
    chapters: [],
    currentChapterIndex: 0,
    user: null,
    totalPages: 0,
    currentPage: 1, 
    startPercent: 0, // [NEW] Track percentage instead of page
    currentScale: 1.0,
    autoScale: true
};

const pdfState = {
    pdfDoc: null,
    pagesRendered: new Set(),
    pageObserver: null
};

// --- SCROLL SYNC LOGIC (THE FIX) ---
let scrollTimeout;
function handleScrollSync(e) {
    const container = e.target;
    
    // 1. Calculate Percentage
    const totalHeight = container.scrollHeight - container.clientHeight;
    if (totalHeight <= 0) return;
    
    const percent = (container.scrollTop / totalHeight) * 100;
    
    // 2. Update UI (Smooth, no jumping)
    const topBar = document.getElementById('reader-top-progress');
    const sideBar = document.getElementById('sidebar-progress-bar');
    const sideText = document.getElementById('sidebar-percent');
    
    if(topBar) topBar.style.width = `${percent}%`;
    if(sideBar) sideBar.style.height = `${percent}%`;
    if(sideText) sideText.innerText = `${Math.round(percent)}%`;

    // 3. Save to DB (Debounced)
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        saveProgressToServer(percent);
    }, 1000); 
}

async function saveProgressToServer(percent) {
    if(!readerState.book) return;
    try {
        // We still send currentPage for the footer, but percentComplete is the master
        await fetch('/api/me/last-read', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                bookId: readerState.book._id, 
                currentPage: readerState.currentPage, 
                currentChapterIndex: readerState.currentChapterIndex, 
                percentComplete: percent 
            })
        });
    } catch (e) { console.error("Save failed", e); }
}

// --- NAVIGATION ---
window.handleHeaderNav = function() {
    if (typeof StreakManager !== 'undefined') StreakManager.stopReading();
    window.location.href = '/dashboard';
}

window.resumeReading = function() {
    loadChapter(readerState.currentChapterIndex);
}

// --- DATA LOADING ---
async function loadBookData(id) {
    try {
        const [bookRes, meRes] = await Promise.all([
            fetch(`/api/books/${id}`),
            fetch('/api/me')
        ]);
        const bookData = await bookRes.json();
        const meData = await meRes.json();

        if (bookData.success) {
            readerState.book = bookData.book;
            readerState.chapters = bookData.chapters;
            
            // [FIX] Load the Saved Percentage
            if (bookData.userProgress) {
                readerState.currentChapterIndex = bookData.userProgress.currentChapterIndex || 0;
                readerState.startPercent = bookData.userProgress.percentComplete || 0;
            }
            
            if (meData.success) {
                readerState.user = meData.data;
                if (typeof StreakManager !== 'undefined' && readerState.user._id) {
                    StreakManager.init(readerState.user._id);
                    StreakManager.startReading();
                }
            }
            renderHomeUI();
        }
    } catch (err) { console.error(err); }
}

function renderHomeUI() {
    document.getElementById('home-book-title').innerText = readerState.book.title;
    document.getElementById('home-book-author').innerText = readerState.book.author;
    document.getElementById('home-book-cover').src = readerState.book.coverImage;

    const grid = document.getElementById('chapter-grid');
    grid.innerHTML = '';
    
    const hasChapters = readerState.chapters && readerState.chapters.length > 0;
    const isSinglePdf = readerState.book.uploadType === 'pdf_single' || readerState.book.uploadType === 'textbook';

    if (!hasChapters || isSinglePdf) {
        grid.appendChild(createLongChapterCard("Complete Book", 0, "Master Volume"));
    } else {
        readerState.chapters.forEach((chap, i) => {
            grid.appendChild(createLongChapterCard(chap.title, i, `Chapter ${i + 1}`));
        });
    }
    document.getElementById('chapter-count-label').innerText = `${readerState.chapters.length || 1} Items`;
}

function createLongChapterCard(title, index, subtitle) {
    const btn = document.createElement('button');
    btn.className = "w-full h-24 bg-white dark:bg-ink-800 border border-gray-200 dark:border-ink-700 rounded-xl hover:border-vermilion transition-all shadow-sm flex items-center px-6 gap-6 group";
    btn.innerHTML = `
        <div class="flex items-center justify-center w-10 h-10 rounded-full bg-cream-100 dark:bg-ink-700 text-vermilion font-bold text-sm shrink-0 group-hover:bg-vermilion group-hover:text-white transition-colors">${index + 1}</div>
        <div class="flex-1 text-left">
            <p class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">${subtitle}</p>
            <h3 class="text-lg font-bold text-ink-900 dark:text-white group-hover:text-vermilion transition-colors truncate">${title}</h3>
        </div>
        <i class="ri-arrow-right-line text-2xl text-gray-300 group-hover:text-vermilion"></i>
    `;
    btn.onclick = () => loadChapter(index);
    return btn;
}

// --- READER INITIALIZATION ---

function loadChapter(index) {
    readerState.currentChapterIndex = index;
    document.getElementById('view-book-home').classList.add('hidden');
    document.getElementById('view-reading').classList.remove('hidden');

    const type = readerState.book.uploadType;
    const wrapper = document.getElementById('pdf-wrapper');
    wrapper.innerHTML = ''; 

    // Manual Text Handler
    const isText = (type === 'manual' || type === 'manual_text');
    if (isText) {
        const content = readerState.chapters[index]?.content || "No content.";
        renderManualText(content);
        return;
    }

    // PDF Streamer
    const apiUrl = `/api/books/read/${readerState.book._id}?chapterIndex=${index}`;
    initContinuousPDF(apiUrl);
}

function renderManualText(text) {
    const wrapper = document.getElementById('pdf-wrapper');
    const textContainer = document.createElement('div');
    textContainer.className = "max-w-3xl mx-auto p-6 md:p-8 bg-white dark:bg-ink-800 shadow-sm rounded-lg text-base md:text-lg leading-relaxed text-ink-900 dark:text-gray-200 font-serif whitespace-pre-wrap";
    textContainer.textContent = text || "No content written.";
    wrapper.appendChild(textContainer);
    document.querySelector('.zoom-controls').style.display = 'none';
    
    // Restore Position for text
    restoreScrollPosition();
}

async function initContinuousPDF(url) {
    const wrapper = document.getElementById('pdf-wrapper');
    wrapper.innerHTML = '<div class="text-center py-20 flex flex-col items-center"><i class="ri-loader-4-line animate-spin text-4xl text-vermilion mb-4"></i><span class="text-gray-500 text-sm font-bold uppercase tracking-widest">Deciphering Scroll...</span></div>';
    
    // Show Zoom Controls (Desktop Only via CSS)
    document.querySelector('.zoom-controls').style.display = 'flex';

    if (typeof pdfjsLib === 'undefined') {
        wrapper.innerHTML = '<div class="text-red-500 text-center p-4">Error: PDF Engine not loaded.</div>';
        return;
    }

    pdfState.pagesRendered.clear();
    if(pdfState.pageObserver) pdfState.pageObserver.disconnect();

    try {
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) throw new Error(`Server Error (${response.status})`);
        
        const blob = await response.arrayBuffer();
        if (blob.byteLength === 0) throw new Error("Empty file.");

        const loadingTask = pdfjsLib.getDocument({
            data: blob,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
            cMapPacked: true,
            enableXfa: true
        });

        const pdfDoc_ = await loadingTask.promise;
        pdfState.pdfDoc = pdfDoc_;
        readerState.totalPages = pdfDoc_.numPages;
        
        wrapper.innerHTML = ''; 

        // RENDER PLACEHOLDERS
        for (let i = 1; i <= pdfDoc_.numPages; i++) {
            const pageDiv = document.createElement('div');
            pageDiv.className = 'pdf-page'; 
            pageDiv.id = `page-container-${i}`;
            pageDiv.dataset.pageNum = i;
            
            const canvas = document.createElement('canvas');
            canvas.id = `page-${i}`;
            canvas.className = 'block mx-auto shadow-sm';
            
            pageDiv.appendChild(canvas);
            wrapper.appendChild(pageDiv);
        }

        // Auto-Scale logic (Mobile: 100%, Desktop: Fit Width)
        if (readerState.autoScale) {
            calculateFitWidthScale();
        }

        updateZoomIndicator();
        setupObservers();

        // [FIX] Restore Position Logic
        // We wait a tiny bit for layout to settle, then scroll to percentage
        setTimeout(() => {
            restoreScrollPosition();
        }, 500);

    } catch (err) {
        console.error("PDF Error", err);
        wrapper.innerHTML = `<div class="text-red-500 text-center p-10"><p class="font-bold">Failed to load.</p><p class="text-xs mt-2">${err.message}</p></div>`;
    }
}

function restoreScrollPosition() {
    const container = document.getElementById('reader-scroll-container');
    if (container && readerState.startPercent > 0) {
        const totalHeight = container.scrollHeight - container.clientHeight;
        const targetScroll = (readerState.startPercent / 100) * totalHeight;
        container.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }
}

// --- RENDERING HELPERS ---

window.changeZoom = function(delta) {
    readerState.autoScale = false;
    let newScale = readerState.currentScale + delta;
    if (newScale < 0.3) newScale = 0.3;
    if (newScale > 3.0) newScale = 3.0;
    
    readerState.currentScale = parseFloat(newScale.toFixed(2));
    updateZoomIndicator();
    
    pdfState.pagesRendered.clear();
    setupObservers(); 
}

window.resetZoom = function() {
    readerState.autoScale = true;
    calculateFitWidthScale();
    updateZoomIndicator();
    pdfState.pagesRendered.clear();
    setupObservers();
}

function updateZoomIndicator() {
    const ind = document.getElementById('zoom-level-indicator');
    if(ind) ind.innerText = `${Math.round(readerState.currentScale * 100)}%`;
}

async function calculateFitWidthScale() {
    if (!pdfState.pdfDoc) return;
    try {
        const page = await pdfState.pdfDoc.getPage(1);
        // Mobile check: if screen < 768, maximize usage
        const isMobile = window.innerWidth < 768;
        const padding = isMobile ? 0 : 32;
        
        const containerWidth = document.getElementById('pdf-wrapper').clientWidth - padding;
        const unscaledViewport = page.getViewport({ scale: 1 });
        readerState.currentScale = parseFloat((containerWidth / unscaledViewport.width).toFixed(2));
    } catch(e) {}
}

// --- PAGE OBSERVER (Only for discrete page numbers) ---
function setupObservers() {
    if(pdfState.pageObserver) pdfState.pageObserver.disconnect();

    const options = { root: document.getElementById('reader-scroll-container'), rootMargin: '600px', threshold: 0.01 };
    
    pdfState.pageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const pageNum = parseInt(entry.target.dataset.pageNum);
                renderPage(pageNum);
                readerState.currentPage = pageNum; // Just for reference
            }
        });
    }, options);
    
    document.querySelectorAll('.pdf-page').forEach(div => pdfState.pageObserver.observe(div));
}

function renderPage(num) {
    if (pdfState.pagesRendered.has(num)) return;
    pdfState.pagesRendered.add(num);
    
    pdfState.pdfDoc.getPage(num).then((page) => {
        const canvas = document.getElementById(`page-${num}`);
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        const outputScale = window.devicePixelRatio || 1; 
        
        const viewport = page.getViewport({ scale: readerState.currentScale });
        
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = Math.floor(viewport.width) + "px";
        canvas.style.height = Math.floor(viewport.height) + "px";
        
        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

        page.render({ canvasContext: ctx, transform: transform, viewport: viewport });
    });
}

