document.addEventListener("DOMContentLoaded", async () => {
    LayoutManager.init('community'); 
    initTheme();
    if (window.loadUser) await window.loadUser();

    const currUserImg = document.getElementById('curr-user-avatar');
    if(currUserImg && window.appState.user) {
         currUserImg.src = window.appState.user.photo;
         currUserImg.onerror = () => currUserImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(window.appState.user.name)}&background=ea580c&color=fff`;
    }

    setupPostCreation();
    setupDrawerInput();
    loadFeed();
});

let selectedFiles = [];
let activePostId = null;
let pendingDelete = { type: null, id: null }; 
let lightboxImages = [];    
let lightboxIndex = 0;      
window.postImagesMap = {};  

// --- LIGHTBOX LOGIC ---
window.openLightbox = (postId, index) => {
    const images = window.postImagesMap[postId];
    if(!images || images.length === 0) return;
    lightboxImages = images;
    lightboxIndex = index;
    updateLightboxUI();
    document.getElementById('image-lightbox').classList.remove('hidden');
};

window.closeLightbox = () => {
    document.getElementById('image-lightbox').classList.add('hidden');
    lightboxImages = [];
};

window.updateLightboxUI = () => {
    const img = document.getElementById('lightbox-img');
    const counter = document.getElementById('lightbox-counter');
    const prevBtn = document.getElementById('lb-prev');
    const nextBtn = document.getElementById('lb-next');

    img.src = lightboxImages[lightboxIndex];
    counter.innerText = `${lightboxIndex + 1} / ${lightboxImages.length}`;
    prevBtn.style.display = lightboxImages.length > 1 ? 'block' : 'none';
    nextBtn.style.display = lightboxImages.length > 1 ? 'block' : 'none';
};

window.nextImage = (e) => {
    e.stopPropagation();
    lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
    updateLightboxUI();
};

window.prevImage = (e) => {
    e.stopPropagation();
    lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
    updateLightboxUI();
};

// --- [FIX] TOGGLE READ MORE LOGIC ---
window.toggleReadMore = (postId) => {
    const content = document.getElementById(`post-content-${postId}`);
    const btn = document.getElementById(`read-more-btn-${postId}`);
    
    if (!content || !btn) return;

    // Check if currently collapsed (has the clamp class)
    const isCollapsed = content.classList.contains('line-clamp-4');

    if (isCollapsed) {
        // EXPAND (Unfurl)
        content.classList.remove('line-clamp-4');
        content.classList.remove('max-h-32');
        btn.innerHTML = 'Roll Up Inscription <i class="ri-arrow-up-s-line"></i>';
    } else {
        // COLLAPSE (Roll Up)
        content.classList.add('line-clamp-4');
        content.classList.add('max-h-32');
        btn.innerHTML = 'Unfurl Inscription <i class="ri-arrow-down-s-line"></i>';
        
        // Optional: Smooth scroll slightly up if the user scrolled way down past the post
        content.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
};

// --- DELETE MODAL LOGIC ---
window.requestDelete = (type, id) => {
    pendingDelete = { type, id };
    document.getElementById('delete-modal').classList.remove('hidden');
};

window.closeDeleteModal = () => {
    document.getElementById('delete-modal').classList.add('hidden');
    pendingDelete = { type: null, id: null };
};

window.confirmDelete = async () => {
    const { type, id } = pendingDelete;
    if (!id) return;
    closeDeleteModal(); 

    const elId = type === 'post' ? `post-${id}` : `comment-${id}`;
    const el = document.getElementById(elId);
    if(el) el.style.opacity = '0.5';

    try {
        const endpoint = type === 'post' ? `/api/community/${id}` : `/api/community/comments/${id}`;
        const res = await API.delete(endpoint);
        if (res.success) {
            if(el) el.remove();
            showToast(type === 'post' ? "Contribution retracted." : "Comment expunged.", "success");
            if(type === 'comment' && activePostId) {
                const countBtn = document.querySelector(`#post-${activePostId} .comment-count-btn span`);
                if(countBtn) {
                    const curr = parseInt(countBtn.innerText.match(/\d+/)[0] || 0);
                    countBtn.innerText = `Discuss (${Math.max(0, curr - 1)})`;
                }
            }
        } else { throw new Error(res.message); }
    } catch (err) {
        showToast("Failed to delete.", "error");
        if(el) el.style.opacity = '1';
    }
};

