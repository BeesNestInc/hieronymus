<div class="menu">
  {#if (options.image)}
  <img src={options.image} class="card-img-top" alt={options.title}>
  {/if}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  {#if isEditMode }
  <div
    on:click={() => {
      isEditMode = !isEditMode;
    }}>
    <Editor conf={editorConf}
      scriptSrc='/dist/tinymce/tinymce.js'
      bind:value={options.description}
    />
  </div>
  {:else}
  <div class="body">
    {#if (options.description)}
    <p class="description">
      {@html options.description}
    </p>
    {/if}
  </div>
  {/if}
</div>
<style>
</style>
<script>
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import entries from '../../../config/module-list.js';
import Editor from '@tinymce/tinymce-svelte';
export let status;
export let options;

let isEditMode = false;

beforeUpdate(() => {
})

</script>
<script context="module">
const editorConf = {
  height: 260,
  license_key: 'gpl',
  plugins: [
    "advlist","autolink","code","visualchars","codesample",
    "lists","link","image","charmap","preview","anchor","searchreplace","visualblocks","emoticons",
    "insertdatetime","media","table","help"
  ],
  imagetools_cors_hosts: ['picsum.photos'],
  menubar: 'edit insert format table tools help',
  toolbar: 'undo redo restoredraft | bold italic underline strikethrough | casechange blocks | alignleft aligncenter alignright alignjustify | outdent indent |  numlist bullist | insertfile image media template link anchor codesample code | pagebreak | charmap emoticons | fullscreen  preview save print | forecolor backcolor removeformat | ltr rtl | table',
  toolbar_sticky: true,
  codesample_languages: [
    { text: 'HTML/XML', value: 'markup' },
  ],
  paste_as_text: true,
  relative_urls : false
}
</script>
