import { NextResponse } from 'next/server';

import { requireRole } from 'src/lib/auth-token';
import { supabaseAdmin } from 'src/lib/supabase-admin';
import { schoolHasFeature } from 'src/lib/school-subscription';
import { canManageViaPermission } from 'src/lib/department-permission-access';

// ----------------------------------------------------------------------

const VALID_LEARNING_AREAS = [
  'thai',
  'mathematics',
  'science_technology',
  'social_studies',
  'health_pe',
  'art',
  'occupations_technology',
  'foreign_language',
  'student_development_activity',
];
const VALID_ACTIVITY_TYPES = ['guidance', 'scout_cadet', 'club', 'social_service'];
const VALID_SUBJECT_TYPES = ['basic', 'additional', 'activity'];
const VALID_EDUCATION_STAGES = ['primary', 'lower_secondary', 'upper_secondary'];
const VALID_GRADE_LEVELS = [
  'ป.1',
  'ป.2',
  'ป.3',
  'ป.4',
  'ป.5',
  'ป.6',
  'ม.1',
  'ม.2',
  'ม.3',
  'ม.4',
  'ม.5',
  'ม.6',
];

function parseCurriculumFields(body: Record<string, unknown>) {
  const learningArea =
    typeof body.learningArea === 'string' && VALID_LEARNING_AREAS.includes(body.learningArea)
      ? body.learningArea
      : null;
  const activityType =
    learningArea === 'student_development_activity' &&
    typeof body.activityType === 'string' &&
    VALID_ACTIVITY_TYPES.includes(body.activityType)
      ? body.activityType
      : null;
  const subjectType =
    typeof body.subjectType === 'string' && VALID_SUBJECT_TYPES.includes(body.subjectType)
      ? body.subjectType
      : null;
  const educationStage =
    typeof body.educationStage === 'string' &&
    VALID_EDUCATION_STAGES.includes(body.educationStage)
      ? body.educationStage
      : null;
  const gradeLevels = Array.isArray(body.gradeLevels)
    ? body.gradeLevels.filter(
        (level): level is string =>
          typeof level === 'string' && VALID_GRADE_LEVELS.includes(level)
      )
    : [];

  const parseRichText = (value: unknown) => {
    const text = typeof value === 'string' ? value.trim() : '';
    return text ? text.slice(0, 20000) : null;
  };

  return {
    learningArea,
    activityType,
    subjectType,
    educationStage,
    gradeLevels,
    learningStandards: parseRichText(body.learningStandards),
    learningOutcomes: parseRichText(body.learningOutcomes),
    learningUnits: parseRichText(body.learningUnits),
    indicators: parseRichText(body.indicators),
  };
}

export async function GET(request: Request) {
  const caller = requireRole(request, ['school_admin', 'teacher']);

  if (!caller) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const academicYearId = searchParams.get('academicYearId');
  const semesterId = searchParams.get('semesterId');

  let query = supabaseAdmin
    .from('subjects')
    .select(
      'id, code, name, name_en, credits, study_hours, description, description_en, image_url, academic_year_id, semester_id, academic_years(year), semesters(name), learning_area, activity_type, subject_type, education_stage, grade_levels, learning_standards, learning_outcomes, learning_units, indicators, status, created_by, created_at'
    )
    .eq('school_id', caller.schoolId)
    .order('name');

  // school_admin sees every subject regardless of status; teachers only see
  // published subjects plus their own drafts.
  if (caller.role !== 'school_admin') {
    query = query.or(`status.eq.published,created_by.eq.${caller.sub}`);
  }

  if (academicYearId) query = query.eq('academic_year_id', academicYearId);
  if (semesterId) query = query.eq('semester_id', semesterId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ subjects: data });
}

export async function POST(request: Request) {
  const caller = requireRole(request, ['school_admin', 'teacher']);

  if (!caller?.schoolId) {
    return NextResponse.json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }
  const isAdminLike = await canManageViaPermission(caller, 'subjects.manage');
  if (
    caller.role === 'teacher' &&
    !isAdminLike &&
    !(await schoolHasFeature(caller.schoolId, 'teacher.manage_subjects'))
  ) {
    return NextResponse.json(
      { message: 'แพ็กเกจโรงเรียนไม่รองรับการให้ครูสร้างรายวิชา' },
      { status: 403 }
    );
  }

  const body = await request.json();
  const {
    code,
    name,
    nameEn,
    credits,
    studyHours,
    description,
    descriptionEn,
    academicYearId,
    semesterId,
  } = body;
  const parsedCredits = Number(credits);
  const parsedStudyHours = Number(studyHours);

  if (
    typeof code !== 'string' ||
    !code.trim() ||
    !name ||
    !academicYearId ||
    !semesterId ||
    !Number.isFinite(parsedCredits) ||
    parsedCredits < 0 ||
    !Number.isFinite(parsedStudyHours) ||
    parsedStudyHours < 0
  ) {
    return NextResponse.json(
      { message: 'กรุณากรอกรหัสวิชา ชื่อ หน่วยกิต ชั่วโมงเรียน ปีการศึกษา และภาคเรียนให้ครบถ้วน' },
      { status: 400 }
    );
  }

  const {
    learningArea,
    activityType,
    subjectType,
    educationStage,
    gradeLevels,
    learningStandards,
    learningOutcomes,
    learningUnits,
    indicators,
  } = parseCurriculumFields(body);

  const { data: semester } = await supabaseAdmin
    .from('semesters')
    .select('id, academic_year_id, academic_years!inner(school_id)')
    .eq('id', semesterId)
    .eq('academic_year_id', academicYearId)
    .eq('academic_years.school_id', caller.schoolId)
    .maybeSingle();

  if (!semester) {
    return NextResponse.json({ message: 'ไม่พบภาคเรียนในปีการศึกษาที่เลือก' }, { status: 400 });
  }

  const { data: subject, error } = await supabaseAdmin
    .from('subjects')
    .insert({
      code: typeof code === 'string' && code.trim() ? code.trim() : null,
      name: String(name).trim(),
      name_en: typeof nameEn === 'string' && nameEn.trim() ? nameEn.trim() : null,
      credits: parsedCredits,
      study_hours: parsedStudyHours,
      description:
        typeof description === 'string' && description.trim() ? description.trim() : null,
      description_en:
        typeof descriptionEn === 'string' && descriptionEn.trim() ? descriptionEn.trim() : null,
      academic_year_id: academicYearId,
      semester_id: semesterId,
      school_id: caller.schoolId,
      created_by: caller.sub,
      status: 'draft',
      learning_area: learningArea,
      activity_type: activityType,
      subject_type: subjectType,
      education_stage: educationStage,
      grade_levels: gradeLevels,
      learning_standards: learningStandards,
      learning_outcomes: learningOutcomes,
      learning_units: learningUnits,
      indicators,
    })
    .select(
      'id, code, name, name_en, credits, study_hours, description, description_en, image_url, academic_year_id, semester_id, academic_years(year), semesters(name), learning_area, activity_type, subject_type, education_stage, grade_levels, learning_standards, learning_outcomes, learning_units, indicators, status, created_by, created_at'
    )
    .single();

  if (error || !subject) {
    if (error?.code === '23505') {
      return NextResponse.json(
        { message: 'รหัสวิชานี้ถูกใช้แล้วในภาคเรียนที่เลือก' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: error?.message ?? 'Failed to create subject' },
      { status: 500 }
    );
  }

  return NextResponse.json({ subject }, { status: 201 });
}
