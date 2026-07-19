// Minimal local typings for untyped/deep-imported extraction dependencies.

// Bundled raw-JS assets (assets/pdfjs/*.jsasset) — metro resolves asset
// requires to a numeric module id consumed by expo-asset.
declare module '*.jsasset' {
  const assetId: number;
  export default assetId;
}

// Bundled binary assets: dictionary SQLite + sql.js wasm engine.
declare module '*.db' {
  const assetId: number;
  export default assetId;
}
declare module '*.wasm' {
  const assetId: number;
  export default assetId;
}

// Pure-JS lemmatizer (untyped package).
declare module 'wink-lemmatizer' {
  const lemmatizer: {
    noun(word: string): string;
    verb(word: string): string;
    adjective(word: string): string;
  };
  export default lemmatizer;
}

declare module 'sbd' {
  export function sentences(
    text: string,
    options?: {
      newline_boundaries?: boolean;
      html_boundaries?: boolean;
      sanitize?: boolean;
      abbreviations?: string[] | null;
    },
  ): string[];
}

// pdf.js legacy build (deep import used on web for maximum bundler compat).
// Loosely typed on purpose — only the surface the extractor touches.
declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  export const version: string;
  export const GlobalWorkerOptions: { workerSrc: string };
  export function getDocument(src: { data: Uint8Array } | { url: string }): {
    promise: Promise<PdfjsDocument>;
  };

  export interface PdfjsDocument {
    numPages: number;
    getMetadata(): Promise<{ info?: { Title?: string; Author?: string } }>;
    getPage(pageNumber: number): Promise<PdfjsPage>;
    destroy(): Promise<void>;
  }

  export interface PdfjsPage {
    getViewport(params: { scale: number }): { width: number; height: number };
    getTextContent(): Promise<{ items: Array<Record<string, unknown>> }>;
    render(params: {
      canvasContext: CanvasRenderingContext2D;
      viewport: { width: number; height: number };
    }): { promise: Promise<void> };
  }
}
