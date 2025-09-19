<div class="search-container">
  <input type="text" size="12" maxlength="13" autocomplete="off"
    placeholder="Search"
    class="search-input"
    bind:value={inputAccount}
    on:input={onAccountInput}
    on:keydown={keyCheck}>
    {#if ( list.length > 0 ) }
    <select bind:value={code}
      on:focusout={accountSelect}>
    {#each list as item}
    <option value={item.code}>
      {item.name}
    </option>
    {/each}
    </select>
    {/if}
  <input type="text" size="12" maxlength="13" autocomplete="off"
    placeholder="Search"
    class="search-input"
    bind:value={inputSubAccount}
    on:input={onSubAccountInput}
    on:keydown={subCheck}>
    {#if ( account && account.subAccounts )}
    {#if ( sub_list.length > 0 ) }
    <select bind:value={sub_code}
      on:focusout={subAccountSelect}>
      <option value={0}></option>
      {#each sub_list as item}
      <option value={item.code}>{item.name}</option>
      {/each}
    </select>
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
</style>
<script>
import {setAccounts, findAccount, findSubAccount} from '../../javascripts/cross-slip';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';

export	let	code;
export	let	sub_code;
export	let	accounts;

let account;
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
  if  ( list.length > 0 ) {
    code = list[0].code;
  }
}
const keyCheck = (event) => {
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
  isInitialInput = false;
  list = searchAccountByKey(accountKey);
  clearSubInput();
}
const accountDecide = (selectCode) => {
  const decided = list?.find((acc) => acc.code === selectCode);
  if  ( !decided )  return;
  code = decided.code;
  accountKey = decided.name;
  inputAccount = decided.name;
  setAccount();
}
const accountSelect = (event) => {
  code = event.target.value;
  accountDecide(code);
  list = [];
}


const onSubAccountInput = (event) => {
  isInitialSubInput = false;
  subAccountKey = inputSubAccount;
  sub_list = searchSubAccountByKey(account, subAccountKey);
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
  if ((event.ctrlKey && event.key === 'h') || event.key === 'Backspace') {
    if  (isInitialSubInput)  {
      event.preventDefault();
      clearSubInput();
    }
  }
}
const subAccountDecide = (selectCode) => {
  const decided = sub_list?.find((sub) => sub.code === selectCode);
  //console.log({decided});
  if  ( !decided )  return;
  sub_code = decided.code;
  subAccountKey = decided.name;
  inputSubAccount = decided.name;
}
const subAccountSelect = (event) => {
  sub_code = parseInt(event.target.value);
  //console.log({sub_code});
  subAccountDecide(sub_code);
  sub_list = [];
}

const setAccount = () => {
  list = [];
  if ( code )	{
    account = findAccount(code);
    console.log('account', account);
    if	( account )	{
      inputAccount = account.name;
    } else {
      inputAccount = '';
    }
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
  if	( account.subAccounts )	{
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
beforeUpdate(() => {
  //console.log('beforeUpdate account', init, code, sub_code);
  if	( !initialized )	{
    console.log('init');
    list = [];
    //setAccounts(accounts);    これは不要かも知れないので、確実になったら消すこと
    setAccount();
    setSubAccount();
    isInitialInput = true;
    initialized = true;
  }
});
onMount(() => {
  list = [];
  setAccounts(accounts);
  setAccount();
  setSubAccount();
  isInitialInput = true;
})
</script>
