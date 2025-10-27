<div class="container-fluid">
  <div class="page-title d-flex justify-content-between">
    <h1>プロジェクトの集計設定</h1>
    <div>
      <button type="button" class="btn btn-secondary me-2" on:click={() => window.history.back()}>もどる</button>
      <button type="button" class="btn btn-primary" on:click={save}>保存</button>
    </div>
  </div>
  <p>下の一覧からこのプロジェクトで使うラベルを選択し、上の「このプロジェクトのラベル」欄でドラッグ＆ドロップして表示順を並べ替えてください。</p>

  <div class="row mt-3">
    <div class="col-12">
      <!-- 上段: 紐付けられたラベル（並べ替え可能） -->
      <h5>このプロジェクトの集計用ラベル（ドラッグ＆ドロップで並べ替え）</h5>
      <div class="list-group mb-4" bind:this={projectListElement}>
        {#key projectLabels}
          {#each projectLabels as label (label.id)}
            <div class="list-group-item d-flex justify-content-between align-items-center">
              <span>
                <i class="fas fa-grip-lines me-2" style="cursor: grab;"></i>
                {label.name}
              </span>
              <button class="btn btn-sm btn-outline-danger" on:click={() => uncheckLabel(label.id)}>削除</button>
            </div>
          {:else}
            <div class="list-group-item text-muted">下の一覧からラベルを選択してください。</div>
          {/each}
        {/key}
      </div>

      <!-- 下段: 利用可能な全ラベル（チェックボックス付き） -->
      <h5>利用可能なすべての集計用ラベル</h5>
      <div class="account-list border p-3" style="height: 300px; overflow-y: auto;">
        {#each allLabels as label (label.id)}
          <div class="form-check">
            <input class="form-check-input" type="checkbox" value={label.id} id={`label-check-${label.id}`} bind:group={selectedLabelIds}>
            <label class="form-check-label" for={`label-check-${label.id}`}>
              {label.name}
            </label>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

<script>
  import axios from 'axios';
  import { onMount, tick } from 'svelte';
  import Sortable from 'sortablejs';

  export let status;

  let allLabels = [];
  let projectLabels = [];
  let selectedLabelIds = [];

  let projectListElement;
  let sortableInstance;

  // selectedLabelIds (チェック状態) が変更されたら、projectLabels (上段リスト) を更新する
  $: {
    if (allLabels.length > 0) {
      const idToLabelMap = new Map(allLabels.map(l => [l.id, l]));
      const newProjectLabels = [];
      
      // 既存の順序を維持しつつ、チェック状態を反映
      projectLabels.forEach(label => {
        if (selectedLabelIds.includes(label.id)) {
          newProjectLabels.push(label);
        }
      });

      // 新しくチェックされた項目を追加
      selectedLabelIds.forEach(id => {
        if (!newProjectLabels.some(l => l.id === id)) {
          const labelToAdd = idToLabelMap.get(id);
          if (labelToAdd) {
            newProjectLabels.push(labelToAdd);
          }
        }
      });
      
      projectLabels = newProjectLabels;
    }
  }

  const save = async () => {
    const labelsToSave = projectLabels.map((label, index) => ({
      labelId: label.id,
      displayOrder: index
    }));

    try {
      await axios.put(`/api/projects/${status.id}/labels`, { labels: labelsToSave });
      alert('保存しました。');
    } catch (err) {
      console.error("ラベルの保存に失敗しました:", err);
      alert('エラー: 保存に失敗しました。');
    }
  };

  // 上段リストの「削除」ボタン用
  const uncheckLabel = (labelId) => {
    selectedLabelIds = selectedLabelIds.filter(id => id !== labelId);
  };

  onMount(async () => {
    const projectId = status.id;
    if (!projectId) return;

    try {
      const [allLabelsRes, projectLabelsRes] = await Promise.all([
        axios.get('/api/labels'),
        axios.get(`/api/projects/${projectId}/labels`)
      ]);

      allLabels = allLabelsRes.data;
      projectLabels = projectLabelsRes.data;
      
      // 初期チェック状態を設定
      selectedLabelIds = projectLabels.map(l => l.id);

      // SortableJSの初期化
      await tick(); // DOMの更新を待つ
      sortableInstance = new Sortable(projectListElement, {
        handle: '.fa-grip-lines',
        animation: 150,
        onEnd: (evt) => {
          const { oldIndex, newIndex } = evt;
          if (oldIndex !== newIndex) {
            const newOrder = [...projectLabels];
            const [movedItem] = newOrder.splice(oldIndex, 1);
            newOrder.splice(newIndex, 0, movedItem);
            projectLabels = newOrder;
          }
        }
      });

    } catch (err) {
      console.error("データの取得に失敗しました:", err);
    }
  });
</script>