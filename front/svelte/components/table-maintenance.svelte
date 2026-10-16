<div class={card ? 'card' : 'tablem-plain'}>
  <div class={card ? 'card-header d-flex' : 'd-flex tablem-title-row'}>
    <h5 class={card ? 'card-title' : 'fs-5 me-3 mb-0'}>{title}</h5>
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
  <div class={card ? 'card-body' : ''}>
    <SpreadSheet
      bind:this={spreadsheet}
      columns={columns}
      accounts={accounts}
      reorder={reorder}
      bind:values={table}
      />
  </div>
  <div class={card ? 'card-footer' : 'd-flex gap-2 py-2'}>
    <button type="button" class="btn btn-primary"
      on:click|preventDefault={update}>
      保存
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
export let accounts = [];
export let minimize;
// card=falseでBootstrapのcardではなく平たいテーブルとして表示する
export let card = true;
// 新規行の初期値（例: 別画面からの遷移で1行だけ埋めた状態にする）
export let initialRow = null;

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
// 空テーブルでも行の「+」が操作できるように、バッファには常に空行を1行積んでおく
const buffered = (rows) => {
  return ( rows.length === 0 ) ? [{}] : rows;
}
const cancel = (event) => {
  table = buffered(structuredClone(kinds));
}

const columnsUpdate = async () => {
  // columnオブジェクトをmutateしても子に同一参照として渡されるため
  // 変更が伝播しない。sourceを持つcolumnは新オブジェクトに差し替える。
  const next = [];
  for ( let column of columns ) {
    if ( column.func ) {
      let result = await column.func();
      next.push({ ...column, source: result });
    } else {
      next.push(column);
    }
  }
  columns = next;
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
    table = buffered(structuredClone(kinds));
    // 初期値付き遷移: 同内容の行がなければ空行に埋める（保存はユーザーが行う）
    if ( initialRow ) {
      const exists = table.some((row) => {
        return Object.keys(initialRow).every((k) => ( row[k] == initialRow[k] ));
      });
      if ( !exists ) {
        const blank = table.find((row) => ( !row.id ));
        if ( blank ) {
          Object.assign(blank, structuredClone(initialRow));
        } else {
          table = [ ...table, structuredClone(initialRow) ];
        }
        table = table;
      }
    }
  })
  columnsUpdate();
  eventBus.on('update', async () => {
    //console.log('update');
    await columnsUpdate();
    columns = columns;
  })
})
</script><style>
.tablem-plain .tablem-title-row {
  padding: 6px 2px;
  border-bottom: 2px solid #ccc;
  margin-bottom: 4px;
}
.tablem-plain .table-responsive {
  border: 1px solid #dee2e6;
  border-radius: 4px;
}
.tablem-plain .btn {
  padding: 2px 10px;
  font-size: 0.875rem;
}
</style>
