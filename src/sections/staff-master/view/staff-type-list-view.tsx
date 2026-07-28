'use client';

import { MasterItemListView } from 'src/sections/master-data/components/master-item-list-view';

import {
  listStaffMasterItems,
  createStaffMasterItem,
  deleteStaffMasterItem,
  updateStaffMasterItem,
} from '../staff-master-actions';

// ----------------------------------------------------------------------

export function StaffTypeListView() {
  return (
    <MasterItemListView
      title="ประเภทบุคลากร"
      description="ใช้กำหนดเมนูและสิทธิ์เริ่มต้นของบัญชี role teacher"
      itemLabel="ประเภทบุคลากร"
      showCode
      queryKey={['staff-master-items', 'staff_type']}
      listItems={() => listStaffMasterItems().then((items) => items.filter((item) => item.category === 'staff_type'))}
      createItem={(values) => createStaffMasterItem({ category: 'staff_type', ...values })}
      updateItem={updateStaffMasterItem}
      deleteItem={deleteStaffMasterItem}
    />
  );
}
