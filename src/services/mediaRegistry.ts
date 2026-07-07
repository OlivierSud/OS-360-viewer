const mediaFiles = new Map<string, File>();

export function createTrackedObjectUrl(file: File): string {
  const url = URL.createObjectURL(file);
  mediaFiles.set(url, file);
  return url;
}

export function getTrackedFile(url: string | undefined): File | null {
  if (!url?.startsWith('blob:')) return null;
  return mediaFiles.get(url) ?? null;
}

export function revokeTrackedObjectUrl(url: string): void {
  mediaFiles.delete(url);
  URL.revokeObjectURL(url);
}
