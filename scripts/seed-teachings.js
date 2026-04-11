/**
 * Seed Reflections (homilies table) and Other Teachings (writings table) into the CMS.
 * Usage: node scripts/seed-teachings.js [API_BASE_URL]
 * Default: http://localhost:3000
 */

const BASE = process.argv[2] || 'http://localhost:3000';

/* ── Reflections (stored in homilies table) ──────────────── */

const reflections = [
  {
    title: 'Homily at the Dedication of the Chapel of Blessed Iwene Tansi Major Seminary, Onitsha',
    date: '2023-10-21',
    occasion: 'Chapel Dedication'
  },
  {
    title: 'Homily at the 40th Priestly Anniversary of Most Rev. Jude Thaddeus Okolo',
    date: '2023-10-13',
    occasion: 'Priestly Anniversary'
  },
  {
    title: 'It Is No Longer I Who Live (Gal 2:20ff)',
    date: '2020-09-26',
    occasion: 'Reflection'
  },
  {
    title: 'The Beauty and Splendour of Consecrated Life',
    date: '2020-09-05',
    occasion: 'Reflection'
  },
  {
    title: 'Installation of Most Rev. Peter Okpaleke',
    date: '2020-04-29',
    occasion: 'Episcopal Installation'
  },
  {
    title: 'Installation of Archbishop Ignatius Ayau Kaigama',
    date: '2019-12-05',
    occasion: 'Archiepiscopal Installation'
  },
  {
    title: 'In The House Of God There Are No Outsiders',
    date: '2019-08-25',
    occasion: 'Reflection'
  },
  {
    title: 'Dedication of Chapel of Divine Mercy, Pope John Paul II Major Seminary, Awka',
    date: '2019-04-28',
    occasion: 'Chapel Dedication'
  },
  {
    title: 'Corpus Christi',
    date: '2018-05-22',
    occasion: 'Feast Day'
  },
  {
    title: 'Lecture for Enugu Diocesan Synod',
    date: '2018-05-20',
    occasion: 'Synod'
  }
];

/* ── Other Teachings (stored in writings table) ──────────── */

const writings = [
  /* Addresses */
  { title: 'Christians Interrogate the Caste Systems in the Nigerian Society and Constitution', date: '2021-08-31', category: 'Address', occasion: 'AquaViva Conference' },
  { title: 'Keynote Address at the 6th Convocation Ceremony of Blessed Iwene Tansi Seminary', date: '2020-03-21', category: 'Address', occasion: '6th Convocation Ceremony' },
  { title: "Address of Welcome at Onitsha/Owerri Provincial Bishops' Meeting", date: '2019-11-18', category: 'Address', occasion: "Provincial Bishops' Meeting, Enugu" },
  { title: 'Second Onitsha Archdiocesan Synod', date: '2016-05-22', category: 'Address', occasion: 'Archdiocesan Synod Opening' },
  { title: 'Ordination of Most Rev. Godfrey Onah of Nsukka', date: '2013-07-04', category: 'Address', occasion: 'Episcopal Ordination' },
  { title: 'NFCS UNIZIK Address', date: '2012-08-29', category: 'Address', occasion: 'NFCS UNIZIK Gathering' },
  { title: "Onitsha Stakeholders' Forum, Phase II", date: '2010-11-27', category: 'Address', occasion: "Stakeholders' Forum, Shanahan Hall" },
  { title: 'Address to Catholic Principals, Onitsha Archdiocese', date: '2010-11-26', category: 'Address', occasion: 'Catholic Principals Meeting' },

  /* Messages */
  { title: '2023 Easter Message: In Faith and Prayers, We Move', date: '2023-12-06', category: 'Message', occasion: 'Easter 2023' },
  { title: '2022 Christmas Message: Do Not Be Afraid', date: '2022-12-06', category: 'Message', occasion: 'Christmas 2022' },
  { title: '2021 Christmas Message: Let Us Journey With Faith', date: '2021-12-27', category: 'Message', occasion: 'Christmas 2021' },
  { title: "2021 Easter Message: Be Your Brother's Keeper", date: '2021-04-06', category: 'Message', occasion: 'Easter 2021' },
  { title: '2020 Easter Message: Keep Hope Alive', date: '2020-04-12', category: 'Message', occasion: 'Easter 2020' },
  { title: '2019 Christmas Message: Be Joy to the World', date: '2019-12-15', category: 'Message', occasion: 'Christmas 2019' },
  { title: '2018 Christmas Message: Practise Justice and Charity', date: '2018-12-16', category: 'Message', occasion: 'Christmas 2018' },

  /* Interviews */
  { title: 'Pro-Life/Anti-AIDS Campaign Movement: Seminarians for Life', date: '2021-12-02', category: 'Interview', occasion: 'Seminarians for Life Forum' },
  { title: 'Archbishop Interview: Mind Opener', date: '2021-05-21', category: 'Interview', occasion: 'Mind Opener Magazine' },
  { title: 'Interview with the Ambassador Magazine', date: '2018-10-25', category: 'Interview', occasion: 'Ambassador Magazine' },
  { title: 'Interview with the Treasure Magazine', date: '2018-06-25', category: 'Interview', occasion: 'Treasure Magazine' },
  { title: 'Interview with the Guardian', date: '2018-01-02', category: 'Interview', occasion: 'The Guardian Newspaper' },
  { title: 'Interview With His Grace', date: '2009-06-29', category: 'Interview', occasion: 'Personal Interview' }
];

async function seed() {
  console.log(`\nSeeding teachings to ${BASE}\n`);

  /* Login */
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Kaycey.121225.' })
  });
  const loginData = await loginRes.json();

  if (!loginData.success) {
    console.error('Login failed:', loginData.message);
    process.exit(1);
  }

  const token = loginData.data.token;
  console.log('Logged in successfully.\n');

  /* ── Seed Reflections (homilies table) ──────── */
  console.log(`--- Seeding ${reflections.length} Reflections ---\n`);

  for (let i = 0; i < reflections.length; i++) {
    const item = reflections[i];
    try {
      const res = await fetch(`${BASE}/api/homilies/seed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(item)
      });

      const data = await res.json();

      if (data.success) {
        const status = data.message && data.message.includes('skipped') ? 'SKIP' : 'OK';
        console.log(`  [${i + 1}/${reflections.length}] ${status} ${item.title}`);
      } else {
        console.log(`  [${i + 1}/${reflections.length}] FAIL ${item.title}: ${data.message}`);
      }
    } catch (err) {
      console.log(`  [${i + 1}/${reflections.length}] FAIL ${item.title}: ${err.message}`);
    }
  }

  /* ── Seed Other Teachings (writings table) ──── */
  console.log(`\n--- Seeding ${writings.length} Other Teachings ---\n`);

  for (let i = 0; i < writings.length; i++) {
    const item = writings[i];
    try {
      const res = await fetch(`${BASE}/api/writings/seed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(item)
      });

      const data = await res.json();

      if (data.success) {
        const status = data.message && data.message.includes('skipped') ? 'SKIP' : 'OK';
        console.log(`  [${i + 1}/${writings.length}] ${status} ${item.title}`);
      } else {
        console.log(`  [${i + 1}/${writings.length}] FAIL ${item.title}: ${data.message}`);
      }
    } catch (err) {
      console.log(`  [${i + 1}/${writings.length}] FAIL ${item.title}: ${err.message}`);
    }
  }

  console.log('\nSeeding complete!');
}

seed().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
