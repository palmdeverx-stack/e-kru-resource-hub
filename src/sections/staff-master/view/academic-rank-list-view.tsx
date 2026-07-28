'use client';

import { MasterItemListView } from 'src/sections/master-data/components/master-item-list-view';

import {
  listStaffMasterItems,
  createStaffMasterItem,
  deleteStaffMasterItem,
  updateStaffMasterItem,
} from '../staff-master-actions';

// ----------------------------------------------------------------------

export function AcademicRankListView() {
  return (
    <MasterItemListView
      title="วิทยฐานะ"
      description="รายการวิทยฐานะที่เลือกใช้ในข้อมูลการทำงาน"
      itemLabel="วิทยฐานะ"
      queryKey={['staff-master-items', 'academic_rank']}
      listItems={() =>
        listStaffMasterItems().then((items) => items.filter((item) => item.category === 'academic_rank'))
      }
      createItem={(values) => createStaffMasterItem({ category: 'academic_rank', ...values })}
      updateItem={updateStaffMasterItem}
      deleteItem={deleteStaffMasterItem}
    />
  );
}