window.toggleCreateModal = () => {
    const modal = document.getElementById('create-modal');
    modal.classList.toggle('hidden');
    if (!modal.classList.contains('hidden')) document.getElementById('post-content').focus();
}

window.openDrawer = async (postId) => {
    activePostId = postId;
    const drawer = document.getElementById('comment-drawer');
    const overlay = document.getElementById('drawer-overlay');
    const list = document.getElementById('drawer-comments-list');
    
    drawer.classList.remove('drawer-closed');
    drawer.classList.add('drawer-open');
    overlay.classList.remove('hidden');
    
    list.innerHTML = '<div class="text-center py-10"><i class="ri-loader-4-line animate-spin text-vermilion text-2xl"></i></div>';
    
    try {
        const res = await API.get(`/api/community/${postId}/comments`);
        if(res.success) {
            list.innerHTML = res.data.length ? res.data.map(c => generateCommentHTML(c)).join('') : '<div class="flex flex-col items-center justify-center h-full text-gray-400 italic"><i class="ri-chat-1-line text-4xl mb-2 opacity-50"></i><p>No discourse yet.</p><p class="text-xs">Be the first to speak.</p></div>';
        }
    } catch(e) { list.innerHTML = '<p class="text-red-500 text-center mt-10">Failed.</p>'; }
}

window.closeDrawer = () => {
    document.getElementById('comment-drawer').classList.remove('drawer-open');
    document.getElementById('comment-drawer').classList.add('drawer-closed');
    setTimeout(() => document.getElementById('drawer-overlay').classList.add('hidden'), 300);
    activePostId = null;
}

function setupPostCreation() {
    const fileInput = document.getElementById('post-images');
    const previewContainer = document.getElementById('image-preview-container');
    const submitBtn = document.getElementById('submit-post-btn');
    const contentArea = document.getElementById('post-content');

    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (selectedFiles.length + files.length > 5) return showToast("Maximum 5 images.", "error");
        selectedFiles = [...selectedFiles, ...files];
        updatePreviews();
        fileInput.value = ''; 
    });

    function updatePreviews() {
        previewContainer.innerHTML = '';
        selectedFiles.forEach((file, index) => {
            const div = document.createElement('div');
            div.className = 'relative aspect-square rounded-xl overflow-hidden group border border-cream-200 dark:border-ink-700';
            const reader = new FileReader();
            reader.onload = (e) => {
                div.innerHTML = `<img src="${e.target.result}" class="w-full h-full object-cover"><button onclick="removeFile(${index})" class="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><i class="ri-close-line"></i></button>`;
            };
            reader.readAsDataURL(file);
            previewContainer.appendChild(div);
        });
        checkSubmitButton();
    }

    window.removeFile = (index) => { selectedFiles.splice(index, 1); updatePreviews(); }
    contentArea.addEventListener('input', checkSubmitButton);
    function checkSubmitButton() { submitBtn.disabled = !(contentArea.value.trim().length > 0 || selectedFiles.length > 0); }

    submitBtn.addEventListener('click', async () => {
        if (submitBtn.disabled) return;
        submitBtn.innerText = 'Publishing...';
        submitBtn.disabled = true;

        const formData = new FormData();
        formData.append('content', contentArea.value.trim());
        selectedFiles.forEach(file => formData.append('images', file));

        try {
            const rawRes = await fetch('/api/community', { method: 'POST', body: formData });
            const data = await rawRes.json();
            if (rawRes.ok && data.success) {
                showToast("Published.", "success");
                contentArea.value = ''; selectedFiles = []; updatePreviews(); toggleCreateModal();
                
                const feed = document.getElementById('symposium-feed');
                const empty = feed.querySelector('.italic'); if(empty) empty.remove();
                feed.insertAdjacentHTML('afterbegin', generatePostHTML(data.data));
            } else { throw new Error(data.message); }
        } catch (err) { showToast(err.message, "error"); } 
        finally { submitBtn.innerText = 'Publish'; checkSubmitButton(); }
    });
}

