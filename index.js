import fetch from 'node-fetch';
import db from './db.js';

const EVENT_ID = Number(process.env.LETSREG_EVENT_ID);

const API_TOKEN = process.env.LETSREG_TOKEN;
const API_URL = `https://organizer.deltager.no/api/v1/events/${EVENT_ID}/participants`;

async function fetchData() {
  const res = await fetch(API_URL, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  return await res.json();
}

const data = await fetchData();

const arrangement = await db
  .table('arrangementer')
  .where('letsreg_id', EVENT_ID)
  .first();
if (!arrangement) {
  console.error(
    `Arrangement with letsreg_id ${EVENT_ID} not found in database.`,
  );
  /*
  await db.table('arrangementer').insert({
    letsreg_id: EVENT_ID,
    navn: data.eventTitle,
    starttid: new Date(data.registrationStartDate),
    pameldingsfrist: new Date(data.registrationEndDate),
  });
  */
  process.exit(1);
}

const COLUMN_TO_DB_COLUMN = {
  Id: 'letsreg_id',
  Ordrenummer: 'letsreg_ordre_id',
  Fornavn: 'fornavn',
  Etternavn: 'etternavn',
  'E-postadresse': 'epostadresse',
  Telefonnummer: 'telefonnummer',
  Instrument: 'instrument',
  'Annen info (aktuelle noter du ønsker tilsendt)': 'annen_info',
};

let added_counter = 0;

for (const participant of data.rows) {
  const columns = data.headers.map((h) => h.name);
  const participantValues = new Map(
    participant.columns.map((value, index) => [columns[index], value]),
  );

  const letsregId = participantValues.get('Id');
  const row = Object.fromEntries(
    Object.entries(COLUMN_TO_DB_COLUMN).map(([columnName, dbColumn]) => {
      return [dbColumn, participantValues.get(columnName) || ''];
    }),
  );
  row.arrangement_id = arrangement.id;
  const existing = await db
    .table('deltakere')
    .where('letsreg_id', letsregId)
    .first();

  if (!existing) {
    await db.table('deltakere').insert(row);
    added_counter++;
  }
}

console.log(`Added ${added_counter} new participants.`);

await db.destroy();
