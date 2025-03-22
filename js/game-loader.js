/**
 * Enhanced Game Loader
 * Optimized with IndexedDB for improved performance and offline access
 */

// Cache objects to prevent multiple fetches
const cache = {
  games: null,
  gamesByCategory: {
    cloud: null,
    browser: null,
    emulator: null
  },
  categoryCount: null
};

// Make cache available globally
window.cache = cache;

// IndexedDB Configuration
const DB_NAME = 'flamepass_games';
const DB_VERSION = 1;
const GAME_STORE = 'games';
const META_STORE = 'meta';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Initialize IndexedDB
function initDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      console.warn('IndexedDB not supported, falling back to localStorage');
      resolve(null);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = event => {
      console.error('IndexedDB error:', event.target.error);
      resolve(null); // Resolve with null to indicate fallback needed
    };

    request.onupgradeneeded = event => {
      const db = event.target.result;

      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains(GAME_STORE)) {
        db.createObjectStore(GAME_STORE, { keyPath: 'slug' });
      }

      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = event => {
      resolve(event.target.result);
    };
  });
}

// Store data in IndexedDB
async function storeInDB(db, storeName, data) {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve(false);
      return;
    }

    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    transaction.oncomplete = () => resolve(true);
    transaction.onerror = event => {
      console.error(`Error storing in ${storeName}:`, event.target.error);
      resolve(false);
    };

    if (Array.isArray(data)) {
      // Clear existing data for bulk inserts
      store.clear();

      // Add each item
      data.forEach(item => {
        store.add(item);
      });
    } else {
      // Single item
      store.put(data);
    }
  });
}

// Get all data from a store
async function getAllFromDB(db, storeName) {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve(null);
      return;
    }

    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = event => {
      resolve(event.target.result);
    };

    request.onerror = event => {
      console.error(`Error getting data from ${storeName}:`, event.target.error);
      resolve(null);
    };
  });
}

// Get a specific item from a store
async function getFromDB(db, storeName, key) {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve(null);
      return;
    }

    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = event => {
      resolve(event.target.result);
    };

    request.onerror = event => {
      console.error(`Error getting item from ${storeName}:`, event.target.error);
      resolve(null);
    };
  });
}

// Function to fetch games with advanced caching
async function fetchGames() {
  try {
    // Initialize IndexedDB
    const db = await initDB();

    // First, check memory cache
    if (cache.games) {
      return cache.games;
    }

    // Next, check IndexedDB
    if (db) {
      const meta = await getFromDB(db, META_STORE, 'lastUpdated');
      const currentTime = Date.now();

      // If we have fresh data in IndexedDB
      if (meta && (currentTime - meta.timestamp < CACHE_DURATION)) {
        console.log('Loading games from IndexedDB cache');
        const games = await getAllFromDB(db, GAME_STORE);

        if (games && games.length > 0) {
          // Update memory cache
          cache.games = games;

          // Also cache games by category
          populateCategoryCaches(games);

          return games;
        }
      }
    }

    // If no cache or cache expired, fetch from network
    console.log('Fetching fresh game data from server');
    const response = await fetch('/json/g.json');
    const games = await response.json();

    // Update memory cache
    cache.games = games;

    // Also cache games by category
    populateCategoryCaches(games);

    // Store in IndexedDB for future use
    if (db) {
      await storeInDB(db, GAME_STORE, games);
      await storeInDB(db, META_STORE, {
        key: 'lastUpdated',
        timestamp: Date.now()
      });
    }

    return games;
  } catch (error) {
    console.error('Error fetching games:', error);

    // Attempt localStorage fallback if available
    try {
      const cachedData = localStorage.getItem('cache_games');
      if (cachedData) {
        const { data } = JSON.parse(cachedData);
        cache.games = data;
        populateCategoryCaches(data);
        return data;
      }
    } catch (localStorageError) {
      console.error('Error accessing localStorage:', localStorageError);
    }

    return [];
  }
}

// Populates category-specific caches for faster access
function populateCategoryCaches(games) {
  if (!Array.isArray(games) || games.length === 0) return;

  // Reset category caches
  cache.gamesByCategory = {
    cloud: [],
    browser: [],
    emulator: []
  };

  // Count games by category
  const categoryCount = {
    cloud: 0,
    browser: 0,
    emulator: 0
  };

  // Group games by category
  games.forEach(game => {
    const category = game.category || 'browser'; // Default to browser if no category

    if (cache.gamesByCategory[category]) {
      cache.gamesByCategory[category].push(game);
      categoryCount[category]++;
    }
  });

  // Store category counts
  cache.categoryCount = categoryCount;

  // Save category counts to localStorage for quick access
  try {
    localStorage.setItem('game_category_counts', JSON.stringify(categoryCount));
  } catch (e) {
    console.warn('Failed to store category counts in localStorage:', e);
  }
}

// Get games by category
async function getGamesByCategory(category) {
  // Check memory cache first
  if (cache.gamesByCategory && cache.gamesByCategory[category] && cache.gamesByCategory[category].length > 0) {
    return cache.gamesByCategory[category];
  }

  // If not in memory cache, load all games and filter
  const allGames = await fetchGames();
  return allGames.filter(game => (game.category || 'browser') === category);
}

