declare module 'mammoth' {
  export interface Result<T> {
    value: T;
    messages: Array<{
      type: string;
      message: string;
    }>;
  }

  export interface ConvertOptions {
    buffer?: Buffer;
    path?: string;
    styleMap?: string | string[];
    includeDefaultStyleMap?: boolean;
    outputFormat?: string;
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
  };

  export default mammoth;
}
