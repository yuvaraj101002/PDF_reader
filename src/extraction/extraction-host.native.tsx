import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { EXTRACTOR_HTML } from './extractor-html';
import type { ExtractionProgress, RawExtraction, RawPage } from './types';

/**
 * Invisible WebView that runs the bundled pdf.js engine for native platforms —
 * fully offline. Mount `<PdfExtractionHost />` once (root layout);
 * `extractRawInWebView` then resolves one extraction job at a time.
 */

interface Job {
  base64: string;
  onProgress?: ExtractionProgress;
  resolve: (raw: RawExtraction) => void;
  reject: (error: Error) => void;
}

let enqueueJob: ((job: Job) => void) | null = null;

const EXTRACTION_TIMEOUT_MS = 180_000;
/** postMessage payload chunk size — safely under platform message limits */
const CHUNK_SIZE = 256 * 1024;

export function extractRawInWebView(
  base64: string,
  onProgress?: ExtractionProgress,
): Promise<RawExtraction> {
  return new Promise<RawExtraction>((resolve, reject) => {
    if (!enqueueJob) {
      reject(new Error('PdfExtractionHost is not mounted'));
      return;
    }
    enqueueJob({ base64, onProgress, resolve, reject });
  });
}

/** Load the bundled pdf.js sources once per app session. */
let pdfjsSources: Promise<{ main: string; worker: string }> | null = null;
function loadPdfjsSources(): Promise<{ main: string; worker: string }> {
  pdfjsSources ??= (async () => {
    const [main, worker] = await Promise.all([
      Asset.fromModule(require('@/assets/pdfjs/pdf.min.jsasset')).downloadAsync(),
      Asset.fromModule(require('@/assets/pdfjs/pdf.worker.min.jsasset')).downloadAsync(),
    ]);
    const read = (asset: Asset) => new File(asset.localUri ?? asset.uri).text();
    return { main: await read(main), worker: await read(worker) };
  })();
  return pdfjsSources;
}

export function PdfExtractionHost() {
  const [job, setJob] = useState<Job | null>(null);
  const webViewRef = useRef<WebView>(null);
  const accumulator = useRef<{
    title?: string;
    author?: string;
    coverDataUrl?: string;
    numPages: number;
    pagesDone: number;
    pages: RawPage[];
  }>({ numPages: 0, pagesDone: 0, pages: [] });

  useEffect(() => {
    enqueueJob = (next: Job) => {
      setJob((current) => {
        if (current) {
          next.reject(new Error('Another PDF extraction is already in progress'));
          return current;
        }
        accumulator.current = { numPages: 0, pagesDone: 0, pages: [] };
        return next;
      });
    };
    return () => {
      enqueueJob = null;
    };
  }, []);

  // Watchdog: fail the job instead of hanging forever.
  useEffect(() => {
    if (!job) return;
    const timer = setTimeout(() => {
      job.reject(new Error('PDF extraction timed out'));
      setJob(null);
    }, EXTRACTION_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [job]);

  /** Deliver engine + document to the page in bounded chunks, then start. */
  const pump = useCallback(async (activeJob: Job) => {
    const view = webViewRef.current;
    if (!view) return;
    const send = (message: object) => view.postMessage(JSON.stringify(message));
    const sendStream = (stream: 'main' | 'worker' | 'pdf', data: string) => {
      for (let at = 0; at < data.length; at += CHUNK_SIZE) {
        send({ kind: 'chunk', stream, data: data.slice(at, at + CHUNK_SIZE) });
      }
    };
    try {
      const sources = await loadPdfjsSources();
      sendStream('main', sources.main);
      sendStream('worker', sources.worker);
      sendStream('pdf', activeJob.base64);
      send({ kind: 'start' });
    } catch (error) {
      activeJob.reject(error instanceof Error ? error : new Error(String(error)));
      setJob(null);
    }
  }, []);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      if (!job) return;
      let message: any;
      try {
        message = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }
      const acc = accumulator.current;
      switch (message.type) {
        case 'ready':
          void pump(job);
          break;
        case 'meta':
          acc.title = message.title;
          acc.author = message.author;
          acc.numPages = message.numPages ?? 0;
          break;
        case 'cover':
          acc.coverDataUrl = message.dataUrl;
          break;
        case 'page':
          acc.pages[message.index] = message.page;
          acc.pagesDone += 1;
          if (acc.numPages > 0) job.onProgress?.(acc.pagesDone, acc.numPages);
          break;
        case 'done':
          job.resolve({
            title: acc.title,
            author: acc.author,
            coverDataUrl: acc.coverDataUrl,
            pages: acc.pages.filter(Boolean),
          });
          setJob(null);
          break;
        case 'error':
          job.reject(new Error(message.message ?? 'PDF extraction failed'));
          setJob(null);
          break;
      }
    },
    [job, pump],
  );

  if (!job) return null;
  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: EXTRACTOR_HTML }}
        onMessage={onMessage}
        javaScriptEnabled
        onError={() => {
          job.reject(new Error('Extraction WebView failed to load'));
          setJob(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});
