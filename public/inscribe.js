document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupTabs();
    setupFormSubmit();
    setupDragAndDrop('cover-drop-zone', 'cover-upload', 'cover');
    setupDragAndDrop('anthology-drop-zone', 'anthology-upload', 'multi');
    setupDragAndDrop('textbook-drop-zone', 'textbook-upload', 'single-pdf');
});

// ==========================================
// 1. DRAG & DROP LOGIC
// ==========================================
function setupDragAndDrop(zoneId, inputId, type) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        zone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        zone.addEventListener(eventName, () => zone.classList.add('drag-active'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        zone.addEventListener(eventName, () => zone.classList.remove('drag-active'), false);
    });

    zone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        handleFiles(dt.files, input, type, zone);
    });

    zone.addEventListener('click', (e) => {
        if (e.target.closest('button')) return; 
        input.click();
    });

    input.addEventListener('change', function() {
        handleFiles(this.files, input, type, zone);
    });
}

function handleFiles(files, inputElement, type, zoneElement) {
    if (!files.length) return;
    inputElement.files = files;

    if (type === 'cover') {
        const file = files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('cover-preview-img').src = e.target.result;
            document.getElementById('cover-name').innerText = file.name;
            zoneElement.classList.add('zone-filled');
            document.getElementById('cover-placeholder').classList.add('hidden');
            document.getElementById('cover-filled').classList.remove('hidden');
            
            document.getElementById('remove-cover-btn').onclick = (e) => {
                e.stopPropagation();
                resetZone(zoneElement, inputElement, 'cover-filled', 'cover-placeholder');
            };
        };
        reader.readAsDataURL(file);
    } 
    else if (type === 'single-pdf') {
        const file = files[0];
        document.getElementById('textbook-name').innerText = file.name;
        zoneElement.classList.add('zone-filled');
        document.getElementById('textbook-placeholder').classList.add('hidden');
        const filled = document.getElementById('textbook-filled');
        filled.classList.remove('hidden');
        filled.classList.add('flex');

        document.getElementById('remove-textbook-btn').onclick = (e) => {
            e.stopPropagation();
            resetZone(zoneElement, inputElement, 'textbook-filled', 'textbook-placeholder');
            filled.classList.remove('flex');
        };
    }
    else if (type === 'multi') {
        const chipContainer = document.getElementById('anthology-chips');
        chipContainer.innerHTML = ''; 
        Array.from(files).forEach(file => {
            const chip = document.createElement('div');
            chip.className = "flex items-center gap-2 bg-white dark:bg-ink-800 px-4 py-2 rounded-xl border border-gray-200 dark:border-ink-600 shadow-sm animate-fade-in";
            chip.innerHTML = `
                <i class="ri-file-pdf-line text-red-500"></i>
                <span class="text-xs font-bold text-ink-900 dark:text-gray-200 truncate max-w-[150px]">${file.name}</span>
                <button type="button" class="text-gray-400 hover:text-red-500 transition-colors ml-2"><i class="ri-close-line"></i></button>
            `;
            chip.querySelector('button').addEventListener('click', (e) => {
                e.stopPropagation();
                chip.remove();
            });
            chipContainer.appendChild(chip);
        });
    }
}

function resetZone(zone, input, filledId, placeholderId) {
    input.value = ''; 
    zone.classList.remove('zone-filled');
    document.getElementById(filledId).classList.add('hidden');
    document.getElementById(placeholderId).classList.remove('hidden');
}

// ==========================================
// 2. FORM SUBMISSION
// ==========================================
function validateForm() {
    let isValid = true;
    const requiredInputs = document.querySelectorAll('.required-field');
    const coverInput = document.getElementById('cover-upload');
    const coverZone = document.getElementById('cover-drop-zone');

    document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
    coverZone.classList.remove('input-error');

    requiredInputs.forEach(input => {
        if (!input.value.trim()) {
            input.classList.add('input-error');
            isValid = false;
        }
        input.addEventListener('input', () => input.classList.remove('input-error'), { once: true });
    });

    if (!coverInput.files || !coverInput.files[0]) {
        coverZone.classList.add('input-error');
        isValid = false;
    }

    return isValid;
}

