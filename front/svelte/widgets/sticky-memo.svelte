<div class="menu">
  <div class="body">
    {#if ( memos.length === 0 )}
    <div class="text-muted small p-1">付箋メモはありません。下の欄から追加できます。</div>
    {/if}
    <div class="memo-list">
      {#each memos as memo (memo.stickyId)}
      <div class="memo-card">
        <div class="memo-text">{memo.message}</div>
        <div class="memo-foot">
          <span class="text-muted">{formatDate(memo.createdAt)}</span>
          <button type="button" class="btn btn-sm btn-link text-danger p-0"
            title="このメモを削除します"
            on:click={() => { remove(memo); }}>削除</button>
        </div>
      </div>
      {/each}
    </div>
    <div class="d-flex mt-1">
      <input type="text" class="form-control form-control-sm"
        placeholder="付箋メモを追加" bind:value={draft}
        on:keydown={(e) => { if ( e.key === 'Enter' && draft.trim() ) add(); }}>
      <button type="button" class="btn btn-sm btn-primary ms-1" style="white-space: nowrap;"
        disabled={!draft.trim()}
        on:click={() => { add(); }}>追加</button>
    </div>
  </div>
</div>

<style>
/* コンテナに左右のマージンを取る（テーブル切れ防止。他ウィジェットと同じ） */
.body {
  padding: 4px 10px 6px;
}
.body :global(.row) {
  margin-left: 0;
  margin-right: 0;
}
.memo-list {
  max-height: 100%;
  overflow-y: auto;
}
.memo-card {
  background: #fff8c4;
  border: 1px solid #e6df8f;
  border-radius: 4px;
  padding: 4px 8px;
  margin-bottom: 6px;
}
.memo-text {
  white-space: pre-wrap;
  font-size: 0.85rem;
}
.memo-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.7rem;
}
</style>

<script>
import axios from 'axios';
import {onMount} from 'svelte';
import {formatDate} from '../../../libs/utils.js';
import eventBus from '../../javascripts/event-bus.js';

export let status;
export let toast;

let memos = [];
let draft = '';

// 自分宛のメモ（kind: memo）だけを表示する。
// 中身はStickyそのものなので、ベルの「メモ」タブと同じものが見える
const load = async () => {
  try {
    const result = await axios.get('/api/sticky');
    memos = result.data.stickies.filter((s) =>
      s.kind === 'memo' && s.statusId);
  } catch (e) {
    console.error('sticky memo load failed', e);
  }
};

const add = async () => {
  await axios.post('/api/sticky', {
    message: draft,
    kind: 'memo'
  });
  draft = '';
  await load();
  // ベルの未読バッジを即時更新させる
  eventBus.emit('stickyUpdated');
};

const remove = async (memo) => {
  if ( !confirm('このメモを削除しますか？') ) {
    return;
  }
  await axios.delete(`/api/sticky/status/${memo.statusId}`);
  await load();
  eventBus.emit('stickyUpdated');
};

onMount(() => {
  load();
})
</script>
