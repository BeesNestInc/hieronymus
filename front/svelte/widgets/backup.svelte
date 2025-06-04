<div class="menu">
  <div class="header">
    <button class="btn btn-primary" on:click|preventDefault={backup}>
      バックアップ作成
    </button>
  </div>
  <div class="body">
    <table class="table table-bordered">
      <thead class="table-light">
        <th>
          取得日時
        </th>
        <th>
          処理
        </th>
      </thead>
      <tbody>
        {#each files as file, i}
        <tr>
          <td style="vertical-align:middle;font-size:12pt;">
            {fileName(file)}
          </td>
          <td style="text-align:center;">
            {#if (i == 0) }
            <btton class="btn btn-success" on:click|preventDefault={() => restore(i)}>
              復元
            </btton>
            {:else}
            <btton class="btn btn-warning" on:click|preventDefault={() => restore(i)}>
              復元
            </btton>
            {/if}
            <btton class="btn btn-danger" on:click|preventDefault={() => remove(i)}>
              削除
            </btton>
          </td>
        </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<script>
import axios from 'axios';
import {onMount} from 'svelte';
import eventBus from '../../javascripts/event-bus.js';

export let toast;
export let status;

let files = [];
let modal;
let restoreFile;
let removeFile;

const fileName = (file) => {
  return  `${file.getFullYear()}年${file.getMonth()+1}月${file.getDate()}日${file.toLocaleTimeString()}`
}

const remove = (i) => {
  console.log('remove');
  removeFile = files[i];
  let description;
  if  ( i > 0 ) {
    description = `${fileName(removeFile)}に取得した<br />${i}世代前のバックアップを削除します。<br />よろしいですか？`;
  } else {
    description = `${fileName(removeFile)}に取得した<br />バックアップを削除します。<br />よろしいですか？`;
  }
  eventBus.emit('okModal', {
    title: 'バックアップの削除',
    description: description,
    reply: 'doRemove'
  });
}
const restore = (i) => {
  console.log('restore');
  restoreFile = files[i];
  let description;
  if  ( i > 0 ) {
    description = `${fileName(restoreFile)}に取得した<br />${i}世代前のバックアップから復元します。<br />よろしいですか？`;
  } else {
    description = `${fileName(restoreFile)}に取得した<br />バックアップから復元します。<br />よろしいですか？`;
  }
  eventBus.emit('okModal', {
    title:'バックアップの復元',
    description: description,
    reply: 'doRestore'
  });
}

const backup = () => {
  toast.show('バックアップ', 'バックアップ開始しました')
  axios.post('/api/admin/backup').then(() => {
    toast.remove();
    toast.show('バックアップ', 'バックアップ終了しました')
    updateFiles();
  })
}

const updateFiles = () => {
  files = [];
  axios.get('/api/admin/backups').then((result) => {
    for ( let m of result.data )  {
      files.push(new Date(m));
    }
    files = files;
  })
}
onMount(()=> {
  updateFiles();
  eventBus.once('doRemove', (ok) => {
    if  ( ok )  {
      axios.delete(`/api/admin/backup/${removeFile.toJSON()}`).then(() => {
        toast.show('バックアップ', 'バックアップ削除しました');
        updateFiles();
      })
    }
  })
  eventBus.once('doRestore', (ok) => {
    if  ( ok ) {
      console.log('Yes');
      toast.show('バックアップ', '復元開始しました');
      axios.post('/api/admin/restore', {
        date: restoreFile
      }).then((result) => {
        let data = result.data;
        if  ( data.code === 0 ) {
          window.location = '/home';
          toast.remove();
          toast.show('バックアップ', '復元完了しました');
        }
      })
    }
  })
})

</script>