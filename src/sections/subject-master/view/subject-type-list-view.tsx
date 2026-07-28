'use client';

import { MasterItemListView } from 'src/sections/master-data/components/master-item-list-view';

import {
  listSubjectMasterItems,
  createSubjectMasterItem,
  deleteSubjectMasterItem,
  updateSubjectMasterItem,
} from '../subject-master-actions';

// ----------------------------------------------------------------------

export function SubjectTypeListView() {
  return (
    <MasterItemListView
      title="ประเภทรายวิชา"
      description="เช่น รายวิชาพื้นฐาน รายวิชาเพิ่มเติม ใช้จัดหมวดหมู่รายวิชา"
      itemLabel="ประเภทรายวิชา"
      queryKey={['subject-master-items', 'subject_type']}
      listItems={() =>
        listSubjectMasterItems().then((items) => items.filter((item) => item.category === 'subject_type'))
      }
      createItem={(values) => createSubjectMasterItem({ category: 'subject_type', ...values })}
      updateItem={updateSubjectMasterItem}
      deleteItem={deleteSubjectMasterItem}
    />
  );
}
