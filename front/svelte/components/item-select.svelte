<input
  type="text"
  class="form-control"
  autocomplete="off"
  placeholder="検索キー"
  bind:value={inputValue}
  on:input={onUserInput}
  on:keydown={keyCheck}
/>

{#if ( items && items.length > 0 ) }
<select id="itemId" class="form-control"
  on:focusout={itemSelect}
  bind:value={itemId}>
  {#each items as item}
  <option value={item.id}>
    {item.name}
  </option>
  {/each}
</select>
{/if}

<script>
import axios from 'axios';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
const dispatch = createEventDispatcher();

export let itemId;
export let itemName;
export let itemSpec;
export let unitPrice;
export let unit;
export let product;

let itemKey;
let inputValue = '';
let isInitialInput = true;
let	items
let current_params = new Map();

const onUserInput = (event) => {
  isInitialInput = false;
  itemKey = inputValue; // ← bind:value により inputValue はすでに更新済み
  updateItems({ key: itemKey });
};

const keyCheck = (event) => {
  if ((event.ctrlKey && event.key === 'h') || event.key === 'Backspace') {
    if (isInitialInput) {
      event.preventDefault();
      clearInput();
    }
  }
};

const clearInput = () => {
  inputValue = '';
  itemKey = '';
  isInitialInput = false;
  updateItems({ key: '' });
};

const setParamsFromObject = (params) => {
  for (const key in params) {
    if (!params[key]) {
      current_params.delete(key);
    } else {
      current_params.set(key, params[key]);
    }
  }
};

const updateItems = (_params) => {
  current_params ||= new Map();
  if (_params) setParamsFromObject(_params);

  const query = Array.from(current_params.entries()).map(
    ([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`
  );

  if (product) query.push('product=true');

  const param = query.join('&');
  console.log('param', param);

  axios.get(`/api/item?${param}`).then((result) => {
    items = result.data.items;
    if (items.length > 0) {
      itemId ||= items[0].id;
    }
  });
};

const itemDecide = (id) => {
  const item = items?.find((i) => i.id === id);
  if (!item) return;

  itemId = item.id;
  itemName = item.name;
  itemSpec = item.spec;
  unitPrice = item.standardPrice;
  unit = item.unit;

  itemKey = itemName;
  inputValue = itemName;
};

const itemSelect = (event) => {
  itemId = parseInt(event.target.value);
  itemDecide(itemId);
  items = []; // 選択後は候補を閉じる
  dispatch('input', itemId);
};

// 初期値は一度だけ確定
let initialized = false;

beforeUpdate(() => {
  if (!initialized && itemName) {
    inputValue = itemName;
    itemKey = itemName;
    isInitialInput = true;
    initialized = true;
  }
});


onMount(() => {
  inputValue = itemName ?? '';
  isInitialInput = true;
});

</script>