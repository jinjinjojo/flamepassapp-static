let encodedUrl = '';

async function executeSearch(query) {
	encodedUrl = `/@/?uul=${encodeURIComponent(query)}`;
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

// History management (unchanged)
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

// Utility functions for navigation (unchanged)
const refreshButton = document.querySelector('.refreshButton');
const homeButton = document.querySelector('.homeButton');
const fullscreenButton = document.querySelector('.fullscreenButton');
const backButton = document.querySelector('.backButton');
const forwardButton = document.querySelector('.forwardButton');

refreshButton.addEventListener('click', function () {
	iframe.contentWindow.location.reload();
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
if (address1) {
	address1.addEventListener('keydown', function (event) {
		if (event.key === 'Enter') {
			event.preventDefault();
			let query = address1.value;
			executeSearch(query);
		}
	});
}

if (address2) {
	address2.addEventListener('keydown', function (event) {
		if (event.key === 'Enter') {
			event.preventDefault();
			let query = address2.value;
			executeSearch(query);
		}
	});
}

// Make it so that if the user goes to /&.html?q= it searches it
document.addEventListener('DOMContentLoaded', function () {
	const urlParams = new URLSearchParams(window.location.search);
	const queryParam = urlParams.get('q');
	if (queryParam) {
		executeSearch(queryParam);
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
