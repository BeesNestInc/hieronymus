import { defineConfig } from 'vite';
import path from 'path';
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const realPath = (name) => {
  return  path.resolve(__dirname, path.resolve('front/javascripts', name));
}

export default defineConfig({
  cacheDir: 'node_modules/.vite-cache',
  root: path.resolve(__dirname, 'front/javascripts'),
  base: '/dist/',
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    cssUrl: 'relative',
    sourcemap: true,
    rollupOptions: {
      input: {
        common: realPath('common.js'),
        index: realPath('index.js'),
        login: realPath('login.js'),
        setup: realPath('setup.js'),
        form: realPath('form.js')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith('.css')) {
            return '[name].[ext]';  // CSSファイルを/dist/直下に配置
          }
          return 'assets/[name].[ext]';  // 他のファイルは/assets/に配置
        }
      },
    },
  },
  preprocess: vitePreprocess(),
  esbuild: {
    minify: true
  },
  optimizeDeps: {
    include: ['@tinymce/tinymce-svelte']
  },
  plugins: [
    svelte({
      compilerOptions: {
        dev: process.env.NODE_ENV !== 'production',
        // TODO アクセシビリティチェックを無効にする
      },
      compilerWarnings: {
        'a11y-img-missing-alt': 'ignore',
      },
      onwarn: (warning, handler) => {
        // a11y関連の警告は全部無視
        if (warning.code && warning.code.startsWith('a11y-')) return;
        if (warning.code === 'a11y-img-missing-alt') return;
    
        // それ以外はデフォルトのハンドラで処理
        handler(warning);
      },
    }),
    viteStaticCopy({
      targets: [
        {
          src: '../../node_modules/tinymce/**/*', // コピー元
          dest: 'tinymce', // コピー先 (dist/tinymce)
        },
        {
          src: '../../node_modules/@fortawesome/fontawesome-free/webfonts/*',
          dest: 'assets'
        }
      ],
    })
  ],
  resolve: {
    alias: {
      'path': 'path-browserify'
    },
    extensions: ['.mjs', '.js', '.svelte'],
    mainFields: ['svelte', 'browser', 'module', 'main'],
    dedupe: ['svelte'],
  },
  css: {
    postcss: {
      plugins: [
      ],
    },
  },
  server: {
    watch: {
      ignored: [
        '**/node_modules/**',
        '**/public/**',
        '**/views/**',
        '**/tests/**',
        '**/temp/**',
        '**/models/**',
        '**/migrations/**',
        '**/dist/**',
        '**/config/**',
        '**/routes/**'
      ]
    }
  }
});