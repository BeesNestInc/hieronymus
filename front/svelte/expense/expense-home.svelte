<div class="page-title d-flex justify-content-between">
  <h1>設定</h1>
</div>
<div class="full-height-1">
  {#if ( accounts.length === 0 )}
  <p>読み込み中...</p>
  {:else}
  <div class="row">
    <div class="col-8" style="padding:10px;">
      <div class="container-fluid pile-dropzone"
        class:over={pileDragCount > 0}
        on:dragenter={onPileDragEnter}
        on:dragleave={onPileDragLeave}
        on:dragover={(e) => { if ( e.dataTransfer.types.includes('Files') ) { e.preventDefault(); } }}
        on:drop={onPileDrop}>
        <div class="d-flex align-items-center mb-1">
          <h2 class="fs-5 me-3 mb-0">未整理の証憑</h2>
          <label class="btn btn-sm btn-outline-primary upload-label">
            まとめてアップロード
            <input type="file" hidden multiple accept="image/*,application/pdf"
              on:change={(e) => { uploadVouchers(e.target.files); e.target.value = ''; }}>
          </label>
        </div>
        <div class="drop-hint">
          {#if ( unsorted.length > 0 )}
          <div class="table-responsive pile-table">
          <table class="table table-striped table-bordered">
            <thead class="table-light">
              <tr>
                <th>ファイル</th>
                <th>説明</th>
                <th class="number">金額</th>
                <th style="width:30px;"></th>
              </tr>
            </thead>
            <tbody>
              {#each unsorted as line}
              <tr>
                <td>
                  <div class="d-flex align-items-start">
                    {#each line.files as file}
                    <div class="me-1">
                      <a href="/voucher/file/{file.id}" target="_blank">
                        {#if ( file.mimeType && file.mimeType.match(/^image\//) )}
                        <img src="/voucher/file/{file.id}" class="thumb"/>
                        {:else}
                        <img src="/public/icons/icon_pdf.png" class="thumb"/>
                        {/if}
                      </a>
                    </div>
                    {/each}
                  </div>
                </td>
                <td>{line.description || ( line.files[0] ? line.files[0].name : '' )}</td>
                <td class="number">{line.amount != null ? numeric(line.amount).toLocaleString() : ''}</td>
                <td>
                  <button type="button" class="btn btn-sm btn-outline-danger p-0 px-1"
                    on:click={() => { deleteVoucher(line); }}>
                    <i class="bi bi-x"></i>
                  </button>
                </td>
              </tr>
              {/each}
            </tbody>
          </table>
          </div>
          {:else}
          <div class="text-center text-muted py-4">
            <i class="bi bi-cloud-arrow-up fs-2 d-block"></i>
            ここに領収書などの画像・PDFをドラッグ&ドロップするか、
            「まとめてアップロード」で一括登録してください
          </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
  <div class="row">
    <div class="col-8" style="padding:10px;">
      <TableMaintenance
        title={'支払先マッピング'}
        endpoint={'/api/expense_mapping/payee'}
        accounts={accounts}
        bind:minimize={payeeMinimize}
        columns={[
          { type: "id", name: 'id'},
          { type: "text", name: 'key', title: "検索キー", width: "90px", align: "left"},
          { type: "text", name: 'name', title: "名前", width: "150px", align: "left"},
          { type: "company", name: 'companyId', title: "取引先"},
          { type: "account", name: 'account', sub: 'subAccount', title: "勘定科目"}
      ]}></TableMaintenance>
    </div>
  </div>
  <div class="row">
    <div class="col-8" style="padding:10px;">
      <TableMaintenance
        title={'出金元マッピング'}
        endpoint={'/api/expense_mapping/payment'}
        accounts={accounts}
        bind:minimize={paymentMinimize}
        columns={[
          { type: "id", name: 'id'},
          { type: "text", name: 'key', title: "検索キー", width: "90px", align: "left"},
          { type: "text", name: 'name', title: "名前", width: "150px", align: "left"},
          { type: "account", name: 'account', sub: 'subAccount', title: "勘定科目"},
          { type: "checkbox", name: 'advance', title: "立替", width: "50px"}
      ]}></TableMaintenance>
    </div>
  </div>
  {/if}
</div>
<script>
import {onMount} from 'svelte';
import TableMaintenance from '../components/table-maintenance.svelte';
import axios from 'axios';
import {numeric} from '../../../libs/utils';
import {setAccounts} from '../../javascripts/cross-slip';

export let status;
export let toast;

let payeeMinimize = false;
let paymentMinimize = false;
let accounts = [];
let unsorted = [];

const fetchUnsorted = () => {
  // どこにも紐付いていない証憑（未整理のまるっとアップロード含む）。
  // セッションのtermが未選択でも取得できるよう ?term= を渡す
  axios.get('/api/voucher', {
    params: { expenseUnlinked: 1, term: status.fy ? status.fy.term : undefined }
  }).then((result) => {
    unsorted = (result.data.vouchers || []).filter((v) => !v.details.length);
  });
};

// 未整理証憑のまるっとアップロード（複数ファイル可）
const uploadVouchers = async (files) => {
  if ( !files || files.length === 0 ) {
    return;
  }
  try {
    const fd = new FormData();
    for ( const f of files ) {
      fd.append('file', f, f.name);
    }
    await axios.post('/api/expense_report/vouchers', fd,
      { 'content-type': 'multipart/form-data' });
    toast.show('経費精算', `${files.length}件の証憑をアップロードしました。`);
    fetchUnsorted();
  } catch (e) {
    toast.show('経費精算', e.response && e.response.data && e.response.data.message ?
      e.response.data.message : (e.message || 'アップロードに失敗しました。'), 'warning');
  }
};

// 未整理証憑の削除（自分が登録した証憑は削除できる）
const deleteVoucher = async (voucher) => {
  if ( !window.confirm('この証憑を削除します。よろしいですか？') ) {
    return;
  }
  try {
    await axios.delete(`/api/voucher/${voucher.id}`);
    toast.show('経費精算', '証憑を削除しました');
    fetchUnsorted();
  } catch (e) {
    toast.show('経費精算', e.message || '削除に失敗しました。', 'warning');
  }
};

// パイルへのファイルドロップでアップロードする（ ExpenseEntry と同じ挙動）
let pileDragCount = 0;

const onPileDragEnter = (event) => {
  if ( event.dataTransfer.types.includes('Files') ) {
    pileDragCount += 1;
  }
};

const onPileDragLeave = (event) => {
  if ( event.dataTransfer.types.includes('Files') ) {
    pileDragCount = Math.max(0, pileDragCount - 1);
  }
};

const onPileDrop = (event) => {
  pileDragCount = 0;
  const files = event.dataTransfer.files;
  if ( files.length > 0 ) {
    event.preventDefault();
    uploadVouchers(files);
  }
};

onMount(() => {
  axios.get('/api/accounts').then((result) => {
    accounts = result.data || [];
    setAccounts(accounts);
  });
  fetchUnsorted();
});
</script>

<style>
.thumb {
  width: 48px;
  height: 48px;
  object-fit: contain;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
}
.upload-label {
  white-space: nowrap;
}
.drop-hint {
  border: 2px dashed #a9c6e8;
  border-radius: 6px;
  padding: 6px;
  min-height: 100px;
}
.pile-dropzone.over .drop-hint {
  border-color: #4d8fd1;
}
.pile-table {
  max-height: 30vh;
  overflow: auto;
}
.pile-dropzone.over {
  background-color: #eef6ff;
  outline: 2px dashed #4d8fd1;
  outline-offset: -6px;
}
</style>
