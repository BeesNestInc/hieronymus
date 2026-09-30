<div class="card">
  <div class="card-header">
    <h5 class="card-title">年度選択</h5>
  </div>
  <div class="card-body">
    <div class="row h-100" style="overflow-y: scroll;">
      <table class="table table-bordered">
        <thead class="table-light">
          <th scol="col">
            年度
          </th>
          <th col="col">
            開始年月日
          </th>
          <th col="col">
            終了年月日
          </th>
          <th col="col">
            税込み
          </th>
          <th col="col">
            確定
          </th>
          <th col="col">
            年度末処理
          </th>
        </thead>
        <tbody>
          {#each lines as line}
          <tr>
            <td>
              {#if ( line.term != status.fy.term)}
              <a href="/home/{line.term}">
                {line.term}期
              </a>
              {:else}
              <span>
                <i class="fas fa-check"></i>
                {line.term}期
              </span>
              {/if}
            </td>
            <td>
              {line.startDate.getFullYear()}年({wareki(line.startDate)})
              {line.startDate.getMonth()+1}月
              {line.startDate.getDate()}日
            </td>
            <td>
              {line.endDate.getFullYear()}年({wareki(line.endDate)})
              {line.endDate.getMonth()+1}月
              {line.endDate.getDate()}日
            </td>
            <td style="text-align: center;">
              <input type="checkbox" bind:checked={line.taxIncluded}
                disabled={!!line.lockedAt}
                on:change={() => change(line)}>
            </td>
            <td>
              {#if ( line.lockedAt )}
              <span title={new Date(line.lockedAt).toLocaleString()}>
                確定済み
              </span><br/>
              {#if ( status.user && status.user.administrable )}
              <button class="btn btn-sm btn-outline-secondary" on:click={() => unlock(line)}>
                確定を取り消す
              </button>
              {/if}
              {:else}
              {#if ( status.user && (status.user.administrable || status.user.accounting) )}
              <button class="btn btn-sm btn-outline-secondary" on:click={() => lock(line)}>
                確定
              </button>
              {/if}
              {/if}
            </td>
            <td>
              {#if ( status.user && status.user.administrable )}
              <a class="btn btn-danger closing" href="/closing/{line.term}">
                繰越
              </a>
              {/if}
            </td>
          </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>

<style>
th {
  text-align: center;
  font-weight: bold;
}
td {
    vertical-align: middle;
}
</style>
<script>
import axios from 'axios';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import {wareki} from '../../../libs/utils';

export  let status;

let lines = [];

const change = (line) => {
  //console.log('change', line)
  axios.put(`/api/term/${line.id}`, line).then((result) => {
    lines = undefined;
  }).catch((e) => {
    if ( e.response && e.response.status === 423 ) {
      alert('この年度は確定済みのため変更できません。');
      reload();
    }
  })
}

const reload = () => {
  lines = [];
  axios.get('/api/term').then((res) => {
    let data = res.data;
    for ( let i = 0; i < data.length; i ++ )    {
      let line = data[i];
      lines.push({
        id: line.id,
        term: line.term,
        startDate: new Date(line.startDate),
        endDate: new Date(line.endDate),
        taxIncluded: line.taxIncluded,
        lockedAt: line.lockedAt,
        lockedBy: line.lockedBy
      });
    }
    lines = lines;
  });
}

const lock = (line) => {
  if ( !confirm(`${line.term}期を確定しますか？確定後は管理権限でも通常の編集はできなくなります。`) ) {
    return;
  }
  axios.put(`/api/term/${line.id}/lock`).then(() => {
    reload();
  }).catch((e) => {
    alert('確定に失敗しました。');
  });
}

const unlock = (line) => {
  if ( !confirm(`${line.term}期の確定を取り消しますか？`) ) {
    return;
  }
  axios.put(`/api/term/${line.id}/unlock`).then(() => {
    reload();
  }).catch((e) => {
    if ( e.response && e.response.status === 403 ) {
      alert('確定を取り消すには管理権限が必要です。');
    } else {
      alert('確定の取り消しに失敗しました。');
    }
  });
}

onMount(() => {
  reload();
});
</script>
