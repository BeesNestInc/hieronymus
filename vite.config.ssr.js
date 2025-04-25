import { defineConfig } from 'vite';
import path from 'path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import fs from 'fs';
import { rmSync } from 'fs';

// ビルド前にdist-ssrを空にするプラグイン
function cleanDistPlugin() {
  return {
    name: 'clean-dist-ssr',
    buildStart() {
      const distPath = path.resolve(__dirname, 'dist-ssr');
      if (fs.existsSync(distPath)) {
        rmSync(distPath, { recursive: true, force: true });
        console.log('✅ dist-ssr directory cleared.');
      }
    }
  };
}

const inputFile = (name) => {
  const srcPath = path.resolve(__dirname, 'front/svelte/forms')
  return path.resolve(srcPath, name);
}
export default defineConfig({
  root: path.resolve(__dirname, 'front/svelte'),
  build: {
    ssr: true,
    outDir: path.resolve(__dirname, 'dist-ssr'),
    rollupOptions: {
      input: {
        invoice: inputFile('invoice/invoice.svelte'),
        estimate: inputFile('estimate/estimate.svelte'),
        'explanatory-journal': inputFile('explanatory-journal/explanatory-journal.svelte'),
        'general-ledger': inputFile('general-ledger/general-ledger.svelte'),
        'subsidiary-ledger': inputFile('subsidiary-ledger/subsidiary-ledger.svelte'),
        'financial-statement': inputFile('financial-statement/financial-statement.svelte'),
        'trial-balance': inputFile('trial-balance/trial-balance.svelte')
      },
      external: ['svelte/internal'],
      output: {
        format: 'es',
        entryFileNames: '[name].js'  // Invoice.js / Estimate.js
      }
    },
    emptyOutDir: false // 手動で削除するのでfalseのまま
  },
  plugins: [
    cleanDistPlugin(),
    svelte({ compilerOptions: { generate: 'ssr', hydratable: true } })
  ],
  resolve: {
    extensions: ['.svelte', '.js']
  }
});
