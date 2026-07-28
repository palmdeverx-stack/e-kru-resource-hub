-- Demo extension: 5 approved subjects x 20 students.
-- Run grade_review_end_to_end_demo.sql first, then run this file.
-- Manual seed only; this is not a production migration.

begin;

do $$
begin
  if not exists (
    select 1 from public.schools
    where id = 'de000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Run grade_review_end_to_end_demo.sql before this seed';
  end if;
end
$$;

update public.school_subscriptions subscription
set enabled_features = array(
  select distinct feature
  from unnest(
    subscription.enabled_features ||
    array[
      'academic.grade_workflow',
      'academic.documents',
      'admin.line_notifications'
    ]::text[]
  ) as feature
)
where school_id = 'de000000-0000-4000-8000-000000000001';

-- Repair role data if an older version of this seed used overlapping UUIDs.
update public.app_users
set
  school_id = 'de000000-0000-4000-8000-000000000001',
  role = 'school_admin',
  first_name = 'วิชาการ',
  last_name = 'ตัวอย่าง',
  name_prefix = null,
  student_code = null,
  national_id = null,
  student_status = null,
  is_active = true
where id = 'de000000-0000-4000-8000-000000000010';

update public.app_users
set
  school_id = 'de000000-0000-4000-8000-000000000001',
  role = 'teacher',
  first_name = 'สมหญิง',
  last_name = 'ใจดี',
  name_prefix = null,
  student_code = null,
  national_id = null,
  student_status = null,
  is_active = true
where id = 'de000000-0000-4000-8000-000000000020';

-- Remove student-only rows accidentally attached to those staff UUIDs.
delete from public.enrollments
where classroom_id = 'de000000-0000-4000-8000-000000000120'
  and student_id in (
    'de000000-0000-4000-8000-000000000010',
    'de000000-0000-4000-8000-000000000020'
  );

delete from public.scores score
using public.assignments assignment
where score.assignment_id = assignment.id
  and assignment.teacher_assignment_id in (
    'de000000-0000-4000-8000-000000000140',
    'de000000-0000-4000-8000-000000000141',
    'de000000-0000-4000-8000-000000000142',
    'de000000-0000-4000-8000-000000000143',
    'de000000-0000-4000-8000-000000000144'
  )
  and score.student_id in (
    'de000000-0000-4000-8000-000000000010',
    'de000000-0000-4000-8000-000000000020'
  );

delete from public.teacher_assignment_student_results
where student_id in (
  'de000000-0000-4000-8000-000000000010',
  'de000000-0000-4000-8000-000000000020'
);

delete from public.student_term_assessments
where semester_id = 'de000000-0000-4000-8000-000000000110'
  and student_id in (
    'de000000-0000-4000-8000-000000000010',
    'de000000-0000-4000-8000-000000000020'
  );

delete from public.student_guardians
where school_id = 'de000000-0000-4000-8000-000000000001'
  and student_id in (
    'de000000-0000-4000-8000-000000000010',
    'de000000-0000-4000-8000-000000000020'
  );

-- Remove student 9-19 accounts created by the older overlapping UUID scheme.
-- IDs 10 and 20 are deliberately excluded because they belong to Admin/Teacher.
delete from public.app_users
where id in (
  select
    ('de000000-0000-4000-8000-' || lpad(student_no::text, 12, '0'))::uuid
  from generate_series(9, 19) as student_no
  where student_no <> 10
)
  and role = 'student'
  and username ~ '^demo2569_student(09|1[1-9])$';

-- Add students 9-20. Students 1-8 come from the base grade-review seed.
insert into public.app_users (
  id, school_id, username, password_hash, first_name, last_name, name_prefix,
  role, student_code, national_id, student_status, is_active,
  must_change_password, import_confirmed_at, accepted_legal_at
)
select
  ('de000000-0000-4000-8000-' || lpad((1000 + student_no)::text, 12, '0'))::uuid,
  'de000000-0000-4000-8000-000000000001'::uuid,
  'demo2569_student' || lpad(student_no::text, 2, '0'),
  '$2b$10$5ytkbmUiwTpPdkVhN.qHB.KvrgkkK0ohmFmeSgG9N.7SauFvErSU6',
  (array[
    'ธนกฤต', 'นภัสสร', 'พชร', 'พิชญา', 'รชต', 'ลลิตา',
    'ศุภกร', 'สิริกานต์', 'อชิระ', 'อริสา', 'เจษฎา', 'เบญญาภา'
  ])[student_no - 8],
  'ตัวอย่าง ' || lpad(student_no::text, 2, '0'),
  case when student_no % 2 = 0 then 'เด็กหญิง' else 'เด็กชาย' end,
  'student',
  '6901' || lpad(student_no::text, 2, '0'),
  '11037000000' || lpad(student_no::text, 2, '0'),
  'studying',
  true,
  false,
  now(),
  now()
from generate_series(9, 20) as student_no
on conflict (id) do update
set
  school_id = excluded.school_id,
  role = 'student',
  password_hash = excluded.password_hash,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  name_prefix = excluded.name_prefix,
  student_code = excluded.student_code,
  national_id = excluded.national_id,
  student_status = 'studying',
  is_active = true,
  must_change_password = false,
  import_confirmed_at = excluded.import_confirmed_at,
  accepted_legal_at = excluded.accepted_legal_at;

-- Normalize all demo identities before the enrollment eligibility trigger runs.
update public.app_users
set
  school_id = 'de000000-0000-4000-8000-000000000001',
  role = 'student',
  student_status = 'studying',
  is_active = true,
  import_confirmed_at = coalesce(import_confirmed_at, now())
where id in (
  select
    (
      'de000000-0000-4000-8000-' ||
      lpad(
        (case when student_no <= 8 then student_no else 1000 + student_no end)::text,
        12,
        '0'
      )
    )::uuid
  from generate_series(1, 20) as student_no
);

insert into public.enrollments (
  student_id, classroom_id, academic_year_id, student_number
)
select
  (
    'de000000-0000-4000-8000-' ||
    lpad(
      (case when student_no <= 8 then student_no else 1000 + student_no end)::text,
      12,
      '0'
    )
  )::uuid,
  'de000000-0000-4000-8000-000000000120'::uuid,
  'de000000-0000-4000-8000-000000000100'::uuid,
  student_no::text
from generate_series(1, 20) as student_no
on conflict (student_id, classroom_id) do update
set student_number = excluded.student_number;

with demo_subjects(id, code, name, credits, description) as (
  values
    (
      'de000000-0000-4000-8000-000000000131'::uuid,
      'ค11101-D', '[DEMO] คณิตศาสตร์พื้นฐาน', 1.5::numeric,
      'รายวิชาตัวอย่างคณิตศาสตร์'
    ),
    (
      'de000000-0000-4000-8000-000000000132'::uuid,
      'ว11101-D', '[DEMO] วิทยาศาสตร์และเทคโนโลยี', 1.5::numeric,
      'รายวิชาตัวอย่างวิทยาศาสตร์'
    ),
    (
      'de000000-0000-4000-8000-000000000133'::uuid,
      'อ11101-D', '[DEMO] ภาษาอังกฤษพื้นฐาน', 1.0::numeric,
      'รายวิชาตัวอย่างภาษาอังกฤษ'
    ),
    (
      'de000000-0000-4000-8000-000000000134'::uuid,
      'ส11101-D', '[DEMO] สังคมศึกษา', 1.0::numeric,
      'รายวิชาตัวอย่างสังคมศึกษา'
    )
)
insert into public.subjects (
  id, school_id, academic_year_id, semester_id, code, name, credits, description
)
select
  id,
  'de000000-0000-4000-8000-000000000001'::uuid,
  'de000000-0000-4000-8000-000000000100'::uuid,
  'de000000-0000-4000-8000-000000000110'::uuid,
  code, name, credits, description
from demo_subjects
on conflict (id) do update
set
  code = excluded.code,
  name = excluded.name,
  credits = excluded.credits,
  description = excluded.description;

with demo_teaching(id, subject_id) as (
  values
    (
      'de000000-0000-4000-8000-000000000141'::uuid,
      'de000000-0000-4000-8000-000000000131'::uuid
    ),
    (
      'de000000-0000-4000-8000-000000000142'::uuid,
      'de000000-0000-4000-8000-000000000132'::uuid
    ),
    (
      'de000000-0000-4000-8000-000000000143'::uuid,
      'de000000-0000-4000-8000-000000000133'::uuid
    ),
    (
      'de000000-0000-4000-8000-000000000144'::uuid,
      'de000000-0000-4000-8000-000000000134'::uuid
    )
)
insert into public.teacher_assignments (
  id, teacher_id, subject_id, classroom_id, semester_id
)
select
  id,
  'de000000-0000-4000-8000-000000000020'::uuid,
  subject_id,
  'de000000-0000-4000-8000-000000000120'::uuid,
  'de000000-0000-4000-8000-000000000110'::uuid
from demo_teaching
on conflict (id) do update
set
  teacher_id = excluded.teacher_id,
  subject_id = excluded.subject_id,
  classroom_id = excluded.classroom_id,
  semester_id = excluded.semester_id;

with demo_teaching(subject_no, teacher_assignment_id) as (
  values
    (2, 'de000000-0000-4000-8000-000000000141'::uuid),
    (3, 'de000000-0000-4000-8000-000000000142'::uuid),
    (4, 'de000000-0000-4000-8000-000000000143'::uuid),
    (5, 'de000000-0000-4000-8000-000000000144'::uuid)
),
score_categories(category_no, title, description, full_score, category) as (
  values
    (1, 'งานระหว่างเรียน', 'งานและแบบฝึกหัดระหว่างภาค', 30::numeric, 'assignment'),
    (2, 'แบบทดสอบท้ายบท', 'แบบทดสอบเก็บคะแนน', 10::numeric, 'quiz'),
    (3, 'สอบกลางภาค', 'คะแนนสอบกลางภาค', 20::numeric, 'midterm'),
    (4, 'สอบปลายภาค', 'คะแนนสอบปลายภาค', 35::numeric, 'final'),
    (5, 'จิตพิสัย', 'ความรับผิดชอบและการมีส่วนร่วม', 5::numeric, 'other')
)
insert into public.assignments (
  id, teacher_assignment_id, title, description, full_score, category
)
select
  (
    'de000000-0000-4000-8000-' ||
    lpad((200 + ((teaching.subject_no - 1) * 5) + category.category_no)::text, 12, '0')
  )::uuid,
  teaching.teacher_assignment_id,
  category.title,
  category.description,
  category.full_score,
  category.category
from demo_teaching teaching
cross join score_categories category
on conflict (id) do update
set
  teacher_assignment_id = excluded.teacher_assignment_id,
  title = excluded.title,
  description = excluded.description,
  full_score = excluded.full_score,
  category = excluded.category;

-- Rebuild scores for all 5 subjects and all 20 students.
with demo_students as (
  select
    student_no,
    (
      'de000000-0000-4000-8000-' ||
      lpad(
        (case when student_no <= 8 then student_no else 1000 + student_no end)::text,
        12,
        '0'
      )
    )::uuid as student_id
  from generate_series(1, 20) as student_no
),
demo_assignments as (
  select
    assignment.id,
    assignment.full_score,
    ((right(assignment.id::text, 3)::integer - 201) / 5) + 1 as subject_no,
    ((right(assignment.id::text, 3)::integer - 201) % 5) + 1 as category_no
  from public.assignments assignment
  where assignment.teacher_assignment_id in (
    'de000000-0000-4000-8000-000000000140',
    'de000000-0000-4000-8000-000000000141',
    'de000000-0000-4000-8000-000000000142',
    'de000000-0000-4000-8000-000000000143',
    'de000000-0000-4000-8000-000000000144'
  )
)
insert into public.scores (
  assignment_id, student_id, score, status, feedback, graded_by
)
select
  assignment.id,
  student.student_id,
  greatest(
    0,
    assignment.full_score -
      mod(
        student.student_no * assignment.subject_no + assignment.category_no,
        greatest(2, floor(assignment.full_score / 3)::integer)
      )
  ),
  'submitted',
  'คะแนนตัวอย่างหลายรายวิชา',
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
  school_id, teacher_assignment_id, student_id, special_result, note, updated_by
)
values
  (
    'de000000-0000-4000-8000-000000000001',
    'de000000-0000-4000-8000-000000000141',
    'de000000-0000-4000-8000-000000001018',
    'ร', 'รอส่งงานคณิตศาสตร์เพิ่มเติม',
    'de000000-0000-4000-8000-000000000020'
  ),
  (
    'de000000-0000-4000-8000-000000000001',
    'de000000-0000-4000-8000-000000000142',
    'de000000-0000-4000-8000-000000001019',
    'มส', 'เวลาเรียนวิทยาศาสตร์ไม่ครบ',
    'de000000-0000-4000-8000-000000000020'
  ),
  (
    'de000000-0000-4000-8000-000000000001',
    'de000000-0000-4000-8000-000000000143',
    'de000000-0000-4000-8000-000000001020',
    'มผ', 'ผลกิจกรรมภาษาอังกฤษยังไม่ผ่าน',
    'de000000-0000-4000-8000-000000000020'
  )
