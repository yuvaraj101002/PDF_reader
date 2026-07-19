module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Lets drizzle migrations import their .sql files as strings (native DB).
      ['inline-import', { extensions: ['.sql'] }],
    ],
  };
};
