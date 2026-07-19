// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Bundled pdf.js engine files (assets/pdfjs/*.jsasset) — shipped as raw
// assets so PDF import works offline; see scripts/copy-pdfjs.mjs.
config.resolver.assetExts.push('jsasset');

// Drizzle SQL migrations are imported as source (inline-import babel plugin).
config.resolver.sourceExts.push('sql');

// Bundled offline dictionary (assets/dictionary/dictionary.db, built by
// scripts/build-dictionary/) and the sql.js wasm engine used to read it on web.
config.resolver.assetExts.push('db', 'wasm');

module.exports = config;
