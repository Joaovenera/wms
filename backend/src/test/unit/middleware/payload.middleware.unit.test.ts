import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { 
  validatePayload, 
  sanitizePayload, 
  limitPayloadSize,
  parseJsonPayload,
  validateFileUpload 
} from '../../../middleware/payload.middleware';
import { createMockRequest, createMockResponse } from '../../utils/test-helpers';
import { z } from 'zod';

// Mock dependencies
vi.mock('../../../utils/logger');

describe('Payload Middleware Unit Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockJson: ReturnType<typeof vi.fn>;
  let mockStatus: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockJson = vi.fn();
    mockStatus = vi.fn().mockReturnValue({ json: mockJson });
    mockNext = vi.fn();
    
    mockRequest = createMockRequest();
    mockResponse = createMockResponse();
    mockResponse.json = mockJson;
    mockResponse.status = mockStatus;
    
    vi.clearAllMocks();
  });

  describe('validatePayload middleware', () => {
    const productSchema = z.object({
      name: z.string().min(1).max(100),
      sku: z.string().regex(/^[A-Z0-9-]+$/),
      price: z.number().positive(),
      category: z.enum(['electronics', 'clothing', 'food']),
      description: z.string().optional(),
    });

    it('should pass validation with valid payload', async () => {
      const validPayload = {
        name: 'Test Product',
        sku: 'PROD-001',
        price: 29.99,
        category: 'electronics',
        description: 'A test product',
      };
      
      mockRequest.body = validPayload;
      const middleware = validatePayload(productSchema);
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockStatus).not.toHaveBeenCalled();
      expect(mockRequest.body).toEqual(validPayload);
    });

    it('should fail validation with invalid payload', async () => {
      const invalidPayload = {
        name: '', // Too short
        sku: 'invalid sku', // Contains spaces
        price: -5, // Negative
        category: 'invalid', // Not in enum
      };
      
      mockRequest.body = invalidPayload;
      const middleware = validatePayload(productSchema);
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({
            field: 'name',
            message: expect.stringContaining('at least 1 character')
          }),
          expect.objectContaining({
            field: 'sku',
            message: expect.stringContaining('Invalid')
          }),
          expect.objectContaining({
            field: 'price',
            message: expect.stringContaining('greater than 0')
          }),
          expect.objectContaining({
            field: 'category',
            message: expect.stringContaining('Invalid enum value')
          }),
        ])
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle missing required fields', async () => {
      const incompletePayload = {
        name: 'Test Product',
        // Missing sku, price, category
      };
      
      mockRequest.body = incompletePayload;
      const middleware = validatePayload(productSchema);
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({ field: 'sku' }),
          expect.objectContaining({ field: 'price' }),
          expect.objectContaining({ field: 'category' }),
        ])
      });
    });

    it('should handle empty request body', async () => {
      mockRequest.body = undefined;
      const middleware = validatePayload(productSchema);
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Request body is required'
      });
    });

    it('should transform and coerce valid data types', async () => {
      const payloadWithStrings = {
        name: 'Test Product',
        sku: 'PROD-001',
        price: '29.99', // String that should be coerced to number
        category: 'electronics',
      };
      
      const transformSchema = productSchema.extend({
        price: z.coerce.number().positive(),
      });
      
      mockRequest.body = payloadWithStrings;
      const middleware = validatePayload(transformSchema);
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRequest.body.price).toBe(29.99);
      expect(typeof mockRequest.body.price).toBe('number');
    });

    it('should handle nested object validation', async () => {
      const nestedSchema = z.object({
        product: z.object({
          name: z.string(),
          specs: z.object({
            weight: z.number(),
            dimensions: z.object({
              length: z.number(),
              width: z.number(),
              height: z.number(),
            }),
          }),
        }),
      });
      
      const validNestedPayload = {
        product: {
          name: 'Test Product',
          specs: {
            weight: 1.5,
            dimensions: {
              length: 10,
              width: 5,
              height: 3,
            },
          },
        },
      };
      
      mockRequest.body = validNestedPayload;
      const middleware = validatePayload(nestedSchema);
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should handle array validation', async () => {
      const arraySchema = z.object({
        items: z.array(z.object({
          id: z.number(),
          quantity: z.number().positive(),
        })),
      });
      
      const validArrayPayload = {
        items: [
          { id: 1, quantity: 5 },
          { id: 2, quantity: 3 },
        ],
      };
      
      mockRequest.body = validArrayPayload;
      const middleware = validatePayload(arraySchema);
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('sanitizePayload middleware', () => {
    it('should sanitize HTML content', async () => {
      const payloadWithHtml = {
        name: 'Product <script>alert("xss")</script>',
        description: '<p>Safe paragraph</p><script>evil()</script>',
        notes: 'Simple text',
      };
      
      mockRequest.body = payloadWithHtml;
      
      await sanitizePayload(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockRequest.body.name).toBe('Product ');
      expect(mockRequest.body.description).toBe('<p>Safe paragraph</p>');
      expect(mockRequest.body.notes).toBe('Simple text');
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should sanitize nested objects', async () => {
      const nestedPayload = {
        product: {
          name: 'Test <script>alert("nested")</script>',
          specs: {
            description: '<b>Bold text</b><script>bad()</script>',
          },
        },
        metadata: {
          notes: 'Clean text',
        },
      };
      
      mockRequest.body = nestedPayload;
      
      await sanitizePayload(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockRequest.body.product.name).toBe('Test ');
      expect(mockRequest.body.product.specs.description).toBe('<b>Bold text</b>');
      expect(mockRequest.body.metadata.notes).toBe('Clean text');
    });

    it('should sanitize arrays', async () => {
      const payloadWithArray = {
        items: [
          { name: 'Item 1 <script>evil()</script>' },
          { name: 'Item 2 <b>bold</b>' },
        ],
      };
      
      mockRequest.body = payloadWithArray;
      
      await sanitizePayload(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockRequest.body.items[0].name).toBe('Item 1 ');
      expect(mockRequest.body.items[1].name).toBe('Item 2 <b>bold</b>');
    });

    it('should preserve safe HTML tags', async () => {
      const payloadWithSafeHtml = {
        description: '<p>Paragraph</p><strong>Strong text</strong><em>Emphasized</em>',
      };
      
      mockRequest.body = payloadWithSafeHtml;
      
      await sanitizePayload(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockRequest.body.description).toContain('<p>');
      expect(mockRequest.body.description).toContain('<strong>');
      expect(mockRequest.body.description).toContain('<em>');
    });

    it('should handle non-string values safely', async () => {
      const mixedPayload = {
        id: 123,
        active: true,
        price: 29.99,
        tags: ['tag1', 'tag2'],
        name: 'Product <script>alert()</script>',
      };
      
      mockRequest.body = mixedPayload;
      
      await sanitizePayload(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockRequest.body.id).toBe(123);
      expect(mockRequest.body.active).toBe(true);
      expect(mockRequest.body.price).toBe(29.99);
      expect(mockRequest.body.tags).toEqual(['tag1', 'tag2']);
      expect(mockRequest.body.name).toBe('Product ');
    });

    it('should handle empty or undefined body', async () => {
      mockRequest.body = undefined;
      
      await sanitizePayload(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('limitPayloadSize middleware', () => {
    it('should pass requests within size limit', async () => {
      const smallPayload = { message: 'Small payload' };
      mockRequest.body = smallPayload;
      
      // Mock content-length header
      mockRequest.headers = { 'content-length': '50' };
      
      const middleware = limitPayloadSize(1000); // 1KB limit
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockStatus).not.toHaveBeenCalled();
    });

    it('should reject requests exceeding size limit', async () => {
      const largePayload = { message: 'x'.repeat(2000) };
      mockRequest.body = largePayload;
      mockRequest.headers = { 'content-length': '2100' };
      
      const middleware = limitPayloadSize(1000); // 1KB limit
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockStatus).toHaveBeenCalledWith(413);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Payload too large',
        maxSize: 1000,
        actualSize: 2100,
        unit: 'bytes'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle missing content-length header', async () => {
      const payload = { message: 'Test' };
      mockRequest.body = payload;
      mockRequest.headers = {};
      
      const middleware = limitPayloadSize(1000);
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      // Should estimate size from body
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should handle different size units', async () => {
      mockRequest.body = { message: 'test' };
      mockRequest.headers = { 'content-length': '2048' };
      
      const middleware = limitPayloadSize(1, 'KB'); // 1KB = 1024 bytes
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockStatus).toHaveBeenCalledWith(413);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Payload too large',
        maxSize: 1,
        actualSize: expect.any(Number),
        unit: 'KB'
      });
    });
  });

  describe('parseJsonPayload middleware', () => {
    it('should parse valid JSON strings in payload', async () => {
      const payloadWithJsonString = {
        metadata: '{"key": "value", "count": 5}',
        settings: '{"enabled": true, "options": ["a", "b"]}',
        normalField: 'normal string',
      };
      
      mockRequest.body = payloadWithJsonString;
      
      await parseJsonPayload(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockRequest.body.metadata).toEqual({ key: 'value', count: 5 });
      expect(mockRequest.body.settings).toEqual({ enabled: true, options: ['a', 'b'] });
      expect(mockRequest.body.normalField).toBe('normal string');
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should handle invalid JSON gracefully', async () => {
      const payloadWithInvalidJson = {
        validJson: '{"key": "value"}',
        invalidJson: '{"key": invalid}',
        normalString: 'not json',
      };
      
      mockRequest.body = payloadWithInvalidJson;
      
      await parseJsonPayload(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockRequest.body.validJson).toEqual({ key: 'value' });
      expect(mockRequest.body.invalidJson).toBe('{"key": invalid}'); // Left as string
      expect(mockRequest.body.normalString).toBe('not json');
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should handle nested objects with JSON strings', async () => {
      const nestedPayload = {
        config: {
          settings: '{"theme": "dark", "language": "en"}',
          metadata: '{"version": 1}',
        },
        items: [
          { data: '{"id": 1, "name": "item1"}' },
          { data: '{"id": 2, "name": "item2"}' },
        ],
      };
      
      mockRequest.body = nestedPayload;
      
      await parseJsonPayload(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockRequest.body.config.settings).toEqual({ theme: 'dark', language: 'en' });
      expect(mockRequest.body.config.metadata).toEqual({ version: 1 });
      expect(mockRequest.body.items[0].data).toEqual({ id: 1, name: 'item1' });
      expect(mockRequest.body.items[1].data).toEqual({ id: 2, name: 'item2' });
    });

    it('should skip non-string values', async () => {
      const mixedPayload = {
        jsonString: '{"parsed": true}',
        number: 123,
        boolean: false,
        array: [1, 2, 3],
        object: { key: 'value' },
        nullValue: null,
      };
      
      mockRequest.body = mixedPayload;
      
      await parseJsonPayload(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockRequest.body.jsonString).toEqual({ parsed: true });
      expect(mockRequest.body.number).toBe(123);
      expect(mockRequest.body.boolean).toBe(false);
      expect(mockRequest.body.array).toEqual([1, 2, 3]);
      expect(mockRequest.body.object).toEqual({ key: 'value' });
      expect(mockRequest.body.nullValue).toBeNull();
    });
  });

  describe('validateFileUpload middleware', () => {
    const createMockFile = (overrides = {}) => ({
      fieldname: 'file',
      originalname: 'test.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 1024000, // 1MB
      buffer: Buffer.from('fake file content'),
      ...overrides,
    });

    it('should validate single file upload', async () => {
      const mockFile = createMockFile();
      mockRequest.file = mockFile as any;
      
      const options = {
        allowedMimeTypes: ['image/jpeg', 'image/png'],
        maxSize: 5 * 1024 * 1024, // 5MB
      };
      
      const middleware = validateFileUpload(options);
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockStatus).not.toHaveBeenCalled();
    });

    it('should validate multiple file uploads', async () => {
      const mockFiles = [
        createMockFile({ originalname: 'file1.jpg' }),
        createMockFile({ originalname: 'file2.png', mimetype: 'image/png' }),
      ];
      mockRequest.files = mockFiles as any;
      
      const options = {
        allowedMimeTypes: ['image/jpeg', 'image/png'],
        maxSize: 5 * 1024 * 1024,
        maxCount: 5,
      };
      
      const middleware = validateFileUpload(options);
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject files with invalid mime types', async () => {
      const mockFile = createMockFile({ mimetype: 'text/plain' });
      mockRequest.file = mockFile as any;
      
      const options = {
        allowedMimeTypes: ['image/jpeg', 'image/png'],
      };
      
      const middleware = validateFileUpload(options);
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Invalid file type',
        allowedTypes: ['image/jpeg', 'image/png'],
        receivedType: 'text/plain',
        fileName: 'test.jpg'
      });
    });

    it('should reject files exceeding size limit', async () => {
      const mockFile = createMockFile({ size: 10 * 1024 * 1024 }); // 10MB
      mockRequest.file = mockFile as any;
      
      const options = {
        maxSize: 5 * 1024 * 1024, // 5MB limit
      };
      
      const middleware = validateFileUpload(options);
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'File too large',
        maxSize: 5242880,
        actualSize: 10485760,
        fileName: 'test.jpg'
      });
    });

    it('should reject too many files', async () => {
      const mockFiles = Array.from({ length: 6 }, (_, i) => 
        createMockFile({ originalname: `file${i}.jpg` })
      );
      mockRequest.files = mockFiles as any;
      
      const options = {
        maxCount: 5,
      };
      
      const middleware = validateFileUpload(options);
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Too many files',
        maxCount: 5,
        actualCount: 6
      });
    });

    it('should validate file names', async () => {
      const mockFile = createMockFile({ originalname: '../../../etc/passwd' });
      mockRequest.file = mockFile as any;
      
      const options = {
        validateFileName: true,
      };
      
      const middleware = validateFileUpload(options);
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Invalid file name',
        fileName: '../../../etc/passwd',
        reason: 'File name contains invalid characters or path traversal'
      });
    });

    it('should handle missing file when required', async () => {
      mockRequest.file = undefined;
      mockRequest.files = undefined;
      
      const options = {
        required: true,
      };
      
      const middleware = validateFileUpload(options);
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'File upload is required'
      });
    });

    it('should skip validation when no file and not required', async () => {
      mockRequest.file = undefined;
      mockRequest.files = undefined;
      
      const options = {
        required: false,
      };
      
      const middleware = validateFileUpload(options);
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockStatus).not.toHaveBeenCalled();
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle extremely large payloads gracefully', async () => {
      const hugePayload = { data: 'x'.repeat(100 * 1024 * 1024) }; // 100MB
      mockRequest.body = hugePayload;
      mockRequest.headers = { 'content-length': (100 * 1024 * 1024).toString() };
      
      const middleware = limitPayloadSize(10 * 1024 * 1024); // 10MB limit
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockStatus).toHaveBeenCalledWith(413);
    });

    it('should handle circular references in sanitization', async () => {
      const circularPayload: any = { name: 'Test' };
      circularPayload.self = circularPayload;
      
      mockRequest.body = circularPayload;
      
      await sanitizePayload(mockRequest as Request, mockResponse as Response, mockNext);
      
      // Should handle gracefully without throwing
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should handle malformed JSON in parseJsonPayload', async () => {
      const payloadWithBadJson = {
        data: '{"key": "value"',  // Missing closing brace
        other: 'normal',
      };
      
      mockRequest.body = payloadWithBadJson;
      
      await parseJsonPayload(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockRequest.body.data).toBe('{"key": "value"'); // Left unchanged
      expect(mockRequest.body.other).toBe('normal');
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should handle empty files in validation', async () => {
      const emptyFile = createMockFile({ size: 0, buffer: Buffer.alloc(0) });
      mockRequest.file = emptyFile as any;
      
      const options = {
        minSize: 1,
      };
      
      const middleware = validateFileUpload(options);
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'File is empty',
        fileName: 'test.jpg'
      });
    });
  });
});