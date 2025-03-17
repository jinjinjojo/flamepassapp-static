// Enhanced JSON loader with caching, lazy loading, and performance improvements
localforage.setItem('e', 'e');

// Cache objects to prevent multiple fetches
const cache = {
	games: null,
	smallShortcuts: null,
	bigShortcuts: null,
	apps: null
};

// Make cache available globally
window.cache = cache;

document.addEventListener('DOMContentLoaded', () => {
	// Check which page we're on and handle accordingly
	const path = window.location.pathname;

	if (path === '/g.html') {
		loadGamesPage();
	} else if (path === '/&.html') {
		const useSmallIcons = localStorage.getItem('smallIcons') === 'true';
		if (useSmallIcons) {
			loadSmallShortcuts();
		} else {
			loadBigShortcuts();
		}
	} else if (path === '/a.html') {
		loadApps();
	}
});

// Function to load JSON data with caching
async function fetchWithCache(url, cacheKey) {
	// Return cached data if available
	if (cache[cacheKey]) {
		return cache[cacheKey];
	}

	try {
		// Check if data exists in local storage
		const cachedData = localStorage.getItem(`cache_${cacheKey}`);
		if (cachedData) {
			const { data, timestamp } = JSON.parse(cachedData);
			// Use cache if less than 1 hour old
			if (Date.now() - timestamp < 3600000) {
				cache[cacheKey] = data;
				return data;
			}
		}

		// Fetch fresh data if cache is expired or doesn't exist
		const response = await fetch(url);
		const data = await response.json();

		// Update cache
		cache[cacheKey] = data;
		localStorage.setItem(`cache_${cacheKey}`, JSON.stringify({
			data,
			timestamp: Date.now()
		}));

		return data;
	} catch (error) {
		console.error(`Error fetching ${url}:`, error);

		// If we have cached data, use it as fallback even if expired
		const cachedData = localStorage.getItem(`cache_${cacheKey}`);
		if (cachedData) {
			return JSON.parse(cachedData).data;
		}

		return [];
	}
}

// Optimized function to load games page with category authentication
async function loadGamesPage() {
	try {
		// Only set up category selector and pagination controls once
		setupCategorySelector();

		// Get games data
		const data = await fetchWithCache('/json/g.json', 'games');

		// Get current category and page from URL params
		const urlParams = new URLSearchParams(window.location.search);
		const currentCategory = urlParams.get('category') || 'cloud'; // Default to Cloud Gaming
		const currentPage = parseInt(urlParams.get('page') || '1');

		// Update active category in selector
		updateActiveCategoryButton(currentCategory);

		// Filter games by category
		let filteredGames = filterGamesByCategory(data, currentCategory);

		// Sort games alphabetically (using memoization for better performance)
		filteredGames = sortGames(filteredGames);

		// Calculate pagination
		const gamesPerPage = 50;
		const totalPages = Math.ceil(filteredGames.length / gamesPerPage);
		const startIndex = (currentPage - 1) * gamesPerPage;
		const endIndex = startIndex + gamesPerPage;
		const currentGames = filteredGames.slice(startIndex, endIndex);

		// Create pagination controls
		createPaginationControls(currentPage, totalPages, currentCategory);

		// Render games with improvements
		renderGames(currentGames, currentCategory, filteredGames);

		// Set up event handlers - now uses all games in category for search
		setupGameSearch(filteredGames);
		setupRandomGameButton();
		setupScrollToTop();
	} catch (error) {
		console.error('Error loading games: ', error);
	}
}

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

function updateActiveCategoryButton(currentCategory) {
	const categoryButtons = document.querySelectorAll('.category-button');
	categoryButtons.forEach(button => {
		button.classList.toggle('active', button.dataset.category === currentCategory);
	});
}

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

function createPaginationControls(currentPage, totalPages, category) {
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
		showBasicLoginPopup();
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

// Setup random game button with enhanced functionality
function setupRandomGameButton() {
	const randomBtn = document.querySelector('.randomBtn');
	if (!randomBtn) return;

	randomBtn.addEventListener('click', async () => {
		// Get current category from URL or default to browser
		const urlParams = new URLSearchParams(window.location.search);
		const currentCategory = urlParams.get('category') || 'cloud';

		try {
			// Get all games or use cached data
			let allGames;

			if (cache.games) {
				allGames = cache.games;
			} else {
				// Try localStorage
				const cachedData = localStorage.getItem('cache_games');
				if (cachedData) {
					allGames = JSON.parse(cachedData).data;
				} else {
					// Fetch if not in cache
					const response = await fetch('/json/g.json');
					allGames = await response.json();
				}
			}

			// Filter games by current category
			const categoryGames = allGames.filter(g =>
				(g.category || 'browser') === currentCategory
			);

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

// Initialize on page load with performance optimizations
document.addEventListener('DOMContentLoaded', () => {
	// Initialize CSS for consistent styling
	addGameOverlayStyles();
	addCustomGameStyles();

	// Check which page we're on and handle accordingly
	const path = window.location.pathname;

	if (path === '/g.html') {
		// Use requestIdleCallback if available for non-critical init
		if (window.requestIdleCallback) {
			requestIdleCallback(() => loadGamesPage(), { timeout: 1000 });
		} else {
			// Fallback to setTimeout for browsers that don't support requestIdleCallback
			setTimeout(loadGamesPage, 10);
		}
	} else if (path === '/&.html') {
		const useSmallIcons = localStorage.getItem('smallIcons') === 'true';
		if (useSmallIcons) {
			loadSmallShortcuts();
		} else {
			loadBigShortcuts();
		}
	} else if (path === '/a.html') {
		loadApps();
	}
});

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
	`;

	document.head.appendChild(styleEl);
}