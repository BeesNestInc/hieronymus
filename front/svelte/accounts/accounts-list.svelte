<table class="table table-bordered">
  <thead>
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
        {line.major_name}
      </td>
      <td>
        {line.middle_name}
      </td>
      <td>
        {#if (line.minor_name != '')}
        {line.minor_name}
        {/if}
      </td>
      <td>
        {#if line.code}
        <button type="button" class="btn btn-link"
          on:click={() => {
            editAccount(line.code);
          }}>
          {line.account_name}
        </button>
        {:else}
        <button type="button" class="btn btn-primary btn-sm"
          on:click={() => {
            newAccount(line.acl_id, line.acl_code);
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
        {#if ( line.sub_code )}
        {#if (line.sub_code >= 0)}
        <button type="button" class="btn btn-link"
          on:click={() => {
            editSubAccount(line.code, line.sub_code);
          }}>
          {line.sub_account_name}
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
        {line.tax_class ? line.tax_class : ''}
      </td>
      <td>
        {line.code ? line.key : ''}
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

export	let	status;
export	let	lines;
export	let	accounts;

beforeUpdate(() => {
	console.log('lines', lines);
})

const editAccount = (code) => {
	let account;
	for ( let i = 0; i < accounts.length ; i ++ ) {
		account = accounts[i];
		if ( account.code === code ) break;
	}
	dispatch('open',{
		account: account,
		sub_account: null,
		mode: 'edit_account'
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
		  sub_account: null,
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
	let sub_account = null;
	for ( let i = 0; i < account.subAccounts.length ; i ++) {
		sub_account = account.subAccounts[i];
		if ( sub_account.code === sub_code ) break;
	}
	dispatch('open',{
		account: account,
		sub_account: sub_account,
		mode: "edit-sub-account"
	});
}
const	newSubAccount = async (code) => {
	let account;
	for ( let i = 0; i < accounts.length ; i ++ ) {
		account = accounts[i];
		if ( account.code == code ) break;
	}
	let sub_account  = {
    debit: 0,
    credit: 0,
    balance: 0
	}
	dispatch('open',{
		account: account,
		sub_account: sub_account,
		mode: 'new-sub-account'
	});
}
</script>
