import { env } from "@/lib/utils/env";

export async function uploadFile(input: {
  fileName: string;
  contentType: string;
  data: ArrayBuffer;
}) {
  if (!env.S3_BUCKET) {
    return {
      url: `/uploads/${encodeURIComponent(input.fileName)}`,
      provider: "local-mock"
    };
  }

  return {
    url: `${env.S3_ENDPOINT}/${env.S3_BUCKET}/${encodeURIComponent(input.fileName)}`,
    provider: "s3-compatible"
  };
}
