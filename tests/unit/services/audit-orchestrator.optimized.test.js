// tests/unit/services/audit-orchestrator.optimized.test.js
// Basic tests for the optimized audit orchestrator

const OptimizedAuditOrchestrator = require('../../../services/audit-orchestrator.optimized');

describe('Services - OptimizedAuditOrchestrator', () => {
    let orchestrator;

    beforeEach(() => {
        orchestrator = new OptimizedAuditOrchestrator();
    });

    describe('Constructor', () => {
        test('should initialize without errors', () => {
            expect(orchestrator).toBeInstanceOf(OptimizedAuditOrchestrator);
            expect(orchestrator.puppeteer).toBeNull();
            expect(orchestrator.lighthouse).toBeNull();
        });
    });

    describe('performLightweightAudit', () => {
        test('should handle invalid URL gracefully', async () => {
            await expect(orchestrator.performLightweightAudit('invalid-url'))
                .rejects
                .toThrow('Invalid URL format');
        }, 10000);

        test('should return structured results for valid URL', async () => {
            // Using a simple, fast-loading URL for testing
            const result = await orchestrator.performLightweightAudit('https://httpbin.org/html');
            
            expect(result).toHaveProperty('url');
            expect(result).toHaveProperty('tests');
            expect(result.tests).toHaveProperty('performance');
            expect(result.tests).toHaveProperty('files');
            
            // Performance test should have succeeded
            expect(result.tests.performance).not.toHaveProperty('error');
            expect(result.tests.performance).toHaveProperty('responseTime');
            
            // Files test should have succeeded
            expect(result.tests.files).not.toHaveProperty('error');
            expect(result.tests.files).toHaveProperty('robots');
            expect(result.tests.files).toHaveProperty('sitemap');
        }, 15000);
    });

    describe('checkBasicFiles', () => {
        test('should check for basic files', async () => {
            const result = await orchestrator.checkBasicFiles('https://httpbin.org/html');
            
            expect(result).toHaveProperty('robots');
            expect(result).toHaveProperty('sitemap');
            expect(result.robots).toHaveProperty('exists');
            expect(result.sitemap).toHaveProperty('exists');
        }, 10000);
    });

    describe('checkBasicPerformance', () => {
        test('should return performance metrics', async () => {
            const result = await orchestrator.checkBasicPerformance('https://httpbin.org/html');
            
            expect(result).toHaveProperty('responseTime');
            expect(result).toHaveProperty('statusCode');
            expect(result).toHaveProperty('contentLength');
            expect(result).toHaveProperty('score');
            expect(typeof result.responseTime).toBe('number');
            expect(typeof result.statusCode).toBe('number');
        }, 10000);
    });
});