<div class="alert alert-{level} py-1 px-2 position-relative">
  {#if ( dismissible )}
  <button type="button" class="btn-close position-absolute top-0 end-0 m-1"
    style="font-size:0.7rem;" title="メッセージを閉じる"
    on:click={dismiss}></button>
  {/if}
  {#if ( title )}
  <div class="fw-bold" style="font-size:0.85rem;">{title}</div>
  {/if}
  {#each messages as message}
  <div style="font-size:0.85rem;">{message}</div>
  {/each}
</div>

<style>
</style>

<script>
import {createEventDispatcher} from 'svelte';

// メッセージリスト+閉じる(×)の汎用パネル。
// 「取込の警告」のように、レコードに紐付いたメッセージを一覧表示し、
// 閲覧が済んだものをユーザーが消せる画面部品。
// 表示はここで行うが、消した内容をどこに保存するかは各画面の判断
// （dismissイベントを受けてレコード側のメッセージを空にする等）。
// 使い方:
//   <MessagePanel messages={warnings} title="取込の警告"
//     on:dismiss={() => { /* レコードのメッセージを空にして保存 */ }} />
// 見た目: bootstrapのalert-*クラス(level)。
export let messages = [];
export let level = 'warning';
export let title = '';
export let dismissible = true;

const dispatch = createEventDispatcher();
const dismiss = () => {
  dispatch('dismiss');
};
</script>
