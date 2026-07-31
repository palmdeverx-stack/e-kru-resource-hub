'use client';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import InputAdornment from '@mui/material/InputAdornment';

import { THAI_BANKS, findThaiBank } from './thai-banks';
import { ThaiBankLogo } from './bank-logo';

type Props = {
  value: string;
  onChange: (bank: (typeof THAI_BANKS)[number] | null) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
};

export function ThaiBankAutocomplete({
  value,
  onChange,
  label = 'ธนาคาร',
  required = false,
  disabled = false,
  helperText = 'ค้นหาจากชื่อธนาคาร ชื่อย่อ หรือรหัสธนาคาร',
}: Props) {
  const selectedBank = findThaiBank(value);

  return (
    <Autocomplete
      fullWidth
      autoHighlight
      disabled={disabled}
      options={THAI_BANKS}
      value={selectedBank}
      onChange={(_, bank) => onChange(bank)}
      getOptionLabel={(bank) => `${bank.name} (${bank.alias} · ${bank.code})`}
      isOptionEqualToValue={(option, selected) => option.code === selected.code}
      renderOption={(props, bank) => (
        <li {...props} key={bank.code}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
            <ThaiBankLogo bankCode={bank.code} size={30} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap>
                {bank.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {bank.alias} · รหัส {bank.code}
              </Typography>
            </Box>
          </Stack>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          required={required}
          label={label}
          helperText={helperText}
          slotProps={{
            input: {
              ...params.InputProps,
              ...(selectedBank && {
                startAdornment: (
                  <InputAdornment position="start" sx={{ ml: 0.25, mr: 0.75 }}>
                    <ThaiBankLogo bankCode={selectedBank.code} size={26} />
                  </InputAdornment>
                ),
              }),
            },
            htmlInput: params.inputProps,
          }}
        />
      )}
    />
  );
}
