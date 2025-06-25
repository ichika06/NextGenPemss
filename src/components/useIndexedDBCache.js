"use client"

import { useState, useEffect, useCallback, useRef } from "react"

const CACHE_PERMISSION_KEY = "events_cache_permission"
const CACHE_EXPIRY_HOURS = 24
const BACKGROUND_SYNC_DELAY = 2000 // 2 seconds after showing cached data

export const useOptimizedIndexedDBCache = () => {
  const [cachePermission, setCachePermission] = useState(null)
  const [isServiceWorkerReady, setIsServiceWorkerReady] = useState(false)
  const backgroundSyncTimeoutRef = useRef(null)

  // Initialize service worker with better error handling
  useEffect(() => {
    const initServiceWorker = async () => {
      if ("serviceWorker" in navigator) {
        try {
          const registration = await navigator.serviceWorker.register("/sw.js")
          console.log("Service Worker registered:", registration)

          // Wait for service worker to be ready
          await navigator.serviceWorker.ready
          setIsServiceWorkerReady(true)
        } catch (error) {
          console.error("Service Worker registration failed:", error)
          // Still allow the app to work without caching
          setIsServiceWorkerReady(false)
        }
      }
    }

    initServiceWorker()

    // Check existing permission - handle null/undefined properly
    const checkInitialPermission = () => {
      try {
        const permission = localStorage.getItem(CACHE_PERMISSION_KEY)
        console.log("Initial cache permission:", permission)
        setCachePermission(permission)
      } catch (error) {
        console.error("Error reading cache permission:", error)
        setCachePermission(null)
      }
    }

    checkInitialPermission()

    // Listen for storage changes from other tabs
    const handleStorageChange = (e) => {
      if (e.key === CACHE_PERMISSION_KEY) {
        setCachePermission(e.newValue)
      }
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [])

  // Enhanced message sending with timeout and retry
  const sendMessageToSW = useCallback((message, timeout = 5000) => {
    return new Promise((resolve, reject) => {
      if (!navigator.serviceWorker.controller) {
        reject(new Error("Service Worker not available"))
        return
      }

      const messageChannel = new MessageChannel()
      let timeoutId

      messageChannel.port1.onmessage = (event) => {
        clearTimeout(timeoutId)
        if (event.data.error) {
          reject(new Error(event.data.error))
        } else {
          resolve(event.data)
        }
      }

      // Set timeout for the operation
      timeoutId = setTimeout(() => {
        reject(new Error("Service Worker operation timed out"))
      }, timeout)

      navigator.serviceWorker.controller.postMessage(message, [messageChannel.port2])
    })
  }, [])

  const setCachePermissionStatus = useCallback(
    (allowed) => {
      try {
        const permission = allowed ? "granted" : "denied"
        localStorage.setItem(CACHE_PERMISSION_KEY, permission)
        setCachePermission(permission)

        // Immediately clear cache if permission is denied
        if (!allowed && isServiceWorkerReady) {
          clearCache().catch((error) => {
            console.error("Failed to clear cache after permission denied:", error)
          })
        }
      } catch (error) {
        console.error("Error setting cache permission:", error)
      }
    },
    [isServiceWorkerReady],
  )

  const isCacheExpired = useCallback((lastUpdate) => {
    if (!lastUpdate) return true
    const now = Date.now()
    const expiry = lastUpdate + CACHE_EXPIRY_HOURS * 60 * 60 * 1000
    return now > expiry
  }, [])

  // Check if caching is allowed - strict permission check
  const isCachingAllowed = useCallback(() => {
    try {
      const currentPermission = localStorage.getItem(CACHE_PERMISSION_KEY)
      const isAllowed = currentPermission === "granted"
      console.log("Cache permission check:", { currentPermission, isAllowed })
      return isAllowed
    } catch (error) {
      console.error("Error checking cache permission:", error)
      return false
    }
  }, [])

  // Get current permission status
  const getCachePermissionStatus = useCallback(() => {
    try {
      const permission = localStorage.getItem(CACHE_PERMISSION_KEY)
      return {
        permission,
        isGranted: permission === "granted",
        isDenied: permission === "denied",
        isUnset: permission === null || permission === undefined || permission === "null",
      }
    } catch (error) {
      console.error("Error getting cache permission status:", error)
      return {
        permission: null,
        isGranted: false,
        isDenied: false,
        isUnset: true,
      }
    }
  }, [])

  // Optimized save to cache with strict permission check
  const saveToCache = useCallback(
    async (data, source = "manual") => {
      // Double-check permission before saving
      if (!isServiceWorkerReady || !isCachingAllowed()) {
        console.log("Cache save blocked - permission not granted")
        return { success: false, reason: "Cache not available or permission denied" }
      }

      try {
        const result = await sendMessageToSW({
          type: "SAVE_EVENTS",
          payload: { events: data, source, timestamp: Date.now() },
        })
        return result
      } catch (error) {
        console.error("Error saving to cache:", error)
        return { success: false, error: error.message }
      }
    },
    [isServiceWorkerReady, isCachingAllowed, sendMessageToSW],
  )

  // Fast cache retrieval with strict permission check
  const getFromCache = useCallback(async () => {
    // Strict permission check before retrieving
    if (!isServiceWorkerReady || !isCachingAllowed()) {
      console.log("Cache retrieval blocked - permission not granted")
      return { events: [], lastUpdate: null }
    }

    try {
      const result = await sendMessageToSW(
        {
          type: "GET_EVENTS",
        },
        2000,
      ) // Shorter timeout for cache reads
      return result
    } catch (error) {
      console.error("Error getting from cache:", error)
      return { events: [], lastUpdate: null }
    }
  }, [isServiceWorkerReady, isCachingAllowed, sendMessageToSW])

  const clearCache = useCallback(async () => {
    if (!isServiceWorkerReady) {
      return { success: false, reason: "Service Worker not ready" }
    }

    try {
      const result = await sendMessageToSW(
        {
          type: "CLEAR_CACHE",
        },
        10000,
      ) // Increase timeout for cache clearing

      console.log("Cache clear result:", result)
      return result
    } catch (error) {
      console.error("Error clearing cache:", error)
      return { success: false, error: error.message }
    }
  }, [isServiceWorkerReady, sendMessageToSW])

  const checkCacheStatus = useCallback(async () => {
    if (!isServiceWorkerReady) {
      return { hasCache: false, lastUpdate: null }
    }

    try {
      const result = await sendMessageToSW(
        {
          type: "CHECK_CACHE_STATUS",
        },
        1000,
      ) // Very fast check
      return result
    } catch (error) {
      console.error("Error checking cache status:", error)
      return { hasCache: false, lastUpdate: null }
    }
  }, [isServiceWorkerReady, sendMessageToSW])

  // Optimized fetch with strict permission checks
  const fetchWithCache = useCallback(
    async (fetchFunction, options = {}) => {
      const {
        forceRefresh = false,
        saveToCache: shouldSaveToCache = true,
        cacheFirst = true,
        onCacheData = null,
        onNetworkData = null,
      } = options

      let cachedData = null
      let cacheMetadata = null

      // STRICT permission check - only proceed with cache if permission is granted
      const cachingAllowed = isCachingAllowed()
      console.log("Fetch with cache - permission check:", cachingAllowed)

      // Only try to get cached data if permission is explicitly granted
      if (cachingAllowed && !forceRefresh) {
        try {
          const cached = await getFromCache()
          if (cached.events && cached.events.length > 0) {
            cachedData = cached.events
            cacheMetadata = {
              lastUpdate: cached.lastUpdate,
              isExpired: isCacheExpired(cached.lastUpdate),
            }

            // If cache-first and data is not expired, return immediately
            if (cacheFirst && !cacheMetadata.isExpired) {
              // Call callback if provided
              if (onCacheData) {
                onCacheData(cachedData, cacheMetadata)
              }

              // Only schedule background refresh if caching is allowed
              if (cachingAllowed) {
                if (backgroundSyncTimeoutRef.current) {
                  clearTimeout(backgroundSyncTimeoutRef.current)
                }

                backgroundSyncTimeoutRef.current = setTimeout(async () => {
                  // Double-check permission before background sync
                  if (!isCachingAllowed()) {
                    console.log("Background sync cancelled - permission revoked")
                    return
                  }

                  try {
                    const networkData = await fetchFunction()
                    if (networkData && shouldSaveToCache) {
                      await saveToCache(networkData, "background-sync")
                      if (onNetworkData) {
                        onNetworkData(networkData, { fromBackground: true })
                      }
                    }
                  } catch (error) {
                    console.warn("Background sync failed:", error)
                  }
                }, BACKGROUND_SYNC_DELAY)
              }

              return {
                data: cachedData,
                fromCache: true,
                lastUpdate: cached.lastUpdate,
                backgroundSyncScheduled: cachingAllowed,
              }
            }

            // If we have cached data but it's expired or not cache-first,
            // still call the callback so UI can show something immediately
            if (onCacheData) {
              onCacheData(cachedData, cacheMetadata)
            }
          }
        } catch (error) {
          console.error("Error getting cached data:", error)
        }
      } else if (!cachingAllowed) {
        console.log("Skipping cache retrieval - permission not granted")
      }

      // Fetch from network
      try {
        const networkData = await fetchFunction()

        // Save to cache only if permission is granted and enabled
        if (cachingAllowed && shouldSaveToCache && networkData) {
          // Don't await this to avoid blocking the UI
          saveToCache(networkData, "network").catch((error) => {
            console.error("Failed to save to cache:", error)
          })
        }

        // Call network data callback
        if (onNetworkData) {
          onNetworkData(networkData, { fromBackground: false })
        }

        return {
          data: networkData,
          fromCache: false,
          lastUpdate: Date.now(),
          hadCachedData: !!cachedData,
        }
      } catch (error) {
        // If network fails and we have cached data AND permission is granted, return it
        if (cachedData && cachingAllowed) {
          console.warn("Network failed, returning cached data:", error)
          return {
            data: cachedData,
            fromCache: true,
            lastUpdate: cacheMetadata?.lastUpdate,
            networkError: error.message,
            isExpired: cacheMetadata?.isExpired,
          }
        }
        throw error
      }
    },
    [isCachingAllowed, getFromCache, saveToCache, isCacheExpired],
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (backgroundSyncTimeoutRef.current) {
        clearTimeout(backgroundSyncTimeoutRef.current)
      }
    }
  }, [])

  return {
    cachePermission,
    isServiceWorkerReady,
    setCachePermissionStatus,
    getCachePermissionStatus,
    saveToCache,
    getFromCache,
    clearCache,
    checkCacheStatus,
    fetchWithCache,
    isCacheExpired,
    isCachingAllowed,
  }
}