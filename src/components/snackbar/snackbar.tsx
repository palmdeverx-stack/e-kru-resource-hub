'use client';

import Portal from '@mui/material/Portal';

import { SnackbarRoot } from './styles';
import { RemixIcon } from '../remix-icon';
import { snackbarClasses } from './classes';

// ----------------------------------------------------------------------

export function Snackbar() {
  return (
    <Portal>
      <SnackbarRoot
        expand
        closeButton
        gap={12}
        offset={16}
        visibleToasts={4}
        position="top-right"
        className={snackbarClasses.root}
        toastOptions={{
          unstyled: true,
          classNames: {
            toast: snackbarClasses.toast,
            icon: snackbarClasses.icon,
            loader: snackbarClasses.loader,
            loading: snackbarClasses.loading,
            /********/
            content: snackbarClasses.content,
            title: snackbarClasses.title,
            description: snackbarClasses.description,
            /********/
            closeButton: snackbarClasses.closeButton,
            actionButton: snackbarClasses.actionButton,
            cancelButton: snackbarClasses.cancelButton,
            /********/
            info: snackbarClasses.info,
            error: snackbarClasses.error,
            success: snackbarClasses.success,
            warning: snackbarClasses.warning,
          },
        }}
        icons={{
          loading: <span className={snackbarClasses.loadingIcon} />,
          info: <RemixIcon className={snackbarClasses.iconSvg} icon="solar:info-circle-bold" />,
          success: <RemixIcon className={snackbarClasses.iconSvg} icon="solar:check-circle-bold" />,
          warning: (
            <RemixIcon className={snackbarClasses.iconSvg} icon="solar:danger-triangle-bold" />
          ),
          error: <RemixIcon className={snackbarClasses.iconSvg} icon="solar:danger-bold" />,
        }}
      />
    </Portal>
  );
}
