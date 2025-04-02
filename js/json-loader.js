// JSON-loader.js 
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

// Function to manage localStorage size - check if storage is near capacity
function isStorageFull() {
	let total = 0;
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		const value = localStorage.getItem(key);
		total += (key.length + value.length) * 2; // Unicode characters use 2 bytes
	}

	// Estimate remaining space (5MB is typical limit minus a safety margin)
	const maxSize = 4.5 * 1024 * 1024; // ~4.5MB
	return total > maxSize * 0.9; // Return true if using more than 90% of space
}

// Function to clear older cache items to make room
function clearOldCache() {
	const cacheKeys = [];
	// Find all cache keys
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key.startsWith('cache_')) {
			try {
				const item = JSON.parse(localStorage.getItem(key));
				cacheKeys.push({
					key: key,
					timestamp: item.timestamp || 0
				});
			} catch (e) {
				// If item can't be parsed, mark it as old
				cacheKeys.push({
					key: key,
					timestamp: 0
				});
			}
		}
	}

	// Sort by timestamp (oldest first)
	cacheKeys.sort((a, b) => a.timestamp - b.timestamp);

	// Remove oldest items until we have removed at least 30% of cache items
	const itemsToRemove = Math.ceil(cacheKeys.length * 0.3);
	cacheKeys.slice(0, itemsToRemove).forEach(item => {
		localStorage.removeItem(item.key);
	});
}

// Modified openIndexedDB function to create a specific index for games order
function openIndexedDB(dbName, version) {
	return new Promise((resolve, reject) => {
		if (!window.indexedDB) {
			console.warn('IndexedDB not supported');
			resolve(null);
			return;
		}

		const request = indexedDB.open(dbName, version);

		request.onerror = event => {
			console.error(`IndexedDB error:`, event.target.error);
			resolve(null);
		};

		request.onsuccess = event => {
			resolve(event.target.result);
		};

		request.onupgradeneeded = event => {
			const db = event.target.result;

			// For games database, create a special structure with position index
			if (dbName === 'flamepass_games') {
				// Check if store exists
				if (!db.objectStoreNames.contains('items')) {
					// Create store with id as keyPath
					const store = db.createObjectStore('items', { keyPath: 'id' });
				}

				// Create meta store if needed
				if (!db.objectStoreNames.contains('meta')) {
					db.createObjectStore('meta', { keyPath: 'key' });
				}
			} else {
				// For other databases, use standard setup
				if (!db.objectStoreNames.contains('items')) {
					db.createObjectStore('items', { keyPath: 'id' });
				}

				if (!db.objectStoreNames.contains('meta')) {
					db.createObjectStore('meta', { keyPath: 'key' });
				}
			}
		};
	});
}

// Helper function to create a consistent ID for a game
function createGameId(game) {
	return game.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '-');
}

// 1. Modify storeGamesInDB function to use a simpler approach
function storeGamesInDB(db, games) {
	return new Promise((resolve, reject) => {
		if (!db) {
			console.error("DB object is null in storeGamesInDB");
			resolve();
			return;
		}

		console.log("Storing games with order preservation:", games.length, "games");

		try {
			const transaction = db.transaction(['items', 'meta'], 'readwrite');
			const store = transaction.objectStore('items');
			const metaStore = transaction.objectStore('meta');

			// Clear existing data
			store.clear();

			// Create a simple ordered array of game IDs in their original order
			const gameIds = games.map((game, index) => {
				// Ensure each game has a unique ID
				if (!game.id) {
					if (game.slug) {
						game.id = game.slug;
					} else if (game.name) {
						game.id = createGameId(game);
					} else {
						game.id = `game-${Math.random().toString(36).substring(2, 7)}`;
					}
				}

				// Store the original index directly in the game object
				game._originalIndex = index;

				return game.id;
			});

			// Store the simple ordered array of game IDs
			metaStore.put({
				key: 'gamesOrder',
				value: gameIds
			});

			// Update timestamp
			metaStore.put({ key: 'lastUpdate', value: Date.now() });

			// Add all games
			let completed = 0;
			games.forEach(game => {
				const request = store.put(game);

				request.onsuccess = () => {
					completed++;
					if (completed === games.length) {
						console.log(`Completed storing all ${completed} games with order preservation`);
					}
				};

				request.onerror = event => {
					console.error('Error storing game:', event.target.error);
					completed++;
				};
			});

			transaction.oncomplete = () => {
				console.log('Transaction completed: stored games with order preservation');
				resolve();
			};

			transaction.onerror = event => {
				console.error('Transaction error:', event.target.error);
				reject(event.target.error);
			};
		} catch (error) {
			console.error('Error starting transaction:', error);
			reject(error);
		}
	});
}


