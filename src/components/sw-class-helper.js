// Service Worker Client Helper
class ServiceWorkerManager {
  constructor() {
    this.sw = null
    this.isReady = false
    this.updateCallbacks = []
    this.init()
  }

  async init() {
    if ('serviceWorker' in navigator) {
      try {
        // Register service worker
        const registration = await navigator.serviceWorker.register('/sw.js')
        console.log('Service Worker registered:', registration)

        // Wait for service worker to be ready
        await navigator.serviceWorker.ready
        this.sw = navigator.serviceWorker
        this.isReady = true

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          this.handleServiceWorkerMessage(event.data)
        })

        // Check for updates on load
        setTimeout(() => {
          this.checkForAssetUpdates()
        }, 2000) // Wait 2 seconds after load

        // Register for periodic updates if supported
        if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
          registration.sync.register('asset-update').catch(console.warn)
        }

        // Setup periodic sync if available
        if ('periodicSync' in registration) {
          try {
            await registration.periodicSync.register('asset-update', {
              minInterval: 24 * 60 * 60 * 1000, // 24 hours
            })
          } catch (error) {
            console.warn('Periodic sync not available:', error)
          }
        }

      } catch (error) {
        console.error('Service Worker registration failed:', error)
      }
    } else {
      console.warn('Service Workers not supported')
    }
  }

  handleServiceWorkerMessage(data) {
    switch (data.type) {
      case 'ASSETS_UPDATED':
        console.log('Assets updated:', data.updatedAssets)
        console.log(`Total assets: ${data.totalAssets}`)
        this.notifyUpdateCallbacks('assets', {
          updatedAssets: data.updatedAssets,
          totalAssets: data.totalAssets
        })
        break
      default:
        console.log('SW message:', data)
    }
  }

  // Register callback for updates
  onUpdate(callback) {
    this.updateCallbacks.push(callback)
  }

  notifyUpdateCallbacks(type, data) {
    this.updateCallbacks.forEach(callback => {
      try {
        callback(type, data)
      } catch (error) {
        console.error('Update callback error:', error)
      }
    })
  }

  // Send message to service worker
  async sendMessage(type, payload = {}) {
    if (!this.isReady) {
      throw new Error('Service Worker not ready')
    }

    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel()
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data.error) {
          reject(new Error(event.data.error))
        } else {
          resolve(event.data)
        }
      }

      this.sw.controller.postMessage(
        { type, payload },
        [messageChannel.port2]
      )
    })
  }

  // Event-related methods
  async saveEvents(events, source = 'client') {
    return this.sendMessage('SAVE_EVENTS', {
      events,
      timestamp: Date.now(),
      source
    })
  }

  async getEvents() {
    return this.sendMessage('GET_EVENTS')
  }

  async getEventsFiltered(filter) {
    return this.sendMessage('GET_EVENTS_FILTERED', { filter })
  }

  async updateEvent(event) {
    return this.sendMessage('UPDATE_EVENT', { event })
  }

  async deleteEvent(eventId) {
    return this.sendMessage('DELETE_EVENT', { eventId })
  }

  // Cache management methods
  async clearCache() {
    return this.sendMessage('CLEAR_CACHE')
  }

  async clearExpired(maxAge = 24 * 60 * 60 * 1000) {
    return this.sendMessage('CLEAR_EXPIRED', { maxAge })
  }

  async getCacheStatus() {
    return this.sendMessage('CHECK_CACHE_STATUS')
  }

  // Asset management methods
  async checkForAssetUpdates() {
    try {
      const result = await this.sendMessage('CHECK_ASSET_UPDATES')
      console.log('Asset update check completed:', result)
      return result
    } catch (error) {
      console.error('Failed to check for asset updates:', error)
      return { success: false, error: error.message }
    }
  }

  async forceAssetRefresh() {
    try {
      const result = await this.sendMessage('FORCE_ASSET_REFRESH')
      console.log('Asset refresh completed:', result)
      
      // Optionally reload the page after refresh
      if (result.success && result.refreshed) {
        setTimeout(() => {
          if (confirm('Assets have been updated. Reload the page to apply changes?')) {
            window.location.reload()
          }
        }, 1000)
      }
      
      return result
    } catch (error) {
      console.error('Failed to refresh assets:', error)
      return { success: false, error: error.message }
    }
  }

  async getAssetStatus() {
    return this.sendMessage('GET_ASSET_STATUS')
  }

  // Utility methods
  isOnline() {
    return navigator.onLine
  }

  // Show loading states
  showLoadingIndicator(message = 'Loading...') {
    // You can customize this based on your UI framework
    const indicator = document.createElement('div')
    indicator.id = 'sw-loading'
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #007bff;
      color: white;
      padding: 10px 15px;
      border-radius: 5px;
      z-index: 10000;
      font-size: 14px;
    `
    indicator.textContent = message
    document.body.appendChild(indicator)
    return indicator
  }

  hideLoadingIndicator() {
    const indicator = document.getElementById('sw-loading')
    if (indicator) {
      indicator.remove()
    }
  }

  // Fast load strategy
  async fastLoad() {
    const loadingIndicator = this.showLoadingIndicator('Loading from cache...')
    
    try {
      // Get cached events first for immediate display
      const cachedData = await this.getEvents()
      
      // Hide loading indicator
      this.hideLoadingIndicator()
      
      // Return cached data immediately
      if (cachedData.events && cachedData.events.length > 0) {
        console.log(`Loaded ${cachedData.events.length} events from cache`)
        
        // Check for updates in background
        setTimeout(async () => {
          try {
            await this.checkForAssetUpdates()
            // You can add logic here to fetch fresh data from your API
            // and update the cache if needed
          } catch (error) {
            console.warn('Background update failed:', error)
          }
        }, 1000)
        
        return {
          data: cachedData.events,
          fromCache: true,
          lastUpdate: cachedData.lastUpdate
        }
      } else {
        // No cache available, need to fetch from network
        return {
          data: [],
          fromCache: false,
          needsNetworkFetch: true
        }
      }
    } catch (error) {
      this.hideLoadingIndicator()
      console.error('Fast load failed:', error)
      return {
        data: [],
        fromCache: false,
        error: error.message
      }
    }
  }
}

// Usage example and initialization
const swManager = new ServiceWorkerManager()

// Register for update notifications
swManager.onUpdate((type, data) => {
  if (type === 'assets') {
    // Show a notification to user about updates
    console.log(`New updates available for ${data.updatedAssets.length}/${data.totalAssets} assets:`, data.updatedAssets)
    
    // You could show a toast notification here
    // showToast(`${data.updatedAssets.length} files updated! Refresh for new features.`)
  }
})

// Expose globally for easy access
window.swManager = swManager

// Example usage in your app
async function initializeApp() {
  try {
    // Fast load cached data
    const result = await swManager.fastLoad()
    
    if (result.fromCache) {
      // Display cached data immediately
      console.log('Displaying cached data:', result.data)
      // renderEvents(result.data)
      
      // Optionally show cache age
      if (result.lastUpdate) {
        const cacheAge = Date.now() - result.lastUpdate
        const minutes = Math.floor(cacheAge / (1000 * 60))
        console.log(`Cache is ${minutes} minutes old`)
      }
    } else if (result.needsNetworkFetch) {
      // No cache, fetch from network
      console.log('No cache available, fetching from network...')
      // fetchEventsFromAPI()
    }
  } catch (error) {
    console.error('App initialization failed:', error)
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp)
} else {
  initializeApp()
}

// Export for module usage
export default ServiceWorkerManager