function setupFormSubmit() {
    const form = document.getElementById('inscribe-form');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            showNotification("Missing Details", "The ink has blotted. Please fill in all required fields.", "error");
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalContent = submitBtn.innerHTML;
        
        submitBtn.innerHTML = `<i class="ri-loader-4-line animate-spin text-xl"></i><span>Inscribing...</span>`;
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-75', 'cursor-not-allowed');

        try {
            const formData = new FormData();
            formData.append('title', document.getElementById('inp-title').value);
            formData.append('author', document.getElementById('inp-author').value);
            formData.append('genres', document.getElementById('inp-genres').value);
            formData.append('description', document.getElementById('inp-desc').value);
            
            const activeBtn = document.querySelector('.type-btn.ring-2');
            const activeType = activeBtn ? activeBtn.dataset.type : 'manual';
            formData.append('type', activeType);

            if (activeType === 'manual') {
                formData.append('content', document.getElementById('manual-text').value);
            } 
            else if (activeType === 'textbook') {
                const pdfInput = document.getElementById('textbook-upload');
                if (pdfInput.files && pdfInput.files[0]) {
                    formData.append('bookFile', pdfInput.files[0]);
                } else {
                    throw new Error("Please upload the PDF file.");
                }
            }
            else if (activeType === 'anthology') {
                const pdfInput = document.getElementById('anthology-upload');
                if (pdfInput.files && pdfInput.files.length > 0) {
                    Array.from(pdfInput.files).forEach(file => {
                        formData.append('bookFile', file);
                    });
                } else {
                    throw new Error("Please upload at least one chapter.");
                }
            }

            const coverInput = document.getElementById('cover-upload');
            if (coverInput.files && coverInput.files[0]) {
                formData.append('cover', coverInput.files[0]);
            }

            const res = await fetch('/api/books/inscribe', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (data.success) {
                showNotification("Chronicle Recorded", "Your tome has been successfully inscribed into the archives.");
                setTimeout(() => { window.location.href = '/dashboard'; }, 1500);
            } else {
                if (res.status === 409) {
                    showNotification("Duplicate Tome", data.message, "error");
                } else {
                    throw new Error(data.message);
                }
            }

        } catch (err) {
            console.error(err);
            showNotification("Inscription Failed", err.message || "The spirits of the archive are silent.", "error");
        } finally {
            submitBtn.innerHTML = originalContent;
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
        }
    });
}

// ==========================================
// 3. UI UTILS
// ==========================================
function showNotification(title, message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const bgClass = type === 'success' ? 'bg-ink-900 border-l-4 border-vermilion' : 'bg-red-50 border-l-4 border-red-500';
    const textClass = type === 'success' ? 'text-white' : 'text-red-900';
    const icon = type === 'success' ? 'ri-quill-pen-line' : 'ri-error-warning-line';

    toast.className = `toast-enter pointer-events-auto w-80 p-4 rounded shadow-2xl flex items-start gap-3 ${bgClass} dark:shadow-black/50`;
    toast.innerHTML = `
        <i class="${icon} text-xl mt-0.5 ${type === 'success' ? 'text-vermilion' : 'text-red-500'}"></i>
        <div>
            <h4 class="font-serif font-bold text-sm ${textClass}">${title}</h4>
            <p class="text-xs mt-1 leading-relaxed ${type === 'success' ? 'text-gray-400' : 'text-red-700'}">${message}</p>
        </div>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.remove('toast-enter');
        toast.classList.add('toast-exit');
        toast.addEventListener('animationend', () => toast.remove());
    }, 4000);
}

function initTheme() {
    if (localStorage.getItem('theme') === 'dark' || !localStorage.getItem('theme')) {
        document.documentElement.classList.add('dark');
    }
}

function setupTabs() {
    const buttons = document.querySelectorAll('.type-btn');
    const sections = document.querySelectorAll('.content-section');

    const setActiveStyle = (btn) => {
        // RESET ALL
        buttons.forEach(b => {
            b.classList.remove('ring-2', 'ring-vermilion', 'bg-cream-100', 'dark:bg-ink-700', 'border-transparent');
            b.classList.add('border-2', 'border-gray-200', 'dark:border-ink-700', 'text-gray-500', 'hover:border-gray-300');
        });
        // ACTIVE STATE
        btn.classList.remove('border-gray-200', 'dark:border-ink-700', 'text-gray-500', 'hover:border-gray-300');
        btn.classList.add('ring-2', 'ring-vermilion', 'bg-cream-100', 'dark:bg-ink-700', 'border-transparent', 'text-ink-900', 'dark:text-white');
    };

    // Apply Base Professional Classes
    buttons.forEach(btn => {
        btn.className = "type-btn p-5 rounded-2xl text-left font-bold transition-all shadow-sm hover:shadow-md flex flex-col justify-between h-32 border-2 border-gray-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-gray-500";
        
        // Add Icons Dynamically
        const type = btn.dataset.type;
        let icon = '';
        if(type === 'manual') icon = 'ri-file-text-line';
        if(type === 'anthology') icon = 'ri-folders-line';
        if(type === 'textbook') icon = 'ri-book-read-line';
        
        btn.innerHTML = `
            <i class="${icon} text-3xl mb-2"></i>
            <div>
                <span class="block text-lg">${btn.innerText}</span>
                <span class="text-xs font-normal opacity-70">
                    ${type === 'manual' ? 'Write Directly' : type === 'anthology' ? 'Multiple PDFs' : 'Single PDF'}
                </span>
            </div>
        `;

        btn.addEventListener('click', () => {
            setActiveStyle(btn);
            sections.forEach(sec => sec.classList.add('hidden'));
            document.getElementById(`section-${type}`).classList.remove('hidden');
        });
    });

    // Default: Activate first
    setActiveStyle(buttons[0]);
}