class FirebaseImageCache {
  constructor() {
    this.swRegistration = null
    this.serviceWorker = null
    this.init()
  }

  async init() {
    if ('serviceWorker' in navigator) {
      try {
        this.swRegistration = await navigator.serviceWorker.register('/sw.js')
        console.log('Service Worker registered for Firebase image caching')
        
        // Wait for service worker to be ready
        await navigator.serviceWorker.ready
        this.serviceWorker = navigator.serviceWorker.controller || this.swRegistration.active
        
        // Listen for service worker updates
        this.swRegistration.addEventListener('updatefound', () => {
          console.log('Service Worker update found')
        })
        
        // Handle service worker messages
        navigator.serviceWorker.addEventListener('message', (event) => {
          const { type } = event.data
          if (type === 'GET_CACHE_PERMISSION') {
            // Respond with cache permission - you can customize this logic
            const permission = this.getCachePermission()
            event.ports[0].postMessage({ permission })
          }
        })
        
      } catch (error) {
        console.error('Service Worker registration failed:', error)
      }
    }
  }

  // Get cache permission - customize this based on your app's logic
  getCachePermission() {
    // Check if user has granted permission for caching
    // This could be from localStorage, user preferences, etc.
    const permission = localStorage.getItem('cachePermission')
    return permission === 'granted' ? 'granted' : 'denied'
  }

  // Set cache permission
  setCachePermission(granted = true) {
    localStorage.setItem('cachePermission', granted ? 'granted' : 'denied')
    console.log(`Cache permission ${granted ? 'granted' : 'denied'}`)
  }

  // Send message to service worker with improved error handling
  async sendMessageToSW(type, payload = null) {
    if (!this.swRegistration || !this.swRegistration.active) {
      console.warn('Service Worker not available')
      return { error: 'Service Worker not available' }
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel()
      
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data)
      }

      // Handle connection errors
      messageChannel.port1.onmessageerror = (error) => {
        console.error('Message channel error:', error)
        resolve({ error: 'Message channel error' })
      }

      try {
        this.swRegistration.active.postMessage(
          { type, payload },
          [messageChannel.port2]
        )
      } catch (error) {
        console.error('Failed to send message to SW:', error)
        resolve({ error: 'Failed to send message' })
      }

