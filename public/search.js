const SearchManager = {
    init() {
        // [FIX] Event Delegation: Listen on document body
        // This works even if the search input is created dynamically later by layout.js
        document.body.addEventListener('input', (e) => {
            if (e.target && e.target.id === 'search-input') {
                const query = e.target.value.toLowerCase().trim();
                this.performSearch(query);
            }
        });
    },

    performSearch(query) {
        // Access global app state
        if (!window.appState || !window.appState.books) return;

        const allBooks = window.appState.books;

        // Filter Logic
        const filteredBooks = allBooks.filter(book => {
            const titleMatch = book.title.toLowerCase().includes(query);
            const authorMatch = book.author.toLowerCase().includes(query);
            return titleMatch || authorMatch;
        });

        // Render
        if (typeof window.renderBookGrid === 'function') {
            window.renderBookGrid(filteredBooks);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    SearchManager.init();
});