/**
 * The starting point for a couple's plan: what usually has to happen, and
 * roughly when, for a Sri Lankan wedding.
 *
 * It is a starting point and nothing more — every task and every budget line
 * can be edited, added to or deleted, and the couple's own copy lives in
 * their browser from the first change onward. The order inside each phase is
 * the order things tend to block each other: the nekath fixes the date, the
 * date fixes the venue, the venue fixes almost everything else.
 */
export const PHASES = [
  {
    id: 'twelve',
    label: '12 months out',
    note: 'The decisions everything else hangs off.',
    tasks: [
      'Agree the nekath (auspicious times) with the astrologer',
      'Set the overall budget and who is contributing',
      'Draft the guest list — a rough head count is enough',
      'Shortlist and visit venues for the poruwa and the reception',
      'Book the venue and pay the deposit',
      'Book the photographer and videographer',
    ],
  },
  {
    id: 'nine',
    label: '9 months out',
    note: 'The suppliers who take the longest to make things.',
    tasks: [
      'Book the caterer and agree the menu style',
      'Order the bridal saree / osariya and start fittings',
      'Book the poruwa decorator and the floral team',
      'Book the band, DJ or hewisi drummers',
      'Reserve rooms for out-of-town family',
      'Book the bridal dresser (hair and makeup)',
    ],
  },
  {
    id: 'six',
    label: '6 months out',
    note: 'Everything that has to be designed or made.',
    tasks: [
      'Design the invitation and collect guest addresses',
      'Set up the invitation site and add every invitee',
      'Choose the rings',
      'Order the wedding cake and the cake-cutting knife',
      'Plan the honeymoon and check passport expiry dates',
      'Confirm the groom\'s suit or national dress',
    ],
  },
  {
    id: 'three',
    label: '3 months out',
    note: 'Sending, testing and paperwork.',
    tasks: [
      'Send the invitations and share the invitation links',
      'Give notice of marriage to the Registrar',
      'Hair and makeup trial',
      'Book transport for the couple and both families',
      'Confirm the poruwa ceremony order with the master of ceremonies',
      'Arrange the homecoming (gedara pemineema) details',
    ],
  },
  {
    id: 'one',
    label: '1 month out',
    note: 'Turning replies into arrangements.',
    tasks: [
      'Chase anyone who has not replied',
      'Give the caterer the final head count',
      'Draw up the seating plan',
      'Write the day-of timeline and share it with every supplier',
      'Buy the poruwa items — betel leaves, oil lamp, milk rice, coins',
      'Buy gifts for the bridal party and both families',
    ],
  },
  {
    id: 'week',
    label: 'The week before',
    note: 'Confirming, paying, packing.',
    tasks: [
      'Confirm arrival times with every supplier',
      'Make the final payments and set aside cash for tips',
      'Rehearse the poruwa with both families',
      'Pack for the wedding night and the honeymoon',
      'Hand the rings and documents to whoever is holding them',
    ],
  },
  {
    id: 'day',
    label: 'On the day',
    note: 'What someone other than the couple should be carrying.',
    tasks: [
      'Emergency kit — safety pins, thread, plasters, painkillers, water',
      'Marriage certificate paperwork and the registrar\'s file',
      'The rings, the cake knife and the signing pen',
      'Phone numbers for every supplier on one printed sheet',
      'Eat something before the ceremony',
    ],
  },
];

/** Typical line items, in the order money usually leaves the account. */
export const BUDGET_LINES = [
  { label: 'Venue and reception hall', planned: 0 },
  { label: 'Catering and drinks', planned: 0 },
  { label: 'Photography and video', planned: 0 },
  { label: 'Bridal saree and dressing', planned: 0 },
  { label: 'Groom\'s outfit', planned: 0 },
  { label: 'Poruwa and floral decor', planned: 0 },
  { label: 'Music and entertainment', planned: 0 },
  { label: 'Cake and sweets', planned: 0 },
  { label: 'Invitations and stationery', planned: 0 },
  { label: 'Rings and jewellery', planned: 0 },
  { label: 'Transport', planned: 0 },
  { label: 'Honeymoon', planned: 0 },
];

/** The suppliers worth having a phone number for in one place. */
export const VENDOR_ROLES = [
  'Venue', 'Caterer', 'Photographer', 'Videographer', 'Poruwa decorator',
  'Florist', 'Bridal dresser', 'Music / DJ', 'Cake', 'Transport', 'Astrologer',
];
