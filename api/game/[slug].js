// api/game/[slug].js
const fs = require('fs');
const path = require('path');

// Helper function to escape special characters for JSON
function escapeForJson(str) {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\f/g, '\\f');
}

export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug) {
    res.status(400).send(getErrorHTML('Invalid Request', 'No game slug provided.'));
    return;
  }

  try {
    // Read from your games JSON file
    const gamesData = JSON.parse(fs.readFileSync(path.join(process.cwd(), '/json/g.json'), 'utf8'));

    // Find the specific game
    const game = gamesData.find(game => game.slug === slug);

    if (!game) {
      res.status(404).send(getErrorHTML('Game Not Found', 'Sorry, we couldn\'t find the game you\'re looking for.'));
      return;
    }

    // Ensure all required properties exist with fallbacks
    const safeGame = {
      name: game.name || 'Unknown Game',
      slug: game.slug || slug,
      img: game.img || '/assets/game-placeholder.jpg',
      description: game.description || `${game.name || 'This game'} is unblocked and playable right from your school or work browser.`,
      category: game.category || 'browser',
      type: game.type || 'html5',
      tags: Array.isArray(game.tags) ? game.tags : [],
      releaseDate: game.releaseDate || null,
      publisher: game.publisher || null,
      serviceProviders: game.serviceProviders || {},
      proxy: game.proxy !== undefined ? game.proxy : false
    };

    // Get random games for SEO links (ensure we have at least 20)
    const otherGames = gamesData.filter(g => g.slug !== slug);
    const randomGames = otherGames.length > 20 
      ? [...otherGames].sort(() => 0.5 - Math.random()).slice(0, 20)
      : otherGames;

    // Read your HTML template
    let htmlTemplate = fs.readFileSync(path.join(process.cwd(), '/game-template.html'), 'utf8');

    // Generate game tags HTML
    let tagsHtml = '';
    if (safeGame.tags && safeGame.tags.length > 0) {
      tagsHtml = safeGame.tags.map(tag => `<span class="game-tag">${escapeForJson(tag)}</span>`).join('');
    } else {
      const defaultTags = [
        safeGame.category ? safeGame.category.charAt(0).toUpperCase() + safeGame.category.slice(1) : 'Browser',
        safeGame.type ? safeGame.type.toUpperCase() : 'Game',
        'Unblocked'
      ];
      tagsHtml = defaultTags.map(tag => `<span class="game-tag">${escapeForJson(tag)}</span>`).join('');
    }

    // Generate metadata HTML
    let metadataHtml = `
      <div class="metadata-item">
        <div class="metadata-icon">
          <i class="fa-solid fa-gamepad"></i>
        </div>
        <div>
          <span class="metadata-label">Category</span>
          <div class="metadata-value">${safeGame.category ? safeGame.category.charAt(0).toUpperCase() + safeGame.category.slice(1) : 'Browser'} Game</div>
        </div>
      </div>
    `;

    if (safeGame.type) {
      metadataHtml += `
        <div class="metadata-item">
          <div class="metadata-icon">
            <i class="fa-solid fa-code"></i>
          </div>
          <div>
            <span class="metadata-label">Type</span>
            <div class="metadata-value">${safeGame.type.toUpperCase()}</div>
          </div>
        </div>
      `;
    }

    if (safeGame.publisher) {
      metadataHtml += `
        <div class="metadata-item">
          <div class="metadata-icon">
            <i class="fa-solid fa-building"></i>
          </div>
          <div>
            <span class="metadata-label">Publisher</span>
            <div class="metadata-value">${escapeForJson(safeGame.publisher)}</div>
          </div>
        </div>
      `;
    }

    if (safeGame.releaseDate) {
      metadataHtml += `
        <div class="metadata-item">
          <div class="metadata-icon">
            <i class="fa-solid fa-calendar"></i>
          </div>
          <div>
            <span class="metadata-label">Release Date</span>
            <div class="metadata-value">${escapeForJson(safeGame.releaseDate)}</div>
          </div>
        </div>
      `;
    }

    // Generate cloud gaming providers HTML if applicable
    let cloudProvidersHtml = '';
    if (safeGame.category === 'cloud' && safeGame.serviceProviders) {
      const providers = Object.keys(safeGame.serviceProviders);
      if (providers.length > 0) {
        cloudProvidersHtml = `
          <div class="cloud-providers">
            <h3>Available on ${providers.length} Cloud Gaming Service${providers.length > 1 ? 's' : ''}</h3>
            <div class="providers-grid">
              ${providers.map(provider => `
                <a href="${safeGame.serviceProviders[provider].url}" target="_blank" rel="noopener noreferrer" class="provider-card">
                  <img src="/assets/providers/${provider.toLowerCase()}.png" alt="${escapeForJson(provider)} logo" />
                  <span>Play on ${escapeForJson(provider)}</span>
                </a>
              `).join('')}
            </div>
          </div>
        `;
      }
    }

    // Prepare title and description based on game category
    const title = safeGame.category === 'cloud' 
      ? `Is ${escapeForJson(safeGame.name)} Playable Through Cloud Gaming?` 
      : safeGame.category === 'emulator'
        ? `Play ${escapeForJson(safeGame.name)} (${safeGame.type.toUpperCase()}) Unblocked Online`
        : `Play ${escapeForJson(safeGame.name)} Unblocked Online With Flamepass!`;

    const description = safeGame.category === 'cloud'
      ? `Yes, ${escapeForJson(safeGame.name)} is playable on cloud gaming. You can play it on ${Object.keys(safeGame.serviceProviders).length} different cloud gaming services including ${Object.keys(safeGame.serviceProviders).join(', ')}. ${escapeForJson(safeGame.description)}`
      : `Play ${escapeForJson(safeGame.name)} unblocked online with Flamepass! ${escapeForJson(safeGame.description)}`;

    // Generate enhanced Schema.org markup
    const schemaMarkup = {
      "@context": "https://schema.org",
      "@type": "VideoGame",
      "name": escapeForJson(safeGame.name),
      "description": description,
      "image": safeGame.img,
      "url": `https://flamepass.net/game/${safeGame.slug}`,
      "inLanguage": "en",
      "applicationCategory": "Game",
      "operatingSystem": "Web Browser",
      "gamePlatform": safeGame.category === 'cloud' 
        ? Object.keys(safeGame.serviceProviders)
        : safeGame.category === 'emulator'
          ? safeGame.type.toUpperCase()
          : "Web Browser"
    };

    // Add optional Schema.org properties
    if (safeGame.releaseDate) {
      schemaMarkup.datePublished = safeGame.releaseDate;
    }

    if (safeGame.publisher) {
      schemaMarkup.publisher = {
        "@type": "Organization",
        "name": escapeForJson(safeGame.publisher)
      };
    }

    if (safeGame.tags && safeGame.tags.length > 0) {
      schemaMarkup.genre = safeGame.tags;
    }

    // Add cloud gaming specific Schema.org properties
    if (safeGame.category === 'cloud' && Object.keys(safeGame.serviceProviders).length > 0) {
      schemaMarkup.offers = Object.entries(safeGame.serviceProviders).map(([provider, details]) => ({
        "@type": "Offer",
        "name": `Play on ${escapeForJson(provider)}`,
        "url": details.url,
        "availability": "https://schema.org/InStock",
        "seller": {
          "@type": "Organization",
          "name": escapeForJson(provider)
        }
      }));
    }

    // Replace all template variables
    const replacements = {
      '${game.name}': escapeForJson(safeGame.name),
      '${game.slug}': safeGame.slug,
      '${game.img}': safeGame.img,
      '${game.description}': escapeForJson(safeGame.description),
      '${game.tags}': tagsHtml,
      '${game.metadata}': metadataHtml,
      '${game.cloudProviders}': cloudProvidersHtml,
      '${randomGames.map(game => `<a href="/game/${game.slug}">${escapeForJson(game.name)}</a>`).join("")}': randomGames.map(game => `<a href="/game/${game.slug}">${escapeForJson(game.name)}</a>`).join(""),
      '${Object.keys(game.serviceProviders || {}).length}': Object.keys(safeGame.serviceProviders).length,
      '${Object.keys(game.serviceProviders || {}).join(", ")}': Object.keys(safeGame.serviceProviders).join(", "),
      '${game.type ? game.type.toUpperCase() : "BROWSER"}': safeGame.type ? safeGame.type.toUpperCase() : "BROWSER",
      '${game.category === "cloud" ? `Is ${game.name} Playable Through Cloud Gaming?` : game.category === "emulator" ? `Play ${game.name} (${game.type.toUpperCase()}) Unblocked Online` : `Play ${game.name} Unblocked Online With Flamepass!`}': title,
      '${game.category === "cloud" ? `Yes, ${game.name} is playable on cloud gaming. You can play it on ${Object.keys(game.serviceProviders || {}).length} different cloud gaming services including ${Object.keys(game.serviceProviders || {}).join(", ")}. ${game.description || ""}` : `Play ${game.name} unblocked online with Flamepass! ${game.description || ""}`}': description,
      '"@context": "https://schema.org"': JSON.stringify(schemaMarkup, null, 2)
    };

    // Apply all replacements
    Object.entries(replacements).forEach(([key, value]) => {
      htmlTemplate = htmlTemplate.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    });

    // Add caching headers for better performance
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400'); // Cache for 1 hour in browser, 24 hours on CDN
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(htmlTemplate);
  } catch (error) {
    console.error('Error generating game page:', error);
    res.status(500).send(getErrorHTML('Server Error', 'There was a problem loading the game details.'));
  }
}

function getErrorHTML(title, message) {
  return `
    <!doctype html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeForJson(title)} - Flamepass</title>
      <link rel="icon" type="icon/x-icon" href="/assets/favicon.ico" />
      <link rel="stylesheet" href="/css/index.css" />
      <link rel="stylesheet" href="/css/themes.css" />
      <link rel="stylesheet" href="/css/common.css" />
    </head>
    <body>
      <div class="error-container">
        <h1>${escapeForJson(title)}</h1>
        <p>${escapeForJson(message)}</p>
        <a href="/g.html" class="error-button">Back to Games</a>
      </div>
    </body>
    </html>
  `;
}