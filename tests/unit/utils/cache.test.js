// tests/unit/utils/cache.test.js
// Unit tests for cache utility functions

const { AuditCache, createCache, cache } = require('../../../utils/cache');

describe('Utils - Cache', () => {
  describe('AuditCache', () => {
    let testCache;

    beforeEach(() => {
      testCache = new AuditCache({ maxSize: 3, ttl: 1000 });
    });

    describe('constructor', () => {
      test('should create cache with default options', () => {
        const defaultCache = new AuditCache();
        expect(defaultCache.maxSize).toBe(1000);
        expect(defaultCache.ttl).toBe(300000);
      });

      test('should create cache with custom options', () => {
        const customCache = new AuditCache({ maxSize: 100, ttl: 5000 });
        expect(customCache.maxSize).toBe(100);
        expect(customCache.ttl).toBe(5000);
      });

      test('should initialize with empty cache and stats', () => {
        expect(testCache.size()).toBe(0);
        const stats = testCache.getStats();
        expect(stats.hits).toBe(0);
        expect(stats.misses).toBe(0);
      });
    });

    describe('set and get', () => {
      test('should store and retrieve values', () => {
        const testValue = { data: 'test', score: 85 };
        
        testCache.set('key1', testValue);
        const retrieved = testCache.get('key1');

        expect(retrieved.data).toBe('test');
        expect(retrieved.score).toBe(85);
        expect(retrieved.cached).toBe(true);
        expect(retrieved.cacheAge).toBeGreaterThanOrEqual(0);
      });

      test('should return null for non-existent keys', () => {
        const result = testCache.get('non-existent');
        expect(result).toBe(null);
      });

      test('should update statistics correctly', () => {
        testCache.set('key1', { data: 'test' });
        
        // First get - cache hit
        testCache.get('key1');
        let stats = testCache.getStats();
        expect(stats.hits).toBe(1);
        expect(stats.misses).toBe(0);

        // Non-existent key - cache miss
        testCache.get('non-existent');
        stats = testCache.getStats();
        expect(stats.hits).toBe(1);
        expect(stats.misses).toBe(1);
        expect(stats.hitRate).toBe(50);
      });
    });

    describe('TTL (Time To Live)', () => {
      test('should expire items after TTL', async () => {
        const shortTtlCache = new AuditCache({ ttl: 50 });
        
        shortTtlCache.set('key1', { data: 'test' });
        expect(shortTtlCache.get('key1')).not.toBe(null);
        
        // Wait for TTL to expire
        await new Promise(resolve => setTimeout(resolve, 100));
        
        expect(shortTtlCache.get('key1')).toBe(null);
      });

      test('should not return expired items', async () => {
        const shortTtlCache = new AuditCache({ ttl: 50 });
        
        shortTtlCache.set('key1', { data: 'test' });
        
        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Try to get the expired item (this should increment miss counter)
        const result = shortTtlCache.get('key1');
        expect(result).toBe(null);
        
        const stats = shortTtlCache.getStats();
        expect(stats.misses).toBe(1); // get() call should count as miss
      });
    });

    describe('LRU eviction', () => {
      test('should evict oldest items when at capacity', () => {
        // Fill cache to capacity
        testCache.set('key1', { data: 'first' });
        testCache.set('key2', { data: 'second' });
        testCache.set('key3', { data: 'third' });
        
        expect(testCache.size()).toBe(3);
        
        // Add one more item - should evict oldest
        testCache.set('key4', { data: 'fourth' });
        
        expect(testCache.size()).toBe(3);
        expect(testCache.get('key1')).toBe(null); // Should be evicted
        expect(testCache.get('key4')).not.toBe(null); // Should exist
      });

      test('should update access order on get', async () => {
        // Create a fresh cache for this test to avoid interference
        const lruCache = new AuditCache({ maxSize: 3 });
        
        lruCache.set('key1', { data: 'first' });
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
        lruCache.set('key2', { data: 'second' });
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
        lruCache.set('key3', { data: 'third' });
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
        
        // Access key1 to make it most recently used
        lruCache.get('key1');
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
        
        // Add new item - key2 should be evicted (least recently used)
        lruCache.set('key4', { data: 'fourth' });
        
        expect(lruCache.get('key1')).not.toBe(null); // Should still exist (recently accessed)
        expect(lruCache.get('key2')).toBe(null); // Should be evicted (least recently used)
        expect(lruCache.get('key3')).not.toBe(null); // Should still exist
        expect(lruCache.get('key4')).not.toBe(null); // Should exist (newly added)
      });
    });

    describe('has', () => {
      test('should check existence without affecting LRU order', () => {
        testCache.set('key1', { data: 'test' });
        testCache.set('key2', { data: 'test' });
        testCache.set('key3', { data: 'test' });
        
        expect(testCache.has('key1')).toBe(true);
        expect(testCache.has('non-existent')).toBe(false);
        
        // Add item to trigger eviction
        testCache.set('key4', { data: 'test' });
        
        // key1 should still be evicted despite has() check
        expect(testCache.get('key1')).toBe(null);
      });

      test('should return false for expired items', async () => {
        const shortTtlCache = new AuditCache({ ttl: 50 });
        
        shortTtlCache.set('key1', { data: 'test' });
        expect(shortTtlCache.has('key1')).toBe(true);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        expect(shortTtlCache.has('key1')).toBe(false);
      });
    });

    describe('delete and clear', () => {
      test('should delete specific items', () => {
        testCache.set('key1', { data: 'test1' });
        testCache.set('key2', { data: 'test2' });
        
        expect(testCache.delete('key1')).toBe(true);
        expect(testCache.delete('non-existent')).toBe(false);
        
        expect(testCache.get('key1')).toBe(null);
        expect(testCache.get('key2')).not.toBe(null);
      });

      test('should clear all items', () => {
        testCache.set('key1', { data: 'test1' });
        testCache.set('key2', { data: 'test2' });
        
        testCache.clear();
        
        expect(testCache.size()).toBe(0);
        expect(testCache.get('key1')).toBe(null);
        expect(testCache.get('key2')).toBe(null);
      });
    });

    describe('cleanup', () => {
      test('should remove expired items', async () => {
        const shortTtlCache = new AuditCache({ ttl: 50 });
        
        shortTtlCache.set('key1', { data: 'test1' });
        shortTtlCache.set('key2', { data: 'test2' });
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const cleaned = shortTtlCache.cleanup();
        
        expect(cleaned).toBe(2);
        expect(shortTtlCache.size()).toBe(0);
      });

      test('should not remove fresh items', () => {
        testCache.set('key1', { data: 'test1' });
        testCache.set('key2', { data: 'test2' });
        
        const cleaned = testCache.cleanup();
        
        expect(cleaned).toBe(0);
        expect(testCache.size()).toBe(2);
      });
    });

    describe('statistics', () => {
      test('should track cache statistics', () => {
        testCache.set('key1', { data: 'test' });
        testCache.get('key1'); // hit
        testCache.get('key2'); // miss
        testCache.delete('key1');
        
        const stats = testCache.getStats();
        
        expect(stats.hits).toBe(1);
        expect(stats.misses).toBe(1);
        expect(stats.sets).toBe(1);
        expect(stats.deletes).toBe(1);
        expect(stats.hitRate).toBe(50);
        expect(stats.usage).toBe(0); // Cache is empty after delete
      });

      test('should reset statistics', () => {
        testCache.set('key1', { data: 'test' });
        testCache.get('key1');
        testCache.get('key2');
        
        testCache.resetStats();
        
        const stats = testCache.getStats();
        expect(stats.hits).toBe(0);
        expect(stats.misses).toBe(0);
        expect(stats.sets).toBe(0);
        expect(stats.deletes).toBe(0);
      });
    });

    describe('TTL management', () => {
      test('should update TTL', () => {
        testCache.setTTL(5000);
        expect(testCache.ttl).toBe(5000);
      });
    });

    describe('utility methods', () => {
      test('should return all keys', () => {
        testCache.set('key1', { data: 'test1' });
        testCache.set('key2', { data: 'test2' });
        
        const keys = testCache.keys();
        
        expect(keys).toEqual(expect.arrayContaining(['key1', 'key2']));
        expect(keys.length).toBe(2);
      });

      test('should return cache size', () => {
        expect(testCache.size()).toBe(0);
        
        testCache.set('key1', { data: 'test' });
        expect(testCache.size()).toBe(1);
        
        testCache.set('key2', { data: 'test' });
        expect(testCache.size()).toBe(2);
      });
    });
  });

  describe('createCache', () => {
    test('should create new cache instance', () => {
      const newCache = createCache({ maxSize: 50 });
      
      expect(newCache).toBeInstanceOf(AuditCache);
      expect(newCache.maxSize).toBe(50);
    });

    test('should create cache with default options', () => {
      const newCache = createCache();
      
      expect(newCache).toBeInstanceOf(AuditCache);
      expect(newCache.maxSize).toBe(1000);
    });
  });

  describe('global cache instance', () => {
    test('should provide global cache instance', () => {
      expect(cache).toBeInstanceOf(AuditCache);
      expect(cache.maxSize).toBe(1000); // Default size
    });

    test('should be usable across modules', () => {
      cache.set('global-test', { data: 'global' });
      expect(cache.get('global-test').data).toBe('global');
      
      // Clean up
      cache.delete('global-test');
    });
  });
});