// Function to load games page
async function loadGamesPage() {
  try {
    console.log('Loading games page');

    // Only set up category selector and pagination controls once
    setupCategorySelector();

    // Get games data
    const data = await fetchGames();

    // Get current category and page from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const currentCategory = urlParams.get('category') || 'cloud'; // Default to Cloud Gaming
    const currentPage = parseInt(urlParams.get('page') || '1');
    const searchQuery = urlParams.get('search') || '';
    const sortType = urlParams.get('sort') || '';

    // Update active category in selector
    updateActiveCategoryButton(currentCategory);

    // Filter games by category and search if applicable
    let filteredGames = data.filter(game => (game.category || 'browser') === currentCategory);

    // Handle search if present
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredGames = filteredGames.filter(game =>
        game.name.toLowerCase().includes(query) ||
        (game.description && game.description.toLowerCase().includes(query)) ||
        (game.tags && Array.isArray(game.tags) && game.tags.some(tag => tag.toLowerCase().includes(query)))
      );

      // Add search results info
      const infoEl = document.createElement('div');
      infoEl.className = 'search-results-info';
      infoEl.innerHTML = `Found ${filteredGames.length} game${filteredGames.length === 1 ? '' : 's'} matching "${searchQuery}"`;

      const gameContainer = document.querySelector('.gameContain');
      if (gameContainer) {
        gameContainer.parentNode.insertBefore(infoEl, gameContainer);
      }
    }

    // Handle sort options
    if (sortType === 'trending') {
      // For trending, we'll use a random selection of popular games
      filteredGames = filteredGames.filter(game =>
        game.tags && Array.isArray(game.tags) && game.tags.includes('popular')
      );

      // If not enough popular games, add some random ones
      if (filteredGames.length < 10) {
        const otherGames = data.filter(game =>
          (game.category || 'browser') === currentCategory &&
          (!game.tags || !game.tags.includes('popular'))
        );

        // Shuffle and get enough to reach 10 total
        const shuffled = [...otherGames].sort(() => 0.5 - Math.random());
        filteredGames = [...filteredGames, ...shuffled.slice(0, 10 - filteredGames.length)];
      }
    } else if (currentCategory !== 'cloud') {
      // Sort games alphabetically ONLY for non-cloud categories
      // Cloud games remain in their original order as provided by the API
      filteredGames = sortGames(filteredGames);
    }

    // Calculate pagination
    const gamesPerPage = 50;
    const totalPages = Math.ceil(filteredGames.length / gamesPerPage);
    const startIndex = (currentPage - 1) * gamesPerPage;
    const endIndex = startIndex + gamesPerPage;
    const currentGames = filteredGames.slice(startIndex, endIndex);

    // Create pagination controls
    createPaginationControls(currentPage, totalPages, currentCategory, searchQuery, sortType);

    // Render games with improvements
    renderGames(currentGames, currentCategory, filteredGames);

    // Set up event handlers
    setupGameSearchFunction(filteredGames);
    setupRandomGameButton();
    setupScrollToTop();
  } catch (error) {
    console.error('Error loading games: ', error);

    // Show error message to user
    const gameContainer = document.querySelector('.gameContain');
    if (gameContainer) {
      gameContainer.innerHTML = `
                <div class="error-message">
                    <span class="material-symbols-outlined">error</span>
                    <h3>Error Loading Games</h3>
                    <p>There was a problem loading the games. Please try again later.</p>
                    <button class="retry-button" onclick="window.location.reload()">Retry</button>
                </div>
            `;
    }
  }
}

// Function to setup the category selector
function setupCategorySelector() {
  const categoryContainer = document.getElementById('category-container');
  if (!categoryContainer || categoryContainer.querySelector('.category-selector')) {
    return; // Already set up or container doesn't exist
  }

  const categorySelector = document.createElement('div');
  categorySelector.className = 'category-selector';

  const categories = [
    { id: 'cloud', name: 'Cloud Gaming', icon: 'cloud', requiresAuth: true },
    { id: 'browser', name: 'Browser Games', icon: 'language', requiresAuth: false },
    { id: 'emulator', name: 'Emulator Games', icon: 'videogame_asset', requiresAuth: false }
  ];

  categories.forEach(category => {
    const button = document.createElement('button');
    button.className = 'category-button';
    button.dataset.category = category.id;

    // Add lock for categories that require authentication
    let buttonContent = `
          <span class="material-symbols-outlined category-icon">${category.icon}</span>
          <span class="category-text">${category.name}</span>
        `;

    if (category.requiresAuth) {
      buttonContent += `<span class="material-symbols-outlined lock-icon">lock</span>`;
    }

    button.innerHTML = buttonContent;

    button.addEventListener('click', () => {
      // For auth-required categories, show login if not authenticated
      if (category.requiresAuth && window.isLoggedIn && !window.isLoggedIn()) {
        window.showLoginPopup();
        return;
      }

      // Update URL with new category and reset to page 1
      const url = new URL(window.location);
      url.searchParams.set('category', category.id);
      url.searchParams.set('page', '1');

      // Keep any search params
      const searchQuery = url.searchParams.get('search');
      if (!searchQuery) {
        url.searchParams.delete('search');
      }

      // Keep any sort params
      const sortType = url.searchParams.get('sort');
      if (!sortType) {
        url.searchParams.delete('sort');
      }

      window.location.href = url.toString();
    });

    categorySelector.appendChild(button);
  });

  categoryContainer.appendChild(categorySelector);

  // Add styles for lock icon
  const style = document.createElement('style');
  style.textContent = `
        .lock-icon {
            font-size: 16px;
            margin-left: 5px;
            color: #ff6600;
        }
    `;
  document.head.appendChild(style);
}

// Update active category in the selector
function updateActiveCategoryButton(currentCategory) {
  const categoryButtons = document.querySelectorAll('.category-button');
  categoryButtons.forEach(button => {
    button.classList.toggle('active', button.dataset.category === currentCategory);
  });
}

// Filter games by category
function filterGamesByCategory(games, category) {
  return games.filter(game => (game.category || 'browser') === category);
}

// Memoized sorting function for better performance
const sortGames = (() => {
  const cache = {};

  return (games) => {
    const cacheKey = games.map(g => g.id || g.slug).join('-');

    if (cache[cacheKey]) {
      return cache[cacheKey];
    }

    const sorted = [...games].sort((a, b) => a.name.localeCompare(b.name));
    cache[cacheKey] = sorted;

    return sorted;
  };
})();

