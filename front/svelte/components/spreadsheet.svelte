<table class="table table-striped table-bordered">
  <thead class="table-light">
    <tr>
      {#if (reorder)}
      <th scope="col" style="width:30px;"></th> <!-- DnD用のカラム -->
      {/if}
      {#each columns as column}
      {#if ( ( column.type !== 'hidden' ) &&
             ( column.type !== 'id') &&
             ( column.type !== 'order' ))}
      <th scope="col" style={column.width ? `width:${column.width}` : ""}>
        {column.title}
      </th>
      {/if}
      {/each}
      <th scope="col" style="width:74px;"></th>
    </tr>
  </thead>
  <tbody bind:this={tbody}>
    {#each values as line, i (line)}
    <tr style="height:30px;"
      data-id={i}> <!-- 各行にIDを追加（Sortable のため） -->
      {#if (reorder)}
      <td class="drag-handle" style="cursor: grab;padding:0px 0px 0px 8px;">
        <i class="fas fa-grip-lines"></i> <!-- DnDのアイコン -->
      </td>
      {/if}
      {#each columns as column, j}
      {#if ( ( column.type !== 'hidden' ) &&
             ( column.type !== 'id') &&
             ( column.type !== 'order' ))}
      <td style="padding:0;height:30px;{column.align ? `text-align:${column.align}` : ''}">
        <OmniInput
          style="height:30px;margin:0px;font-size:12pt;{column.width ? `width:${column.width}` : ""}"
          bind:value={line[column.name]}
          column={column}></OmniInput>
      </td>
      {/if}
      {/each}
      <td style="padding:0;width:68px;">
        <button type="button"
          class="btn btn-primary btn-sm"
          on:click={() => {
            values.splice(i + 1, 0, {});
            values = [...values];
          }}>
          <i class="fas fa-plus"></i>
        </button>
        {#if (values.length > 1)}
        <button type="button" class="btn btn-danger btn-sm"
          on:click={() => {
            values.splice(i, 1);
            values = [...values];
          }}>
          <i class="fas fa-minus"></i>
        </button>
        {/if}
      </td>
    </tr>
    {/each}
  </tbody>
</table>
<style>
</style>
<script>
import { onMount, beforeUpdate } from "svelte";
import OmniInput from "./omni-input.svelte";
import Sortable from "sortablejs";

export let values = [];
export let columns = [];
export let reorder;

let tbody;

beforeUpdate(() => {
  //console.log('spreadsheet beforeUpdate', columns)
})

const getField = (type) => {
  for ( let i = 0; i < columns.length ; i += 1 )  {
    if  ( columns[i].type === type )  {
      return  (columns[i].name)
    }
  }
}

const setOrder = () => {
  let order = getField('order');
  try {
    let i = 0;
    values.forEach((value) => {
      value[order] = i;
      i += 1;
    })
  } catch (e) {
    console.log(e);
  }
}
const checkUpdate = (ent1, ent2) => {
  for ( let i = 0 ; i < columns.length ; i += 1 ) {
    let column = columns[i];
    //console.log(ent1[column.name], ent2[column.name]);
    if  ( column.type !== 'id' ) {
      if  ( ent1[column.name] !== ent2[column.name] ) {
        return  (true)
      }
    }
  }
  return  (false)
}
export const updateList = (orig, changes) => {
  let diff = [];
  setOrder();
  let id = getField('id');
  //console.log({id});
  orig.forEach((ent) => {
    let found = false;
    changes.find((value) => {
      if  ( ent[id] === value[id] ) {
        if  ( checkUpdate(ent, value) ) {
          diff.push(value); //  update
        }
        found = true;
      }
    });
    if  ( !found )  {
      diff.push({
        id: ent[id]
      });  //  delete
    }
  });
  changes.forEach((value) => {
    if  ( !value[id] ) {
      diff.push(value); //  new
    }
  });
  console.log(diff);
  return  (diff);
}

onMount(() => {
  new Sortable(tbody, {
    animation: 150,
    handle: ".drag-handle",
    onEnd: (evt) => {
      let { oldIndex, newIndex } = evt;
      //console.log(oldIndex, newIndex);

      if (oldIndex !== newIndex) {
        // 順番を正しく入れ替える
        const newValues = [...values];
        const movedItem = newValues.splice(oldIndex, 1)[0];
        //console.log({movedItem});
        //console.log(newValues);
        newValues.splice(newIndex, 0, movedItem);
        //console.log(newValues);
        // 新しい配列を `values` にセット（Svelte の reactivity を適用）
        values = newValues;
      }
    }
  });
});
</script>
