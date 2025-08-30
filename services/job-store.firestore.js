const crypto = require('crypto');
const { Firestore } = require('@google-cloud/firestore');
const { normalizeUrl } = require('../utils/url');
const { AuditAnalytics } = require('./audit-analytics.firestore');

class FirestoreJobStore {
  constructor(options = {}) {
    this.firestore = new Firestore({
      projectId: options.projectId || process.env.GOOGLE_CLOUD_PROJECT || process.env.FIRESTORE_PROJECT,
    });
    this.jobsCol = this.firestore.collection(options.jobsCollection || 'jobs');
    this.resultsCol = this.firestore.collection(options.resultsCollection || 'jobResults');
    this.idKeysCol = this.firestore.collection(options.idKeysCollection || 'jobIdKeys');
    
    // Initialize analytics for dataset building
    this.analytics = new AuditAnalytics();
  }

  async createJob(url, options = {}, idempotencyWindowMs = 10 * 60 * 1000) {
    const normalizedUrl = normalizeUrl(url);
    const optionsHash = this.hash(JSON.stringify(options || {}));
    const urlHash = this.hash(normalizedUrl);
    const idKey = `${urlHash}:${optionsHash}`;

    // Idempotency via separate idKeys collection
    const now = Date.now();
    const idKeyDoc = this.idKeysCol.doc(idKey);
    const idKeySnap = await idKeyDoc.get();
    if (idKeySnap.exists) {
      const data = idKeySnap.data();
      if (now - (data.updatedAt || data.createdAt || 0) < idempotencyWindowMs && data.jobId) {
        return { jobId: data.jobId, reused: true };
      }
    }

    const jobId = this.randomId();
    const job = {
      jobId,
      idKey,
      url,
      normalizedUrl,
      urlHash,
      optionsHash,
      status: 'queued',
      attempts: 0,
      submittedAt: now,
      updatedAt: now,
    };

    await this.jobsCol.doc(jobId).set(job, { merge: false });
    await idKeyDoc.set({ jobId, idKey, updatedAt: now, createdAt: idKeySnap.exists ? idKeySnap.data().createdAt || now : now }, { merge: true });

    return { jobId, reused: false };
  }

  async getJob(jobId) {
    const jobSnap = await this.jobsCol.doc(jobId).get();
    if (!jobSnap.exists) return null;
    const resultSnap = await this.resultsCol.doc(jobId).get();
    return { job: jobSnap.data(), result: resultSnap.exists ? resultSnap.data() : null };
  }

  async updateJob(jobId, patch) {
    const now = Date.now();
    await this.jobsCol.doc(jobId).set({ ...patch, updatedAt: now }, { merge: true });
    return true;
  }

  async saveResult(jobId, result) {
    const now = Date.now();
    await this.resultsCol.doc(jobId).set({ schemaVersion: 1, savedAt: now, ...result }, { merge: false });
    await this.updateJob(jobId, { status: 'succeeded', finishedAt: now });
    
    // Record audit result for analytics and dataset building
    try {
      const job = await this.getJob(jobId);
      if (job?.job?.url) {
        await this.analytics.recordAuditResult(jobId, job.job.url, result, {
          usedBrowserless: result.mode === 'two-pass',
          executionTime: result.executionTime
        });
      }
    } catch (error) {
      console.warn('[ANALYTICS] Failed to record audit result:', error.message);
    }
  }

  async failJob(jobId, errorCode, errorDetails) {
    const now = Date.now();
    await this.updateJob(jobId, { status: 'failed', errorCode, errorDetails, finishedAt: now });
  }

  randomId() {
    return crypto.randomBytes(12).toString('hex');
  }

  hash(s) {
    return crypto.createHash('sha256').update(s).digest('hex');
  }
}

module.exports = { FirestoreJobStore };


