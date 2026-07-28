import type { JSX, ReactNode } from 'react';
import type { TextFieldProps } from '@mui/material/TextField';
import type { AutocompleteProps, AutocompleteRenderInputParams } from '@mui/material/Autocomplete';

import { Controller, useFormContext } from 'react-hook-form';

import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import { Box, Chip, Stack, useTheme, ListItem, Typography } from '@mui/material';

import { TruncatedTypography } from '../typography';
import { withRequiredAsterisk } from './required-label';

// ----------------------------------------------------------------------

export type AutocompleteBaseProps = Omit<
  AutocompleteProps<any, boolean, boolean, boolean>,
  'renderInput' | 'limitTags'
>;

export type RHFAutocompleteProps = AutocompleteBaseProps & {
  name: string;
  label?: string;
  placeholder?: string;
  helperText?: React.ReactNode;
  slotProps?: AutocompleteBaseProps['slotProps'] & { textfield?: TextFieldProps };
  keyOption?: Partial<{ label: string; value: string }>;
  required?: boolean;
  disabled?: boolean;
  tagsProps?: Partial<{
    limitTags: number;
    tagsType: 'CHIP' | 'TEXT';
  }>;
  optionProps?: Partial<{
    showAllOption: boolean;
    allLabel: string;
    allValue: string;
    renderText: ({ option }: { option: Record<string, any> }) => ReactNode;
  }>;
};

// ----------------------------------------------------------------------

