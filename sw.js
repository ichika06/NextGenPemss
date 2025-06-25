const CACHE_NAME = "events-cache-v2"
const ASSETS_CACHE_NAME = "assets-cache-v2"
const FIREBASE_CACHE_NAME = "firebase-storage-v1"
const DB_NAME = "EventsDB"
const DB_VERSION = 1
const EVENTS_STORE = "events"
const METADATA_STORE = "metadata"
const ASSETS_STORE = "assets"

// Critical file extensions to cache dynamically
const CRITICAL_EXTENSIONS = [
  ".html",
  ".js",
  ".css",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
]

// Firebase Storage domains to cache
const FIREBASE_STORAGE_DOMAINS = [
  "firebasestorage.googleapis.com",
  "storage.googleapis.com"
]

// Base paths to scan for assets
const ASSET_PATHS = ["/", "/assets/"]

// Cache configuration
const CACHE_CONFIG = {
  // Maximum age before cache is considered stale (in ms)
  MAX_CACHE_AGE: 30 * 60 * 1000, // 30 minutes
  // Maximum age for Firebase images before background refresh (in ms)
  FIREBASE_MAX_CACHE_AGE: 24 * 60 * 60 * 1000, // 24 hours
  // Network timeout for background updates
  NETWORK_TIMEOUT: 3000, // 3 seconds
  // Preload critical resources immediately
  PRELOAD_CRITICAL: true
}

// In-memory cache for frequently accessed data
let memoryCache = {
  events: null,
  lastUpdate: null,
  assetsMetadata: null,
  initialized: false
}

// Helper function to check if URL is a Firebase Storage URL
const isFirebaseStorageUrl = (url) => {
  try {
    const urlObj = new URL(url)
    return FIREBASE_STORAGE_DOMAINS.some(domain => urlObj.hostname.includes(domain))
  } catch {
    return false
  }
}

// Helper function to check if URL is an image
const isImageUrl = (url) => {
  try {
    const urlObj = new URL(url)
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico']
    return imageExtensions.some(ext => urlObj.pathname.toLowerCase().includes(ext))
  } catch {
    return false
  }
}

// Helper function to check cache permission from client
const checkCachePermission = async () => {
  try {
    const clients = await self.clients.matchAll()
    if (clients.length > 0) {
      return new Promise((resolve) => {
        const messageChannel = new MessageChannel()
        messageChannel.port1.onmessage = (event) => {
          const permission = event.data.permission
          resolve(permission === "granted")
        }

        clients[0].postMessage(
          {
            type: "GET_CACHE_PERMISSION",
          },
          [messageChannel.port2],
        )

        // Timeout fallback - assume permission for faster loading
        setTimeout(() => {
          console.log("⚡ Cache permission timeout - assuming granted for speed")
          resolve(true)
        }, 500) // Reduced timeout for speed
      })
    }
    return true // Default to true for faster initial loading
  } catch (error) {
    console.error("Error checking cache permission:", error)
    return true // Default to true to maintain speed
  }
}

// Initialize memory cache on startup
const initializeMemoryCache = async () => {
  if (memoryCache.initialized) return memoryCache

  try {
    console.log("🚀 Initializing memory cache...")
    const startTime = performance.now()

    // Load events and metadata in parallel
    const [events, lastUpdateMeta, assetsMeta] = await Promise.all([
      getFromIndexedDB(EVENTS_STORE),
      getFromIndexedDB(METADATA_STORE, "lastUpdate"),
      getFromIndexedDB(METADATA_STORE, "assetsVersion")
    ])

    memoryCache = {
      events: events || [],
      lastUpdate: lastUpdateMeta?.value || null,
      assetsMetadata: assetsMeta || null,
      initialized: true,
      loadTime: performance.now() - startTime
    }

    console.log(`✅ Memory cache initialized in ${memoryCache.loadTime.toFixed(2)}ms with ${memoryCache.events.length} events`)
    return memoryCache
  } catch (error) {
    console.error("❌ Error initializing memory cache:", error)
    memoryCache.initialized = true // Mark as initialized even on error
    return memoryCache
  }
}