// 2. Simplify getGamesFromDB function for more reliable operation
function getGamesFromDB(db) {
	return new Promise((resolve, reject) => {
		if (!db) {
			console.error("DB object is null in getGamesFromDB");
			resolve([]);
			return;
		}

		console.log("Retrieving games with order preservation");

		try {
			// First get the order array
			const metaTransaction = db.transaction(['meta'], 'readonly');
			const metaStore = metaTransaction.objectStore('meta');
			const orderRequest = metaStore.get('gamesOrder');

			orderRequest.onsuccess = () => {
				const gameIds = orderRequest.result ? orderRequest.result.value : null;

				if (gameIds && Array.isArray(gameIds)) {
					console.log("Retrieved order array with", gameIds.length, "game IDs");

					// Now get all the games
					const transaction = db.transaction(['items'], 'readonly');
					const store = transaction.objectStore('items');
					const gamesRequest = store.getAll();

					gamesRequest.onsuccess = () => {
						const games = gamesRequest.result;
						console.log("Retrieved", games.length, "games from IndexedDB");

						// Create a map for efficient lookup
						const gamesMap = {};
						games.forEach(game => {
							gamesMap[game.id] = game;
						});

						// Reconstruct the games array in the original order
						const orderedGames = [];

						// First add games in the specified order
						gameIds.forEach(id => {
							if (gamesMap[id]) {
								orderedGames.push(gamesMap[id]);
								// Remove from map to track which games have been added
								delete gamesMap[id];
							}
						});

						// Then add any remaining games not in the order array
						const remainingGames = Object.values(gamesMap);
						if (remainingGames.length > 0) {
							console.log("Adding", remainingGames.length, "games not in the order array");

							// Sort remaining games by _originalIndex if available
							remainingGames.sort((a, b) => {
								if (a._originalIndex !== undefined && b._originalIndex !== undefined) {
									return a._originalIndex - b._originalIndex;
								}
								return 0;
							});

							orderedGames.push(...remainingGames);
						}

						console.log("Final ordered games count:", orderedGames.length);
						resolve(orderedGames);
					};

					gamesRequest.onerror = event => {
						console.error('Error getting games:', event.target.error);
						resolve([]);
					};
				} else {
					// Fallback: try to get games and sort by _originalIndex
					console.warn("No order array found, falling back to _originalIndex sorting");
					const transaction = db.transaction(['items'], 'readonly');
					const store = transaction.objectStore('items');
					const request = store.getAll();

					request.onsuccess = () => {
						const games = request.result;
						if (games.length > 0 && games.some(g => g._originalIndex !== undefined)) {
							const sortedGames = [...games].sort((a, b) => {
								return (a._originalIndex || 0) - (b._originalIndex || 0);
							});
							resolve(sortedGames);
						} else {
							console.warn("No _originalIndex found, returning games in default order");
							resolve(games);
						}
					};

					request.onerror = event => {
						console.error('Error in fallback:', event.target.error);
						resolve([]);
					};
				}
			};

			orderRequest.onerror = event => {
				console.error('Error getting games order:', event.target.error);
				// Fallback to getting games without specific order
				const transaction = db.transaction(['items'], 'readonly');
				const store = transaction.objectStore('items');
				const request = store.getAll();

				request.onsuccess = () => {
					resolve(request.result);
				};

				request.onerror = () => {
					resolve([]);
				};
			};
		} catch (error) {
			console.error('Error in getGamesFromDB:', error);
			resolve([]);
		}
	});
}

// Function specifically for getting games with order preservation
async function getGamesFromDB(db) {
	return new Promise((resolve, reject) => {
		if (!db) {
			resolve([]);
			return;
		}

		try {
			// First get the order array
			const metaTransaction = db.transaction(['meta'], 'readonly');
			const metaStore = metaTransaction.objectStore('meta');
			const orderRequest = metaStore.get('gamesOrder');

			orderRequest.onsuccess = async () => {
				const orderArray = orderRequest.result ? orderRequest.result.value : null;

				// Now get all the games
				const transaction = db.transaction(['items'], 'readonly');
				const store = transaction.objectStore('items');
				const gamesRequest = store.getAll();

				gamesRequest.onsuccess = () => {
					const games = gamesRequest.result;

					// If we have an order array, use it to sort the games
					if (orderArray && Array.isArray(orderArray)) {
						// Create a map of id -> game for efficient lookup
						const gamesMap = {};
						games.forEach(game => {
							gamesMap[game.id] = game;
						});

						// Recreate the games array in the original order
						const orderedGames = orderArray
							.map(id => gamesMap[id])
							.filter(game => game !== undefined); // Filter out any missing games

						// If any games weren't in the order array, add them at the end
						const remainingGames = games.filter(game => !orderArray.includes(game.id));

						resolve([...orderedGames, ...remainingGames]);
					} else {
						// If no order array, just return the games as is
						resolve(games);
					}
				};

				gamesRequest.onerror = event => {
					console.error('Error getting games:', event.target.error);
					resolve([]);
				};
			};

			orderRequest.onerror = event => {
				console.error('Error getting games order:', event.target.error);
				// Fallback: get games without order
				const transaction = db.transaction(['items'], 'readonly');
				const store = transaction.objectStore('items');
				const request = store.getAll();

				request.onsuccess = () => {
					resolve(request.result);
				};

				request.onerror = () => {
					resolve([]);
				};
			};
		} catch (error) {
			console.error('Error in getGamesFromDB:', error);
			resolve([]);
		}
	});
}

