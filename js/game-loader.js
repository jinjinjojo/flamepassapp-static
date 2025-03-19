// Enhanced Game Page Script
// This script extends the functionality of game-loader.js with modern UI features

document.addEventListener('DOMContentLoaded', () => {
  // Initialize the search functionality
  initSearch();

  // Initialize the scroll to top button
  initScrollToTop();

  // Initialize the trending games section
  initTrendingGames();

  // Setup keyboard shortcuts
  setupKeyboardShortcuts();
});

// Function to initialize search functionality
function initSearch() {
  const searchTrigger = document.getElementById('searchTrigger');
  const searchModal = document.getElementById('searchModal');
  const closeSearch = document.getElementById('closeSearch');
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');

  if (!searchTrigger || !searchModal || !closeSearch || !searchInput || !searchResults) {
    console.warn('Search elements not found. Search functionality disabled.');
    return;
  }

  // Open search modal
  searchTrigger.addEventListener('click', () => {
    openSearchModal();
  });

  // Close search modal
  closeSearch.addEventListener('click', () => {
    closeSearchModal();
  });

  // Click outside to close
  searchModal.addEventListener('click', (e) => {
    if (e.target === searchModal) {
      closeSearchModal();
    }
  });

  // Search input handler with debounce
  let debounceTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);

    const query = searchInput.value.trim();

    if (query.length < 2) {
      searchResults.innerHTML = `
        <div class="search-message">
          <span class="material-symbols-outlined">search</span>
          <p>Type at least 2 characters to search</p>
        </div>
      `;
      return;
    }

    // Set loading state
    searchResults.innerHTML = `
      <div class="search-message">
        <div class="loader" style="width: 30px; height: 30px;">
          <svg viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="32" class="loader-circle" />
          </svg>
        </div>
        <p>Searching...</p>
      </div>
    `;

    // Debounce search request
    debounceTimer = setTimeout(() => {
      performSearch(query.toLowerCase());
    }, 300);
  });
}

// Function to open search modal
function openSearchModal() {
  const searchModal = document.getElementById('searchModal');
  const searchInput = document.getElementById('searchInput');

  if (!searchModal || !searchInput) return;

  searchModal.classList.add('active');

  // Focus input after animation
  setTimeout(() => {
    searchInput.focus();
  }, 100);

  // Disable body scroll
  document.body.style.overflow = 'hidden';
}

// Function to close search modal
function closeSearchModal() {
  const searchModal = document.getElementById('searchModal');
  const searchInput = document.getElementById('searchInput');

  if (!searchModal || !searchInput) return;

  searchModal.classList.remove('active');
  searchInput.value = '';

  // Enable body scroll
  document.body.style.overflow = '';
}

// Function to perform search
async function performSearch(query) {
  const searchResults = document.getElementById('searchResults');

  if (!searchResults) return;

  try {
    // Try to get games from cache or localStorage
    let allGames = await getGamesData();

    // Filter games based on query
    const filteredGames = allGames.filter(game =>
      (game.name && game.name.toLowerCase().includes(query)) ||
      (game.description && game.description.toLowerCase().includes(query)) ||
      (game.category && game.category.toLowerCase().includes(query)) ||
      (game.tags && Array.isArray(game.tags) && game.tags.some(tag => tag.toLowerCase().includes(query)))
    );

    // Display results
    if (filteredGames.length === 0) {
      searchResults.innerHTML = `
        <div class="search-message">
          <span class="material-symbols-outlined">sentiment_dissatisfied</span>
          <p>No games found matching "${query}"</p>
        </div>
      `;
    } else {
      searchResults.innerHTML = '';

      filteredGames.slice(0, 8).forEach(game => {
        const resultItem = document.createElement('a');
        resultItem.href = `/game/${game.slug}`;
        resultItem.className = 'search-result-item';

        resultItem.innerHTML = `
          <div class="search-result-image">
            <img src="${game.img}" alt="${game.name}" loading="lazy">
          </div>
          <div class="search-result-info">
            <h3>${game.name}</h3>
            <div class="search-result-meta">
              <span class="category-pill">${game.category || 'Browser Game'}</span>
              ${game.publisher ? `<span class="publisher">${game.publisher}</span>` : ''}
            </div>
          </div>
        `;

        searchResults.appendChild(resultItem);
      });

      if (filteredGames.length > 8) {
        const viewAll = document.createElement('a');
        viewAll.href = `/g.html?search=${encodeURIComponent(query)}`;
        viewAll.className = 'view-all-results';
        viewAll.innerHTML = `View all ${filteredGames.length} results <span class="material-symbols-outlined">arrow_forward</span>`;
        searchResults.appendChild(viewAll);
      }
    }
  } catch (error) {
    console.error('Error during search:', error);
    searchResults.innerHTML = `
      <div class="search-message">
        <span class="material-symbols-outlined">error</span>
        <p>An error occurred while searching</p>
      </div>
    `;
  }
}

