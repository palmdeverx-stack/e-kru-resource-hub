import type { TeacherLineInvitation } from '../teacher-line-actions';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import CircularProgress from '@mui/material/CircularProgress';

import { RemixIcon } from 'src/components/remix-icon';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  invitation: TeacherLineInvitation | null;
  qrImage: string;
  connected: boolean;
  connectedDisplayName?: string | null;
  creatingInvitation: boolean;
  unlinking: boolean;
  errorMessage?: string;
  onClose: () => void;
  onUnlink: () => void;
};

export function TeacherLineDialog({
  open,
  invitation,
  qrImage,
  connected,
  connectedDisplayName,
  creatingInvitation,
  unlinking,
  errorMessage,
  onClose,
  onUnlink,
}: Props) {
  const downloadQr = () => {
    const anchor = document.createElement('a');
    anchor.href = qrImage;
    anchor.download = 'line-link-teacher.png';
    anchor.click();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{connected ? 'เชื่อม LINE สำเร็จ' : 'เชื่อมต่อ LINE'}</DialogTitle>
      <DialogContent>
        {creatingInvitation && (
          <Typography sx={{ py: 3, textAlign: 'center' }}>กำลังสร้างรหัส...</Typography>
        )}
        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
        {connected ? (
          <Box>
            <Alert severity="success">
              เชื่อม LINE{connectedDisplayName ? ` (${connectedDisplayName})` : ''} เรียบร้อยแล้ว
            </Alert>
            <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
              คุณจะได้รับการแจ้งเตือนจากโรงเรียนผ่าน LINE เช่น เตือนกำหนดส่งผลการเรียน
            </Typography>
          </Box>
        ) : (
          invitation && (
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                สแกน QR เปิดแชต LINE OA ของโรงเรียนแล้วกดส่งข้อความภายใน 24 ชั่วโมง
              </Typography>
              {invitation.lineChatUrl ? (
                <Box
                  sx={{
                    my: 2,
                    mx: 'auto',
                    p: 1,
                    width: 240,
                    height: 240,
                    display: 'grid',
                    borderRadius: 2,
                    placeItems: 'center',
                    bgcolor: 'common.white',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  {qrImage ? (
                    <Box
                      component="img"
                      src={qrImage}
                      alt="QR เชื่อม LINE"
                      sx={{ width: 1, height: 1 }}
                    />
                  ) : (
                    <CircularProgress color="success" />
                  )}
                </Box>
              ) : (
                <Alert severity="warning" sx={{ mt: 2, textAlign: 'left' }}>
                  โรงเรียนยังไม่ได้ตั้งค่า LINE OA Basic ID จึงยังสร้าง QR ไม่ได้
                </Alert>
              )}
              <Typography
                variant="h6"
                sx={{
                  my: 1.5,
                  p: 1.5,
                  borderRadius: 1.5,
                  letterSpacing: 2,
                  bgcolor: 'background.neutral',
                }}
              >
                {invitation.message}
              </Typography>
              <Box sx={{ gap: 1, display: 'flex', justifyContent: 'center' }}>
                {qrImage && (
                  <Button
                    color="success"
                    variant="contained"
                    startIcon={<RemixIcon icon="solar:download-bold" />}
                    onClick={downloadQr}
                  >
                    ดาวน์โหลด QR
                  </Button>
                )}
                {invitation.addFriendUrl && (
                  <Button
                    color="success"
                    variant="outlined"
                    onClick={() => window.open(invitation.addFriendUrl!, '_blank')}
                  >
                    เพิ่มเพื่อน LINE OA
                  </Button>
                )}
                <Button
                  variant="contained"
                  onClick={() => navigator.clipboard.writeText(invitation.message)}
                >
                  คัดลอกข้อความ
                </Button>
              </Box>
            </Box>
          )
        )}
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          ปิด
        </Button>
        {connected && (
          <Button color="error" variant="contained" loading={unlinking} onClick={onUnlink}>
            ยืนยันยกเลิก
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
