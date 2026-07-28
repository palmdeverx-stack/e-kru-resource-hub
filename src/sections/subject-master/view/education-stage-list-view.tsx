'use client';

import { MasterItemListView } from 'src/sections/master-data/components/master-item-list-view';

import {
  listSubjectMasterItems,
  createSubjectMasterItem,
  deleteSubjectMasterItem,
  updateSubjectMasterItem,
} from '../subject-master-actions';

// ----------------------------------------------------------------------

export function EducationStageListView() {
  return (
    <MasterItemListView
      title="ช่วงชั้น"
      description="ระดับชั้น เช่น ประถมศึกษา มัธยมศึกษาตอนต้น มัธยมศึกษาตอนปลาย ใช้จัดหมวดหมู่รายวิชา"
      itemLabel="ช่วงชั้น"
      queryKey={['subject-master-items', 'education_stage']}
      listItems={() =>
        listSubjectMasterItems().then((items) =>
          items.filter((item) => item.category === 'education_stage')
        )
      }
      createItem={(values) => createSubjectMasterItem({ category: 'education_stage', ...values })}
      updateItem={updateSubjectMasterItem}
      deleteItem={deleteSubjectMasterItem}
    />
  );
}