// Function to get games data from cache, localStorage, or fetch
async function getGamesData() {
  // Try to get from memory cache
  if (window.cache && window.cache.games && Array.isArray(window.cache.games)) {
    return window.cache.games;
  }

  // Try each category cache
  const categories = ['cloud', 'browser', 'emulator'];
  let allGames = [];

  for (const category of categories) {
    if (window.cache && window.cache[category] && Array.isArray(window.cache[category])) {
      allGames = [...allGames, ...window.cache[category]];
    } else {
      // Try localStorage
      try {
        const cachedData = localStorage.getItem(`cache_games_${category}`);
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          if (parsed.data && Array.isArray(parsed.data)) {
            allGames = [...allGames, ...parsed.data];
          }
        }
      } catch (e) {
        console.warn(`Error loading ${category} games from localStorage:`, e);
      }
    }
  }

  // If we have games, return them
  if (allGames.length > 0) {
    return allGames;
  }

  // Last resort: try to get from legacy cache
  try {
    const cachedData = localStorage.getItem('cache_games');
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      if (parsed.data && Array.isArray(parsed.data)) {
        return parsed.data;
      }
    }
  } catch (e) {
    console.warn('Error loading games from legacy cache:', e);
  }

  // If all else fails, fetch from server
  try {
    const response = await fetch('/json/g.json');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching games data:', error);
    return [];
  }
}

// Function to initialize the scroll to top button
function initScrollToTop() {
  const scrollTopBtn = document.getElementById('scrollTopBtn');

  if (!scrollTopBtn) return;

  // Show/hide button based on scroll position
  window.addEventListener('scroll', () => {
    if (document.documentElement.scrollTop > 300) {
      scrollTopBtn.classList.add('visible');
    } else {
      scrollTopBtn.classList.remove('visible');
    }
  });

  // Scroll to top when clicked
  scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

// Function to initialize trending games section
async function initTrendingGames() {
  const trendingContainer = document.getElementById('trending-games');

  if (!trendingContainer) return;

  try {
    // Get games data
    const allGames = await getGamesData();

    // Shuffle and get 6 random games
    const randomGames = getRandomGames(allGames, 6);

    // Clear container
    trendingContainer.innerHTML = '';

    // Populate trending games
    randomGames.forEach((game, index) => {
      const gameCard = document.createElement('a');
      gameCard.href = `/game/${game.slug}`;
      gameCard.className = 'game-card';
      gameCard.style.animationDelay = `${index * 0.1}s`;

      gameCard.innerHTML = `
        <div class="game-card-image">
          <img src="${game.img}" alt="${game.name}" loading="lazy">
          <div class="game-card-overlay">
            <h3>${game.name}</h3>
          </div>
        </div>
        <div class="game-card-details">
          <span class="game-category">${game.category || 'Browser Game'}</span>
        </div>
      `;

      trendingContainer.appendChild(gameCard);
    });
  } catch (error) {
    console.error('Error loading trending games:', error);
    trendingContainer.innerHTML = '<p>Error loading trending games</p>';
  }
}

// Function to get random games from an array
function getRandomGames(games, count) {
  if (!Array.isArray(games) || games.length === 0) {
    return [];
  }

  // Remove duplicates by slug if any
  const uniqueGames = [];
  const slugs = new Set();

  for (const game of games) {
    if (game && game.slug && !slugs.has(game.slug)) {
      slugs.add(game.slug);
      uniqueGames.push(game);
    }
  }

  // Shuffle array
  const shuffled = [...uniqueGames].sort(() => 0.5 - Math.random());

  // Return up to count games
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// Function to setup keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Open search with Cmd+K or Ctrl+K
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      openSearchModal();
    }

    // Close search with Escape
    if (e.key === 'Escape') {
      closeSearchModal();
    }
  });
}

