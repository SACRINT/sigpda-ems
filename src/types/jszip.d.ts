declare module 'jszip' {
  export default class JSZip {
    constructor();
    static loadAsync(data: string | number[] | Uint8Array | ArrayBuffer | Blob | NodeJS.ReadableStream | Promise<any>, options?: any): Promise<JSZip>;
    files: { [key: string]: any };
    file(name: string, data: string | Buffer | Uint8Array | ArrayBuffer): this;
    folder(name: string): JSZip | null;
    generateAsync(options: {
      type: 'nodebuffer' | 'uint8array' | 'arraybuffer' | 'blob' | 'base64';
      compression?: 'STORE' | 'DEFLATE';
      compressionOptions?: { level: number };
    }): Promise<any>;
  }
}