// Fast cache-first strategy with timeout for network requests
const fetchWithTimeout = async (request, timeout = CACHE_CONFIG.NETWORK_TIMEOUT) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(request, {
      signal: controller.signal,
      cache: "no-cache"
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

// Function to discover assets dynamically (optimized)
const discoverAssets = async () => {
  const discoveredAssets = new Set()

  try {
    // Always cache the main HTML file
    discoveredAssets.add("/index.html")
    discoveredAssets.add("/sw.js")

    // Use faster timeout for asset discovery
    const response = await fetchWithTimeout("/", 2000)
    const html = await response.text()

    // Optimized regex extraction
    const assetRegexes = [
      /<script[^>]+src=['"]([^'"]+)['"][^>]*>/gi,
      /<link[^>]+href=['"]([^'"]+)['"][^>]*>/gi,
      /<img[^>]+src=['"]([^'"]+)['"][^>]*>/gi,
      /url\(['"]?([^'")\s]+)['"]?\)/gi,
      /import\s+['"]([^'"]+)['"]/gi,
    ]

    // Process all regexes in parallel
    const matches = assetRegexes.flatMap(regex => {
      const results = []
      let match
      while ((match = regex.exec(html)) !== null) {
        results.push(match[1])
      }
      return results
    })

    // Filter and normalize URLs
    matches.forEach(assetUrl => {
      if (assetUrl && !assetUrl.startsWith("http") && !assetUrl.startsWith("//")) {
        const normalizedUrl = assetUrl.startsWith("/") ? assetUrl : "/" + assetUrl
        const hasValidExtension = CRITICAL_EXTENSIONS.some(ext =>
          normalizedUrl.toLowerCase().endsWith(ext)
        )

        if (hasValidExtension) {
          discoveredAssets.add(normalizedUrl)
        }
      }
    })
  } catch (error) {
    console.warn("Error discovering assets:", error)
    // Fallback to common assets
    discoveredAssets.add("/index.html")
    discoveredAssets.add("/sw.js")
  }

  const assetArray = Array.from(discoveredAssets)
  console.log(`🔍 Discovered ${assetArray.length} assets`)
  return assetArray
}

// Install event - aggressive caching for speed
self.addEventListener("install", (event) => {
  console.log("⚡ Enhanced Fast Service Worker installing...")

  event.waitUntil(
    (async () => {
      try {
        // Skip permission check during install for faster startup
        const criticalAssets = await discoverAssets()
        const cache = await caches.open(ASSETS_CACHE_NAME)

        // Parallel caching with higher concurrency
        const BATCH_SIZE = 8 // Process 8 assets concurrently
        const batches = []

        for (let i = 0; i < criticalAssets.length; i += BATCH_SIZE) {
          batches.push(criticalAssets.slice(i, i + BATCH_SIZE))
        }

        let successCount = 0
        let failCount = 0

        for (const batch of batches) {
          const batchPromises = batch.map(async (asset) => {
            try {
              const response = await fetchWithTimeout(asset, 2000)
              if (response.ok) {
                await cache.put(asset, response.clone())
                successCount++
                return { asset, cached: true }
              } else {
                failCount++
                return { asset, cached: false, status: response.status }
              }
            } catch (error) {
              failCount++
              return { asset, cached: false, error: error.message }
            }
          })

          await Promise.allSettled(batchPromises)
        }

        console.log(`⚡ Fast cached ${successCount}/${criticalAssets.length} assets (${failCount} failed)`)

        // Save metadata asynchronously (don't block install)
        saveToIndexedDB(METADATA_STORE, {
          key: "assetsVersion",
          value: Date.now(),
          discoveredAssets: criticalAssets,
          successCount,
          failCount
        }).catch(error => console.warn("Metadata save failed:", error))

      } catch (error) {
        console.error("Error during fast install:", error)
      }

      // Initialize memory cache during install
      initializeMemoryCache().catch(error => console.warn("Memory cache init failed:", error))

      self.skipWaiting()
    })(),
  )
})

// Activate event
self.addEventListener("activate", (event) => {
  console.log("⚡ Enhanced Fast Service Worker activating...")

  event.waitUntil(
    (async () => {
      // Clean up old caches in background
      setTimeout(async () => {
        try {
          const cacheNames = await caches.keys()
          await Promise.all(
            cacheNames.map((cacheName) => {
              if (cacheName !== CACHE_NAME && cacheName !== ASSETS_CACHE_NAME && cacheName !== FIREBASE_CACHE_NAME) {
                console.log("🗑️ Deleting old cache:", cacheName)
                return caches.delete(cacheName)
              }
            }),
          )
        } catch (error) {
          console.warn("Cache cleanup failed:", error)
        }
      }, 100) // Delay cleanup to not block activation

      await self.clients.claim()

      // Initialize memory cache if not already done
      if (!memoryCache.initialized) {
        initializeMemoryCache().catch(error => console.warn("Memory cache init failed:", error))
      }
    })(),
  )
})

// Enhanced IndexedDB helper functions (optimized for speed)
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = event.target.result

      if (!db.objectStoreNames.contains(EVENTS_STORE)) {
        const eventsStore = db.createObjectStore(EVENTS_STORE, { keyPath: "id" })
        eventsStore.createIndex("timestamp", "timestamp", { unique: false })
        eventsStore.createIndex("date", "date", { unique: false })
        eventsStore.createIndex("isPublic", "isPublic", { unique: false })
      }

      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE, { keyPath: "key" })
      }

      if (!db.objectStoreNames.contains(ASSETS_STORE)) {
        const assetsStore = db.createObjectStore(ASSETS_STORE, { keyPath: "url" })
        assetsStore.createIndex("timestamp", "timestamp", { unique: false })
        assetsStore.createIndex("type", "type", { unique: false })
      }
    }
  })
}

