import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Serverless function that serves Open Graph meta tags for shared event links.
 * iMessage, Twitter, Slack, etc. will read these tags to generate rich previews.
 * Regular users get redirected to the SPA which handles the deep link.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.redirect(302, '/');
  }

  // Check if this is a bot/crawler (iMessage, Twitter, Slack, etc.)
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  const isCrawler = /facebookexternalhit|twitterbot|slackbot|linkedinbot|whatsapp|telegrambot|discordbot|applebot|bot|crawler|spider|preview/i.test(ua);

  if (!isCrawler) {
    // Regular user — redirect to the SPA which will scroll to the flyer
    return res.redirect(302, `/?focus=${id}`);
  }

  // Fetch event data from Supabase for OG tags
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://taygiieowkyuhvxmlyeg.supabase.co';
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRheWdpaWVvd2t5dWh2eG1seWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NDMwNjQsImV4cCI6MjA4OTAxOTA2NH0.UOYz-kMqGOpYVEuSIqlKmMr2mtIwIeeN_j7Cqwc1-Sc';

  let title = 'The Pages';
  let description = 'Discover what\'s happening around you';
  let imageUrl = '';
  let dateText = '';
  let location = '';

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/posts?id=eq.${id}&select=title,subtitle,description,date_text,location,image_url,bg_color`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0) {
        const post = data[0];
        title = post.title || 'Event on The Pages';
        const parts = [post.date_text, post.location].filter(Boolean);
        description = post.description || post.subtitle || parts.join(' · ') || 'Discover what\'s happening around you';
        dateText = post.date_text || '';
        location = post.location || '';
        imageUrl = post.image_url || '';
      }
    }
  } catch {
    // Fall back to defaults
  }

  const siteUrl = `https://${req.headers.host || 'thepages.app'}`;
  const eventUrl = `${siteUrl}/event/${id}`;

  // Build subtitle line for display
  const subtitleParts = [dateText, location].filter(Boolean).join(' · ');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — The Pages</title>

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(subtitleParts || description)}" />
  <meta property="og:url" content="${eventUrl}" />
  <meta property="og:site_name" content="The Pages" />
  ${imageUrl ? `<meta property="og:image" content="${escapeHtml(imageUrl)}" />` : ''}
  ${imageUrl ? '<meta property="og:image:width" content="800" />' : ''}
  ${imageUrl ? '<meta property="og:image:height" content="1000" />' : ''}

  <!-- Twitter -->
  <meta name="twitter:card" content="${imageUrl ? 'summary_large_image' : 'summary'}" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(subtitleParts || description)}" />
  ${imageUrl ? `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />` : ''}

  <!-- Redirect non-crawlers to the app -->
  <meta http-equiv="refresh" content="0;url=/?focus=${id}" />
</head>
<body>
  <p>Redirecting to The Pages...</p>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  return res.status(200).send(html);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
