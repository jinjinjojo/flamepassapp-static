const address1 = document.getElementById('gointospace');
const address2 = document.getElementById('gointospace2');

const urlPattern = new RegExp(
	'^(https?:\\/\\/)?' +
		'((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' +
		'((\\d{1,3}\\.){3}\\d{1,3}))' +
		'(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' +
		'(\\?[;&a-z\\d%_.~+=-]*)?' +
		'(\\#[-a-z\\d_]*)?$',
	'i'
);

async function executeSearch(query) {
	const encodedUrl = search(query); // search() function will handle query
	localStorage.setItem('input', query);
	localStorage.setItem('output', encodedUrl);

	// This is where we send the search query to the '/@/?uul=...' format
	window.location.href = `/@/?uul=${encodeURIComponent(encodedUrl)}`;
}

function search(input) {
	input = input.trim();
	let searchTemplate;

	// Define search engines for query if it's not a URL
	switch (localStorage.getItem('dropdown-selected-text-searchEngine')) {
		case 'Google':
			searchTemplate = 'https://google.com/search?q=%s';
			break;
		case 'Bing':
			searchTemplate = 'https://bing.com/search?q=%s';
			break;
		case 'Duck Duck Go (default)':
			searchTemplate = 'https://duckduckgo.com/?q=%s';
			break;
		case 'Yahoo!':
			searchTemplate = 'https://search.yahoo.com/search?p=%s';
			break;
		default:
			searchTemplate = 'https://duckduckgo.com/?q=%s';
	}

	// Check if input is a valid URL
	if (urlPattern.test(input)) {
		const url = new URL(input.includes('://') ? input : `http://${input}`);
		return url.toString();
	} else {
		// If not a valid URL, return the search URL
		return searchTemplate.replace('%s', encodeURIComponent(input));
	}
}

// Event listeners for searching via the input fields
address1.addEventListener('keydown', function (event) {
	if (event.key === 'Enter') {
		event.preventDefault();
		let query = address1.value;
		executeSearch(query);
	}
});

address2.addEventListener('keydown', function (event) {
	if (event.key === 'Enter') {
		event.preventDefault();
		let query = address2.value;
		executeSearch(query);
	}
});

// Make it so that if the user goes to /&.html?q= it searches it directly
document.addEventListener('DOMContentLoaded', function () {
	const urlParams = new URLSearchParams(window.location.search);
	const queryParam = urlParams.get('q');
	if (queryParam) {
		executeSearch(queryParam);
		document.querySelector('.utilityBar').style.display = 'none';
		document.getElementById('intospace').style.height = '100vh';
		document.getElementById('intospace').style.top = '0';
	} else {
		// Default UI setup if no query param
		if (localStorage.getItem('utilBarHidden') === 'true') {
			document.querySelector('.utilityBar').style.display = 'none';
			document.getElementById('intospace').style.height = '100%';
		} else {
			document.querySelector('.utilityBar').style.display = 'block';
			document.getElementById('intospace').style.height = 'calc(100% - 3.633em)';
		}
	}
});