// Optimized batch save to IndexedDB
const saveToIndexedDB = async (storeName, data) => {
  try {
    const db = await openDB()
    const transaction = db.transaction([storeName], "readwrite")
    const store = transaction.objectStore(storeName)

    if (Array.isArray(data)) {
      const promises = data.map((item) => {
        return new Promise((resolve, reject) => {
          const request = store.put({ ...item, timestamp: Date.now() })
          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error)
        })
      })
      await Promise.all(promises)
    } else {
      await new Promise((resolve, reject) => {
        const request = store.put({ ...data, timestamp: Date.now() })
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    }

    // Update memory cache if it's events data
    if (storeName === EVENTS_STORE && memoryCache.initialized) {
      if (Array.isArray(data)) {
        memoryCache.events = data
      } else {
        // For single event updates
        if (!memoryCache.events) memoryCache.events = []
        const existingIndex = memoryCache.events.findIndex(e => e.id === data.id)
        if (existingIndex >= 0) {
          memoryCache.events[existingIndex] = data
        } else {
          memoryCache.events.push(data)
        }
      }
    }

    return true
  } catch (error) {
    console.error("Error saving to IndexedDB:", error)
    return false
  }
}

// Fast retrieval from IndexedDB with memory cache fallback
const getFromIndexedDB = async (storeName, key = null, filter = null) => {
  try {
    const db = await openDB()
    const transaction = db.transaction([storeName], "readonly")
    const store = transaction.objectStore(storeName)

    if (key) {
      return new Promise((resolve, reject) => {
        const request = store.get(key)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    } else {
      return new Promise((resolve, reject) => {
        const request = store.getAll()
        request.onsuccess = () => {
          let result = request.result
          if (filter && typeof filter === "function") {
            result = result.filter(filter)
          }
          resolve(result)
        }
        request.onerror = () => reject(request.error)
      })
    }
  } catch (error) {
    console.error("Error getting from IndexedDB:", error)
    return null
  }
}

// Enhanced clear function
const clearIndexedDB = async (storeName, condition = null) => {
  try {
    const db = await openDB()
    const transaction = db.transaction([storeName], "readwrite")
    const store = transaction.objectStore(storeName)

    if (condition) {
      const allData = await new Promise((resolve, reject) => {
        const request = store.getAll()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      const itemsToDelete = allData.filter(condition)
      const deletePromises = itemsToDelete.map((item) => {
        return new Promise((resolve, reject) => {
          const request = store.delete(item.id || item.key || item.url)
          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error)
        })
      })

      await Promise.all(deletePromises)
    } else {
      await new Promise((resolve, reject) => {
        const request = store.clear()
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    }

    // Clear memory cache if clearing events
    if (storeName === EVENTS_STORE) {
      memoryCache.events = []
      memoryCache.lastUpdate = null
    }

    return true
  } catch (error) {
    console.error("Error clearing IndexedDB:", error)
    return false
  }
}

// Ultra-fast fetch event handler with cache-first strategy
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  const isFirebaseImage = isFirebaseStorageUrl(request.url) && isImageUrl(request.url)
  const isCriticalAsset =
    CRITICAL_EXTENSIONS.some((ext) => url.pathname.toLowerCase().endsWith(ext)) &&
    (url.origin === self.location.origin ||
      ASSET_PATHS.some((path) => url.pathname.startsWith(path)))

  if (isCriticalAsset || isFirebaseImage) {
    event.respondWith(
      (async () => {
        // CACHE-FIRST STRATEGY - Always serve from cache immediately if available
        let cacheToUse = isFirebaseImage ? FIREBASE_CACHE_NAME : ASSETS_CACHE_NAME
        const cache = await caches.open(cacheToUse)
        const cachedResponse = await cache.match(request)

        if (cachedResponse) {
          console.log(`⚡ INSTANT cache hit: ${request.url}`)

          // Check if cache is stale and needs background refresh
          const cacheDate = cachedResponse.headers.get('date')
          const cacheAge = cacheDate ? Date.now() - new Date(cacheDate).getTime() : 0
          const maxAge = isFirebaseImage ? CACHE_CONFIG.FIREBASE_MAX_CACHE_AGE : CACHE_CONFIG.MAX_CACHE_AGE

          if (cacheAge > maxAge) {
            // Background refresh for stale cache
            event.waitUntil(
              (async () => {
                try {
                  console.log(`🔄 Background refresh: ${request.url}`)
                  const networkResponse = await fetchWithTimeout(request)
                  if (networkResponse.ok) {
                    await cache.put(request, networkResponse.clone())
                    console.log(`✅ Background updated: ${request.url}`)
                  }
                } catch (error) {
                  console.warn(`❌ Background refresh failed: ${request.url}`)
                }
              })()
            )
          }

          return cachedResponse
        }

        // Not in cache - fetch from network and cache
        try {
          console.log(`🌐 Network fetch: ${request.url}`)
          const networkResponse = await fetchWithTimeout(request)

          if (networkResponse.ok) {
            // Cache the response
            const responseToCache = networkResponse.clone()
            cache.put(request, responseToCache).catch(error => {
              console.warn(`Cache put failed for ${request.url}:`, error)
            })
            console.log(`💾 Cached: ${request.url}`)
          }

          return networkResponse
        } catch (error) {
          console.error(`❌ Network failed: ${request.url}`, error)

          // Return appropriate offline fallbacks
          if (isFirebaseImage) {
            return new Response(
              `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
                <rect width="200" height="200" fill="#f5f5f5" stroke="#ddd" stroke-width="2"/>
                <text x="100" y="90" text-anchor="middle" font-family="Arial" font-size="12" fill="#999">
                  Image unavailable
                </text>
                <text x="100" y="110" text-anchor="middle" font-family="Arial" font-size="10" fill="#999">
                  Loading offline...
                </text>
              </svg>`,
              {
                status: 503,
                headers: {
                  "Content-Type": "image/svg+xml",
                  "Cache-Control": "no-cache"
                },
              }
            )
          }

          if (url.pathname.endsWith(".html")) {
            return new Response(
              `<!DOCTYPE html>
              <html>
                <head>
                  <title>Offline</title>
                  <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
                    .offline { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 400px; margin: 0 auto; }
                    h1 { color: #333; margin-bottom: 1rem; }
                    p { color: #666; line-height: 1.5; }
                  </style>
                </head>
                <body>
                  <div class="offline">
                    <h1>⚡ You're Offline</h1>
                    <p>This page is not available offline. Please check your connection and try again.</p>
                  </div>
                </body>
              </html>`,
              {
                status: 503,
                headers: { "Content-Type": "text/html" },
              }
            )
          }

          return new Response("Offline - Resource not available", {
            status: 503,
            statusText: "Service Unavailable",
          })
        }
      })(),
    )
  }
})

// Enhanced message handler with memory cache
self.addEventListener("message", async (event) => {
  const { type, payload } = event.data

  try {
    switch (type) {
      case "GET_CACHE_PERMISSION":
        event.ports[0].postMessage({ permission: "granted" })
        break

      case "SAVE_EVENTS":
        const startTime = performance.now()
        const saved = await saveToIndexedDB(EVENTS_STORE, payload.events)
        await saveToIndexedDB(METADATA_STORE, {
          key: "lastUpdate",
          value: payload.timestamp || Date.now(),
          source: payload.source || "unknown",
          eventCount: Array.isArray(payload.events) ? payload.events.length : 1,
        })

        // Update memory cache immediately
        memoryCache.lastUpdate = payload.timestamp || Date.now()

        const saveTime = performance.now() - startTime
        console.log(`⚡ Saved events in ${saveTime.toFixed(2)}ms`)

        event.ports[0].postMessage({
          success: saved,
          saveTime: saveTime
        })
        break

      case "GET_EVENTS":
        const getStartTime = performance.now()

        // Try memory cache first for ultra-fast response
        if (memoryCache.initialized && memoryCache.events) {
          const memoryTime = performance.now() - getStartTime
          console.log(`⚡ INSTANT memory cache response in ${memoryTime.toFixed(2)}ms`)

          event.ports[0].postMessage({
            events: memoryCache.events,
            lastUpdate: memoryCache.lastUpdate,
            eventCount: memoryCache.events.length,
            source: "memory",
            loadTime: memoryTime
          })
          break
        }

        // Fallback to IndexedDB if memory cache not available
        await initializeMemoryCache()
        const events = memoryCache.events || await getFromIndexedDB(EVENTS_STORE)
        const metadata = memoryCache.lastUpdate || (await getFromIndexedDB(METADATA_STORE, "lastUpdate"))?.value

        const getTime = performance.now() - getStartTime
        console.log(`📱 Retrieved events in ${getTime.toFixed(2)}ms`)

        event.ports[0].postMessage({
          events: events || [],
          lastUpdate: metadata || null,
          eventCount: events ? events.length : 0,
          source: "indexeddb",
          loadTime: getTime
        })
        break

      case "CLEAR_CACHE":
        const clearStartTime = performance.now()

        const eventsCleared = await clearIndexedDB(EVENTS_STORE)
        const metadataCleared = await clearIndexedDB(METADATA_STORE)

        // Clear all caches in parallel
        const cacheNames = [ASSETS_CACHE_NAME, CACHE_NAME, FIREBASE_CACHE_NAME]
        const clearPromises = cacheNames.map(async (cacheName) => {
          try {
            const cache = await caches.open(cacheName)
            const keys = await cache.keys()
            await Promise.all(keys.map(request => cache.delete(request)))
            return keys.length
          } catch (error) {
            console.error(`❌ Error clearing cache ${cacheName}:`, error)
            return 0
          }
        })

        const clearResults = await Promise.all(clearPromises)
        const totalCleared = clearResults.reduce((sum, count) => sum + count, 0)

        const clearTime = performance.now() - clearStartTime
        console.log(`🗑️ Cleared cache in ${clearTime.toFixed(2)}ms`)

        event.ports[0].postMessage({
          success: eventsCleared && metadataCleared,
          clearedItems: totalCleared,
          clearTime: clearTime
        })
        break

      case "CHECK_CACHE_STATUS":
        const stats = await getCacheStats()
        event.ports[0].postMessage({
          hasCache: stats.eventCount > 0,
          ...stats,
        })
        break

      case "CACHE_FIREBASE_IMAGES":
        if (payload.imageUrls && Array.isArray(payload.imageUrls)) {
          const cache = await caches.open(FIREBASE_CACHE_NAME)
          const results = []

          // Process images in parallel batches for speed
          const BATCH_SIZE = 6
          const batches = []

          for (let i = 0; i < payload.imageUrls.length; i += BATCH_SIZE) {
            batches.push(payload.imageUrls.slice(i, i + BATCH_SIZE))
          }

          for (const batch of batches) {
            const batchPromises = batch.map(async (imageUrl) => {
              try {
                const cachedResponse = await cache.match(imageUrl)

                if (cachedResponse) {
                  return { url: imageUrl, cached: true, alreadyCached: true }
                }

                const response = await fetchWithTimeout(imageUrl, 5000)

                if (response.ok) {
                  await cache.put(imageUrl, response.clone())
                  return { url: imageUrl, cached: true, alreadyCached: false }
                } else {
                  return { url: imageUrl, cached: false, status: response.status }
                }
              } catch (error) {
                return { url: imageUrl, cached: false, error: error.message }
              }
            })

            const batchResults = await Promise.allSettled(batchPromises)
            results.push(...batchResults.map(r => r.status === 'fulfilled' ? r.value : { cached: false, error: 'Promise rejected' }))
          }

          const summary = {
            total: payload.imageUrls.length,
            newlyCached: results.filter(r => r.cached && !r.alreadyCached).length,
            alreadyCached: results.filter(r => r.alreadyCached).length,
            failed: results.filter(r => !r.cached).length
          }

          console.log(`⚡ Firebase caching: ${summary.newlyCached} new, ${summary.alreadyCached} existing, ${summary.failed} failed`)

          event.ports[0].postMessage({ results, summary })
        } else {
          event.ports[0].postMessage({ error: "No image URLs provided" })
        }
        break

      case "CHECK_FIREBASE_IMAGE_CACHE":
        if (payload.imageUrls && Array.isArray(payload.imageUrls)) {
          const cache = await caches.open(FIREBASE_CACHE_NAME)
          const cacheStatus = await Promise.all(
            payload.imageUrls.map(async (imageUrl) => {
              try {
                const cachedResponse = await cache.match(imageUrl)
                return {
                  url: imageUrl,
                  cached: !!cachedResponse,
                  cacheDate: cachedResponse ? cachedResponse.headers.get('date') : null
                }
              } catch (error) {
                return {
                  url: imageUrl,
                  cached: false,
                  error: error.message
                }
              }
            })
          )

          event.ports[0].postMessage({ cacheStatus })
        } else {
          event.ports[0].postMessage({ error: "No image URLs provided" })
        }
        break

      default:
        event.ports[0].postMessage({ error: "Unknown message type: " + type })
    }
  } catch (error) {
    console.error("❌ Service Worker error:", error)
    event.ports[0].postMessage({ error: error.message })
  }
})

// Get enhanced cache statistics
const getCacheStats = async () => {
  try {
    const startTime = performance.now()

    // Use memory cache if available for faster stats
    let eventCount = 0
    let lastUpdate = null

    if (memoryCache.initialized) {
      eventCount = memoryCache.events ? memoryCache.events.length : 0
      lastUpdate = memoryCache.lastUpdate
    } else {
      const events = await getFromIndexedDB(EVENTS_STORE)
      const metadata = await getFromIndexedDB(METADATA_STORE, "lastUpdate")
      eventCount = events ? events.length : 0
      lastUpdate = metadata?.value || null
    }

    const assetMetadata = await getFromIndexedDB(METADATA_STORE, "assetsVersion")

    // Get cache sizes in parallel
    const [assetsCache, firebaseCache] = await Promise.all([
      caches.open(ASSETS_CACHE_NAME),
      caches.open(FIREBASE_CACHE_NAME)
    ])

    const [cachedRequests, cachedFirebaseImages] = await Promise.all([
      assetsCache.keys(),
      firebaseCache.keys()
    ])

    const statsTime = performance.now() - startTime

    return {
      eventCount,
      lastUpdate,
      cacheSize: eventCount * 100, // Approximate size
      assetsVersion: assetMetadata?.value || null,
      cachedAssets: cachedRequests.length,
      cachedFirebaseImages: cachedFirebaseImages.length,
      discoveredExtensions: CRITICAL_EXTENSIONS,
      assetPaths: ASSET_PATHS,
      firebaseStorageDomains: FIREBASE_STORAGE_DOMAINS,
      memoryCache: {
        initialized: memoryCache.initialized,
        loadTime: memoryCache.loadTime || 0
      },
      statsTime: statsTime
    }
  } catch (error) {
    console.error("❌ Error getting cache stats:", error)
    return {
      eventCount: 0,
      lastUpdate: null,
      cacheSize: 0,
      assetsVersion: null,
      cachedAssets: 0,
      cachedFirebaseImages: 0,
      discoveredExtensions: CRITICAL_EXTENSIONS,
      assetPaths: ASSET_PATHS,
      firebaseStorageDomains: FIREBASE_STORAGE_DOMAINS,
    }
  }
}