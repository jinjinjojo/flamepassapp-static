// game-loader.js - SEO-friendly game page loader with improved caching
// Uses category-based caching and efficient data handling

document.addEventListener('DOMContentLoaded', () => {
  // First check if we have pre-rendered game data from the Edge Function
  if (window.GAME_DATA) {
    console.log('Using pre-rendered game data');
    renderGameDetails(document.getElementById('game-container'), window.GAME_DATA);
    return;
  }

  // Extract the game slug from the URL path
  let slug = '';
  const path = window.location.pathname;

  // If we're on a /game/ URL, extract the slug from the path
  if (path.includes('/game/')) {
    slug = path.split('/game/')[1].replace('/', '');
  }

  // Fallback to query parameters if provided
  if (!slug) {
    const urlParams = new URLSearchParams(window.location.search);
    slug = urlParams.get('slug') || '';
  }

  if (slug) {
    // Load the game details
    loadGameDetails(slug);
  } else {
    showError('Game not found');
  }
});

// Enhanced game data loading with split category caching
async function loadGameDetails(slug) {
  try {
    // Track which category the game belongs to (for related games)
    let gameCategory = null;
    let game = null;
    let allCategoryGames = null;

    // Try each category cache to find the game
    const categories = ['cloud', 'browser', 'emulator'];

    for (const category of categories) {
      // First check memory cache
      if (window.cache && window.cache[category]) {
        const foundGame = window.cache[category].find(g => g.slug === slug);
        if (foundGame) {
          game = foundGame;
          gameCategory = category;
          allCategoryGames = window.cache[category];
          break;
        }
      }

      // Then check localStorage cache by category
      const cachedData = localStorage.getItem(`cache_games_${category}`);
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          const foundGame = parsed.data.find(g => g.slug === slug);
          if (foundGame) {
            game = foundGame;
            gameCategory = category;
            allCategoryGames = parsed.data;

            // Update memory cache
            if (window.cache) {
              window.cache[category] = parsed.data;
            }
            break;
          }
        } catch (e) {
          console.warn(`Error parsing cached ${category} game data:`, e);
        }
      }
    }

    // If not found in any category cache, fetch all games
    if (!game) {
      // Fetch from server
      try {
        const response = await fetch('/json/g.json');
        if (!response.ok) {
          throw new Error(`Failed to fetch game data: ${response.status}`);
        }

        const allGames = await response.json();

        // Find the game
        game = allGames.find(g => g.slug === slug);

        if (!game) {
          showError('Game not found');
          return;
        }

        // Determine category
        gameCategory = game.category || 'browser';

        // Filter games by category for related content
        allCategoryGames = allGames.filter(g => (g.category || 'browser') === gameCategory);

        // Store in memory and localStorage by category
        storeCategoryData(gameCategory, allCategoryGames);
      } catch (fetchError) {
        console.error('Error fetching game data:', fetchError);
        showError('Error connecting to game server');
        return;
      }
    }

    // Update page title and meta tags for SEO
    document.title = `${game.name} - Play Online | Flamepass`;
    updateMetaTags(game);

    // Display game content
    const container = document.getElementById('game-container');
    if (!container) {
      console.error('Game container element not found');
      return;
    }

    // Clear the loading animation
    container.innerHTML = '';

    // Render the game details with category data
    renderGameDetails(container, game, allCategoryGames);
  } catch (error) {
    console.error('Error loading game details:', error);
    showError('Error loading game data');
  }
}

