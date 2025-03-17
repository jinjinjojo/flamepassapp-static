// game-loader.js - SEO-friendly game page loader with caching integration
// This script will use pre-rendered data if available or fetch it from local cache

document.addEventListener('DOMContentLoaded', () => {
  // First check if we have pre-rendered game data from the Edge Function
  if (window.GAME_DATA) {
    console.log('Using pre-rendered game data');
    renderGameDetails(document.getElementById('game-container'), window.GAME_DATA);
    return;
  }

  // Extract the game slug from the URL path as a fallback
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
    // Load the game details using the cached data from localforage if available
    loadGameDetails(slug);
  } else {
    showError('Game not found');
  }
});

// Use the cached data from json-loader.js if available
async function loadGameDetails(slug) {
  try {
    // Attempt to get games from the cache first
    let data;

    // Check if cache data is available in memory
    if (window.cache && window.cache.games) {
      data = window.cache.games;
    } else {
      // Try to fetch from localStorage cache
      const cachedData = localStorage.getItem('cache_games');
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        data = parsed.data;
      }

      // If still no data, fetch from server
      if (!data) {
        const response = await fetch('/json/g.json');
        data = await response.json();

        // Store in cache for future use
        if (window.cache) {
          window.cache.games = data;
        }
        localStorage.setItem('cache_games', JSON.stringify({
          data,
          timestamp: Date.now()
        }));
      }
    }

    const game = data.find(g => g.slug === slug);

    if (!game) {
      showError('Game not found');
      return;
    }

    // Update page title and meta tags for SEO
    document.title = `${game.name} - Play Online | Flamepass`;
    updateMetaTags(game);

    // Display game content
    const container = document.getElementById('game-container');
    renderGameDetails(container, game, data);
  } catch (error) {
    console.error('Error loading game details:', error);
    showError('Error loading game data');
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
  // If we don't have all games data and we have game data from prerender,
  // we need to fetch the full games list for related games
  if (!allGames && game) {
    // Try to get cached games data first
    if (window.cache && window.cache.games) {
      renderGameDetails(container, game, window.cache.games);
      return;
    }

    // Check localStorage cache
    const cachedData = localStorage.getItem('cache_games');
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      renderGameDetails(container, game, parsed.data);
      return;
    }

    // Fallback to fetch if no cache available
    fetch('/json/g.json')
      .then(response => response.json())
      .then(data => {
        // Store in cache for future use
        if (window.cache) {
          window.cache.games = data;
        }
        localStorage.setItem('cache_games', JSON.stringify({
          data,
          timestamp: Date.now()
        }));

        renderGameDetails(container, game, data);
      })
      .catch(error => {
        console.error('Error loading full game list:', error);
        // Still render the main game without related games
        renderGameWithoutRelated(container, game);
      });
    return;
  }

  // Clear loading content
  container.innerHTML = '';

  // Create game info section
  const gameInfo = document.createElement('div');
  gameInfo.className = 'game-info';

  // Game title
  const gameTitle = document.createElement('h1');
  gameTitle.textContent = game.name;
  gameInfo.appendChild(gameTitle);

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

  // Play button
  const playButton = document.createElement('a');
  const useProxy = game.proxy !== undefined ? game.proxy : true; // Default to true if not specified
  playButton.href = `/&.html?q=${encodeURIComponent(game.url)}&proxy=${useProxy}`;
  playButton.className = 'play-game-button';
  playButton.innerHTML = '<i class="fa-solid fa-play"></i> Play Game';
  gameInfo.appendChild(playButton);

  // Add to container
  container.appendChild(gameInfo);

  // Only add related games if we have the full games data
  if (allGames) {
    // Related games section - now showing random games from the same category
    const relatedGames = document.createElement('div');
    relatedGames.className = 'related-games';

    const relatedTitle = document.createElement('h2');
    relatedTitle.textContent = 'More ' + (game.category || 'Browser') + ' Games';
    relatedGames.appendChild(relatedTitle);

    // Find games from the same category
    const gameCategory = game.category || 'browser';

    const sameCategory = allGames.filter(g =>
      g.slug !== game.slug &&
      (g.category === gameCategory)
    );

    // Randomly select up to 6 games from the same category
    const randomGames = getRandomGames(sameCategory, 6);

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

        const gameName = document.createElement('p');
        gameName.textContent = relatedGame.name;

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

// Helper function to get random games from an array
function getRandomGames(games, count) {
  // Shuffle array using Fisher-Yates algorithm
  const shuffled = [...games];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Return first {count} elements
  return shuffled.slice(0, count);
}

// Simplified render function when we don't have related games
function renderGameWithoutRelated(container, game) {
  // Same as renderGameDetails but without the related games section
  container.innerHTML = '';

  const gameInfo = document.createElement('div');
  gameInfo.className = 'game-info';

  // Game title
  const gameTitle = document.createElement('h1');
  gameTitle.textContent = game.name;
  gameInfo.appendChild(gameTitle);

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

  // Play button
  const playButton = document.createElement('a');
  const useProxy = game.proxy !== undefined ? game.proxy : true; // Default to true if not specified
  playButton.href = `/&.html?q=${encodeURIComponent(game.url)}&proxy=${useProxy}`;
  playButton.className = 'play-game-button';
  playButton.innerHTML = '<i class="fa-solid fa-play"></i> Play Game';
  gameInfo.appendChild(playButton);

  // Add to container
  container.appendChild(gameInfo);

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
      background: linear-gradient(transparent, rgb(0, 0, 0));
      color: white;
      opacity: 1;
      transition: opacity 0.3s;
    }
    
    .game-title {
      margin: 0;
      font-size: 1.2rem;
      font-weight: 600;
    }
    
    .related-game-item {
      position: relative;
      overflow: hidden;
      border-radius: 8px;
      transition: transform 0.3s ease;
    }
    
    .related-game-item:hover {
      transform: translateY(-5px);
    }
    
    .related-games-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 20px;
      margin-top: 15px;
    }
    
    .related-game-item img {
      width: 100%;
      height: 110px;
      object-fit: cover;
      border-radius: 8px;
    }
    
    @media (max-width: 768px) {
      .related-games-grid {
        grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      }
    }
  `;

  document.head.appendChild(styleEl);
}

function showError(message) {
  const container = document.getElementById('game-container');
  container.innerHTML = `
    <div class="error-message">
      <h1>Oops!</h1>
      <p>${message}</p>
      <a href="/g.html" class="back-link"><i class="fa-solid fa-arrow-left"></i> Back to Games</a>
    </div>
  `;
}