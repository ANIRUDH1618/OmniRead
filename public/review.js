let currentBookId = null;
let currentChapterId = null; 

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    currentBookId = params.get('bookId');
    currentChapterId = params.get('chapterId');

    if (!currentBookId) {
        window.location.href = '/dashboard';
        return;
    }

    const backBtn = document.getElementById('back-to-book-btn');
    if(backBtn) {
        backBtn.onclick = () => {
            let url = `/reader.html?bookId=${currentBookId}`;
            if(currentChapterId && currentChapterId !== 'null') {
                // url += `&chapterId=${currentChapterId}`; // Uncomment if you want deep link back
            }
            window.location.href = url;
        };
    }

    await loadBookDetails();
    await loadReviews();
    
    const mainInput = document.getElementById('main-review-input');
    if(mainInput) attachAutoResize(mainInput);
});

// --- UI UTILS ---
function attachAutoResize(textarea) {
    textarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
}

// --- DATA LOADING ---
async function loadBookDetails() {
    try {
        const res = await API.get(`/api/books/${currentBookId}`);
        if (res.success) {
            document.getElementById('review-book-title').innerText = res.book.title;
            document.getElementById('review-book-author').innerText = `by ${res.book.author}`;
            document.getElementById('review-book-cover').src = res.book.coverImage;
        }
    } catch(e) { console.error(e); }
}

async function loadReviews() {
    const container = document.getElementById('reviews-container');
    try {
        const res = await API.get(`/api/books/${currentBookId}/comments`);
        
        if (res.success) {
            const comments = res.data;
            document.getElementById('review-count').innerText = `${comments.length} Comments`;
            
            if (comments.length === 0) {
                container.innerHTML = '<div class="text-center py-20 text-gray-400 italic">No inscriptions yet. Be the first.</div>';
                return;
            }

            const roots = comments.filter(c => !c.parent);
            const replies = comments.filter(c => c.parent);
            
            container.innerHTML = roots.map(root => {
                const rootReplies = replies.filter(r => r.parent === root._id || r.parent._id === root._id);
                return renderCommentBlock(root, rootReplies);
            }).join('');
            
            document.querySelectorAll('.reply-input').forEach(attachAutoResize);
        }
    } catch(e) {
        container.innerHTML = '<p class="text-red-500 text-center">Failed to load discourse.</p>';
    }
}

// --- RENDERING ---
function renderCommentBlock(comment, replies) {
    const isAuthor = window.appState.user && comment.author._id === window.appState.user._id;
    const timeAgo = new Date(comment.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    
    const chapterTag = comment.chapter ? `<span class="bg-gray-100 dark:bg-ink-700 text-[10px] px-2 py-0.5 rounded text-gray-500 font-bold uppercase tracking-wider ml-2">Chapter Related</span>` : '';

    const repliesHtml = replies.map(r => `
        <div class="flex gap-3 mt-4 pl-4 border-l-2 border-cream-200 dark:border-ink-700 animate-fade-in">
            <img src="${r.author.photo}" class="w-6 h-6 rounded-full object-cover mt-1">
            <div class="flex-1">
                <div class="bg-cream-50 dark:bg-ink-900 p-3 rounded-xl rounded-tl-none">
                    <div class="flex justify-between items-baseline mb-1">
                        <span class="font-bold text-sm text-ink-900 dark:text-white">${r.author.name}</span>
                        <span class="text-[10px] text-gray-400">${new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p class="text-sm text-ink-900 dark:text-gray-300 font-serif leading-relaxed whitespace-pre-wrap">${r.content}</p>
                </div>
            </div>
        </div>
    `).join('');

    return `
        <div class="flex gap-4 animate-fade-in group">
            <img src="${comment.author.photo}" class="w-10 h-10 rounded-full object-cover border border-cream-200 dark:border-ink-700">
            <div class="flex-1">
                <div class="bg-white dark:bg-ink-800 p-4 rounded-2xl rounded-tl-none shadow-sm border border-cream-200 dark:border-ink-700 relative">
                    <div class="flex justify-between items-center mb-2">
                        <div class="flex items-center">
                            <span class="font-bold text-ink-900 dark:text-white">${comment.author.name}</span>
                            ${chapterTag}
                        </div>
                        <span class="text-xs text-gray-400">${timeAgo}</span>
                    </div>
                    <p class="text-ink-900 dark:text-gray-200 font-serif leading-relaxed whitespace-pre-wrap text-lg">${comment.content}</p>
                    
                    <div class="flex gap-4 mt-3 pt-3 border-t border-cream-100 dark:border-ink-700">
                        <button onclick="toggleReplyBox('${comment._id}')" class="text-xs font-bold text-gray-500 hover:text-vermilion uppercase tracking-wider flex items-center gap-1">
                            <i class="ri-reply-line"></i> Reply
                        </button>
                        ${isAuthor ? `<button onclick="deleteComment('${comment._id}')" class="text-xs font-bold text-gray-400 hover:text-red-500 uppercase tracking-wider ml-auto">Delete</button>` : ''}
                    </div>
                </div>

                <div id="replies-${comment._id}">
                    ${repliesHtml}
                </div>

                <div id="reply-box-${comment._id}" class="hidden mt-4 pl-4 border-l-2 border-vermilion/50">
                    <div class="relative">
                        <textarea id="input-${comment._id}" rows="1" placeholder="Write a reply..." class="reply-input w-full bg-cream-50 dark:bg-ink-900 border-none rounded-xl py-3 px-4 resize-none text-sm focus:ring-1 focus:ring-vermilion outline-none no-scrollbar" style="min-height: 48px; overflow: hidden;"></textarea>
                        <button onclick="submitReply('${comment._id}')" class="absolute right-2 bottom-3 text-vermilion p-2 hover:bg-cream-200 dark:hover:bg-ink-700 rounded-full transition-colors">
                            <i class="ri-send-plane-2-fill text-lg"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// --- ACTIONS ---
window.toggleReplyBox = (commentId) => {
    const box = document.getElementById(`reply-box-${commentId}`);
    box.classList.toggle('hidden');
    if (!box.classList.contains('hidden')) {
        setTimeout(() => document.getElementById(`input-${commentId}`).focus(), 100);
    }
};

window.submitReview = async () => {
    const input = document.getElementById('main-review-input');
    const content = input.value.trim();
    if (!content) return;

    input.value = ''; input.style.height = 'auto';
    
    try {
        const payload = { content };
        if (currentChapterId) payload.chapterId = currentChapterId;

        const res = await API.post(`/api/books/${currentBookId}/comments`, payload);
        if (res.success) loadReviews(); 
    } catch(e) { showToast("Failed to post", "error"); }
};

window.submitReply = async (parentId) => {
    const input = document.getElementById(`input-${parentId}`);
    const content = input.value.trim();
    if (!content) return;

    input.value = ''; input.style.height = 'auto';
    document.getElementById(`reply-box-${parentId}`).classList.add('hidden');

    try {
        const payload = { content, parentId }; 
        const res = await API.post(`/api/books/${currentBookId}/comments`, payload);
        if (res.success) loadReviews();
    } catch(e) { showToast("Reply failed", "error"); }
};

window.deleteComment = async (id) => {
    if(!confirm("Delete this?")) return;
    try {
        await API.delete(`/api/books/comments/${id}`);
        loadReviews();
    } catch(e) { showToast("Failed to delete", "error"); }
};