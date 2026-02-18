const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const OUTPUT = path.resolve(__dirname, '..', 'bulk-template.xlsx');

const categoryRows = [
  {
    Action: 'Create',
    'Category ID': '',
    'Category Name': 'Root Category Example',
    'Parent ID': '',
    'Parent Name': '',
    'Sort Order': 1,
    'Is Visible': 'TRUE',
    'Has Time Availability': 'FALSE',
    'Available From': '',
    'Available To': ''
  },
  {
    Action: 'Create',
    'Category ID': '',
    'Category Name': 'Child Category Example',
    'Parent ID': '',
    'Parent Name': 'Root Category Example',
    'Sort Order': 2,
    'Is Visible': 'TRUE',
    'Has Time Availability': 'TRUE',
    'Available From': '20:00',
    'Available To': '03:00'
  }
];

const itemRows = [
  {
    Action: 'Create',
    'Item ID': '',
    'Item Name': 'Sample Item',
    Description: 'Describe the dish here',
    'Category Name': 'Child Category Example (REQUIRED)',
    'Category ID (Optional)': '',
    Price: 75,
    Currency: 'AED',
    'Sort Order': 1,
    'Is Available': 'TRUE',
    'Use Day Pricing': 'FALSE'
  },
  {
    Action: 'Update',
    'Item ID': 'EXISTING_ITEM_ID_FOR_UPDATE',
    'Item Name': '',
    Description: '',
    'Category Name': 'ORIGINAL CATEGORY NAME',
    'Category ID (Optional)': 'NUMERIC_ID_IF_KNOWN',
    Price: '',
    Currency: '',
    'Sort Order': '',
    'Is Available': '',
    'Use Day Pricing': ''
  }
];

const workbook = XLSX.utils.book_new();

const categorySheet = XLSX.utils.json_to_sheet(categoryRows, {
  header: [
    'Action',
    'Category ID',
    'Category Name',
    'Parent ID',
    'Parent Name',
    'Sort Order',
    'Is Visible',
    'Has Time Availability',
    'Available From',
    'Available To'
  ]
});

const itemSheet = XLSX.utils.json_to_sheet(itemRows, {
  header: [
    'Action',
    'Item ID',
    'Item Name',
    'Description',
    'Category Name',
    'Category ID (Optional)',
    'Price',
    'Currency',
    'Sort Order',
    'Is Available',
    'Use Day Pricing'
  ]
});

XLSX.utils.book_append_sheet(workbook, categorySheet, 'Categories');
XLSX.utils.book_append_sheet(workbook, itemSheet, 'Items');

XLSX.writeFile(workbook, OUTPUT);

console.log(`✓ Wrote template to ${OUTPUT}`);
