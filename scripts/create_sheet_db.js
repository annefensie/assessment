/**
 * create_sheet_db.js — One-time helper script (run locally with Node).
 *
 * This script is NOT Apps Script. It uses the Google Sheets API via a
 * service-account key to create the spreadsheet and set the script property.
 *
 * Prerequisites:
 *   npm install googleapis
 *   Export a service-account JSON key to ./service-account.json
 *   Share the target spreadsheet (or folder) with the service account email.
 *
 * Usage:
 *   node scripts/create_sheet_db.js <spreadsheet-id>
 *
 * After running, paste the spreadsheet ID into your Apps Script project's
 * Script Properties as SPREADSHEET_ID, then run setupAll() from the Apps
 * Script editor.
 */

const { google } = require('googleapis');
const fs = require('fs');

async function main() {
  const spreadsheetId = process.argv[2];
  if (!spreadsheetId) {
    console.error('Usage: node scripts/create_sheet_db.js <spreadsheet-id>');
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: './service-account.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  console.log('Connected to spreadsheet:', meta.data.properties.title);
  console.log('Spreadsheet ID:', spreadsheetId);
  console.log('\nNext steps:');
  console.log('1. Open your Apps Script project at script.google.com');
  console.log('2. Go to Project Settings > Script Properties');
  console.log('3. Add property: SPREADSHEET_ID =', spreadsheetId);
  console.log('4. Run setupAll() from the Apps Script editor');
}

main().catch(console.error);
