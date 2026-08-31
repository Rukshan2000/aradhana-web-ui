const U = (id, w, h) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

export const couple = {
  bride: 'Aradhana',
  groom: 'Sithika',
  hashtag: '#AradhanaWedsSithika',
  date: '2026-12-12T16:30:00+05:30',
  dateLabel: 'Saturday, the twelfth of December',
  yearLabel: 'Two thousand twenty six',
  city: 'Kandy, Sri Lanka',
};

/* The invitation is addressed to one household; change these two lines
   to re-address the whole page. */
export const guest = {
  name: 'Kevin Perea',
  household: 'and Family',
};

export const hero = {
  src: U('photo-1537633552985-df8429e8048b', 2000, 1250),
  alt: 'The couple beneath a flowing veil on the shore at dusk',
};

export const story = [
  {
    year: '2019',
    title: 'The first evening',
    text: 'A mutual friend’s birthday, a crowded rooftop, and a conversation that outlasted everyone else at the table.',
    photo: U('photo-1460978812857-470ed1c77af0', 900, 1200),
    alt: 'Black and white portrait of the couple beneath a veil',
  },
  {
    year: '2022',
    title: 'The long way home',
    text: 'Two cities, a hundred train journeys, and the slow discovery that the distance never once felt like doubt.',
    photo: U('photo-1478146896981-b80fe463b330', 900, 1200),
    alt: 'Bride in a floral dress on an open road',
  },
  {
    year: '2025',
    title: 'The question',
    text: 'On a quiet morning by the lake, with no audience and no rehearsal — just yes, and then laughter, and then tea.',
    photo: U('photo-1591604466107-ec97de577aff', 900, 1200),
    alt: 'The couple together in the golden light of autumn',
  },
];

export const gallery = [
  { src: U('photo-1519741497674-611481863552', 1000, 1400), alt: 'Groom holding the bridal bouquet', span: 'tall' },
  { src: U('photo-1465495976277-4387d4b0b4c6', 1200, 900), alt: 'Joined hands and wedding rings above a bouquet', span: 'wide' },
  { src: U('photo-1583939003579-730e3918a45a', 1000, 1000), alt: 'Confetti thrown over the couple as they kiss', span: '' },
  { src: U('photo-1511285560929-80b456fea0bc', 1200, 900), alt: 'Ceremony beside the water with balloons released', span: '' },
  { src: U('photo-1606216794074-735e91aa2c92', 1000, 1400), alt: 'The wedding party walking beneath palms', span: 'tall' },
  { src: U('photo-1519225421980-715cb0215aed', 1200, 900), alt: 'Long reception table set with wildflowers', span: 'wide' },
];

/* Extra frames the gallery cycles in — no layout span, they only ever
   replace a tile's photo, so the mosaic geometry stays fixed. */
export const galleryPool = [
  { src: U('photo-1522673607200-164d1b6ce486', 1200, 900), alt: 'Guests raising glasses at the reception' },
  { src: U('photo-1507504031003-b417219a0fde', 1000, 1400), alt: 'The bride adjusting her veil before the ceremony' },
  { src: U('photo-1520854221256-17451cc331bf', 1200, 900), alt: 'First dance under warm string lights' },
  { src: U('photo-1478146896981-b80fe463b330', 1000, 1400), alt: 'The couple walking an open road at golden hour' },
  { src: U('photo-1525772764200-be829a350797', 1200, 900), alt: 'Wedding cake dressed with fresh flowers' },
];

export const details = [
  {
    label: 'The Ceremony',
    time: '4:30 in the afternoon',
    venue: 'St. Anne’s Chapel',
    address: '14 Temple Lane, Kandy',
    note: 'Guests are asked to be seated by 4:15.',
  },
  {
    label: 'The Reception',
    time: '7:00 in the evening',
    venue: 'The Lakeside Pavilion',
    address: 'Rajapihilla Mawatha, Kandy',
    note: 'Dinner, dancing, and far too much cake.',
  },
];

export const schedule = [
  { time: '4:30 pm', event: 'Ceremony' },
  { time: '5:30 pm', event: 'Golden-hour photographs' },
  { time: '6:30 pm', event: 'Cocktails on the terrace' },
  { time: '7:00 pm', event: 'Dinner is served' },
  { time: '8:30 pm', event: 'Toasts & first dance' },
  { time: '12:00 am', event: 'Farewell sparklers' },
];

export const venuePhoto = {
  src: U('photo-1522673607200-164d1b6ce486', 1800, 1100),
  alt: 'Two ceremony chairs set on a lawn overlooking the water',
};
