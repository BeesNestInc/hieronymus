<div class="editor">
  <div class="row">
{#if ( type === 'text')}
    <div class="col-12" style="padding:0;">
      <CodeMirror class="w-100"
        bind:value={value}
        lineWrapping={true}
        styles={{
          "&": {
            width: "100%",
            height: "800px",
            'background-color': "#fff",
            border: "1px solid #ccc",
            'border-radius': "4px"
          }
        }}
        lang={markdown()}
      />
    </div>
{:else if ( type === 'markdown')}
    <div class="col-6" style="padding:0 5px 0 0;">
      <CodeMirror id="editor"
        bind:value={value}
        lineWrapping={true}
        on:ready={(e) => { view = e.detail }}
        styles={{
          "&": {
            width: "100%",
            height: "800px",
            'background-color': "#fff",
            border: "1px solid #ccc",
            'border-radius': "4px"
          }
        }}
        lang={[markdown(), javascript()]}
      />
    </div>
    <div class="markdown line-numbers col-6" id="markdown">
      <div id="markdown_body"></div>
    </div>
{:else}
    <div class="col-12" style="padding:0;">
      <Editor conf={editorConf}
        scriptSrc='/dist/tinymce/tinymce.js'
        bind:value={value}
      />
    </div>
{/if}
  </div>
</div>
<style>


</style>
  
<script>
import {onMount, beforeUpdate, afterUpdate, onDestroy, createEventDispatcher} from 'svelte';
import Editor from '@tinymce/tinymce-svelte';
import CodeMirror from "svelte-codemirror-editor";
import { markdown } from "@codemirror/lang-markdown";
import { javascript } from "@codemirror/lang-javascript";
import textConvert from '../../../libs/text-convert.js';
import morphdom from 'morphdom';

export let type;
export let value;

let view;

const setPosition = (row, column) => {
  const line = view.state.doc.line(row);      // 指定行の情報を取得
  const position = line.from + (column - 1);  // 行の開始位置 + 列 (0始まりに調整)

  const transaction = view.state.update({
    selection: {
      anchor: position
    },
    scrollIntoView: true
  });
  view.dispatch(transaction);
}

const getPosition = () => {
  const position = view.state.selection.main.anchor;
  const line = view.state.doc.lineAt(position);
  return ({
    row: line.number,
    column: position - line.from + 1
  });
}

beforeUpdate(() => {
  console.log({type});
})

function waitForAllImages(container) {
  const images = container.querySelectorAll('img');
  const promises = Array.from(images).map((img) => {
    return new Promise((resolve) => {
      if (img.complete) {
        resolve();
      } else {
        img.addEventListener('load', resolve);
        img.addEventListener('error', resolve);
      }
    });
  });

  return Promise.all(promises);
}

afterUpdate(async () => {
  const result = document.getElementById('markdown_body');
  if  ( result )  {
    const previousScrollTop = result.scrollTop;

    let html = textConvert(value, 'markdown', 'html');
    morphdom(result, `<div id="markdown_body">${html}</div>`);

    await waitForAllImages(result);

    result.scrollTop = previousScrollTop;
  }
});

const editorConf = {
    height: 800,
    license_key: 'gpl',
    plugins: [
       "advlist","autolink","code","visualchars","codesample",
       "lists","link","image","charmap","preview","anchor","searchreplace","visualblocks","pagebreak","emoticons",
       "fullscreen","insertdatetime","media","table","help","wordcount"
     ],
    imagetools_cors_hosts: ['picsum.photos'],
    menubar: 'file edit insert view format table tools help',
    toolbar: 'undo redo restoredraft | bold italic underline strikethrough | casechange blocks | alignleft aligncenter alignright alignjustify | outdent indent |  numlist bullist | insertfile image media template link anchor codesample code | pagebreak | charmap emoticons | fullscreen  preview save print | forecolor backcolor removeformat | ltr rtl | table',
    toolbar_sticky: true,
    codesample_languages: [
        { text: 'HTML/XML', value: 'markup' },
        { text: 'JavaScript', value: 'javascript' },
        { text: 'CSS', value: 'css' },
        { text: 'PHP', value: 'php' },
        { text: 'Ruby', value: 'ruby' },
        { text: 'Python', value: 'python' },
        { text: 'Java', value: 'java' },
        { text: 'C', value: 'c' },
        { text: 'C#', value: 'csharp' },
        { text: 'C++', value: 'cpp' },
        { text: 'Shell', value: 'shell'}
      ],
      paste_as_text: true,
      relative_urls : false
  }
</script>