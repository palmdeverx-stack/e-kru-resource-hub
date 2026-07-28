-- Demo data: end-to-end grade review flow and PP.5.
-- Run manually after all migrations. This file is idempotent and is intentionally
-- not a migration, so demo records are never inserted into production automatically.
--
-- Login:
--   School admin: demo2569_admin / Demo1234! / PIN 25690001
--   Teacher:      demo2569_teacher / Demo1234!
--
-- Result:
--   โรงเรียนสาธิตระบบผลการเรียน
--   ปีการศึกษา 2569 / ภาคเรียน 1 / ประถมศึกษาปีที่ 1 ห้อง [DEMO] 1/1
--   วิชา [DEMO] ภาษาไทยพื้นฐาน
--   Workflow history: submitted -> revision -> submitted -> reviewed -> approved -> locked

begin;

insert into public.schools (
  id,
  name,
  code,
  is_active
)
values (
  'de000000-0000-4000-8000-000000000001',
  'โรงเรียนสาธิตระบบผลการเรียน',
  '25690001',
  true
)
on conflict (id) do update
set
  name = excluded.name,
  code = excluded.code,
  is_active = true;

insert into public.school_subscriptions (
  school_id,
  plan_name,
  status,
  billing_cycle,
  price,
  starts_at,
  ends_at,
  max_school_admins,
  max_teachers,
  max_students,
  enabled_features,
  notes
)
values (
  'de000000-0000-4000-8000-000000000001',
  'Demo Full Flow',
  'active',
  'custom',
  0,
  current_date,
  current_date + 3650,
  5,
  100,
  1000,
  array[
    'admin.school_profile',
    'admin.academic_years',
    'admin.classrooms',
    'admin.subjects',
    'admin.staff',
    'admin.students',
    'admin.teacher_assignments',
    'admin.enrollments',
    'teacher.assignments',
    'teacher.students',
    'teacher.timetable',
    'teacher.announcements',
    'student.subjects',
    'student.assignments',
    'student.attendance'
  ]::text[],
  'ข้อมูลตัวอย่างสำหรับทดสอบ flow ผลการเรียนและ ปพ.5'
)
on conflict (school_id) do update
set
  plan_name = excluded.plan_name,
  status = 'active',
  ends_at = excluded.ends_at,
  max_school_admins = excluded.max_school_admins,
  max_teachers = excluded.max_teachers,
  max_students = excluded.max_students,
  enabled_features = excluded.enabled_features,
  notes = excluded.notes;

-- Password for every demo account: Demo1234!
insert into public.app_users (
  id,
  school_id,
  username,
  password_hash,
  email,
  first_name,
  last_name,
  role,
  is_active,
  must_change_password,
  accepted_legal_at
)
values (
  'de000000-0000-4000-8000-000000000010',
  'de000000-0000-4000-8000-000000000001',
  'demo2569_admin',
  '$2b$10$5ytkbmUiwTpPdkVhN.qHB.KvrgkkK0ohmFmeSgG9N.7SauFvErSU6',
  'demo2569_admin@example.test',
  'วิชาการ',
  'ตัวอย่าง',
  'school_admin',
  true,
  false,
  now()
)
on conflict (id) do update
set
  school_id = excluded.school_id,
  role = 'school_admin',
  password_hash = excluded.password_hash,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  is_active = true,
  must_change_password = false,
  accepted_legal_at = excluded.accepted_legal_at;

