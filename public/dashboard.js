document.addEventListener("DOMContentLoaded", async () => {
  LayoutManager.init('dashboard');
  initTheme();
  await window.loadUser(); // Load User FIRST
  await renderLibrary(); // Then load books
  
  // Listen for bookmark changes to update "For You" live
  window.addEventListener('bookmarkUpdated', (e) => {
      filterAndRenderForYou();
      // Also refresh hero state if it matches
      const currentHeroTitle = document.getElementById("hero-title")?.innerText;
      const updatedBook = window.appState.allBooks.find(b => b._id === e.detail.bookId);
      if(updatedBook && updatedBook.title === currentHeroTitle) {
          updateHero(updatedBook, true);
      }
  });
});

async function renderLibrary() {
  const grid = document.getElementById("book-grid");
  if (!grid) return;
  grid.innerHTML = '<div class="col-span-full text-center py-10"><i class="ri-loader-4-line animate-spin text-3xl text-vermilion"></i></div>';

  try {
    const res = await API.get("/api/books/discover");
    if (res.success) {
      window.appState.allBooks = res.data; 
      
      filterAndRenderForYou(); // Render the filtered list

      // Hero Logic (Last Read)
      if (window.appState.user && window.appState.user.lastRead) {
          let lastReadBook = window.appState.user.lastRead;
          // If populated as object, use it. If string, find it.
          if (typeof lastReadBook === 'string') {
             lastReadBook = window.appState.allBooks.find(b => b._id === lastReadBook);
          }
          if(lastReadBook) updateHero(lastReadBook, true);
          else if(window.appState.books.length > 0) updateHero(window.appState.books[0], false);
      } else {
         showHeroEmptyState();
      }
    } else {
      grid.innerHTML = '<div class="col-span-full text-center py-10 text-gray-500">The archives are empty.</div>';
    }
  } catch (error) {
    console.error(error);
    grid.innerHTML = '<p class="text-red-500 col-span-full text-center">Failed to load library.</p>';
  }
}

function filterAndRenderForYou() {
    // Filter books where ID exists in user bookmarks
    const forYouBooks = window.appState.allBooks.filter(book => {
        return window.isBookmarked(book._id);
    });
    window.appState.books = forYouBooks;
    window.renderBookGrid(forYouBooks);
}

function showHeroEmptyState() {
    const cover = document.getElementById("hero-cover");
    if(cover) cover.src = "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80"; 
    document.getElementById("hero-title").innerText = "The Archives Await";
    document.getElementById("hero-author").innerText = "Select a title to begin your journey.";
    document.getElementById("hero-progress-bar").style.width = "0%";
    const heroBmBtn = document.getElementById("hero-bookmark-btn");
    if(heroBmBtn) heroBmBtn.style.display = 'none';
}

function updateHero(book, isResume = true) {
  if (!book) return;
  const cover = document.getElementById("hero-cover");
  if (cover) {
    cover.src = book.coverImage;
    document.getElementById("hero-title").innerText = book.title;
    document.getElementById("hero-author").innerText = isResume ? `${book.author} • Picking up where you left off` : `${book.author}`;

    let progress = 0;
    if (window.appState.progress && window.appState.progress.book === book._id) {
        progress = window.appState.progress.percentComplete || 0;
    }
    
    // [FIX 1] Round the percentage to whole number
    const displayProgress = Math.round(progress);
    
    document.getElementById("hero-progress-bar").style.width = `${displayProgress}%`;
    document.getElementById("hero-progress-text").innerText = `${displayProgress}%`;

    const continueBtn = document.getElementById("hero-continue-btn");
    if (continueBtn) {
      continueBtn.innerText = "Continue Reading";
      continueBtn.onclick = () => window.location.href = `/reader.html?bookId=${book._id}`;
    }
    
    const heroBmBtn = document.getElementById("hero-bookmark-btn");
    if(heroBmBtn) {
        heroBmBtn.style.display = 'flex'; 
        
        // [FIX 2] Check bookmark status and update icon/style
        const isBookmarked = window.isBookmarked(book._id);
        
        // Reset classes first
        heroBmBtn.className = "hero-btn px-4 py-2.5 rounded-lg transition-colors border cursor-pointer";
        
        if (isBookmarked) {
            heroBmBtn.classList.add("border-vermilion", "text-vermilion", "bg-vermilion/10");
            heroBmBtn.innerHTML = '<i class="ri-bookmark-fill text-xl"></i>';
        } else {
            heroBmBtn.classList.add("border-cream-300", "dark:border-ink-600", "hover:bg-cream-100", "dark:hover:bg-ink-700");
            heroBmBtn.innerHTML = '<i class="ri-bookmark-line text-xl"></i>';
        }
        
        // Clone to clear old listeners, then re-attach
        const newBtn = heroBmBtn.cloneNode(true);
        heroBmBtn.parentNode.replaceChild(newBtn, heroBmBtn);
        newBtn.addEventListener("click", (e) => window.handleBookmarkToggle(e, book._id)); 
    }
  }
}