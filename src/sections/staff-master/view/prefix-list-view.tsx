'use client';

import { MasterItemListView } from 'src/sections/master-data/components/master-item-list-view';

import {
  listStaffMasterItems,
  createStaffMasterItem,
  deleteStaffMasterItem,
  updateStaffMasterItem,
} from '../staff-master-actions';

// ----------------------------------------------------------------------

export function PrefixListView() {
  return (
    <MasterItemListView
      title="คำนำหน้าชื่อ"
      description="รายการคำนำหน้าชื่อภาษาไทยและภาษาอังกฤษสำหรับครูและบุคลากร"
      itemLabel="คำนำหน้าชื่อ"
      queryKey={['staff-master-items', 'prefix']}
      listItems={() =>
        listStaffMasterItems().then((items) => items.filter((item) => item.category === 'prefix'))
      }
      createItem={(values) => createStaffMasterItem({ category: 'prefix', ...values })}
      updateItem={updateStaffMasterItem}
      deleteItem={deleteStaffMasterItem}
    />
  );
}
