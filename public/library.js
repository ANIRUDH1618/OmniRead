document.addEventListener("DOMContentLoaded", async () => {
    initTheme(); 
    await window.loadUser(); // [CRITICAL FIX] Load User for Sidebar
    await initLibrary();
});

async function initLibrary() {
    try {
        const bookRes = await API.get("/api/books/discover");
        
        if (bookRes.success) {
            window.appState.books = bookRes.data;
            window.appState.allBooks = bookRes.data; 
            window.renderBookGrid(window.appState.books); 
        } else {
            document.getElementById("book-grid").innerHTML = '<p class="col-span-full text-center text-gray-500">The library is closed.</p>';
        }

    } catch (e) {
        console.error("Library Error:", e);
        showToast("Connection Error", "Failed to load the library.", "error");
    }
}