import type { NavMainProps } from './main/nav/types';

import { paths } from 'src/routes/paths';

import {
  RiTaskLine,
  RiBookOpenLine,
  RiCheckboxCircleLine,
  RiCalendarScheduleLine,
} from 'src/components/remix-icon';

// ----------------------------------------------------------------------

/** Student navigation for the student-only home experience. */
export const studentNavData: NavMainProps['data'] = [
  {
    title: 'วิชาเรียน',
    path: paths.student.subjects,
    icon: <RiBookOpenLine size={22} />,
    featureKey: 'student.subjects',
  },
  {
    title: 'ตารางเรียน',
    path: paths.student.timetable,
    icon: <RiCalendarScheduleLine size={22} />,
    featureKey: 'student.subjects',
  },
  {
    title: 'งานที่ต้องส่ง',
    path: paths.student.assignments,
    icon: <RiTaskLine size={22} />,
    featureKey: 'student.assignments',
  },
  {
    title: 'การเข้าเรียน',
    path: paths.student.attendance,
    icon: <RiCheckboxCircleLine size={22} />,
    featureKey: 'student.attendance',
  },
];
