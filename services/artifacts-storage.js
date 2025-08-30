// services/artifacts-storage.js - GCS storage for audit artifacts (screenshots, HAR, traces)
const { Storage } = require('@google-cloud/storage');
const crypto = require('crypto');

class ArtifactsStorage {
  constructor(options = {}) {
    this.enabled = process.env.ENABLE_SCREENSHOT === 'true' && !!process.env.GCS_BUCKET;
    
    if (this.enabled) {
      try {
        this.storage = new Storage({
          projectId: options.projectId || process.env.GOOGLE_CLOUD_PROJECT
        });
        this.bucketName = process.env.GCS_BUCKET;
        this.bucket = this.storage.bucket(this.bucketName);
        console.log(`[ARTIFACTS] Enabled with bucket: ${this.bucketName}`);
      } catch (error) {
        console.warn('[ARTIFACTS] Failed to initialize GCS:', error.message);
        this.enabled = false;
      }
    } else {
      console.log('[ARTIFACTS] Disabled - set ENABLE_SCREENSHOT=true and GCS_BUCKET to enable');
    }
  }

  /**
   * Upload screenshot artifact
   */
  async uploadScreenshot(jobId, screenshotBuffer, metadata = {}) {
    if (!this.enabled || !screenshotBuffer) return null;

    try {
      const filename = `screenshots/${jobId}-${Date.now()}.png`;
      const file = this.bucket.file(filename);

      await file.save(screenshotBuffer, {
        metadata: {
          contentType: 'image/png',
          metadata: {
            jobId,
            type: 'screenshot',
            uploadedAt: new Date().toISOString(),
            ...metadata
          }
        }
      });

      // Generate signed URL (valid for 7 days)
      const signedUrl = await this.generateSignedUrl(filename, 7 * 24 * 60);
      
      console.log(`[ARTIFACTS] Screenshot uploaded: ${filename}`);
      return {
        filename,
        url: signedUrl,
        type: 'screenshot',
        size: screenshotBuffer.length
      };

    } catch (error) {
      console.error('[ARTIFACTS] Screenshot upload failed:', error.message);
      return null;
    }
  }

  /**
   * Upload HAR file (HTTP Archive)
   */
  async uploadHAR(jobId, harData, metadata = {}) {
    if (!this.enabled || !harData) return null;

    try {
      const filename = `har/${jobId}-${Date.now()}.har`;
      const file = this.bucket.file(filename);

      const harJson = typeof harData === 'string' ? harData : JSON.stringify(harData);
      
      await file.save(harJson, {
        metadata: {
          contentType: 'application/json',
          metadata: {
            jobId,
            type: 'har',
            uploadedAt: new Date().toISOString(),
            ...metadata
          }
        }
      });

      const signedUrl = await this.generateSignedUrl(filename, 7 * 24 * 60);
      
      console.log(`[ARTIFACTS] HAR uploaded: ${filename}`);
      return {
        filename,
        url: signedUrl,
        type: 'har',
        size: harJson.length
      };

    } catch (error) {
      console.error('[ARTIFACTS] HAR upload failed:', error.message);
      return null;
    }
  }

  /**
   * Upload Lighthouse trace
   */
  async uploadTrace(jobId, traceData, metadata = {}) {
    if (!this.enabled || !traceData) return null;

    try {
      const filename = `traces/${jobId}-${Date.now()}.json`;
      const file = this.bucket.file(filename);

      const traceJson = typeof traceData === 'string' ? traceData : JSON.stringify(traceData);
      
      await file.save(traceJson, {
        metadata: {
          contentType: 'application/json',
          metadata: {
            jobId,
            type: 'trace',
            uploadedAt: new Date().toISOString(),
            ...metadata
          }
        }
      });

      const signedUrl = await this.generateSignedUrl(filename, 7 * 24 * 60);
      
      console.log(`[ARTIFACTS] Trace uploaded: ${filename}`);
      return {
        filename,
        url: signedUrl,
        type: 'trace',
        size: traceJson.length
      };

    } catch (error) {
      console.error('[ARTIFACTS] Trace upload failed:', error.message);
      return null;
    }
  }

