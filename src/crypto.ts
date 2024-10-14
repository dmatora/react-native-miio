import crypto from 'react-native-quick-crypto';
import {Buffer} from 'buffer';

/**
 * Converts data returned from crypto methods to a Buffer.
 *
 * @param data - Data to convert
 * @returns A Buffer containing the data
 */
export function toBuffer(data: any): Buffer {
  if (Buffer.isBuffer(data)) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(data));
  }
  if (data instanceof Uint8Array) {
    return Buffer.from(data);
  }
  if (typeof data === 'string') {
    return Buffer.from(data, 'utf-8');
  }
  throw new Error('Unsupported data type');
}

/**
 * Returns md5 hash of data.
 *
 * @param data - data to hash
 * @returns The md5 hash of `data` (16 bytes)
 */
export function hash(data: Buffer): Buffer {
  return crypto.createHash('md5').update(data).digest();
}

export function encrypt(key: Buffer, iv: Buffer, data: any): Buffer {
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);

  // Use toBuffer() to convert the data before encryption
  return Buffer.concat([cipher.update(toBuffer(data)), cipher.final()]);
}

export function decrypt(key: Buffer, iv: Buffer, data: any): Buffer {
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);

  // Use toBuffer() to convert the data before decryption
  return Buffer.concat([decipher.update(toBuffer(data)), decipher.final()]);
}
