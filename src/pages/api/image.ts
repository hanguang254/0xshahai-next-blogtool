import type { NextApiRequest, NextApiResponse } from 'next';

const allowedHosts = new Set([
  'cdn.dexscreener.com',
  'assets-cdn.trustwallet.com',
  'iconaves.com',
  'www.iconaves.com',
  'www.logofacade.com',
  'logofacade.com',
]);

const isAllowedUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    return allowedHosts.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const urlParam = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;
  if (!urlParam || typeof urlParam !== 'string' || !isAllowedUrl(urlParam)) {
    res.status(400).send('Invalid image url');
    return;
  }

  const transparentPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=',
    'base64'
  );

  try {
    const response = await fetch(urlParam, {
      headers: {
        'User-Agent': 'memeMap-image-proxy/1.0',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
        res.status(200).send(transparentPng);
        return;
      }
      res.status(response.status).send('Failed to fetch image');
      return;
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await response.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    res.status(200).send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error('Image proxy error:', error);
    res.status(502).send('Image proxy error');
  }
}
