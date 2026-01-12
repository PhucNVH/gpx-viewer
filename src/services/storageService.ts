/**
 * Storage Service for MinIO/S3
 * 
 * Handles uploading and downloading GPX files to/from MinIO storage.
 * Files are stored with UUID filenames.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { STORAGE_CONFIG } from '../config/storage';

// Create S3 client configured for MinIO
const s3Client = new S3Client({
  endpoint: STORAGE_CONFIG.endpoint,
  region: STORAGE_CONFIG.region,
  credentials: {
    accessKeyId: STORAGE_CONFIG.accessKeyId,
    secretAccessKey: STORAGE_CONFIG.secretAccessKey,
  },
  forcePathStyle: true, // Required for MinIO
});

/**
 * Ensure the GPX bucket exists, create it if not
 */
export async function ensureBucketExists(): Promise<void> {
  try {
    await s3Client.send(
      new HeadBucketCommand({ Bucket: STORAGE_CONFIG.bucket })
    );
    console.log(`[Storage] Bucket "${STORAGE_CONFIG.bucket}" exists`);
  } catch (error: unknown) {
    // Bucket doesn't exist, create it
    if (error && typeof error === 'object' && 'name' in error && error.name === 'NotFound') {
      console.log(`[Storage] Creating bucket "${STORAGE_CONFIG.bucket}"...`);
      await s3Client.send(
        new CreateBucketCommand({ Bucket: STORAGE_CONFIG.bucket })
      );
      console.log(`[Storage] Bucket "${STORAGE_CONFIG.bucket}" created`);
    } else {
      throw error;
    }
  }
}

/**
 * Generate a UUID for a new GPX file
 */
export function generateStorageId(): string {
  return crypto.randomUUID();
}

/**
 * Upload a GPX file to MinIO
 * @param storageId - UUID to use as filename
 * @param gpxContent - Raw GPX file content (XML string)
 * @returns The storage ID
 */
export async function uploadGpxFile(
  storageId: string,
  gpxContent: string
): Promise<string> {
  await ensureBucketExists();
  
  const key = `${storageId}.gpx`;
  
  await s3Client.send(
    new PutObjectCommand({
      Bucket: STORAGE_CONFIG.bucket,
      Key: key,
      Body: gpxContent,
      ContentType: 'application/gpx+xml',
    })
  );
  
  console.log(`[Storage] Uploaded GPX file: ${key}`);
  return storageId;
}

/**
 * Download a GPX file from MinIO
 * @param storageId - UUID of the file to download
 * @returns The GPX file content as a string
 */
export async function downloadGpxFile(storageId: string): Promise<string> {
  const key = `${storageId}.gpx`;
  
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: STORAGE_CONFIG.bucket,
      Key: key,
    })
  );
  
  if (!response.Body) {
    throw new Error(`Failed to download GPX file: ${key}`);
  }
  
  // Convert stream to string
  const content = await response.Body.transformToString();
  console.log(`[Storage] Downloaded GPX file: ${key}`);
  return content;
}

/**
 * Delete a GPX file from MinIO
 * @param storageId - UUID of the file to delete
 */
export async function deleteGpxFile(storageId: string): Promise<void> {
  const key = `${storageId}.gpx`;
  
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: STORAGE_CONFIG.bucket,
      Key: key,
    })
  );
  
  console.log(`[Storage] Deleted GPX file: ${key}`);
}

/**
 * Upload a GPX file from a File object
 * @param file - The GPX File to upload
 * @returns The storage ID (UUID)
 */
export async function uploadGpxFromFile(file: File): Promise<string> {
  const content = await file.text();
  const storageId = generateStorageId();
  await uploadGpxFile(storageId, content);
  return storageId;
}