on conflict (teacher_assignment_id, student_id) do update
set
  special_result = excluded.special_result,
  note = excluded.note,
  updated_by = excluded.updated_by;

insert into public.student_term_assessments (
  school_id, semester_id, classroom_id, student_id,
  desirable_attributes_level, reading_thinking_writing_level,
  activity_result, note, updated_by
)
select
  'de000000-0000-4000-8000-000000000001'::uuid,
  'de000000-0000-4000-8000-000000000110'::uuid,
  'de000000-0000-4000-8000-000000000120'::uuid,
  (
    'de000000-0000-4000-8000-' ||
    lpad(
      (case when student_no <= 8 then student_no else 1000 + student_no end)::text,
      12,
      '0'
    )
  )::uuid,
  case when student_no % 7 = 0 then 1 when student_no % 3 = 0 then 3 else 2 end,
  case when student_no % 6 = 0 then 1 when student_no % 4 = 0 then 3 else 2 end,
  case when student_no = 20 then 'pending' when student_no = 19 then 'fail' else 'pass' end,
  'ผลประเมินตัวอย่างหลายวิชา',
  'de000000-0000-4000-8000-000000000010'::uuid
from generate_series(1, 20) as student_no
on conflict (semester_id, student_id) do update
set
  classroom_id = excluded.classroom_id,
  desirable_attributes_level = excluded.desirable_attributes_level,
  reading_thinking_writing_level = excluded.reading_thinking_writing_level,
  activity_result = excluded.activity_result,
  note = excluded.note,
  updated_by = excluded.updated_by;

