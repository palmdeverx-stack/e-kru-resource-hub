'use client';

import { MasterItemListView } from 'src/sections/master-data/components/master-item-list-view';

import {
  listSubjectMasterItems,
  createSubjectMasterItem,
  deleteSubjectMasterItem,
  updateSubjectMasterItem,
} from '../subject-master-actions';

// ----------------------------------------------------------------------

export function LearningAreaListView() {
  return (
    <MasterItemListView
      title="กลุ่มสาระการเรียนรู้"
      description="อ้างอิงหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พ.ศ. 2551 ใช้จัดหมวดหมู่รายวิชา"
      itemLabel="กลุ่มสาระการเรียนรู้"
      queryKey={['subject-master-items', 'learning_area']}
      listItems={() =>
        listSubjectMasterItems().then((items) => items.filter((item) => item.category === 'learning_area'))
      }
      createItem={(values) => createSubjectMasterItem({ category: 'learning_area', ...values })}
      updateItem={updateSubjectMasterItem}
      deleteItem={deleteSubjectMasterItem}
    />
  );
}