// Function to store items in IndexedDB without changing the order
function storeItemsInDB(db, items, storeName) {
	return new Promise((resolve, reject) => {
		if (!db) {
			resolve();
			return;
		}

		// Make sure the store exists before trying to use it
		if (!db.objectStoreNames.contains(storeName)) {
			console.warn(`Store ${storeName} not found in database`);
			resolve();
			return;
		}

		const transaction = db.transaction([storeName, 'meta'], 'readwrite');
		const store = transaction.objectStore(storeName);

		// Clear existing data first
		store.clear();

		// Prepare to count completed operations
		let completed = 0;
		const totalItems = items.length;

		// Handle empty items array
		if (totalItems === 0) {
			// Update timestamp anyway
			const metaStore = transaction.objectStore('meta');
			metaStore.put({ key: 'lastUpdate', value: Date.now() });
			resolve();
			return;
		}

		// Add all items in their original order
		// Use an array index as a position counter to preserve order if needed
		items.forEach((item, index) => {
			// Ensure each item has an ID
			if (!item.id) {
				if (item.slug) {
					item.id = item.slug;
				} else if (item.name) {
					item.id = item.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '-');
				} else {
					item.id = `item-${Math.random().toString(36).substring(2, 7)}`;
				}
			}

			// Add originalIndex property to preserve order if needed
			// We only add this for games to ensure their order is preserved
			if (storeName === 'items' && db.name.includes('games')) {
				item._originalIndex = index;
			}

			const request = store.put(item);

			request.onsuccess = () => {
				completed++;
				if (completed === totalItems) {
					// Also store timestamp for cache expiration
					const metaStore = transaction.objectStore('meta');
					metaStore.put({ key: 'lastUpdate', value: Date.now() });
				}
			};

			request.onerror = event => {
				console.error(`Error storing item in ${storeName}:`, event.target.error);
				// Continue with other items
				completed++;
			};
		});

		transaction.oncomplete = () => {
			console.log(`Transaction completed: stored ${completed} items in ${storeName}`);
			resolve();
		};

		transaction.onerror = event => {
			console.error('Transaction error:', event.target.error);
			reject(event.target.error);
		};
	});
}

// Helper function to get all items from IndexedDB while preserving insertion order
function getAllItemsFromDB(db, storeName) {
	return new Promise((resolve, reject) => {
		if (!db) {
			resolve([]);
			return;
		}

		// Make sure the store exists before trying to use it
		if (!db.objectStoreNames.contains(storeName)) {
			console.warn(`Store ${storeName} not found in database`);
			resolve([]);
			return;
		}

		const transaction = db.transaction([storeName], 'readonly');
		const store = transaction.objectStore(storeName);

		// For games specifically, try to maintain insertion order
		if (db.name === 'flamepass_games' && storeName === 'items') {
			// Use cursor to retrieve in insertion order
			const items = [];
			const cursorRequest = store.openCursor();

			cursorRequest.onsuccess = (event) => {
				const cursor = event.target.result;
				if (cursor) {
					items.push(cursor.value);
					cursor.continue();
				} else {
					// All items collected
					resolve(items);
				}
			};

			cursorRequest.onerror = (event) => {
				console.error(`Error getting items with cursor:`, event.target.error);
				// Fall back to getAll() if cursor fails
				const getAllRequest = store.getAll();
				getAllRequest.onsuccess = () => resolve(getAllRequest.result);
				getAllRequest.onerror = () => resolve([]);
			};
		} else {
			// For non-games data, use regular getAll
			const request = store.getAll();

			request.onsuccess = event => {
				resolve(event.target.result);
			};

			request.onerror = event => {
				console.error(`Error getting items from ${storeName}:`, event.target.error);
				resolve([]);
			};
		}
	});
}

