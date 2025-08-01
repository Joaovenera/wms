import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ImageService } from '../../../services/image.service';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

// Mock dependencies
vi.mock('sharp');
vi.mock('fs/promises');
vi.mock('../../../utils/logger');

describe('ImageService Unit Tests', () => {
  let service: ImageService;
  let mockSharp: any;
  let mockBuffer: Buffer;

  beforeEach(() => {
    service = new ImageService();
    mockBuffer = Buffer.from('mock image data');
    
    // Setup sharp mock
    mockSharp = {
      resize: vi.fn().mockReturnThis(),
      jpeg: vi.fn().mockReturnThis(),
      png: vi.fn().mockReturnThis(),
      webp: vi.fn().mockReturnThis(),
      toBuffer: vi.fn().mockResolvedValue(mockBuffer),
      toFile: vi.fn().mockResolvedValue({ size: 1024 }),
      metadata: vi.fn().mockResolvedValue({
        width: 1920,
        height: 1080,
        format: 'jpeg',
        size: 2048000,
      }),
    };
    
    vi.mocked(sharp).mockImplementation(() => mockSharp);
    vi.mocked(fs.writeFile).mockResolvedValue();
    vi.mocked(fs.unlink).mockResolvedValue();
    vi.mocked(fs.access).mockResolvedValue();
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('uploadImage', () => {
    it('should upload image with valid data', async () => {
      const imageData = {
        buffer: mockBuffer,
        originalname: 'test-image.jpg',
        mimetype: 'image/jpeg',
        size: 1024000,
      };

      const result = await service.uploadImage(imageData);

      expect(result).toHaveProperty('filename');
      expect(result).toHaveProperty('path');
      expect(result).toHaveProperty('size');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata.format).toBe('jpeg');
      expect(result.metadata.width).toBe(1920);
      expect(result.metadata.height).toBe(1080);
    });

    it('should generate unique filename for upload', async () => {
      const imageData = {
        buffer: mockBuffer,
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024000,
      };

      const result1 = await service.uploadImage(imageData);
      const result2 = await service.uploadImage(imageData);

      expect(result1.filename).not.toBe(result2.filename);
    });

    it('should validate image format', async () => {
      const invalidImageData = {
        buffer: Buffer.from('not an image'),
        originalname: 'test.txt',
        mimetype: 'text/plain',
        size: 100,
      };

      await expect(service.uploadImage(invalidImageData))
        .rejects.toThrow('Invalid image format');
    });

    it('should validate image size limits', async () => {
      const largeImageData = {
        buffer: mockBuffer,
        originalname: 'large.jpg',
        mimetype: 'image/jpeg',
        size: 20 * 1024 * 1024, // 20MB
      };

      await expect(service.uploadImage(largeImageData))
        .rejects.toThrow('Image size exceeds maximum limit');
    });

    it('should handle upload errors gracefully', async () => {
      const imageData = {
        buffer: mockBuffer,
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024000,
      };

      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Disk full'));

      await expect(service.uploadImage(imageData))
        .rejects.toThrow('Failed to upload image');
    });
  });

  describe('deleteImage', () => {
    it('should delete existing image', async () => {
      const filename = 'test-image.jpg';

      await service.deleteImage(filename);

      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining(filename)
      );
    });

    it('should handle non-existent file gracefully', async () => {
      const filename = 'non-existent.jpg';
      
      vi.mocked(fs.unlink).mockRejectedValue(
        Object.assign(new Error('File not found'), { code: 'ENOENT' })
      );

      await expect(service.deleteImage(filename)).resolves.toBeUndefined();
    });

    it('should throw error for other deletion failures', async () => {
      const filename = 'test.jpg';
      
      vi.mocked(fs.unlink).mockRejectedValue(new Error('Permission denied'));

      await expect(service.deleteImage(filename))
        .rejects.toThrow('Failed to delete image');
    });
  });

  describe('resizeImage', () => {
    it('should resize image to specified dimensions', async () => {
      const inputPath = '/path/to/input.jpg';
      const outputPath = '/path/to/output.jpg';
      const width = 800;
      const height = 600;

      await service.resizeImage(inputPath, outputPath, width, height);

      expect(sharp).toHaveBeenCalledWith(inputPath);
      expect(mockSharp.resize).toHaveBeenCalledWith(width, height);
      expect(mockSharp.toFile).toHaveBeenCalledWith(outputPath);
    });

    it('should maintain aspect ratio when only width provided', async () => {
      const inputPath = '/path/to/input.jpg';
      const outputPath = '/path/to/output.jpg';
      const width = 800;

      await service.resizeImage(inputPath, outputPath, width);

      expect(mockSharp.resize).toHaveBeenCalledWith(width, null);
    });

    it('should handle resize errors', async () => {
      const inputPath = '/path/to/input.jpg';
      const outputPath = '/path/to/output.jpg';
      
      mockSharp.toFile.mockRejectedValue(new Error('Resize failed'));

      await expect(service.resizeImage(inputPath, outputPath, 800))
        .rejects.toThrow('Failed to resize image');
    });
  });

  describe('generateThumbnail', () => {
    it('should generate thumbnail with default dimensions', async () => {
      const inputPath = '/path/to/input.jpg';
      const outputPath = '/path/to/thumb.jpg';

      await service.generateThumbnail(inputPath, outputPath);

      expect(mockSharp.resize).toHaveBeenCalledWith(200, 200);
      expect(mockSharp.jpeg).toHaveBeenCalledWith({ quality: 80 });
    });

    it('should generate thumbnail with custom dimensions', async () => {
      const inputPath = '/path/to/input.jpg';
      const outputPath = '/path/to/thumb.jpg';
      const size = 150;

      await service.generateThumbnail(inputPath, outputPath, size);

      expect(mockSharp.resize).toHaveBeenCalledWith(size, size);
    });

    it('should optimize thumbnail quality', async () => {
      const inputPath = '/path/to/input.jpg';
      const outputPath = '/path/to/thumb.jpg';

      await service.generateThumbnail(inputPath, outputPath);

      expect(mockSharp.jpeg).toHaveBeenCalledWith({ quality: 80 });
    });
  });

  describe('validateImageFormat', () => {
    it('should validate JPEG format', async () => {
      mockSharp.metadata.mockResolvedValue({ format: 'jpeg' });

      const result = await service.validateImageFormat(mockBuffer);

      expect(result.isValid).toBe(true);
      expect(result.format).toBe('jpeg');
    });

    it('should validate PNG format', async () => {
      mockSharp.metadata.mockResolvedValue({ format: 'png' });

      const result = await service.validateImageFormat(mockBuffer);

      expect(result.isValid).toBe(true);
      expect(result.format).toBe('png');
    });

    it('should validate WebP format', async () => {
      mockSharp.metadata.mockResolvedValue({ format: 'webp' });

      const result = await service.validateImageFormat(mockBuffer);

      expect(result.isValid).toBe(true);
      expect(result.format).toBe('webp');
    });

    it('should reject unsupported formats', async () => {
      mockSharp.metadata.mockResolvedValue({ format: 'bmp' });

      const result = await service.validateImageFormat(mockBuffer);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unsupported image format');
    });

    it('should handle corrupted image files', async () => {
      mockSharp.metadata.mockRejectedValue(new Error('Invalid image'));

      const result = await service.validateImageFormat(mockBuffer);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid or corrupted image');
    });
  });

  describe('optimizeImage', () => {
    it('should optimize JPEG images', async () => {
      const inputPath = '/path/to/input.jpg';
      const outputPath = '/path/to/optimized.jpg';

      mockSharp.metadata.mockResolvedValue({ format: 'jpeg' });

      await service.optimizeImage(inputPath, outputPath);

      expect(mockSharp.jpeg).toHaveBeenCalledWith({
        quality: 85,
        progressive: true,
        mozjpeg: true,
      });
    });

    it('should optimize PNG images', async () => {
      const inputPath = '/path/to/input.png';
      const outputPath = '/path/to/optimized.png';

      mockSharp.metadata.mockResolvedValue({ format: 'png' });

      await service.optimizeImage(inputPath, outputPath);

      expect(mockSharp.png).toHaveBeenCalledWith({
        progressive: true,
        compressionLevel: 9,
      });
    });

    it('should optimize WebP images', async () => {
      const inputPath = '/path/to/input.webp';
      const outputPath = '/path/to/optimized.webp';

      mockSharp.metadata.mockResolvedValue({ format: 'webp' });

      await service.optimizeImage(inputPath, outputPath);

      expect(mockSharp.webp).toHaveBeenCalledWith({
        quality: 85,
        lossless: false,
      });
    });

    it('should calculate optimization savings', async () => {
      const inputPath = '/path/to/input.jpg';
      const outputPath = '/path/to/optimized.jpg';

      mockSharp.metadata.mockResolvedValue({ format: 'jpeg', size: 2048000 });
      mockSharp.toFile.mockResolvedValue({ size: 1024000 });

      const result = await service.optimizeImage(inputPath, outputPath);

      expect(result.originalSize).toBe(2048000);
      expect(result.optimizedSize).toBe(1024000);
      expect(result.savings).toBe(50); // 50% reduction
    });
  });

  describe('getImageMetadata', () => {
    it('should extract comprehensive metadata', async () => {
      const imagePath = '/path/to/image.jpg';

      mockSharp.metadata.mockResolvedValue({
        format: 'jpeg',
        width: 1920,
        height: 1080,
        channels: 3,
        density: 72,
        space: 'srgb',
        hasProfile: false,
        hasAlpha: false,
        size: 2048000,
      });

      const metadata = await service.getImageMetadata(imagePath);

      expect(metadata.format).toBe('jpeg');
      expect(metadata.dimensions).toEqual({ width: 1920, height: 1080 });
      expect(metadata.fileSize).toBe(2048000);
      expect(metadata.colorSpace).toBe('srgb');
      expect(metadata.hasAlpha).toBe(false);
    });

    it('should handle metadata extraction errors', async () => {
      const imagePath = '/path/to/invalid.jpg';

      mockSharp.metadata.mockRejectedValue(new Error('Invalid image'));

      await expect(service.getImageMetadata(imagePath))
        .rejects.toThrow('Failed to extract image metadata');
    });
  });

  describe('createImageVariants', () => {
    it('should create multiple image variants', async () => {
      const inputPath = '/path/to/input.jpg';
      const outputDir = '/path/to/variants';

      const variants = [
        { name: 'thumbnail', width: 200, height: 200 },
        { name: 'medium', width: 800, height: 600 },
        { name: 'large', width: 1200, height: 900 },
      ];

      const results = await service.createImageVariants(inputPath, outputDir, variants);

      expect(results).toHaveLength(3);
      expect(mockSharp.resize).toHaveBeenCalledTimes(3);
      expect(mockSharp.toFile).toHaveBeenCalledTimes(3);

      results.forEach((result, index) => {
        expect(result.name).toBe(variants[index].name);
        expect(result.width).toBe(variants[index].width);
        expect(result.height).toBe(variants[index].height);
        expect(result.path).toContain(variants[index].name);
      });
    });

    it('should handle variant creation errors', async () => {
      const inputPath = '/path/to/input.jpg';
      const outputDir = '/path/to/variants';
      const variants = [{ name: 'thumbnail', width: 200, height: 200 }];

      mockSharp.toFile.mockRejectedValue(new Error('Write failed'));

      await expect(service.createImageVariants(inputPath, outputDir, variants))
        .rejects.toThrow('Failed to create image variants');
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle concurrent image processing', async () => {
      const imageData = {
        buffer: mockBuffer,
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024000,
      };

      const promises = Array.from({ length: 5 }, () => 
        service.uploadImage(imageData)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toHaveProperty('filename');
        expect(result).toHaveProperty('path');
      });
    });

    it('should handle very large images', async () => {
      const largeMetadata = {
        width: 8000,
        height: 6000,
        format: 'jpeg',
        size: 50 * 1024 * 1024, // 50MB
      };

      mockSharp.metadata.mockResolvedValue(largeMetadata);

      const inputPath = '/path/to/large.jpg';
      const outputPath = '/path/to/resized.jpg';

      await service.resizeImage(inputPath, outputPath, 2000, 1500);

      expect(mockSharp.resize).toHaveBeenCalledWith(2000, 1500);
    });

    it('should handle memory constraints gracefully', async () => {
      const inputPath = '/path/to/input.jpg';
      const outputPath = '/path/to/output.jpg';

      mockSharp.toFile.mockRejectedValue(
        Object.assign(new Error('Out of memory'), { code: 'ENOMEM' })
      );

      await expect(service.resizeImage(inputPath, outputPath, 800))
        .rejects.toThrow('Insufficient memory for image processing');
    });

    it('should validate file paths security', async () => {
      const maliciousPath = '../../../etc/passwd';

      await expect(service.deleteImage(maliciousPath))
        .rejects.toThrow('Invalid file path');
    });

    it('should handle corrupted image gracefully', async () => {
      const corruptedBuffer = Buffer.from('corrupted data');

      mockSharp.metadata.mockRejectedValue(new Error('VipsJpeg: Premature end of JPEG file'));

      const result = await service.validateImageFormat(corruptedBuffer);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid or corrupted image');
    });
  });

  describe('Integration with File System', () => {
    it('should create directories if they do not exist', async () => {
      const imageData = {
        buffer: mockBuffer,
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024000,
      };

      vi.mocked(fs.access).mockRejectedValue(new Error('Directory not found'));

      await service.uploadImage(imageData);

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true }
      );
    });

    it('should handle permission errors', async () => {
      const imageData = {
        buffer: mockBuffer,
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024000,
      };

      vi.mocked(fs.writeFile).mockRejectedValue(
        Object.assign(new Error('Permission denied'), { code: 'EACCES' })
      );

      await expect(service.uploadImage(imageData))
        .rejects.toThrow('Permission denied');
    });
  });
});