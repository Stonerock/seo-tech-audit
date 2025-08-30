let PubSubClient = null;
try {
  PubSubClient = require('@google-cloud/pubsub').PubSub;
} catch (_) {}

class JobQueue {
  constructor(options = {}) {
    this.enabled = !!PubSubClient && !!(process.env.GOOGLE_CLOUD_PROJECT || options.projectId) && !!(process.env.PUBSUB_TOPIC || options.topic);
    this.projectId = options.projectId || process.env.GOOGLE_CLOUD_PROJECT || process.env.PUBSUB_PROJECT;
    this.topicName = options.topic || process.env.PUBSUB_TOPIC || 'audit-jobs';
    this.pubsub = this.enabled ? new PubSubClient({ projectId: this.projectId }) : null;
  }

  async publishJob(job) {
    if (!this.enabled) return { queued: false, reason: 'pubsub-disabled' };
    const dataBuffer = Buffer.from(JSON.stringify(job));
    const messageId = await this.pubsub.topic(this.topicName).publishMessage({ data: dataBuffer, attributes: { jobId: job.jobId, urlHash: job.urlHash } });
    return { queued: true, messageId };
  }
}

module.exports = { JobQueue };


