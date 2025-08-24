// utils/cache.js
// Advanced caching utilities for audit system

class AuditCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 1000;
    this.ttl = options.ttl || 300000; // 5 minutes default TTL
    this.cache = new Map();
    this.accessOrder = new Map(); // Track access order for LRU
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0
    };
  }

  /**
   * Get item from cache
   * @param {string} key - Cache key
   * @returns {any|null} - Cached value or null if not found/expired
   */
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      this.stats.misses++;
      return null;
    }

    // Check TTL
    if (Date.now() - item.timestamp > this.ttl) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access order for LRU
    this.accessOrder.set(key, Date.now());
    this.stats.hits++;
    
    return {
      ...item.data,
      cached: true,
      cacheAge: Date.now() - item.timestamp
    };
  }

  /**
   * Set item in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @returns {boolean} - True if set successfully
   */
  set(key, value) {
    // Evict oldest items if at capacity
    while (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const item = {
      data: value,
      timestamp: Date.now()
    };

    this.cache.set(key, item);
    this.accessOrder.set(key, Date.now());
    this.stats.sets++;
    
    return true;
  }

  /**
   * Check if key exists in cache (without affecting LRU order)
   * @param {string} key - Cache key
   * @returns {boolean} - True if key exists and not expired
   */
  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;
    
    // Check TTL
    if (Date.now() - item.timestamp > this.ttl) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Delete item from cache
   * @param {string} key - Cache key
   * @returns {boolean} - True if item was deleted
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    this.accessOrder.delete(key);
    
    if (deleted) {
      this.stats.deletes++;
    }
    
    return deleted;
  }

  /**
   * Clear all items from cache
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.accessOrder.clear();
    this.stats.deletes += size;
  }

  /**
   * Evict oldest item based on LRU policy
   * @private
   */
  evictOldest() {
    if (this.accessOrder.size === 0) return;
    
    // Find the key with the oldest access time
    let oldestKey = null;
    let oldestTime = Infinity;
    
    for (const [key, accessTime] of this.accessOrder) {
      if (accessTime < oldestTime) {
        oldestTime = accessTime;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache statistics
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total * 100) : 0;
    const usage = (this.cache.size / this.maxSize * 100);
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      usage: Math.round(usage * 100) / 100,
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      deletes: this.stats.deletes,
      evictions: this.stats.evictions,
      hitRate: Math.round(hitRate * 100) / 100,
      ttl: this.ttl
    };
  }

  /**
   * Get all cache keys
   * @returns {Array<string>} - Array of cache keys
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   * @returns {number} - Number of items in cache
   */
  size() {
    return this.cache.size;
  }

  /**
   * Cleanup expired items
   * @returns {number} - Number of items cleaned up
   */
  cleanup() {
    let cleaned = 0;
    const now = Date.now();
    
    for (const [key, item] of this.cache) {
      if (now - item.timestamp > this.ttl) {
        this.delete(key);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  /**
   * Set TTL for cache items
   * @param {number} ttl - Time to live in milliseconds
   */
  setTTL(ttl) {
    this.ttl = ttl;
  }

  /**
   * Reset cache statistics
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0
    };
  }
}

/**
 * Create a new audit cache instance
 * @param {Object} options - Cache options
 * @returns {AuditCache} - New cache instance
 */
function createCache(options = {}) {
  return new AuditCache(options);
}

/**
 * Global cache instance for backward compatibility
 */
const globalCache = new AuditCache();

module.exports = {
  AuditCache,
  createCache,
  cache: globalCache
};