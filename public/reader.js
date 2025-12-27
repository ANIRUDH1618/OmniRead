document.addEventListener('DOMContentLoaded', async () => {
    console.log("OmniRead Reader: v40.1 (Authenticated Stream Mode) Loaded"); 
    
    const params = new URLSearchParams(window.location.search);
    const bookId = params.get('bookId');

    if (!bookId) {
        window.location.href = '/dashboard';
        return;
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
    startPage: 1
};

const pdfState = {
    pdfDoc: null,
    pagesRendered: new Set(),
    pageObserver: null
};

// --- NAVIGATION ---
window.handleHeaderNav = function() {
    if (typeof StreakManager !== 'undefined') StreakManager.stopReading();
    const readingView = document.getElementById('view-reading');
    const homeView = document.getElementById('view-book-home');
    if (!readingView.classList.contains('hidden')) {
        readingView.classList.add('hidden');
        homeView.classList.remove('hidden');
    } else {
        window.location.href = '/dashboard';
    }
}

window.resumeReading = function() {
    loadChapter(readerState.currentChapterIndex);
}

window.toggleHomeBookmark = async function() {
    if (!readerState.book) return;
    const icon = document.getElementById('home-bookmark-icon');
    if(icon) {
        const isFilled = icon.classList.contains('ri-bookmark-fill');
        icon.className = isFilled ? 'ri-bookmark-line text-xl' : 'ri-bookmark-fill text-xl';
        if(!isFilled) {
             icon.parentElement.classList.add('border-vermilion', 'text-vermilion');
             icon.parentElement.classList.remove('border-gray-300', 'text-gray-400');
        } else {
             icon.parentElement.classList.remove('border-vermilion', 'text-vermilion');
             icon.parentElement.classList.add('border-gray-300', 'text-gray-400');
        }
    }
    try {
        await fetch(`/api/books/${readerState.book._id}/bookmark`, { method: 'PUT', headers: { 'Content-Type': 'application/json' } });
    } catch (err) { console.error("Bookmark Error", err); }
}

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
            if (bookData.userProgress) {
                readerState.currentChapterIndex = bookData.userProgress.currentChapterIndex || 0;
                readerState.startPage = bookData.userProgress.currentPage || 1;
                readerState.currentPage = readerState.startPage; 
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

    if(readerState.user && readerState.user.bookmarks.includes(readerState.book._id)) {
        const icon = document.getElementById('home-bookmark-icon');
        if(icon) {
             icon.className = 'ri-bookmark-fill text-xl';
             icon.parentElement.classList.add('border-vermilion', 'text-vermilion');
             icon.parentElement.classList.remove('border-gray-300', 'text-gray-400');
        }
    }

    const grid = document.getElementById('chapter-grid');
    grid.innerHTML = '';
    
    // Check if Single PDF or Anthology
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

// --- MAIN READER LOGIC (VIA BACKEND STREAM) ---

function loadChapter(index) {
    readerState.currentChapterIndex = index;
    document.getElementById('view-book-home').classList.add('hidden');
    document.getElementById('view-reading').classList.remove('hidden');

    const type = readerState.book.uploadType;
    const wrapper = document.getElementById('pdf-wrapper');
    wrapper.innerHTML = ''; 

    // 1. Manual Text
    const isText = (type === 'manual' || type === 'manual_text');
    if (isText) {
        const content = readerState.chapters[index]?.content || "No content.";
        renderManualText(content);
        return;
    }

    // 2. PDF -> Call the Server Streamer
    const apiUrl = `/api/books/read/${readerState.book._id}?chapterIndex=${index}`;
    initContinuousPDF(apiUrl);
}

function renderManualText(text) {
    const wrapper = document.getElementById('pdf-wrapper');
    const textContainer = document.createElement('div');
    textContainer.className = "max-w-3xl mx-auto p-8 bg-white dark:bg-ink-800 shadow-sm rounded-lg text-lg leading-relaxed text-ink-900 dark:text-gray-200 font-serif whitespace-pre-wrap";
    textContainer.textContent = text || "No content written.";
    wrapper.appendChild(textContainer);
    document.getElementById('footer-page-total').textContent = "1";
    document.getElementById('footer-page-num').textContent = "1";
}

// ... (Previous code remains same until initContinuousPDF)

async function initContinuousPDF(url) {
    const wrapper = document.getElementById('pdf-wrapper');
    wrapper.innerHTML = '<div class="text-center py-10 flex flex-col items-center"><i class="ri-loader-4-line animate-spin text-3xl text-vermilion mb-2"></i><span class="text-gray-500 mt-2">Opening Document...</span></div>';
    
    if (typeof pdfjsLib === 'undefined') {
        wrapper.innerHTML = '<div class="text-red-500 text-center p-4">Error: PDF Engine not loaded.</div>';
        return;
    }

    pdfState.pagesRendered.clear();
    if(pdfState.pageObserver) pdfState.pageObserver.disconnect();

    try {
        // [IMPORTANT] 'credentials: include' MUST be here to send cookies
        const response = await fetch(url, { credentials: 'include' });
        
        if (!response.ok) {
            // [FIX] Error handling to see if it's Proxy 401 or Auth 401
            const errText = await response.text();
            throw new Error(`Server Error (${response.status}): ${errText.substring(0, 100)}`);
        }
        
        const blob = await response.arrayBuffer();
        // ... (Rest of function is same)

        if (blob.byteLength === 0) {
            throw new Error("Empty file received. Please re-upload this book.");
        }

        const loadingTask = pdfjsLib.getDocument({
            data: blob,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
            cMapPacked: true,
            enableXfa: true
        });

        const pdfDoc_ = await loadingTask.promise;
        pdfState.pdfDoc = pdfDoc_;
        readerState.totalPages = pdfDoc_.numPages;
        
        document.getElementById('footer-page-total').textContent = readerState.totalPages;
        wrapper.innerHTML = ''; 

        for (let i = 1; i <= pdfDoc_.numPages; i++) {
            const pageDiv = document.createElement('div');
            pageDiv.className = 'pdf-page'; 
            pageDiv.id = `page-container-${i}`;
            pageDiv.dataset.pageNum = i;
            const canvas = document.createElement('canvas');
            canvas.id = `page-${i}`;
            canvas.className = 'block mx-auto';
            pageDiv.appendChild(canvas);
            wrapper.appendChild(pageDiv);
        }

        setupObservers();

        if (readerState.startPage > 1) {
            setTimeout(() => {
                const target = document.getElementById(`page-container-${readerState.startPage}`);
                if (target) {
                    target.scrollIntoView({ behavior: 'auto', block: 'start' });
                    updateProgress(readerState.startPage);
                }
            }, 500);
        }

    } catch (err) {
        console.error("PDF Error", err);
        wrapper.innerHTML = `<div class="text-red-500 text-center p-10">
            <p class="font-bold text-lg">Failed to open the book.</p>
            <p class="text-sm opacity-75 mt-2">${err.message}</p>
        </div>`;
    }
}

function setupObservers() {
    const options = { root: document.getElementById('reader-scroll-container'), rootMargin: '600px', threshold: [0.05, 0.5] };
    pdfState.pageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const pageNum = parseInt(entry.target.dataset.pageNum);
                if (!pdfState.pagesRendered.has(pageNum)) renderPage(pageNum);
                if (entry.intersectionRatio > 0.3) updateProgress(pageNum);
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
        const container = document.getElementById('pdf-wrapper');
        const availableWidth = container.clientWidth; 
        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = availableWidth / unscaledViewport.width;
        const viewport = page.getViewport({ scale: scale });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = Math.floor(viewport.width) + "px";
        canvas.style.height = Math.floor(viewport.height) + "px";
        page.render({ canvasContext: ctx, viewport: viewport });
    });
}

function updateProgress(pageNum) {
    readerState.currentPage = pageNum;
    document.getElementById('footer-page-num').textContent = pageNum;
    if (readerState.totalPages > 0) {
        const percent = Math.round((pageNum / readerState.totalPages) * 100);
        document.getElementById('sidebar-progress-bar').style.height = `${percent}%`;
        document.getElementById('sidebar-percent').innerText = `${percent}%`;
        document.getElementById('reader-top-progress').style.width = `${percent}%`;
        saveActiveProgress(pageNum, percent);
    }
}

window.turnPage = function(direction) {
    let targetPage = readerState.currentPage;
    if (direction === 'next') { if (targetPage >= readerState.totalPages) return; targetPage++; } 
    else { if (targetPage <= 1) return; targetPage--; }
    const el = document.getElementById(`page-container-${targetPage}`);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); updateProgress(targetPage); }
}

let saveTimeout;
async function saveActiveProgress(pageNum, percent) {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        try {
            await fetch('/api/me/last-read', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookId: readerState.book._id, currentPage: pageNum, currentChapterIndex: readerState.currentChapterIndex, percentComplete: percent })
            });
        } catch (e) {}
    }, 1000); 
}