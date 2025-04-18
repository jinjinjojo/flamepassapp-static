// &.js - Search and proxy handling for Flamepass
let encodedUrl = '';

async function executeSearch(query, useProxy = null) {
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
		encodedUrl = `https://firewall.flamepass.com/@/index.html?uul=${encodeURIComponent(query)}`;
	} else {
		encodedUrl = query;
	}

	localStorage.setItem('input', query);
	localStorage.setItem('output', encodedUrl);

	document.querySelectorAll('.spinnerParent')[0].style.display = 'block';
	document.querySelectorAll('.spinner')[0].style.display = 'block';
	document.getElementById('gointospace').style.display = 'none';

	const iframe = document.getElementById('intospace');
	iframe.src = encodedUrl;
	iframe.style.display = 'block';

	if (iframe.src) {
		document.querySelector('.shortcuts').style.display = 'none';
		document.querySelector('.shortcutsBig').style.display = 'none';
	}

	document.querySelectorAll('input').forEach(input => input.blur());
}

// History management
let historyArray = JSON.parse(localStorage.getItem('historyArray')) || [];
let currentIndex = parseInt(localStorage.getItem('currentIndex')) || -1;

if (historyArray.length > 0) {
	currentIndex = historyArray.length;
	saveHistory();
}

function saveHistory() {
	localStorage.setItem('historyArray', JSON.stringify(historyArray));
	localStorage.setItem('currentIndex', currentIndex.toString());
}

// Utility functions for navigation
const refreshButton = document.querySelector('.refreshButton');
const homeButton = document.querySelector('.homeButton');
const fullscreenButton = document.querySelector('.fullscreenButton');
const backButton = document.querySelector('.backButton');
const forwardButton = document.querySelector('.forwardButton');

refreshButton.addEventListener('click', function () {
	document.querySelector("#intospace").contentWindow.location.reload();
});

homeButton.addEventListener('click', function () {
	window.location.href = '/&.html';
});

fullscreenButton.addEventListener('click', () => {
	if (document.fullscreenElement) {
		document.exitFullscreen?.() ||
			document.mozCancelFullScreen?.() ||
			document.webkitExitFullscreen?.() ||
			document.msExitFullscreen?.();
	} else {
		const requestFullscreen = element => {
			element.requestFullscreen?.() ||
				element.mozRequestFullScreen?.() ||
				element.webkitRequestFullscreen?.() ||
				element.msRequestFullscreen?.();
		};

		if (!iframe.src || iframe.src === 'about:blank') {
			requestFullscreen(document.documentElement);
		} else {
			requestFullscreen(iframe);
		}
	}
});

backButton.addEventListener('click', function () {
	if (currentIndex > 0) {
		currentIndex--;
		iframe.src = historyArray[currentIndex];
		iframe.style.display = 'block';
		setTimeout(() => {
			document.getElementById('gointospace2').style.paddingLeft = '40px';
		}, 250);
		updateButtonStates();
		saveHistory();
	}
});

forwardButton.addEventListener('click', function () {
	if (currentIndex < historyArray.length - 1) {
		currentIndex++;
		iframe.src = historyArray[currentIndex];
		iframe.style.display = 'block';
		setTimeout(() => {
			document.getElementById('gointospace2').style.paddingLeft = '40px';
		}, 250);
		updateButtonStates();
		saveHistory();
	}
});

function updateButtonStates() {
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

// Process URL parameters on page load
document.addEventListener('DOMContentLoaded', function () {
	const urlParams = new URLSearchParams(window.location.search);
	const queryParam = urlParams.get('q');
	const proxyParam = urlParams.get('proxy');

	if (queryParam) {
		// Use the proxy parameter if specified, otherwise default based on game data
		const useProxy = proxyParam !== null ? proxyParam === 'true' : null;
		executeSearch(queryParam, useProxy);
		document.querySelector('.utilityBar').style.display = 'none';
		document.getElementById('intospace').style.height = '100vh';
		document.getElementById('intospace').style.top = '0';
	} else {
		if (localStorage.getItem('utilBarHidden') === 'true') {
			document.querySelector('.utilityBar').style.display = 'none';
			document.getElementById('intospace').style.height = '100%';
		} else {
			document.querySelector('.utilityBar').style.display = 'block';
			document.getElementById('intospace').style.height =
				'calc(100% - 3.633em)';
		}

		document.querySelector('.pPage').id = 'navactive';
	}
	updateButtonStates();
});