// Create pagination controls
function createPaginationControls(currentPage, totalPages, category, searchQuery, sortType) {
  const containers = [
    document.getElementById('pagination-top'),
    document.getElementById('pagination-bottom')
  ];

  containers.forEach(container => {
    if (!container) return;

    container.innerHTML = '';

    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination-controls';

    // Previous button
    const prevButton = document.createElement('button');
    prevButton.className = 'pagination-button prev';
    prevButton.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Back';
    prevButton.disabled = currentPage <= 1;
    prevButton.addEventListener('click', () => {
      if (currentPage > 1) {
        const url = new URL(window.location);
        url.searchParams.set('page', (currentPage - 1).toString());
        window.location.href = url.toString();
      }
    });

    // Page info
    const pageInfo = document.createElement('span');
    pageInfo.className = 'pagination-info';
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

    // Next button
    const nextButton = document.createElement('button');
    nextButton.className = 'pagination-button next';
    nextButton.innerHTML = 'Next <i class="fa-solid fa-arrow-right"></i>';
    nextButton.disabled = currentPage >= totalPages;
    nextButton.addEventListener('click', () => {
      if (currentPage < totalPages) {
        const url = new URL(window.location);
        url.searchParams.set('page', (currentPage + 1).toString());
        window.location.href = url.toString();
      }
    });

    // Page jump selector
    const pageJump = document.createElement('select');
    pageJump.className = 'page-jump';

    for (let i = 1; i <= totalPages; i++) {
      const option = document.createElement('option');
      option.value = i;
      option.textContent = `Page ${i}`;
      if (i === currentPage) {
        option.selected = true;
      }
      pageJump.appendChild(option);
    }

    pageJump.addEventListener('change', (e) => {
      const url = new URL(window.location);
      url.searchParams.set('page', e.target.value);
      window.location.href = url.toString();
    });

    // Append all controls
    paginationContainer.appendChild(prevButton);
    paginationContainer.appendChild(pageInfo);
    paginationContainer.appendChild(pageJump);
    paginationContainer.appendChild(nextButton);

    container.appendChild(paginationContainer);
  });
}

// Render games in the container
function renderGames(games, currentCategory, allGamesInCategory) {
  const gameContainer = document.querySelector('.gameContain');
  if (!gameContainer) return;

  // Clear existing games
  gameContainer.innerHTML = '';

  // Use DocumentFragment for better performance
  const fragment = document.createDocumentFragment();

  // Check if this category requires authentication
  const requiresAuth = currentCategory === 'cloud';
  const isLoggedIn = window.isLoggedIn ? window.isLoggedIn() : false;

  // Update game container data attributes for search functionality
  gameContainer.dataset.category = currentCategory;
  gameContainer.dataset.totalGames = allGamesInCategory.length;

  // Add custom styles for game overlays and other required styles if not already present
  addGameOverlayStyles();
  addCustomGameStyles();

  games.forEach(game => {
    const gameLink = document.createElement('a');

    // Ensure each game has a slug
    if (!game.slug) {
      game.slug = createSlug(game.name);
    }

    // Use the correct SEO-friendly URL format
    gameLink.href = `/game/${game.slug}`;
    gameLink.className = 'gameAnchor';
    gameLink.style.position = 'relative'; // Required for overlay positioning

    // Add tags as classes for filtering
    if (game.tags && game.name) {
      game.tags.forEach(tag => {
        gameLink.id = (gameLink.id ? gameLink.id + ' ' : '') + tag;
      });

      let gameNameClass = game.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9]/g, '-');
      gameLink.className += ' ' + gameNameClass;
    }

    // Add category as data attribute
    if (game.category) {
      gameLink.dataset.category = game.category;
    }

    // Add proxy flag as data attribute
    if (game.proxy !== undefined) {
      gameLink.dataset.proxy = game.proxy;
    }

    const gameImage = document.createElement('img');
    gameImage.src = game.img;
    gameImage.alt = game.name;
    gameImage.title = game.name;
    gameImage.className = 'gameImage';
    gameImage.loading = 'lazy'; // Add lazy loading for images

    // Add game overlay with name
    const gameOverlay = document.createElement('div');
    gameOverlay.className = 'game-overlay';

    const gameTitle = document.createElement('h3');
    gameTitle.className = 'game-title';
    gameTitle.textContent = game.name;

    gameOverlay.appendChild(gameTitle);

    gameLink.appendChild(gameImage);
    gameLink.appendChild(gameOverlay);

    // Add lock overlay for auth-required games if user not logged in
    if (requiresAuth && !isLoggedIn) {
      // Use the auth-controller function if available
      if (window.addLockOverlay) {
        window.addLockOverlay(gameLink, 0.7);
      } else {
        // Fallback if auth-controller not loaded
        addLockOverlayFallback(gameLink);
      }
    }

    fragment.appendChild(gameLink);
  });

  gameContainer.appendChild(fragment);
}

// Fallback function to add lock overlay if auth-controller not loaded
function addLockOverlayFallback(element) {
  const overlay = document.createElement('div');
  overlay.className = 'lock-overlay';
  overlay.innerHTML = '<i class="fa-solid fa-lock"></i>';
  overlay.style.position = 'absolute';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  overlay.style.display = 'flex';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.color = 'white';
  overlay.style.fontSize = '24px';
  overlay.style.zIndex = '100';
  overlay.style.cursor = 'pointer';
  overlay.style.opacity = '0.7';
  overlay.style.transition = 'opacity 0.3s ease';

  element.style.position = 'relative';

  // Add hover effect
  element.addEventListener('mouseenter', () => {
    overlay.style.opacity = '1';
  });

  element.addEventListener('mouseleave', () => {
    overlay.style.opacity = '0.7';
  });

  // Add click event to show login popup
  overlay.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Show a basic login popup if auth-controller is not available
    if (window.showLoginPopup) {
      window.showLoginPopup();
    } else {
      showBasicLoginPopup();
    }
  });

  element.appendChild(overlay);
}

