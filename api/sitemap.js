export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const url = new URL(req.url);
  const siteUrl = url.origin;

  try {
    // Fetch the game data from your JSON file
    const gamesResponse = await fetch(new URL('/json/g.json', siteUrl));
    const games = await gamesResponse.json();

    // Generate sitemap XML content
    let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
    sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Add homepage
    sitemap += `  <url>\n    <loc>${siteUrl}/</loc>\n    <priority>1.0</priority>\n  </url>\n`;

    // Add main games page
    sitemap += `  <url>\n    <loc>${siteUrl}/g.html</loc>\n    <priority>0.9</priority>\n  </url>\n`;

    // Add individual game pages
    games.forEach(game => {
      if (game.slug) {
        sitemap += `  <url>\n    <loc>${siteUrl}/game/${game.slug}</loc>\n    <priority>0.8</priority>\n  </url>\n`;
      }
    });

    // Add other important pages
    const otherPages = [
      '/a.html',
      '/&amp;.html', // Fixed: Properly escaped the ampersand
      '/downloadable-games.html',
      '/ultimate-links.html',
      '/links.html',
      '/guides.html',
      '/yt-channels.html',
      '/ai.html'
    ];

    otherPages.forEach(page => {
      sitemap += `  <url>\n    <loc>${siteUrl}${page}</loc>\n    <priority>0.7</priority>\n  </url>\n`;
    });

    sitemap += '</urlset>';

    // Return the sitemap XML with proper headers
    return new Response(sitemap, {
      headers: {
        'content-type': 'application/xml',
        'cache-control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Error generating sitemap:', error);
    return new Response('Error generating sitemap', { status: 500 });
  }
}