insert into public.app_users (
  id,
  school_id,
  username,
  password_hash,
  email,
  first_name,
  last_name,
  role,
  is_active,
  must_change_password,
  accepted_legal_at,
  staff_type,
  employment_status,
  employment_start_date,
  appointment_date,
  position_title,
  academic_rank,
  is_school_director
)
values (
  'de000000-0000-4000-8000-000000000020',
  'de000000-0000-4000-8000-000000000001',
  'demo2569_teacher',
  '$2b$10$5ytkbmUiwTpPdkVhN.qHB.KvrgkkK0ohmFmeSgG9N.7SauFvErSU6',
  'demo2569_teacher@example.test',
  'สมหญิง',
  'ใจดี',
  'teacher',
  true,
  false,
  now(),
  'teacher',
  'active',
  '2020-05-01',
  '2020-05-01',
  'ครูผู้สอน',
  'ครูชำนาญการ',
  false
)
on conflict (id) do update
set
  school_id = excluded.school_id,
  role = 'teacher',
  password_hash = excluded.password_hash,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  is_active = true,
  staff_type = excluded.staff_type,
  employment_status = excluded.employment_status,
  position_title = excluded.position_title,
  academic_rank = excluded.academic_rank,
  is_school_director = false,
  must_change_password = false,
  accepted_legal_at = excluded.accepted_legal_at;

insert into public.app_users (
  id,
  school_id,
  username,
  password_hash,
  first_name,
  last_name,
  name_prefix,
  role,
  student_code,
  national_id,
  student_status,
  is_active,
  must_change_password,
  import_confirmed_at,
  accepted_legal_at
)
select
  ('de000000-0000-4000-8000-' || lpad(student_no::text, 12, '0'))::uuid,
  'de000000-0000-4000-8000-000000000001'::uuid,
  'demo2569_student' || lpad(student_no::text, 2, '0'),
  '$2b$10$5ytkbmUiwTpPdkVhN.qHB.KvrgkkK0ohmFmeSgG9N.7SauFvErSU6',
  (array['กิตติ', 'ขวัญข้าว', 'จักริน', 'ชนากานต์', 'ณัฐพล', 'ปภาวดี', 'ภูริ', 'วรัญญา'])[student_no],
  (array['รักเรียน', 'แสนดี', 'ตั้งใจ', 'มีสุข', 'เก่งกล้า', 'สดใส', 'พากเพียร', 'ใจงาม'])[student_no],
  case when student_no in (2, 4, 6, 8) then 'เด็กหญิง' else 'เด็กชาย' end,
  'student',
  '6901' || lpad(student_no::text, 2, '0'),
  '11037000000' || lpad(student_no::text, 2, '0'),
  'studying',
  true,
  false,
  now(),
  now()
from generate_series(1, 8) as student_no
on conflict (id) do update
set
  school_id = excluded.school_id,
  role = 'student',
  password_hash = excluded.password_hash,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  student_code = excluded.student_code,
  national_id = excluded.national_id,
  student_status = 'studying',
  is_active = true,
  must_change_password = false,
  import_confirmed_at = excluded.import_confirmed_at,
  accepted_legal_at = excluded.accepted_legal_at;

-- Normalize demo identities before the enrollment eligibility trigger runs.
update public.app_users
set
  school_id = 'de000000-0000-4000-8000-000000000001',
  role = 'student',
  student_status = 'studying',
  is_active = true,
  import_confirmed_at = coalesce(import_confirmed_at, now())
where id in (
  select
    ('de000000-0000-4000-8000-' || lpad(student_no::text, 12, '0'))::uuid
  from generate_series(1, 8) as student_no
);

insert into public.academic_years (
  id,
  school_id,
  year,
  start_date,
  end_date,
  is_active
)
values (
  'de000000-0000-4000-8000-000000000100',
  'de000000-0000-4000-8000-000000000001',
  '2569',
  '2026-05-01',
  '2027-03-31',
  true
)
on conflict (id) do update
set
  year = excluded.year,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  is_active = true;

insert into public.semesters (
  id,
  academic_year_id,
  name,
  start_date,
  end_date,
  is_active
)
values (
  'de000000-0000-4000-8000-000000000110',
  'de000000-0000-4000-8000-000000000100',
  '1',
  '2026-05-01',
  '2026-10-15',
  true
)
on conflict (id) do update
set
  name = excluded.name,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  is_active = true;

