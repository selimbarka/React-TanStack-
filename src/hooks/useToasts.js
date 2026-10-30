import { useSyncExternalStore } from "react";

// Mini-store de notifications, utilisable hors de React (ex. MutationCache.onError).
const TOAST_DURATION_MS = 4000;

let toasts = [];
const listeners = new Set();

function emit() {
  listeners.forEach((listener) => listener());
}

export function showToast(message) {
  const id = crypto.randomUUID();
  toasts = [...toasts, { id, message }];
  emit();
  setTimeout(() => dismissToast(id), TOAST_DURATION_MS);
}

export function dismissToast(id) {
  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return toasts;
}

export function useToasts() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
