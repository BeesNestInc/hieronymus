<div class="menu">
  <div class="body">
    <SpreadSheet
      bind:this={spreadsheet}
      columns={columns}
      reorder={reorder}
      bind:values={table}
      />
  </div>
  <div class="footer">
    <button type="button" class="btn btn-primary"
      on:click|preventDefault={update}>
      更新
    </button>
    <button type="button" class="btn btn-danger"
      on:click|preventDefault={cancel}>
      取消
    </button>
  </div>
</div>

<script>
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import SpreadSheet from '../components/spreadsheet.svelte';
import axios from 'axios';
import {eventBus} from '../../javascripts/table-maintenance.js';

export let endpoint = '';
export let columns = [];

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
  columns = columns;
}

onMount(() => {
	reorder = false;
  for ( let column of columns ) {
    if  ( column.func ) {
      column.source = [];
    }
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
  })
})
</script>