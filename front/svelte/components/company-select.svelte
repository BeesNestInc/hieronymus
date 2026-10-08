{#if ( status === 'select' )}
  <div class="row mb-3">
    <div class={(register === 'true' ) ? 'col-10' : 'col-12'}>
      <input type="text" autocomplete="off"
        class="form-control"
        placeholder="検索キー"
        bind:value={inputValue}
        on:input={onUserInput}
        on:keydown={keyCheck}
      />
      {#if ( companys && companys.length > 0 ) }
        <select id="companyId" class="col-12 form-control" style="margin-top:5px;"
          bind:value={_companyId}
          on:change={(e) => {
            companySelect(e);
          }}
          on:focusout={(e) => {
            companyDecide(_companyId);
          }}>
          {#each companys as company}
          <option value={company.id}>
            {company.name}
          </option>
          {/each}
        </select>
      {/if}
    </div>
    {#if (register === 'true') }
    <div class="col-2">
      <button type="button" class="btn btn-primary"
        on:click={openEntry}>
        登録
      </button>
      {#if (!companyId)}
      <button type="button" class="btn btn-danger" disabled=true>
        未登録
      </button>
    	{/if}
    </div>
    {/if}
  </div>
  {#if ( input === 'view' || input === 'input') }
    <div class="row mb-2">
      <label for="companyName" class="col-1 col-form-label">相手先名</label>
      <div class="col-11">
        <input type="text" id="companyName" class="form-control"
          bind:value={companyName} disabled={( input === 'view' ) ? true : false}/>
        </div>
      </div>
    <div class="row mb-2">
      <label for="zip" class="col-1 col-form-label">郵便番号</label>
      <div class="col-2">
        <input type="text" id="zip" class="form-control"
          bind:value={zip} disabled={( input === 'view' ) ? true : false}>
      </div>
    </div>
    <div class="row mb-2">
      <label for="address1" class="col-1 col-form-label">住所</label>
      <div class="col-11">
        <input type="text" id="address1" class="form-control"
          bind:value={address1} disabled={( input === 'view' ) ? true : false}>
      </div>
    </div>
    <div class="row mb-2">
      <label for="address2" class="col-1 col-form-label" style="height:38px;"></label>
      <div class="col-11">
        <input type="text" id="address2" class="form-control"
          bind:value={address2} disabled={( input === 'view' ) ? true : false}>
      </div>
    </div>
    <div class="row mb-2">
      <label for="chargeName" class="col-1 col-form-label">担当者</label>
      <div class="col-11">
        <input type="text" id="chargeName" class="form-control"
          bind:value={chargeName} disabled={( input === 'view' ) ? true : false}>
      </div>
    </div>
  {/if}
{:else}
  <CompanyEntry
    inline=true
	  on:save={saveCompany}
    on:close={closeEntry}
	  bind:company={company}>
  </CompanyEntry>
{/if}
<script>
import axios from 'axios';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
const dispatch = createEventDispatcher();
import CompanyEntry from '../company/company-entry.svelte';

export let companyId = '';
export let register = '';
export let input = '';
export let style;
export let companyName = '';
export let chargeName = '';
export let zip = '';
export let address1 = '';
export let address2 = '';
export let clientOnly;

let	original_companies;
let companyKey;
let inputValue = '';
let isInitialInput = true;
let	companys = [];
let company = {};
let status = 'select';
let _companyId;
let resolvedCompanyId;

const onUserInput = (event) =>{
  isInitialInput = false;
	companyKey = inputValue;
  if  ( !companyKey || ( companyKey == '' ))    {
      companys = [];
  } else {
    companys = [];
    if (original_companies) {
      original_companies.forEach((company) => {
        if  (( company.key && company.key.includes(companyKey) ) ||
             ( company.name && company.name.includes(companyKey)) ) {
          companys.push(company);
        }
      })
    }
    if	( companys.length > 0 )	{
      _companyId = companys[0].id;
    }
  }
}
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
  companyKey = '';
  isInitialInput = false;
  companys = original_companies ? [...original_companies] : [];
};


const update = (event) => {
  //console.log('update', company);
  companyId = company.id;
  resolvedCompanyId = company.id;
  companyName = company.name;
  chargeName = company.chargeName;
  zip = company.zip;
  address1 = company.address1;
  address2 = company.address2;
}
const closeEntry = (event) => {
  status = 'select';
  update();
  dispatch('endregister');
}
// 取引先の新規登録・編集保存時は決定会社として親にも通知する（表示同期用）
const saveCompany = (event) => {
  update(event);
  dispatch('decide', company);
}
const	openEntry = async (event)	=> {
  company = {
    name: companyName,
    chargeName: chargeName,
    zip: zip,
    address1: address1,
    address2: address2
  };
  if  ( companyId )  {
    let result = await axios.get(`/api/company/${companyId}`);
    if  ( result.data ) {
      company = result.data.company;
    }
  }
  dispatch('startregister');
	//console.log('company', company)
	status = 'entry';
}

const companyDecide = (id) => {
  if  ( companys )   {
    for	( let i = 0; i < companys.length; i ++ )	{
      if	( companys[i].id == id )	{
        let company = companys[i];
        //console.log(company)
        companyId = company.id;
        resolvedCompanyId = company.id;
        companyName = company.name;
        inputValue = company.name;
        chargeName = company.chargeName;
        zip = company.zip;
        address1 = company.address1;
        address2 = company.address2;
        companyKey = companyName;
        dispatch('input', companyId);
        dispatch('decide', company);
        companys = [];
        break;
      }
    }
  } else {
    companyKey = '';
  }
}
const	companySelect = (event)	=> {
  companyDecide(event.target.value);
  companys = [];
  dispatch('input', companyId);
}
// voucher詳細のように companyId がマウント後に確定・差し替えされる場合に追従する。
// キー入力では companyId は変わらないため、この分岐は外部からの差し替え時のみ走る。
// 証憑切替時は古い候補・検索表示もリセットする（companyDecideがinputValueを更新する）。
$: if (original_companies && original_companies.length && companyId &&
    String(resolvedCompanyId ?? '') !== String(companyId)) {
  companys = original_companies;
  companyDecide(companyId);
  companys = [];
}
beforeUpdate(() => {
  //console.log({companyId});
})

let initialized = false;
beforeUpdate(() => {
  if (!initialized && companyName) {
    companyKey = companyName;
    isInitialInput = true;
    initialized = true;
  }
});

onMount(() => {
  //console.log('company-select onMount');
  inputValue = companyName ?? '';
  isInitialInput = true;
  let param = clientOnly ? `?${encodeURI('clientOnly=true')}` : '';
  axios.get(`/api/company${param}`).then((result) => {
    original_companies = result.data.companies;
    companys = original_companies;
    companyDecide(companyId);
    // 一覧の取得前に検索キーが入力されていた場合は、取得完了後に再フィルタして候補を反映する。
    if (inputValue) {
      onUserInput();
    } else {
      companys = [];
    }
  }).catch((err) => {
    console.error('/api/company failed', err?.response?.status ?? err);
    companys = [];
  });
})
</script>