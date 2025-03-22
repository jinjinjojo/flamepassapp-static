// &.js - Enhanced Search and proxy handling for Flamepass
let encodedUrl = '';

/**
 * Execute search or launch game with optional proxy
 * @param {string} query - The URL or search query
 * @param {boolean|null} useProxy - Whether to use proxy (true/false) or auto-detect (null)
 * @param {Object} options - Additional options (e.g. fullscreen, noHistory)
 */
async function executeSearch(query, useProxy = null, options = {}) {
	// Default options
	const defaultOptions = {
		fullscreen: false,
		noHistory: false
	};

	// Merge options
	options = { ...defaultOptions, ...options };

	// Check if we should use proxy based on:
	// 1. Explicit parameter in function call
	// 2. URL query param
	// 3. Property in game object accessed via URL query

	const urlParams = new URLSearchParams(window.location.search);
	const proxyParam = urlParams.get('proxy');

	// Determine if proxy should be used
	let shouldUseProxy = false;

	// If useProxy is explicitly passed to the function, use that
	if (useProxy !== null) {
		shouldUseProxy = useProxy;
	}
	// Otherwise check the URL proxy parameter
	else if (proxyParam !== null) {
		shouldUseProxy = proxyParam === 'true';
	}
	// For game URLs from g.json, the proxy flag should be included in the URL params

	// Set the URL based on whether we should use proxy
	if (shouldUseProxy) {
		encodedUrl = `/@/index.html?uul=${encodeURIComponent(query)}`;
	} else {
		encodedUrl = query;
	}

	localStorage.setItem('input', query);
	localStorage.setItem('output', encodedUrl);

	// Show loading spinner if it exists
	const spinnerParent = document.querySelector('.spinnerParent');
	const spinner = document.querySelector('.spinner');
	const goIntoSpace = document.getElementById('gointospace');

	if (spinnerParent) spinnerParent.style.display = 'block';
	if (spinner) spinner.style.display = 'block';
	if (goIntoSpace) goIntoSpace.style.display = 'none';

	// Get the iframe
	const iframe = document.getElementById('intospace');

	// If we don't have an iframe (like on game pages), redirect the page
	if (!iframe) {
		// Construct redirect URL
		const redirectUrl = `/&.html?q=${encodeURIComponent(query)}&proxy=${shouldUseProxy}`;

		// If we're in fullscreen mode, add that parameter
		if (options.fullscreen) {
			redirectUrl += '&fullscreen=true';
		}

		// Redirect
		window.location.href = redirectUrl;
		return;
	}

	// Set the iframe source
	iframe.src = encodedUrl;
	iframe.style.display = 'block';

	// Hide shortcuts if iframe has content
	if (iframe.src) {
		const shortcuts = document.querySelector('.shortcuts');
		const shortcutsBig = document.querySelector('.shortcutsBig');

		if (shortcuts) shortcuts.style.display = 'none';
		if (shortcutsBig) shortcutsBig.style.display = 'none';
	}

	// Blur any focused inputs
	document.querySelectorAll('input').forEach(input => input.blur());

	// Add to history if not disabled
	if (!options.noHistory) {
		addToHistory(encodedUrl);
	}

	// Go fullscreen if specified
	if (options.fullscreen) {
		// Wait for iframe to load, then go fullscreen
		iframe.onload = () => {
			setTimeout(() => {
				requestFullscreen(iframe);
			}, 500);
		};
	}
}

// History management
let historyArray = JSON.parse(localStorage.getItem('historyArray')) || [];
let currentIndex = parseInt(localStorage.getItem('currentIndex')) || -1;

if (historyArray.length > 0 && currentIndex === -1) {
	currentIndex = historyArray.length - 1;
	saveHistory();
}

function saveHistory() {
	localStorage.setItem('historyArray', JSON.stringify(historyArray));
	localStorage.setItem('currentIndex', currentIndex.toString());
}

function addToHistory(url) {
	// Don't add if it's the same as the current one
	if (currentIndex >= 0 && historyArray[currentIndex] === url) {
		return;
	}

	// If we're not at the end of the history, truncate it
	if (currentIndex < historyArray.length - 1) {
		historyArray = historyArray.slice(0, currentIndex + 1);
	}

	// Add the new URL
	historyArray.push(url);
	currentIndex = historyArray.length - 1;

	// Save the updated history
	saveHistory();

	// Update button states
	updateButtonStates();
}

// Fullscreen utility function
function requestFullscreen(element) {
	if (!element) return;

	if (element.requestFullscreen) {
		element.requestFullscreen();
	} else if (element.mozRequestFullScreen) {
		element.mozRequestFullScreen();
	} else if (element.webkitRequestFullscreen) {
		element.webkitRequestFullscreen();
	} else if (element.msRequestFullscreen) {
		element.msRequestFullscreen();
	}
}

