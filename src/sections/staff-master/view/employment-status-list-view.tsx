'use client';

import { MasterItemListView } from 'src/sections/master-data/components/master-item-list-view';

import {
  listStaffMasterItems,
  createStaffMasterItem,
  deleteStaffMasterItem,
  updateStaffMasterItem,
} from '../staff-master-actions';

// ----------------------------------------------------------------------

export function EmploymentStatusListView() {
  return (
    <MasterItemListView
      title="สถานะปฏิบัติงาน"
      description="ใช้กำหนดสถานะการทำงานของครู/บุคลากร เช่น ปฏิบัติงาน ลาศึกษาต่อ เกษียณ"
      itemLabel="สถานะปฏิบัติงาน"
      showCode
      queryKey={['staff-master-items', 'employment_status']}
      listItems={() =>
        listStaffMasterItems().then((items) =>
          items.filter((item) => item.category === 'employment_status')
        )
      }
      createItem={(values) => createStaffMasterItem({ category: 'employment_status', ...values })}
      updateItem={updateStaffMasterItem}
      deleteItem={deleteStaffMasterItem}
    />
  );
}
