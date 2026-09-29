export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);

      if (url.pathname!== "/product") {
        return fetch(request);
      }

      const FIREBASE_PROJECT_ID = env.FIREBASE_PROJECT_ID;
      const FIREBASE_DATABASE = env.FIREBASE_DATABASE || "(default)";
      const FIREBASE_API_KEY = env.FIREBASE_API_KEY;

      if (!FIREBASE_PROJECT_ID ||!FIREBASE_API_KEY) {
        return fetch(request);
      }

      const rawQuery = url.search.slice(1);

      if (!rawQuery) {
        return fetch(request);
      }

      let slug;

      try {
        slug = decodeURIComponent(rawQuery);
      } catch {
        slug = rawQuery;
      }

      slug = slug.split("&")[0].trim();

      if (!slug) {
        return fetch(request);
      }

      const userAgent = request.headers.get("user-agent") || "";
      const isBot = isPreviewBot(userAgent, url.search);

      if (!isBot) {
        return fetch(request);
      }

      const firestoreUrl =
        `https://firestore.googleapis.com/v1/projects/` +
        `${FIREBASE_PROJECT_ID}/databases/` +
        `${FIREBASE_DATABASE}/documents:runQuery` +
        `?key=${encodeURIComponent(FIREBASE_API_KEY)}`;

      const firestoreQuery = {
        structuredQuery: {
          from: [{ collectionId: "products" }],
          where: {
            compositeFilter: {
              op: "AND",
              filters: [
                {
                  fieldFilter: {
                    field: { fieldPath: "productSlug" },
                    op: "EQUAL",
                    value: { stringValue: slug }
                  }
                },
                {
                  fieldFilter: {
                    field: { fieldPath: "active" },
                    op: "EQUAL",
                    value: { booleanValue: true }
                  }
                }
              ]
            }
          },
          limit: 1
        }
      };

      const response = await fetch(firestoreUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(firestoreQuery)
      });

      if (!response.ok) {
        return fetch(request);
      }

      const result = await response.json();
      const documentResult = result.find(item => item && item.document);

      if (!documentResult) {
        return fetch(request);
      }

      const fields = documentResult.document.fields || {};

      const description =
        getFirestoreValue(fields.productDescription) ||
        "এই প্রোডাক্ট সম্পর্কে বিস্তারিত তথ্য দেখতে ক্লিক করুন।";

      const productName =
        getFirestoreValue(fields.productName) || "SERA PRODUCT";

      const images = getFirestoreArray(fields.image);
      const image =
        images.length > 0
        ? images[0]
          : "https://seraproduct.com/photo/logo.png";

      const html = productPreview({
        productName,
        description,
        image,
        slug
      });

      return htmlResponse(html, 200);
    } catch (error) {
      console.error(error);
      return fetch(request);
    }
  }
};

function isPreviewBot(userAgent, search) {
  const ua = userAgent.toLowerCase();
  if (search.includes("bot=true")) {
    return true;
  }
  const socialBots = [
    "facebookexternalhit",
    "facebookcatalog",
    "whatsapp",
    "twitterbot",
    "linkedinbot",
    "slackbot",
    "telegrambot",
    "discordbot",
    "pinterest",
    "embedly",
    "quora",
    "outbrain",
    "facebot"
  ];
  const searchBots = [
    "googlebot",
    "bingbot",
    "yandex",
    "duckduckbot",
    "baiduspider",
    "google-inspectiontool",
    "googleother"
  ];
  if (searchBots.some(bot => ua.includes(bot))) {
    return false;
  }
  return socialBots.some(bot => ua.includes(bot));
}

function getFirestoreValue(field) {
  if (!field) return null;
  if (field.stringValue!== undefined) return field.stringValue;
  if (field.integerValue!== undefined) return field.integerValue;
  if (field.doubleValue!== undefined) return field.doubleValue;
  if (field.booleanValue!== undefined) return field.booleanValue;
  return null;
}

function getFirestoreArray(field) {
  if (!field ||!field.arrayValue) return [];
  const values = field.arrayValue.values || [];
  return values.map(item => getFirestoreValue(item)).filter(Boolean);
}

function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=UTF-8",
      "cache-control": "public, max-age=60, s-maxage=300"
    }
  });
}

function productPreview({ productName, description, image, slug }) {
  const safeName = escapeHtml(productName);
  const safeDescription = escapeHtml(description);
  const safeImage = escapeHtml(image);
  const canonical = `https://seraproduct.com/product?${encodeURIComponent(slug)}`;

  return `<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeName} | SERA PRODUCT</title>
<meta name="description" content="${safeDescription}">

<!-- Open Graph - সব প্লাটফর্মে টাইটেল আসবে + WhatsApp ছবি ফিক্স -->
<meta property="og:title" content="${safeName}">
<meta property="og:description" content="${safeDescription}">
<meta property="og:image" content="${safeImage}">
<meta property="og:image:secure_url" content="${safeImage}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${escapeHtml(canonical)}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="SERA PRODUCT">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${safeName}">
<meta name="twitter:description" content="${safeDescription}">
<meta name="twitter:image" content="${safeImage}">

<link rel="icon" href="https://seraproduct.com/photo/logo.png">
<style>
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: #f5f5f5;
  font-family: Arial, "Noto Sans Bengali", sans-serif;
  color: #111;
}
.preview {
  width: 100%;
  max-width: 520px;
  background: #fff;
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 10px 35px rgba(0,0,0,.10);
}
.preview-image {
  width: 100%;
  height: 300px;
  object-fit: cover;
  display: block;
  background: #eee;
}
.content { padding: 20px; }
.brand { font-size: 13px; font-weight: 700; color: #ff6a00; margin-bottom: 8px; }
h1 { margin: 0 0 12px; font-size: 21px; line-height: 1.4; }
.description {
  margin: 0;
  color: #555;
  font-size: 15px;
  line-height: 1.7;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.button {
  display: block;
  margin-top: 18px;
  padding: 13px 18px;
  border-radius: 10px;
  text-align: center;
  text-decoration: none;
  background: #ff6a00;
  color: white;
  font-weight: 700;
}
</style>
</head>
<body>
<div class="preview">
  <img class="preview-image" src="${safeImage}" alt="${safeName}">
  <div class="content">
    <div class="brand">SERA PRODUCT</div>
    <h1>${safeName}</h1>
    <p class="description">${safeDescription}</p>
    <a class="button" href="${escapeHtml(canonical)}">প্রোডাক্ট দেখুন</a>
  </div>
</div>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");
}
