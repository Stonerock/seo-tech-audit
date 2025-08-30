const crypto = require('crypto');
const { normalizeUrl } = require('../utils/url');

class InMemoryJobStore {
  constructor() {
    this.jobs = new Map();
    this.results = new Map();
  }

  async createJob(url, options = {}, idempotencyWindowMs = 10 * 60 * 1000) {
    const normalizedUrl = normalizeUrl(url);
    const optionsHash = this.hash(JSON.stringify(options || {}));
    const urlHash = this.hash(normalizedUrl);
    const idKey = `${urlHash}:${optionsHash}`;
    // Idempotency: reuse recent jobs
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.idKey === idKey && Date.now() - job.submittedAt < idempotencyWindowMs) {
        return { jobId: jobId, reused: true };
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
      submittedAt: Date.now(),
    };
    this.jobs.set(jobId, job);
    return { jobId, reused: false };
  }

  async getJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    const result = this.results.get(jobId) || null;
    return { job, result };
  }

  async updateJob(jobId, patch) {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    Object.assign(job, patch, { updatedAt: Date.now() });
    this.jobs.set(jobId, job);
    return true;
  }

  async saveResult(jobId, result) {
    this.results.set(jobId, {
      schemaVersion: 1,
      savedAt: Date.now(),
      ...result,
    });
    await this.updateJob(jobId, { status: 'succeeded', finishedAt: Date.now() });
  }

  async failJob(jobId, errorCode, errorDetails) {
    await this.updateJob(jobId, { status: 'failed', errorCode, errorDetails, finishedAt: Date.now() });
  }

  randomId() {
    return crypto.randomBytes(12).toString('hex');
  }

  hash(s) {
    return crypto.createHash('sha256').update(s).digest('hex');
  }
}

module.exports = { InMemoryJobStore };


