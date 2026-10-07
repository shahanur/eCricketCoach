export class DrillImageValidationError extends Error {}

export const MAX_DRILL_IMAGE_BYTES = 10 * 1024 * 1024;
export const DRILL_IMAGE_JSON_LIMIT = '15mb';

export function drillImageUrl(id: string, data?: Buffer): string {
  const base = `/api/drills/${encodeURIComponent(id)}/image`;
  return data ? `${base}?v=${createHash('sha256').update(data).digest('hex').slice(0, 16)}` : base;
}

export function parseDrillImage(value: string): { data: Buffer; mimeType: string } {
  if (typeof value !== 'string') throw new DrillImageValidationError('Upload a PNG or JPEG image.');
  const match = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw new DrillImageValidationError('Upload a PNG or JPEG image.');
  const data = Buffer.from(match[2], 'base64');
  if (data.toString('base64') !== match[2]) {
    throw new DrillImageValidationError('Invalid image encoding.');
  }
  if (data.length > MAX_DRILL_IMAGE_BYTES) {
    throw new DrillImageValidationError('Drill images must be no larger than 10 MB.');
  }
  const png = data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = data.length >= 4 && data[0] === 255 && data[1] === 216 && data[2] === 255
    && data[data.length - 2] === 255 && data[data.length - 1] === 217;
  if (!(match[1] === 'image/png' ? png : jpeg)) {
    throw new DrillImageValidationError('Image contents do not match the PNG or JPEG type.');
  }
  return { data, mimeType: match[1] };
}
import { createHash } from 'node:crypto';
