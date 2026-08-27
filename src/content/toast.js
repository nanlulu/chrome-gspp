// Small transient message, used for jump feedback and failure reporting.

let element = null;
let hideTimer = 0;

export function toast(message, ms = 1800) {
  if (!message) return;
  if (!element || !element.isConnected) {
    element = document.createElement('div');
    element.id = 'gspp-toast';
    document.body.appendChild(element);
  }
  element.textContent = message;
  // Force a reflow so the transition runs when re-showing an existing toast.
  void element.offsetWidth;
  element.classList.add('gspp-toast-visible');

  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    element?.classList.remove('gspp-toast-visible');
  }, ms);
}
