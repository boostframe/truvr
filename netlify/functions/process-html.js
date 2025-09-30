'use strict';

const cheerio = require('cheerio');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function extractText($el) {
  const text = $el.text ? $el.text() : ($el || '');
  return (text || '').replace(/\s+/g, ' ').trim();
}

function parse(html, link) {
  const $ = cheerio.load(html);

  // Title
  let productName = extractText($('#productTitle')) || extractText($('title')) || 'Unknown Product';

  // Price
  let price = extractText($('span.aok-offscreen').first()) || extractText($('span.a-offscreen').first());
  if (!price) {
    const allText = $('body').text();
    const m = allText && allText.match(/\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?/);
    price = m ? m[0] : '';
  }

  // SKU from link
  let sku = '';
  if (link) {
    const m = link.match(/\/dp\/([A-Z0-9]{5,})/);
    if (m) sku = m[1];
  }

  // Bullets
  const bullets = [];
  $('#feature-bullets li, #featurebullets_feature_div li').each((_, el) => {
    const t = extractText($(el));
    if (t) bullets.push(t);
  });

  // Images (first 8)
  const photos = [];
  const seen = new Set();
  $('img').each((_, img) => {
    const src = $(img).attr('src');
    if (src && src.startsWith('http') && !seen.has(src)) {
      seen.add(src);
      photos.push(src);
      if (photos.length >= 8) return false;
    }
  });

  // Specifications
  const specs = {};
  $('table').each((_, table) => {
    $(table).find('tr').each((__, tr) => {
      const th = extractText($(tr).find('th').first());
      const td = extractText($(tr).find('td').first());
      if (th && td && specs[th] === undefined) {
        specs[th] = td;
      }
    });
    if (Object.keys(specs).length >= 20) return false;
  });
  if (!Object.keys(specs).length && bullets.length) {
    bullets.slice(0, 10).forEach((b, i) => { specs[`Feature ${i + 1}`] = b; });
  }

  const result = {
    processed_data: {
      product_name: productName,
      price: price,
      other_info: '',
      photo: photos,
      SKU: sku,
      rating: '',
    },
    llm_data: {
      specs: {
        Excerpt1: `Product summary for: ${productName}`,
        Excerpt2: {
          Pros: bullets.slice(0, 5),
          Cons: bullets.length ? [] : ['Limited info'],
        },
        Specifications: Object.keys(specs).length ? specs : { Info: 'No structured specs found' },
      },
    },
    tag_data: {
      Tags: ['amazon', 'product', productName].filter(Boolean),
    },
  };
  return result;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };
  }
  try {
    const body = JSON.parse(event.body || '{}');
    const html = body.html || '';
    const link = body.link || '';
    if (!html) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing html' }) };
    }
    const parsed = parse(html, link);
    // Return in the same shape the extension expects after polling
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ status: 'completed', result: parsed }) };
  } catch (e) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: String(e) }) };
  }
};

