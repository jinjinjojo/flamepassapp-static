// Client-side router for handling game pages
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on a game page route
    if (window.location.pathname.startsWith('/game/')) {
      const slug = window.location.pathname.split('/game/')[1].replace('/', '');
      
      // Create a state object with the game slug
      const state = { slug };
      
      // Replace the current URL with game-page.html but keep the visual URL as /game/{slug}
      const url = `/game/${slug}`;
      
      // Use history.replaceState to change the URL without reloading
      history.replaceState(state, '', url);
      
      // Load the game page content
      loadGamePage(slug);
    }
  });
  
  // Function to handle the popstate event (when user navigates back/forward)
  window.addEventListener('popstate', (event) => {
    if (event.state && event.state.slug) {
      loadGamePage(event.state.slug);
    }
  });
  
  // Function to load game page content
  function loadGamePage(slug) {
    fetch('/json/g.json')
      .then(response => response.json())
      .then(data => {
        const game = data.find(g => g.slug === slug);
        
        if (!game) {
          showError('Game not found');
          return;
        }
        
        // Update page title and meta
        document.title = `${game.name} - Flamepass`;
        updateMetaTags(game);
        
        // Display game content (assuming we have a container with id 'game-container')
        const container = document.getElementById('game-container') || createGameContainer();
        renderGameDetails(container, game, data);
      })
      .catch(error => {
        console.error('Error loading game details:', error);
        showError('Error loading game');
      });
  }
  
  // Helper function to create the game container if it doesn't exist
  function createGameContainer() {
    const container = document.createElement('div');
    container.id = 'game-container';
    container.className = 'game-page-container';
    
    // Clear body content and append the new container
    document.body.innerHTML = '';
    document.body.appendChild(container);
    
    return container;
  }
  
  // Function to update meta tags for SEO
  function updateMetaTags(game) {
    // Update description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.name = 'description';
      document.head.appendChild(metaDescription);
    }
    metaDescription.content = `Play ${game.name} online for free with Flamepass.`;
    
    // Update open graph image
    let ogImage = document.querySelector('meta[property="og:image"]');
    if (!ogImage) {
      ogImage = document.createElement('meta');
      ogImage.setAttribute('property', 'og:image');
      document.head.appendChild(ogImage);
    }
    ogImage.content = game.img;
    
    // Add other meta tags as needed
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement('meta');
      ogTitle.setAttribute('property', 'og:title');
      document.head.appendChild(ogTitle);
    }
    ogTitle.content = `${game.name} - Play Online | Flamepass`;
  }
  
  // Function to render game details
  function renderGameDetails(container, game, allGames) {
    // Clear the container
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
    
    // Add main category as a prominent badge
    const categoryBadge = document.createElement('span');
    categoryBadge.className = 'category-badge primary';
    categoryBadge.textContent = game.category || 'Browser Game';
    gameTags.appendChild(categoryBadge);
    
    // Add tags (formerly categories)
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
    
    // Play button
    const playButton = document.createElement('a');
    const useProxy = game.proxy !== undefined ? game.proxy : true; // Default to true if not specified
    playButton.href = `/&.html?q=${encodeURIComponent(game.url)}&proxy=${useProxy}`;
    playButton.className = 'play-game-button';
    playButton.textContent = 'Play Game';
    gameInfo.appendChild(playButton);
    
    // Add to container
    container.appendChild(gameInfo);
    
    // Related games section
    const relatedGames = document.createElement('div');
    relatedGames.className = 'related-games';
    
    const relatedTitle = document.createElement('h2');
    relatedTitle.textContent = 'Similar Games';
    relatedGames.appendChild(relatedTitle);
    
    // Filter games to find related ones based on category or tags
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
        
        // Add click event to handle client-side routing
        gameLink.addEventListener('click', (e) => {
          e.preventDefault();
          const slug = relatedGame.slug;
          history.pushState({ slug }, '', `/game/${slug}`);
          loadGamePage(slug);
        });
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
    backLink.textContent = '← Back to Games';
    backLink.className = 'back-link';
    
    backButton.appendChild(backLink);
    container.appendChild(backButton);
  }
  
  // Function to show error messages
  function showError(message) {
    const container = document.getElementById('game-container') || createGameContainer();
    container.innerHTML = `
      <div class="error-message">
        <h1>Oops!</h1>
        <p>${message}</p>
        <a href="/g.html" class="back-link">← Back to Games</a>
      </div>
    `;
  }