// Basic login popup fallback if auth-controller isn't loaded
function showBasicLoginPopup() {
  // Check if popup already exists
  if (document.getElementById('basicAuthModal')) {
    document.getElementById('basicAuthModal').style.display = 'flex';
    return;
  }

  const modal = document.createElement('div');
  modal.id = 'basicAuthModal';
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  modal.style.display = 'flex';
  modal.style.justifyContent = 'center';
  modal.style.alignItems = 'center';
  modal.style.zIndex = '1000';

  const modalContent = document.createElement('div');
  modalContent.style.backgroundColor = '#1e1e1e';
  modalContent.style.padding = '30px';
  modalContent.style.borderRadius = '10px';
  modalContent.style.maxWidth = '400px';
  modalContent.style.width = '90%';
  modalContent.style.textAlign = 'center';
  modalContent.style.position = 'relative';
  modalContent.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.5)';
  modalContent.style.border = '1px solid rgba(255, 102, 0, 0.3)';

  const closeButton = document.createElement('span');
  closeButton.innerHTML = '&times;';
  closeButton.style.position = 'absolute';
  closeButton.style.top = '10px';
  closeButton.style.right = '15px';
  closeButton.style.fontSize = '24px';
  closeButton.style.cursor = 'pointer';
  closeButton.style.color = '#aaa';
  closeButton.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  const title = document.createElement('h2');
  title.textContent = 'Login Required';
  title.style.color = 'white';
  title.style.marginBottom = '20px';

  const message = document.createElement('p');
  message.textContent = 'You need to login to access Cloud Gaming features.';
  message.style.color = 'white';
  message.style.marginBottom = '25px';

  const buttonsContainer = document.createElement('div');
  buttonsContainer.style.display = 'flex';
  buttonsContainer.style.flexDirection = 'column';
  buttonsContainer.style.gap = '15px';

  const loginButton = document.createElement('a');
  loginButton.href = '/login.html';
  loginButton.textContent = 'Login';
  loginButton.style.backgroundColor = '#ff6600';
  loginButton.style.color = 'white';
  loginButton.style.padding = '12px 20px';
  loginButton.style.borderRadius = '6px';
  loginButton.style.textDecoration = 'none';
  loginButton.style.fontWeight = 'bold';
  loginButton.style.display = 'block';

  const signupButton = document.createElement('a');
  signupButton.href = '/signup.html';
  signupButton.textContent = 'Sign Up';
  signupButton.style.backgroundColor = 'transparent';
  signupButton.style.color = '#ff6600';
  signupButton.style.padding = '11px 20px';
  signupButton.style.borderRadius = '6px';
  signupButton.style.textDecoration = 'none';
  signupButton.style.fontWeight = 'bold';
  signupButton.style.border = '1px solid #ff6600';
  signupButton.style.display = 'block';

  buttonsContainer.appendChild(loginButton);
  buttonsContainer.appendChild(signupButton);

  modalContent.appendChild(closeButton);
  modalContent.appendChild(title);
  modalContent.appendChild(message);
  modalContent.appendChild(buttonsContainer);

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Close modal when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
}

// Setup game search functionality
function setupGameSearchFunction(games) {
  const searchInput = document.getElementById('gameSearch');
  if (!searchInput) return;

  const gameContainer = document.querySelector('.gameContain');
  if (!gameContainer) return;

  // Clear any previous search results info
  const existingResultsInfo = document.querySelector('.search-results-info');
  if (existingResultsInfo) {
    existingResultsInfo.remove();
  }

  // Set up the input event listener
  searchInput.addEventListener('input', function () {
    const searchValue = this.value.toLowerCase().trim();

    if (!searchValue) {
      // If search is empty, show all games
      const gameLinks = gameContainer.querySelectorAll('.gameAnchor');
      gameLinks.forEach(game => {
        game.style.display = '';
      });

      // Remove any search results info
      const resultsInfo = document.querySelector('.search-results-info');
      if (resultsInfo) {
        resultsInfo.remove();
      }
      return;
    }

    // Filter games based on search
    let matchCount = 0;
    const gameLinks = gameContainer.querySelectorAll('.gameAnchor');

    gameLinks.forEach(game => {
      const gameTitle = game.querySelector('.game-title').textContent.toLowerCase();

      if (gameTitle.includes(searchValue)) {
        game.style.display = '';
        matchCount++;
      } else {
        game.style.display = 'none';
      }
    });

    // Update or create search results info
    let resultsInfo = document.querySelector('.search-results-info');
    if (!resultsInfo) {
      resultsInfo = document.createElement('div');
      resultsInfo.className = 'search-results-info';
      gameContainer.parentNode.insertBefore(resultsInfo, gameContainer);
    }

    // Create clear button
    const clearButton = document.createElement('button');
    clearButton.className = 'clear-search-button';
    clearButton.textContent = 'Clear';
    clearButton.addEventListener('click', () => {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
    });

    resultsInfo.innerHTML = `Found ${matchCount} game${matchCount === 1 ? '' : 's'} matching "${searchValue}"`;
    resultsInfo.appendChild(clearButton);
  });
}

