document.addEventListener('DOMContentLoaded', async () => {
    await window.loadUser(); 
    await loadBookshelf();
});

const shelfState = {
    reading: [],
    uploads: [],
    bookmarks: [],
    currentEditBookId: null,
    activeTab: 'reading',
    pendingDelete: { bookId: null, chapterId: null }
};

// --- DATA LOADING ---
async function loadBookshelf() {
    try {
        const res = await API.get('/api/books/shelf');
        
        if (res.success) {
            shelfState.reading = res.data.reading || [];
            shelfState.uploads = res.data.uploads || [];
            shelfState.bookmarks = res.data.bookmarks || [];
            window.appState.books = [...shelfState.reading, ...shelfState.uploads, ...shelfState.bookmarks];
            renderReading();
            renderUploads();
            renderBookmarks();
        }
    } catch (e) {
        console.error("Shelf Load Error", e);
        showToast("Connection Severed", "The archives are currently unreachable.", "error");
    }
}

// --- LAYOUT & SEARCH ---
window.switchTab = function(tabName) {
    shelfState.activeTab = tabName;
    const tabs = ['reading', 'uploads', 'bookmarks'];
    
    document.getElementById('section-search').classList.add('hidden');
    document.getElementById('tab-container').classList.remove('hidden');

    tabs.forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        const sec = document.getElementById(`section-${t}`);
        if (!btn || !sec) return;

        if (t === tabName) {
            btn.className = "flex-1 px-4 py-1.5 rounded-md text-sm font-bold transition-all bg-vermilion text-white shadow-sm";
            sec.classList.remove('hidden');
        } else {
            btn.className = "flex-1 px-4 py-1.5 rounded-md text-sm font-medium text-gray-500 hover:text-ink-900 dark:text-gray-400 dark:hover:text-white transition-all";
            sec.classList.add('hidden');
        }
    });
}

window.renderBookGrid = function(books) {
    const searchInput = document.getElementById('search-input');
    const isSearching = searchInput && searchInput.value.trim().length > 0;
    
    const searchSection = document.getElementById('section-search');
    const tabContainer = document.getElementById('tab-container');
    const sections = ['reading', 'uploads', 'bookmarks'];

    if (isSearching) {
        tabContainer.classList.add('hidden');
        sections.forEach(s => document.getElementById(`section-${s}`).classList.add('hidden'));
        searchSection.classList.remove('hidden');
        
        const grid = document.getElementById('book-grid');
        grid.innerHTML = '';

        if (books.length === 0) {
            grid.innerHTML = '<p class="col-span-full text-center py-10 text-gray-500 italic">The archives hold no record of such a tome.</p>';
            return;
        }

        books.forEach(book => {
            const div = document.createElement('div');
            div.className = "group relative aspect-[2/3] bg-ink-800 rounded-lg overflow-hidden shadow-md cursor-pointer animate-fade-in";
            div.onclick = () => window.location.href = `/reader.html?bookId=${book._id}`;
            div.innerHTML = `
                <img src="${book.coverImage}" class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105">
                <div class="absolute bottom-0 left-0 w-full p-2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
                    <p class="text-white text-xs font-bold truncate safe-title"></p>
                    <p class="text-gray-300 text-[10px] safe-author"></p>
                </div>`;
            div.querySelector('.safe-title').textContent = book.title;
            div.querySelector('.safe-author').textContent = book.author;
            grid.appendChild(div);
        });

    } else {
        switchTab(shelfState.activeTab);
    }
};

