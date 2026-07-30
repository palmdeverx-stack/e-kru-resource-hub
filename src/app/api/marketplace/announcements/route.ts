import {
  listPopupAnnouncements,
  createPopupAnnouncement,
} from 'src/sections/marketplace/admin/server/popup-announcements';

export const GET = (request: Request) => listPopupAnnouncements(request);
export const POST = (request: Request) => createPopupAnnouncement(request);

