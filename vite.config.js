/** @type {import('vite').UserConfig} */
export default {
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `[name].js`,
        chunkFileNames: `[name].js`,
        assetFileNames: `images/[name].[ext]`
      }
    }
  }
}