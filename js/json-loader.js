// Enhanced JSON loader with category filtering, pagination, and SEO-friendly game pages
localforage.setItem('e', 'e');

document.addEventListener('DOMContentLoaded', () => {
	// Check which page we're on and handle accordingly
	if (window.location.pathname === '/g.html') {
		loadGamesPage();
	} else if (
		window.location.pathname === '/&.html' &&
		localStorage.getItem('smallIcons') === 'true'
	) {
		loadSmallShortcuts();
	} else if (
		window.location.pathname === '/&.html' &&
		(localStorage.getItem('smallIcons') === 'false' ||
			!localStorage.getItem('smallIcons'))
	) {
		loadBigShortcuts();
	} else if (window.location.pathname === '/a.html') {
		loadApps();
	}
});

// Updated function to load games page
function loadGamesPage() {
	fetch('/json/g.json')
		.then(response => response.json())
		.then(data => {
			// Game container
			const gameContainer = document.querySelector('.gameContain');
			if (!gameContainer) return;

			// Add category selector to the category container
			const categorySelector = createCategorySelector();
			const categoryContainer = document.getElementById('category-container');
			if (categoryContainer) {
				categoryContainer.appendChild(categorySelector);
			}

			// Get current category and page from URL params
			const urlParams = new URLSearchParams(window.location.search);
			const currentCategory = urlParams.get('category') || 'browser';
			const currentPage = parseInt(urlParams.get('page') || '1');

			// Update active category in selector
			const categoryButtons = document.querySelectorAll('.category-button');
			categoryButtons.forEach(button => {
				if (button.dataset.category === currentCategory) {
					button.classList.add('active');
				}
			});

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

			// Clear existing games
			gameContainer.innerHTML = '';

			// Add pagination controls to dedicated containers
			const paginationTop = createPaginationControls(currentPage, totalPages, currentCategory);
			const paginationTopContainer = document.getElementById('pagination-top');
			if (paginationTopContainer) {
				paginationTopContainer.innerHTML = '';
				paginationTopContainer.appendChild(paginationTop);
			}

			// Add games to the container
			currentGames.forEach(game => {
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

				gameLink.appendChild(gameImage);
				gameContainer.appendChild(gameLink);
			});

			// Add pagination controls to the bottom container
			const paginationBottom = createPaginationControls(currentPage, totalPages, currentCategory);
			const paginationBottomContainer = document.getElementById('pagination-bottom');
			if (paginationBottomContainer) {
				paginationBottomContainer.innerHTML = '';
				paginationBottomContainer.appendChild(paginationBottom);
			}

			// Set up game search
			setupGameSearch(filteredGames);

			// Set up random game button
			setupRandomGameButton();

			// Set up scroll to top button
			setupScrollToTop();
		})
		.catch(error => console.error('Error loading games: ', error));
}

function createCategorySelector() {
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

		// Add icon and text to make it consistent with YT channels styling
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

	return categorySelector;
}

function filterGamesByCategory(games, category) {
	// Use the new 'category' field
	return games.filter(game => (game.category || 'browser') === category);
}

function createPaginationControls(currentPage, totalPages, category) {
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

	return paginationContainer;
}

function setupGameSearch(filteredGames) {
	const gameSearchInput = document.querySelector('.gameSearchInput');
	if (!gameSearchInput) return;

	gameSearchInput.addEventListener('input', () => {
		const gameImages = document.querySelectorAll('.gameImage');
		gameImages.forEach(image => {
			image.classList.add('no-animation');
		});

		const searchQuery = gameSearchInput.value
			.toLowerCase()
			.replace(/\s+/g, '-')
			.replace(/[^a-z0-9]/g, '-');

		const gameLinks = document.querySelectorAll('.gameContain a');
		gameLinks.forEach(link => {
			if (link.className.includes(searchQuery)) {
				link.style.display = '';
			} else {
				link.style.display = 'none';
			}
		});

		// Hide pagination when searching
		const paginationControls = document.querySelectorAll('.pagination-controls');
		paginationControls.forEach(control => {
			if (searchQuery) {
				control.style.display = 'none';
			} else {
				control.style.display = '';
			}
		});
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

	window.addEventListener('scroll', function () {
		if (window.scrollY === 0) {
			scrollToTopBtn.style.opacity = '0';
		} else {
			scrollToTopBtn.style.opacity = '1';
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

// Small shortcuts loader
function loadSmallShortcuts() {
	fetch('/json/s.json')
		.then(response => response.json())
		.then(data => {
			const shortcuts = document.querySelector('.shortcuts');
			if (!shortcuts) return;

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
				shortcuts.appendChild(shortcutLink);
			});
		})
		.catch(error => console.error('Error loading shortcut: ', error));
}

// Big shortcuts loader
function loadBigShortcuts() {
	fetch('/json/sb.json')
		.then(response => response.json())
		.then(data => {
			const shortcuts = document.querySelector('.shortcutsBig');
			if (!shortcuts) return;

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
				shortcuts.appendChild(shortcutLink);
			});
		})
		.catch(error => console.error('Error loading shortcut: ', error));
}

// Apps loader
function loadApps() {
	fetch('/json/a.json')
		.then(response => response.json())
		.then(data => {
			const appsContainer = document.querySelector('.appsContainer');
			if (!appsContainer) return;

			data.sort((a, b) => a.name.localeCompare(b.name));

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

				appImage.onerror = () => {
					appImage.src = '/assets/default.png';
				};

				appLink.appendChild(appImage);
				appsContainer.appendChild(appLink);
			});

			const appsSearchInput = document.querySelector('.appsSearchInput');
			if (appsSearchInput) {
				appsSearchInput.addEventListener('input', () => {
					const appsImages = document.querySelectorAll('.appImage');
					appsImages.forEach(image => {
						image.classList.add('no-animation');
					});

					const searchQuery = appsSearchInput.value
						.toLowerCase()
						.replace(/\s+/g, '-')
						.replace(/[^a-z0-9-]/g, '-');

					const appLinks = document.querySelectorAll('.appsContainer a');
					appLinks.forEach(link => {
						if (link.className.includes(searchQuery)) {
							link.style.display = '';
						} else {
							link.style.display = 'none';
						}
					});
				});
			}
		})
		.catch(error => console.error('Error loading app: ', error));
}