// Function to check if a database exists and has data
async function checkDatabaseExists(dbName) {
	return new Promise((resolve) => {
		const request = indexedDB.open(dbName);
		let dbExists = true;

		request.onupgradeneeded = () => {
			// If onupgradeneeded is called, this means the database didn't exist or version was lower
			dbExists = false;
		};

		request.onsuccess = async () => {
			const db = request.result;

			if (!dbExists) {
				db.close();
				resolve(false);
				return;
			}

			// Check if it has the required object stores
			if (!db.objectStoreNames.contains('items') || !db.objectStoreNames.contains('meta')) {
				db.close();
				resolve(false);
				return;
			}

			// Check if it has any items
			try {
				const transaction = db.transaction(['items'], 'readonly');
				const store = transaction.objectStore('items');
				const countRequest = store.count();

				countRequest.onsuccess = () => {
					const hasData = countRequest.result > 0;
					db.close();
					resolve(hasData);
				};

				countRequest.onerror = () => {
					db.close();
					resolve(false);
				};
			} catch (e) {
				db.close();
				resolve(false);
			}
		};

		request.onerror = () => {
			resolve(false);
		};
	});
}

// Function to load JSON data with caching
async function fetchWithCache(url, cacheKey, useIndexedDB = false) {
	// Return cached data if available in memory
	if (cache[cacheKey]) {
		return cache[cacheKey];
	}

	// Special case for games
	if (cacheKey === 'games' && useIndexedDB) {
		return fetchGames();
	}

	try {
		// Try IndexedDB first if enabled for this resource
		if (useIndexedDB) {
			const dbName = `flamepass_${cacheKey}`;
			const dbExists = await checkDatabaseExists(dbName);

			if (dbExists) {
				const db = await openIndexedDB(dbName, 1);
				if (db) {
					const items = await getAllItemsFromDB(db, 'items');
					if (items && items.length > 0) {
						// Store in memory cache
						cache[cacheKey] = items;

						// Check last update time
						const metaTransaction = db.transaction(['meta'], 'readonly');
						const metaStore = metaTransaction.objectStore('meta');
						const lastUpdateRequest = metaStore.get('lastUpdate');

						lastUpdateRequest.onsuccess = () => {
							const lastUpdate = lastUpdateRequest.result ? lastUpdateRequest.result.value : 0;
							const cacheAge = Date.now() - lastUpdate;

							// If cache is older than 1 hour, refresh in background
							if (cacheAge > 3600000) {
								console.log(`Refreshing ${cacheKey} cache in background...`);
								fetch(url)
									.then(response => response.json())
									.then(newData => {
										// Update cache
										cache[cacheKey] = newData;
										storeItemsInDB(db, newData, 'items');
									})
									.catch(err => console.warn('Background refresh failed:', err));
							}
						};

						return items;
					}
				}
			}
		}

		// Check localStorage as fallback
		const cachedData = localStorage.getItem(`cache_${cacheKey}`);
		if (cachedData) {
			try {
				const { data, timestamp } = JSON.parse(cachedData);
				// Use cache if less than 1 hour old
				if (Date.now() - timestamp < 3600000) {
					cache[cacheKey] = data;

					// If IndexedDB is enabled, store data there for next time
					if (useIndexedDB) {
						const dbName = `flamepass_${cacheKey}`;
						const db = await openIndexedDB(dbName, 1);
						if (db) {
							await storeItemsInDB(db, data, 'items');
						}
					}

					return data;
				}
			} catch (e) {
				console.warn(`Error parsing localStorage cache for ${cacheKey}:`, e);
			}
		}

		// Fetch fresh data from network
		console.log(`Fetching ${cacheKey} from network...`);
		const response = await fetch(url);
		if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

		const data = await response.json();

		// Store in memory cache
		cache[cacheKey] = data;

		// Store in IndexedDB if enabled
		if (useIndexedDB) {
			const dbName = `flamepass_${cacheKey}`;
			const db = await openIndexedDB(dbName, 1);
			if (db) {
				await storeItemsInDB(db, data, 'items');
			}
		}

		// Also store in localStorage as fallback
		try {
			if (isStorageFull()) {
				clearOldCache();
			}

			localStorage.setItem(`cache_${cacheKey}`, JSON.stringify({
				data,
				timestamp: Date.now()
			}));
		} catch (storageError) {
			console.warn('localStorage quota exceeded, using memory cache only', storageError);
			clearOldCache();
			try {
				localStorage.setItem(`cache_${cacheKey}`, JSON.stringify({
					data,
					timestamp: Date.now()
				}));
			} catch (retryError) {
				console.error('Still unable to store in localStorage after cleanup');
			}
		}

		return data;
	} catch (error) {
		console.error(`Error fetching ${url}:`, error);

		// Try to get from memory cache
		if (cache[cacheKey]) {
			return cache[cacheKey];
		}

		// Try to get from IndexedDB
		if (useIndexedDB) {
			try {
				const dbName = `flamepass_${cacheKey}`;
				const db = await openIndexedDB(dbName, 1);
				if (db) {
					const items = await getAllItemsFromDB(db, 'items');
					if (items && items.length > 0) {
						cache[cacheKey] = items;
						return items;
					}
				}
			} catch (dbError) {
				console.warn(`Error retrieving ${cacheKey} from IndexedDB:`, dbError);
			}
		}

		// Try to get from localStorage as last resort
		try {
			const cachedData = localStorage.getItem(`cache_${cacheKey}`);
			if (cachedData) {
				const parsed = JSON.parse(cachedData);
				return parsed.data || [];
			}
		} catch (e) {
			console.warn(`Error retrieving ${cacheKey} from localStorage:`, e);
		}

		return [];
	}
}