// Store category data efficiently
function storeCategoryData(category, data) {
  // Update memory cache
  if (!window.cache) {
    window.cache = {};
  }
  window.cache[category] = data;

  // Store in localStorage with compression
  try {
    localStorage.setItem(`cache_games_${category}`, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (storageError) {
    console.warn(`localStorage quota exceeded for ${category}, using memory cache only`);

    // Try to clear older caches
    for (const cat of ['cloud', 'browser', 'emulator']) {
      if (cat !== category) {
        localStorage.removeItem(`cache_games_${cat}`);
      }
    }

    // Try again one more time
    try {
      localStorage.setItem(`cache_games_${category}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (retryError) {
      console.error('Still unable to store in localStorage after cleanup');
    }
  }
}

function updateMetaTags(game) {
  // Update description
  let metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    metaDescription.content = `Play ${game.name} online for free with Flamepass. No downloads required, works in your browser.`;
  }

  // Update keywords
  let metaKeywords = document.querySelector('meta[name="keywords"]');
  if (metaKeywords) {
    // Combine game name with general keywords
    const tags = game.tags || game.categories || [];
    const keywordString = `${game.name}, ${tags.join(', ')}, Online Games, Free Games, Flamepass`;
    metaKeywords.content = keywordString;
  }

  // Update open graph image
  let ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) {
    ogImage.content = game.img;
  } else {
    ogImage = document.createElement('meta');
    ogImage.setAttribute('property', 'og:image');
    ogImage.content = game.img;
    document.head.appendChild(ogImage);
  }

  // Update open graph title
  let ogTitle = document.querySelector('meta[property="og:title"]');
  if (!ogTitle) {
    ogTitle = document.createElement('meta');
    ogTitle.setAttribute('property', 'og:title');
    document.head.appendChild(ogTitle);
  }
  ogTitle.content = `${game.name} - Play Online | Flamepass`;

  // Add canonical URL for SEO
  let canonicalLink = document.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.rel = 'canonical';
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.href = `${window.location.origin}/game/${game.slug}`;
}

function renderGameDetails(container, game, allGames) {
  // Clear loading content
  container.innerHTML = '';

  // Create game info section
  const gameInfo = document.createElement('div');
  gameInfo.className = 'game-info';

  // Game title
  const gameTitle = document.createElement('h1');
  gameTitle.textContent = game.name;
  gameInfo.appendChild(gameTitle);

  // Game metadata if available
  if (game.publisher || game.releaseDate) {
    const gameMeta = document.createElement('div');
    gameMeta.className = 'game-metadata';

    if (game.publisher) {
      const publisherItem = document.createElement('div');
      publisherItem.className = 'metadata-item';
      publisherItem.innerHTML = `
        <span class="metadata-icon"><i class="fa-solid fa-building"></i></span>
        <span class="metadata-label">Publisher:</span>
        <span class="metadata-value">${game.publisher}</span>
      `;
      gameMeta.appendChild(publisherItem);
    }

    if (game.releaseDate) {
      const releaseDateItem = document.createElement('div');
      releaseDateItem.className = 'metadata-item';
      releaseDateItem.innerHTML = `
        <span class="metadata-icon"><i class="fa-solid fa-calendar"></i></span>
        <span class="metadata-label">Released:</span>
        <span class="metadata-value">${formatDate(game.releaseDate)}</span>
      `;
      gameMeta.appendChild(releaseDateItem);
    }

    gameInfo.appendChild(gameMeta);
  }

  // Game image
  const gameImage = document.createElement('img');
  gameImage.src = game.img;
  gameImage.alt = game.name;
  gameImage.className = 'game-detail-image';
  gameImage.loading = 'lazy'; // Add lazy loading for better performance
  gameInfo.appendChild(gameImage);

  // Game tags section
  const gameTags = document.createElement('div');
  gameTags.className = 'game-tags';

  // Add main category badge
  const categoryBadge = document.createElement('span');
  categoryBadge.className = 'category-badge primary';
  categoryBadge.textContent = game.category || 'Browser Game';
  gameTags.appendChild(categoryBadge);

  // Add tags
  const tags = game.tags || game.categories || [];
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

  // Game description (if available)
  if (game.description) {
    const description = document.createElement('p');
    description.className = 'game-description';
    description.textContent = game.description;
    gameInfo.appendChild(description);
  }

  // Special handling for cloud gaming games
  if (game.category === 'cloud' && game.serviceProviders) {
    addServiceProviders(gameInfo, game);
  } else {
    // Standard play button for non-cloud games
    const playButton = document.createElement('a');
    const useProxy = game.proxy !== undefined ? game.proxy : true; // Default to true if not specified
    playButton.href = `/&.html?q=${encodeURIComponent(game.url)}&proxy=${useProxy}`;
    playButton.className = 'play-game-button';
    playButton.innerHTML = '<i class="fa-solid fa-play"></i> Play Game';
    gameInfo.appendChild(playButton);
  }

  // Add to container
  container.appendChild(gameInfo);

  // Only add related games if we have the games data
  if (allGames && allGames.length > 0) {
    // Related games section
    const relatedGames = document.createElement('div');
    relatedGames.className = 'related-games';

    const relatedTitle = document.createElement('h2');
    relatedTitle.textContent = 'More ' + (game.category || 'Browser') + ' Games';
    relatedGames.appendChild(relatedTitle);

    // Filter out current game
    const otherGames = allGames.filter(g => g.slug !== game.slug);

    // Randomly select up to 6 games from the same category
    const randomGames = getRandomGames(otherGames, 6);

    if (randomGames.length > 0) {
      const relatedGrid = document.createElement('div');
      relatedGrid.className = 'related-games-grid';

      randomGames.forEach(relatedGame => {
        const gameLink = document.createElement('a');
        gameLink.href = `/game/${relatedGame.slug}`;
        gameLink.className = 'related-game-item';

        const gameImg = document.createElement('img');
        gameImg.src = relatedGame.img;
        gameImg.alt = relatedGame.name;
        gameImg.title = relatedGame.name;
        gameImg.loading = 'lazy'; // Add lazy loading for better performance

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

      relatedGames.appendChild(relatedGrid);
    } else {
      const noGames = document.createElement('p');
      noGames.textContent = 'No other games in this category found.';
      noGames.style.textAlign = 'center';
      relatedGames.appendChild(noGames);
    }

    // Add to container
    container.appendChild(relatedGames);
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

  // Add CSS for game overlays if not already present
  addGameOverlayStyles();
}

// Format date function
function formatDate(dateString) {
  if (!dateString) return '';

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (e) {
    // If date parsing fails, return the original string
    return dateString;
  }
}

// Create service provider section for cloud gaming
function addServiceProviders(container, game) {
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
  for (const provider in game.serviceProviders) {
    const providerCard = document.createElement('div');
    providerCard.className = 'provider-card';

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
    providerCard.appendChild(playButton);

    providersGrid.appendChild(providerCard);
  }

  providersSection.appendChild(providersGrid);
  container.appendChild(providersSection);

  // Style for service providers if not already added
  addServiceProviderStyles();
}

// Add styles for service providers
function addServiceProviderStyles() {
  if (document.getElementById('service-provider-styles')) return;

  const styleEl = document.createElement('style');
  styleEl.id = 'service-provider-styles';
  styleEl.textContent = `
    .service-providers-section {
      margin-top: 25px;
      margin-bottom: 25px;
    }
    
    .providers-title {
      margin: 0 0 15px 0;
      font-size: 1.4rem;
      color: #f0f0f0;
    }
    
    .service-providers-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 20px;
    }
    
    .provider-card {
      background-color: rgba(40, 40, 40, 0.7);
      border-radius: 10px;
      padding: 15px;
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: transform 0.3s, box-shadow 0.3s;
      border: 1px solid #3a3a3a;
    }
    
    .provider-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
      border-color: #ff6600;
    }
    
    .provider-logo {
      width: 60px;
      height: 60px;
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 10px;
      background-color: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      padding: 8px;
    }
    
    .provider-logo img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    
    .provider-name {
      font-size: 1rem;
      font-weight: 600;
      color: white;
      margin-bottom: 12px;
      text-align: center;
    }
    
    .provider-play-button {
      background-color: #ff6600;
      color: white;
      border: none;
      border-radius: 20px;
      padding: 8px 16px;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.3s;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
    }
    
    .provider-play-button:hover {
      background-color: #ff8033;
    }
    
    @media (max-width: 576px) {
      .service-providers-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `;

  document.head.appendChild(styleEl);
}

// Helper function to get random games from an array
function getRandomGames(games, count) {
  // If we have fewer games than requested count, return all
  if (games.length <= count) {
    return [...games];
  }

  // Shuffle array using Fisher-Yates algorithm
  const shuffled = [...games];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Return first {count} elements
  return shuffled.slice(0, count);
}

// Add styles for game overlays
function addGameOverlayStyles() {
  if (document.getElementById('game-overlay-styles')) return;

  const styleEl = document.createElement('style');
  styleEl.id = 'game-overlay-styles';
  styleEl.textContent = `
    .game-overlay {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      padding: 15px;
      background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
      color: white;
      opacity: 1;
      transition: opacity 0.3s;
    }
    
    .game-title {
      margin: 0;
      font-size: 1.2rem;
      font-weight: 600;
      text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.8);
    }
    
    .related-game-item {
      position: relative;
      overflow: hidden;
      border-radius: 8px;
      transition: transform 0.3s ease;
      height: 215px;
    }
    
    .related-game-item:hover {
      transform: translateY(-5px);
    }
    
    .related-games-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
      gap: 20px;
      margin-top: 15px;
    }
    
    .related-game-item img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 8px;
    }
    
    @media (max-width: 768px) {
      .related-games-grid {
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      }
    }
    
    @media (max-width: 480px) {
      .related-games-grid {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      }
    }
  `;

  document.head.appendChild(styleEl);
}

// Show error message when things go wrong
function showError(message) {
  const container = document.getElementById('game-container');
  if (!container) return;

  container.innerHTML = `
    <div class="error-message">
      <h1>Oops!</h1>
      <p>${message}</p>
      <a href="/g.html" class="back-link"><i class="fa-solid fa-arrow-left"></i> Back to Games</a>
    </div>
  `;
}