function setupDrawerInput() {
    const input = document.getElementById('drawer-input');
    const submitBtn = document.getElementById('drawer-submit');

    input.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = (this.scrollHeight) + 'px'; });
    input.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); } });
    submitBtn.addEventListener('click', submitComment);

    async function submitComment() {
        const content = input.value.trim();
        if(!content || !activePostId) return;
        input.value = ''; input.style.height = 'auto';
        try {
            const res = await API.post(`/api/community/${activePostId}/comments`, { content });
            if(res.success) {
                const list = document.getElementById('drawer-comments-list');
                if(list.innerText.includes("No discourse")) list.innerHTML = '';
                list.insertAdjacentHTML('beforeend', generateCommentHTML(res.data));
                list.scrollTop = list.scrollHeight;
                const countBtn = document.querySelector(`#post-${activePostId} .comment-count-btn span`);
                if(countBtn) {
                    const curr = parseInt(countBtn.innerText.match(/\d+/)[0] || 0);
                    countBtn.innerText = `Discuss (${curr + 1})`;
                }
            }
        } catch(e) { showToast("Failed.", "error"); }
    }
}

window.editComment = (commentId, btn) => {
    const container = document.getElementById(`comment-body-${commentId}`);
    const originalText = container.innerText;
    container.innerHTML = `<textarea id="edit-input-${commentId}" class="w-full bg-white dark:bg-ink-800 border border-vermilion rounded p-2 text-sm focus:outline-none resize-none no-scrollbar break-words whitespace-pre-wrap">${originalText}</textarea><div class="flex justify-end gap-2 mt-2"><button onclick="cancelEdit('${commentId}', '${originalText.replace(/'/g, "\\'")}')" class="text-xs text-gray-500">Cancel</button><button onclick="saveEdit('${commentId}')" class="text-xs font-bold text-vermilion">Save</button></div>`;
    btn.parentElement.classList.add('hidden');
};

window.cancelEdit = (commentId, originalText) => document.getElementById(`comment-body-${commentId}`).innerText = originalText;

window.saveEdit = async (commentId) => {
    const newContent = document.getElementById(`edit-input-${commentId}`).value.trim();
    if(!newContent) return;
    try {
        const res = await API.put(`/api/community/comments/${commentId}`, { content: newContent });
        if(res.success) { document.getElementById(`comment-body-${commentId}`).innerText = newContent; showToast("Updated.", "success"); }
    } catch(e) { showToast("Failed.", "error"); }
};

async function loadFeed() {
    const feed = document.getElementById('symposium-feed');
    try {
        const res = await API.get('/api/community');
        if (res.success && res.data.length > 0) feed.innerHTML = res.data.map(post => generatePostHTML(post)).join('');
        else feed.innerHTML = '<div class="text-center py-20 text-gray-500 font-serif italic">The Symposium is silent.<br>Inscribe the first thought.</div>';
    } catch (err) { feed.innerHTML = '<div class="text-center py-20 text-red-500">Failed to load.</div>'; }
}

