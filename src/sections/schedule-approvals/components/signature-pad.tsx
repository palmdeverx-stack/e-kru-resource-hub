'use client';

import { useRef, useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { RemixIcon } from 'src/components/remix-icon';

// ----------------------------------------------------------------------

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function SignaturePad({ value, onChange, disabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasStrokeRef = useRef(false);
  const [drawing, setDrawing] = useState(false);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
    };
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const canvas = canvasRef.current!;
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.strokeStyle = '#172B4D';
    context.lineWidth = 4;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    hasStrokeRef.current = false;
    setDrawing(true);
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing || disabled) return;
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;

    const point = pointFromEvent(event);
    context.lineTo(point.x, point.y);
    context.stroke();
    hasStrokeRef.current = true;
  };

  const finishDrawing = () => {
    if (!drawing || !canvasRef.current) return;
    setDrawing(false);
    if (hasStrokeRef.current) onChange(canvasRef.current.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    onChange('');
  };

  return (
    <Box>
      <Box
        sx={{
          p: 1,
          position: 'relative',
          borderRadius: 2,
          bgcolor: 'common.white',
          border: '1px dashed',
          borderColor: value ? 'success.main' : 'divider',
        }}
      >
        <canvas
          ref={canvasRef}
          width={1000}
          height={260}
          aria-label="พื้นที่สำหรับเซ็นลายเซ็น"
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={finishDrawing}
          onPointerCancel={finishDrawing}
          style={{
            width: '100%',
            height: 180,
            display: 'block',
            cursor: disabled ? 'default' : 'crosshair',
            touchAction: 'none',
          }}
        />
        {!value && (
          <Typography
            variant="body2"
            sx={{
              top: '50%',
              left: '50%',
              pointerEvents: 'none',
              position: 'absolute',
              color: 'text.disabled',
              transform: 'translate(-50%, -50%)',
            }}
          >
            เซ็นชื่อภายในกรอบ
          </Typography>
        )}
        <Box
          sx={{
            left: '12%',
            right: '12%',
            bottom: 35,
            height: 1,
            pointerEvents: 'none',
            position: 'absolute',
            bgcolor: 'divider',
          }}
        />
      </Box>
      <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          ใช้เมาส์ นิ้ว หรือปากกาสไตลัสในการเซ็น
        </Typography>
        <Button
          size="small"
          color="inherit"
          disabled={disabled || !value}
          startIcon={<RemixIcon icon="solar:restart-bold" />}
          onClick={clear}
        >
          ล้างลายเซ็น
        </Button>
      </Box>
    </Box>
  );
}
