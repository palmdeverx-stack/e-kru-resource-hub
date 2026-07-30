import {
  deletePopupAnnouncement,
  updatePopupAnnouncement,
} from 'src/sections/marketplace/admin/server/popup-announcements';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  return updatePopupAnnouncement(request, (await params).id);
}

export async function DELETE(request: Request, { params }: Context) {
  return deletePopupAnnouncement(request, (await params).id);
}