// Function to fetch games using the order preservation
async function fetchGames() {
	try {
		// Check memory cache first
		if (cache.games && Array.isArray(cache.games) && cache.games.length > 0) {
			console.log("Returning games from memory cache:", cache.games.length);
			return cache.games;
		}

		// Try IndexedDB with order preservation
		const db = await openIndexedDB('flamepass_games', 1);
		if (db) {
			try {
				// Get games using the order preservation function
				console.log("Attempting to get games from IndexedDB with order preservation");
				const games = await getGamesFromDB(db);

				if (games.length > 0) {
					console.log("Successfully retrieved", games.length, "games from IndexedDB");
					cache.games = games;

					// Check last update time
					const metaTransaction = db.transaction(['meta'], 'readonly');
					const metaStore = metaTransaction.objectStore('meta');
					const lastUpdateRequest = metaStore.get('lastUpdate');

					lastUpdateRequest.onsuccess = () => {
						const lastUpdate = lastUpdateRequest.result ? lastUpdateRequest.result.value : 0;
						const cacheAge = Date.now() - lastUpdate;

						// If cache is older than 1 hour, refresh in background
						if (cacheAge > 3600000) {
							console.log('Cache is old, refreshing games in background...');
							refreshGamesInBackground(db);
						}
					};

					return games;
				}
			} catch (error) {
				console.warn('Error getting games from IndexedDB:', error);
			}
		}

		// Fetch from network
		console.log('Fetching games from network');
		const response = await fetch('/json/g.json');
		if (!response.ok) throw new Error(`Network error: ${response.status}`);

		const data = await response.json();
		console.log('Successfully fetched', data.length, 'games from network');
		console.log('First 5 game names from network:', data.slice(0, 5).map(g => g.name));
		cache.games = data;

		// Store in IndexedDB with order preservation
		if (db) {
			console.log('Storing games in IndexedDB with order preservation');
			await storeGamesInDB(db, data);
		}

		return data;
	} catch (error) {
		console.error('Error in fetchGames:', error);
		return [];
	}
}
// Helper function to refresh games data in background
function refreshGamesInBackground(db) {
	console.log('Refreshing games cache in background...');
	fetch('/json/g.json')
		.then(response => response.json())
		.then(data => {
			console.log('Refresh: Fetched', data.length, 'games from network');
			console.log('Refresh: First 5 game names:', data.slice(0, 5).map(g => g.name));

			// Update memory cache
			cache.games = data;

			try {
				// Store games with order preservation
				storeGamesInDB(db, data);
			} catch (error) {
				console.error('Error in background refresh:', error);
			}
		})
		.catch(error => {
			console.warn('Background refresh failed:', error);
		});
}
// Helper for clearing items
function clearItemsFromDB(db, storeName) {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction([storeName], 'readwrite');
		const store = transaction.objectStore(storeName);
		const request = store.clear();

		request.onsuccess = () => resolve();
		request.onerror = event => {
			console.error('Error clearing items:', event.target.error);
			resolve(); // Resolve anyway to continue
		};
	});
}

// Helper for adding a single item
function addItemToDB(db, storeName, item) {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction([storeName], 'readwrite');
		const store = transaction.objectStore(storeName);
		const request = store.add(item);

		request.onsuccess = () => resolve();
		request.onerror = event => {
			console.error('Error adding item:', event.target.error);
			resolve(); // Resolve anyway to continue
		};
	});
}

// Helper for updating meta
function updateMetaInDB(db, key, value) {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(['meta'], 'readwrite');
		const store = transaction.objectStore('meta');
		const request = store.put({ key, value });

		request.onsuccess = () => resolve();
		request.onerror = event => {
			console.error('Error updating meta:', event.target.error);
			resolve(); // Resolve anyway to continue
		};
	});
}

