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
  <CustomerEntry
    inline=true
	  on:save={update}
    on:close={closeEntry}
	  bind:company={company}>
  </CustomerEntry>
{/if}

<script>
import axios from 'axios';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
const dispatch = createEventDispatcher();
import CustomerEntry from '../company/company-entry.svelte';

export let companyId;
export let register;
export let input;
export let style;
export let companyName;
export let chargeName;
export let zip;
export let address1;
export let address2;
export let clientOnly;

let	original_companys;
let companyKey;
let inputValue = '';
let isInitialInput = true;
let	companys = [];
let company = {};
let status = 'select';
let _companyId;

const onUserInput = (event) =>{
  isInitialInput = false;
	companyKey = inputValue;
  if  ( !companyKey || ( companyKey == '' ))    {
      companys = [];
  } else {
    companys = [];
    original_companys.forEach((company) => {
      if  (( company.key && company.key.match(companyKey) ) ||
           ( company.name && company.name.match(companyKey)) ) {
        companys.push(company);
      }
    })
    if	( companys.length > 0 )	{
      _companyId = companys[0].id;
    }
    console.log({companys});
    console.log({companyId});
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
  companys = [...original_companys];
};


const update = (event) => {
  //console.log('update', company);
  companyId = company.id;
  companyName = company.name;
  chargeName = company.chargeName;
  zip = company.zip;
  address1 = company.address1;
  address2 = company.address2;
}
const closeEntry = (event) => {
  status = 'select';
  dispatch('endregister');
}
const	openEntry = async (event)	=> {
	console.log('open', companyId);
  company = {
    name: companyName,
    chargeName: chargeName,
    zip: zip,
    address1: address1,
    address2: address2
  };
  if  ( companyId )  {
    let result = await axios.get(`/api/company/${companyId}`);
    console.log({result});
    if  ( result.data ) {
      company = result.data.company;
    }
  }
  dispatch('startregister');
	//console.log('company', company)
	status = 'entry';
}

const companyDecide = (id) => {
  console.log('companyDecide', id);
  if  ( companys )   {
    for	( let i = 0; i < companys.length; i ++ )	{
      if	( companys[i].id == id )	{
        let company = companys[i];
        //console.log(company)
        companyId = company.id;
        companyName = company.name;
        chargeName = company.chargeName;
        zip = company.zip;
        address1 = company.address1;
        address2 = company.address2;
        companyKey = companyName;
        dispatch('input', companyId);
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
beforeUpdate(() => {
  //console.log({companyId});
})

let initialized = false;
beforeUpdate(() => {
  if (!initialized && companyName) {
    inputValue = companyName;
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
  axios.get(`/api/company/${param}`).then((result) => {
    original_companys = result.data.companys;
    companys = original_companys;
    companyDecide(companyId);
    companys = [];
  });
})
</script>