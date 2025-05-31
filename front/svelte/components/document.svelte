<div class="document">
  {#if !noTitle }
  <div class="row">
    <div class="col-1">
      <label for="title" class="col-form-label">表題</label>
    </div>
    <div class="col-11">
    	<input type="text" class="form-control" id="title"
	  		bind:value={document.title}>
    </div>
  </div>
  {/if}
  {#if ( viewDescription )}
  {#if ( editting )}
  <div class="row">
    <DocumentFormat
      bind:type={document.descriptionType}
      disabled={document.descriptionType && ( document.description !== '')}></DocumentFormat>
  </div>
  {/if}
  <div class="row">
    <div class="col-12">
      {#if ( editting )}
      <Editor
        type={document.descriptionType}
        bind:value={document.description}></Editor>
      {:else}
      <div class="view markdown html line-numbersview">
        {@html textConvert(document.description, document.descriptionType, 'html')}
      </div>
	    {/if}
    </div>
  </div>
  {:else}
  <div class="row">
    <div class="col-12">
      <div class="abstract">
        {@html textConvert(document.description, document.descriptionType, 'text')}
      </div>
    </div>
  </div>
{/if}
</div>

<style>

</style>

<script>
import axios from 'axios';
import DocumentFormat from './document-format.svelte';
import Editor from './editor.svelte';
import textConvert from '../../../libs/text-convert.js';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
const dispatch = createEventDispatcher();

export let document;
export let editting;
export let viewDescription;
export let noTitle = false;

beforeUpdate(() => {
  console.log('document beforeUpdate', {document})
  if  ( !document ) {
    document = {
      description: ''
    };
  }
})

</script>
