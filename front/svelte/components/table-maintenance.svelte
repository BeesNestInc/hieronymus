<div class="card">
  <div class="card-header d-flex">
    <h5 class="card-title">{title}</h5>
    <div class="d-flex ms-auto">
      <button type="button" class="btn"
        on:click={() => {
          minimize = !minimize;
        }}>
        {#if minimize}
        <i class="bi bi-square"></i>
        {:else}
        <i class="bi bi-dash-square"></i>
        {/if}
      </button>
    </div>
  </div>
  {#if ( !minimize )}
  <div class="card-body">
    <SpreadSheet
      bind:this={spreadsheet}
      columns={columns}
      reorder={reorder}
      bind:values={table}
      />
  </div>
  <div class="card-footer">
    <button type="button" class="btn btn-primary"
      on:click|preventDefault={update}>
      更新
    </button>
    <button type="button" class="btn btn-danger"
      on:click|preventDefault={cancel}>
      取消
    </button>
  </div>
  {/if}
</div>
<script>
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import SpreadSheet from '../components/spreadsheet.svelte';
import axios from 'axios';
import {eventBus} from '../../javascripts/table-maintenance.js';

export let title = '';
export let endpoint = '';
export let columns = [];
export let minimize;

let table = [];
let kinds = [];
let spreadsheet;
let reorder;

const update = (event) => {
  //console.log(table);
  let diff = spreadsheet.updateList(kinds, table);
  axios.put(endpoint, {
    values: diff
  }).then((result) => {
    kinds = result.data.values;
    //console.log({kinds});
    table = structuredClone(kinds);
    eventBus.emit('update');
  });
}
const cancel = (event) => {
  table = structuredClone(kinds);
}

const columnsUpdate = async () => {
  for ( let column of columns ) {
    if  ( column.func ) {
      let result = await column.func();
      column.source = result;
    }
  }
}

onMount(() => {
	reorder = false;
  for ( let column of columns ) {
    if	( column.type === 'order' )	{
      reorder = true;
    }
  }

  table = [];
  axios.get(endpoint).then((result) => {
    kinds = result.data.values;
    table = structuredClone(kinds);
  })
  columnsUpdate();
  eventBus.on('update', async () => {
    //console.log('update');
    await columnsUpdate();
    columns = columns;
  })
})
</script>