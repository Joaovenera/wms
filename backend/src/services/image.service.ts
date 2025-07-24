import sharp from 'sharp';
import { logInfo, logError } from '../utils/logger';

export interface ProcessedImage {
  original: string;
  thumbnail: string;
  width?: number;
  height?: number;
  size: number;
}

export interface ImageProcessingOptions {
  thumbnailMaxSize?: number;
  thumbnailQuality?: number;
  maintainAspectRatio?: boolean;
}

export class ImageService {
  private readonly DEFAULT_THUMBNAIL_SIZE = 300;
  private readonly DEFAULT_THUMBNAIL_QUALITY = 85;

  /**
   * Process a base64 image to generate thumbnail and original versions
   * @param base64Data - Base64 image data (with or without data URL prefix)
   * @param options - Processing options
   * @returns ProcessedImage with original and thumbnail base64 data
   */
  async processImage(
    base64Data: string, 
    options: ImageProcessingOptions = {}
  ): Promise<ProcessedImage> {
    try {
      const {
        thumbnailMaxSize = this.DEFAULT_THUMBNAIL_SIZE,
        thumbnailQuality = this.DEFAULT_THUMBNAIL_QUALITY,
        maintainAspectRatio = true
      } = options;

      // Clean base64 data (remove data URL prefix if present)
      const cleanBase64 = this.cleanBase64Data(base64Data);
      
      // Convert base64 to buffer
      const imageBuffer = Buffer.from(cleanBase64, 'base64');
      
      logInfo('Processing image', {
        originalSize: imageBuffer.length,
        thumbnailMaxSize,
        thumbnailQuality
      });

      // Get image metadata
      const metadata = await sharp(imageBuffer).metadata();
      
      // Process thumbnail
      const thumbnailBuffer = await sharp(imageBuffer)
        .resize(thumbnailMaxSize, thumbnailMaxSize, {
          fit: maintainAspectRatio ? 'inside' : 'cover',
          withoutEnlargement: true
        })
        .jpeg({ quality: thumbnailQuality })
        .toBuffer();

      // Convert back to base64 with data URL prefix
      const originalMimeType = this.getMimeTypeFromMetadata(metadata);
      const originalDataUrl = `data:${originalMimeType};base64,${cleanBase64}`;
      const thumbnailDataUrl = `data:image/jpeg;base64,${thumbnailBuffer.toString('base64')}`;

      const result: ProcessedImage = {
        original: originalDataUrl,
        thumbnail: thumbnailDataUrl,
        width: metadata.width,
        height: metadata.height,
        size: imageBuffer.length
      };

      logInfo('Image processed successfully', {
        originalSize: imageBuffer.length,
        thumbnailSize: thumbnailBuffer.length,
        compressionRatio: Math.round((1 - thumbnailBuffer.length / imageBuffer.length) * 100),
        dimensions: `${metadata.width}x${metadata.height}`
      });

      return result;

    } catch (error) {
      logError('Error processing image', error as Error);
      throw new Error(`Failed to process image: ${(error as Error).message}`);
    }
  }

  /**
   * Generate thumbnail from existing base64 image
   * @param base64Data - Base64 image data
   * @param options - Processing options
   * @returns Base64 thumbnail data
   */
  async generateThumbnail(
    base64Data: string,
    options: ImageProcessingOptions = {}
  ): Promise<string> {
    const processed = await this.processImage(base64Data, options);
    return processed.thumbnail;
  }

  /**
   * Clean base64 data by removing data URL prefix if present
   * @param base64Data - Raw base64 data or data URL
   * @returns Clean base64 string
   */
  private cleanBase64Data(base64Data: string): string {
    // Remove data URL prefix if present (data:image/jpeg;base64,)
    if (base64Data.startsWith('data:')) {
      const base64Index = base64Data.indexOf(',');
      if (base64Index !== -1) {
        return base64Data.substring(base64Index + 1);
      }
    }
    return base64Data;
  }

  /**
   * Get MIME type from Sharp metadata
   * @param metadata - Sharp metadata object
   * @returns MIME type string
   */
  private getMimeTypeFromMetadata(metadata: sharp.Metadata): string {
    const format = metadata.format;
    switch (format) {
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      case 'tiff':
        return 'image/tiff';
      default:
        return 'image/jpeg'; // Default fallback
    }
  }

  /**
   * Validate if base64 string is a valid image
   * @param base64Data - Base64 image data
   * @returns Promise<boolean>
   */
  async isValidImage(base64Data: string): Promise<boolean> {
    try {
      const cleanBase64 = this.cleanBase64Data(base64Data);
      const imageBuffer = Buffer.from(cleanBase64, 'base64');
      
      // Sharp will throw if not a valid image
      await sharp(imageBuffer).metadata();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get image dimensions from base64 data
   * @param base64Data - Base64 image data
   * @returns Object with width and height
   */
  async getImageDimensions(base64Data: string): Promise<{ width?: number; height?: number }> {
    try {
      const cleanBase64 = this.cleanBase64Data(base64Data);
      const imageBuffer = Buffer.from(cleanBase64, 'base64');
      const metadata = await sharp(imageBuffer).metadata();
      
      return {
        width: metadata.width,
        height: metadata.height
      };
    } catch (error) {
      logError('Error getting image dimensions', error as Error);
      return {};
    }
  }
}

// Export singleton instance
export const imageService = new ImageService();