insert into public.classrooms (
  id,
  school_id,
  academic_year_id,
  name,
  grade_level
)
values (
  'de000000-0000-4000-8000-000000000120',
  'de000000-0000-4000-8000-000000000001',
  'de000000-0000-4000-8000-000000000100',
  '[DEMO] 1/1',
  'ประถมศึกษาปีที่ 1'
)
on conflict (id) do update
set
  name = excluded.name,
  grade_level = excluded.grade_level;

insert into public.subjects (
  id,
  school_id,
  academic_year_id,
  semester_id,
  code,
  name,
  credits,
  description
)
values (
  'de000000-0000-4000-8000-000000000130',
  'de000000-0000-4000-8000-000000000001',
  'de000000-0000-4000-8000-000000000100',
  'de000000-0000-4000-8000-000000000110',
  'ท11101-D',
  '[DEMO] ภาษาไทยพื้นฐาน',
  1.5,
  'รายวิชาตัวอย่างสำหรับตรวจสอบผลการเรียนและพรีวิว ปพ.5'
)
on conflict (id) do update
set
  code = excluded.code,
  name = excluded.name,
  credits = excluded.credits,
  description = excluded.description;

insert into public.teacher_assignments (
  id,
  teacher_id,
  subject_id,
  classroom_id,
  semester_id
)
values (
  'de000000-0000-4000-8000-000000000140',
  'de000000-0000-4000-8000-000000000020',
  'de000000-0000-4000-8000-000000000130',
  'de000000-0000-4000-8000-000000000120',
  'de000000-0000-4000-8000-000000000110'
)
on conflict (id) do update
set teacher_id = excluded.teacher_id;

insert into public.enrollments (
  student_id,
  classroom_id,
  academic_year_id,
  student_number
)
select
  ('de000000-0000-4000-8000-' || lpad(student_no::text, 12, '0'))::uuid,
  'de000000-0000-4000-8000-000000000120'::uuid,
  'de000000-0000-4000-8000-000000000100'::uuid,
  student_no::text
from generate_series(1, 8) as student_no
on conflict (student_id, classroom_id) do update
set student_number = excluded.student_number;

insert into public.assignments (
  id,
  teacher_assignment_id,
  title,
  description,
  full_score,
  category
)
values
  (
    'de000000-0000-4000-8000-000000000201',
    'de000000-0000-4000-8000-000000000140',
    'งานระหว่างเรียน',
    'งานและแบบฝึกหัดระหว่างภาค',
    30,
    'assignment'
  ),
  (
    'de000000-0000-4000-8000-000000000202',
    'de000000-0000-4000-8000-000000000140',
    'แบบทดสอบท้ายบท',
    'แบบทดสอบเก็บคะแนน',
    10,
    'quiz'
  ),
  (
    'de000000-0000-4000-8000-000000000203',
    'de000000-0000-4000-8000-000000000140',
    'สอบกลางภาค',
    'คะแนนสอบกลางภาค',
    20,
    'midterm'
  ),
  (
    'de000000-0000-4000-8000-000000000204',
    'de000000-0000-4000-8000-000000000140',
    'สอบปลายภาค',
    'คะแนนสอบปลายภาค',
    35,
    'final'
  ),
  (
    'de000000-0000-4000-8000-000000000205',
    'de000000-0000-4000-8000-000000000140',
    'จิตพิสัย',
    'ความรับผิดชอบและการมีส่วนร่วม',
    5,
    'other'
  )
on conflict (id) do update
set
  title = excluded.title,
  description = excluded.description,
  full_score = excluded.full_score,
  category = excluded.category;

