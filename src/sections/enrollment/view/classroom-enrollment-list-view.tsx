'use client';

import { EnrollmentListView } from './enrollment-list-view';

// ----------------------------------------------------------------------

type Props = {
  classroomId: string;
};

export function ClassroomEnrollmentListView({ classroomId }: Props) {
  return <EnrollmentListView initialClassroomId={classroomId} classroomMode />;
}
