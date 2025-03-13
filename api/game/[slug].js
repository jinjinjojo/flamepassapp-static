export const config = {
    runtime: 'edge',
  };
  
  export default async function handler(req) {
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/');
    
    // Extract slug from URL
    const slug = pathSegments[pathSegments.length - 1];
    
    try {
      // Fetch the game data from your JSON file
      const gamesResponse = await fetch(new URL('/json/g.json', url.origin));
      const games = await gamesResponse.json();
      
      // Find the game that matches the slug
      const game = games.find(g => g.slug === slug);
      
      if (!game) {
        // Game not found - return 404
        return new Response('Game not found', { status: 404 });
      }
      
      // Fetch the game page template
      const templateResponse = await fetch(new URL('/game-page.html', url.origin));
      let template = await templateResponse.text();
      
      // Replace meta tags with game-specific content
      template = template
        .replace(/<title>.*?<\/title>/, `<title>${game.name} - Play Online | Flamepass</title>`)
        .replace(/<meta name="description" content=".*?"/, `<meta name="description" content="Play ${game.name} online for free with Flamepass. No downloads required, works in your browser."`)
        .replace(/<meta property="og:title" content=".*?"/, `<meta property="og:title" content="${game.name} - Play Online | Flamepass"`)
        .replace(/<meta property="og:image" content=".*?"/, `<meta property="og:image" content="${game.img}"`)
        .replace(/<link rel="canonical" href=".*?"/, `<link rel="canonical" href="${url.origin}/game/${slug}"`);
      
      // Add a special data attribute that our client-side JS can use to instantly load the game data
      // This avoids an extra fetch request
      template = template.replace('</head>', `<script>window.GAME_DATA = ${JSON.stringify(game)};</script></head>`);
      
      // Return the HTML with proper headers
      return new Response(template, {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'public, max-age=3600',
        },
      });
    } catch (error) {
      console.error('Error processing game page:', error);
      return new Response('Error loading game page', { status: 500 });
    }
  }