/**
 * Self-contained HTML page loaded by the hidden WebView on iOS/Android.
 * Fully offline: the pdf.js engine arrives from the RN side as chunked
 * postMessages (sourced from bundled assets — see scripts/copy-pdfjs.mjs)
 * and is executed via blob: module URLs. No network access at any point.
 *
 * Protocol (all JSON strings):
 *   RN → page : {kind:'chunk', stream:'main'|'worker'|'pdf', data}
 *               {kind:'start'}                      — all chunks delivered
 *   page → RN : {type:'ready'}                      — listeners installed
 *               {type:'meta', numPages, title?, author?}
 *               {type:'page', index, page:RawPage}  — one message per page
 *               {type:'done'} | {type:'error', message}
 */
export const EXTRACTOR_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body>
<script>
(function () {
  var streams = { main: [], worker: [], pdf: [] };
  var started = false;
  var post = function (msg) { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); };

  function toBytes(base64) {
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function mapTextItem(item) {
    if (typeof item.str !== 'string' || item.str.trim() === '') return null;
    var tr = item.transform;
    if (!tr) return null;
    var fontSize = Math.hypot(tr[2], tr[3]) || Math.abs(tr[3]) || 10;
    return {
      str: item.str,
      x: tr[4],
      y: tr[5],
      width: typeof item.width === 'number' ? item.width : 0,
      fontSize: fontSize,
      fontName: typeof item.fontName === 'string' ? item.fontName : '',
    };
  }

  async function renderCover(pdf) {
    try {
      var page = await pdf.getPage(1);
      var base = page.getViewport({ scale: 1 });
      var viewport = page.getViewport({ scale: 360 / base.width });
      var canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch (e) {
      return undefined; // cover is nice-to-have
    }
  }

  async function start() {
    var blobUrl = function (parts) {
      return URL.createObjectURL(new Blob(parts, { type: 'text/javascript' }));
    };
    var pdfjsLib = await import(blobUrl(streams.main));
    pdfjsLib.GlobalWorkerOptions.workerSrc = blobUrl(streams.worker);

    var pdf = await pdfjsLib.getDocument({ data: toBytes(streams.pdf.join('')) }).promise;
    var metadata = await pdf.getMetadata().catch(function () { return null; });
    post({
      type: 'meta',
      numPages: pdf.numPages,
      title: (metadata && metadata.info && metadata.info.Title) || undefined,
      author: (metadata && metadata.info && metadata.info.Author) || undefined,
    });
    var cover = await renderCover(pdf);
    if (cover) post({ type: 'cover', dataUrl: cover });
    for (var pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      var page = await pdf.getPage(pageNumber);
      var viewport = page.getViewport({ scale: 1 });
      var content = await page.getTextContent();
      post({
        type: 'page',
        index: pageNumber - 1,
        page: {
          width: viewport.width,
          height: viewport.height,
          items: content.items.map(mapTextItem).filter(Boolean),
        },
      });
    }
    post({ type: 'done' });
  }

  function onMessage(event) {
    if (typeof event.data !== 'string') return;
    var msg;
    try { msg = JSON.parse(event.data); } catch (e) { return; }
    if (msg.kind === 'chunk' && streams[msg.stream]) {
      streams[msg.stream].push(msg.data);
    } else if (msg.kind === 'start' && !started) {
      started = true;
      start().catch(function (error) {
        post({ type: 'error', message: String((error && error.message) || error) });
      });
    }
  }
  // react-native-webview delivers RN→page messages on window (iOS) or document (Android)
  window.addEventListener('message', onMessage);
  document.addEventListener('message', onMessage);
  post({ type: 'ready' });
})();
</script>
</body>
</html>`;