// --- RENDERERS ---
function renderReading() {
    const grid = document.getElementById('reading-grid');
    grid.innerHTML = '';
    if (shelfState.reading.length === 0) {
        grid.innerHTML = `<p class="col-span-full text-gray-500 italic">No tales currently in progress.</p>`;
        return;
    }
    shelfState.reading.forEach(book => {
        const percent = book.percent || 0;
        const div = document.createElement('div');
        div.className = "bg-white dark:bg-ink-800 p-4 rounded-xl border border-cream-200 dark:border-ink-700 shadow-sm flex gap-4 hover:border-vermilion transition-colors group cursor-pointer";
        div.onclick = () => window.location.href = `/reader.html?bookId=${book._id}`;
        div.innerHTML = `
            <img src="${book.coverImage}" class="w-24 h-36 object-cover rounded shadow-md group-hover:scale-105 transition-transform">
            <div class="flex-1 flex flex-col justify-center">
                <h4 class="font-serif font-bold text-lg text-ink-900 dark:text-white line-clamp-1 safe-title"></h4>
                <p class="text-sm text-gray-500 mb-4 safe-author"></p>
                <div class="w-full h-1.5 bg-gray-200 dark:bg-ink-600 rounded-full overflow-hidden mb-2">
                    <div class="h-full bg-vermilion" style="width: ${percent}%"></div>
                </div>
                <div class="flex justify-between text-xs font-mono text-gray-400">
                    <span>${percent}% Complete</span>
                    <span class="text-vermilion group-hover:underline">Resume</span>
                </div>
            </div>`;
        div.querySelector('.safe-title').textContent = book.title;
        div.querySelector('.safe-author').textContent = book.author;
        grid.appendChild(div);
    });
}

function renderUploads() {
    const grid = document.getElementById('uploads-grid');
    grid.innerHTML = '';
    if (shelfState.uploads.length === 0) {
        grid.innerHTML = `<p class="col-span-full text-gray-500 italic">You have yet to inscribe any tomes.</p>`;
        return;
    }
    shelfState.uploads.forEach(book => {
        const div = document.createElement('div');
        div.className = "group relative aspect-[2/3] bg-ink-800 rounded-lg overflow-hidden shadow-md cursor-pointer";
        let editBtn = '';
        if (book.uploadType !== 'pdf_single') {
            editBtn = `<button onclick="event.stopPropagation(); openEditModal('${book._id}')" class="absolute top-2 right-2 bg-black/60 hover:bg-vermilion text-white p-2 rounded-full z-20 transition-colors opacity-0 group-hover:opacity-100"><i class="ri-edit-line"></i></button>`;
        }
        div.innerHTML = `
            <img src="${book.coverImage}" onclick="window.location.href='/reader.html?bookId=${book._id}'" class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105">
            ${editBtn}
            <div class="absolute bottom-0 left-0 w-full p-2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
                <p class="text-white text-xs font-bold truncate safe-title"></p>
            </div>`;
        div.querySelector('.safe-title').textContent = book.title;
        grid.appendChild(div);
    });
}

function renderBookmarks() {
    const grid = document.getElementById('bookmarks-grid');
    grid.innerHTML = '';
    if (shelfState.bookmarks.length === 0) {
        grid.innerHTML = `<p class="col-span-full text-gray-500 italic">No tomes saved for later.</p>`;
        return;
    }
    shelfState.bookmarks.forEach(book => {
        const div = document.createElement('div');
        div.className = "group relative aspect-[2/3] bg-ink-800 rounded-lg overflow-hidden shadow-md cursor-pointer";
        div.onclick = () => window.location.href = `/reader.html?bookId=${book._id}`;
        div.innerHTML = `
            <img src="${book.coverImage}" class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105">
            <div class="absolute bottom-0 left-0 w-full p-2 bg-gradient-to-t from-black/80 to-transparent">
                <p class="text-white text-xs font-bold truncate safe-title"></p>
            </div>`;
        div.querySelector('.safe-title').textContent = book.title;
        grid.appendChild(div);
    });
}

// --- MODAL & LOGIC ---