// Enhanced function to load apps with caching and performance improvements
async function loadApps() {
	try {
		// Attempt to fetch app data with caching
		const data = await fetchWithCache('/json/a.json', 'apps', true);
		const appsContainer = document.querySelector('.appsContainer');

		// Clear existing content
		if (appsContainer) {
			appsContainer.innerHTML = '';

			// Sort apps alphabetically
			data.sort((a, b) => a.name.localeCompare(b.name));

			// Use DocumentFragment for better performance
			const fragment = document.createDocumentFragment();

			// Create app elements
			data.forEach(app => {
				// Create app link
				const appLink = document.createElement('a');
				appLink.href = `/@/index.html?uul=${encodeURIComponent(app.url)}`;

				// Set data attributes for categories and filtering
				if (app.categories && app.name) {
					app.categories.forEach(category => {
						appLink.id = (appLink.id ? appLink.id + ' ' : '') + category;
					});

					// Create standardized class name for the app
					let appNameClass = app.name
						.toLowerCase()
						.replace(/\s+/g, '-')
						.replace(/[^a-z0-9]/g, '-');
					appLink.className = appNameClass;

					// Add data attributes for improved filtering
					appLink.dataset.name = app.name.toLowerCase();
					appLink.dataset.categories = app.categories.join(' ').toLowerCase();
				}

				// Create and configure image
				const appImage = document.createElement('img');
				appImage.src = app.img;
				appImage.alt = app.name || 'App';
				appImage.title = app.name || 'App';
				appImage.className = 'appImage';

				// Fallback for missing images
				appImage.onerror = () => {
					appImage.src = '/assets/default.png';
				};

				// Append elements
				appLink.appendChild(appImage);
				fragment.appendChild(appLink);
			});

			// Append all elements at once for better performance
			appsContainer.appendChild(fragment);

			// Set up search functionality
			setupAppSearch();
			setupScrollToTop();
		}

		return data; // Return data for potential further use
	} catch (error) {
		console.error('Error loading apps:', error);
		const appsContainer = document.querySelector('.appsContainer');

		if (appsContainer) {
			// Display error message to user
			appsContainer.innerHTML = '<p class="error-message">Failed to load apps. Please try again later.</p>';
		}

		// Rethrow for external handling
		throw error;
	}
}

// Set up app search functionality
function setupAppSearch() {
	const appsSearchInput = document.querySelector('.appsSearchInput');
	if (!appsSearchInput) return;

	// Use debounce to improve performance during rapid typing
	let searchTimeout;

	appsSearchInput.addEventListener('input', () => {
		// Clear previous timeout
		clearTimeout(searchTimeout);

		// Set new timeout (200ms debounce)
		searchTimeout = setTimeout(() => {
			// Disable animations during search for better performance
			document.querySelectorAll('.appImage').forEach(image => {
				image.classList.add('no-animation');
			});

			const searchQuery = appsSearchInput.value
				.toLowerCase()
				.trim()
				.replace(/\s+/g, '-')
				.replace(/[^a-z0-9-]/g, '-');

			// Filter apps
			const appLinks = document.querySelectorAll('.appsContainer a');
			let visibleCount = 0;

			appLinks.forEach(link => {
				if (searchQuery === '') {
					link.style.display = '';
					visibleCount++;
				} else if (link.className.includes(searchQuery)) {
					link.style.display = '';
					visibleCount++;
				} else {
					link.style.display = 'none';
				}
			});

			// Re-enable animations after search completes
			setTimeout(() => {
				document.querySelectorAll('.appImage').forEach(image => {
					image.classList.remove('no-animation');
				});
			}, 50);
		}, 200);
	});
}

// Enhanced function to load big shortcuts with caching
async function loadBigShortcuts() {
	try {
		// Attempt to fetch shortcuts data with caching
		const data = await fetchWithCache('/json/sb.json', 'bigShortcuts', true);
		const shortcuts = document.querySelector('.shortcutsBig');

		// Clear existing content
		if (shortcuts) {
			shortcuts.innerHTML = '';

			// Use DocumentFragment for better performance
			const fragment = document.createDocumentFragment();

			// Create shortcut elements
			data.forEach(shortcut => {
				const shortcutLink = document.createElement('a');

				// Special case for settings
				if (shortcut.name.toLowerCase() === 'settings') {
					shortcutLink.href = '/~/#/proxy';
				} else {
					shortcutLink.href = `/@/index.html?uul=${encodeURIComponent(shortcut.url)}`;
				}

				// Create and configure image
				const shortcutImage = document.createElement('img');
				shortcutImage.src = shortcut.img;
				shortcutImage.alt = shortcut.name;
				shortcutImage.title = shortcut.name;

				// Add classes and styles
				shortcutLink.classList.add('shortcutBig');
				shortcutImage.classList.add('shortcutBigimg');
				shortcutImage.style.width = '170px';
				shortcutImage.style.height = '90px';
				shortcutImage.style.padding = '0';
				shortcutImage.style.transition = '0.2s';

				// Update search box styles
				const searchInput = document.getElementById('gointospace');
				if (searchInput) {
					searchInput.style.cssText = 'width: 500px; text-align: left; padding: 15px; margin-right: -0.5rem; padding-left: 49.5px;';
				}

				const searchButton = document.querySelector('.gointospaceSearchButton');
				if (searchButton) {
					searchButton.style.cssText = 'transform: translate(-34px, 3px); user-select: none; cursor: default;';
				}

				// Fallback for missing images
				shortcutImage.onerror = () => {
					shortcutImage.src = '/assets/default.png';
				};

				// Append elements
				shortcutLink.appendChild(shortcutImage);
				fragment.appendChild(shortcutLink);
			});

			// Append all elements at once for better performance
			shortcuts.appendChild(fragment);
		}

		return data; // Return data for potential further use
	} catch (error) {
		console.error('Error loading big shortcuts:', error);
		const shortcuts = document.querySelector('.shortcutsBig');

		if (shortcuts) {
			// Display error message to user
			shortcuts.innerHTML = '<p class="error-message">Failed to load shortcuts.</p>';
		}

		// Rethrow for external handling
		throw error;
	}
}

