import { StickerCatalogItem } from '../../types/timeline';
import bundledCatalog from '../../stickers/catalog.json';

// In-memory cache for sticker catalog items
let cachedCatalog: StickerCatalogItem[] | null = null;

// In-memory HTMLImageElement cache for synchronous 60fps canvas drawing
const imageCache = new Map<string, HTMLImageElement>();
const loadingPromises = new Map<string, Promise<HTMLImageElement>>();

/**
 * Loads the sticker catalog either from the local public endpoint /stickers/catalog.json
 * or falls back seamlessly to the bundled catalog.json.
 */
export async function fetchStickerCatalog(): Promise<StickerCatalogItem[]> {
  if (cachedCatalog && cachedCatalog.length > 0) {
    return cachedCatalog;
  }

  try {
    const response = await fetch('/stickers/catalog.json');
    if (response.ok) {
      const data: StickerCatalogItem[] = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        cachedCatalog = data;
        // Trigger background preloading for the fetched items
        preloadStickerAssets(data.map((item) => item.assetUrl));
        return data;
      }
    }
  } catch (err) {
    console.warn('[StickerService] Failed to fetch /stickers/catalog.json, using bundled catalog:', err);
  }

  // Fallback to bundled catalog
  cachedCatalog = bundledCatalog as StickerCatalogItem[];
  preloadStickerAssets(cachedCatalog.map((item) => item.assetUrl));
  return cachedCatalog;
}

/**
 * Synchronously returns the cached catalog if already loaded, otherwise returns bundled catalog.
 */
export function getLoadedCatalog(): StickerCatalogItem[] {
  if (cachedCatalog && cachedCatalog.length > 0) {
    return cachedCatalog;
  }
  return bundledCatalog as StickerCatalogItem[];
}

/**
 * Synchronously retrieves or triggers loading of an image for canvas rendering.
 * If the image is loaded, img.complete and img.naturalWidth will be > 0.
 */
export function getStickerImage(url: string): HTMLImageElement {
  if (imageCache.has(url)) {
    return imageCache.get(url)!;
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  imageCache.set(url, img);
  return img;
}

/**
 * Asynchronously preloads an individual image and resolves when ready.
 */
export function preloadStickerImage(url: string): Promise<HTMLImageElement> {
  if (loadingPromises.has(url)) {
    return loadingPromises.get(url)!;
  }

  const existing = imageCache.get(url);
  if (existing && existing.complete && existing.naturalWidth > 0) {
    return Promise.resolve(existing);
  }

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = existing || new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = (e) => {
      console.warn(`[StickerService] Failed to preload sticker: ${url}`, e);
      // Still cache to prevent repeated failed network requests
      imageCache.set(url, img);
      resolve(img);
    };
    if (!existing) {
      img.src = url;
      imageCache.set(url, img);
    }
  });

  loadingPromises.set(url, promise);
  return promise;
}

/**
 * Preloads a batch of sticker URLs in the background for instant canvas rendering without flicker.
 */
export function preloadStickerAssets(urls: string[]): Promise<HTMLImageElement[]> {
  return Promise.all(urls.filter(Boolean).map((u) => preloadStickerImage(u)));
}
