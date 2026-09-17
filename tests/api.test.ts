import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { Deployment } from '../src/modules/deployments/deployment.model.js';
import { UsageEvent } from '../src/modules/usage/usage.model.js';
import { setProvisioningDelay, getProvisioningDelay } from '../src/modules/deployments/deployment.service.js';
import { clearRateLimitStore, getRequestCount } from '../src/modules/rate-limit/rate-limit.service.js';
import type { CreateDeploymentResponse, GetDeploymentResponse } from '../src/types/deployment.js';
import type { CreateCompletionResponse } from '../src/types/completion.js';
import type { UsageResponse } from '../src/types/usage.js';

// Test database configuration
const TEST_MONGODB_URI = process.env.TEST_MONGODB_URI ?? 'mongodb://localhost:27017/usage-based-api-test';

// Create app instance for testing
const app = createApp();

// Helper to wait for provisioning to complete
async function waitForProvisioning(): Promise<void> {
  const delay = getProvisioningDelay();
  await new Promise((resolve) => setTimeout(resolve, delay + 50));
}

// Helper to create a ready deployment
async function createReadyDeployment(model: 'model-a' | 'model-b' = 'model-a'): Promise<{
  deploymentId: string;
  apiKey: string;
}> {
  const res = await request(app)
    .post('/api/deployments')
    .send({ model })
    .expect(201);

  const body = res.body as CreateDeploymentResponse;
  const deploymentId = body.deployment_id;

  // Wait for provisioning
  await waitForProvisioning();

  // Get the API key
  const getRes = await request(app)
    .get(`/api/deployments/${deploymentId}`)
    .expect(200);

  const getBody = getRes.body as GetDeploymentResponse;

  if (!getBody.api_key) {
    throw new Error('API key not available after provisioning');
  }

  return { deploymentId, apiKey: getBody.api_key };
}

