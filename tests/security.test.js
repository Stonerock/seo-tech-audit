const request = require('supertest');
const express = require('express');
const { validateURL, requireApiKey, createRateLimit, securityHeaders } = require('../middleware/security');

describe('Security Middleware', () => {
  let app;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(securityHeaders);
  });

  describe('URL Validation', () => {
    test('should accept valid HTTPS URLs', async () => {
      const url = await validateURL('https://example.com');
      expect(url.href).toBe('https://example.com/');
    });

    test('should reject non-HTTP/HTTPS protocols', async () => {
      await expect(validateURL('ftp://example.com')).rejects.toThrow('Only HTTP and HTTPS protocols are allowed');
    });

    test('should reject localhost URLs', async () => {
      await expect(validateURL('http://localhost:3000')).rejects.toThrow('Access to this domain is not allowed');
    });

    test('should reject private IP ranges', async () => {
      await expect(validateURL('http://192.168.1.1')).rejects.toThrow('Direct IP access to internal networks is not allowed');
      await expect(validateURL('http://10.0.0.1')).rejects.toThrow('Direct IP access to internal networks is not allowed');
      await expect(validateURL('http://172.16.0.1')).rejects.toThrow('Direct IP access to internal networks is not allowed');
    });

    test('should reject metadata endpoints', async () => {
      await expect(validateURL('http://metadata.google.internal')).rejects.toThrow('Access to this domain is not allowed');
      await expect(validateURL('http://169.254.169.254')).rejects.toThrow('Access to this domain is not allowed');
    });
  });

  describe('API Key Authentication', () => {
    test('should require API key in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.API_KEYS = 'test-key-1,test-key-2';
      
      app.get('/test', requireApiKey, (req, res) => {
        res.json({ success: true });
      });

      return request(app)
        .get('/test')
        .expect(401)
        .expect(res => {
          expect(res.body.error).toBe('Unauthorized');
        });
    });

    test('should accept valid API key in header', () => {
      process.env.NODE_ENV = 'production';
      process.env.API_KEYS = 'test-key-1,test-key-2';
      
      app.get('/test', requireApiKey, (req, res) => {
        res.json({ success: true });
      });

      return request(app)
        .get('/test')
        .set('X-API-Key', 'test-key-1')
        .expect(200)
        .expect(res => {
          expect(res.body.success).toBe(true);
        });
    });

    test('should accept valid API key in query param', () => {
      process.env.NODE_ENV = 'production';
      process.env.API_KEYS = 'test-key-1,test-key-2';
      
      app.get('/test', requireApiKey, (req, res) => {
        res.json({ success: true });
      });

      return request(app)
        .get('/test?api_key=test-key-2')
        .expect(200)
        .expect(res => {
          expect(res.body.success).toBe(true);
        });
    });

    test('should skip API key check in development', () => {
      process.env.NODE_ENV = 'development';
      
      app.get('/test', requireApiKey, (req, res) => {
        res.json({ success: true });
      });

      return request(app)
        .get('/test')
        .expect(200);
    });
  });

  describe('Security Headers', () => {
    test('should add security headers', () => {
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      return request(app)
        .get('/test')
        .expect(200)
        .expect('X-Content-Type-Options', 'nosniff')
        .expect('X-Frame-Options', 'DENY')
        .expect('X-XSS-Protection', '1; mode=block')
        .expect('Referrer-Policy', 'strict-origin-when-cross-origin');
    });

    test('should remove sensitive headers', () => {
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      return request(app)
        .get('/test')
        .expect(200)
        .expect(res => {
          expect(res.headers['x-powered-by']).toBeUndefined();
          expect(res.headers['server']).toBeUndefined();
        });
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits', async () => {
      const limiter = createRateLimit(1000, 2); // 2 requests per second
      app.use(limiter);
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      // First two requests should succeed
      await request(app).get('/test').expect(200);
      await request(app).get('/test').expect(200);
      
      // Third request should be rate limited
      await request(app).get('/test').expect(429);
    });
  });

  afterEach(() => {
    // Reset environment
    delete process.env.NODE_ENV;
    delete process.env.API_KEYS;
  });
});