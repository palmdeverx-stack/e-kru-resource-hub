import type { ButtonProps } from '@mui/material/Button';

import { useState, useCallback } from 'react';

import Button from '@mui/material/Button';

import { useRouter } from 'src/routes/hooks';

import { useTranslate } from 'src/locales';

import { toast } from 'src/components/snackbar';

import { signOut } from 'src/auth/context/jwt';
import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

type Props = ButtonProps & {
  onClose?: () => void;
};

export function SignOutButton({ onClose, sx, ...other }: Props) {
  const router = useRouter();
  const { t } = useTranslate();

  const { setSessionUser } = useAuthContext();
  const [pending, setPending] = useState(false);

  const handleLogout = useCallback(async () => {
    if (pending) return;
    setPending(true);
    try {
      await signOut();
      setSessionUser?.(null);

      onClose?.();
      router.replace('/');
    } catch (error) {
      console.error(error);
      toast.error(t('errors.signOut'));
    } finally {
      setPending(false);
    }
  }, [pending, setSessionUser, onClose, router, t]);

  return (
    <Button
      fullWidth
      variant="soft"
      size="large"
      color="error"
      onClick={handleLogout}
      loading={pending}
      sx={sx}
      {...other}
    >
      {t('actions.signOut')}
    </Button>
  );
}