describe('API Integration Tests', () => {
  beforeAll(async () => {
    // Use short provisioning delay for tests (50ms)
    setProvisioningDelay(50);
    await mongoose.connect(TEST_MONGODB_URI);
  });

  afterAll(async () => {
    const collections = mongoose.connection.collections;
    for (const collection of Object.values(collections)) {
      await collection.deleteMany({});
    }
    await mongoose.disconnect();
    setProvisioningDelay(10000); // Reset to default
  });

  beforeEach(async () => {
    // Clear all collections before each test
    const collections = mongoose.connection.collections;
    for (const collection of Object.values(collections)) {
      await collection.deleteMany({});
    }
    // Clear rate limit store
    clearRateLimitStore();
  });

  describe('Deployment Lifecycle', () => {
    it('should create deployment with provisioning status', async () => {
      const res = await request(app)
        .post('/api/deployments')
        .send({ model: 'model-a' })
        .expect(201);

      const body = res.body as CreateDeploymentResponse;

      expect(body.deployment_id).toBeDefined();
      expect(body.deployment_id).toMatch(/^dep_[a-z0-9]+_[a-f0-9]+$/);
      expect(body.status).toBe('provisioning');
    });

    it('should reject invalid model type', async () => {
      const res = await request(app)
        .post('/api/deployments')
        .send({ model: 'invalid-model' })
        .expect(400);

      expect(res.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject missing model field', async () => {
      const res = await request(app)
        .post('/api/deployments')
        .send({})
        .expect(400);

      expect(res.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should transition from provisioning to ready after delay', async () => {
      const createRes = await request(app)
        .post('/api/deployments')
        .send({ model: 'model-b' })
        .expect(201);

      const deploymentId = (createRes.body as CreateDeploymentResponse).deployment_id;

      // Immediately check - should still be provisioning
      const earlyRes = await request(app)
        .get(`/api/deployments/${deploymentId}`)
        .expect(200);

      const earlyBody = earlyRes.body as GetDeploymentResponse;
      expect(earlyBody.status).toBe('provisioning');
      expect(earlyBody.api_key).toBeUndefined();
      expect(earlyBody.endpoint_url).toBeUndefined();

      // Wait for provisioning
      await waitForProvisioning();

      // Check again - should be ready
      const readyRes = await request(app)
        .get(`/api/deployments/${deploymentId}`)
        .expect(200);

      const readyBody = readyRes.body as GetDeploymentResponse;
      expect(readyBody.status).toBe('ready');
      expect(readyBody.api_key).toBeDefined();
      expect(readyBody.endpoint_url).toBeDefined();
      expect(readyBody.model).toBe('model-b');
    });

    it('should return 404 for non-existent deployment', async () => {
      const res = await request(app)
        .get('/api/deployments/non-existent-id')
        .expect(404);

      expect(res.body).toHaveProperty('code', 'NOT_FOUND');
    });

    it('should terminate a ready deployment', async () => {
      const { deploymentId } = await createReadyDeployment();

      const deleteRes = await request(app)
        .delete(`/api/deployments/${deploymentId}`)
        .expect(204);

      // Verify it's terminated
      const getRes = await request(app)
        .get(`/api/deployments/${deploymentId}`)
        .expect(200);

      const body = getRes.body as GetDeploymentResponse;
      expect(body.status).toBe('terminated');
    });

    it('should return 409 when terminating already terminated deployment', async () => {
      const { deploymentId } = await createReadyDeployment();

      // First termination - should succeed
      await request(app)
        .delete(`/api/deployments/${deploymentId}`)
        .expect(204);

      // Verify it's terminated
      const getRes = await request(app)
        .get(`/api/deployments/${deploymentId}`)
        .expect(200);
      expect((getRes.body as GetDeploymentResponse).status).toBe('terminated');

      // Second termination attempt - should fail with 409
      const res = await request(app)
        .delete(`/api/deployments/${deploymentId}`)
        .expect(409);

      expect(res.body).toHaveProperty('code', 'INVALID_STATE_TRANSITION');
    });
  });

  describe('API Key Authentication', () => {
    it('should return 401 for missing Authorization header', async () => {
      const { deploymentId } = await createReadyDeployment();

      const res = await request(app)
        .post(`/api/v1/${deploymentId}/completions`)
        .send({ prompt: 'Hello world' })
        .expect(401);

      expect(res.body).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should return 401 for invalid Bearer format', async () => {
      const { deploymentId } = await createReadyDeployment();

      const res = await request(app)
        .post(`/api/v1/${deploymentId}/completions`)
        .set('Authorization', 'InvalidFormat token')
        .send({ prompt: 'Hello world' })
        .expect(401);

      expect(res.body).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should return 401 for invalid API key', async () => {
      const { deploymentId } = await createReadyDeployment();

      const res = await request(app)
        .post(`/api/v1/${deploymentId}/completions`)
        .set('Authorization', 'Bearer invalid-api-key-12345')
        .send({ prompt: 'Hello world' })
        .expect(401);

      expect(res.body).toHaveProperty('code', 'UNAUTHORIZED');
      expect(res.body.message).toContain('Invalid API key');
    });

    it('should return 403 when API key belongs to different deployment', async () => {
      const { deploymentId: deployment1, apiKey: apiKey1 } = await createReadyDeployment();
      const { deploymentId: deployment2 } = await createReadyDeployment();

      // Use apiKey1 to access deployment2
      const res = await request(app)
        .post(`/api/v1/${deployment2}/completions`)
        .set('Authorization', `Bearer ${apiKey1}`)
        .send({ prompt: 'Hello world' })
        .expect(403);

      expect(res.body).toHaveProperty('code', 'FORBIDDEN');
      expect(res.body.message).toContain('does not belong to this deployment');
    });

    it('should return 409 when deployment is provisioning', async () => {
      // Normal create() does not expose an API key until ready, so seed a
      // provisioning deployment that already has a key to exercise this path.
      await Deployment.create({
        deployment_id: 'dep_provisioning_with_key',
        model: 'model-a',
        status: 'provisioning',
        api_key: 'provisioning-test-key',
        endpoint_url: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const res = await request(app)
        .post('/api/v1/dep_provisioning_with_key/completions')
        .set('Authorization', 'Bearer provisioning-test-key')
        .send({ prompt: 'Hello world' })
        .expect(409);

      expect(res.body).toHaveProperty('code', 'DEPLOYMENT_NOT_READY');
      expect(res.body.message).toContain('provisioning');
    });

    it('should return 409 when deployment is terminated', async () => {
      const { deploymentId, apiKey } = await createReadyDeployment();

      // Terminate the deployment
      await request(app)
        .delete(`/api/deployments/${deploymentId}`)
        .expect(204);

      // Try to use the terminated deployment
      const res = await request(app)
        .post(`/api/v1/${deploymentId}/completions`)
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ prompt: 'Hello world' })
        .expect(409);

      expect(res.body).toHaveProperty('code', 'DEPLOYMENT_NOT_READY');
      expect(res.body.message).toContain('terminated');
    });
  });

  describe('Completions', () => {
    it('should return mocked output and token counts', async () => {
      const { deploymentId, apiKey } = await createReadyDeployment();

      const res = await request(app)
        .post(`/api/v1/${deploymentId}/completions`)
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ prompt: 'This is a test prompt for completion' })
        .expect(200);

      const body = res.body as CreateCompletionResponse;

      expect(body.output).toBe('mocked response');
      expect(body.input_tokens).toBe(Math.round('This is a test prompt for completion'.length / 4));
      expect(body.output_tokens).toBeGreaterThanOrEqual(50);
      expect(body.output_tokens).toBeLessThanOrEqual(200);
    });

    it('should reject non-string prompt', async () => {
      const { deploymentId, apiKey } = await createReadyDeployment();

      const res = await request(app)
        .post(`/api/v1/${deploymentId}/completions`)
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ prompt: 123 })
        .expect(400);

      expect(res.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject empty prompt', async () => {
      const { deploymentId, apiKey } = await createReadyDeployment();

      const res = await request(app)
        .post(`/api/v1/${deploymentId}/completions`)
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ prompt: '   ' })
        .expect(400);

      expect(res.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should create exactly one usage event per successful completion', async () => {
      const { deploymentId, apiKey } = await createReadyDeployment();

      // Verify no usage events exist
      const beforeCount = await UsageEvent.countDocuments();
      expect(beforeCount).toBe(0);

      // Make a completion request
      await request(app)
        .post(`/api/v1/${deploymentId}/completions`)
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ prompt: 'Test prompt' })
        .expect(200);

      // Verify exactly one usage event was created
      const afterCount = await UsageEvent.countDocuments();
      expect(afterCount).toBe(1);

      // Verify the usage event fields
      const usageEvent = await UsageEvent.findOne({ api_key: apiKey });
      expect(usageEvent).not.toBeNull();
      expect(usageEvent?.deployment_id).toBe(deploymentId);
      expect(usageEvent?.model).toBe('model-a');
      expect(usageEvent?.input_tokens).toBe(Math.round('Test prompt'.length / 4));
      expect(usageEvent?.output_tokens).toBeGreaterThanOrEqual(50);
      expect(usageEvent?.output_tokens).toBeLessThanOrEqual(200);
      expect(usageEvent?.timestamp).toBeInstanceOf(Date);
    });

    it('should not create usage event for failed auth', async () => {
      const { deploymentId } = await createReadyDeployment();

      // Attempt completion with invalid API key
      await request(app)
        .post(`/api/v1/${deploymentId}/completions`)
        .set('Authorization', 'Bearer invalid-key')
        .send({ prompt: 'Test prompt' })
        .expect(401);

      // Verify no usage event was created
      const count = await UsageEvent.countDocuments();
      expect(count).toBe(0);
    });

    it('should not create usage event for wrong deployment', async () => {
      const { deploymentId: deployment1, apiKey: apiKey1 } = await createReadyDeployment();
      const { deploymentId: deployment2 } = await createReadyDeployment();

      // Use apiKey1 to access deployment2 (should fail with 403)
      await request(app)
        .post(`/api/v1/${deployment2}/completions`)
        .set('Authorization', `Bearer ${apiKey1}`)
        .send({ prompt: 'Test prompt' })
        .expect(403);

      // Verify no usage event was created
      const count = await UsageEvent.countDocuments();
      expect(count).toBe(0);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests under the rate limit', async () => {
      const { deploymentId, apiKey } = await createReadyDeployment();

      // Make a few requests - should all succeed
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post(`/api/v1/${deploymentId}/completions`)
          .set('Authorization', `Bearer ${apiKey}`)
          .send({ prompt: `Test ${i}` })
          .expect(200);
      }

      // Verify request count
      expect(getRequestCount(apiKey)).toBe(5);
    });

    it('should reject requests exceeding the rate limit', async () => {
      const { deploymentId, apiKey } = await createReadyDeployment();

      // Make 100 requests (the limit)
      for (let i = 0; i < 100; i++) {
        await request(app)
          .post(`/api/v1/${deploymentId}/completions`)
          .set('Authorization', `Bearer ${apiKey}`)
          .send({ prompt: `Test ${i}` })
          .expect(200);
      }

      // Next request should be rate limited
      const res = await request(app)
        .post(`/api/v1/${deploymentId}/completions`)
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ prompt: 'Over limit' })
        .expect(429);

      expect(res.body).toHaveProperty('code', 'RATE_LIMIT_EXCEEDED');
      expect(res.body.details).toHaveProperty('retry_after');
      expect(res.body.details.retry_after).toBeGreaterThan(0);
    });

    it('should rate limit per API key independently', async () => {
      const { deploymentId: dep1, apiKey: key1 } = await createReadyDeployment();
      const { deploymentId: dep2, apiKey: key2 } = await createReadyDeployment();

      // Make 100 requests with key1
      for (let i = 0; i < 100; i++) {
        await request(app)
          .post(`/api/v1/${dep1}/completions`)
          .set('Authorization', `Bearer ${key1}`)
          .send({ prompt: `Test ${i}` })
          .expect(200);
      }

      // key1 should be rate limited
      await request(app)
        .post(`/api/v1/${dep1}/completions`)
        .set('Authorization', `Bearer ${key1}`)
        .send({ prompt: 'Over limit' })
        .expect(429);

      // key2 should still work
      await request(app)
        .post(`/api/v1/${dep2}/completions`)
        .set('Authorization', `Bearer ${key2}`)
        .send({ prompt: 'Should work' })
        .expect(200);
    });
  });

  describe('Usage and Billing', () => {
    it('should aggregate tokens by day', async () => {
      const { apiKey, deploymentId } = await createReadyDeployment();

      // Create multiple completions
      await request(app)
        .post(`/api/v1/${deploymentId}/completions`)
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ prompt: 'First prompt here' })
        .expect(200);

      await request(app)
        .post(`/api/v1/${deploymentId}/completions`)
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ prompt: 'Second prompt here' })
        .expect(200);

      // Get usage aggregated by day
      const now = new Date();
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const to = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

      const res = await request(app)
        .get('/api/usage')
        .query({
          api_key: apiKey,
          from,
          to,
          group_by: 'day',
        })
        .expect(200);

      const body = res.body as UsageResponse;

      expect(body.api_key).toBe(apiKey);
      expect(body.group_by).toBe('day');
      expect(body.breakdown).toHaveLength(1);
      expect(body.totals.input_tokens).toBe(
        Math.round('First prompt here'.length / 4) + Math.round('Second prompt here'.length / 4)
      );
      expect(body.totals.output_tokens).toBeGreaterThanOrEqual(100);
    });

    it('should aggregate tokens by model', async () => {
      const { apiKey, deploymentId } = await createReadyDeployment('model-a');

      // Create completions
      await request(app)
        .post(`/api/v1/${deploymentId}/completions`)
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ prompt: 'Test prompt' })
        .expect(200);

      const now = new Date();
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const to = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

      const res = await request(app)
        .get('/api/usage')
        .query({
          api_key: apiKey,
          from,
          to,
          group_by: 'model',
        })
        .expect(200);

      const body = res.body as UsageResponse;

      expect(body.group_by).toBe('model');
      expect(body.breakdown).toHaveLength(1);
      expect(body.breakdown[0]?.key).toBe('model-a');
    });

    it('should calculate cost correctly', async () => {
      const { apiKey, deploymentId } = await createReadyDeployment();

      await request(app)
        .post(`/api/v1/${deploymentId}/completions`)
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ prompt: 'Test prompt for cost calculation' })
        .expect(200);

      const now = new Date();
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const to = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

      const res = await request(app)
        .get('/api/usage')
        .query({
          api_key: apiKey,
          from,
          to,
          group_by: 'day',
        })
        .expect(200);

      const body = res.body as UsageResponse;

      // Verify cost calculations
      const expectedInputCost = (body.totals.input_tokens / 1000) * 0.001;
      const expectedOutputCost = (body.totals.output_tokens / 1000) * 0.002;

      expect(body.totals.input_cost).toBeCloseTo(expectedInputCost, 6);
      expect(body.totals.output_cost).toBeCloseTo(expectedOutputCost, 6);
      expect(body.totals.total_cost).toBeCloseTo(expectedInputCost + expectedOutputCost, 6);
      expect(body.totals.total_tokens).toBe(body.totals.input_tokens + body.totals.output_tokens);
    });

    it('should return zeros for empty date range', async () => {
      const { apiKey } = await createReadyDeployment();

      // Query a date range with no usage
      const res = await request(app)
        .get('/api/usage')
        .query({
          api_key: apiKey,
          from: '2020-01-01T00:00:00.000Z',
          to: '2020-01-02T00:00:00.000Z',
          group_by: 'day',
        })
        .expect(200);

      const body = res.body as UsageResponse;

      expect(body.totals.input_tokens).toBe(0);
      expect(body.totals.output_tokens).toBe(0);
      expect(body.totals.total_tokens).toBe(0);
      expect(body.totals.input_cost).toBe(0);
      expect(body.totals.output_cost).toBe(0);
      expect(body.totals.total_cost).toBe(0);
      expect(body.breakdown).toHaveLength(0);
    });

    it('should validate required query parameters', async () => {
      // Missing all params
      const res1 = await request(app)
        .get('/api/usage')
        .expect(400);
      expect(res1.body).toHaveProperty('code', 'VALIDATION_ERROR');

      // Missing api_key
      const res2 = await request(app)
        .get('/api/usage')
        .query({
          from: '2026-01-01T00:00:00.000Z',
          to: '2026-01-31T23:59:59.999Z',
          group_by: 'day',
        })
        .expect(400);
      expect(res2.body).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(res2.body.details).toHaveProperty('field', 'api_key');

      // Missing from
      const res3 = await request(app)
        .get('/api/usage')
        .query({
          api_key: 'test-key',
          to: '2026-01-31T23:59:59.999Z',
          group_by: 'day',
        })
        .expect(400);
      expect(res3.body.details).toHaveProperty('field', 'from');

      // Missing to
      const res4 = await request(app)
        .get('/api/usage')
        .query({
          api_key: 'test-key',
          from: '2026-01-01T00:00:00.000Z',
          group_by: 'day',
        })
        .expect(400);
      expect(res4.body.details).toHaveProperty('field', 'to');

      // Missing group_by
      const res5 = await request(app)
        .get('/api/usage')
        .query({
          api_key: 'test-key',
          from: '2026-01-01T00:00:00.000Z',
          to: '2026-01-31T23:59:59.999Z',
        })
        .expect(400);
      expect(res5.body.details).toHaveProperty('field', 'group_by');
    });

    it('should validate date format', async () => {
      const res = await request(app)
        .get('/api/usage')
        .query({
          api_key: 'test-key',
          from: 'not-a-date',
          to: '2026-01-31T23:59:59.999Z',
          group_by: 'day',
        })
        .expect(400);

      expect(res.body).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(res.body.details).toHaveProperty('field', 'from');
    });

    it('should validate group_by value', async () => {
      const res = await request(app)
        .get('/api/usage')
        .query({
          api_key: 'test-key',
          from: '2026-01-01T00:00:00.000Z',
          to: '2026-01-31T23:59:59.999Z',
          group_by: 'invalid',
        })
        .expect(400);

      expect(res.body).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(res.body.details).toHaveProperty('field', 'group_by');
    });

    it('should validate date range (from must be before to)', async () => {
      const res = await request(app)
        .get('/api/usage')
        .query({
          api_key: 'test-key',
          from: '2026-01-31T00:00:00.000Z',
          to: '2026-01-01T00:00:00.000Z',
          group_by: 'day',
        })
        .expect(400);

      expect(res.body).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(res.body.details).toHaveProperty('field', 'date_range');
    });

    it('should group by UTC date correctly', async () => {
      const { apiKey, deploymentId } = await createReadyDeployment();

      // Create a usage event
      await request(app)
        .post(`/api/v1/${deploymentId}/completions`)
        .set('Authorization', `Bearer ${apiKey}`)
        .send({ prompt: 'Test' })
        .expect(200);

      const now = new Date();
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const to = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

      const res = await request(app)
        .get('/api/usage')
        .query({
          api_key: apiKey,
          from,
          to,
          group_by: 'day',
        })
        .expect(200);

      const body = res.body as UsageResponse;

      // The key should be in YYYY-MM-DD format
      expect(body.breakdown[0]?.key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