with demo_students as (
  select
    student_no,
    ('de000000-0000-4000-8000-' || lpad(student_no::text, 12, '0'))::uuid as student_id
  from generate_series(1, 8) as student_no
),
demo_assignments as (
  select *
  from (
    values
      ('de000000-0000-4000-8000-000000000201'::uuid, 'assignment', 30),
      ('de000000-0000-4000-8000-000000000202'::uuid, 'quiz', 10),
      ('de000000-0000-4000-8000-000000000203'::uuid, 'midterm', 20),
      ('de000000-0000-4000-8000-000000000204'::uuid, 'final', 35),
      ('de000000-0000-4000-8000-000000000205'::uuid, 'other', 5)
  ) as assignment(id, category, full_score)
)
insert into public.scores (
  assignment_id,
  student_id,
  score,
  status,
  feedback,
  graded_by
)
select
  assignment.id,
  student.student_id,
  case assignment.category
    when 'assignment' then 30 - student.student_no
    when 'quiz' then 10 - (student.student_no % 3)
    when 'midterm' then 20 - (student.student_no % 5)
    when 'final' then 35 - (student.student_no * 2)
    else 5 - (student.student_no % 2)
  end,
  'submitted',
  'ข้อมูลคะแนนตัวอย่าง',
  'de000000-0000-4000-8000-000000000020'::uuid
from demo_students student
cross join demo_assignments assignment
on conflict (assignment_id, student_id) do update
set
  score = excluded.score,
  status = excluded.status,
  feedback = excluded.feedback,
  graded_by = excluded.graded_by;

insert into public.teacher_assignment_student_results (
  school_id,
  teacher_assignment_id,
  student_id,
  special_result,
  note,
  updated_by
)
values
  (
    'de000000-0000-4000-8000-000000000001',
    'de000000-0000-4000-8000-000000000140',
    'de000000-0000-4000-8000-000000000006',
    'ร',
    'รอส่งภาระงานเพิ่มเติม',
    'de000000-0000-4000-8000-000000000020'
  ),
  (
    'de000000-0000-4000-8000-000000000001',
    'de000000-0000-4000-8000-000000000140',
    'de000000-0000-4000-8000-000000000007',
    'มส',
    'เวลาเรียนไม่ครบตามเกณฑ์',
    'de000000-0000-4000-8000-000000000020'
  ),
  (
    'de000000-0000-4000-8000-000000000001',
    'de000000-0000-4000-8000-000000000140',
    'de000000-0000-4000-8000-000000000008',
    'มผ',
    'กิจกรรมยังไม่ผ่านเกณฑ์',
    'de000000-0000-4000-8000-000000000020'
  )
on conflict (teacher_assignment_id, student_id) do update
set
  special_result = excluded.special_result,
  note = excluded.note,
  updated_by = excluded.updated_by;

insert into public.student_term_assessments (
  school_id,
  semester_id,
  classroom_id,
  student_id,
  desirable_attributes_level,
  reading_thinking_writing_level,
  activity_result,
  note,
  updated_by
)
select
  'de000000-0000-4000-8000-000000000001'::uuid,
  'de000000-0000-4000-8000-000000000110'::uuid,
  'de000000-0000-4000-8000-000000000120'::uuid,
  ('de000000-0000-4000-8000-' || lpad(student_no::text, 12, '0'))::uuid,
  case when student_no <= 2 then 3 when student_no <= 6 then 2 else 1 end,
  case when student_no <= 3 then 3 when student_no <= 7 then 2 else 1 end,
  case
    when student_no = 8 then 'fail'
    when student_no = 6 then 'pending'
    else 'pass'
  end,
  'ผลประเมินตัวอย่างภาคเรียนที่ 1',
  'de000000-0000-4000-8000-000000000010'::uuid
from generate_series(1, 8) as student_no
on conflict (semester_id, student_id) do update
set
  desirable_attributes_level = excluded.desirable_attributes_level,
  reading_thinking_writing_level = excluded.reading_thinking_writing_level,
  activity_result = excluded.activity_result,
  note = excluded.note,
  updated_by = excluded.updated_by;