  /**
   * Upload custom artifact
   */
  async uploadArtifact(jobId, data, type, extension = 'json', metadata = {}) {
    if (!this.enabled || !data) return null;

    try {
      const filename = `${type}/${jobId}-${Date.now()}.${extension}`;
      const file = this.bucket.file(filename);

      const content = Buffer.isBuffer(data) ? data : 
                     typeof data === 'string' ? data : JSON.stringify(data);
      
      const contentType = this.getContentType(extension);

      await file.save(content, {
        metadata: {
          contentType,
          metadata: {
            jobId,
            type,
            uploadedAt: new Date().toISOString(),
            ...metadata
          }
        }
      });

      const signedUrl = await this.generateSignedUrl(filename, 7 * 24 * 60);
      
      console.log(`[ARTIFACTS] ${type} uploaded: ${filename}`);
      return {
        filename,
        url: signedUrl,
        type,
        size: content.length
      };

    } catch (error) {
      console.error(`[ARTIFACTS] ${type} upload failed:`, error.message);
      return null;
    }
  }

  /**
   * Generate signed URL for private access
   */
  async generateSignedUrl(filename, expirationMinutes = 60) {
    if (!this.enabled) return null;

    try {
      const [url] = await this.bucket.file(filename).getSignedUrl({
        action: 'read',
        expires: Date.now() + expirationMinutes * 60 * 1000
      });

      return url;
    } catch (error) {
      console.error('[ARTIFACTS] Signed URL generation failed:', error.message);
      return null;
    }
  }

  /**
   * Clean up old artifacts (called periodically)
   */
  async cleanupOldArtifacts(daysOld = 30) {
    if (!this.enabled) return;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const [files] = await this.bucket.getFiles({
        prefix: 'screenshots/' // Could be expanded to other types
      });

      let deletedCount = 0;
      for (const file of files) {
        const [metadata] = await file.getMetadata();
        const createdDate = new Date(metadata.timeCreated);
        
        if (createdDate < cutoffDate) {
          await file.delete();
          deletedCount++;
        }
      }

      console.log(`[ARTIFACTS] Cleaned up ${deletedCount} old files`);
      return deletedCount;

    } catch (error) {
      console.error('[ARTIFACTS] Cleanup failed:', error.message);
      return 0;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    if (!this.enabled) return null;

    try {
      const [files] = await this.bucket.getFiles();
      
      const stats = {
        totalFiles: files.length,
        totalSize: 0,
        types: {}
      };

      for (const file of files) {
        const [metadata] = await file.getMetadata();
        stats.totalSize += parseInt(metadata.size || 0);
        
        const type = metadata.metadata?.type || 'unknown';
        stats.types[type] = (stats.types[type] || 0) + 1;
      }

      return stats;

    } catch (error) {
      console.error('[ARTIFACTS] Stats failed:', error.message);
      return null;
    }
  }

  // Helper methods
  getContentType(extension) {
    const types = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'json': 'application/json',
      'har': 'application/json',
      'html': 'text/html',
      'txt': 'text/plain'
    };
    return types[extension.toLowerCase()] || 'application/octet-stream';
  }

  /**
   * Create storage bucket (setup helper)
   */
  async createBucket(bucketName, location = 'US') {
    try {
      await this.storage.createBucket(bucketName, {
        location,
        storageClass: 'STANDARD',
        versioning: {
          enabled: false
        },
        lifecycle: {
          rule: [{
            action: { type: 'Delete' },
            condition: { age: 90 } // Auto-delete after 90 days
          }]
        }
      });

      console.log(`[ARTIFACTS] Bucket ${bucketName} created successfully`);
      return true;

    } catch (error) {
      console.error('[ARTIFACTS] Bucket creation failed:', error.message);
      return false;
    }
  }
}

module.exports = { ArtifactsStorage };