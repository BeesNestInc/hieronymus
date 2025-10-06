<table class="table table-bordered">
  <thead class="table-light">
    <tr>
      <th scope="col" style="width: 120px;">
        大分類
      </th>
      <th scope="col" style="width: 120px;">
        中分類
      </th>
      <th scope="col" style="width: 140px;">
        小分類
      </th>
      <th scope="col">
        勘定科目
      </th>
      <th scope="col" style="width: 80px;">
        科目<br/>コード
      </th>
      <th scope="col" style="width: 120px;">
        補助科目
      </th>
      <th scope="col" style="width: 50px;">
        課税区分
      </th>
      <th scope="col" style="width: 60px;">
        検索キー
      </th>
      <th scope="col" style="width: 100px;">
        借方金額
      </th>
      <th scope="col" style="width: 100px;">
        貸方金額
      </th>
      <th scope="col" style="width: 100px;">
        残高
      </th>
    </tr>
  </thead>
  <tbody>
    {#each lines as line}
    <tr>
      <td>
        {line.majorName}
      </td>
      <td>
        {line.middleName}
      </td>
      <td>
        {#if (line.minorName != '')}
        {line.minorName}
        {/if}
      </td>
      <td>
        {#if line.code}
        <button type="button" class="btn btn-link"
          on:click={() => {
            editAccount(line.code);
          }}>
          {line.accountName}
        </button>
        {:else}
        <button type="button" class="btn btn-primary btn-sm"
          on:click={() => {
            newAccount(line.aclId, line.aclCode);
          }}>
          <i class="bi bi-plus"></i>
        </button>
        {/if}
      </td>
      <td>
        {#if line.code}
        {line.code}
        {/if}
      </td>
      <td>
        {#if ( line.subCode )}
        {#if (line.subCode >= 0)}
        <button type="button" class="btn btn-link"
          on:click={() => {
            editSubAccount(line.code, line.subCode);
          }}>
          {line.subAccountName}
        </button>
        {:else}
        <button type="button" class="btn btn-primary btn-sm"
          on:click={() => {
            newSubAccount(line.code);
          }}>
          <i class="bi bi-plus"></i>
        </button>
        {/if}
        {/if}
      </td>
      <td>
        {line.taxClass ? taxClass(line.taxClass) : ''}
      </td>
      <td>
        {line.key ? line.key : ''}
      </td>
      <td class="number">
        {line.code ? line.debit.toLocaleString() : ''}
      </td>
      <td class="number">
        {line.code ? line.credit.toLocaleString() : ''}
      </td>
      <td class="number">
        {line.code ? line.remaining.toLocaleString(): ''}
      </td>
    </tr>
    {/each}
  </tbody>
</table>

<style>
th {
	text-align: center;
}
</style>

<script>
import axios from 'axios';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
const dispatch = createEventDispatcher();
import {taxClass} from '../../../libs/utils.js';

export	let	status;
export	let	lines;
export	let	accounts;

const editAccount = (code) => {
	let account;
	for ( let i = 0; i < accounts.length ; i ++ ) {
		account = accounts[i];
		if ( account.code === code ) break;
	}
	dispatch('open',{
		account: account,
		subAccount: null,
		mode: 'edit-account'
	});
}
const	newAccount = (id, code) => {
	axios.get(`/api/account-class/${id}`).then((result) => {
	  let acl = result.data;
	  console.log({acl});
	  let account = {
		  code: code + '****',
		  major_name: acl.major,
		  middle_name: acl.middle,
		  minor_name: acl.minor,
		  klass_id: acl.id,
		  name: '',
		  key: '',
      debit: 0,
      credit: 0,
      balance: 0
	  };
	  dispatch('open',{
		  account: account,
		  subAccount: null,
		  mode: 'new-account'
	  });
  });
}

const	editSubAccount = (code, sub_code) => {
	let account;
	for ( let i = 0; i < accounts.length ; i ++ ) {
		account = accounts[i];
		if ( account.code === code ) break;
	}
	let subAccount = null;
	for ( let i = 0; i < account.subAccounts.length ; i ++) {
		subAccount = account.subAccounts[i];
		if ( subAccount.code === sub_code ) break;
	}
	dispatch('open',{
		account: account,
		subAccount: subAccount,
		mode: "edit-sub-account"
	});
}
const	newSubAccount = async (code) => {
	let account;
	for ( let i = 0; i < accounts.length ; i ++ ) {
		account = accounts[i];
		if ( account.code == code ) break;
	}
	let subAccount  = {
    debit: 0,
    credit: 0,
    balance: 0
	}
	dispatch('open',{
		account: account,
		subAccount: subAccount,
		mode: 'new-sub-account'
	});
}
</script>
