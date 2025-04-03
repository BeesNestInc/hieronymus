import { writable, get } from 'svelte/store';

export const currentTransaction = writable();
export const currentTask = writable();
export const currentVoucher = writable();
export const currentCustomer = writable();
export const currentItem = writable();
export const currentMember = writable();
export const currentMenu = writable();
export const getStore = get;