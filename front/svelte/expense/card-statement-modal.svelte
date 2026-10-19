<div class="modal-backdrop" onclick={() => { dispatch('close'); }}>
  <div class="modal-dialog modal-lg" onclick={(e) => { e.stopPropagation(); }}>
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">個人カード明細から精算</h5>
        <button type="button" class="btn-close" onclick={() => { dispatch('close'); }}></button>
      </div>
      <div class="modal-body">
        <div class="row mb-2">
          <label class="col-3 col-form-label">取り込み済み明細</label>
          <div class="col-7">
            <select class="form-select" bind:value={statementId} on:change={loadLines}>
              <option value={null}>-- 新しく取り込む --</option>
              {#each statements as st}
              <option value={st.id}>{st.fileName}（{st.periodFrom}〜）</option>
              {/each}
            </select>
          </div>
        </div>
        {#if ( !statementId )}
        <div class="row mb-2">
          <label class="col-3 col-form-label">明細ファイル</label>
          <div class="col-7">
            <input type="file" class="form-control" accept=".xlsx,.csv,image/*,application/pdf"
              on:change={(e) => { file = e.target.files[0]; }}>
          </div>
          <div class="col-2">
            <button type="button" class="btn btn-outline-primary w-100" disabled={!file || busy}
              on:click={uploadStatement}>
              {#if ( busy )}<span class="spinner-border spinner-border-sm"></span>{:else}取込{/if}
            </button>
          </div>
        </div>
        {/if}
        {#if ( uploadError )}
        <div class="alert alert-danger py-1 px-2">{uploadError}</div>
        {/if}
        {#if ( lines.length > 0 )}
        <div class="table-responsive" style="max-height:320px;overflow-y:auto;">
          <table class="table table-striped table-bordered mb-0">
            <thead class="table-light">
              <tr>
                <th style="width:30px;"></th>
                <th style="width:110px;">利用日</th>
                <th>利用店名</th>
                <th class="number" style="width:110px;">金額</th>
                <th style="width:220px;">支払先</th>
              </tr>
            </thead>
            <tbody>
              {#each lines as line}
              <tr>
                <td>
                  <input type="checkbox" class="form-check-input" bind:checked={line._selected}
                    disabled={line.status === 'selected'}>
                </td>
                <td>{line.date || ''}</td>
                <td>
                  {line.description || line.rawDescription || ''}
                  {#if ( line.status === 'selected' )}
                  <span class="badge bg-info ms-1">追加済み</span>
                  {/if}
                </td>
                <td class="number">{line.amount != null ? Number(line.amount).toLocaleString() : ''}</td>
                <td>
                  {#key payeeMappings.length}
                  <select class="form-select form-select-sm" bind:value={line._payeeMappingId}
                    disabled={!line._selected}>
                    <option value={null}></option>
                    {#each payeeMappings as mapping}
                    <option value={mapping.id}>{mappingLabel(mapping)}</option>
                    {/each}
                  </select>
                  {/key}
                </td>
              </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <div class="text-muted mt-1" style="font-size:0.8rem;">
          精算対象の行にチェックを付けて「追加」してください。メモ欄の記載がある行は既定でチェックされています。
        </div>
        {/if}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline-secondary" onclick={() => { dispatch('close'); }}>閉じる</button>
        <button type="button" class="btn btn-primary" disabled={busy || selected.length === 0}
          on:click={addLines}>
          選択した{selected.length}行を精算書に追加
        </button>
      </div>
    </div>
  </div>
</div>

<style>
</style>

<script>
import axios from 'axios';
import {onMount} from 'svelte';
import {createEventDispatcher} from 'svelte';

export let report;
export let mappings = [];
export let toast = null;

const dispatch = createEventDispatcher();

let statements = [];
let statementId = null;
let lines = [];
let file = null;
let uploadError = '';
let busy = false;

const mappingLabel = (mapping) => {
  return ( mapping && mapping.description ) ? `${mapping.name}（${mapping.description}）` : ( mapping ? mapping.name : '' );
};

// メモ欄に何か書かれている行は精算対象の指定（メモ）とみなして既定チェックする
const hasMemo = (line) => {
  return Boolean(line.memo && line.memo !== '-');
};

$: selected = lines.filter((line) => ( line._selected && line.status !== 'selected' ));

const loadStatements = async () => {
  const result = await axios.get('/api/bank_statement');
  statements = ( ( result.data && result.data.values ) || [] )
    .filter((st) => ( st.kind === 'personal_card' ));
};

const loadLines = async () => {
  lines = [];
  if ( !statementId ) return;
  const result = await axios.get(`/api/bank_statement/${statementId}`);
  const statement = ( result.data && result.data.statement ) || null;
  if ( statement ) {
    lines = statement.lines.map((line) => ({
      ...line,
      _selected: hasMemo(line) && line.status !== 'selected'
    }));
  }
};

const uploadStatement = async () => {
  busy = true;
  uploadError = '';
  try {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', 'personal_card');
    const result = await axios.post('/api/bank_statement/upload', fd,
      { 'content-type': 'multipart/form-data' });
    if ( result.data && result.data.code === 0 ) {
      statementId = result.data.id;
      await loadStatements();
      await loadLines();
    } else {
      uploadError = result.data.message || '取り込みに失敗しました。';
    }
  } catch (e) {
    uploadError = ( e.response && e.response.data && e.response.data.message ) || '取り込みに失敗しました。';
  }
  busy = false;
};

const addLines = async () => {
  busy = true;
  try {
    const result = await axios.post(`/api/bank_statement/${statementId}/select`, {
      expenseReportId: report.id,
      selections: selected.map((line) => ({
        lineId: line.id,
        payeeMappingId: line._payeeMappingId || null
      }))
    });
    if ( result.data && result.data.code === 0 ) {
      toast.show('経費精算', `${result.data.created.length}行を精算書に追加しました`);
      dispatch('added');
      await loadLines();
    } else {
      uploadError = '追加に失敗しました。';
    }
  } catch (e) {
    uploadError = ( e.response && e.response.data && e.response.data.message ) || '追加に失敗しました。';
  }
  busy = false;
};

onMount(() => {
  loadStatements();
});
</script>
