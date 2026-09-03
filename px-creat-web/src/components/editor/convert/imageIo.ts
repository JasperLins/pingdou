/**
 * 转换流浏览器辅助（DOM 依赖，不进 lib/）：
 * 文件解码 → Canvas 预压缩（最长边 2048，PNG 保透明）→ 像素与 dataURL；
 * 像素 → dataURL（结果参考层挂载用）。
 */

import type { PixelImage } from '@/lib/converter';
import type { ConvertSource } from '@/store/convert';

/** 上传限制（§4.3：PNG/JPG/WebP ≤ 10MB）。 */
export const IMPORT_MAX_BYTES = 10 * 1024 * 1024;
export const IMPORT_MAX_SIDE = 2048;
export const IMPORT_ACCEPT = 'image/png,image/jpeg,image/webp';

/** 解码失败/超限的可读错误（ImportDialog inline 展示）。 */
export class ImportImageError extends Error {}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImportImageError('图片解码失败，请换一张试试'));
    img.src = url;
  });
}

/**
 * 文件 → 预压缩源图（最长边 2048，不放大小图；PNG 编码保留透明）。
 *
 * @param file 上传文件
 * @param fallbackName 无文件名时的展示名
 * @throws ImportImageError 类型/大小/解码不合规
 */
export async function loadSourceImage(file: File, fallbackName = '导入图片'): Promise<ConvertSource> {
  if (file.size > IMPORT_MAX_BYTES) {
    throw new ImportImageError(`图片超过 10MB（当前 ${(file.size / 1024 / 1024).toFixed(1)}MB），请压缩后再上传`);
  }
  if (file.type !== '' && !IMPORT_ACCEPT.includes(file.type)) {
    throw new ImportImageError('仅支持 PNG / JPG / WebP 格式');
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, IMPORT_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new ImportImageError('浏览器不支持画布读取，请更换浏览器');
    ctx.drawImage(img, 0, 0, width, height);
    const pixels: PixelImage = {
      width,
      height,
      data: ctx.getImageData(0, 0, width, height).data,
    };
    const dataUrl = scale === 1 && file.type === 'image/png' ? await readAsDataUrl(file) : canvas.toDataURL('image/png');
    return { name: file.name || fallbackName, width, height, dataUrl, pixels };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new ImportImageError('图片读取失败'));
    reader.readAsDataURL(file);
  });
}

/** 像素图 → dataURL（work 图转参考层；jsdom 无 2D context 时返回空串）。 */
export function pixelsToDataUrl(pixels: PixelImage): string {
  const canvas = document.createElement('canvas');
  canvas.width = pixels.width;
  canvas.height = pixels.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
  return canvas.toDataURL('image/png');
}