// Utility functions for navigation
function initNavigation() {
	const refreshButton = document.querySelector('.refreshButton');
	const homeButton = document.querySelector('.homeButton');
	const fullscreenButton = document.querySelector('.fullscreenButton');
	const backButton = document.querySelector('.backButton');
	const forwardButton = document.querySelector('.forwardButton');

	if (refreshButton) {
		refreshButton.addEventListener('click', function () {
			const iframe = document.querySelector("#intospace");
			if (iframe && iframe.contentWindow) {
				iframe.contentWindow.location.reload();
			}
		});
	}

	if (homeButton) {
		homeButton.addEventListener('click', function () {
			window.location.href = '/&.html';
		});
	}

	if (fullscreenButton) {
		fullscreenButton.addEventListener('click', () => {
			const iframe = document.getElementById('intospace');

			if (document.fullscreenElement) {
				if (document.exitFullscreen) {
					document.exitFullscreen();
				} else if (document.mozCancelFullScreen) {
					document.mozCancelFullScreen();
				} else if (document.webkitExitFullscreen) {
					document.webkitExitFullscreen();
				} else if (document.msExitFullscreen) {
					document.msExitFullscreen();
				}
			} else {
				if (!iframe || !iframe.src || iframe.src === 'about:blank') {
					requestFullscreen(document.documentElement);
				} else {
					requestFullscreen(iframe);
				}
			}
		});
	}

	if (backButton) {
		backButton.addEventListener('click', function () {
			if (currentIndex > 0) {
				currentIndex--;
				const iframe = document.getElementById('intospace');
				if (iframe) {
					iframe.src = historyArray[currentIndex];
					iframe.style.display = 'block';

					const goIntoSpace2 = document.getElementById('gointospace2');
					if (goIntoSpace2) {
						setTimeout(() => {
							goIntoSpace2.style.paddingLeft = '40px';
						}, 250);
					}
				}
				updateButtonStates();
				saveHistory();
			}
		});
	}

	if (forwardButton) {
		forwardButton.addEventListener('click', function () {
			if (currentIndex < historyArray.length - 1) {
				currentIndex++;
				const iframe = document.getElementById('intospace');
				if (iframe) {
					iframe.src = historyArray[currentIndex];
					iframe.style.display = 'block';

					const goIntoSpace2 = document.getElementById('gointospace2');
					if (goIntoSpace2) {
						setTimeout(() => {
							goIntoSpace2.style.paddingLeft = '40px';
						}, 250);
					}
				}
				updateButtonStates();
				saveHistory();
			}
		});
	}

	// Initialize button states
	updateButtonStates();
}

function updateButtonStates() {
	const backButton = document.querySelector('.backButton');
	const forwardButton = document.querySelector('.forwardButton');

	if (!backButton || !forwardButton) return;

	if (currentIndex > 0) {
		backButton.style.opacity = '1';
		backButton.style.cursor = 'pointer';
	} else {
		backButton.style.opacity = '0.5';
		backButton.style.cursor = 'default';
	}

	if (currentIndex < historyArray.length - 1) {
		forwardButton.style.opacity = '1';
		forwardButton.style.cursor = 'pointer';
	} else {
		forwardButton.style.opacity = '0.5';
		forwardButton.style.cursor = 'default';
	}
}

// Search field event listeners
function initSearchFields() {
	const address1 = document.getElementById('gointospace');
	const address2 = document.getElementById('gointospace2');

	if (address1) {
		address1.addEventListener('keydown', function (event) {
			if (event.key === 'Enter') {
				event.preventDefault();
				let query = address1.value;
				// For direct user input, default to using the proxy
				executeSearch(query, true);
			}
		});
	}

	if (address2) {
		address2.addEventListener('keydown', function (event) {
			if (event.key === 'Enter') {
				event.preventDefault();
				let query = address2.value;
				// For direct user input, default to using the proxy
				executeSearch(query, true);
			}
		});
	}
}

// Process URL parameters on page load
document.addEventListener('DOMContentLoaded', function () {
	// Initialize navigation buttons
	initNavigation();

	// Initialize search fields
	initSearchFields();

	// Process URL parameters
	const urlParams = new URLSearchParams(window.location.search);
	const queryParam = urlParams.get('q');
	const proxyParam = urlParams.get('proxy');
	const fullscreenParam = urlParams.get('fullscreen');

	if (queryParam) {
		// Use the proxy parameter if specified, otherwise default based on game data
		const useProxy = proxyParam !== null ? proxyParam === 'true' : null;

		// Set fullscreen option if specified
		const options = {
			fullscreen: fullscreenParam === 'true'
		};

		// Execute search with parameters
		executeSearch(queryParam, useProxy, options);

		// Handle UI adjustments
		const utilityBar = document.querySelector('.utilityBar');
		const iframe = document.getElementById('intospace');

		if (utilityBar && iframe) {
			if (fullscreenParam === 'true' || localStorage.getItem('utilBarHidden') === 'true') {
				utilityBar.style.display = 'none';
				iframe.style.height = '100vh';
				iframe.style.top = '0';
			} else {
				utilityBar.style.display = 'block';
				iframe.style.height = 'calc(100% - 3.633em)';
			}
		}
	} else {
		// Regular page load (no specific game)
		const utilityBar = document.querySelector('.utilityBar');
		const iframe = document.getElementById('intospace');

		if (utilityBar && iframe) {
			if (localStorage.getItem('utilBarHidden') === 'true') {
				utilityBar.style.display = 'none';
				iframe.style.height = '100%';
			} else {
				utilityBar.style.display = 'block';
				iframe.style.height = 'calc(100% - 3.633em)';
			}
		}

		// Highlight the proxy page nav item if exists
		const proxyPageNav = document.querySelector('.pPage');
		if (proxyPageNav) {
			proxyPageNav.id = 'navactive';
		}
	}

	// Update button states
	updateButtonStates();
});

// Export functions to window for accessibility from other scripts
window.executeSearch = executeSearch;
window.historyArray = historyArray;
window.currentIndex = currentIndex;
window.requestFullscreen = requestFullscreen;