export function RHFAutocomplete({
  name,
  label,
  slotProps,
  helperText,
  placeholder,
  required,
  disabled,
  keyOption: externalKeyOption,
  tagsProps: externalTagsProps,
  optionProps: externalOptionProps,
  options,
  onChange,
  ...other
}: RHFAutocompleteProps) {
  const theme = useTheme();
  const { control, setValue, watch } = useFormContext();

  // ----------------------------------------------------------------------

  const OPTION_ENUM = {
    ALL: 'ALL',
  } as const;

  const { textfield, ...otherSlotProps } = slotProps ?? {};

  const keyOption = { label: 'name', value: 'id', ...externalKeyOption };

  const tagsProps = {
    limitTags: 3,
    tagsType: 'CHIP',
    ...externalTagsProps,
  };

  const optionProps = {
    showAllOption: false,
    allLabel: 'All',
    allValue: OPTION_ENUM.ALL,
    ...externalOptionProps,
  };

  const isSelectedAll = other.multiple && (watch(name) ?? []).length === options.length;

  const modifiedOptions = optionProps.showAllOption
    ? [
        {
          [keyOption.label]: optionProps.allLabel,
          [keyOption.value]: optionProps.allValue,
        },
        ...options,
      ]
    : options;

  // ----------------------------------------------------------------------

  const handleChange: RHFAutocompleteProps['onChange'] = (event, value) => {
    const updateValue = (newValue: object) => {
      if (onChange) {
        onChange(event, newValue, 'selectOption');
      } else {
        setValue(name, newValue, { shouldValidate: true });
      }
    };

    if (other.multiple) {
      const values = value as Array<any>;

      const isAllSelected = values.some(
        (option) => option[keyOption.value] === optionProps.allValue
      );

      if (isAllSelected && isSelectedAll) {
        updateValue([]);
        return;
      }

      const newOptions = isAllSelected ? options : values;

      updateValue(newOptions.map((option) => option[keyOption.value]));
    } else {
      updateValue(value ?? null);
    }
  };

  // ----------------------------------------------------------------------

  const renderAllLabel = () => (
    <TruncatedTypography variant="subtitle1">{optionProps.allLabel}</TruncatedTypography>
  );

  const renderStartAdornment = (params: AutocompleteRenderInputParams) => (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      {(textfield?.slotProps?.input as { startAdornment: JSX.Element })?.startAdornment}
      <Stack direction="row" flexWrap="wrap" spacing={0.5}>
        {optionProps.showAllOption && (watch(name) ?? []).length === 0 && renderAllLabel()}
        {params.InputProps.startAdornment}
      </Stack>
    </Stack>
  );

  const renderTags: AutocompleteBaseProps['renderTags'] = (selected, getTagProps) => {
    if (optionProps.showAllOption && isSelectedAll) {
      return renderAllLabel();
    }

    switch (tagsProps.tagsType) {
      case 'CHIP':
        return (
          <>
            {selected.map((option, index) => (
              <Chip
                {...getTagProps({ index })}
                key={option[keyOption.value]}
                label={option[keyOption.label]}
                size="small"
                color="default"
                variant="soft"
              />
            ))}
          </>
        );
      case 'TEXT': {
        const visibleTags = selected.slice(0, tagsProps.limitTags);
        const remainingCount = selected.length - visibleTags.length;
        const tagText = visibleTags.map((option) => option[keyOption.label]).join(', ');
        const displayText = remainingCount > 0 ? `${tagText}... +${remainingCount}` : tagText;

        return <Typography variant="subtitle1">{displayText}</Typography>;
      }

      default:
        return null;
    }
  };

  const renderOption: AutocompleteBaseProps['renderOption'] = (props, option, { selected }) => {
    const value = option[keyOption.value];

    return (
      <ListItem {...props} key={value}>
        <Stack direction="row" alignItems="center" spacing={2}>
          {/* {other.multiple && (
            <Checkbox checked={selected || isSelectedAll} style={{ marginRight: 8 }} />
          )} */}
          {optionProps.renderText ? optionProps.renderText({ option }) : option[keyOption.label]}
        </Stack>
      </ListItem>
    );
  };

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => {
        const selectedOption = other.multiple
          ? modifiedOptions.filter((option) => field.value?.includes(option[keyOption.value]))
          : modifiedOptions.find(
              (option) => option[keyOption.value] === field.value?.[keyOption.value]
            );

        return (
          <Autocomplete
            {...field}
            disabled={disabled}
            disableCloseOnSelect={other.multiple}
            value={selectedOption ?? null}
            id={`rhf-autocomplete-${name}`}
            options={modifiedOptions}
            onChange={handleChange}
            renderInput={(params) => (
              <TextField
                {...params}
                {...textfield}
                placeholder={placeholder}
                label={
                  <Stack direction="row" spacing={0.75}>
                    <Box>{withRequiredAsterisk(label)}</Box>
                    {required && (
                      <Box
                        sx={{
                          fontSize: theme.typography.subtitle1,
                          fontWeight: 400,
                          color: theme.palette.error.main,
                        }}
                      >
                        *
                      </Box>
                    )}
                  </Stack>
                }
                InputLabelProps={{
                  shrink:
                    (other.multiple ? Boolean(field.value?.length) : Boolean(field.value)) ||
                    Boolean(params.inputProps?.value),
                }}
                error={!!error}
                helperText={error ? error?.message : helperText}
                sx={{
                  '& .MuiInputBase-root': {
                    backgroundColor: disabled
                      ? theme.palette.grey[100]
                      : theme.palette.common.white,
                  },
                  '& .MuiFormLabel-asterisk': {
                    color: theme.palette.error.main,
                  },
                  '& .MuiFormHelperText-root.Mui-error': {
                    display: helperText ? 'block' : 'none',
                  },
                }}
                slotProps={{
                  ...textfield?.slotProps,
                  input: {
                    ...params.InputProps,
                    ...textfield?.slotProps?.input,
                    startAdornment: renderStartAdornment(params),
                  },
                  htmlInput: {
                    ...params.inputProps,
                    autoComplete: 'new-password',
                    ...textfield?.slotProps?.htmlInput,
                  },
                }}
              />
            )}
            isOptionEqualToValue={(option, value) =>
              option?.[keyOption.value] === value[keyOption.value]
            }
            getOptionLabel={(option) => option[keyOption.label]}
            renderOption={renderOption}
            renderTags={renderTags}
            {...other}
            {...otherSlotProps}
          />
        );
      }}
    />
  );
}
