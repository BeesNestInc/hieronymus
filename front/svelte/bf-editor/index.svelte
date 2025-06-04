<script>
  import { onMount } from 'svelte';
  import grapesjs from 'grapesjs';
  import grapesjsPresetWebpage from 'grapesjs-preset-webpage';
  import grapesjsBlocksBasic from 'grapesjs-blocks-basic';
  import grapesjsPluginForms from 'grapesjs-plugin-forms';
  import grapesjsComponentCountdown from 'grapesjs-component-countdown';
  import grapesjsPluginExport from 'grapesjs-plugin-export';
  import grapesjsTabs from 'grapesjs-tabs';
  import grapesjsCustomCode from 'grapesjs-custom-code';
  import grapesjsTouch from 'grapesjs-touch';
  import grapesjsParserPostcss from 'grapesjs-parser-postcss';
  import grapesjsTooltip from 'grapesjs-tooltip';
  import grapesjsTuiImageEditor from 'grapesjs-tui-image-editor';
  import grapesjsTyped from 'grapesjs-typed';
  import grapesjsStyleBg from 'grapesjs-style-bg';
  import preset from './preset.js';
  import {flatten} from 'flat';

  export let sampleContent = '';
  export let data = {};

  let editor;
  let _data;

  onMount(() => {
    _data = Object.entries(flatten(data)).map(([key, value]) => ({ [key]: value }));
    console.log({_data});
    editor = grapesjs.init({
      container: '#gjs',
      height: 'calc(100vh - 50px)', // 例: 上部メニューなどを考慮した高さ
      fromElement: true,
      showOffsets: true,
      assetManager: {
        embedAsBase64: true,
        assets: [
          '/img/team1.jpg',
          '/img/team2.jpg',
          '/img/team3.jpg',
          // …その他のアセット
        ]
      },
      selectorManager: { componentFirst: true },
      // ブロックパネルは左ペインへ固定
      blockManager: {
        appendTo: '#blocks-container'
      },
      // styleManager はデフォルトの配置に戻すため、appendTo を指定しない
      styleManager: {
        sectors: [
          {
            name: 'General',
            properties: [
              { extend: 'float', type: 'radio', default: 'none', options: [
                  { value: 'none', className: 'fa fa-times' },
                  { value: 'left', className: 'fa fa-align-left' },
                  { value: 'right', className: 'fa fa-align-right' }
                ] },
              'display',
              { extend: 'position', type: 'select' },
              'top', 'right', 'left', 'bottom'
            ]
          },
          {
        name: 'Dimension',
        open: false,
        buildProps: ['width', 'height', 'max-width', 'min-height', 'margin', 'padding'],
      },
      {
        name: 'Typography',
        open: false,
        buildProps: ['font-family', 'font-size', 'font-weight', 'color', 'line-height', 'letter-spacing'],
      },
      {
        name: 'Decorations',
        open: false,
        buildProps: ['background-color', 'border-radius', 'border', 'box-shadow', 'background'],
      },
      {
        name: 'Extra',
        open: false,
        buildProps: ['transition', 'perspective', 'transform'],
      },
        ]
      },
      plugins: [
        grapesjsBlocksBasic,
        grapesjsPluginForms,
        grapesjsComponentCountdown,
        grapesjsPluginExport,
        grapesjsTabs,
        grapesjsCustomCode,
        grapesjsTouch,
        grapesjsParserPostcss,
        grapesjsTooltip,
        grapesjsTuiImageEditor,
        grapesjsTyped,
        grapesjsStyleBg,
        //grapesjsPresetWebpage
        preset
      ],
      pluginsOpts: {
        'grapesjs-tui-image-editor': {
          script: [
            'https://uicdn.toast.com/tui.code-snippet/v1.5.2/tui-code-snippet.min.js',
            'https://uicdn.toast.com/tui-color-picker/v2.2.7/tui-color-picker.min.js',
            'https://uicdn.toast.com/tui-image-editor/v3.15.2/tui-image-editor.min.js'
          ],
          style: [
            'https://uicdn.toast.com/tui-color-picker/v2.2.7/tui-color-picker.min.css',
            'https://uicdn.toast.com/tui-image-editor/v3.15.2/tui-image-editor.min.css'
          ]
        },
        'grapesjs-tabs': {
          tabsBlock: { category: 'Extra' }
        },
        'grapesjs-typed': {
          block: {
            category: 'Extra',
            content: {
              type: 'typed',
              'type-speed': 40,
              strings: [
                'Text row one',
                'Text row two',
                'Text row three'
              ]
            }
          }
        },
        'grapesjs-preset-webpage': {
          modalImportTitle: 'Import Template',
          modalImportLabel: '<div style="margin-bottom: 10px; font-size: 13px;">Paste here your HTML/CSS and click Import</div>',
          modalImportContent: (editor) => {
            return editor.getHtml() + '<style>' + editor.getCss() + '</style>';
          }
        },
        [preset]: {
          removeBlocks: ['link'],
          valueList: _data
        }
      }
    });
});
</script>

<!-- レイアウト: ブロックパネルは左固定、キャンバスは残り領域に配置 -->
<div class="container-fluid p-0">
  <div class="row g-0">
    <!-- 左ペイン: ブロックマネージャ -->
    <div class="col-1 border-end" id="blocks-container" style="height: 100vh; overflow-y: auto; background-color: #f8f9fa;">
      <!-- GrapesJS が自動描画 -->
    </div>
    <!-- 右ペイン: キャンバス (styleManager は GrapesJS のデフォルトパネルとして配置) -->
    <div class="col-11">
      <div id="gjs" style="height: 100vh; overflow: auto;">
        {@html sampleContent}
        <slot></slot>
      </div>
    </div>
  </div>
</div>
