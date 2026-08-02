'use client';

import Script from 'next/script';
import { useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';

import { CONFIG } from 'src/global-config';

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleIdentityApi = {
  initialize: (options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    context?: 'signin' | 'signup' | 'use';
    use_fedcm_for_prompt?: boolean;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      type: 'standard';
      theme: 'outline';
      size: 'large';
      text: 'signin_with' | 'signup_with';
      shape: 'rectangular';
      logo_alignment: 'left';
      width: number;
      locale: string;
    }
  ) => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleIdentityApi;
      };
    };
  }
}

type Props = {
  disabled?: boolean;
  language: 'th' | 'en';
  mode: 'signin' | 'signup';
  onCredential: (credential: string) => void;
  onError: (error: Error) => void;
};

export function GoogleIdentityButton({
  disabled = false,
  language,
  mode,
  onCredential,
  onError,
}: Props) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const credentialCallbackRef = useRef(onCredential);
  const errorCallbackRef = useRef(onError);
  const [scriptReady, setScriptReady] = useState(false);
  const clientId = CONFIG.auth.googleClientId;

  useEffect(() => {
    credentialCallbackRef.current = onCredential;
    errorCallbackRef.current = onError;
  }, [onCredential, onError]);

  useEffect(() => {
    const googleIdentity = window.google?.accounts.id;
    const button = buttonRef.current;
    if (!scriptReady || !clientId || !googleIdentity || !button) return;

    googleIdentity.initialize({
      client_id: clientId,
      auto_select: false,
      cancel_on_tap_outside: true,
      context: mode,
      use_fedcm_for_prompt: true,
      callback: (response) => {
        if (!response.credential) {
          errorCallbackRef.current(new Error('Google ไม่ส่งข้อมูลยืนยันตัวตนกลับมา'));
          return;
        }
        credentialCallbackRef.current(response.credential);
      },
    });

    button.replaceChildren();
    googleIdentity.renderButton(button, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: mode === 'signup' ? 'signup_with' : 'signin_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: Math.min(400, Math.max(240, Math.round(button.getBoundingClientRect().width))),
      locale: language === 'th' ? 'th' : 'en',
    });
  }, [clientId, language, mode, scriptReady]);

  if (!clientId) {
    return (
      <Alert severity="warning">
        {language === 'th'
          ? 'ยังไม่ได้ตั้งค่า NEXT_PUBLIC_GOOGLE_CLIENT_ID'
          : 'NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured'}
      </Alert>
    );
  }

  return (
    <>
      <Script
        id="google-identity-services"
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() => errorCallbackRef.current(new Error('โหลด Google Sign-In ไม่สำเร็จ'))}
      />

      <Box
        sx={{
          width: 1,
          minHeight: 44,
          display: 'grid',
          placeItems: 'center',
          opacity: disabled ? 0.6 : 1,
          pointerEvents: disabled ? 'none' : 'auto',
        }}
      >
        {!scriptReady && <CircularProgress size={24} />}
        <Box ref={buttonRef} sx={{ width: 1, minHeight: scriptReady ? 44 : 0 }} />
      </Box>
    </>
  );
}