insert into public.grade_review_submissions (
  id,
  school_id,
  teacher_assignment_id,
  status,
  submitted_by,
  submitted_at,
  reviewed_by,
  reviewed_at,
  approved_by,
  approved_at,
  note
)
values (
  'de000000-0000-4000-8000-000000000300',
  'de000000-0000-4000-8000-000000000001',
  'de000000-0000-4000-8000-000000000140',
  'locked',
  'de000000-0000-4000-8000-000000000020',
  '2026-10-10 09:15:00+07',
  'de000000-0000-4000-8000-000000000010',
  '2026-10-12 13:30:00+07',
  'de000000-0000-4000-8000-000000000010',
  '2026-10-13 10:00:00+07',
  'ข้อมูลตัวอย่างตรวจสอบครบและปิดผลการเรียนแล้ว'
)
on conflict (teacher_assignment_id) do update
set
  status = excluded.status,
  submitted_by = excluded.submitted_by,
  submitted_at = excluded.submitted_at,
  reviewed_by = excluded.reviewed_by,
  reviewed_at = excluded.reviewed_at,
  approved_by = excluded.approved_by,
  approved_at = excluded.approved_at,
  note = excluded.note;

delete from public.grade_review_events
where submission_id = (
  select id
  from public.grade_review_submissions
  where teacher_assignment_id = 'de000000-0000-4000-8000-000000000140'
);

insert into public.grade_review_events (
  submission_id,
  status,
  note,
  acted_by,
  created_at
)
values
  (
    (
      select id from public.grade_review_submissions
      where teacher_assignment_id = 'de000000-0000-4000-8000-000000000140'
    ),
    'submitted',
    'ครูส่งผลการเรียนให้ฝ่ายวิชาการตรวจสอบ',
    'de000000-0000-4000-8000-000000000020',
    '2026-10-10 09:15:00+07'
  ),
  (
    (
      select id from public.grade_review_submissions
      where teacher_assignment_id = 'de000000-0000-4000-8000-000000000140'
    ),
    'revision',
    'กรุณาตรวจสอบผลกิจกรรมพัฒนาผู้เรียนของเลขที่ 8',
    'de000000-0000-4000-8000-000000000010',
    '2026-10-10 14:20:00+07'
  ),
  (
    (
      select id from public.grade_review_submissions
      where teacher_assignment_id = 'de000000-0000-4000-8000-000000000140'
    ),
    'submitted',
    'ครูแก้ไขและส่งผลการเรียนอีกครั้ง',
    'de000000-0000-4000-8000-000000000020',
    '2026-10-11 09:00:00+07'
  ),
  (
    (
      select id from public.grade_review_submissions
      where teacher_assignment_id = 'de000000-0000-4000-8000-000000000140'
    ),
    'reviewed',
    'ตรวจคะแนนและผลประเมินเทียบข้อมูลเรียบร้อย',
    'de000000-0000-4000-8000-000000000010',
    '2026-10-12 13:30:00+07'
  ),
  (
    (
      select id from public.grade_review_submissions
      where teacher_assignment_id = 'de000000-0000-4000-8000-000000000140'
    ),
    'approved',
    'อนุมัติผลการเรียน',
    'de000000-0000-4000-8000-000000000010',
    '2026-10-13 10:00:00+07'
  ),
  (
    (
      select id from public.grade_review_submissions
      where teacher_assignment_id = 'de000000-0000-4000-8000-000000000140'
    ),
    'locked',
    'ปิดผลการเรียนภาคเรียนที่ 1 ปีการศึกษา 2569',
    'de000000-0000-4000-8000-000000000010',
    '2026-10-15 16:30:00+07'
  );

commit;

select
  'demo2569_admin' as school_admin_username,
  'Demo1234!' as password,
  '25690001' as school_pin,
  '/admin/grade-reviews' as review_queue,
  '/admin/grade-results' as approved_results,
  '/admin/documents/pp5' as pp5_documents;
