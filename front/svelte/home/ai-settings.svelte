<script>
  import { onMount } from 'svelte';
  import axios from 'axios';

  export let toast;
  export let title = 'AI設定';
  export let minimize = true;

  const providers = [
    { value: 'gemini', label: 'Gemini' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'openai-compatible', label: 'OpenAI互換' },
    { value: 'opencode_openai', label: 'opencode.ai ゲートウェイ' },
    { value: 'local', label: 'ローカルLLM' }
  ];
  const acceptsKinds = [
    { value: 'text', label: 'テキスト' },
    { value: 'image', label: '画像' },
    { value: 'pdf', label: 'PDF' }
  ];

  let candidate = {};
  let apiKeyMasked = '';
  let available;
  let envOverrides = [];
  let warnings = [];
  let apiKeyInput = '';

  const isOpenAIFamily = () => (
    ( candidate.provider === 'openai' ) ||
    ( candidate.provider === 'openai-compatible' ) ||
    ( candidate.provider === 'opencode_openai' ) ||
    ( candidate.provider === 'local' )
  );

  const load = async () => {
    try {
      const res = await axios.get('/api/admin/llms');
      candidate = res.data.candidate || {};
      apiKeyMasked = candidate.apiKeyMasked || '';
      available = res.data.available;
      envOverrides = res.data.envOverrides || [];
      warnings = res.data.warnings || [];
      apiKeyInput = '';
    } catch (error) {
      console.error(error);
      toast.show(title, '読み込みに失敗しました。');
    }
  };

  onMount(load);

  const handleSave = async () => {
    const body = {
      description: candidate.description || '',
      provider: candidate.provider,
      model: candidate.model,
      apiKey: apiKeyInput,
      baseURL: candidate.baseURL || '',
      accepts: candidate.accepts || [],
      structuredOutput: candidate.structuredOutput !== false
    };
    try {
      const res = await axios.put('/api/admin/llms', body);
      warnings = res.data.warnings || [];
      toast.show(title, '設定を保存しました。');
      await load();
    } catch (error) {
      console.error(error);
      const message = ( error.response && error.response.data && error.response.data.message ) ?
        error.response.data.message : '設定の保存に失敗しました。';
      toast.show(title, message);
    }
  };
</script>

<div class="card">
  <div class="card-header d-flex">
    <h5 class="card-title">
      {title}
      {#if available === false}
      <span class="badge bg-warning text-dark">未設定</span>
      {:else}
      <span class="badge bg-success">有効</span>
      {/if}
    </h5>
    <div class="d-flex ms-auto">
      <button type="button" class="btn"
        on:click={() => {
          minimize = !minimize;
        }}>
        {#if minimize}
        <i class="bi bi-square"></i>
        {:else}
        <i class="bi bi-dash-square"></i>
        {/if}
      </button>
    </div>
  </div>
  {#if !minimize}
  <div class="card-body">
    {#if envOverrides.length > 0}
    <div class="alert alert-warning py-2">
      環境変数（{envOverrides.join(', ')}）が設定されているため、解決済みの候補は環境変数が優先されます。
    </div>
    {/if}
    {#each warnings as warning}
    <div class="alert alert-warning py-2">{warning}</div>
    {/each}
    <div class="mb-2">
      <label class="form-label" for="aiDescription">説明</label>
      <input class="form-control" id="aiDescription" type="text"
        bind:value={candidate.description}>
    </div>
    <div class="mb-2">
      <label class="form-label" for="aiProvider">プロバイダ</label>
      <select class="form-select" id="aiProvider" bind:value={candidate.provider}>
        {#each providers as p}
        <option value={p.value}>{p.label}</option>
        {/each}
      </select>
    </div>
    <div class="mb-2">
      <label class="form-label" for="aiModel">モデル名</label>
      <input class="form-control" id="aiModel" type="text"
        bind:value={candidate.model}>
    </div>
    <div class="mb-2">
      <label class="form-label" for="aiApiKey">APIキー</label>
      <input class="form-control" id="aiApiKey" type="password" autocomplete="off"
        placeholder={apiKeyMasked ? `${apiKeyMasked}（変更する場合のみ入力）` : ''}
        bind:value={apiKeyInput}>
    </div>
    {#if isOpenAIFamily()}
    <div class="mb-2">
      <label class="form-label" for="aiBaseURL">接続先（baseURL）</label>
      <input class="form-control" id="aiBaseURL" type="text"
        bind:value={candidate.baseURL}>
    </div>
    {/if}
    <div class="mb-2">
      <span class="form-label d-block">受容する添付</span>
      {#each acceptsKinds as a}
      <div class="form-check form-check-inline">
        <input class="form-check-input" type="checkbox" id="aiAccepts{a.value}"
          value={a.value} bind:group={candidate.accepts}>
        <label class="form-check-label" for="aiAccepts{a.value}">{a.label}</label>
      </div>
      {/each}
    </div>
    <div class="mb-2 form-check form-switch">
      <input class="form-check-input" type="checkbox" role="switch"
        id="aiStructuredOutput" bind:checked={candidate.structuredOutput}>
      <label class="form-check-label" for="aiStructuredOutput">構造化出力（generateObject）を使用する</label>
    </div>
    <button type="button" class="btn btn-primary" on:click={handleSave}>保存</button>
  </div>
  {/if}
</div>
