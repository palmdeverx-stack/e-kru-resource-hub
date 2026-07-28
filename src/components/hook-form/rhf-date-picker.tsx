import type { Dayjs } from 'dayjs';
import type { TimePickerProps } from '@mui/x-date-pickers/TimePicker';
import type { DatePickerProps } from '@mui/x-date-pickers/DatePicker';
import type { DateTimePickerProps } from '@mui/x-date-pickers/DateTimePicker';
import type { PickersTextFieldProps } from '@mui/x-date-pickers/PickersTextField';

import dayjs from 'dayjs';
import { RiCalendarLine } from '@remixicon/react';
import { Controller, useFormContext } from 'react-hook-form';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';

import { withRequiredAsterisk } from './required-label';

// ----------------------------------------------------------------------

// MUI X passes slot components internal props like `ownerState` that a plain
// icon component doesn't know to drop, so it leaks onto the DOM <svg> as an
// unrecognized attribute. Strip it before forwarding to the icon.
function DatePickerOpenIcon({
  ownerState: _ownerState,
  ...props
}: React.ComponentProps<typeof RiCalendarLine> & { ownerState?: unknown }) {
  return <RiCalendarLine {...props} />;
}

type DateInput = Dayjs | Date | string | number | null | undefined;

function normalizeDateValue(value: DateInput): Dayjs | null {
  if (dayjs.isDayjs(value)) return value;

  const parsed = value ? dayjs(value) : null;
  return parsed?.isValid() ? parsed : null;
}

// ----------------------------------------------------------------------

type PickerProps<T extends DatePickerProps | TimePickerProps | DateTimePickerProps> = T & {
  name: string;
  required?: boolean;
  slotProps?: T['slotProps'] & {
    textField?: Partial<PickersTextFieldProps>;
  };
};

export function RHFDatePicker({
  name,
  label,
  required,
  slots,
  slotProps,
  ...other
}: PickerProps<DatePickerProps>) {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <DatePicker
          {...field}
          label={withRequiredAsterisk(label)}
          value={normalizeDateValue(field.value)}
          onChange={(newValue) => {
            if (!newValue) {
              field.onChange(null);
              return;
            }

            const parsedValue = dayjs(newValue);
            field.onChange(parsedValue.isValid() ? parsedValue.format() : newValue);
          }}
          slotProps={{
            ...slotProps,
            textField: {
              ...slotProps?.textField,
              required,
              error: !!error,
              helperText: error?.message ?? slotProps?.textField?.helperText,
            },
          }}
          slots={{ openPickerIcon: DatePickerOpenIcon, ...slots }}
          {...other}
        />
      )}
    />
  );
}

// ----------------------------------------------------------------------

export function RHFTimePicker({
  name,
  label,
  required,
  slotProps,
  ...other
}: PickerProps<TimePickerProps>) {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <TimePicker
          {...field}
          label={withRequiredAsterisk(label)}
          value={normalizeDateValue(field.value)}
          onChange={(newValue) => {
            if (!newValue) {
              field.onChange(null);
              return;
            }

            const parsedValue = dayjs(newValue);
            field.onChange(parsedValue.isValid() ? parsedValue.format() : newValue);
          }}
          slotProps={{
            ...slotProps,
            textField: {
              ...slotProps?.textField,
              required,
              error: !!error,
              helperText: error?.message ?? slotProps?.textField?.helperText,
            },
          }}
          {...other}
        />
      )}
    />
  );
}

// ----------------------------------------------------------------------

export function RHFDateTimePicker({
  name,
  label,
  required,
  slotProps,
  ...other
}: PickerProps<DateTimePickerProps>) {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <DateTimePicker
          {...field}
          label={withRequiredAsterisk(label)}
          value={normalizeDateValue(field.value)}
          onChange={(newValue) => {
            if (!newValue) {
              field.onChange(null);
              return;
            }

            const parsedValue = dayjs(newValue);
            field.onChange(parsedValue.isValid() ? parsedValue.format() : newValue);
          }}
          slotProps={{
            ...slotProps,
            textField: {
              ...slotProps?.textField,
              required,
              error: !!error,
              helperText: error?.message ?? slotProps?.textField?.helperText,
            },
          }}
          {...other}
        />
      )}
    />
  );
}
