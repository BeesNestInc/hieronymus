import { writable, get } from 'svelte/store';

export const currentTransaction = writable();
export const currentTask = writable();
export const getStore = get;