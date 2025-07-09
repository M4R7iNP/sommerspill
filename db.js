import knex from 'knex';
const pg = knex({
  client: 'pg',
  pool: {
    min: 1,
    max: 8,
  },
  connection: process.env.PG_CONNECTION_STRING,
});
export default pg;
