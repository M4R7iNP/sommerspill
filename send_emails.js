import { readFile } from 'node:fs/promises';
import db from './db.js';
import FormData from 'form-data'; // form-data v4.0.1
import Mailgun from 'mailgun.js'; // mailgun.js v11.1.0
import { format } from 'date-fns';
import { nb } from 'date-fns/locale/nb';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const EVENT_ID = Number(process.env.LETSREG_EVENT_ID);
const INSTRUMENT_LINKS_PATH = process.env.INSTRUMENT_LINKS_PATH;

const INSTRUMENT_LINKS = JSON.parse(
  await readFile(INSTRUMENT_LINKS_PATH, 'utf-8'),
);

const mailgun = new Mailgun(FormData);

const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY,
  url: 'https://api.eu.mailgun.net',
});

const event = await db
  .table('arrangementer')
  .where('letsreg_id', EVENT_ID)
  .first();

const DATO = new Date(event.starttid);
const DATO_STR = format(DATO, 'd. MMMM yyyy', { locale: nb });

const DIRIGENT = event?.dirigent;

if (!event || !DIRIGENT || !DATO || !DATO_STR) {
  console.error(
    `Arrangement ${EVENT_ID} not found in database or dirigent not set.`,
  );
  process.exit(1);
}

const participants = await db
  .table('deltakere')
  .where('arrangement_id', event.id)
  .where('noter_sendt_ut', null);

/**
 * @param {{ dirigent: string; instrument: string; lenke: string }} variables
 */
async function sendSimpleMessageTemplate(variables, to) {
  const data = await mg.messages.create('mg.ralingenmusikklag.no', {
    from: 'Sommerspill i Rælingen <sommerspill@ralingenmusikklag.no>',
    to: [to],
    bcc: ['sommerspill@ralingenmusikklag.no'],
    subject: `Sommerspill i Rælingen ${DATO_STR}`,
    template: 'sommerspill test',
    'h:X-Mailgun-Variables': JSON.stringify(variables),
  });
  console.log(data); // logs response data
}

for (const participant of participants) {
  const instrument = participant.instrument;
  const gdriveUrl = INSTRUMENT_LINKS[instrument];
  if (!gdriveUrl) {
    console.error(`No GDrive URL mapping found for instrument: ${instrument}`);
    continue;
  }

  const variables = {
    dirigent: DIRIGENT,
    instrument: instrument,
    lenke: gdriveUrl,
    dato: DATO_STR,
  };

  try {
    await db.table('deltakere').where('id', participant.id).update({
      noter_sendt_ut: new Date(),
    });
    await sendSimpleMessageTemplate(variables, participant.epostadresse);
    console.log(
      `Sent email to ${participant.fornavn} ${participant.etternavn} (${participant.epostadresse})`,
    );
  } catch (error) {
    console.error(
      `Failed to send email to ${participant.fornavn} ${participant.etternavn}:`,
      error,
    );
  }

  await sleep(10_000); // Sleep for to avoid hitting rate limits
}

await db.destroy();
