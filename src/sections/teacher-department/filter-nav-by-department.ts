import type { NavSectionProps, NavItemDataProps } from 'src/components/nav-section';

// ----------------------------------------------------------------------

export type DepartmentMembership = {
  id: string;
  name: string;
  role_in_department: 'head' | 'member';
};

/**
 * Filters a nav tree for a teacher viewer: items with no department/permission
 * requirement stay visible by default, items that declare one are only kept
 * if the teacher's own department/permission state satisfies it.
 */
export function filterNavByDepartment(
  data: NavSectionProps['data'],
  departments: DepartmentMembership[],
  permissions: string[] = [],
  isSchoolDirector = false
): NavSectionProps['data'] {
  const hasDepartment = departments.length > 0;
  const isHead = departments.some((department) => department.role_in_department === 'head');

  const filterItems = (items: NavItemDataProps[]): NavItemDataProps[] =>
    items.flatMap((item) => {
      // Executives use /teacher as an approval workspace. Even when an
      // executive was previously added to a department, do not expose the
      // operational "งานฝ่ายของฉัน" entry.
      if (item.requiresDepartment && (!hasDepartment || isSchoolDirector)) return [];
      if (item.departmentHeadOnly && !isHead) return [];
      if (item.requiresSchoolDirector && !isSchoolDirector) return [];
      if (item.requiresDepartmentPermission && !permissions.includes(item.requiresDepartmentPermission)) {
        return [];
      }

      if (!item.children) return [item];

      const children = filterItems(item.children);
      if (!children.length) return [];

      const containsApprovalsOnly =
        item.title === 'งานฝ่าย' &&
        children.every((child) =>
          ['schedule.approve', 'grades.approve'].includes(
            child.requiresDepartmentPermission ?? ''
          )
        );

      return [
        {
          ...item,
          title: containsApprovalsOnly ? 'รายการอนุมัติ' : item.title,
          children,
        },
      ];
    });

  return data
    .map((group) => ({ ...group, items: filterItems(group.items) }))
    .filter((group) => group.items.length > 0);
}

/**
 * Filters the ADMIN nav tree for a delegated teacher viewer: opposite default
 * from the teacher-nav filter above — items are admin-only (hidden) unless
 * they explicitly declare a `requiresDepartmentPermission` the teacher holds.
 * School admins never go through this filter; they see the admin nav as-is.
 */
export function filterAdminNavForTeacher(
  data: NavSectionProps['data'],
  permissions: string[],
  isSchoolDirector = false
): NavSectionProps['data'] {
  const filterItems = (items: NavItemDataProps[]): NavItemDataProps[] =>
    items.flatMap((item) => {
      if (item.children) {
        const children = filterItems(item.children);
        return children.length ? [{ ...item, children }] : [];
      }

      if (item.requiresSchoolDirector && isSchoolDirector) return [item];
      if (!item.requiresDepartmentPermission) return [];
      return permissions.includes(item.requiresDepartmentPermission) ? [item] : [];
    });

  return data
    .map((group) => ({ ...group, items: filterItems(group.items) }))
    .filter((group) => group.items.length > 0);
}