with demo_reviews(id, teacher_assignment_id, status, approved_at) as (
  values
    (
      'de000000-0000-4000-8000-000000000301'::uuid,
      'de000000-0000-4000-8000-000000000141'::uuid,
      'locked', '2026-10-13 10:10:00+07'::timestamptz
    ),
    (
      'de000000-0000-4000-8000-000000000302'::uuid,
      'de000000-0000-4000-8000-000000000142'::uuid,
      'approved', '2026-10-13 10:20:00+07'::timestamptz
    ),
    (
      'de000000-0000-4000-8000-000000000303'::uuid,
      'de000000-0000-4000-8000-000000000143'::uuid,
      'approved', '2026-10-13 10:30:00+07'::timestamptz
    ),
    (
      'de000000-0000-4000-8000-000000000304'::uuid,
      'de000000-0000-4000-8000-000000000144'::uuid,
      'locked', '2026-10-13 10:40:00+07'::timestamptz
    )
)
insert into public.grade_review_submissions (
  id, school_id, teacher_assignment_id, status,
  submitted_by, submitted_at, reviewed_by, reviewed_at,
  approved_by, approved_at, note
)
select
  id,
  'de000000-0000-4000-8000-000000000001'::uuid,
  teacher_assignment_id,
  status,
  'de000000-0000-4000-8000-000000000020'::uuid,
  approved_at - interval '3 days',
  'de000000-0000-4000-8000-000000000010'::uuid,
  approved_at - interval '1 day',
  'de000000-0000-4000-8000-000000000010'::uuid,
  approved_at,
  'ข้อมูลตัวอย่างตรวจสอบและอนุมัติแล้ว'
