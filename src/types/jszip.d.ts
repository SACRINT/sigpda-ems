declare module 'jszip' {
  export interface JSZipObject {
    name: string;
    dir: boolean;
    date: Date;
    comment: string;
    async(type: 'nodebuffer'): Promise<Buffer>;
    async(type: 'string' | 'text'): Promise<string>;
    async(type: 'uint8array'): Promise<Uint8Array>;
    async(type: 'arraybuffer'): Promise<ArrayBuffer>;
  }

  export default class JSZip {
    constructor();
    static loadAsync(
      data: string | number[] | Uint8Array | ArrayBuffer | Blob | NodeJS.ReadableStream | Promise<unknown>,
      options?: Record<string, unknown>
    ): Promise<JSZip>;
    files: { [key: string]: JSZipObject };
    file(name: string): JSZipObject | null;
    file(name: string, data: string | Buffer | Uint8Array | ArrayBuffer): this;
    folder(name: string): JSZip | null;
    generateAsync(options: {
      type: 'nodebuffer';
      compression?: 'STORE' | 'DEFLATE';
      compressionOptions?: { level: number };
    }): Promise<Buffer>;
    generateAsync(options: {
      type: 'uint8array';
      compression?: 'STORE' | 'DEFLATE';
      compressionOptions?: { level: number };
    }): Promise<Uint8Array>;
    generateAsync(options: {
      type: 'arraybuffer';
      compression?: 'STORE' | 'DEFLATE';
      compressionOptions?: { level: number };
    }): Promise<ArrayBuffer>;
    generateAsync(options: {
      type: 'blob';
      compression?: 'STORE' | 'DEFLATE';
      compressionOptions?: { level: number };
    }): Promise<Blob>;
    generateAsync(options: {
      type: 'base64';
      compression?: 'STORE' | 'DEFLATE';
      compressionOptions?: { level: number };
    }): Promise<string>;
    generateAsync(options: {
      type: 'nodebuffer' | 'uint8array' | 'arraybuffer' | 'blob' | 'base64';
      compression?: 'STORE' | 'DEFLATE';
      compressionOptions?: { level: number };
    }): Promise<Buffer | Uint8Array | ArrayBuffer | Blob | string>;
  }
}


