<div class="page-title d-flex justify-content-between">
  <h1>未整理の証憑</h1>
</div>
<div class="full-height-1">
  <div style="padding:10px;">
    <div class="container-fluid pile-dropzone"
      class:over={pileDragCount > 0}
      on:dragenter={onPileDragEnter}
      on:dragleave={onPileDragLeave}
      on:dragover={(e) => { if ( e.dataTransfer.types.includes('Files') ) { e.preventDefault(); } }}
      on:drop={onPileDrop}>
      <div class="d-flex align-items-center mb-1">
        <span class="badge bg-secondary" title="どこにも紐付いていない証憑">残り {unsorted.length}件</span>
        {#if ( settledCount > 0 )}
        <span class="badge bg-success ms-1" title="OK済み（もう処理しません）">済 {settledCount}件</span>
        {/if}
        <label class="btn btn-sm btn-outline-primary upload-label ms-2">
          まとめてアップロード
          <input type="file" hidden multiple accept="image/*,application/pdf"
            on:change={(e) => { uploadVouchers(e.target.files); e.target.value = ''; }}>
        </label>
        {#if ( bulkBusy )}
        <button type="button" class="btn btn-sm btn-outline-danger ms-2"
          on:click={() => { bulkStop = true; }}>
          <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
          認識中 {bulkDone}/{bulkTotal}　中断
        </button>
        {:else}
        <button type="button" class="btn btn-sm btn-outline-info ms-2"
          disabled={ pending.length === 0 }
          title="未認識の証憑を順次AIで読み取り、結果を証憑に保存します（OK済みの行は除外）"
          on:click={() => { recognizeAll(); }}>
          <i class="bi bi-stars"></i>&nbsp;一括認識（{pending.length}）
        </button>
        {/if}
      </div>
      <div class="drop-hint">
        {#if ( unsorted.length > 0 )}
        <div class="table-responsive pile-table">
        <table class="table table-striped table-bordered">
          <thead class="table-light">
            <tr>
              <th style="width:160px;">ファイル</th>
              <th>説明</th>
              <th>会社</th>
              <th style="width:130px;">日付</th>
              <th class="number" style="width:120px;">金額</th>
              <th style="width:118px;"></th>
            </tr>
          </thead>
          <tbody>
            {#each unsorted as line}
            <tr class:done={ line.settledAt }>
              <td style="width:160px;">
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
                  disabled={ !canEdit(line) }
                  on:change={() => { saveDescription(line); }}>
                {#if ( line._aiError )}
                <div class="alert alert-danger py-1 px-2 mt-1 mb-0" style="font-size:0.75rem;">
                  <i class="bi bi-exclamation-triangle-fill"></i>
                  {line._aiError}
                </div>
                {/if}
                {#if ( line.settleUser )}
                <div class="text-success" style="font-size:0.75rem;">
                  <i class="bi bi-check2-circle"></i>&nbsp;済 {line.settleUser.name} {line.settledAt ? String(line.settledAt).slice(0, 10) : ''}
                </div>
                {/if}
              </td>
              <td>
                {#key line.companyId}
                <select class="form-select form-select-sm"
                  bind:value={line.companyId}
                  disabled={ !canEdit(line) }
                  on:change={() => { saveCompany(line); }}>
                  <option value={null}></option>
                  {#each companies as c}
                  <option value={c.id}>{c.name}</option>
                  {/each}
                </select>
                {/key}
              </td>
              <td>
                <input type="date" class="form-control form-control-sm"
                  value={ line.paymentDate || line.issueDate || '' }
                  disabled={ !canEdit(line) }
                  on:change={(e) => { savePaymentDate(line, e.target.value); }}>
                {#if ( line.paymentDate && line.issueDate && ( line.paymentDate !== line.issueDate ) )}
                <div class="text-muted" style="font-size:0.7rem;">発行 {String(line.issueDate).slice(5)}</div>
                {/if}
              </td>
              <td class="number">
                <input type="text" class="form-control form-control-sm number" autocomplete="off"
                  value={ line.amount != null ? numeric(line.amount).toLocaleString() : '' }
                  disabled={ !canEdit(line) }
                  on:change={(e) => { saveAmount(line, e.target.value); }}>
              </td>
              <td style="white-space:nowrap;">
                <button type="button" class="btn btn-sm p-0 px-1 me-1"
                  class:btn-success={ !line.settledAt }
                  class:btn-outline-secondary={ !!line.settledAt }
                  title={ line.settledAt ?
                    `OK済みを解除します（${line.settleUser ? line.settleUser.name : ''}）` :
                    'OK済みにします（AI認識・見直しの対象から外れます）' }
                  on:click={() => { toggleSettled(line); }}>
                  <i class="bi { line.settledAt ? 'bi-slash-circle' : 'bi-check2-circle' }"></i>
                </button>
                <button type="button" class="btn btn-sm btn-outline-secondary p-0 px-1 me-1"
                  title="左90°回転" on:click={() => { rotateVoucher(line, 270); }}>
                  <i class="bi bi-arrow-counterclockwise"></i>
                </button>
                <button type="button" class="btn btn-sm btn-outline-secondary p-0 px-1 me-1"
                  title="右90°回転" on:click={() => { rotateVoucher(line, 90); }}>
                  <i class="bi bi-arrow-clockwise"></i>
                </button>
                {#if ( !line.settledAt )}
                <button type="button" class="btn btn-sm btn-outline-info p-0 px-1 me-1"
                  title="AIで読み取ります（企業・金額・日付を証憑に保存します）"
                  disabled={ line._aiBusy }
                  on:click={() => { recognizeVoucher(line); }}>
                  {#if ( line._aiBusy )}
                  <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  {:else}
                  <i class="bi bi-stars"></i>
                  {/if}
                </button>
                <button type="button" class="btn btn-sm btn-outline-info p-0 px-1 me-1"
                  title="複数の証憑が写っている場合は分離、1枚の場合は背景を除いて切り出します"
                  disabled={ line._aiBusy }
                  on:click={() => { splitVoucher(line); }}>
                  <i class="bi bi-scissors"></i>
                </button>
                {/if}
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
      <p class="text-muted mb-1 px-1">アップロードした証憑は、経費精算書の明細行へドラッグ&ドロップして紐付けてください。</p>
    </div>
  </div>
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
import axios from 'axios';
import {numeric} from '../../../libs/utils';
import eventBus from '../../javascripts/event-bus.js';

export let status;
export let toast;

let unsorted = [];
// 証憑画像の差し替え後の再表示用（ブラウザキャッシュを無効化するバージョン）
let imageVersion = 0;
// 会社セレクト用マスタ
let companies = [];

// OK済み前だけ編集できる（自分の証憑 or 会計権限）
const canEdit = (line) => {
  return ( !line.settledAt ) &&
    ( status.user.accounting || ( line.createdBy === status.user.id ) );
};

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

// 会社・日付・金額の編集（OK済み前のみ。失敗時は再取得で元に戻す）
const saveCompany = async (voucher) => {
  try {
    await axios.put('/api/voucher', {
      id: voucher.id,
      companyId: voucher.companyId || null
    });
  } catch (e) {
    fetchUnsorted();
    toast.show('経費精算', errText(e), 'warning');
  }
};

const savePaymentDate = async (voucher, value) => {
  const prev = voucher.paymentDate;
  voucher.paymentDate = value || null;
  unsorted = [...unsorted];
  try {
    await axios.put('/api/voucher', {
      id: voucher.id,
      paymentDate: value || null
    });
  } catch (e) {
    voucher.paymentDate = prev;
    unsorted = [...unsorted];
    toast.show('経費精算', errText(e), 'warning');
  }
};

const saveAmount = async (voucher, value) => {
  const prev = voucher.amount;
  const next = ( value && value.replace(/[,\s]/g, '') ) || null;
  voucher.amount = next;
  unsorted = [...unsorted];
  try {
    await axios.put('/api/voucher', {
      id: voucher.id,
      amount: next
    });
  } catch (e) {
    voucher.amount = prev;
    unsorted = [...unsorted];
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
    'expense-split-voucher-unsorted');
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
  const allowed = await confirmModal('経費精算', 'この証憑を削除します。<br/>よろしいですか？', 'expense-delete-voucher-unsorted');
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

// OK済みのトグル。誰が・いつはサーバ側で記録される
const toggleSettled = async (voucher) => {
  try {
    await axios.put('/api/voucher', {
      id: voucher.id,
      settled: !voucher.settledAt
    });
    fetchUnsorted();
  } catch (e) {
    toast.show('経費精算', errText(e), 'warning');
  }
};

// 認識結果の保存。/ocr応答を証憑に反映する
// （taxは証憑側参考値のため保存しない。伝票は明細から計算する設計）
const applyOcrToVoucher = async (voucher, values) => {
  const body = { id: voucher.id };
  if ( values.description ) body.description = values.description;
  if ( values.amount != null ) body.amount = values.amount;
  if ( values.companyId != null ) body.companyId = values.companyId;
  const date = values.paymentDate || values.issueDate;
  if ( date ) {
    body.paymentDate = values.paymentDate || null;
    body.issueDate = date;
  }
  if ( values.invoiceNo ) body.invoiceNo = values.invoiceNo;
  await axios.put('/api/voucher', body);
};

// 個別認識: この証憑をAIで読み、結果を証憑に保存する（いつでも実行可）
const recognizeVoucher = async (line) => {
  if ( line._aiBusy ) return;
  line._aiBusy = true;
  line._aiSecs = 0;
  line._aiError = null;
  unsorted = [...unsorted];
  const startedAt = Date.now();
  const timer = setInterval(() => {
    line._aiSecs = Math.floor(( Date.now() - startedAt ) / 1000);
    unsorted = [...unsorted];
  }, 1000);
  try {
    const result = await axios.post('/api/expense_report/ocr', {voucherId: line.id},
      { timeout: 180000 });
    const values = result.data.values;
    await applyOcrToVoucher(line, values);
    const bits = [];
    if ( values.amount == null ) bits.push('金額が読めませんでした');
    const msg = ( values.description || values.company || `金額 ${values.amount ?? '-'}` ) +
      ( bits.length ? `（${bits.join('、')}。手入力で補ってください）` : '' );
    toast.show('AI認識', msg);
    fetchUnsorted();
  } catch (e) {
    line._aiError = ( e.response && e.response.data && e.response.data.message ) ?
      e.response.data.message : ( e.message || '認識に失敗しました。' );
    unsorted = [...unsorted];
  } finally {
    clearInterval(timer);
    line._aiBusy = false;
    line._aiSecs = 0;
  }
};

// 一括認識: 未認識の行を順次処理する（逐次。中断可）。
// スキップ: OK済み（settledAt）OR すでに会社と金額が揃っている行
let bulkBusy = false;
let bulkStop = false;
let bulkDone = 0;
let bulkTotal = 0;

const isDone = (line) => {
  return Boolean( line.settledAt || ( line.companyId != null && line.amount != null ) );
};

// テンプレート用の状態（unsortedの再代入に連動して更新される）
$: pending = unsorted.filter((line) => ( !isDone(line) ));
$: settledCount = unsorted.filter((line) => ( line.settledAt )).length;

const recognizeAll = async () => {
  const targets = unsorted.filter((line) => ( !isDone(line) ));
  if ( targets.length === 0 ) {
    return;
  }
  bulkBusy = true;
  bulkStop = false;
  bulkDone = 0;
  bulkTotal = targets.length;
  try {
    for ( const line of targets ) {
      if ( bulkStop ) {
        toast.show('AI認識', '中断しました。');
        break;
      }
      await recognizeVoucher(line);
      bulkDone += 1;
    }
  } finally {
    bulkBusy = false;
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
  axios.get('/api/company').then((result) => {
    companies = result.data.companies || [];
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
  max-height: 60vh;
  overflow: auto;
}
/* 行ピッチを揃える: セル中央揃え */
.pile-table th, .pile-table td {
  vertical-align: middle;
}
.pile-desc {
  /* 説明は残り幅いっぱい（theadの意図に従う。固定幅はファイル/金額/ボタン列） */
  min-width: 160px;
}
.pile-dropzone.over {
  background-color: #eef6ff;
  outline: 2px dashed #4d8fd1;
  outline-offset: -6px;
}
/* OK済みの行は少し薄くして「もう触らない」感を出す */
tr.done {
  opacity: 0.55;
}
</style>
