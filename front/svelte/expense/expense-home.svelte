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
          <span class="badge bg-secondary" title="どこにも紐付いていない証憑">残り {unsorted.length}件</span>
          <label class="btn btn-sm btn-outline-primary upload-label ms-2">
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
                <th style="width:110px;"></th>
              </tr>
            </thead>
            <tbody>
              {#each unsorted as line}
              <tr>
                <td>
                  <div class="d-flex align-items-start">
                    {#each line.files as file}
                    <div class="me-1">
                      {#if ( file.mimeType && file.mimeType.match(/^image\//) )}
                      <button type="button" class="thumb-button" title="クリックで拡大表示"
                        on:click={() => { openPreview(line, file); }}>
                        <img src="/voucher/file/{file.id}?v={imageVersion}" class="thumb"/>
                      </button>
                      {:else}
                      <a href="/voucher/file/{file.id}?v={imageVersion}" target="_blank">
                        <img src="/public/icons/icon_pdf.png" class="thumb"/>
                      </a>
                      {/if}
                    </div>
                    {/each}
                  </div>
                </td>
                <td class="pile-desc">
                  <input type="text" class="form-control form-control-sm"
                    placeholder={ line.files[0] ? line.files[0].name : '説明' }
                    title="説明を入力できます（省略時はファイル名で表示）"
                    bind:value={line.description}
                    on:change={() => { saveDescription(line); }}>
                </td>
                <td class="number">{line.amount != null ? numeric(line.amount).toLocaleString() : ''}</td>
                <td style="white-space:nowrap;">
                  <button type="button" class="btn btn-sm btn-outline-secondary p-0 px-1 me-1"
                    title="左90°回転" on:click={() => { rotateVoucher(line, 270); }}>
                    <i class="bi bi-arrow-counterclockwise"></i>
                  </button>
                  <button type="button" class="btn btn-sm btn-outline-secondary p-0 px-1 me-1"
                    title="右90°回転" on:click={() => { rotateVoucher(line, 90); }}>
                    <i class="bi bi-arrow-clockwise"></i>
                  </button>
                  <button type="button" class="btn btn-sm btn-outline-info p-0 px-1 me-1"
                    title="複数の証憑が写っている場合は分離、1枚の場合は背景を除いて切り出します"
                    on:click={() => { splitVoucher(line); }}>
                    <i class="bi bi-scissors"></i>
                  </button>
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
        initialRow={payeeInitial}
        columns={[
          { type: "id", name: 'id'},
          { type: "text", name: 'key', title: "検索キー", width: "90px", align: "left"},
          { type: "text", name: 'name', title: "名前", width: "150px", align: "left"},
          { type: "company", name: 'companyId', title: "取引先"},
          { type: "account", name: 'account', sub: 'subAccount', title: "勘定科目"},
          { type: "checkbox", name: 'noBundle', title: "同日まとめない", width: "90px", align: "center"},
      ]}></TableMaintenance>
    </div>
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
{#if ( preview )}
<div class="preview-overlay" on:click|self={() => { preview = null; }}>
  <div class="preview-box">
    <div class="d-flex justify-content-between align-items-center mb-2">
      <strong>{preview.title}</strong>
      <div>
        <a href={preview.src} target="_blank" class="btn btn-sm btn-outline-secondary me-2">別タブで開く</a>
        <button type="button" class="btn btn-sm btn-secondary" on:click={() => { preview = null; }}>閉じる</button>
      </div>
    </div>
    <img src={preview.src} class="preview-img" alt={preview.title}/>
  </div>
</div>
{/if}
<script>
import {onMount} from 'svelte';
import TableMaintenance from '../components/table-maintenance.svelte';
import axios from 'axios';
import {numeric} from '../../../libs/utils';
import {setAccounts} from '../../javascripts/cross-slip';
import eventBus from '../../javascripts/event-bus.js';

export let status;
export let toast;

let payeeMinimize = false;
let paymentMinimize = false;
let accounts = [];
let unsorted = [];
// 証憑画像の差し替え後の再表示用（ブラウザキャッシュを無効化するバージョン）
let imageVersion = 0;

// 支払先マッピングの初期値付き遷移用（?payeeCompany=&payeeName=&payeeKey=）。
// 精算書のAI読み取りで未登録だった支払先を、その場で登録できるようにする
let payeeInitial = null;
{
  const params = new URLSearchParams(location.search);
  const company = params.get('payeeCompany');
  const name = params.get('payeeName');
  const key = params.get('payeeKey');
  if ( company || name || key ) {
    payeeInitial = {};
    if ( company ) payeeInitial.companyId = parseInt(company);
    if ( name ) payeeInitial.name = name;
    if ( key ) payeeInitial.key = key;
  }
}

// 画像プレビュー（モーダル）。PDFは別タブ表示のまま
let preview = null;
const openPreview = (voucher, file) => {
  preview = {
    src: `/voucher/file/${file.id}?v=${imageVersion}`,
    title: voucher.description || ( file ? file.name : '' ) || '証憑'
  };
};

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

// 未整理証憑の説明をインライン保存する（bind:valueでローカルは更新済み）
const errText = (e) => {
  if ( e.response && e.response.data && e.response.data.message ) {
    return e.response.data.message;
  }
  return e.message || 'エラーが発生しました。';
};

const saveDescription = async (voucher) => {
  const prev = voucher.description;
  try {
    await axios.put('/api/voucher', {
      id: voucher.id,
      description: voucher.description || null
    });
  } catch (e) {
    voucher.description = prev;
    unsorted = unsorted;
    toast.show('経費精算', errText(e), 'warning');
  }
};

// 証憑画像の90°回転（天地逆などの手動補正）
const rotateVoucher = async (voucher, deg) => {
  try {
    await axios.post('/api/expense_report/voucher_rotate', {
      voucherId: voucher.id, deg: deg
    });
    imageVersion += 1;
    toast.show('経費精算', '回転しました');
  } catch (e) {
    toast.show('経費精算', e.response && e.response.data && e.response.data.message ?
      e.response.data.message : (e.message || '回転に失敗しました。'), 'warning');
  }
};

// 確認ダイアログ。window.confirm はブラウザのダイアログ抑制で
// 無効化されることがあるため、アプリ内のモーダル（okModal）を使う
const confirmModal = (title, description, reply) => {
  return new Promise((resolve) => {
    eventBus.once(reply, (ok) => {
      resolve(ok);
    });
    eventBus.emit('okModal', { title, description, reply });
  });
};

// 未整理証憑の分離: 1枚のスキャンに写った複数の証憑を個別の証憑に切り出す
// （AI不使用の幾何検出。元の証憑は残り、不採用の切り出しは後から削除できる）
const splitVoucher = async (voucher) => {
  const allowed = await confirmModal('経費精算',
    'この証憑を分離・切り出しますか？<br/>複数の証憑が写っている場合は個別の証憑に分け、1枚の場合は背景を除いて切り出します。',
    'expense-split-voucher-home');
  if ( !allowed ) {
    return;
  }
  try {
    const result = await axios.post('/api/expense_report/voucher_split', {
      voucherId: voucher.id
    });
    const count = ( result.data.vouchers || [] ).length;
    if ( result.data.trimmed ) {
      imageVersion += 1;
      toast.show('経費精算', '背景を除いて証憑だけに切り出しました。');
    } else if ( result.data.straightened ) {
      imageVersion += 1;
      toast.show('経費精算', '1枚の証憑のため分離はしませんでした。傾きを補正しました。');
    } else {
      toast.show('経費精算', `${count}枚に分離しました。不採用のものは削除してください。`);
    }
  } catch (e) {
    toast.show('経費精算', e.response && e.response.data && e.response.data.message ?
      e.response.data.message : (e.message || '分離に失敗しました。'), 'warning');
  }
  fetchUnsorted();
};

// 未整理証憑の削除（自分が登録した証憑は削除できる）
const deleteVoucher = async (voucher) => {
  const allowed = await confirmModal('経費精算', 'この証憑を削除します。<br/>よろしいですか？', 'expense-delete-voucher-home');
  if ( !allowed ) {
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
.thumb-button {
  padding: 0;
  border: none;
  background: transparent;
  cursor: zoom-in;
}
.preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-box {
  background: #fff;
  padding: 12px;
  border-radius: 8px;
  max-width: 92vw;
}
.preview-img {
  max-width: 88vw;
  max-height: 80vh;
  object-fit: contain;
}
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
/* 行ピッチを揃える: セル中央揃え */
.pile-table th, .pile-table td {
  vertical-align: middle;
}
.pile-desc {
  width: 40%;
  min-width: 160px;
}
.pile-dropzone.over {
  background-color: #eef6ff;
  outline: 2px dashed #4d8fd1;
  outline-offset: -6px;
}
</style>
