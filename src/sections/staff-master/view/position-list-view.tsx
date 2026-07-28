'use client';

import { MasterItemListView } from 'src/sections/master-data/components/master-item-list-view';

import {
  listStaffMasterItems,
  createStaffMasterItem,
  deleteStaffMasterItem,
  updateStaffMasterItem,
} from '../staff-master-actions';

// ----------------------------------------------------------------------

export function PositionListView() {
  return (
    <MasterItemListView
      title="ตำแหน่ง"
      description="รายการตำแหน่งที่เลือกใช้ในข้อมูลการทำงาน"
      itemLabel="ตำแหน่ง"
      queryKey={['staff-master-items', 'position']}
      listItems={() => listStaffMasterItems().then((items) => items.filter((item) => item.category === 'position'))}
      createItem={(values) => createStaffMasterItem({ category: 'position', ...values })}
      updateItem={updateStaffMasterItem}
      deleteItem={deleteStaffMasterItem}
    />
  );
}
