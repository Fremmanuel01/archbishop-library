/**
 * Seed pastoral letters from archbishopvalokeke.org into the CMS.
 * Usage: node scripts/seed-pastoral-letters.js [API_BASE_URL]
 * Default: http://localhost:3000
 */

const BASE = process.argv[2] || 'http://localhost:3000';

const letters = [
  {
    title: 'On Virtues and Capital Sins',
    date: '2026-01-01',
    description: 'The letter emphasizes that a virtuous life makes humans good and is essential for families and society.',
    cover_photo_url: 'https://archbishopvalokeke.org/wp-content/uploads/2026/04/Pastoral-Letter_2026-217x300.jpeg',
    pdf_url: null
  },
  {
    title: 'Blessed Are the Pure in Heart',
    date: '2025-01-01',
    description: 'A pastoral reflection on purity of heart and its significance in the Christian life.',
    cover_photo_url: null,
    pdf_url: 'http://archbishopvalokeke.org/wp-content/uploads/2025/05/THE-HOUR-OF-GLORY-Pastoral-Letter-2023.pdf'
  },
  {
    title: 'And the Two Become One: Towards a Christian Marriage',
    date: '2024-01-01',
    description: 'A pastoral guide on the sacrament of Christian marriage and its significance.',
    cover_photo_url: null,
    pdf_url: 'http://archbishopvalokeke.org/wp-content/uploads/2024/09/2024_Pastoral_Letter.pdf'
  },
  {
    title: 'The Hour of Glory: Suffering in the Life of a Christian',
    date: '2023-01-01',
    description: 'Reflections on the meaning of suffering in the Christian journey and how it leads to glory.',
    cover_photo_url: null,
    pdf_url: 'http://archbishopvalokeke.org/wp-content/uploads/2025/05/Pastoral-Letter-2022_The-Holy-Spirit_Mens-Helper-and-Friend.pdf'
  },
  {
    title: "The Holy Spirit: Man's Helper and Friend",
    date: '2022-01-01',
    description: 'An exploration of the Holy Spirit as helper, guide, and friend in the life of every believer.',
    cover_photo_url: null,
    pdf_url: 'http://archbishopvalokeke.org/wp-content/uploads/2025/05/Pastoral-Letter-2021_The-Priest-Good_Gift-and-Sacrifice.pdf'
  },
  {
    title: 'The Priesthood: Gift and Sacrifice',
    date: '2021-01-01',
    description: 'A pastoral letter on the sacred calling of the priesthood as both gift and sacrifice.',
    cover_photo_url: null,
    pdf_url: 'https://archbishopvalokeke.org/wp-content/uploads/2020/06/THE-SACRAMENTS-OUR-TREASURE.pdf'
  },
  {
    title: 'The Sacrament Our Treasure',
    date: '2020-01-01',
    description: 'A reflection on the sacraments as treasures of the Church and their role in salvation.',
    cover_photo_url: null,
    pdf_url: 'https://archbishopvalokeke.org/wp-content/uploads/2020/06/pl2019.pdf'
  },
  {
    title: 'The Holy Eucharist Our Strength',
    date: '2019-01-01',
    description: 'A pastoral teaching on the Holy Eucharist as the source and summit of Christian life.',
    cover_photo_url: null,
    pdf_url: 'https://archbishopvalokeke.org/wp-content/uploads/2020/06/pl2018.pdf'
  },
  {
    title: 'Mary Our Mother',
    date: '2018-01-01',
    description: 'A devotional pastoral letter on the Blessed Virgin Mary and her role as Mother of the Church.',
    cover_photo_url: null,
    pdf_url: 'https://archbishopvalokeke.org/wp-content/uploads/2020/08/BLESSED-ARE-THE-PEACEMAKERS.pdf'
  },
  {
    title: 'Blessed Are the Peacemakers',
    date: '2017-01-01',
    description: 'A call to the faithful to be instruments of peace in their communities and the world.',
    cover_photo_url: null,
    pdf_url: 'https://archbishopvalokeke.org/wp-content/uploads/2020/08/BLESSED-ARE-THE-MERCIFUL.pdf'
  },
  {
    title: 'Blessed Are The Merciful',
    date: '2016-01-01',
    description: 'A pastoral reflection on the beatitude of mercy and its practice in daily Christian living.',
    cover_photo_url: null,
    pdf_url: 'https://archbishopvalokeke.org/wp-content/uploads/2020/10/PASTORAL-LETTER-2014-Catholic-Education-and-National-Development-converted.pdf'
  },
  {
    title: 'Democracy And Christian Values',
    date: '2015-01-01',
    description: 'An examination of how Christian values should inform democratic participation and governance.',
    cover_photo_url: null,
    pdf_url: null
  },
  {
    title: 'Catholic Education And National Development',
    date: '2014-01-01',
    description: 'A pastoral letter on the vital role of Catholic education in national development.',
    cover_photo_url: null,
    pdf_url: 'https://archbishopvalokeke.org/wp-content/uploads/2020/08/LIVING-HOPE.pdf'
  },
  {
    title: 'Living Hope',
    date: '2013-01-01',
    description: 'A message of living hope drawn from faith in the Risen Christ.',
    cover_photo_url: null,
    pdf_url: 'https://archbishopvalokeke.org/wp-content/uploads/2020/08/THE-DIGNITY-OF-LABOUR.pdf'
  },
  {
    title: 'The Dignity of Human Labour',
    date: '2012-01-01',
    description: 'A pastoral teaching on the dignity of work and its role in human fulfillment.',
    cover_photo_url: null,
    pdf_url: 'https://archbishopvalokeke.org/wp-content/uploads/2020/10/Pastoral-letter-2011-Gratitude.pdf'
  },
  {
    title: 'Gratitude',
    date: '2011-01-01',
    description: 'A reflection on the virtue of gratitude and thanksgiving in the life of a Christian.',
    cover_photo_url: null,
    pdf_url: 'https://archbishopvalokeke.org/wp-content/uploads/2020/10/Pastoral-letter-2011-Gratitude.pdf'
  },
  {
    title: 'The Splendour of Our Prayer',
    date: '2010-01-01',
    description: 'A pastoral guide on the beauty and power of prayer in the Christian tradition.',
    cover_photo_url: null,
    pdf_url: 'https://archbishopvalokeke.org/wp-content/uploads/2020/08/OUR-GREATEST-LEGACY-1.pdf'
  },
  {
    title: 'Our Greatest Legacy',
    date: '2009-01-01',
    description: 'A pastoral reflection on the legacy of faith passed from generation to generation.',
    cover_photo_url: null,
    pdf_url: 'https://archbishopvalokeke.org/wp-content/uploads/2020/10/THE-FAMILY-AND-HUMAN-LIFE-PASTORAL-LETTER-2008-converted.pdf'
  },
  {
    title: 'The Family & Human Life',
    date: '2008-01-01',
    description: 'A pastoral letter on the sanctity of family life and the dignity of human life.',
    cover_photo_url: null,
    pdf_url: 'https://archbishopvalokeke.org/wp-content/uploads/2020/10/YOU-AND-THE-COMMON-GOOD-2007.pdf'
  },
  {
    title: 'You and the Common Good',
    date: '2007-01-01',
    description: 'A call to Christians to contribute to the common good of society.',
    cover_photo_url: null,
    pdf_url: 'https://archbishopvalokeke.org/wp-content/uploads/2020/08/OUR-GLORIOUS-HERITAGE.pdf'
  },
  {
    title: 'Our Glorious Heritage',
    date: '2006-01-01',
    description: 'A celebration of the rich heritage of the Catholic faith in the Archdiocese.',
    cover_photo_url: null,
    pdf_url: 'https://archbishopvalokeke.org/wp-content/uploads/2020/10/THE-MEASURE-OF-LOVE-2005-2.pdf'
  },
  {
    title: 'If Only You Have Faith',
    date: '2005-06-01',
    description: 'A pastoral encouragement on the transformative power of faith.',
    cover_photo_url: null,
    pdf_url: null
  },
  {
    title: 'The Measure of Love',
    date: '2005-01-01',
    description: 'A pastoral reflection on the meaning and measure of Christian love.',
    cover_photo_url: null,
    pdf_url: 'https://archbishopvalokeke.org/wp-content/uploads/2020/10/Pastoral-Letter-2004-THAT-THEY-MAY-HAVE-LIFE.pdf'
  },
  {
    title: 'That They May Have Life',
    date: '2004-01-01',
    description: 'A pastoral letter inspired by the Gospel message of abundant life in Christ.',
    cover_photo_url: null,
    pdf_url: null
  }
];

async function seed() {
  console.log(`\nSeeding ${letters.length} pastoral letters to ${BASE}\n`);

  /* Login */
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: process.env.ADMIN_RAW_PASSWORD || 'Kaycey.121225.' })
  });
  const loginData = await loginRes.json();

  if (!loginData.success) {
    console.error('Login failed:', loginData.message);
    process.exit(1);
  }

  const token = loginData.data.token;
  console.log('Logged in successfully.\n');

  /* Seed via the seed endpoint */
  for (let i = 0; i < letters.length; i++) {
    const letter = letters[i];
    try {
      const res = await fetch(`${BASE}/api/pastoral-letters/seed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(letter)
      });

      const data = await res.json();

      if (data.success) {
        console.log(`  [${i + 1}/${letters.length}] ✓ ${letter.title}`);
      } else {
        console.log(`  [${i + 1}/${letters.length}] ✗ ${letter.title}: ${data.message}`);
      }
    } catch (err) {
      console.log(`  [${i + 1}/${letters.length}] ✗ ${letter.title}: ${err.message}`);
    }
  }

  console.log('\nSeeding complete!');
}

seed().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
