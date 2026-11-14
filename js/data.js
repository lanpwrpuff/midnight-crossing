// Shared writing used by every location: wounds, motives, guests, items and spooky lines.
// Location-specific content (rooms, weapons, names) lives in places.js.
(function () {
  'use strict';
  const MC = (window.MC = window.MC || {});

  MC.DATA = {
    wounds: {
      blunt: 'A single heavy blow. Something solid and weighty.',
      sharp: 'A narrow wound. Something with a point or an edge.',
      strangle: 'Faint marks around the throat, as if from a cord or strap pulled tight.',
    },

    // {s} = the suspect, {v} = the victim. Everyone has a motive: motives alone never solve the case.
    motives: [
      '{s} owed {v} a great deal of money, and {v} had stopped being patient about it.',
      "{v} had found out a secret from {s}'s past and was threatening to tell everyone.",
      "{s} was cut out of {v}'s will only last week.",
      "{v} ruined {s}'s reputation years ago. {s} has never forgotten it.",
      '{s} and {v} were heard arguing bitterly earlier this evening.',
      'Last spring, {v} won the house {s} grew up in, in a game of cards.',
      '{v} had been blackmailing {s} for months.',
      '{v} stole the idea that should have made {s} famous.',
      '{s} was in love with {v}, and {v} laughed about it in front of everyone.',
    ],

    // The red herring: an innocent guest who lies about where they were, for a harmless reason.
    secrets: [
      'slipped off to the {room} to read a love letter, and was too embarrassed to say so',
      'was in the {room} eating an entire second pudding in secret',
      'was in the {room} trying to hold a séance alone',
      'went to the {room} for a quiet cry where nobody could see',
      'was in the {room} hunting for a ring lost years ago, and was mortified to admit it',
      'was in the {room} practising a speech for a wedding, badly',
    ],

    traceReasons: [
      'the cold cup of tea beside it',
      'the half-melted ice in a glass nearby',
      'how fresh the scuff marks around it are',
    ],

    omens: [
      'The lamps dim all at once, then return, as if the whole place took a breath.',
      'A child laughs somewhere down the corridor. There are no children here.',
      'You smell lilies, the kind people bring to funerals.',
      'A door you closed is standing open again.',
      'Far off, someone is singing an old lullaby, very slowly.',
      'Every clock you can hear is ticking in time with your heartbeat.',
    ],
  };

  // Guests are built fresh for every case from these pools.
  MC.PEOPLE = {
    // g: f / m / n decides which old-fashioned honorifics fit (Mrs./Miss, Mr., or none).
    firstNames: {
      old: [
        { n: 'Hester', g: 'f' }, { n: 'Clementine', g: 'f' }, { n: 'Odette', g: 'f' }, { n: 'Ida', g: 'f' },
        { n: 'Beatrice', g: 'f' }, { n: 'Winifred', g: 'f' }, { n: 'Agnes', g: 'f' }, { n: 'Cordelia', g: 'f' },
        { n: 'Mabel', g: 'f' }, { n: 'Florence', g: 'f' }, { n: 'Rosalind', g: 'f' }, { n: 'Imogen', g: 'f' },
        { n: 'Violet', g: 'f' }, { n: 'Dorothea', g: 'f' },
        { n: 'Ambrose', g: 'm' }, { n: 'Lucien', g: 'm' }, { n: 'Tobias', g: 'm' }, { n: 'Jasper', g: 'm' },
        { n: 'Silas', g: 'm' }, { n: 'Percival', g: 'm' }, { n: 'Edmund', g: 'm' }, { n: 'Cornelius', g: 'm' },
        { n: 'Rupert', g: 'm' }, { n: 'Horace', g: 'm' }, { n: 'Leopold', g: 'm' }, { n: 'Archibald', g: 'm' },
        { n: 'Felix', g: 'm' }, { n: 'Bartholomew', g: 'm' },
        { n: 'Nell', g: 'n' }, { n: 'Frankie', g: 'n' }, { n: 'Sidney', g: 'n' },
      ],
      modern: [
        'Maya', 'Jordan', 'Priya', 'Leo', 'Sam', 'Aiden', 'Zara', 'Mateo', 'Chloe', 'Riley', 'Theo', 'Noor',
        'Kai', 'Ines', 'Marcus', 'Hana', 'Dev', 'Ruby', 'Sasha', 'Omar', 'Freya', 'Quinn', 'Luca', 'Tamsin',
      ],
    },
    lastNames: [
      'Bramble', 'Whitlock', 'Ashby', 'Finch', 'Marchmont', 'Quill', 'Holloway', 'Garrow', 'Vey', 'Rook',
      'Thorne', 'Pemberton', 'Lark', 'Hartley', 'Crane', 'Moss', 'Blackwood', 'Fairweather', 'Sterling',
      'Okafor', 'Nakamura', 'Castellanos', 'Lindqvist', 'Petrov', 'Adeyemi', 'Moreau', 'Kowalski', 'Singh',
      'Delacroix', 'Whitcombe', 'Hale', 'Ravenscroft', 'Gallagher', 'Mbeki', 'Fontaine', 'Sato',
    ],
    // w = wealth (1 modest, 2 comfortable, 3 rich). Rich guests guard their belongings more (used later).
    // hon = honorific the job always brings with it.
    jobs: {
      old: [
        { t: 'retired schoolteacher', w: 2 }, { t: 'retired army officer', w: 2, hon: 'Colonel' },
        { t: 'spiritualist and medium', w: 2 }, { t: 'author of lurid romance novels', w: 2 },
        { t: 'heir to a shipping fortune', w: 3 }, { t: 'folklorist collecting ghost stories', w: 2, hon: 'Professor' },
        { t: 'travelling seller of curios', w: 1 }, { t: 'society photographer', w: 2 },
        { t: 'retired opera singer', w: 3 }, { t: 'country doctor', w: 2, hon: 'Dr.' },
        { t: 'jeweller', w: 3 }, { t: 'private secretary', w: 1 }, { t: 'silent-film star', w: 3 },
        { t: 'private tutor', w: 1 }, { t: 'ghost-hunting vicar', w: 1, hon: 'Reverend' }, { t: 'racehorse owner', w: 3 },
      ],
      modern: [
        { t: 'true-crime podcaster', w: 1 }, { t: 'tech founder', w: 3 }, { t: 'retired police detective', w: 2 },
        { t: 'lifestyle influencer', w: 3 }, { t: 'night-shift nurse', w: 1 }, { t: 'antiques dealer', w: 2 },
        { t: 'wedding planner', w: 2 }, { t: 'corporate lawyer', w: 3 }, { t: 'graduate student', w: 1 },
        { t: 'celebrity chef', w: 3 }, { t: 'ghost-tour guide', w: 1 }, { t: 'art restorer', w: 2 },
        { t: 'hedge fund manager', w: 3 }, { t: 'indie game developer', w: 1 }, { t: 'retired ballet dancer', w: 2 },
        { t: 'vintage clothing seller', w: 1 }, { t: 'emergency-room doctor', w: 2, hon: 'Dr.' },
      ],
    },
    // Small personal things that can be left behind in a room (traces).
    items: {
      old: [
        'a knitting needle trailing lilac wool', 'a pinch of expensive cigar ash', 'a tarot card: the Tower',
        'a cracked monocle', 'a single pearl earring', 'a fountain-pen cap', 'a pressed violet', 'a black lace glove',
        'a link of gold watch chain', 'a peppermint in waxed paper', 'a brass collar stud', 'a theatre ticket stub',
        'a hairpin set with jet', 'the lid of a silver snuff box',
      ],
      modern: [
        'a guitar pick', 'a tube of cherry lip balm', 'a single wireless earbud', 'a sparkly hair clip',
        'a business card, bent at the corner', 'a pair of reading glasses', 'a gum wrapper folded into a crane',
        'a charm bracelet with a broken clasp', 'a lanyard from a tech conference', 'a phone charging cable',
        'a receipt for two oat lattes', 'a vintage enamel pin', 'a hotel key card', 'a nicotine patch wrapper',
      ],
    },
    personalities: {
      nervous: ['I-I did not see anything. Well, I saw some things. Please write down that I was helpful.',
        'Is this going to take long? My hands will not stop shaking.'],
      grand: ['You may have five minutes. I am rarely questioned, and I do not enjoy it.',
        'Do you know who I am? No? How refreshing. Ask away.'],
      cheerful: ['Oh, a real investigation! Terrible, of course. But I do love a puzzle.',
        'Ask me anything! I am an open book. A slightly dog-eared one.'],
      blunt: ['Get on with it. I have nothing to hide and less patience.', 'Ask your questions. I will answer straight.'],
      gloomy: ['I knew tonight would end badly. Nights like this always do.',
        'Something came with us tonight. Something that was not invited.'],
      charming: ['Well, aren\'t you a welcome distraction from all this horror.',
        'Sit, sit. Let us make this as pleasant as a murder allows.'],
      suspicious: ['Why me first? Who sent you to me?', 'I will answer. But I am watching you, too.'],
      scholarly: ['Fascinating, in a ghastly way. Every old tale has a night like this.',
        'Let me be precise. Precision is all we have left.'],
    },
    // ---- Belongings ----
    containers: {
      old: ['handbag', 'wallet', 'leather satchel', 'travelling case', 'pocketbook', 'carpet bag'],
      modern: ['wallet', 'backpack', 'tote bag', 'crossbody bag', 'laptop bag'],
    },
    // Hints at how rich someone is: index = wealth (1 modest, 2 comfortable, 3 rich).
    wealthItems: {
      old: {
        1: ['a few coins and a darned handkerchief', 'a pawn ticket and a single bus token', 'a mended purse with almost nothing in it'],
        2: ['a fountain pen and a few banknotes', 'a calling card case and a pair of opera glasses', 'a neat little address book'],
        3: ['a monogrammed silver cigarette case', 'a thick fold of banknotes held with a gold clip', 'a diamond tie pin wrapped in silk'],
      },
      modern: {
        1: ['a bus pass and a few coins', 'a lottery ticket and a phone with a cracked screen', 'a loyalty card one stamp away from a free coffee'],
        2: ['a library card and a nice pen', 'a gym membership card and some cash', 'a small notebook full of to-do lists'],
        3: ['a black metal credit card', 'keys to a very expensive car', 'a designer sunglasses case worth more than a month\'s rent'],
      },
    },
    // ---- Shoes and footprints ----
    treads: [
      { id: 'zigzag', name: 'a zigzag tread' }, { id: 'diamonds', name: 'a diamond-pattern tread' },
      { id: 'studs', name: 'rows of round studs' }, { id: 'bars', name: 'straight bars across the sole' },
      { id: 'waves', name: 'a wavy tread' }, { id: 'rings', name: 'rings within rings' },
    ],
    shoes: {
      old: {
        1: ['scuffed work boots', 'resoled walking shoes', 'worn canvas plimsolls'],
        2: ['sensible brogues', 'polished lace-up boots', 'buttoned ankle boots'],
        3: ['hand-made patent leather shoes', 'Italian calfskin boots', 'silk-lined evening shoes'],
      },
      modern: {
        1: ['battered trainers', 'charity-shop boots', 'canvas slip-ons'],
        2: ['neat leather loafers', 'sturdy walking boots', 'clean white trainers'],
        3: ['limited-edition designer trainers', 'hand-stitched Italian loafers', 'designer boots with red soles'],
      },
    },
    shoeRefusals: {
      rich: ['Absolutely not. These were made by hand, and they cost more than you earn in a year. They stay on my feet.',
        'You want to handle my shoes? They are worth more than everything you own. No.'],
      proud: ['My shoes? No. I have been poked and questioned quite enough for one night.',
        'I am not taking my shoes off for you. Find another way to pass the time.'],
    },
    residueSpots: ['the lining', 'one corner', 'the outside', 'the bottom', 'the stitching'],
    colors: ['#c99ad6', '#d4a35c', '#8fa6e0', '#e48aa0', '#9cc58a', '#b0a4c8', '#7fb8c4', '#d6c26a',
      '#e0946a', '#e6d3b0', '#8fd0b8', '#e5a7c9'],
  };
})();
