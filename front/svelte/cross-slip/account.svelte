<div class="search-container">
  <input type="text" size="12" maxlength="13" autocomplete="off"
    placeholder=""
    class="search-input"
    bind:value={inputAccount}
    on:input={onAccountInput}
    on:keydown={keyCheck}
    on:focusout={inputDecide}>
    {#if ( list.length > 0 ) }
    <!-- ネイティブselectはキーボード移動だけで値が変わって「勝手に確定」に
         見えるので、クリック/Enterで決める候補リストにする -->
    <ul class="candidate-list" role="listbox">
      {#each list as item, i (item.code)}
      {#if ( item.code !== '' ) }
      <li class:active={ i === highlight }
        role="option" aria-selected={ i === highlight }
        on:mouseenter={() => { highlight = i; }}
        on:mousedown|preventDefault={() => { accountDecide(item.code); }}>{item.name}</li>
      {/if}
      {/each}
    </ul>
    {/if}
  <input type="text" size="12" maxlength="13" autocomplete="off"
    placeholder=""
    class="search-input"
    bind:value={inputSubAccount}
    on:input={onSubAccountInput}
    on:keydown={subCheck}>
    {#if ( currentAccount && currentAccount.subAccounts )}
    {#if ( sub_list.length > 0 ) }
    <ul class="candidate-list" role="listbox">
      {#each sub_list as item, i (item.code)}
      <li class:active={ i === sub_highlight }
        role="option" aria-selected={ i === sub_highlight }
        on:mouseenter={() => { sub_highlight = i; }}
        on:mousedown|preventDefault={() => { subAccountDecide(item.code); }}>{item.name}</li>
      {/each}
    </ul>
    {/if}
  {/if}
</div>

<style>
.search-container {
  position: relative;
  display: flex;
  flex-direction: column;
}

.search-input {
  margin-bottom: 0px;
}
/* 科目候補のドロップダウン。入力欄の下に重ねて出す（レイアウトを動かさない） */
.candidate-list {
  position: absolute;
  z-index: 1070;
  margin: 0;
  padding: 0.15rem 0;
  list-style: none;
  background: #fff;
  border: 1px solid #ced4da;
  border-radius: 0.25rem;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
  min-width: 12rem;
  max-height: 14rem;
  overflow-y: auto;
  font-size: 0.8rem;
}
.candidate-list li {
  padding: 0.15rem 0.5rem;
  cursor: pointer;
  white-space: nowrap;
}
.candidate-list li:hover,
.candidate-list li.active {
  background: rgba(13, 110, 253, 0.12);
}
</style>
<script>
import {findAccount, findSubAccount} from '../../javascripts/cross-slip';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';

export	let	code;
export	let	sub_code;
export	let	accounts;

let account;
// 入力中のcodeから解決する現在の科目（科目候補の確定前に補助欄を打つ操作向け）
$: currentAccount = account || findAccount(code);
let accountKey;
let inputAccount = '';
let isInitialInput = true;
let list = [];

let sub_account;
let subAccountKey;
let inputSubAccount = '';
let isInitialSubInput = true;
let sub_list = [];

const onAccountInput = (event) => {
  isInitialInput = false;
  accountKey = inputAccount;
  list = searchAccountByKey(accountKey);
  highlight = 0;
  if  ( !accountKey ) {
    // キー未入力時は「入力しない」を選択できるよう空を先頭にする
    code = '';
    account = undefined;
    clearSubInput();
  } else if  ( list.length > 0 ) {
    code = list[0].code;
  }
}
// 候補リストのハイライト（クリックはmousedownで確定。Enterは
// ハイライト位置で確定。ネイティブselectと違い、キーボード移動では
// 値を変えない）
let highlight = 0;
let sub_highlight = 0;
const keyCheck = (event) => {
  if ( list.length > 0 && [ 'ArrowDown', 'ArrowUp' ].includes(event.key) ) {
    event.preventDefault();
    highlight = ( highlight + ( event.key === 'ArrowDown' ? 1 : -1 ) + list.length ) % list.length;
    return;
  }
  if ( event.key === 'Enter' && list.length > 0 ) {
    event.preventDefault();
    const item = list[ highlight ];
    if ( item && item.code !== '' ) {
      accountDecide(item.code);
    }
    return;
  }
  if ( event.key === 'Escape' && list.length > 0 ) {
    list = [];
    highlight = 0;
    return;
  }
  if ((event.ctrlKey && event.key === 'h') || event.key === 'Backspace') {
    if  (isInitialInput)  {
      event.preventDefault();
      clearInput();
    }
  }
}
const clearInput = () => {
  inputAccount = '';
  accountKey = '';
  code = '';
  account = undefined;
  isInitialInput = false;
  list = searchAccountByKey(accountKey);
  clearSubInput();
}
const accountDecide = (selectCode) => {
  if  ( !selectCode ) {
    code = '';
    account = undefined;
    accountKey = '';
    inputAccount = '';
    clearSubInput();
    return;
  }
  const decided = list?.find((acc) => acc.code === selectCode);
  if  ( !decided )  return;
  code = decided.code;
  accountKey = decided.name;
  inputAccount = decided.name;
  setAccount();
}
const accountSelect = (event) => {
  const value = event.target.value;
  if  ( !value ) {
    // 先頭の空（入力しない）が選ばれたら入力クリア
    code = '';
    account = undefined;
    accountKey = '';
    inputAccount = '';
    clearSubInput();
    list = [];
    return;
  }
  code = value;
  //console.log(`accountSelect [${code}]`);
  accountDecide(code);
  list = [];
}

// 入力欄から抜けたとき、タイプで自動確定した最初の候補がcodeに
// 入っているなら表示を正式名称に揃える（候補をpickしても表示が
// 打った文字のままに見えて「入らない」ように見えるのを防ぐ）。
// ただしフォーカスが候補selectへ移るときは何もしない
// （ここで確定するとlistが消えてselectが閉じてしまう）
const inputDecide = (event) => {
  const to = event && event.relatedTarget;
  if  ( to && ( to.tagName === 'SELECT' ) ) {
    return;
  }
  if  ( code && ( list.length > 0 ) ) {
    accountDecide(code);
  }
}


const onSubAccountInput = (event) => {
  isInitialSubInput = false;
  subAccountKey = inputSubAccount;
  sub_highlight = 0;
  // 科目候補の確定（focusout）を待たずに補助欄を打てるようにする
  // （候補selectが開いたまま隣の補助欄を打つ操作で補助が機能しなくなるのを防ぐ）
  const current = currentAccount;
  if ( !current || ( !current.subAccounts ) ) {
    sub_list = [];
    sub_code = undefined;
    return;
  }
  if ( !subAccountKey ) {
    // キー未入力時は「入力しない」を選択できるよう空を先頭にする
    sub_list = searchSubAccountByKey(current, '');
    sub_code = undefined;
    sub_account = undefined;
    return;
  }
  sub_list = searchSubAccountByKey(current, subAccountKey);
  sub_code = ( sub_list && sub_list.length > 0 ) ? sub_list[0].code : undefined;
}
const clearSubInput = () => {
  inputSubAccount = '';
  subAccountKey = '';
  isInitialSubInput = false;
  sub_list = [];
  sub_code = undefined;
}
const subCheck = (event) => {
  if ( sub_list.length > 0 && [ 'ArrowDown', 'ArrowUp' ].includes(event.key) ) {
    event.preventDefault();
    sub_highlight = ( sub_highlight + ( event.key === 'ArrowDown' ? 1 : -1 ) + sub_list.length ) % sub_list.length;
    return;
  }
  if ( event.key === 'Enter' && sub_list.length > 0 ) {
    event.preventDefault();
    const item = sub_list[ sub_highlight ];
    if ( item ) {
      subAccountDecide(item.code);
    }
    return;
  }
  if ( event.key === 'Escape' && sub_list.length > 0 ) {
    sub_list = [];
    sub_highlight = 0;
    return;
  }
  if ((event.ctrlKey && event.key === 'h') || event.key === 'Backspace') {
    if  (isInitialSubInput)  {
      event.preventDefault();
      clearSubInput();
    }
  }
}
const subAccountDecide = (selectCode) => {
  if  ( !selectCode ) {
    // 先頭の空（入力しない）が選ばれたらクリア
    sub_code = undefined;
    sub_account = undefined;
    subAccountKey = '';
    inputSubAccount = '';
    return;
  }
  const decided = sub_list?.find((sub) => sub.code === selectCode);
  //console.log({decided});
  if  ( !decided )  return;
  sub_code = decided.code;
  subAccountKey = decided.name;
  inputSubAccount = decided.name;
  sub_list = [];
  sub_highlight = 0;
}
const subAccountSelect = (event) => {
  const raw = event.target.value;
  if  ( raw === '' || raw == null ) {
    sub_code = undefined;
    sub_account = undefined;
    subAccountKey = '';
    inputSubAccount = '';
    sub_list = [];
    return;
  }
  const value = parseInt(raw);
  if  ( !value ) {
    // 0 は補助科目なし
    sub_code = undefined;
    sub_account = undefined;
    subAccountKey = '';
    inputSubAccount = '';
    sub_list = [];
    return;
  }
  sub_code = value;
  //console.log({sub_code});
  subAccountDecide(sub_code);
  sub_list = [];
}

const setAccount = () => {
  list = [];
  if  ( !code ) {
    account = undefined;
    inputAccount = '';
    subAccountKey = '';
    return;
  }
  account = findAccount(code);
  console.log('account', account);
  if	( account )	{
    inputAccount = account.name;
  } else {
    inputAccount = '';
  }
  subAccountKey = '';
}
const searchAccountByKey = (key) => {
  let list = [];
  if	(	( key )
    &&	( key != '' ) )	{
    accounts.forEach((account) => {
      if	((( account.key ) &&
          ( account.key.match(key) )) ||
         ( account.name.match(key) ))	{
        list.push({
              name: account.name,
              code: account.code
             });
      }
    });
  } else {
    accounts.forEach((account) => {
      list.push({
        name: account.name,
        code: account.code
      });
    });
  }
  return (list);
}
const searchSubAccountByKey = (account, key) => {
  let list = [];
  if	( account && account.subAccounts )	{
    if	(	( key )
      &&	( key != '' ) )	{
      account.subAccounts.forEach((sub) => {
        if	((( sub.key ) &&
            ( sub.key.match(key) )) ||
            ( sub.name.match(key) ))	{
          list.push({
            name: sub.name,
            code: sub.code
          });
        }
      });
    } else {
      account.subAccounts.forEach((sub) => {
        list.push({
          name: sub.name,
          code: sub.code
        });
      });
    }
  }
  return (list);
}
const setSubAccount = () => {
  sub_list = [];
  if	( sub_code )	{
    sub_account = findSubAccount(account, parseInt(sub_code));
    //console.log('sub_account', sub_account);
    if	( sub_account )	{
      inputSubAccount = sub_account.name;
    } else {
      inputSubAccount = '';
    }
  } else {
    inputSubAccount = '';
  }
}

let initialized = false;
// bind:code / accounts の後付け追従。
// マウント時点でまだ accounts が届いていない（ルール反映・reload 直後等）と、
// setAccount() が一度だけ走って以後表示が空のままで直らない（initialized
// フラグで 1 回しか同期しないため）——これが「科目コードは入っているのに
// 画面が空で表示されない」が起きる/起きないが運次第になる原因。
// ユーザーが触った欄（isInitialInput=false）は絶対に上書きしない。
let syncedCode;
let syncedAccounts;
let syncedSub;
let syncedAccount;
beforeUpdate(() => {
  if  ( !initialized )  {
    initialized = true;
  }
  if  ( isInitialInput && ( ( code !== syncedCode ) || ( accounts !== syncedAccounts ) ) )  {
    setAccount();
    syncedCode = code;
    syncedAccounts = accounts;
  }
  if  ( isInitialSubInput && ( ( sub_code !== syncedSub ) || ( account !== syncedAccount ) ) )  {
    setSubAccount();
    syncedSub = sub_code;
    syncedAccount = account;
  }
});
onMount(() => {
  list = [];
  setAccount();
  setSubAccount();
  isInitialInput = true;
  syncedCode = code;
  syncedAccounts = accounts;
})
</script>
