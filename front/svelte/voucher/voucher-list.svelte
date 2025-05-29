<div class="list">
  <div class="page-title d-flex justify-content-between">
    <h1>証票一覧</h1>
    <button type="button" class="btn btn-primary"
  	  on:click={() => {
    	  openVoucher(null);
  	  }}
		  id="voucher-info">証票入力&nbsp;<i class="bi bi-pencil-square"></i>
    </button>
  </div>
  <ul class="page-subtitle nav me-auto">
    {#each dates as date}
      <li class="nav-item">
        {#if ( status.params && (date.ym == status.params.get('month')) )}
        <button type="button" class="btn btn-primary disabled me-2"
          on:click={() => {
            dispatch('gotoMonth',`${date.year}-${date.month}`);
          }}>
          {date.month}&nbsp;月
        </button>
        {:else}
        <button type="button" class="btn btn-outline-primary me-2"
          on:click={() => {
            dispatch('gotoMonth', `${date.year}-${date.month}`);
          }}>
          {date.month}&nbsp;月
        </button>
        {/if}
      </li>
    {/each}
    <li class="nav-item">
      {#if ( !status.params || !status.params.get('month') )}
      <button type="button" class="btn btn-primary disabled me-2"
        on:click={() => {
          dispatch('gotoMonth');
        }}>
      ALL
      </button>
      {:else}
      <button type="button" class="btn btn-outline-primary me-2"
        on:click={() => {
          dispatch('gotoMonth');
        }}>
        ALL
      </button>
      {/if}
    </li>
  </ul>
  <div class="full-height fontsize-12pt">
    <table class="table table-bordered">
      <thead>
        <tr>
          <th scope="col" style="width: 150px;">
            種別
          </th>
          <th scope="col" style="width: 200px;">
            相手先
          </th>
          <th scope="col" style="width: 120px;">
            発生日
          </th>
          <th scope="col" style="width: 120px;">
            支払日
          </th>
          <th scope="col" style="width: 100px;">
            金額
          </th>
          <th scope="col">
            説明
          </th>
          <th scope="col" style="width:150px;">
            ファイル
          </th>
          <th scope="col" style="width: 100px;">
            処理者
          </th>
        </tr>
      </thead>
      <tbody>
        <tr style="height:25px;">
          <td>
            <select class="form-select"
                on:input={changeVoucherType}
                value={status.params ? parseInt(status.params.get('type')): -1}>
              <option value={-1}>全て</option>
              {#each status.voucherClasses as voucherClass}
              <option value={voucherClass.id}>{voucherClass.name}</option>
              {/each}
            </select>
          </td>
          <td>
            <CompanySelect
                bind:value={companyId}
                on:input={changeCompany}>
            </CompanySelect>
          </td>
          <td>
          </td>
          <td>
          </td>
          <td>
            <input type="text" class="number" placeholder="下限" size="12" maxlength="13"
                bind:value={lowerAmount}
                on:keypress={changeAmount} />
            <input type="text" class="number" placeholder="上限" size="12" maxlength="13"
                bind:value={upperAmount}
                on:keypress={changeAmount} />
          </td>
          <td>
          </td>
          <td>
          </td>
          <td>
          </td>
        </tr>
        {#each vouchers as line}
        <tr>
          <td>
            <button type="button" class="btn btn-link"
              on:click={() => {
                openVoucher(line.id);
              }}
              >
              {line.voucherClass ? line.voucherClass.name : '__'}
            </button>
          </td>
          <td>
            {line.company.name}
          </td>
          <td>
            {#if ( line.details.length > 0 ) }
            <button type="button" class="btn btn-link text-primary"
              on:click|preventDefault={() => {
                openSlip(
                  line.details[0].crossSlip.year,
                  line.details[0].crossSlip.month,
                  line.details[0].crossSlip.day,
                  line.details[0].crossSlip.no);
              }}>
              {formatDate(line.issueDate)}
            </button>
            {:else}
            <button type="button" class="btn btn-link text-danger"
              on:click|preventDefault={() => {
                let issueDate = new Date(line.issueDate);
                openSlip(
                  issueDate.getFullYear(),
                  issueDate.getMonth()+1,
                  issueDate.getDate());
              }}>
              {formatDate(line.issueDate)}
            </button>
            {/if}
          </td>
          <td>
            {#if (	line.paymentDate &&
                 ( line.details.length > 0 ) &&
                compDate(line.paymentDate,
                line.details[0].crossSlip.year,
                line.details[0].crossSlip.month,
                line.details[0].crossSlip.day) ) }
            <button type="button" class="btn btn-link"
              on:click|preventDefault={() => {
                openSlip(
                  line.details[0].crossSlip.year,
                  line.details[0].crossSlip.month,
                  line.details[0].crossSlip.day,
                  line.details[0].crossSlip.no);
              }}>
                {formatDate(line.paymentDate)}
            </button>
            {:else}
            {formatDate(line.paymentDate)}
            {/if}
          </td>
          <td class="number">
            {numeric(line.amount).toLocaleString()}
          </td>
          <td>
            {line.description || ''}
          </td>
          <td style="height:25px;">
            {#each line.files as file}
            <div class="file-item">
              <a href="/voucher/file/{file.id}" target="_blank">
                {#if ( file.mimeType.match(/^image\//) ) }
                <img src="data:{file.mimeType};base64,{(file.body)}"
                  class="rect-image"/>
                {:else if ( file.name.match(/\.pdf$/) ) }
                <img src="/public/icons/icon_pdf.png" class="rect-image" />
                {/if}
              </a>
            </div>
            {/each}
          </td>
          <td>
            {line.updateUser.name}
          </td>
        </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
.file-item {
  width:40px;
  height:40px;
  padding:5px;
  float: left;
}
.rect-image {
  width:40px;
  clip:rect(0,40px,40px,0);
}
</style>

<script>
import axios from 'axios';
import CompanySelect from '../components/company-select.svelte';

import {numeric, formatDate} from '../../../libs/utils';
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
const dispatch = createEventDispatcher();

export let status;
export let vouchers;

let companyId;
let upperAmount;
let lowerAmount;
let dates = [];

const compDate = (date, year, month, day) => {
  let ymd = date.split('-');
  return	(	( parseInt(ymd[0]) == year )
    &&	( parseInt(ymd[1]) == month )
    &&	( parseInt(ymd[2]) == day ));
}

beforeUpdate(() => {
  //console.log('voucher-list beforeUpdate', vouchers);
  console.log({status});
});

const changeVoucherType = (event) => {
  let value = parseInt(event.currentTarget.value);
  console.log({value});
  status.params.set('type', value);
  dispatch('selectVoucherType');
}
const changeCompany = (event) => {
  let companyId = event.detail;
  //console.log({companyId});
  dispatch('selectCompanyId', companyId);
}
const changeAmount = (event) => {
  if	( event.keyCode == 13 )	{
    dispatch('selectAmount', {
      lowerAmount: lowerAmount,
      upperAmount: upperAmount
    });
  }
}

const openSlip = (year, month, day, no) => {
  console.log(year, month, day, no);
  dispatch('openSlip', {
    year: year,
    month: month,
    day: day,
    no: no
  });
}
const openVoucher = (id) => {
  let	voucher;

  if  ( id )  {
    for ( let i = 0; i < vouchers.length; i ++ ) {
      if ( vouchers[i].id == id ) {
        voucher = vouchers[i];
        break;
      }
    }
  }
  dispatch('open', voucher);
}
onMount(() => {
  axios.get(`/api/term/${status.term}`).then((result) => {
    let fy = result.data;
    status.term = fy.term;
    for ( let mon = new Date(fy.startDate); mon < new Date(fy.endDate); ) {
      dates.push({
        year: mon.getFullYear(),
        month: mon.getMonth()+1,
        ym: `${mon.getFullYear()}-${mon.getMonth()+1}`
      });
      mon.setMonth(mon.getMonth() + 1);
    }
    dates = dates;
  });
})
</script>
