const Queue = require('bull');
const config = require('../config/config');
const { logger } = require('./loggingService');

// Create processing queue
const batchQueue = new Queue('batch-processing', {
  redis: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password
  }
});

// Process bulk notifications
batchQueue.process('notifications', async (job) => {
  try {
    const { userIds, notification } = job.data;
    logger.info(`Processing batch notification for ${userIds.length} users`);
    
    // Process in chunks to avoid overwhelming the system
    const chunkSize = 100;
    const chunks = [];
    
    for (let i = 0; i < userIds.length; i += chunkSize) {
      chunks.push(userIds.slice(i, i + chunkSize));
    }
    
    const notificationQueueService = require('./notificationQueueService');
    
    // Process each chunk with a small delay between them
    for (const [index, chunk] of chunks.entries()) {
      await notificationQueueService.queueBulkNotification(chunk, notification);
      
      // Add a small delay between chunks
      if (index < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Update job progress
      job.progress(Math.floor(((index + 1) / chunks.length) * 100));
    }
    
    return { processed: userIds.length };
  } catch (error) {
    logger.error('Error processing batch notifications:', error);
    throw error;
  }
});

// Process bulk data imports
batchQueue.process('data-import', async (job) => {
  try {
    const { items, type } = job.data;
    logger.info(`Processing batch ${type} import for ${items.length} items`);
    
    // Determine the appropriate service based on type
    let service;
    switch (type) {
      case 'users':
        service = require('../models/User');
        break;
      case 'posts':
        service = require('../models/Post');
        break;
      case 'comments':
        service = require('../models/Comment');
        break;
      default:
        throw new Error(`Unknown import type: ${type}`);
    }
    
    // Process in chunks
    const chunkSize = 50;
    const chunks = [];
    
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    
    const results = [];
    
    // Process each chunk
    for (const [index, chunk] of chunks.entries()) {
      const chunkResult = await service.bulkCreate(chunk);
      results.push(...chunkResult);
      
      // Update job progress
      job.progress(Math.floor(((index + 1) / chunks.length) * 100));
      
      // Add a small delay between chunks
      if (index < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    return { processed: results.length, results };
  } catch (error) {
    logger.error('Error processing batch import:', error);
    throw error;
  }
});

// Queue notification batch
const queueNotificationBatch = async (userIds, notification, options = {}) => {
  try {
    const job = await batchQueue.add('notifications', {
      userIds,
      notification
    }, {
      attempts: options.attempts || 3,
      backoff: options.backoff || {
        type: 'exponential',
        delay: 5000
      },
      removeOnComplete: options.removeOnComplete || 100,
      removeOnFail: options.removeOnFail || 100
    });
    
    return { jobId: job.id };
  } catch (error) {
    logger.error('Error queueing notification batch:', error);
    throw error;
  }
};

// Queue data import batch
const queueDataImport = async (items, type, options = {}) => {
  try {
    const job = await batchQueue.add('data-import', {
      items,
      type
    }, {
      attempts: options.attempts || 3,
      backoff: options.backoff || {
        type: 'exponential',
        delay: 5000
      },
      removeOnComplete: options.removeOnComplete || 100,
      removeOnFail: options.removeOnFail || 100
    });
    
    return { jobId: job.id };
  } catch (error) {
    logger.error('Error queueing data import:', error);
    throw error;
  }
};

// Get batch job status
const getBatchJobStatus = async (jobId) => {
  try {
    const job = await batchQueue.getJob(jobId);
    
    if (!job) {
      return { exists: false };
    }
    
    const state = await job.getState();
    const progress = job._progress;
    
    return {
      exists: true,
      id: job.id,
      state,
      progress,
      data: job.data,
      createdAt: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      attemptsMade: job.attemptsMade
    };
  } catch (error) {
    logger.error('Error getting batch job status:', error);
    throw error;
  }
};

// Handle failed jobs
batchQueue.on('failed', (job, error) => {
  logger.error(`Batch job ${job.id} failed:`, error);
});

module.exports = {
  queueNotificationBatch,
  queueDataImport,
  getBatchJobStatus,
  batchQueue
};