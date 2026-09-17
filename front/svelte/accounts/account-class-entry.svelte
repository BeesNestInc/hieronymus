<div class="container-fluid">
    <div class="row">
        <div class="col-3">大分類</div>
        <div class="col-9">
            {accountClass.major || '―'}
        </div>
    </div>
    <div class="row">
        <div class="col-3">中分類</div>
        <div class="col-9">
            {accountClass.middle || '―'}
        </div>
    </div>
    <div class="row">
        <div class="col-3">小分類</div>
        <div class="col-9">
            <input type="text" id="minor"
                    bind:value={accountClass.minor} size="24">
        </div>
    </div>
    <div class="row">
        <div class="col-3">分野 (field)</div>
        <div class="col-9">
            {#if ( mode == 'new-account-class') }
            <input type="number" id="field"
                    bind:value={accountClass.field} min="0">
            {:else}
            {accountClass.field}
            {/if}
        </div>
    </div>
    <div class="row">
        <div class="col-3">加算 (adding)</div>
        <div class="col-9">
            {#if ( mode == 'new-account-class') }
            <input type="number" id="adding"
                    bind:value={accountClass.adding} min="0">
            {:else}
            {accountClass.adding}
            {/if}
        </div>
    </div>
    <div class="row">
        <div class="col-3">分類コード</div>
        <div class="col-9">
            {klassCode !== '' ? klassCode : '―'}
            {#if (isDup)}
            <span class="text-danger ms-2">この番号は既に使われています</span>
            {/if}
        </div>
    </div>
    {#if ( mode == 'edit-account-class') }
    <div class="row">
        <div class="col-12 text-muted fontsize-10pt">
            分野・加算は既存科目コードとの整合のため変更できません
        </div>
    </div>
    {/if}
</div>

<script>
import {onMount, beforeUpdate, afterUpdate, createEventDispatcher} from 'svelte';
import {make_klass} from '../../../libs/parse_account_code.js';

export	let accountClass;
export	let mode;
export	let existingKeys = [];
export	let valid = true;

const	toNum = (v) => {
    if ( v === '' || v == null ) return NaN;
    return Number(v);
}

$: fieldNum = toNum(accountClass ? accountClass.field : NaN);
$: addingNum = toNum(accountClass ? accountClass.adding : NaN);
$: klassCode = (!isNaN(fieldNum) && !isNaN(addingNum)) ? make_klass(fieldNum, addingNum) : '';
$: isDup = mode === 'new-account-class' && klassCode !== '' && (existingKeys || []).includes(fieldNum + '-' + addingNum);
$: valid = !!(accountClass &&
    (accountClass.major || '').trim() &&
    (accountClass.middle || '').trim() &&
    (accountClass.minor || '').trim() &&
    klassCode !== '' && !isDup);

beforeUpdate(() => {
    console.log({accountClass});
})
</script>
