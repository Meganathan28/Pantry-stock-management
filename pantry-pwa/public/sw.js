const CACHE = "pantry-v1";
const ASSETS = ["/", "/index.html", "/manifest.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match("/index.html")))
  );
});

// Background periodic sync for daily notifications
self.addEventListener("periodicsync", e => {
  if (e.tag === "pantry-daily-check") {
    e.waitUntil(checkExpiry());
  }
});

async function checkExpiry() {
  const clients = await self.clients.matchAll();
  // Get items from IndexedDB or send message to client
  const items = await getStoredItems();
  if (!items.length) return;

  const today = new Date(); today.setHours(0,0,0,0);
  const expired = items.filter(i => {
    if (!i.expiryDate) return false;
    const e = new Date(i.expiryDate); e.setHours(0,0,0,0);
    return e < today;
  });
  const expiring = items.filter(i => {
    if (!i.expiryDate) return false;
    const e = new Date(i.expiryDate); e.setHours(0,0,0,0);
    const diff = Math.ceil((e - today) / 864e5);
    return diff >= 0 && diff <= 3;
  });

  if (!expired.length && !expiring.length) return;

  const lines = [];
  if (expired.length) lines.push(`🚨 Expired: ${expired.map(i=>i.name).join(", ")}`);
  if (expiring.length) lines.push(`⚠️ Expiring soon: ${expiring.map(i=>i.name).join(", ")}`);

  self.registration.showNotification("🧺 Pantry Alert", {
    body: lines.join("\n"),
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "pantry-daily",
    renotify: true,
    actions: [{ action: "open", title: "View Items" }]
  });
}

async function getStoredItems() {
  try {
    // Read from localStorage via client message or cache
    return [];
  } catch { return []; }
}

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.openWindow("/"));
});
