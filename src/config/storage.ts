/**
 * MinIO/S3 Storage Configuration
 *
 * Change these constants to point to your MinIO server.
 * Default configuration assumes MinIO is running locally via Docker:
 *
 * docker run -d \
 *   --name minio \
 *   -p 9002:9000 \
 *   -p 9003:9001 \
 *   -v minio-data:/data \
 *   -e MINIO_ROOT_USER=minioadmin \
 *   -e MINIO_ROOT_PASSWORD=minioadmin \
 *   minio/minio server /data --console-address ":9001"
 */

export const STORAGE_CONFIG = {
  // MinIO S3 API endpoint - proxied through nginx for HTTPS
  // Use subdomain if using Option 2: "https://minio.gpx.orangepc.site"
  endpoint: "https://minio.orangepc.site",

  // MinIO credentials
  accessKeyId: "minioadmin",
  secretAccessKey: "minioadmin",

  // Bucket name for storing GPX files
  bucket: "gpx-tracks",

  // Region (MinIO requires this but doesn't use it)
  region: "us-east-1",
} as const;

export type StorageConfig = typeof STORAGE_CONFIG;
