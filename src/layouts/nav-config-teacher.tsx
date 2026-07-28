import type { NavSectionProps } from 'src/components/nav-section';

import { paths } from 'src/routes/paths';

import {
  RiTeamLine,
  RiBook2Line,
  RiGroupLine,
  RiSchoolLine,
  RiQrScan2Line,
  RiUserAddLine,
  RiCalendarLine,
  RiBookOpenLine,
  RiFileChartLine,
  RiFileList3Line,
  RiDashboardLine,
  RiMegaphoneLine,
  RiFileSearchLine,
  RiFileHistoryLine,
  RiPresentationLine,
  RiCalendarCheckLine,
  RiOrganizationChart,
  RiGraduationCapLine,
  RiCalendarScheduleLine,
} from 'src/components/remix-icon';

// ----------------------------------------------------------------------

const ICONS = {
  dashboard: <RiDashboardLine />,
  school: <RiSchoolLine />,
  assignments: <RiBookOpenLine />,
  students: <RiGroupLine />,
  attendance: <RiQrScan2Line />,
  timetable: <RiCalendarScheduleLine />,
  announcements: <RiMegaphoneLine />,
  subject: <RiBook2Line />,
  classroom: <RiPresentationLine />,
  studentAdd: <RiUserAddLine />,
  department: <RiTeamLine />,
  scheduleBuilder: <RiOrganizationChart />,
  academicYear: <RiCalendarLine />,
  allStudents: <RiGraduationCapLine />,
  scheduleSubmissions: <RiFileHistoryLine />,
  scheduleApprovals: <RiCalendarCheckLine />,
  gradeReviews: <RiFileSearchLine />,
  gradeResults: <RiFileChartLine />,
  documents: <RiFileList3Line />,
};

// ----------------------------------------------------------------------

/**
 * Teacher navigation — scoped to the subjects/classrooms they're assigned to.
 */
export const navData: NavSectionProps['data'] = [
  {
    subheader: 'ภาพรวม',
    items: [
      {
        title: 'หน้าหลัก',
        path: paths.teacher.root,
        icon: ICONS.dashboard,
        requiresDepartmentPermission: 'dashboard.view',
      },
      {
        title: 'ข้อมูลโรงเรียน',
        path: paths.teacher.school,
        icon: ICONS.school,
      },
      {
        title: 'รายวิชา',
        path: paths.teacher.assignments,
        icon: ICONS.assignments,
        deepMatch: true,
        featureKey: 'teacher.assignments',
        requiresDepartmentPermission: 'teaching.assignments',
      },
      {
        title: 'นักเรียนของฉัน',
        path: paths.teacher.students,
        icon: ICONS.students,
        deepMatch: true,
        featureKey: 'teacher.students',
        requiresDepartmentPermission: 'teaching.students',
      },
      {
        title: 'สแกนเช็คชื่อ',
        path: paths.teacher.attendanceScan,
        icon: ICONS.attendance,
        deepMatch: true,
        featureKey: 'teacher.qr_attendance',
        requiresDepartmentPermission: 'teaching.attendance',
      },
      {
        title: 'ตารางสอน',
        path: paths.teacher.timetable,
        icon: ICONS.timetable,
        featureKey: 'teacher.timetable',
        requiresDepartmentPermission: 'teaching.timetable',
      },
      {
        title: 'ประกาศ',
        path: paths.teacher.announcements,
        icon: ICONS.announcements,
        featureKey: 'teacher.announcements',
        requiresDepartmentPermission: 'teaching.announcements',
      },
      {
        title: 'งานฝ่าย',
        path: '#',
        icon: ICONS.department,
        children: [
          {
            title: 'งานฝ่ายของฉัน',
            path: paths.teacher.department,
            icon: ICONS.department,
            requiresDepartment: true,
          },
          {
            title: 'จัดตารางสอน',
            path: paths.teacher.scheduleBuilder,
            icon: ICONS.scheduleBuilder,
            featureKey: 'academic.schedule_workflow',
            requiresDepartmentPermission: 'schedule.manage',
          },
          {
            title: 'สถานะการลงนามตารางสอน',
            path: paths.teacher.scheduleSubmissions,
            icon: ICONS.scheduleSubmissions,
            featureKey: 'academic.schedule_workflow',
            requiresDepartmentPermission: 'schedule.manage',
          },
          {
            title: 'อนุมัติตารางสอน',
            path: paths.teacher.scheduleApprovals,
            icon: ICONS.scheduleApprovals,
            featureKey: 'academic.schedule_workflow',
            requiresDepartmentPermission: 'schedule.approve',
          },
          {
            title: 'ตรวจสอบผลการเรียน',
            path: paths.teacher.gradeReviews,
            icon: ICONS.gradeReviews,
            featureKey: 'academic.grade_workflow',
            requiresDepartmentPermission: 'grades.approve',
          },
          {
            title: 'ผลการเรียน',
            path: paths.teacher.gradeResults,
            icon: ICONS.gradeResults,
            featureKey: 'academic.grade_workflow',
            requiresDepartmentPermission: 'grades.review',
          },
          {
            title: 'ปีการศึกษา',
            path: paths.teacher.departmentAcademicYear.root,
            icon: ICONS.academicYear,
            requiresDepartmentPermission: 'academic_years.manage',
          },
          {
            title: 'ห้องเรียน',
            path: paths.teacher.departmentClassroom,
            icon: ICONS.classroom,
            requiresDepartmentPermission: 'classrooms.manage',
          },
          {
            title: 'วิชาและหลักสูตร',
            path: paths.teacher.departmentSubject,
            icon: ICONS.subject,
            requiresDepartmentPermission: 'subjects.manage',
          },
          {
            title: 'ลงทะเบียนนักเรียน',
            path: paths.teacher.departmentEnrollment.root,
            icon: ICONS.studentAdd,
            requiresDepartmentPermission: 'enrollments.manage',
          },
          {
            title: 'ประกาศทั้งโรงเรียน',
            path: paths.teacher.departmentAnnouncements,
            icon: ICONS.announcements,
            requiresDepartmentPermission: 'announcements.manage',
          },
          {
            title: 'นักเรียนทั้งหมด',
            path: paths.teacher.departmentStudent,
            icon: ICONS.allStudents,
            requiresDepartmentPermission: 'students.manage',
          },
          {
            title: 'ครู/บุคลากร',
            path: paths.teacher.departmentStaff.root,
            icon: ICONS.department,
            requiresDepartmentPermission: 'staff.manage',
          },
        ],
      },
      {
        title: 'เอกสาร',
        path: paths.teacher.documents.root,
        icon: ICONS.documents,
        featureKey: 'academic.documents',
        requiresDepartmentPermission: 'documents.access',
        children: [
          {
            title: 'เอกสารของฉัน',
            path: paths.teacher.documents.my,
            icon: ICONS.documents,
          },
          {
            title: 'ตัวอย่างเอกสาร',
            path: paths.teacher.documents.templates,
            icon: ICONS.gradeReviews,
          },
        ],
      },
    ],
  },
];
