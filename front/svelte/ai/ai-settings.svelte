<div class="page-title d-flex justify-content-between">
  <h1>AI設定</h1>
  <span class="text-muted" style="font-size:0.8rem;">AI管理権限ユーザー向け。プロンプトの世代管理とAPI設定。</span>
</div>
<div class="d-flex align-items-start">
  <ul class="nav flex-column nav-pills me-3" style="min-width:200px;">
    {#each prompts as p}
    <li class="nav-item">
      <button type="button" class="btn btn-link nav-link text-start {selectedKey === p.key ? 'active' : ''}"
        on:click={() => { selectKey(p.key); }}>
        {p.title}
        {#if p.modified}
        <span class="badge text-bg-info ms-1" style="font-size:0.65rem;">改変</span>
        {/if}
      </button>
    </li>
    {/each}
    <li class="nav-item mt-3">
      <button type="button" class="btn btn-outline-primary btn-sm"
        on:click={() => { window.location.href = '/home'; }}>
        API設定（モデル・キー）
      </button>
    </li>
  </ul>
  <div class="flex-grow-1">
    {#if ( loading )}
    <div class="text-muted">読み込み中…</div>
    {:else if ( current )}
    <div class="mb-2 text-muted" style="font-size:0.8rem;">
      {current.title} — 現世代: { current.generation !== null ? `第${current.generation}世代` : 'ビルトイン（未改変）' }
    </div>
    <div class="d-flex mb-2" style="gap:8px;">
      <button type="button" class="btn btn-primary btn-sm" disabled={busy || body === current.body}
        on:click={save}>保存（新しい世代として）</button>
      <button type="button" class="btn btn-outline-secondary btn-sm" disabled={busy || current.generation === null}
        on:click={() => { body = current.builtin; }}>ビルトインの内容を呼び出す</button>
      <button type="button" class="btn btn-outline-danger btn-sm" disabled={busy || current.generation === null}
        on:click={resetToBuiltin}>ビルトインに戻す</button>
      {#if ( showBuiltin )}
      <button type="button" class="btn btn-outline-secondary btn-sm"
        on:click={() => { showBuiltin = false; }}>ビルトインを隠す</button>
      {:else}
      <button type="button" class="btn btn-outline-secondary btn-sm"
        on:click={() => { showBuiltin = true; }}>ビルトインと並べる</button>
      {/if}
    </div>
    <div class="d-flex" style="gap:8px;align-items:flex-start;">
      <textarea class="form-control font-monospace" rows="22" style="min-width:0;flex:1;"
        bind:value={body} spellcheck="false"></textarea>
      {#if ( showBuiltin )}
      <textarea class="form-control font-monospace" rows="22" style="min-width:0;flex:1;background:#f8f9fa;"
        readonly value={current.builtin} spellcheck="false"></textarea>
      {/if}
    </div>
    <div class="mt-2">
      <div class="fw-bold" style="font-size:0.85rem;">履歴</div>
      {#if ( current.versions && current.versions.length > 0 )}
      <table class="table table-sm table-bordered mb-1" style="font-size:0.8rem;">
        <thead class="table-light">
          <tr><th>世代</th><th>作成日時</th><th></th></tr>
        </thead>
        <tbody>
          {#each current.versions as v}
          <tr class:table-active={ current.generation === v.generation }>
            <td>第{v.generation}世代</td>
            <td>{formatDate(v.createdAt)}</td>
            <td>
              <button type="button" class="btn btn-sm btn-outline-secondary"
                disabled={busy || ( current.generation === v.generation )}
                title="この世代の本文を新しい世代として復元する"
                on:click={() => { rollback(v.generation); }}>ロールバック</button>
            </td>
          </tr>
          {/each}
        </tbody>
      </table>
      {:else}
      <div class="text-muted" style="font-size:0.8rem;">改変履歴はありません（ビルトインをそのまま使っています）</div>
      {/if}
    </div>
    {:else}
    <div class="text-muted">用途を選択してください</div>
    {/if}
</div>
</div>
<style>
  .nav-link.active {
    background-color: var(--bs-primary);
    color: white;
  }
</style>
<script>
import axios from 'axios';
import {onMount} from 'svelte';
import {formatDate} from '../../../libs/utils.js';

export let status;
export let toast;

let prompts = [];
let selectedKey = null;
let current = null;
let body = '';
let showBuiltin = false;
let loading = true;
let busy = false;

const selectKey = async (key) => {
  selectedKey = key;
  loading = true;
  current = null;
  showBuiltin = false;
  try {
    const result = await axios.get(`/api/prompts/${key}`);
    if ( result.data && result.data.code === 0 ) {
      current = result.data.prompt;
      current.versions = result.data.versions || [];
      body = current.body;
    } else {
      toast.show('AI設定', '読み込みに失敗しました', 'warning');
    }
  } catch (e) {
    toast.show('AI設定', ( e.response && e.response.data && e.response.data.message ) || '読み込みに失敗しました', 'warning');
  }
  loading = false;
};

const reloadList = async () => {
  const result = await axios.get('/api/prompts');
  prompts = ( result.data && result.data.prompts ) || [];
};

const save = async () => {
  busy = true;
  try {
    const result = await axios.put(`/api/prompts/${selectedKey}`, { body: body });
    if ( result.data && result.data.code === 0 ) {
      toast.show('AI設定', `保存しました（第${result.data.prompt.generation}世代）`);
      await selectKey(selectedKey);
      await reloadList();
    }
  } catch (e) {
    toast.show('AI設定', ( e.response && e.response.data && e.response.data.message ) || '保存に失敗しました', 'warning');
  }
  busy = false;
};

const rollback = async (generation) => {
  busy = true;
  try {
    const result = await axios.post(`/api/prompts/${selectedKey}/rollback`, { generation: generation });
    if ( result.data && result.data.code === 0 ) {
      toast.show('AI設定', `第${generation}世代を復元しました（第${result.data.prompt.generation}世代として保存）`);
      await selectKey(selectedKey);
      await reloadList();
    }
  } catch (e) {
    toast.show('AI設定', ( e.response && e.response.data && e.response.data.message ) || 'ロールバックに失敗しました', 'warning');
  }
  busy = false;
};

const resetToBuiltin = async () => {
  if ( !window.confirm('ビルトインの内容に戻しますか？（履歴は残ります）') ) {
    return;
  }
  busy = true;
  try {
    const result = await axios.post(`/api/prompts/${selectedKey}/reset`);
    if ( result.data && result.data.code === 0 ) {
      toast.show('AI設定', 'ビルトインの内容に戻しました');
      await selectKey(selectedKey);
      await reloadList();
    }
  } catch (e) {
    toast.show('AI設定', ( e.response && e.response.data && e.response.data.message ) || '復元に失敗しました', 'warning');
  }
  busy = false;
};

onMount(async () => {
  await reloadList();
  if ( prompts.length > 0 ) {
    await selectKey(prompts[0].key);
  }
  loading = false;
});
</script>
