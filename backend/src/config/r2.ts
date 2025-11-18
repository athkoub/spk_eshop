import AWS from 'aws-sdk';
import { env } from './env';
import { logger } from '../utils/logger';

// Configure AWS SDK for Cloudflare R2
const s3 = new AWS.S3({
  endpoint: env.CLOUDFLARE_R2_ENDPOINT,
  accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
  secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  region: 'auto', // Cloudflare R2 uses 'auto'
  signatureVersion: 'v4',
});

export class R2Storage {
  private bucketName: string;

  constructor() {
    this.bucketName = env.CLOUDFLARE_R2_BUCKET_NAME;
  }

  async uploadFile(
    key: string,
    buffer: Buffer,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    try {
      const params: AWS.S3.PutObjectRequest = {
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: metadata,
        ACL: 'public-read',
      };

      const result = await s3.upload(params).promise();
      logger.info(`File uploaded successfully: ${key}`);
      return result.Location;
    } catch (error) {
      logger.error(`Failed to upload file ${key}:`, error);
      throw new Error(`Failed to upload file: ${error}`);
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const params: AWS.S3.DeleteObjectRequest = {
        Bucket: this.bucketName,
        Key: key,
      };

      await s3.deleteObject(params).promise();
      logger.info(`File deleted successfully: ${key}`);
    } catch (error) {
      logger.error(`Failed to delete file ${key}:`, error);
      throw new Error(`Failed to delete file: ${error}`);
    }
  }

  async getFileUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: key,
        Expires: expiresIn,
      };

      return s3.getSignedUrl('getObject', params);
    } catch (error) {
      logger.error(`Failed to get signed URL for ${key}:`, error);
      throw new Error(`Failed to get file URL: ${error}`);
    }
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      await s3.headObject({
        Bucket: this.bucketName,
        Key: key,
      }).promise();
      return true;
    } catch (error) {
      if ((error as AWS.AWSError).statusCode === 404) {
        return false;
      }
      logger.error(`Error checking if file exists ${key}:`, error);
      throw error;
    }
  }

  generateKey(folder: string, filename: string): string {
    const timestamp = Date.now();
    const extension = filename.split('.').pop();
    const cleanName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${folder}/${timestamp}_${cleanName}`;
  }
}

export const r2Storage = new R2Storage();