'use client';

import type { NavMainProps } from 'src/layouts/main/nav/types';
import type { SchoolFeatureKey } from 'src/lib/school-subscription-config';
import type { NavSectionProps, NavItemDataProps } from 'src/components/nav-section';

import { useQuery } from '@tanstack/react-query';

import { getSchoolSubscriptionAccess } from './school-subscription-actions';

// ----------------------------------------------------------------------

export function useSchoolSubscription(schoolId?: string | null) {
  return useQuery({
    queryKey: ['school-subscription-access', schoolId],
    queryFn: () => getSchoolSubscriptionAccess(schoolId!),
    enabled: !!schoolId,
    staleTime: 60_000,
  });
}

export function filterDashboardNav(
  data: NavSectionProps['data'],
  enabledFeatures: SchoolFeatureKey[]
): NavSectionProps['data'] {
  const enabled = new Set(enabledFeatures);

  const filterItems = (items: NavItemDataProps[]): NavItemDataProps[] =>
    items.flatMap((item) => {
      if (item.featureKey && !enabled.has(item.featureKey as SchoolFeatureKey)) return [];

      if (!item.children) return [item];

      const children = filterItems(item.children);
      return children.length ? [{ ...item, children }] : [];
    });

  return data
    .map((group) => ({
      ...group,
      items: filterItems(group.items),
    }))
    .filter((group) => group.items.length > 0);
}

export function filterMainNav(
  data: NavMainProps['data'],
  enabledFeatures: SchoolFeatureKey[]
): NavMainProps['data'] {
  const enabled = new Set(enabledFeatures);
  return data.filter(
    (item) => !item.featureKey || enabled.has(item.featureKey as SchoolFeatureKey)
  );
}

const ROUTE_FEATURES: Record<
  'school_admin' | 'teacher' | 'student',
  Array<[string, SchoolFeatureKey]>
> = {
  school_admin: [
    ['/admin/line-notifications', 'admin.line_notifications'],
    ['/admin/master-data/staff-types', 'admin.staff_masters'],
    ['/admin/master-data/prefixes', 'admin.staff_masters'],
    ['/admin/master-data/positions', 'admin.staff_masters'],
    ['/admin/master-data/academic-ranks', 'admin.staff_masters'],
    ['/admin/master-data/employment-statuses', 'admin.staff_masters'],
    ['/admin/master-data/learning-areas', 'admin.subjects'],
    ['/admin/master-data/subject-types', 'admin.subjects'],
    ['/admin/access-permissions', 'admin.access_permissions'],
    ['/admin/department-permissions', 'admin.access_permissions'],
    ['/admin/department', 'admin.departments'],
    ['/admin/schedule-submissions', 'academic.schedule_workflow'],
    ['/admin/schedule-approvals', 'academic.schedule_workflow'],
    ['/admin/schedule-builder', 'academic.schedule_workflow'],
    ['/admin/grade-results', 'academic.grade_workflow'],
    ['/admin/grade-reviews', 'academic.grade_workflow'],
    ['/admin/documents', 'academic.documents'],
    ['/admin/teacher-assignment', 'admin.teacher_assignments'],
    ['/admin/academic-year', 'admin.academic_years'],
    ['/admin/enrollment', 'admin.enrollments'],
    ['/admin/classroom', 'admin.classrooms'],
    ['/admin/subject', 'admin.subjects'],
    ['/admin/student', 'admin.students'],
    ['/admin/user', 'admin.staff'],
    ['/admin/school', 'admin.school_profile'],
    ['/admin/announcements', 'admin.announcements'],
    ['/admin/gradebook', 'admin.teacher_assignments'],
  ],
  teacher: [
    ['/teacher/schedule-submissions', 'academic.schedule_workflow'],
    ['/teacher/schedule-approvals', 'academic.schedule_workflow'],
    ['/teacher/schedule-builder', 'academic.schedule_workflow'],
    ['/teacher/grade-results', 'academic.grade_workflow'],
    ['/teacher/grade-reviews', 'academic.grade_workflow'],
    ['/teacher/documents', 'academic.documents'],
    ['/teacher/attendance-scan', 'teacher.qr_attendance'],
    ['/teacher/subject', 'teacher.manage_subjects'],
    ['/teacher/enrollment', 'teacher.manage_enrollments'],
    ['/teacher/classroom', 'teacher.manage_classrooms'],
    ['/teacher/announcements', 'teacher.announcements'],
    ['/teacher/assignments', 'teacher.assignments'],
    ['/teacher/gradebook', 'teacher.assignments'],
    ['/teacher/students', 'teacher.students'],
    ['/teacher/timetable', 'teacher.timetable'],
  ],
  student: [
    ['/student/assignments', 'student.assignments'],
    ['/student/attendance', 'student.attendance'],
    ['/student/timetable', 'student.subjects'],
    ['/student/subjects', 'student.subjects'],
    ['/student/classroom', 'student.subjects'],
    ['/student/qr', 'student.qr'],
  ],
};

export function requiredFeatureForPath(
  role: 'school_admin' | 'teacher' | 'student',
  pathname: string
) {
  return ROUTE_FEATURES[role].find(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )?.[1];
}
