// Pure helpers for /go/<name>, kept apart from the Worker so `node --test` can load them.

// People type links off posters: phones capitalise, people add a slash.
export function normaliseName(s) {
  return s.toLowerCase().replace(/\/$/, "");
}

// Where a campaign name sends people. Unknown names go to the home page.
export function resolve(name, campaigns, base) {
  if (!Object.hasOwn(campaigns, name)) return { url: new URL("/", base).href, known: 0 };
  const url = new URL(campaigns[name], base);
  if (url.hostname !== "apps.apple.com") return { url: url.href, known: 1 };
  url.searchParams.set("ct", name); // so Apple's campaign report lines up with ours
  return { url: url.href, known: 1 };
}

export function device(ua = "") {
  if (/iPad/i.test(ua)) return "ipad";
  if (/iPhone|iPod/i.test(ua)) return "iphone";
  if (/Android/i.test(ua)) return "android";
  if (/Windows|Macintosh|X11|CrOS|Linux/i.test(ua)) return "desktop";
  return "other";
}

// Link-preview fetchers open every link pasted into a chat or post. "bot" covers
// Twitterbot, Slackbot, TelegramBot, Discordbot, LinkedInBot, Applebot and Googlebot.
export function isBot(ua = "") {
  return /bot|crawler|spider|facebookexternalhit|whatsapp/i.test(ua) ? 1 : 0;
}

// The referring site's host only, never the full URL.
export function referrerHost(ref) {
  try {
    return new URL(ref).hostname || null;
  } catch {
    return null;
  }
}
