// api/game/[slug].js
const fs = require('fs');
const path = require('path');

export default async function handler(req, res) {
  const { slug } = req.query;

  try {
    // Read from your games JSON file
    const gamesData = JSON.parse(fs.readFileSync(path.join(process.cwd(), '/json/g.json'), 'utf8'));

    // Find the specific game
    const game = gamesData.find(game => game.slug === slug);

    if (!game) {
      res.status(404).send(getErrorHTML('Game Not Found', 'Sorry, we couldn\'t find the game you\'re looking for.'));
      return;
    }

    // Read your HTML template
    let htmlTemplate = fs.readFileSync(path.join(process.cwd(), '/game-template.html'), 'utf8');

    // Generate game tags HTML
    let tagsHtml = '';
    if (game.tags && Array.isArray(game.tags) && game.tags.length > 0) {
      tagsHtml = game.tags.map(tag => `<span class="game-tag">${tag}</span>`).join('');
    } else {
      const defaultTags = [
        game.category ? game.category.charAt(0).toUpperCase() + game.category.slice(1) : 'Browser',
        game.genre || 'Game',
        'Unblocked'
      ];
      tagsHtml = defaultTags.map(tag => `<span class="game-tag">${tag}</span>`).join('');
    }

    // Generate metadata HTML
    let metadataHtml = `
      <div class="metadata-item">
        <div class="metadata-icon">
          <i class="fa-solid fa-gamepad"></i>
        </div>
        <div>
          <span class="metadata-label">Category</span>
          <div class="metadata-value">${game.category ? game.category.charAt(0).toUpperCase() + game.category.slice(1) : 'Browser'} Game</div>
        </div>
      </div>
    `;

    if (game.genre) {
      metadataHtml += `
        <div class="metadata-item">
          <div class="metadata-icon">
            <i class="fa-solid fa-tag"></i>
          </div>
          <div>
            <span class="metadata-label">Genre</span>
            <div class="metadata-value">${game.genre}</div>
          </div>
        </div>
      `;
    }

    if (game.publisher) {
      metadataHtml += `
        <div class="metadata-item">
          <div class="metadata-icon">
            <i class="fa-solid fa-building"></i>
          </div>
          <div>
            <span class="metadata-label">Publisher</span>
            <div class="metadata-value">${game.publisher}</div>
          </div>
        </div>
      `;
    }

    // Replace placeholders with actual game data
    htmlTemplate = htmlTemplate
      .replace(/\${game\.name}/g, game.name)
      .replace(/\${game\.slug}/g, game.slug)
      .replace(/\${game\.img}/g, game.img || '/assets/game-placeholder.jpg')
      .replace(/\${game\.description}/g, game.description || `${game.name} is unblocked and playable right from your school or work browser.`)
      .replace('${game.tags}', tagsHtml)
      .replace('${game.metadata}', metadataHtml);

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
      <title>Error - Flamepass</title>
      <link rel="icon" type="icon/x-icon" href="/assets/favicon.ico" />
      <!-- Include your CSS files here -->
      <link rel="stylesheet" href="/css/index.css" />
      <link rel="stylesheet" href="/css/themes.css" />
      <link rel="stylesheet" href="/css/common.css" />
      <link rel="stylesheet" href="/css/game-page.css" />
    </head>
    <body>
      <!-- Include your navbar HTML here -->
      <main class="main-content">
        <div id="game-container" class="game-container">
          <div class="error-message">
            <span class="material-symbols-outlined">error</span>
            <h3>${title}</h3>
            <p>${message}</p>
            <a href="/g.html" class="retry-button">Browse All Games</a>
          </div>
        </div>
      </main>
    </body>
    </html>
  `;
}