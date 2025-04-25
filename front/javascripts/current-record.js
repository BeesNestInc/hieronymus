import { writable, get } from 'svelte/store';

export const currentTransaction = writable();
export const currentTask = writable();
export const currentMenu = writable();
export const currentCompany = writable();
export const currentVoucher = writable();
export const currentItem = writable();
export const currentMember = writable();
export const getStore = get;