// Similar function for small shortcuts if needed
async function loadSmallShortcuts() {
	try {
		// Attempt to fetch shortcuts data with caching
		const data = await fetchWithCache('/json/s.json', 'smallShortcuts', true);
		const shortcuts = document.querySelector('.shortcuts');

		if (shortcuts) {
			// Clear existing content
			shortcuts.innerHTML = '';

			// Use DocumentFragment for better performance
			const fragment = document.createDocumentFragment();

			// Create shortcut elements
			data.forEach(shortcut => {
				const shortcutLink = document.createElement('a');

				if (shortcut.name.toLowerCase() === 'settings') {
					shortcutLink.href = '/~/#/proxy';
				} else {
					shortcutLink.href = `/@/index.html?uul=${encodeURIComponent(shortcut.url)}`;
				}

				const shortcutImage = document.createElement('img');
				shortcutImage.src = shortcut.img;
				shortcutImage.alt = shortcut.name;
				shortcutImage.title = shortcut.name;
				shortcutLink.classList.add('shortcut');

				// Fallback for missing images
				shortcutImage.onerror = () => {
					shortcutImage.src = '/assets/default.png';
				};

				shortcutLink.appendChild(shortcutImage);
				fragment.appendChild(shortcutLink);
			});

			// Append all elements at once for better performance
			shortcuts.appendChild(fragment);
		}

		return data;
	} catch (error) {
		console.error('Error loading small shortcuts:', error);
		const shortcuts = document.querySelector('.shortcuts');

		if (shortcuts) {
			shortcuts.innerHTML = '<p class="error-message">Failed to load shortcuts.</p>';
		}

		throw error;
	}
}

// Optimized function to load games page using IndexedDB
async function loadGamesPage() {
	try {
		// Only set up category selector and pagination controls once
		setupCategorySelector();

		// Get games data using the dedicated function for games with order preservation
		const data = await fetchGames();

		// Get current category and page from URL params
		const urlParams = new URLSearchParams(window.location.search);
		const currentCategory = urlParams.get('category') || 'cloud'; // Default to Cloud Gaming
		const currentPage = parseInt(urlParams.get('page') || '1');

		// Continue with the rest of the function as before
		updateActiveCategoryButton(currentCategory);

		// Filter games by category without sorting
		let filteredGames = filterGamesByCategory(data, currentCategory);

		// Do NOT sort games here - we need to maintain the original order from g.json
		// filteredGames = sortGames(filteredGames); // Intentionally commented out

		const gamesPerPage = 50;
		const totalPages = Math.ceil(filteredGames.length / gamesPerPage);
		const startIndex = (currentPage - 1) * gamesPerPage;
		const endIndex = startIndex + gamesPerPage;
		const currentGames = filteredGames.slice(startIndex, endIndex);
		createPaginationControls(currentPage, totalPages, currentCategory);
		renderGames(currentGames, currentCategory, filteredGames);
		setupGameSearchFunction(filteredGames);
		setupRandomGameButton();
		setupScrollToTop();
	} catch (error) {
		console.error('Error loading games: ', error);
	}
}

