import net from 'node:net';

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.');
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: clamavSettings } = await supabase
  .from('marketplace_provider_settings')
  .select('clamav_host,clamav_port')
  .eq('id', 'default')
  .maybeSingle();
const storedClamavHost = String(clamavSettings?.clamav_host || '').trim();
const clamavHost = storedClamavHost || String(process.env.CLAMAV_HOST || '').trim();
const clamavPort = Number(
  storedClamavHost ? (clamavSettings?.clamav_port ?? 3310) : (process.env.CLAMAV_PORT || 3310)
);

if (!clamavHost) {
  throw new Error('Set CLAMAV_HOST in Platform Settings or the environment first.');
}
if (!Number.isInteger(clamavPort) || clamavPort < 1 || clamavPort > 65_535) {
  throw new Error('CLAMAV_PORT must be an integer between 1 and 65535.');
}

function scan(buffer) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: clamavHost, port: clamavPort });
    const responses = [];
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(error);
    };
    socket.setTimeout(30_000, () => fail(new Error('ClamAV timeout')));
    socket.on('error', fail);
    socket.on('data', (chunk) => responses.push(Buffer.from(chunk)));
    socket.on('connect', () => {
      socket.write('zINSTREAM\0');
      for (let offset = 0; offset < buffer.length; offset += 64 * 1024) {
        const chunk = buffer.subarray(offset, Math.min(offset + 64 * 1024, buffer.length));
        const size = Buffer.allocUnsafe(4);
        size.writeUInt32BE(chunk.length);
        socket.write(size);
        socket.write(chunk);
      }
      socket.end(Buffer.alloc(4));
    });
    socket.on('close', () => {
      if (settled) return;
      settled = true;
      const detail = Buffer.concat(responses).toString('utf8').replace(/\0/g, '').trim();
      if (detail.endsWith('OK')) resolve({ status: 'safe', detail });
      else if (detail.includes('FOUND')) resolve({ status: 'rejected', detail });
      else reject(new Error(detail || 'ClamAV returned no result'));
    });
  });
}

let safeCount = 0;
let rejectedCount = 0;

while (true) {
  const { data: files, error } = await supabase
    .from('marketplace_product_files')
    .select('id,product_id,storage_bucket,storage_path,file_name')
    .eq('scan_status', 'pending_scan')
    .order('created_at')
    .limit(100);
  if (error) throw error;
  if (!files?.length) break;

  for (const file of files) {
    const { data: blob, error: downloadError } = await supabase.storage
      .from(file.storage_bucket)
      .download(file.storage_path);
    if (downloadError || !blob) throw downloadError || new Error(`Cannot read file ${file.id}`);
    const result = await scan(Buffer.from(await blob.arrayBuffer()));
    const { error: updateError } = await supabase
      .from('marketplace_product_files')
      .update({
        scan_status: result.status,
        scan_engine: 'clamav',
        scan_result: result.detail.slice(0, 1000),
        scanned_at: new Date().toISOString(),
      })
      .eq('id', file.id)
      .eq('scan_status', 'pending_scan');
    if (updateError) throw updateError;

    if (result.status === 'rejected') {
      const { error: suspendError } = await supabase
        .from('marketplace_products')
        .update({
          status: 'archived',
          rejection_reason: `ระบบระงับสินค้าอัตโนมัติ เนื่องจากตรวจพบ Malware ในไฟล์ "${file.file_name}" (${result.detail})`.slice(
            0,
            1000
          ),
          updated_at: new Date().toISOString(),
        })
        .eq('id', file.product_id)
        .in('status', ['draft', 'pending_review', 'published']);
      if (suspendError) throw suspendError;

      const { error: removeError } = await supabase.storage
        .from(file.storage_bucket)
        .remove([file.storage_path]);
      if (removeError) throw removeError;
      rejectedCount += 1;
    } else {
      safeCount += 1;
    }
  }
}

console.log(`Scan complete: ${safeCount} safe, ${rejectedCount} rejected.`);
