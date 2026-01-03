import { toast } from 'sonner';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  duration?: number;
  description?: string;
}

export const showToast = (message: string, type: ToastType = 'info', options?: ToastOptions) => {
  const toastOptions = {
    duration: options?.duration ?? 4000,
    description: options?.description,
    style: {
      background: 'var(--vscode-notifications-background)',
      color: 'var(--vscode-notifications-foreground)',
      border: '1px solid var(--vscode-notifications-border)',
      borderRadius: '4px',
    },
  };

  switch (type) {
    case 'success':
      return toast.success(message, toastOptions);
    case 'error':
      return toast.error(message, toastOptions);
    case 'warning':
      return toast.warning(message, toastOptions);
    case 'info':
    default:
      return toast.info(message, toastOptions);
  }
};

export const showSuccess = (message: string, options?: ToastOptions) => {
  return showToast(message, 'success', options);
};

export const showError = (message: string, options?: ToastOptions) => {
  return showToast(message, 'error', options);
};

export const showWarning = (message: string, options?: ToastOptions) => {
  return showToast(message, 'warning', options);
};

export const showInfo = (message: string, options?: ToastOptions) => {
  return showToast(message, 'info', options);
};

export { toast };