      // Timeout fallback
      setTimeout(() => resolve({ error: 'Timeout' }), 15000)
    })
  }

  // Manually cache Firebase Storage images
  async cacheFirebaseImages(imageUrls) {
    if (!Array.isArray(imageUrls)) {
      imageUrls = [imageUrls]
    }

    // Filter out invalid URLs
    const validUrls = imageUrls.filter(url => this.isFirebaseStorageUrl(url))
    
    if (validUrls.length === 0) {
      return { success: false, error: 'No valid Firebase Storage URLs provided' }
    }

    console.log(`Caching ${validUrls.length} Firebase images:`, validUrls)
    const result = await this.sendMessageToSW('CACHE_FIREBASE_IMAGES', { imageUrls: validUrls })
    
    if (result.results) {
      const successful = result.results.filter(r => r.cached)
      const failed = result.results.filter(r => !r.cached)
      const alreadyCached = result.results.filter(r => r.alreadyCached)
      
      console.log(`Firebase image caching complete:`)
      console.log(`- Successfully cached: ${successful.length - alreadyCached.length}`)
      console.log(`- Already cached: ${alreadyCached.length}`)
      console.log(`- Failed: ${failed.length}`)
      
      if (failed.length > 0) {
        console.warn('Failed to cache images:', failed.map(f => f.url))
      }
      
      return {
        success: successful.length > 0,
        total: validUrls.length,
        cached: successful.length,
        newlyCached: successful.length - alreadyCached.length,
        alreadyCached: alreadyCached.length,
        failed: failed.length,
        results: result.results,
        summary: result.summary
      }
    }
    
    return { success: false, error: result.error }
  }

  // Check cache status for specific Firebase images
  async checkFirebaseImageCache(imageUrls) {
    if (!Array.isArray(imageUrls)) {
      imageUrls = [imageUrls]
    }

    const validUrls = imageUrls.filter(url => this.isFirebaseStorageUrl(url))
    
    if (validUrls.length === 0) {
      return { error: 'No valid Firebase Storage URLs provided' }
    }

    const result = await this.sendMessageToSW('CHECK_FIREBASE_IMAGE_CACHE', { imageUrls: validUrls })
    
    if (result.cacheStatus) {
      const cached = result.cacheStatus.filter(status => status.cached)
      const notCached = result.cacheStatus.filter(status => !status.cached)
      
      return {
        total: validUrls.length,
        cached: cached.length,
        notCached: notCached.length,
        cacheStatus: result.cacheStatus
      }
    }
    
    return { error: result.error }
  }

  // Extract Firebase Storage URLs from events data
  extractFirebaseImageUrls(events) {
    const imageUrls = new Set()
    
    const extractFromObject = (obj, path = '') => {
      if (typeof obj === 'string' && this.isFirebaseStorageUrl(obj)) {
        // Additional check to ensure it's likely an image URL
        if (this.isImageUrl(obj)) {
          imageUrls.add(obj)
        }
      } else if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
        Object.entries(obj).forEach(([key, value]) => {
          extractFromObject(value, path ? `${path}.${key}` : key)
        })
      } else if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          extractFromObject(item, path ? `${path}[${index}]` : `[${index}]`)
        })
      }
    }
    
    if (Array.isArray(events)) {
      events.forEach((event, index) => extractFromObject(event, `events[${index}]`))
    } else {
      extractFromObject(events, 'events')
    }
    
    const urls = Array.from(imageUrls)
    console.log(`Extracted ${urls.length} Firebase image URLs from events data`)
    return urls
  }

  // Check if URL is Firebase Storage
  isFirebaseStorageUrl(url) {
    if (typeof url !== 'string') return false
    
    try {
      const urlObj = new URL(url)
      return urlObj.hostname.includes('firebasestorage.googleapis.com') ||
             urlObj.hostname.includes('storage.googleapis.com')
    } catch {
      return false
    }
  }

  // Check if URL is likely an image
  isImageUrl(url) {
    if (typeof url !== 'string') return false
    
    try {
      const urlObj = new URL(url)
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico']
      return imageExtensions.some(ext => urlObj.pathname.toLowerCase().includes(ext)) ||
             // Check for Firebase Storage image indicators
             urlObj.searchParams.has('alt') && urlObj.searchParams.get('alt') === 'media'
    } catch {
      return false
    }
  }

  // Get comprehensive cache status
  async getCacheStatus() {
    const result = await this.sendMessageToSW('CHECK_CACHE_STATUS')
    
    if (result.error) {
      return { error: result.error }
    }
    
    return {
      hasCache: result.hasCache || false,
      eventCount: result.eventCount || 0,
      lastUpdate: result.lastUpdate,
      cachedAssets: result.cachedAssets || 0,
      cachedFirebaseImages: result.cachedFirebaseImages || 0,
      cacheSize: result.cacheSize || 0,
      assetsVersion: result.assetsVersion,
      discoveredExtensions: result.discoveredExtensions || [],
      assetPaths: result.assetPaths || [],
      firebaseStorageDomains: result.firebaseStorageDomains || []
    }
  }

  // Save events to IndexedDB via service worker
  async saveEvents(events, source = 'FirebaseImageCache') {
    const timestamp = Date.now()
    const result = await this.sendMessageToSW('SAVE_EVENTS', {
      events,
      timestamp,
      source
    })
    
    return result.success || false
  }

  // Get events from IndexedDB via service worker
  async getEvents() {
    const result = await this.sendMessageToSW('GET_EVENTS')
    
    if (result.error) {
      return { error: result.error }
    }
    
    return {
      events: result.events || [],
      lastUpdate: result.lastUpdate,
      eventCount: result.eventCount || 0
    }
  }

  // Clear all caches including Firebase images
  async clearAllCaches() {
    const result = await this.sendMessageToSW('CLEAR_CACHE')
    
    if (result.error) {
      return { success: false, error: result.error }
    }
    
    console.log(`Cleared ${result.clearedItems || 0} cached items`)
    return {
      success: result.success || false,
      clearedItems: result.clearedItems || 0
    }
  }

  // Preload images when events are loaded
  async preloadEventImages(events) {
    const firebaseImageUrls = this.extractFirebaseImageUrls(events)
    
    if (firebaseImageUrls.length === 0) {
      console.log('No Firebase images found in events data')
      return { success: true, cached: 0, message: 'No Firebase images found' }
    }
    
    console.log(`Found ${firebaseImageUrls.length} Firebase images to preload`)
    
    // First check which images are already cached
    const cacheCheck = await this.checkFirebaseImageCache(firebaseImageUrls)
    
    if (cacheCheck.error) {
      console.warn('Failed to check cache status:', cacheCheck.error)
    } else {
      console.log(`Cache status: ${cacheCheck.cached}/${cacheCheck.total} images already cached`)
    }
    
    // Cache all images (service worker will handle duplicates efficiently)
    return await this.cacheFirebaseImages(firebaseImageUrls)
  }

  // Utility method to get cached image URLs
  async getCachedImageUrls() {
    try {
      const cache = await caches.open('firebase-storage-v1')
      const requests = await cache.keys()
      return requests.map(request => request.url)
    } catch (error) {
      console.error('Error getting cached image URLs:', error)
      return []
    }
  }

  // Check if specific image is cached (client-side check)
  async isImageCached(imageUrl) {
    try {
      const cache = await caches.open('firebase-storage-v1')
      const response = await cache.match(imageUrl)
      return !!response
    } catch (error) {
      console.error('Error checking if image is cached:', error)
      return false
    }
  }

  // Get cache size in bytes (approximate)
  async getCacheSize() {
    try {
      const cache = await caches.open('firebase-storage-v1')
      const requests = await cache.keys()
      let totalSize = 0
      
      for (const request of requests) {
        try {
          const response = await cache.match(request)
          if (response && response.headers.get('content-length')) {
            totalSize += parseInt(response.headers.get('content-length'))
          }
        } catch (error) {
          // Ignore individual errors
        }
      }
      
      return {
        bytes: totalSize,
        kb: Math.round(totalSize / 1024),
        mb: Math.round(totalSize / (1024 * 1024)),
        imageCount: requests.length
      }
    } catch (error) {
      console.error('Error calculating cache size:', error)
      return { bytes: 0, kb: 0, mb: 0, imageCount: 0 }
    }
  }

  // Enable caching with user permission
  async enableCaching() {
    this.setCachePermission(true)
    console.log('Firebase image caching enabled')
    return true
  }

  // Disable caching
  async disableCaching() {
    this.setCachePermission(false)
    console.log('Firebase image caching disabled')
    return true
  }

  // Check if caching is enabled
  isCachingEnabled() {
    return this.getCachePermission() === 'granted'
  }
}

// Export the class
export { FirebaseImageCache }