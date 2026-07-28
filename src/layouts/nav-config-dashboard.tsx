import type { NavSectionProps } from 'src/components/nav-section';

import { paths } from 'src/routes/paths';

import {
  RiTeamLine,
  RiBook2Line,
  RiPulseLine,
  RiIdCardLine,
  RiSchoolLine,
  RiStairsLine,
  RiUserAddLine,
  RiCalendarLine,
  RiUserStarLine,
  RiMessage2Line,
  RiFileChartLine,
  RiFileList3Line,
  RiMegaphoneLine,
  RiDashboardLine,
  RiSettings3Line,
  RiFileSearchLine,
  RiFileHistoryLine,
  RiShieldCheckLine,
  RiPresentationLine,
  RiCalendarCloseLine,
  RiCalendarCheckLine,
  RiGraduationCapLine,
  RiOrganizationChart,
  RiCalendarScheduleLine,
} from 'src/components/remix-icon';

// ----------------------------------------------------------------------

const ICONS = {
  dashboard: <RiDashboardLine />,
  school: <RiSchoolLine />,
  academicYear: <RiCalendarLine />,
  classroom: <RiPresentationLine />,
  subject: <RiBook2Line />,
  staff: <RiTeamLine />,
  student: <RiGraduationCapLine />,
  teacherAssignment: <RiUserStarLine />,
  enrollment: <RiUserAddLine />,
  lineNotifications: <RiMessage2Line />,
  announcements: <RiMegaphoneLine />,
  schoolHolidays: <RiCalendarCloseLine />,
  department: <RiOrganizationChart />,
  scheduleBuilder: <RiCalendarScheduleLine />,
  scheduleSubmissions: <RiFileHistoryLine />,
  scheduleApprovals: <RiCalendarCheckLine />,
  gradeReviews: <RiFileSearchLine />,
  gradeResults: <RiFileChartLine />,
  documents: <RiFileList3Line />,
  accessPermissions: <RiShieldCheckLine />,
  masterData: <RiSettings3Line />,
  staffTypes: <RiTeamLine />,
  positions: <RiIdCardLine />,
  academicRanks: <RiUserStarLine />,
  employmentStatuses: <RiPulseLine />,
  learningAreas: <RiBook2Line />,
  subjectTypes: <RiFileList3Line />,
  educationStages: <RiStairsLine />,
};

// ----------------------------------------------------------------------

/**
 * School admin navigation — manages everything within their own school.
 */
