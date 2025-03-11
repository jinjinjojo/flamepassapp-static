// game-loader.js - SEO-friendly game page loader
// This script extracts the game slug from the current URL path

document.addEventListener('DOMContentLoaded', () => {
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
  
  function loadGameDetails(slug) {
    fetch('/json/g.json')
      .then(response => response.json())
      .then(data => {
        const game = data.find(g => g.slug === slug);
        
        if (!game) {
          showError('Game not found');
          return;
        }
        
        // Update page title, URL and meta tags for SEO
        document.title = `${game.name} - Play Online | Flamepass`;
        updateMetaTags(game);
        
        // Update URL if needed (only if not already in the correct format)
        if (!window.location.pathname.includes(`/game/${slug}`)) {
          const newUrl = `/game/${slug}`;
          // Use replaceState to avoid creating a browser history entry
          try {
            window.history.replaceState({slug: slug}, '', newUrl);
          } catch (e) {
            // Some browsers may block this in certain contexts, just continue
            console.log("Could not update URL, continuing anyway");
          }
        }
        
        // Display game content
        const container = document.getElementById('game-container');
        renderGameDetails(container, game, data);
      })
      .catch(error => {
        console.error('Error loading game details:', error);
        showError('Error loading game data');
      });
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
    
    // Game image
    const gameImage = document.createElement('img');
    gameImage.src = game.img;
    gameImage.alt = game.name;
    gameImage.className = 'game-detail-image';
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
    
    // Related games section
    const relatedGames = document.createElement('div');
    relatedGames.className = 'related-games';
    
    const relatedTitle = document.createElement('h2');
    relatedTitle.textContent = 'Similar Games';
    relatedGames.appendChild(relatedTitle);
    
    // Find related games based on category or tags
    const gameTagsList = game.tags || game.categories || [];
    const gameCategory = game.category || '';
    
    const filteredGames = allGames
      .filter(g => g.slug !== game.slug && (
        g.category === gameCategory ||
        (g.tags && gameTagsList.some(tag => g.tags.includes(tag))) ||
        (g.categories && gameTagsList.some(tag => g.categories.includes(tag)))
      ))
      .slice(0, 6);
    
    if (filteredGames.length > 0) {
      const relatedGrid = document.createElement('div');
      relatedGrid.className = 'related-games-grid';
      
      filteredGames.forEach(relatedGame => {
        const gameLink = document.createElement('a');
        gameLink.href = `/game/${relatedGame.slug}`;
        gameLink.className = 'related-game-item';
        
        const gameImg = document.createElement('img');
        gameImg.src = relatedGame.img;
        gameImg.alt = relatedGame.name;
        gameImg.title = relatedGame.name;
        
        const gameName = document.createElement('p');
        gameName.textContent = relatedGame.name;
        
        gameLink.appendChild(gameImg);
        gameLink.appendChild(gameName);
        relatedGrid.appendChild(gameLink);
      });
      
      relatedGames.appendChild(relatedGrid);
    } else {
      const noGames = document.createElement('p');
      noGames.textContent = 'No similar games found.';
      noGames.style.textAlign = 'center';
      relatedGames.appendChild(noGames);
    }
    
    // Add to container
    container.appendChild(relatedGames);
    
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