from demo_reviews
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
where submission_id in (
  'de000000-0000-4000-8000-000000000301',
  'de000000-0000-4000-8000-000000000302',
  'de000000-0000-4000-8000-000000000303',
  'de000000-0000-4000-8000-000000000304'
);

with demo_reviews(submission_id, final_status, approved_at) as (
  values
    ('de000000-0000-4000-8000-000000000301'::uuid, 'locked', '2026-10-13 10:10:00+07'::timestamptz),
    ('de000000-0000-4000-8000-000000000302'::uuid, 'approved', '2026-10-13 10:20:00+07'::timestamptz),
    ('de000000-0000-4000-8000-000000000303'::uuid, 'approved', '2026-10-13 10:30:00+07'::timestamptz),
    ('de000000-0000-4000-8000-000000000304'::uuid, 'locked', '2026-10-13 10:40:00+07'::timestamptz)
),
events(status, day_offset, note) as (
  values
    ('submitted', 3, 'ครูส่งผลการเรียน'),
    ('reviewed', 1, 'ฝ่ายวิชาการตรวจสอบแล้ว'),
    ('approved', 0, 'อนุมัติผลการเรียน')
)
insert into public.grade_review_events (
  submission_id, status, note, acted_by, created_at
)
select
  review.submission_id,
  event.status,
  event.note,
  case
    when event.status = 'submitted'
      then 'de000000-0000-4000-8000-000000000020'::uuid
    else 'de000000-0000-4000-8000-000000000010'::uuid
  end,
  review.approved_at - make_interval(days => event.day_offset)