// Setup random game button with enhanced functionality
function setupRandomGameButton() {
  const randomBtn = document.querySelector('.randomBtn');
  if (!randomBtn) return;

  randomBtn.addEventListener('click', async () => {
    // Get current category from URL or default to browser
    const urlParams = new URLSearchParams(window.location.search);
    const currentCategory = urlParams.get('category') || 'cloud';

    try {
      // Get games for the current category
      const categoryGames = await getGamesByCategory(currentCategory);

      // Select random game
      if (categoryGames.length > 0) {
        const randomIndex = Math.floor(Math.random() * categoryGames.length);
        const randomGame = categoryGames[randomIndex];

        // Check if random game requires authentication
        if (randomGame.category === 'cloud' && window.isLoggedIn && !window.isLoggedIn()) {
          window.showLoginPopup ? window.showLoginPopup() : showBasicLoginPopup();
          return;
        }

        // Navigate to the game page
        window.location.href = `/game/${randomGame.slug}`;
      }
    } catch (error) {
      console.error('Error selecting random game:', error);

      // Fallback to simpler method with visible games
      const gameAnchors = Array.from(document.querySelectorAll('.gameAnchor'));
      const visibleGameAnchors = gameAnchors.filter(
        anchor => getComputedStyle(anchor).display !== 'none'
      );

      if (visibleGameAnchors.length > 0) {
        const randomIndex = Math.floor(
          Math.random() * visibleGameAnchors.length
        );
        visibleGameAnchors[randomIndex].click();
      }
    }
  });
}

// Setup scroll to top button with performance optimizations
function setupScrollToTop() {
  const scrollToTopBtn = document.querySelector('.scrolltop');
  if (!scrollToTopBtn) return;

  // Use IntersectionObserver for better performance than scroll event
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        // Show button when top of page is not visible
        scrollToTopBtn.style.opacity = entry.isIntersecting ? '0' : '1';
      });
    },
    { threshold: 0 }
  );

  // Observe the top of the page
  const topElement = document.createElement('div');
  topElement.style.height = '1px';
  topElement.style.width = '1px';
  topElement.style.position = 'absolute';
  topElement.style.top = '0';
  document.body.prepend(topElement);
  observer.observe(topElement);

  // Add click handler with smooth scrolling
  scrollToTopBtn.addEventListener('click', function () {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

// Helper function to create a slug for a game if it doesn't already have one
function createSlug(name) {
  const baseSlug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  return `${baseSlug}-${randomSuffix}`;
}

// Add game overlay styles
function addGameOverlayStyles() {
  if (document.getElementById('game-overlay-styles')) return;

  const styleEl = document.createElement('style');
  styleEl.id = 'game-overlay-styles';
  styleEl.textContent = `
        .game-overlay {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 93%;
            padding: 15px;
            background: linear-gradient(transparent, rgb(0, 0, 0));
            color: white;
            opacity: 1;
            transition: opacity 0.3s;
        }
        
        .game-title {
            margin: 0;
            font-size: 1.2rem;
            font-weight: 600;
            text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.8);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    `;

  document.head.appendChild(styleEl);
}

// Add other custom styles needed for the game page
function addCustomGameStyles() {
  if (document.getElementById('custom-game-styles')) return;

  const styleEl = document.createElement('style');
  styleEl.id = 'custom-game-styles';
  styleEl.textContent = `
        .gameAnchor {
            position: relative;
            overflow: hidden;
            border-radius: 8px;
            transition: transform 0.3s ease;
        }
        
        .gameAnchor:hover {
            transform: translateY(-5px);
        }
        
        .gameImage {
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 8px;
        }
        
        .lock-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            color: white;
            font-size: 24px;
            z-index: 100;
            cursor: pointer;
            transition: opacity 0.3s ease;
            border-radius: 8px;
        }
        
        /* Search results info */
        .search-results-info {
            text-align: center;
            margin: 20px 0;
            color: #fff;
            font-size: 16px;
            background-color: rgba(30, 30, 30, 0.7);
            padding: 15px;
            border-radius: 8px;
        }
        
        .clear-search-button {
            padding: 5px 10px;
            background-color: #ff6600;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
            transition: background-color 0.3s;
            margin-left: 10px;
        }
        
        .clear-search-button:hover {
            background-color: #ff8033;
        }
        
        /* Lock icon for category buttons */
        .lock-icon {
            font-size: 16px;
            margin-left: 5px;
            color: #ff6600;
        }
        
        /* Error message */
        .error-message {
            text-align: center;
            padding: 30px;
            background-color: rgba(30, 30, 30, 0.7);
            border-radius: 8px;
            margin: 50px 0;
        }
        
        .error-message span {
            font-size: 40px;
            color: #ff6600;
            display: block;
            margin-bottom: 15px;
        }
        
        .error-message h3 {
            font-size: 24px;
            margin-bottom: 10px;
        }
        
        .error-message p {
            margin-bottom: 20px;
            color: rgba(255, 255, 255, 0.8);
        }
        
        .retry-button {
            padding: 10px 20px;
            background-color: #ff6600;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
            font-weight: bold;
        }
    `;

  document.head.appendChild(styleEl);
}

// Enhanced function to load specific game details
async function loadGameDetails(slug) {
  try {
    console.log('Loading game details for:', slug);

    // Show loading state
    const gameContainer = document.getElementById('game-container');
    if (!gameContainer) return;

    gameContainer.innerHTML = `
            <div class="loading-container">
                <div class="loader">
                    <svg viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r="32" class="loader-circle" />
                    </svg>
                </div>
                <p class="loading-text">Loading game information...</p>
            </div>
        `;

    // Get all games data
    const games = await fetchGames();

    // Find the specific game
    const game = games.find(g => g.slug === slug);

    if (!game) {
      console.error('Game not found:', slug);
      gameContainer.innerHTML = `
                <div class="error-message">
                    <span class="material-symbols-outlined">error</span>
                    <h3>Game Not Found</h3>
                    <p>Sorry, we couldn't find the game you're looking for.</p>
                    <a href="/g.html" class="retry-button">Browse All Games</a>
                </div>
            `;
      return;
    }

    // Render the game details
    renderGameDetails(gameContainer, game, games);

    // Update page title and meta tags
    document.title = `${game.name} | Flamepass`;

    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.content = `Play ${game.name} online with Flamepass. ${game.description || 'No downloads required, works directly in your browser.'}`;
    }

    // Update canonical URL
    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      canonicalLink.href = `/game/${slug}`;
    }

    // Load category sections based on current game
    loadGameCategorySections(game, games);

  } catch (error) {
    console.error('Error loading game details:', error);

    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
      gameContainer.innerHTML = `
                <div class="error-message">
                    <span class="material-symbols-outlined">error</span>
                    <h3>Error Loading Game</h3>
                    <p>There was a problem loading the game details. Please try again later.</p>
                    <button class="retry-button" onclick="window.location.reload()">Retry</button>
                </div>
            `;
    }
  }
}