// Implement the missing setupGameSearch function
function setupGameSearchFunction(games) {
	const searchInput = document.getElementById('gameSearch');
	if (!searchInput) return;

	const gameContainer = document.querySelector('.gameContain');
	if (!gameContainer) return;

	// Clear any previous search results info
	const existingResultsInfo = document.querySelector('.search-results-info');
	if (existingResultsInfo) {
		existingResultsInfo.remove();
	}

	// Set up the input event listener
	searchInput.addEventListener('input', function () {
		const searchValue = this.value.toLowerCase().trim();

		if (!searchValue) {
			// If search is empty, show all games
			const gameLinks = gameContainer.querySelectorAll('.gameAnchor');
			gameLinks.forEach(game => {
				game.style.display = '';
			});

			// Remove any search results info
			const resultsInfo = document.querySelector('.search-results-info');
			if (resultsInfo) {
				resultsInfo.remove();
			}
			return;
		}

		// Filter games based on search
		let matchCount = 0;
		const gameLinks = gameContainer.querySelectorAll('.gameAnchor');

		gameLinks.forEach(game => {
			const gameTitle = game.querySelector('.game-title').textContent.toLowerCase();

			if (gameTitle.includes(searchValue)) {
				game.style.display = '';
				matchCount++;
			} else {
				game.style.display = 'none';
			}
		});

		// Update or create search results info
		let resultsInfo = document.querySelector('.search-results-info');
		if (!resultsInfo) {
			resultsInfo = document.createElement('div');
			resultsInfo.className = 'search-results-info';
			gameContainer.parentNode.insertBefore(resultsInfo, gameContainer);
		}

		// Create clear button
		const clearButton = document.createElement('button');
		clearButton.className = 'clear-search-button';
		clearButton.textContent = 'Clear';
		clearButton.addEventListener('click', () => {
			searchInput.value = '';
			searchInput.dispatchEvent(new Event('input'));
		});

		resultsInfo.innerHTML = `Found ${matchCount} game${matchCount === 1 ? '' : 's'} matching "${searchValue}"`;
		resultsInfo.appendChild(clearButton);
	});
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
		if (category.requiresAuth && !localStorage.getItem("loginData")) {
			buttonContent += `<span class="material-symbols-outlined lock-icon">lock</span>`;
		}

		button.innerHTML = buttonContent;

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

// Memoized sorting function for better performance - NOT USED for games to maintain original order
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
			// Get all games from IndexedDB
			const allGames = await fetchGames();

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
            width: 93%;
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

// Add search results information function
function updateSearchResultsInfo(query, count, container) {
	if (!query) {
		// Remove info if search is empty
		const existingInfo = document.querySelector('.search-results-info');
		if (existingInfo) existingInfo.remove();
		return;
	}

	// Get or create the info element
	let resultsInfo = document.querySelector('.search-results-info');

	if (!resultsInfo) {
		resultsInfo = document.createElement('div');
		resultsInfo.className = 'search-results-info';
		container.parentNode.insertBefore(resultsInfo, container);
	}

	// Create clear button
	const clearButton = document.createElement('button');
	clearButton.className = 'clear-search-button';
	clearButton.textContent = 'Clear';
	clearButton.addEventListener('click', () => {
		const searchInput = document.querySelector('.appsSearchInput, #gameSearch');
		if (searchInput) {
			searchInput.value = '';
			searchInput.dispatchEvent(new Event('input'));
			searchInput.focus();
		}
	});

	// Update info text
	resultsInfo.innerHTML = `Found ${count} ${container.classList.contains('appsContainer') ? 'app' : 'game'}${count === 1 ? '' : 's'} matching "${query}"`;
	resultsInfo.appendChild(clearButton);
}

// Function to check if the device is mobile
function isMobileDevice() {
	return (window.innerWidth <= 768) ||
		(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
}

// Initialize event listeners and add some performance optimizations
document.addEventListener('DOMContentLoaded', () => {
	// Optimize animation performance by disabling them during scroll
	let scrollTimeout;
	window.addEventListener('scroll', () => {
		if (!document.body.classList.contains('is-scrolling')) {
			document.body.classList.add('is-scrolling');
		}

		clearTimeout(scrollTimeout);
		scrollTimeout = setTimeout(() => {
			document.body.classList.remove('is-scrolling');
		}, 200);
	}, { passive: true });

	// Add a style for better scrolling performance
	const perfStyle = document.createElement('style');
	perfStyle.textContent = `
    body.is-scrolling * {
      transition-property: none !important;
      animation: none !important;
    }
  `;
	document.head.appendChild(perfStyle);

	// Optimize for mobile devices
	if (isMobileDevice()) {
		const mobileStyle = document.createElement('style');
		mobileStyle.textContent = `
      .appImage, .gameImage, .shortcutBigimg {
        transform: none !important;
        transition: opacity 0.2s ease !important;
      }
      
      .appImage:hover, .gameImage:hover, .shortcutBigimg:hover {
        opacity: 0.8;
      }
    `;
		document.head.appendChild(mobileStyle);
	}

	// Try to initialize IndexedDB databases for better performance
	Promise.all([
		openIndexedDB('flamepass_games', 1),
		openIndexedDB('flamepass_apps', 1),
		openIndexedDB('flamepass_smallShortcuts', 1),
		openIndexedDB('flamepass_bigShortcuts', 1)
	]).then(() => {
		console.log('IndexedDB databases initialized');
	}).catch(error => {
		console.warn('Error initializing IndexedDB databases:', error);
	});
});

// Export key functions for other scripts to use
window.fetchWithCache = fetchWithCache;
window.fetchGames = fetchGames;
window.openIndexedDB = openIndexedDB;
window.storeItemsInDB = storeItemsInDB;
window.getAllItemsFromDB = getAllItemsFromDB;