function generatePostHTML(post) {
    if (!post.author) return ''; 
    const timeAgo = new Date(post.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const currentUserId = window.appState.user?._id;
    const isAuthor = currentUserId && (currentUserId.toString() === post.author._id.toString());
    const likes = post.likes || [];
    const isLiked = likes.some(id => id.toString() === currentUserId);

    if(post.images && post.images.length > 0) window.postImagesMap[post._id] = post.images;

    let imageGrid = '';
    if (post.images?.length) {
        const gridClass = `image-grid-${post.images.length}`;
        imageGrid = `<div class="grid ${gridClass} gap-1 mt-4 rounded-xl overflow-hidden max-h-[500px]">${post.images.map((img, idx) => `<img src="${img}" class="w-full h-full object-cover cursor-pointer hover:opacity-90" onclick="openLightbox('${post._id}', ${idx})">`).join('')}</div>`;
    }

    const isLongText = post.content && post.content.length > 300;
    const contentHtml = isLongText 
        ? `<div class="relative">
             <p id="post-content-${post._id}" class="text-ink-900 dark:text-gray-100 text-lg leading-relaxed whitespace-pre-wrap font-serif break-words line-clamp-4 max-h-32 overflow-hidden transition-all duration-500">${post.content}</p>
             <button id="read-more-btn-${post._id}" onclick="toggleReadMore('${post._id}')" class="text-vermilion text-xs font-bold uppercase mt-2 hover:underline tracking-widest flex items-center gap-1">Unfurl Inscription <i class="ri-arrow-down-s-line"></i></button>
           </div>`
        : `<p class="text-ink-900 dark:text-gray-100 text-lg leading-relaxed whitespace-pre-wrap font-serif break-words">${post.content}</p>`;

    return `
        <article class="bg-white dark:bg-ink-800 p-6 rounded-2xl shadow-sm border border-cream-200 dark:border-ink-700 animate-fade-in group hover:shadow-md transition-shadow" id="post-${post._id}">
            <div class="flex justify-between items-start mb-4">
                <div class="flex gap-3">
                    <img src="${post.author.photo}" class="w-10 h-10 rounded-full object-cover border border-cream-200 dark:border-ink-600">
                    <div>
                        <h3 class="font-bold text-ink-900 dark:text-white">${post.author.name}</h3>
                        <p class="text-xs text-gray-500 uppercase tracking-widest">${timeAgo}</p>
                    </div>
                </div>
                ${isAuthor ? `<button onclick="requestDelete('post', '${post._id}')" class="text-gray-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"><i class="ri-delete-bin-line text-lg"></i></button>` : ''}
            </div>
            
            ${contentHtml}
            
            ${imageGrid}
            <div class="flex items-center gap-6 mt-6 pt-4 border-t border-cream-100 dark:border-ink-700 text-gray-500">
                <button onclick="toggleLike('${post._id}', this)" class="flex items-center gap-2 transition-colors group ${isLiked ? 'text-vermilion' : 'hover:text-vermilion'}">
                    <i class="${isLiked ? 'ri-heart-fill' : 'ri-heart-line'} text-xl group-active:scale-125 transition-transform"></i> 
                    <span class="text-xs font-bold uppercase">Applaud (${likes.length})</span>
                </button>
                <button onclick="openDrawer('${post._id}')" class="flex items-center gap-2 hover:text-vermilion transition-colors comment-count-btn">
                    <i class="ri-chat-1-line text-xl"></i> <span class="text-xs font-bold uppercase">Discuss (${post.comments?.length || 0})</span>
                </button>
            </div>
        </article>
    `;
}

function generateCommentHTML(comment) {
     const isMyComment = window.appState.user?._id === comment.author._id;
     return `
        <div class="flex gap-3 text-sm animate-fade-in group" id="comment-${comment._id}">
            <img src="${comment.author.photo}" class="w-8 h-8 rounded-full object-cover mt-1">
            <div class="flex-1">
                <div class="bg-cream-100 dark:bg-ink-700/50 p-3 rounded-2xl rounded-tl-none relative">
                    <div class="flex justify-between items-baseline mb-1">
                        <span class="font-bold text-ink-900 dark:text-white mr-2">${comment.author.name}</span>
                        <span class="text-[10px] text-gray-500">${new Date(comment.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p id="comment-body-${comment._id}" class="text-ink-900 dark:text-gray-200 font-serif leading-relaxed whitespace-pre-wrap break-words">${comment.content}</p>
                    
                    ${isMyComment ? `
                    <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <button onclick="editComment('${comment._id}', this)" class="text-gray-400 hover:text-ink-900 dark:hover:text-white p-1"><i class="ri-edit-line"></i></button>
                        <button onclick="requestDelete('comment', '${comment._id}')" class="text-gray-400 hover:text-red-500 p-1"><i class="ri-delete-bin-line"></i></button>
                    </div>` : ''}
                </div>
            </div>
        </div>
     `;
}

window.toggleLike = async (postId, btn) => {
     try {
        const icon = btn.querySelector('i');
        const countSpan = btn.querySelector('span');
        const isLiked = icon.classList.contains('ri-heart-fill');
        let currentCount = parseInt(countSpan.innerText.match(/\d+/)) || 0;

        if (isLiked) {
            icon.className = 'ri-heart-line text-xl group-active:scale-125 transition-transform';
            btn.classList.remove('text-vermilion');
            currentCount = Math.max(0, currentCount - 1);
        } else {
            icon.className = 'ri-heart-fill text-xl group-active:scale-125 transition-transform';
            btn.classList.add('text-vermilion');
            currentCount++;
        }
        countSpan.innerText = `APPLAUD (${currentCount})`;
        await API.put(`/api/community/${postId}/like`);
    } catch (e) {}
};

window.showToast = function(message, type = "info") {
    const container = document.getElementById("toast-container");
    if(!container) return;
    const toast = document.createElement("div");
    const colors = { success: "bg-green-500", error: "bg-red-500", info: "bg-ink-900" };
    toast.className = `${colors[type] || colors.info} text-white px-6 py-3 rounded-xl shadow-lg font-bold text-sm animate-fade-in flex items-center gap-2`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(20px)'; setTimeout(() => toast.remove(), 300); }, 2000); 
}