// Render game details
function renderGameDetails(container, game, allGames) {
  if (!container || !game) return;

  // First clear the container
  container.innerHTML = '';

  // Create game info section
  const gameInfo = document.createElement('div');
  gameInfo.className = 'game-info';

  // Game title
  const gameTitle = document.createElement('h1');
  gameTitle.textContent = game.name;
  gameInfo.appendChild(gameTitle);

  // Game metadata
  const gameMeta = document.createElement('div');
  gameMeta.className = 'game-metadata';

  // Add publisher if available
  if (game.publisher) {
    const publisherItem = document.createElement('div');
    publisherItem.className = 'metadata-item';
    publisherItem.innerHTML = `
            <div class="metadata-icon">
                <i class="fa-solid fa-building"></i>
            </div>
            <div>
                <span class="metadata-label">Publisher</span>
                <div class="metadata-value">${game.publisher}</div>
            </div>
        `;
    gameMeta.appendChild(publisherItem);
  }

  // Add category if available
  if (game.category) {
    const categoryItem = document.createElement('div');
    categoryItem.className = 'metadata-item';
    categoryItem.innerHTML = `
            <div class="metadata-icon">
                <i class="fa-solid fa-gamepad"></i>
            </div>
            <div>
                <span class="metadata-label">Category</span>
                <div class="metadata-value">${game.category.charAt(0).toUpperCase() + game.category.slice(1)} Game</div>
            </div>
        `;
    gameMeta.appendChild(categoryItem);
  }

  // Add release date if available
  if (game.releaseDate) {
    const releaseDateItem = document.createElement('div');
    releaseDateItem.className = 'metadata-item';

    // Format date
    let formattedDate = game.releaseDate;
    try {
      const date = new Date(game.releaseDate);
      if (!isNaN(date.getTime())) {
        formattedDate = date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
    } catch (e) {
      console.warn('Error formatting date:', e);
    }

    releaseDateItem.innerHTML = `
            <div class="metadata-icon">
                <i class="fa-solid fa-calendar"></i>
            </div>
            <div>
                <span class="metadata-label">Released</span>
                <div class="metadata-value">${formattedDate}</div>
            </div>
        `;
    gameMeta.appendChild(releaseDateItem);
  }

  gameInfo.appendChild(gameMeta);

  // Game image in container for effects
  const imageContainer = document.createElement('div');
  imageContainer.className = 'game-image-container';

  const gameImage = document.createElement('img');
  gameImage.src = game.img;
  gameImage.alt = game.name;
  gameImage.className = 'game-detail-image';
  gameImage.loading = 'lazy';

  imageContainer.appendChild(gameImage);
  gameInfo.appendChild(imageContainer);

  // Game tags section
  const gameTags = document.createElement('div');
  gameTags.className = 'game-tags';

  // Add main category badge
  const categoryBadge = document.createElement('span');
  categoryBadge.className = 'category-badge';
  categoryBadge.innerHTML = `<i class="fa-solid fa-tag"></i> ${game.category.charAt(0).toUpperCase() + game.category.slice(1)} Game`;
  gameTags.appendChild(categoryBadge);

  // Add tags
  const tags = game.tags || [];
  if (tags.length > 0) {
    tags.forEach(tag => {
      if (tag !== 'all' && tag !== game.category) {
        const tagBadge = document.createElement('span');
        tagBadge.className = 'tag-badge';
        tagBadge.textContent = tag.charAt(0).toUpperCase() + tag.slice(1);
        gameTags.appendChild(tagBadge);
      }
    });
  }

  gameInfo.appendChild(gameTags);

  // Game description (placeholder if not available)
  const description = document.createElement('p');
  description.className = 'game-description';
  description.textContent = game.description || `Play ${game.name} online with Flamepass. No downloads required, works directly in your browser.`;
  gameInfo.appendChild(description);

  // Handle cloud gaming service providers
  if (game.category === 'cloud' && game.serviceProviders) {
    renderServiceProviders(gameInfo, game);
  } else {
    // Standard play button
    const playButton = document.createElement('a');
    const useProxy = game.proxy !== undefined ? game.proxy : true;
    playButton.href = `/&.html?q=${encodeURIComponent(game.url)}&proxy=${useProxy}`;
    playButton.className = 'play-game-button';
    playButton.innerHTML = '<i class="fa-solid fa-play"></i> Play Game';
    gameInfo.appendChild(playButton);
  }

  // Add to container
  container.appendChild(gameInfo);

  // Add related games section
  renderRelatedGames(container, game, allGames);

  // Add back button
  const backButton = document.createElement('div');
  backButton.className = 'back-button';

  const backLink = document.createElement('a');
  backLink.href = '/g.html';
  backLink.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Back to Games';
  backLink.className = 'back-link';

  backButton.appendChild(backLink);
  container.appendChild(backButton);
}

// Function to render service providers section
function renderServiceProviders(container, game) {
  if (!game.serviceProviders) return;

  // Create service providers section
  const providersSection = document.createElement('div');
  providersSection.className = 'service-providers-section';

  const providersTitle = document.createElement('h3');
  providersTitle.className = 'providers-title';
  providersTitle.textContent = 'Play on:';
  providersSection.appendChild(providersTitle);

  // Service providers grid
  const providersGrid = document.createElement('div');
  providersGrid.className = 'service-providers-grid';

  // Service provider logos and links
  const providerLogos = {
    'GeForceNow': '/assets/providers/geforcenow.png',
    'Boosteroid': '/assets/providers/boosteroid.png',
    'Xbox': '/assets/providers/xbox.png',
    'PlayStation': '/assets/providers/playstation.png',
    'Amazon': '/assets/providers/amazon.png',
    'Google': '/assets/providers/google.png',
    'Meta': '/assets/providers/meta.png',
    'Nintendo': '/assets/providers/nintendo.png'
  };

  // Default logo for providers not in our known list
  const defaultLogo = '/assets/providers/default.png';

  // Add each service provider
  let index = 0;
  for (const provider in game.serviceProviders) {
    const providerCard = document.createElement('div');
    providerCard.className = 'provider-card';

    // For staggered animation
    providerCard.style.animationDelay = `${index * 0.1}s`;
    index++;

    // Provider logo
    const logoContainer = document.createElement('div');
    logoContainer.className = 'provider-logo';

    const logo = document.createElement('img');
    // Fallback to placeholder if logo URL is missing
    if (!providerLogos[provider] && !defaultLogo) {
      logo.src = `https://via.placeholder.com/60x60?text=${provider}`;
    } else {
      logo.src = providerLogos[provider] || defaultLogo;
    }
    logo.alt = `${provider} logo`;
    logo.onerror = function () {
      this.src = `https://via.placeholder.com/60x60?text=${provider}`;
    };
    logoContainer.appendChild(logo);

    providerCard.appendChild(logoContainer);

    // Provider name
    const providerName = document.createElement('div');
    providerName.className = 'provider-name';
    providerName.textContent = provider;
    providerCard.appendChild(providerName);

    // Play button
    const playButton = document.createElement('a');
    const providerUrl = game.serviceProviders[provider].url;
    const useProxy = game.proxy !== undefined ? game.proxy : true;
    playButton.href = `/&.html?q=${encodeURIComponent(providerUrl)}&proxy=${useProxy}`;
    playButton.className = 'provider-play-button';
    playButton.innerHTML = '<i class="fa-solid fa-play"></i> Play';

    // Add click analytics
    playButton.addEventListener('click', () => {
      try {
        if (window.gtag) {
          window.gtag('event', 'play_game', {
            'event_category': 'engagement',
            'event_label': `${game.name} on ${provider}`,
            'value': 1
          });
        }
      } catch (e) {
        console.warn('Analytics error:', e);
      }
    });

    providerCard.appendChild(playButton);
    providersGrid.appendChild(providerCard);
  }

  providersSection.appendChild(providersGrid);
  container.appendChild(providersSection);
}

// Render related games section
function renderRelatedGames(container, game, allGames) {
  // Filter out the current game
  const otherGames = allGames.filter(g => g.slug !== game.slug);

  // Find games from the same category
  const sameCategory = otherGames.filter(g =>
    (g.category || 'browser') === (game.category || 'browser')
  );

  // Get up to 6 random games
  const relatedGames = getRandomGames(sameCategory.length > 0 ? sameCategory : otherGames, 6);

  if (relatedGames.length === 0) return;

  // Create related games section
  const relatedSection = document.createElement('div');
  relatedSection.className = 'related-games';

  const relatedTitle = document.createElement('h2');
  relatedTitle.textContent = `More ${game.category.charAt(0).toUpperCase() + game.category.slice(1)} Games`;
  relatedSection.appendChild(relatedTitle);

  // Create games grid
  const relatedGrid = document.createElement('div');
  relatedGrid.className = 'related-games-grid';

  // Add each related game
  relatedGames.forEach((relatedGame) => {
    const gameLink = document.createElement('a');
    gameLink.href = `/game/${relatedGame.slug}`;
    gameLink.className = 'related-game-item';

    const gameImg = document.createElement('img');
    gameImg.src = relatedGame.img;
    gameImg.alt = relatedGame.name;
    gameImg.title = relatedGame.name;
    gameImg.loading = 'lazy';

    // Add overlay with gradient and title
    const gameOverlay = document.createElement('div');
    gameOverlay.className = 'game-overlay';

    const gameTitle = document.createElement('h3');
    gameTitle.className = 'game-title';
    gameTitle.textContent = relatedGame.name;

    gameOverlay.appendChild(gameTitle);

    gameLink.appendChild(gameImg);
    gameLink.appendChild(gameOverlay);
    relatedGrid.appendChild(gameLink);
  });

  relatedSection.appendChild(relatedGrid);
  container.appendChild(relatedSection);
}

// Helper function to get random games
function getRandomGames(games, count) {
  if (!Array.isArray(games) || games.length === 0) {
    return [];
  }

  // Shuffle array
  const shuffled = [...games].sort(() => 0.5 - Math.random());

  // Return up to count games
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// Load category sections for the game detail page
async function loadGameCategorySections(currentGame, allGames) {
  try {
    // Get category counts (either from cache or localStorage)
    let categoryCounts = cache.categoryCount;
    if (!categoryCounts) {
      try {
        const storedCounts = localStorage.getItem('game_category_counts');
        if (storedCounts) {
          categoryCounts = JSON.parse(storedCounts);
        }
      } catch (e) {
        console.warn('Failed to get category counts from localStorage:', e);
      }
    }

    if (!categoryCounts) {
      // Calculate counts if not available
      categoryCounts = {
        cloud: allGames.filter(g => g.category === 'cloud').length,
        browser: allGames.filter(g => g.category === 'browser').length,
        emulator: allGames.filter(g => g.category === 'emulator').length
      };
    }

    // Get all categories except the current game's category
    const otherCategories = ['cloud', 'browser', 'emulator'].filter(cat => cat !== currentGame.category);

    // Get trending games (popular tagged games)
    const trendingGames = allGames.filter(game =>
      game.tags && Array.isArray(game.tags) && game.tags.includes('popular')
    );

    // If not enough trending games, add some random ones
    let trendingToShow = trendingGames;
    if (trendingGames.length < 6) {
      const otherRandomGames = getRandomGames(
        allGames.filter(game => !trendingGames.includes(game)),
        6 - trendingGames.length
      );
      trendingToShow = [...trendingGames, ...otherRandomGames];
    } else {
      // Get a random subset of trending games
      trendingToShow = getRandomGames(trendingGames, 6);
    }

    // Get main content container
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;

    // Get footer to insert before
    const footer = mainContent.querySelector('.footer');

    // 1. Render Trending Now section
    const trendingSection = document.createElement('section');
    trendingSection.className = 'trending-section';
    trendingSection.innerHTML = `
            <div class="section-header">
                <h2>Trending Now</h2>
                <a href="/g.html?sort=trending" class="view-all-link">View all <span class="material-symbols-outlined">arrow_forward</span></a>
            </div>
            <div id="trending-games" class="games-grid"></div>
        `;

    // Populate trending games
    const trendingGrid = trendingSection.querySelector('.games-grid');
    trendingToShow.forEach(game => {
      const gameCard = createGameCard(game);
      trendingGrid.appendChild(gameCard);
    });

    // 2. Create category-specific sections for other categories
    const categoryPromises = otherCategories.map(async category => {
      // Get games for this category
      let categoryGames;
      if (cache.gamesByCategory && cache.gamesByCategory[category]) {
        categoryGames = getRandomGames(cache.gamesByCategory[category], 6);
      } else {
        // Filter games
        const filteredGames = allGames.filter(g => g.category === category);
        categoryGames = getRandomGames(filteredGames, 6);
      }

      // Create section
      const categorySection = document.createElement('section');
      categorySection.className = 'trending-section';
      categorySection.innerHTML = `
                <div class="section-header">
                    <h2>${category.charAt(0).toUpperCase() + category.slice(1)} Games</h2>
                    <a href="/g.html?category=${category}" class="view-all-link">View all ${categoryCounts[category] || ''} <span class="material-symbols-outlined">arrow_forward</span></a>
                </div>
                <div id="${category}-games" class="games-grid"></div>
            `;

      // Populate category games
      const categoryGrid = categorySection.querySelector('.games-grid');
      categoryGames.forEach(game => {
        const gameCard = createGameCard(game);
        categoryGrid.appendChild(gameCard);
      });

      return categorySection;
    });

    // 3. Create the "Explore More Categories" section
    const exploreSection = document.createElement('section');
    exploreSection.className = 'categories-section';
    exploreSection.innerHTML = `
            <div class="section-header">
                <h2>Explore More Categories</h2>
                <a href="/g.html" class="view-all-link">View all <span class="material-symbols-outlined">arrow_forward</span></a>
            </div>
            <div class="categories-grid">
                ${otherCategories.map(category => `
                    <a href="/g.html?category=${category}" class="category-card">
                        <div class="category-icon">
                            <span class="material-symbols-outlined">${getCategoryIcon(category)}</span>
                        </div>
                        <h3>${category.charAt(0).toUpperCase() + category.slice(1)} Games</h3>
                        <span class="game-count">${categoryCounts[category] || 0} Games</span>
                    </a>
                `).join('')}
            </div>
        `;

    // Wait for all category sections to be ready
    const categorySections = await Promise.all(categoryPromises);

    // Insert sections in the correct order
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
      // Insert trending section after game container
      if (gameContainer.nextSibling) {
        mainContent.insertBefore(trendingSection, gameContainer.nextSibling);
      } else {
        mainContent.appendChild(trendingSection);
      }

      // Insert category sections
      let lastElement = trendingSection;
      categorySections.forEach(section => {
        mainContent.insertBefore(section, lastElement.nextSibling);
        lastElement = section;
      });

      // Insert explore section last
      mainContent.insertBefore(exploreSection, footer || null);
    }

  } catch (error) {
    console.error('Error loading category sections:', error);
  }
}

// Helper function to create a game card
function createGameCard(game) {
  const gameCard = document.createElement('a');
  gameCard.href = `/game/${game.slug}`;
  gameCard.className = 'game-card';

  gameCard.innerHTML = `
        <div class="game-card-image">
            <img src="${game.img}" alt="${game.name}" loading="lazy">
            <div class="game-card-overlay">
                <h3>${game.name}</h3>
            </div>
        </div>
        <div class="game-card-details">
            <span class="game-category">${game.category.charAt(0).toUpperCase() + game.category.slice(1)} Game</span>
        </div>
    `;

  return gameCard;
}

// Helper function to get category icon
function getCategoryIcon(category) {
  switch (category) {
    case 'cloud':
      return 'cloud';
    case 'emulator':
      return 'videogame_asset';
    case 'browser':
      return 'language';
    default:
      return 'gamepad';
  }
}

// Main initialization function
document.addEventListener('DOMContentLoaded', () => {
  // Check which page we're on and handle accordingly
  const path = window.location.pathname;

  if (path === '/g.html') {
    loadGamesPage();
  } else if (path.startsWith('/game/')) {
    // Extract game slug from URL
    const slug = path.split('/').pop();
    if (slug) {
      loadGameDetails(slug);
    }
  }
});

// Export functions for global access
window.fetchGames = fetchGames;
window.getGamesByCategory = getGamesByCategory;
window.renderGameDetails = renderGameDetails;
window.getRandomGames = getRandomGames;