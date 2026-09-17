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
        {#if (line.aclId && line.majorName != '')}
        <button type="button" class="btn btn-link btn-sm p-0 ms-1"
          title="科目クラスを編集"
          on:click={() => {
            editAccountClass(line.aclId);
          }}>
          <i class="bi bi-pencil"></i>
        </button>
        {/if}
      </td>
      <td>
        {line.middleName}
      </td>
      <td>
        {#if (line.minorName != '')}
        {line.minorName}
        {/if}
        {#if (!line.code && line.isClassStart)}
        {#if (line.aclCode)}
        <span class="text-muted small ms-1">[{line.aclCode}]</span>
        {/if}
        {#if (line.aclField != null && line.aclAdding != null)}
        <button type="button" class="btn btn-primary btn-sm ms-1"
          title="このクラスの次に科目クラスを追加"
          on:click={() => {
            newAccountClass(line.aclField, line.aclAdding + 1, line.aclId);
          }}>
          <i class="bi bi-plus"></i>
        </button>
        {/if}
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
  <tfoot>
    <tr>
      <td colspan="12">
        <button type="button" class="btn btn-primary btn-sm"
          on:click={() => {
            let last = lastAccountClass();
            if (last) {
              newAccountClass(last.aclField, last.aclAdding + 1, last.aclId);
            } else {
              newAccountClass('', '', null);
            }
          }}>
          <i class="bi bi-plus"></i> 科目クラス追加
        </button>
      </td>
    </tr>
  </tfoot>
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
		  code: code + nextAccountSeq(acl.id, code),
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
const	newAccountClass = (field, adding, aclId) => {
	let names = classNames(aclId);
	let sugAdding = (field === '' || field == null) ? '' : nextFreeAdding(field, adding);
	dispatch('open',{
		account: null,
		subAccount: null,
		accountClass: {
			major: names.major,
			middle: names.middle,
			minor: '',
			field: (field === undefined || field === null) ? '' : field,
			adding: sugAdding
		},
		mode: 'new-account-class'
	});
}
const	classNames = (aclId) => {
	// 表示行のmajorName/middleNameは変わり目にしか入らないため、元データから引く
	for ( const a of (accounts || []) ) {
		if ( Number(a.acl_id) === Number(aclId) ) {
			return { major: a.major_name || '', middle: a.middle_name || '' };
		}
	}
	return { major: '', middle: '' };
}
const	nextFreeAdding = (field, from) => {
	// 同じfieldで使われているaddingを集め、from以上の最初の空き番号を返す
	let used = {};
	for ( const a of (accounts || []) ) {
		if ( a.acl_field != null && String(a.acl_field) === String(field) ) {
			used[Number(a.acl_adding)] = true;
		}
	}
	let n = parseInt(from, 10);
	if ( isNaN(n) || n < 0 ) n = 0;
	while ( used[n] ) n++;
	return n;
}
const	lastAccountClass = () => {
	let last = null;
	for ( let i = 0; i < lines.length ; i ++ ) {
		if ( !lines[i].code && lines[i].isClassStart && lines[i].aclAdding != null ) {
			last = lines[i];
		}
	}
	return last;
}
const	editAccountClass = (id) => {
	axios.get(`/api/account-class/${id}`).then((result) => {
	  let acl = result.data;
	  dispatch('open',{
		  account: null,
		  subAccount: null,
		  accountClass: acl,
		  mode: 'edit-account-class'
	  });
  });
}
const	nextAccountSeq = (aclId, aclCode) => {
	// 同クラスの既存科目コードから連番の最大値を求め、+10した4桁を提案する
	let maxSeq = -10;
	for ( const a of (accounts || []) ) {
		if ( a.code && Number(a.acl_id) === Number(aclId) ) {
			let seq = parseInt(String(a.code).slice(String(aclCode).length), 10);
			if ( !isNaN(seq) && seq > maxSeq ) maxSeq = seq;
		}
	}
	return String(maxSeq + 10).padStart(4, '0');
}
</script>
