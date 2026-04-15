const allowedMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
];

const maxFileSizeBytes = 5 * 1024 * 1024;

export function validateUpload(file: File) {
  if (!allowedMimeTypes.includes(file.type)) {
    throw new Error("Unsupported file type");
  }

  if (file.size > maxFileSizeBytes) {
    throw new Error("File too large");
  }
}
