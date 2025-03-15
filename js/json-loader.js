// Enhanced JSON loader with caching, lazy loading, and performance improvements
localforage.setItem('e', 'e');

// Cache objects to prevent multiple fetches
const cache = {
	games: null,
	smallShortcuts: null,
	bigShortcuts: null,
	apps: null
};

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

// Updated function to load games page with lazy loading and performance improvements
async function loadGamesPage() {
	try {
		// Only set up category selector and pagination controls once
		setupCategorySelector();

		// Get games data
		const data = await fetchWithCache('/json/g.json', 'games');

		// Get current category and page from URL params
		const urlParams = new URLSearchParams(window.location.search);
		const currentCategory = urlParams.get('category') || 'browser';
		const currentPage = parseInt(urlParams.get('page') || '1');

		// Update active category in selector
		updateActiveCategoryButton(currentCategory);

		// Filter games by category
		let filteredGames = filterGamesByCategory(data, currentCategory);

		// Sort games alphabetically
		filteredGames.sort((a, b) => a.name.localeCompare(b.name));

		// Calculate pagination
		const gamesPerPage = 50;
		const totalPages = Math.ceil(filteredGames.length / gamesPerPage);
		const startIndex = (currentPage - 1) * gamesPerPage;
		const endIndex = startIndex + gamesPerPage;
		const currentGames = filteredGames.slice(startIndex, endIndex);

		// Create pagination controls
		createPaginationControls(currentPage, totalPages, currentCategory);

		// Render games with improvements
		renderGames(currentGames);

		// Set up event handlers
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
		{ id: 'browser', name: 'Browser Games', icon: 'language' },
		{ id: 'emulator', name: 'Emulator Games', icon: 'videogame_asset' },
		{ id: 'cloud', name: 'Cloud Gaming', icon: 'cloud' }
	];

	categories.forEach(category => {
		const button = document.createElement('button');
		button.className = 'category-button';
		button.dataset.category = category.id;

		button.innerHTML = `
      <span class="material-symbols-outlined category-icon">${category.icon}</span>
      <span class="category-text">${category.name}</span>
    `;

		button.addEventListener('click', () => {
			// Update URL with new category and reset to page 1
			const url = new URL(window.location);
			url.searchParams.set('category', category.id);
			url.searchParams.set('page', '1');
			window.location.href = url.toString();
		});

		categorySelector.appendChild(button);
	});

	categoryContainer.appendChild(categorySelector);
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

function renderGames(games) {
	const gameContainer = document.querySelector('.gameContain');
	if (!gameContainer) return;

	// Clear existing games
	gameContainer.innerHTML = '';

	// Use DocumentFragment for better performance
	const fragment = document.createDocumentFragment();

	games.forEach(game => {
		const gameLink = document.createElement('a');

		// Ensure each game has a slug
		if (!game.slug) {
			game.slug = createSlug(game.name);
		}

		// Use the correct SEO-friendly URL format
		gameLink.href = `/game/${game.slug}`;
		gameLink.className = 'gameAnchor';

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

		// Add lazy loading for images
		gameImage.loading = 'lazy';

		gameLink.appendChild(gameImage);
		fragment.appendChild(gameLink);
	});

	gameContainer.appendChild(fragment);
}

// Small shortcuts loader with caching
async function loadSmallShortcuts() {
	try {
		const data = await fetchWithCache('/json/s.json', 'smallShortcuts');
		const shortcuts = document.querySelector('.shortcuts');
		if (!shortcuts) return;

		// Use DocumentFragment for better performance
		const fragment = document.createDocumentFragment();

		data.forEach(shortcut => {
			const shortcutLink = document.createElement('a');

			if (shortcut.name.toLowerCase() === 'settings') {
				shortcutLink.href = '/~.html#proxy';
			} else {
				shortcutLink.href = `/&.html?q=${encodeURIComponent(shortcut.url)}`;
			}

			const shortcutImage = document.createElement('img');
			shortcutImage.src = shortcut.img;
			shortcutImage.alt = shortcut.name;
			shortcutImage.title = shortcut.name;
			shortcutImage.classList.add('shortcut');

			shortcutImage.style.width = '28px';
			shortcutImage.style.height = '28px';
			shortcutImage.style.padding = '11px';
			shortcutImage.style.objectFit = 'cover';
			shortcutImage.style.transition = '0.2s';

			// Add lazy loading for images
			shortcutImage.loading = 'lazy';

			const searchEngineIcon = document.querySelector('.searchEngineIcon');
			if (searchEngineIcon) searchEngineIcon.style.display = 'none';

			const searchButton = document.querySelector('.gointospaceSearchButton');
			if (searchButton) {
				searchButton.style.cssText = 'transform: translate(-11px, 3px); user-select: none; cursor: default;';
			}

			const formSpace = document.getElementById('formintospace');
			if (formSpace) formSpace.style.transform = 'translateY(150px)';

			if (shortcut.style) {
				shortcutImage.style.cssText += shortcut.style;
			}

			if (shortcut.bg) {
				shortcutImage.style.backgroundColor = shortcut.bg;
			}

			shortcutImage.onerror = () => {
				shortcutImage.src = '/assets/default.png';
			};

			shortcutLink.appendChild(shortcutImage);
			fragment.appendChild(shortcutLink);
		});

		shortcuts.appendChild(fragment);
	} catch (error) {
		console.error('Error loading shortcuts: ', error);
	}
}

// Big shortcuts loader with caching
async function loadBigShortcuts() {
	try {
		const data = await fetchWithCache('/json/sb.json', 'bigShortcuts');
		const shortcuts = document.querySelector('.shortcutsBig');
		if (!shortcuts) return;

		// Use DocumentFragment for better performance
		const fragment = document.createDocumentFragment();

		data.forEach(shortcut => {
			const shortcutLink = document.createElement('a');

			if (shortcut.name.toLowerCase() === 'settings') {
				shortcutLink.href = '/~.html#proxy';
			} else {
				shortcutLink.href = `/&.html?q=${encodeURIComponent(shortcut.url)}`;
			}

			const shortcutImage = document.createElement('img');
			shortcutImage.src = shortcut.img;
			shortcutImage.alt = shortcut.name;
			shortcutImage.title = shortcut.name;
			shortcutLink.classList.add('shortcutBig');
			shortcutImage.classList.add('shortcutBigimg');

			shortcutImage.style.width = '170px';
			shortcutImage.style.height = '90px';
			shortcutImage.style.padding = '0';
			shortcutImage.style.transition = '0.2s';

			// Add lazy loading for images
			shortcutImage.loading = 'lazy';

			const gointoSpace = document.getElementById('gointospace');
			if (gointoSpace) {
				gointoSpace.style.cssText = 'width: 500px; text-align: left; padding: 15px; margin-right: -0.5rem; padding-left: 49.5px;';
			}

			const searchButton = document.querySelector('.gointospaceSearchButton');
			if (searchButton) {
				searchButton.style.cssText = 'transform: translate(-34px, 3px); user-select: none; cursor: default;';
			}

			shortcutImage.onerror = () => {
				shortcutImage.src = '/assets/default.png';
			};

			shortcutLink.appendChild(shortcutImage);
			fragment.appendChild(shortcutLink);
		});

		shortcuts.appendChild(fragment);
	} catch (error) {
		console.error('Error loading shortcuts: ', error);
	}
}

// Apps loader with caching
async function loadApps() {
	try {
		const data = await fetchWithCache('/json/a.json', 'apps');
		const appsContainer = document.querySelector('.appsContainer');
		if (!appsContainer) return;

		data.sort((a, b) => a.name.localeCompare(b.name));

		// Use DocumentFragment for better performance
		const fragment = document.createDocumentFragment();

		data.forEach(app => {
			const appLink = document.createElement('a');
			appLink.href = `/&.html?q=${encodeURIComponent(app.url)}`;

			// Support for both tags and categories (for backwards compatibility)
			const appTags = app.tags || app.categories || [];

			if (appTags.length > 0 && app.name) {
				appTags.forEach(tag => {
					appLink.id = (appLink.id ? appLink.id + ' ' : '') + tag;
				});

				let appNameClass = app.name
					.toLowerCase()
					.replace(/\s+/g, '-')
					.replace(/[^a-z0-9-]/g, '-');
				appLink.className = appNameClass;
			}

			const appImage = document.createElement('img');
			appImage.src = app.img;
			appImage.alt = app.name;
			appImage.title = app.name;
			appImage.className = 'appImage';

			// Add lazy loading for images
			appImage.loading = 'lazy';

			appImage.onerror = () => {
				appImage.src = '/assets/default.png';
			};

			appLink.appendChild(appImage);
			fragment.appendChild(appLink);
		});

		appsContainer.appendChild(fragment);
		setupAppSearch();
	} catch (error) {
		console.error('Error loading apps: ', error);
	}
}

// Set up game search once, with debounce
function setupGameSearch() {
	const gameSearchInput = document.querySelector('.gameSearchInput');
	if (!gameSearchInput) return;

	// Add debounce to prevent excessive DOM operations
	const debounce = (func, delay) => {
		let timeoutId;
		return (...args) => {
			clearTimeout(timeoutId);
			timeoutId = setTimeout(() => func.apply(null, args), delay);
		};
	};

	const performSearch = debounce(() => {
		const searchQuery = gameSearchInput.value
			.toLowerCase()
			.replace(/\s+/g, '-')
			.replace(/[^a-z0-9]/g, '-');

		const gameLinks = document.querySelectorAll('.gameContain a');
		gameLinks.forEach(link => {
			link.style.display = link.className.includes(searchQuery) ? '' : 'none';
		});

		// Hide pagination when searching
		const paginationControls = document.querySelectorAll('.pagination-controls');
		paginationControls.forEach(control => {
			control.style.display = searchQuery ? 'none' : '';
		});
	}, 300);

	gameSearchInput.addEventListener('input', () => {
		// Disable animations during search for better performance
		const gameImages = document.querySelectorAll('.gameImage');
		gameImages.forEach(image => {
			image.classList.add('no-animation');
		});

		performSearch();
	});
}

// Set up app search once, with debounce
function setupAppSearch() {
	const appsSearchInput = document.querySelector('.appsSearchInput');
	if (!appsSearchInput) return;

	// Add debounce to prevent excessive DOM operations
	const debounce = (func, delay) => {
		let timeoutId;
		return (...args) => {
			clearTimeout(timeoutId);
			timeoutId = setTimeout(() => func.apply(null, args), delay);
		};
	};

	const performSearch = debounce(() => {
		const searchQuery = appsSearchInput.value
			.toLowerCase()
			.replace(/\s+/g, '-')
			.replace(/[^a-z0-9-]/g, '-');

		const appLinks = document.querySelectorAll('.appsContainer a');
		appLinks.forEach(link => {
			link.style.display = link.className.includes(searchQuery) ? '' : 'none';
		});
	}, 300);

	appsSearchInput.addEventListener('input', () => {
		// Disable animations during search for better performance
		const appImages = document.querySelectorAll('.appImage');
		appImages.forEach(image => {
			image.classList.add('no-animation');
		});

		performSearch();
	});
}

function setupRandomGameButton() {
	const randomBtn = document.querySelector('.randomBtn');
	if (!randomBtn) return;

	randomBtn.addEventListener('click', () => {
		const gameAnchors = Array.from(document.querySelectorAll('.gameAnchor'));
		const visibleGameAnchors = gameAnchors.filter(
			anchor => anchor.style.display !== 'none'
		);

		if (visibleGameAnchors.length > 0) {
			const randomIndex = Math.floor(
				Math.random() * visibleGameAnchors.length
			);
			visibleGameAnchors[randomIndex].click();
		}
	});
}

function setupScrollToTop() {
	const scrollToTopBtn = document.querySelector('.scrolltop');
	if (!scrollToTopBtn) return;

	// Use throttling for scroll event
	let isScrolling = false;
	window.addEventListener('scroll', function () {
		if (!isScrolling) {
			isScrolling = true;
			window.requestAnimationFrame(function () {
				scrollToTopBtn.style.opacity = window.scrollY === 0 ? '0' : '1';
				isScrolling = false;
			});
		}
	});

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