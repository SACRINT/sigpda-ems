declare module 'mammoth' {
  export interface Result<T> {
    value: T;
    messages: Array<{
      type: string;
      message: string;
    }>;
  }

  export interface ImageElement {
    read(encoding?: string): Promise<Buffer | string>;
    contentType: string;
  }

  export interface ImageConversionResult {
    src: string;
    [key: string]: unknown;
  }

  export type ImageConverter = (image: ImageElement) => Promise<ImageConversionResult> | ImageConversionResult;

  export interface ConvertOptions {
    buffer?: Buffer;
    path?: string;
    styleMap?: string | string[];
    includeDefaultStyleMap?: boolean;
    outputFormat?: string;
    convertImage?: ImageConverter;
  }

  export namespace images {
    export function inline(converter: ImageConverter): ImageConverter;
    export function dataUri(image: ImageElement): Promise<ImageConversionResult>;
    export function imgElement(converter: ImageConverter): ImageConverter;
  }

  export function convertToHtml(
    input: { buffer: Buffer } | { path: string },
    options?: ConvertOptions
  ): Promise<Result<string>>;

  export function convertToMarkdown(
    input: { buffer: Buffer } | { path: string },
    options?: ConvertOptions
  ): Promise<Result<string>>;

  export function extractRawText(
    input: { buffer: Buffer } | { path: string }
  ): Promise<Result<string>>;

  const mammoth: {
    convertToHtml: typeof convertToHtml;
    convertToMarkdown: typeof convertToMarkdown;
    extractRawText: typeof extractRawText;
    images: typeof images;
  };

  export default mammoth;
}
