import type { PhotoItem } from '@/types';

export async function fetchPhotos(forceRefresh = false): Promise<PhotoItem[]> {
  if (!window.desklink?.getPhotos) return [];
  return window.desklink.getPhotos(forceRefresh);
}

export async function downloadPhoto(photoId: string): Promise<{ path: string; fileName: string }> {
  if (!window.desklink?.downloadPhoto) {
    throw new Error('DeskLink API not available');
  }
  return window.desklink.downloadPhoto(photoId);
}

export async function openPhotoInFolder(filePath: string): Promise<void> {
  if (!window.desklink?.openPhoto) return;
  await window.desklink.openPhoto(filePath);
}