// Enhanced renderGameDetails function to improve the game page display
function enhancedRenderGameDetails(container, game, allGames) {
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
        <div class="metadata-value">${game.category}</div>
      </div>
    `;
    gameMeta.appendChild(categoryItem);
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
  categoryBadge.innerHTML = `<i class="fa-solid fa-tag"></i> ${game.category || 'Browser Game'}`;
  gameTags.appendChild(categoryBadge);

  // Add tags
  const tags = game.tags || [];
  if (tags.length > 0) {
    tags.forEach(tag => {
      if (tag !== 'all' && tag !== game.category) {
        const tagBadge = document.createElement('span');
        tagBadge.className = 'tag-badge';
        tagBadge.textContent = tag;
        gameTags.appendChild(tagBadge);
      }
    });
  }

  gameInfo.appendChild(gameTags);

  // Game description
  if (game.description) {
    const description = document.createElement('p');
    description.className = 'game-description';
    description.textContent = game.description;
    gameInfo.appendChild(description);
  }

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

  // Add related games if available
  if (allGames && allGames.length > 0) {
    renderRelatedGames(container, game, allGames);
  }

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

// Function to render related games section
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
  relatedTitle.textContent = `More ${game.category || 'Browser'} Games`;
  relatedSection.appendChild(relatedTitle);

  // Create games grid
  const relatedGrid = document.createElement('div');
  relatedGrid.className = 'related-games-grid';

  // Add each related game
  relatedGames.forEach((relatedGame, index) => {
    const gameLink = document.createElement('a');
    gameLink.href = `/game/${relatedGame.slug}`;
    gameLink.className = 'related-game-item';

    // For staggered animation
    gameLink.style.animationDelay = `${index * 0.1}s`;

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

// Enhancement to override the default game page rendering
if (typeof window.renderGameDetails === 'function') {
  console.info('Enhancing game page rendering with modern UI');

  // Store the original function for fallback
  const originalRenderGameDetails = window.renderGameDetails;

  // Override with enhanced version
  window.renderGameDetails = function (container, game, allGames) {
    try {
      // Use our enhanced renderer
      enhancedRenderGameDetails(container, game, allGames);
    } catch (error) {
      console.error('Error in enhanced rendering, falling back to original:', error);
      originalRenderGameDetails(container, game, allGames);
    }
  };
}

// Error handling and recovery
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);

  // Check if it's related to game loading
  if (event.error && event.error.message && (
    event.error.message.includes('game') ||
    event.error.message.includes('render')
  )) {
    const container = document.getElementById('game-container');
    if (container && container.querySelector('.loading-container')) {
      // Show error message if still loading
      container.innerHTML = `
        <div class="error-message">
          <span class="material-symbols-outlined" style="font-size: 3rem; color: var(--accent-primary); margin-bottom: 15px;">error</span>
          <h1>Something went wrong</h1>
          <p>We encountered an error while loading the game information.</p>
          <button class="play-game-button" onclick="window.location.reload()">
            <i class="fa-solid fa-refresh"></i> Try Again
          </button>
        </div>
      `;
    }
  }
});

// Additional category sections preload
async function loadAdditionalCategories() {
  try {
    // Get all games data
    const allGames = await getGamesData();

    // Define categories to display
    const categoriesToShow = ['action', 'adventure', 'racing', 'strategy'];

    // Array of promises for category loading
    const categoryPromises = categoriesToShow.map(category => {
      // Find games for this category
      const categoryGames = allGames.filter(game =>
        game.tags && Array.isArray(game.tags) &&
        game.tags.some(tag => tag.toLowerCase() === category.toLowerCase())
      );

      // Get random selection
      return getRandomGames(categoryGames, 6);
    });

    // Wait for all categories to load
    const categoriesData = await Promise.all(categoryPromises);

    // Create category sections
    categoriesData.forEach((games, index) => {
      if (games.length === 0) return;

      const categoryName = categoriesToShow[index];

      // Create section
      const categorySection = document.createElement('section');
      categorySection.className = 'trending-section category-section';
      categorySection.innerHTML = `
        <div class="section-header">
          <h2>${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)} Games</h2>
          <a href="/g.html?category=${categoryName}" class="view-all-link">View all <span class="material-symbols-outlined">arrow_forward</span></a>
        </div>
        <div class="games-grid" id="${categoryName}-games"></div>
      `;

      // Add to main content before footer
      const footer = document.querySelector('.footer');
      if (footer) {
        document.querySelector('.main-content').insertBefore(categorySection, footer);
      } else {
        document.querySelector('.main-content').appendChild(categorySection);
      }

      // Populate games
      const gamesGrid = document.getElementById(`${categoryName}-games`);
      if (gamesGrid) {
        games.forEach((game, idx) => {
          const gameCard = document.createElement('a');
          gameCard.href = `/game/${game.slug}`;
          gameCard.className = 'game-card';
          gameCard.style.animationDelay = `${idx * 0.1}s`;

          gameCard.innerHTML = `
            <div class="game-card-image">
              <img src="${game.img}" alt="${game.name}" loading="lazy">
              <div class="game-card-overlay">
                <h3>${game.name}</h3>
              </div>
            </div>
            <div class="game-card-details">
              <span class="game-category">${game.category || 'Browser Game'}</span>
            </div>
          `;

          gamesGrid.appendChild(gameCard);
        });
      }
    });
  } catch (error) {
    console.error('Error loading additional categories:', error);
  }
}

// Load additional categories after main content
document.addEventListener('DOMContentLoaded', () => {
  // Check if we're on a game detail page
  const gameContainer = document.getElementById('game-container');
  if (gameContainer) {
    // Wait for main game to load first
    let checkLoaded = setInterval(() => {
      if (!gameContainer.querySelector('.loading-container')) {
        clearInterval(checkLoaded);
        // Now load the additional categories
        setTimeout(() => {
          loadAdditionalCategories();
        }, 1000);
      }
    }, 500);

    // Timeout after 10 seconds to prevent infinite checking
    setTimeout(() => {
      clearInterval(checkLoaded);
    }, 10000);
  }
});