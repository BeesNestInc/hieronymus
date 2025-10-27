<div class="container-fluid">
  <div class="page-title d-flex justify-content-between">
  	<h1>集計用ラベル管理</h1>
    <button type="button" class="btn btn-primary" on:click={openNewModal}>
      新規作成&nbsp;<i class="bi bi-pencil-square"></i>
    </button>
	</div>

  <div class="row">
    <!-- 左カラム: ラベル一覧 -->
    <div class="col-md-6">
      <table class="table table-hover">
        <thead class="table-light">
          <tr>
            <th>名前</th>
            <th>説明</th>
            <th>関連プロジェクト数</th>
            <th>関連勘定科目数</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each labels as label}
            <tr on:click={() => selectLabel(label)} class:table-primary={$selectedLabel && $selectedLabel.id === label.id}>
              <td>{label.name}</td>
              <td>{label.description}</td>
              <td class="number">{label.projects.length}</td>
              <td class="number">{label.accounts.length}</td>
              <td>
                <button type="button" class="btn btn-sm btn-secondary" on:click|stopPropagation={() => openEditModal(label)}>編集</button>
                <button type="button" class="btn btn-sm btn-danger" on:click|stopPropagation={() => deleteLabel(label)}>削除</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- 右カラム: 勘定科目一覧 -->
    <div class="col-md-6">
      {#if $selectedLabel}
        <h4>「{$selectedLabel.name}」の勘定科目</h4>

        <!-- 選択済み科目リスト -->
        <h5>選択済み ({selectedAccounts.length}件)</h5>
        <div class="selected-list border p-2 mb-3" style="height: 150px; overflow-y: auto;">
          {#each selectedAccounts as account}
            {#if account}
              <div>{account.code} - {account.name} ({account.summaryType === 'debit' ? '借方' : '貸方'}集計)</div>
            {/if}
          {:else}
            <p class="text-muted">勘定科目が選択されていません。</p>
          {/each}
        </div>

        <!-- 全科目チェックボックスリスト -->
        <h5>全科目から選択</h5>
        <div class="account-list border p-3" style="height: 250px; overflow-y: auto;">
          {#each displayableAccounts as item}
            {#if item.type === 'major'}
              <h5 class="mt-3 fw-bold">{item.name}</h5>
            {:else if item.type === 'middle'}
              <h6 class="ms-2 mt-2 text-muted">{item.name}</h6>
            {:else if item.type === 'account'}
              {@const account = item.data}
              {@const isSelected = selectedLabelAccounts.some(sa => sa.code === account.code)}
              {@const summaryType = getSummaryTypeForAccount(account.code)}
              <div class="form-check ms-3">
                <input class="form-check-input" type="checkbox" id={`account-${account.code}`} 
                  checked={isSelected} 
                  on:change={() => toggleAccountSelection(account.code)}>
                <label class="form-check-label" for={`account-${account.code}`}>
                  {account.code} - {account.name}
                </label>
                {#if isSelected}
                  <div class="ms-4">
                    <div class="form-check form-check-inline">
                      <input class="form-check-input" type="radio" name={`summaryType-${account.code}`} id={`debit-${account.code}`} 
                        value="debit" 
                        checked={summaryType === 'debit'} 
                        on:change={() => setSummaryType(account.code, 'debit')}>
                      <label class="form-check-label" for={`debit-${account.code}`}>借方</label>
                    </div>
                    <div class="form-check form-check-inline">
                      <input class="form-check-input" type="radio" name={`summaryType-${account.code}`} id={`credit-${account.code}`} 
                        value="credit" 
                        checked={summaryType === 'credit'} 
                        on:change={() => setSummaryType(account.code, 'credit')}>
                      <label class="form-check-label" for={`credit-${account.code}`}>貸方</label>
                    </div>
                  </div>
                {/if}
              </div>
            {/if}
          {/each}
        </div>

        <div class="mt-3 text-end">
          <button class="btn btn-primary" on:click={saveLabelAccounts}>勘定科目を保存</button>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- 作成/編集モーダル -->
<div class="modal fade" id="labelModal" tabindex="-1" aria-labelledby="labelModalLabel" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="labelModalLabel">{editingLabel ? (editingLabel.id ? '集計用ラベル編集' : '集計用ラベル作成') : ''}</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      {#if editingLabel}
      <div class="modal-body">
        <div class="mb-3">
          <label for="labelName" class="form-label">名前</label>
          <input type="text" class="form-control" id="labelName" bind:value={editingLabel.name}>
        </div>
        <div class="mb-3">
          <label for="labelDescription" class="form-label">説明</label>
          <textarea class="form-control" id="labelDescription" rows="3" bind:value={editingLabel.description}></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">キャンセル</button>
        <button type="button" class="btn btn-primary" on:click={saveLabel}>保存</button>
      </div>
      {/if}
    </div>
  </div>
</div>

<!-- 削除確認モーダル -->
<OkModal
  bind:this={deleteModal}
  title={deleteModalTitle}
  description={deleteModalDescription}
  on:answer={doDelete}
></OkModal>

<style>
  /* 選択された行のスタイルを上書き */
  :global(tr.table-primary) {
    --bs-table-accent-bg: var(--bs-primary-rgb, #cfe2ff) !important;
    color: var(--bs-table-color) !important;
  }
</style>

<script>
  import axios from 'axios';
  import { onMount, tick } from 'svelte';
  import { writable } from 'svelte/store';
  import Modal from 'bootstrap/js/dist/modal';
  import OkModal from '../common/ok-modal.svelte';
  import { dc } from '../../../libs/parse_account_code.js';

  export let status;

  let labels = [];
  let labelModal;
  let editingLabel = null;

  let allAccounts = [];
  let displayableAccounts = [];
  const selectedLabel = writable(null);
  // codeとsummaryTypeを持つオブジェクトの配列に変更
  let selectedLabelAccounts = []; 
  let selectedAccounts = [];

  let deleteModal;
  let deleteModalTitle;
  let deleteModalDescription;
  let targetLabel = null;

  // --- リアクティブ宣言 ---
  $: {
    if (allAccounts && allAccounts.length > 0) {
      let currentMajor = '';
      let currentMiddle = '';
      const newDisplayable = [];
      for (const account of allAccounts) {
        if (account.major_name && account.major_name !== currentMajor) {
          newDisplayable.push({ type: 'major', name: account.major_name });
          currentMajor = account.major_name;
          currentMiddle = '';
        }
        if (account.middle_name && account.middle_name !== currentMiddle) {
          newDisplayable.push({ type: 'middle', name: account.middle_name });
          currentMiddle = account.middle_name;
        }
        if (account.name) {
          newDisplayable.push({ type: 'account', data: account });
        }
      }
      displayableAccounts = newDisplayable;
    } else {
      displayableAccounts = [];
    }
  }

  $: {
    if (allAccounts.length > 0 && selectedLabelAccounts) {
      const codeToAccountMap = new Map();
      allAccounts.forEach(acc => {
        if(acc.name) codeToAccountMap.set(acc.code, acc);
      });
      selectedAccounts = selectedLabelAccounts.map(sla => ({
        ...codeToAccountMap.get(sla.code),
        summaryType: sla.summaryType
      })).filter(acc => acc && acc.code);
    } else {
      selectedAccounts = [];
    }
  }

  // --- 関数 ---
  const fetchLabels = async () => {
    try {
      const response = await axios.get('/api/labels');
      labels = response.data;
      if ($selectedLabel) {
        const updatedLabel = labels.find(l => l.id === $selectedLabel.id) || null;
        selectedLabel.set(updatedLabel);
        // selectedLabelが更新されたら、それに応じてselectedLabelAccountsも更新
        if (updatedLabel && updatedLabel.accounts) {
          selectedLabelAccounts = updatedLabel.accounts.map(acc => ({
            code: acc.accountCode,
            summaryType: acc.LabelAccounts.summaryType
          }));
        } else {
          selectedLabelAccounts = [];
        }
      }
    } catch (err) {
      console.error("ラベルの取得に失敗しました:", err);
    }
  };

  const selectLabel = (label) => {
    selectedLabel.set(label);
    if (label && label.accounts) {
      // APIから返される関連アカウント情報(LabelAccountsモデルを含む)から初期状態を設定
      selectedLabelAccounts = label.accounts.map(acc => ({ 
        code: acc.accountCode, 
        summaryType: acc.LabelAccounts.summaryType 
      }));
    } else {
      selectedLabelAccounts = [];
    }
  };

  const toggleAccountSelection = (accountCode) => {
    const index = selectedLabelAccounts.findIndex(sa => sa.code === accountCode);
    if (index > -1) {
      selectedLabelAccounts.splice(index, 1);
    } else {
      const account = allAccounts.find(a => a.code === accountCode);
      const defaultSummaryType = dc(accountCode) === 'D' ? 'debit' : 'credit';
      selectedLabelAccounts.push({ code: accountCode, summaryType: defaultSummaryType });
    }
    selectedLabelAccounts = selectedLabelAccounts; // リアクティビティをトリガー
  };

  const setSummaryType = (accountCode, type) => {
    const account = selectedLabelAccounts.find(sa => sa.code === accountCode);
    if (account) {
      account.summaryType = type;
      selectedLabelAccounts = selectedLabelAccounts; // リアクティビティをトリガー
    }
  };

  const getSummaryTypeForAccount = (accountCode) => {
    const account = selectedLabelAccounts.find(sa => sa.code === accountCode);
    return account ? account.summaryType : null;
  };

  const saveLabelAccounts = async () => {
    if (!$selectedLabel) return;
    try {
      // APIに送信するデータ形式をオブジェクトの配列に変更
      await axios.put(`/api/labels/${$selectedLabel.id}/accounts`, {
        accounts: selectedLabelAccounts
      });
      await fetchLabels();
      alert('勘定科目の紐付けを保存しました。');
    } catch (err) {
      console.error("勘定科目の紐付け保存に失敗しました:", err);
      alert('エラー: 勘定科目の紐付け保存に失敗しました。');
    }
  };

  const openNewModal = () => {
    editingLabel = { id: null, name: '', description: '' };
    if (labelModal) {
      labelModal.show();
    }
  };

  const openEditModal = (label) => {
    editingLabel = { ...label }; // オブジェクトをコピー
    if (labelModal) {
      labelModal.show();
    }
  };

  const saveLabel = async () => {
    if (!editingLabel || !editingLabel.name) {
      alert('名前は必須です。');
      return;
    }
    try {
      if (editingLabel.id) {
        await axios.put(`/api/labels/${editingLabel.id}`, editingLabel);
      } else {
        await axios.post('/api/labels', editingLabel);
      }
      labelModal.hide();
      editingLabel = null;
      await fetchLabels();
    } catch (err) {
      console.error("ラベルの保存に失敗しました:", err);
      alert('エラー: 保存に失敗しました。');
    }
  };

  const deleteLabel = (label) => {
    targetLabel = label;
    deleteModalTitle = `「${label.name}」の削除`;
    deleteModalDescription = `このラベルを削除してもよろしいですか？関連するプロジェクトの集計設定からも解除されます。`;
    deleteModal.show();
  };

  const doDelete = async (event) => {
    if (event.detail && targetLabel) {
      try {
        await axios.delete(`/api/labels/${targetLabel.id}`);
        await fetchLabels();
        targetLabel = null;
        selectedLabel.set(null); // 削除されたラベルの選択を解除
        selectedLabelAccounts = [];
      } catch (err) {
        console.error("ラベルの削除に失敗しました:", err);
        alert('エラー: 削除に失敗しました。');
      }
    }
  };

  onMount(async () => {
    const modalElement = document.getElementById('labelModal');
    if (modalElement) {
      labelModal = new Modal(modalElement);
      modalElement.addEventListener('hidden.bs.modal', () => {
        editingLabel = null;
      });
    }

    await fetchLabels();
    try {
      const term = (status && status.fy) ? status.fy.term : 0;
      const response = await axios.get(`/api/accounts4/${term}`);
      allAccounts = response.data;
    } catch (err) {
      console.error("全勘定科目の取得に失敗しました:", err);
    }
  });

</script>