export const navData: NavSectionProps['data'] = [
  {
    subheader: 'ภาพรวม',
    items: [
      {
        title: 'หน้าหลัก',
        path: paths.admin.root,
        icon: ICONS.dashboard,
        requiresDepartmentPermission: 'dashboard.view',
      },
      {
        title: 'ประกาศ',
        path: paths.admin.announcements,
        icon: ICONS.announcements,
        requiresDepartmentPermission: 'announcements.manage',
      },
      {
        title: 'แจ้งเตือน LINE',
        path: paths.admin.lineNotifications,
        icon: ICONS.lineNotifications,
        featureKey: 'admin.line_notifications',
      },
      {
        title: 'วันหยุดโรงเรียน',
        path: paths.admin.schoolHolidays,
        icon: ICONS.schoolHolidays,
        requiresDepartmentPermission: 'announcements.manage',
      },
      {
        title: 'ข้อมูลโรงเรียน',
        path: paths.admin.school,
        icon: ICONS.school,
        featureKey: 'admin.school_profile',
        requiresDepartmentPermission: 'school_profile.view',
      },
    ],
  },
  {
    subheader: 'โครงสร้างการเรียน',
    items: [
      {
        title: 'ปีการศึกษา',
        path: paths.admin.academicYear.root,
        icon: ICONS.academicYear,
        featureKey: 'admin.academic_years',
        requiresDepartmentPermission: 'academic_years.manage',
      },
      {
        title: 'ห้องเรียน',
        path: paths.admin.classroom.root,
        icon: ICONS.classroom,
        featureKey: 'admin.classrooms',
        requiresDepartmentPermission: 'classrooms.manage',
      },
      {
        title: 'วิชาและหลักสูตร',
        path: paths.admin.subject.root,
        icon: ICONS.subject,
        featureKey: 'admin.subjects',
        requiresDepartmentPermission: 'subjects.manage',
      },
      {
        title: 'ลงทะเบียนนักเรียน',
        path: paths.admin.enrollment.root,
        icon: ICONS.enrollment,
        featureKey: 'admin.enrollments',
        requiresDepartmentPermission: 'enrollments.manage',
      },
    ],
  },
  {
    subheader: 'ตารางสอน',
    items: [
      {
        title: 'ครูประจำวิชา',
        path: paths.admin.teacherAssignment.root,
        icon: ICONS.teacherAssignment,
        featureKey: 'admin.teacher_assignments',
        requiresDepartmentPermission: 'schedule.manage',
      },
      {
        title: 'จัดตารางสอน',
        path: paths.admin.scheduleBuilder,
        icon: ICONS.scheduleBuilder,
        featureKey: 'academic.schedule_workflow',
        requiresDepartmentPermission: 'schedule.manage',
      },
      {
        title: 'สถานะการลงนามตารางสอน',
        path: paths.admin.scheduleSubmissions,
        icon: ICONS.scheduleSubmissions,
        featureKey: 'academic.schedule_workflow',
        requiresDepartmentPermission: 'schedule.manage',
      },
      {
        title: 'อนุมัติตารางสอน',
        path: paths.admin.scheduleApprovals,
        icon: ICONS.scheduleApprovals,
        featureKey: 'academic.schedule_workflow',
        requiresSchoolDirector: true,
      },
    ],
  },
  {
    subheader: 'ผลการเรียน',
    items: [
      {
        title: 'ตรวจสอบผลการเรียน',
        path: paths.admin.gradeReviews,
        icon: ICONS.gradeReviews,
        featureKey: 'academic.grade_workflow',
        requiresDepartmentPermission: 'grades.approve',
      },
      {
        title: 'ผลการเรียน',
        path: paths.admin.gradeResults,
        icon: ICONS.gradeResults,
        featureKey: 'academic.grade_workflow',
        requiresDepartmentPermission: 'grades.review',
      },
    ],
  },
  {
    subheader: 'เอกสาร',
    items: [
      {
        title: 'เอกสาร',
        path: paths.admin.documents.root,
        icon: ICONS.documents,
        featureKey: 'academic.documents',
        requiresDepartmentPermission: 'documents.access',
        children: [
          {
            title: 'เอกสารของฉัน',
            path: paths.admin.documents.my,
            icon: ICONS.documents,
          },
          {
            title: 'ตัวอย่างเอกสาร',
            path: paths.admin.documents.templates,
            icon: ICONS.gradeReviews,
          },
        ],
      },
    ],
  },
  {
    subheader: 'บุคลากรและนักเรียน',
    items: [
      {
        title: 'ครู/บุคลากร',
        path: paths.admin.user.root,
        icon: ICONS.staff,
        featureKey: 'admin.staff',
        requiresDepartmentPermission: 'staff.manage',
      },
      {
        title: 'นักเรียน',
        path: paths.admin.student.root,
        icon: ICONS.student,
        featureKey: 'admin.students',
        requiresDepartmentPermission: 'students.manage',
        children: [
          {
            title: 'นำเข้าข้อมูล',
            path: paths.admin.student.importData,
            icon: ICONS.enrollment,
          },
          {
            title: 'ข้อมูลนักเรียน',
            path: paths.admin.student.list,
            icon: ICONS.documents,
          },
        ],
      },

      {
        title: 'จัดการฝ่าย',
        path: paths.admin.department.root,
        icon: ICONS.department,
        deepMatch: true,
        featureKey: 'admin.departments',
      },
      {
        title: 'สิทธิ์การใช้งาน',
        path: paths.admin.accessPermissions,
        icon: ICONS.accessPermissions,
        featureKey: 'admin.access_permissions',
      },
      {
        title: 'ข้อมูลหลัก',
        path: '#',
        icon: ICONS.masterData,
        children: [
          {
            title: 'ประเภทบุคลากร',
            path: paths.admin.masterData.staffTypes,
            icon: ICONS.staffTypes,
            featureKey: 'admin.staff_masters',
          },
          {
            title: 'คำนำหน้าชื่อ',
            path: paths.admin.masterData.prefixes,
            icon: ICONS.positions,
            featureKey: 'admin.staff_masters',
          },
          {
            title: 'ตำแหน่ง',
            path: paths.admin.masterData.positions,
            icon: ICONS.positions,
            featureKey: 'admin.staff_masters',
          },
          {
            title: 'วิทยฐานะ',
            path: paths.admin.masterData.academicRanks,
            icon: ICONS.academicRanks,
            featureKey: 'admin.staff_masters',
          },
          {
            title: 'สถานะปฏิบัติงาน',
            path: paths.admin.masterData.employmentStatuses,
            icon: ICONS.employmentStatuses,
            featureKey: 'admin.staff_masters',
          },
          {
            title: 'กลุ่มสาระการเรียนรู้',
            path: paths.admin.masterData.learningAreas,
            icon: ICONS.learningAreas,
            featureKey: 'admin.subjects',
            requiresDepartmentPermission: 'subjects.manage',
          },
          {
            title: 'ประเภทรายวิชา',
            path: paths.admin.masterData.subjectTypes,
            icon: ICONS.subjectTypes,
            featureKey: 'admin.subjects',
            requiresDepartmentPermission: 'subjects.manage',
          },
          {
            title: 'ช่วงชั้น',
            path: paths.admin.masterData.educationStages,
            icon: ICONS.educationStages,
            featureKey: 'admin.subjects',
            requiresDepartmentPermission: 'subjects.manage',
          },
        ],
      },
    ],
  },
];