window.openEditModal = async function(bookId) {
    shelfState.currentEditBookId = bookId;
    document.getElementById('edit-modal').classList.remove('hidden');
    const list = document.getElementById('chapter-list');
    list.innerHTML = '<li class="text-center text-gray-500 italic">Consulting the archives...</li>';
    try {
        const res = await API.get(`/api/books/${bookId}`);
        if (res.success && res.chapters) {
            list.innerHTML = '';
            if(res.chapters.length === 0) list.innerHTML = '<li class="text-center text-gray-500">No chapters recorded.</li>';
            res.chapters.forEach(chap => {
                const li = document.createElement('li');
                li.className = "flex justify-between items-center p-3 bg-white dark:bg-ink-800 rounded-lg border border-cream-200 dark:border-ink-700 shadow-sm";
                li.innerHTML = `<span class="text-sm font-medium text-ink-900 dark:text-gray-200 safe-chap"></span><button onclick="deleteChapter('${bookId}', '${chap._id}')" class="text-red-500 text-xs font-bold uppercase hover:text-red-600 transition-colors">Expunge</button>`;
                li.querySelector('.safe-chap').textContent = chap.title;
                list.appendChild(li);
            });
        }
    } catch (e) { list.innerHTML = '<li class="text-red-500">Error retrieving data.</li>'; }
}

window.closeEditModal = function() {
    document.getElementById('edit-modal').classList.add('hidden');
    shelfState.currentEditBookId = null;
    document.getElementById('add-chapter-form').reset();
}

// [FIXED] VALIDATION LOGIC ADDED HERE
window.handleAddChapter = async function(e) {
    e.preventDefault();
    if (!shelfState.currentEditBookId) return;
    
    const form = e.target;
    
    // 1. Validate Title
    const titleInput = document.getElementById('chapter-title-input');
    if (!titleInput.value.trim()) {
        showToast("Unnamed Manuscript", "A chapter requires a title to be recorded.", "error");
        return;
    }

    // 2. Validate File
    const fileInput = document.getElementById('chapter-file-input');
    if (!fileInput.files || fileInput.files.length === 0) {
        showToast("Empty Scroll", "You must provide a PDF file to inscribe.", "error");
        return;
    }

    const formData = new FormData(form);
    
    const btn = document.getElementById('btn-inscribe-chapter');
    const originalContent = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = `<i class="ri-loader-4-line animate-spin"></i> Inscribing...`;
    btn.classList.add('opacity-75', 'cursor-not-allowed');

    try {
        const res = await fetch(`/api/books/${shelfState.currentEditBookId}/chapters`, { method: 'POST', body: formData });
        const data = await res.json();
        
        if(data.success) {
            showToast("Chronicle Updated", "A new chapter has been etched into history.", "success");
            openEditModal(shelfState.currentEditBookId);
            form.reset();
        } else {
            showToast("Inscription Failed", data.message, "error");
        }
    } catch(err) { 
        showToast("The Ink Blotted", "The spirits refuse to record this entry.", "error"); 
    } finally { 
        btn.disabled = false;
        btn.innerHTML = originalContent;
        btn.classList.remove('opacity-75', 'cursor-not-allowed');
    }
}

window.deleteChapter = function(bookId, chapterId) {
    shelfState.pendingDelete = { bookId, chapterId };
    document.getElementById('delete-modal').classList.remove('hidden');
}

window.closeDeleteModal = function() {
    document.getElementById('delete-modal').classList.add('hidden');
    shelfState.pendingDelete = { bookId: null, chapterId: null };
}

window.confirmDelete = async function() {
    const { bookId, chapterId } = shelfState.pendingDelete;
    if (!bookId || !chapterId) return;

    try {
        const res = await API.delete(`/api/books/${bookId}/chapters/${chapterId}`);
        if(res.success) { 
            showToast("Record Expunged", "The page has been torn from the archives.", "success"); 
            openEditModal(bookId); 
        } else {
            showToast("Expulsion Failed", "The record clings to existence.", "error");
        }
    } catch(err) { 
        showToast("Ritual Failed", "Could not remove the chapter.", "error"); 
    } finally {
        closeDeleteModal();
    }
}