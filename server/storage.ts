import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

function getWritableUploadDir(): string {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpDir = path.join('/tmp', 'imagelink_data', 'uploads');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    return tmpDir;
  }

  const standardDir = path.resolve(process.cwd(), 'data', 'uploads');
  try {
    if (!fs.existsSync(standardDir)) {
      fs.mkdirSync(standardDir, { recursive: true });
    }
    const testFile = path.join(standardDir, '.write_test');
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    return standardDir;
  } catch {
    const fallbackDir = path.join('/tmp', 'imagelink_data', 'uploads');
    if (!fs.existsSync(fallbackDir)) fs.mkdirSync(fallbackDir, { recursive: true });
    return fallbackDir;
  }
}

const UPLOAD_DIR = getWritableUploadDir();

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export type FramingMode = 'crop_16_9' | 'full';

export class StorageService {
  /**
   * Generates a safe unique file key
   */
  generateFileKey(prefix: string, extension: string): string {
    const ext = extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
    const safeExt = ALLOWED_EXTENSIONS.includes(ext) ? ext : '.jpg';
    const randomHex = crypto.randomBytes(12).toString('hex');
    const timestamp = Date.now().toString(36);
    return `${prefix}_${timestamp}_${randomHex}${safeExt}`;
  }

  sanitizeKey(key: string): string {
    return path.basename(key);
  }

  getFilePath(key: string): string {
    const cleanKey = this.sanitizeKey(key);
    return path.join(UPLOAD_DIR, cleanKey);
  }

  hasFile(key: string): boolean {
    const cleanKey = this.sanitizeKey(key);
    const targetPath = path.join(UPLOAD_DIR, cleanKey);
    return fs.existsSync(targetPath);
  }

  /**
   * Saves a raw buffer directly
   */
  saveRawBuffer(buffer: Buffer, originalExt: string): string {
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`Image size exceeds 10MB limit (${(buffer.length / (1024 * 1024)).toFixed(1)}MB)`);
    }
    const key = this.generateFileKey('raw', originalExt);
    fs.writeFileSync(this.getFilePath(key), buffer);
    return key;
  }

  /**
   * Processes image according to framing mode (1200x630 social card standard)
   */
  async processImage(
    buffer: Buffer,
    framingMode: FramingMode = 'crop_16_9'
  ): Promise<{ rawKey: string; processedKey: string; width: number; height: number }> {
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`Image size exceeds 10MB limit (${(buffer.length / (1024 * 1024)).toFixed(1)}MB)`);
    }

    // Validate image format with sharp
    const metadata = await sharp(buffer).metadata();
    if (!metadata.format || !['jpeg', 'png', 'webp', 'jpg'].includes(metadata.format)) {
      throw new Error('Unsupported image format. Please upload JPG, JPEG, or PNG.');
    }

    // 1. Save original raw file
    const rawKey = this.generateFileKey('raw', `.${metadata.format}`);
    fs.writeFileSync(this.getFilePath(rawKey), buffer);

    let processedBuffer: Buffer;

    if (framingMode === 'crop_16_9') {
      // 1200 x 630 center crop preserving the key focal center without distortion
      processedBuffer = await sharp(buffer)
        .rotate() // auto-orient based on EXIF
        .resize(1200, 630, {
          fit: 'cover',
          position: sharp.strategy.entropy // focus on center/entropy area
        })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
    } else {
      // "Full Image": preserve original aspect ratio inside 1200 x 630 social frame
      // Letterbox with soft dark neutral background (#0a0a0c) so the entire image is visible without crop or stretch
      processedBuffer = await sharp(buffer)
        .rotate()
        .resize(1200, 630, {
          fit: 'contain',
          background: { r: 12, g: 12, b: 15, alpha: 1 }
        })
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer();
    }

    const processedKey = this.generateFileKey('proc', '.jpg');
    fs.writeFileSync(this.getFilePath(processedKey), processedBuffer);

    return {
      rawKey,
      processedKey,
      width: 1200,
      height: 630
    };
  }

  /**
   * Downloads an image from external URL (Telegram Bot file URL)
   */
  async downloadAndProcessFromUrl(url: string, framingMode: FramingMode = 'crop_16_9'): Promise<{ rawKey: string; processedKey: string }> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file from Telegram: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`Downloaded image exceeds 10MB limit (${(buffer.length / (1024 * 1024)).toFixed(1)}MB)`);
    }

    return this.processImage(buffer, framingMode);
  }

  deleteFile(key: string): boolean {
    const cleanKey = this.sanitizeKey(key);
    const targetPath = path.join(UPLOAD_DIR, cleanKey);
    if (fs.existsSync(targetPath)) {
      try {
        fs.unlinkSync(targetPath);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

export const storageService = new StorageService();