from demo_reviews review
cross join events event;

insert into public.grade_review_events (
  submission_id, status, note, acted_by, created_at
)
select
  submission_id,
  'locked',
  'ปิดผลการเรียนตัวอย่าง',
  'de000000-0000-4000-8000-000000000010'::uuid,
  approved_at + interval '1 day'
from (
  values
    ('de000000-0000-4000-8000-000000000301'::uuid, '2026-10-13 10:10:00+07'::timestamptz),
    ('de000000-0000-4000-8000-000000000304'::uuid, '2026-10-13 10:40:00+07'::timestamptz)
) as locked_reviews(submission_id, approved_at);

-- Guardians are present for UI testing, but deliberately have no fake LINE user id.
insert into public.student_guardians (
  school_id, student_id, full_name, relationship,
  phone, is_primary, notes
)
select
  'de000000-0000-4000-8000-000000000001'::uuid,
  (
    'de000000-0000-4000-8000-' ||
    lpad(
      (case when student_no <= 8 then student_no else 1000 + student_no end)::text,
      12,
      '0'
    )
  )::uuid,
  'ผู้ปกครองตัวอย่าง ' || lpad(student_no::text, 2, '0'),
  case when student_no % 2 = 0 then 'มารดา' else 'บิดา' end,
  '080000' || lpad(student_no::text, 4, '0'),
  true,
  'ข้อมูลตัวอย่าง ยังไม่ได้เชื่อม LINE'
from generate_series(1, 20) as student_no
on conflict (student_id) where is_primary do update
set
  school_id = excluded.school_id,
  full_name = excluded.full_name,
  relationship = excluded.relationship,
  phone = excluded.phone,
  is_primary = true,
  notes = excluded.notes;

commit;

select
  5 as subjects,
  20 as students,
  100 as student_subject_results,
  '/admin/grade-results' as classroom_results,
  '/admin/grade-results/classroom/de000000-0000-4000-8000-000000000120/de000000-0000-4000-8000-000000000110'
    as subject_results;
