// All the hand-written content the case generator draws from.
// Add rooms, guests, motives or omens here to give the game more variety.
(function () {
  'use strict';
  const MC = (window.MC = window.MC || {});

  MC.DATA = {
    rooms: [
      {
        id: 'saloon', name: 'Dining Saloon', short: 'Saloon', color: '#d39a5b',
        desc: 'Long tables still set from dinner at eight.',
        hide: 'under the long tablecloth',
        eerie: [
          'The chandelier sways with the swell, though the sea has gone flat.',
          'Six places were set for dinner. You count the chairs again: seven.',
          'A wine glass rings softly, as if someone just ran a finger round its rim.',
        ],
      },
      {
        id: 'galley', name: 'Galley', short: 'Galley', color: '#c9b458',
        desc: 'Copper pots, a banked stove and the smell of burnt sugar.',
        hide: 'deep in the flour bin',
        eerie: [
          'One copper pot keeps swinging long after the others have stopped.',
          'Someone has pressed a handprint into the flour on the counter. It is far too small for anyone aboard.',
          'The stove is cold, but the kettle is whistling.',
        ],
      },
      {
        id: 'library', name: 'Library Lounge', short: 'Library', color: '#7fae7a',
        desc: 'Leather chairs, a cold fireplace and shelves of damp books.',
        hide: 'behind a row of old sermons',
        eerie: [
          'One book lies open at a page about drowned sailors. You did not open it.',
          'The portrait over the fireplace has its eyes closed. It did not, a moment ago.',
          'The armchair nearest the cold fire is still warm.',
        ],
      },
      {
        id: 'promenade', name: 'Promenade Deck', short: 'Deck', color: '#6fa3c7',
        desc: 'Wet boards, a long railing and fog pressing in on every side.',
        hide: 'inside a coiled life ring',
        eerie: [
          'Wet footprints lead to the railing, and stop.',
          "Somewhere out in the fog, another ship's horn answers the Wren's.",
          'For a moment the fog takes the shape of people, waving.',
        ],
      },
      {
        id: 'engine', name: 'Engine Room', short: 'Engine', color: '#c76f5a',
        desc: 'Heat, hissing steam and the steady thump of the pistons.',
        hide: 'behind the coal bunker',
        eerie: [
          'The engine beats twice, then once, like a heart skipping.',
          'Chalk marks on the boiler count days. Hundreds of them.',
          'The pressure gauge points to a number that is not printed on the dial.',
        ],
      },
      {
        id: 'bridge', name: "Captain's Bridge", short: 'Bridge', color: '#a58bd0',
        desc: 'Brass instruments, a worn wheel and a window misted with fog.',
        hide: 'in the chart drawer, under the maps',
        eerie: [
          'The compass needle turns slowly until it points at you.',
          'Someone has written HELP in the mist, on the inside of the glass.',
          "The ship's log has an entry for tomorrow. The ink is still wet.",
        ],
      },
      {
        id: 'hold', name: 'Cargo Hold', short: 'Hold', color: '#9a8c7a',
        desc: 'Crates, steamer trunks and one long box nobody will claim.',
        hide: 'inside an empty steamer trunk',
        eerie: [
          'The long box is a little further from the wall than it was.',
          'Something inside one of the crates is ticking.',
          'Your lantern dims, then brightens, as if something passed in front of it.',
        ],
      },
    ],

    // Each room is home to exactly one possible weapon.
    weapons: [
      { id: 'candlestick', name: 'brass candlestick', home: 'saloon', wound: 'blunt',
        empty: 'a ring of clean wood on the sideboard, where the brass candlestick stood' },
      { id: 'knife', name: 'carving knife', home: 'galley', wound: 'sharp',
        empty: 'an empty slot in the knife block, where the carving knife belongs' },
      { id: 'cord', name: 'curtain cord', home: 'library', wound: 'strangle',
        empty: 'a curtain hanging loose. Its heavy curtain cord is gone' },
      { id: 'boathook', name: 'boathook', home: 'promenade', wound: 'sharp',
        empty: 'two empty brackets on the wall, where the boathook hangs' },
      { id: 'wrench', name: "ship's wrench", home: 'engine', wound: 'blunt',
        empty: "a painted outline on the tool board, and no ship's wrench inside it" },
      { id: 'sextant', name: 'brass sextant', home: 'bridge', wound: 'blunt',
        empty: 'an open case lined with velvet, where the brass sextant should be' },
      { id: 'rope', name: 'coil of rope', home: 'hold', wound: 'strangle',
        empty: 'a bare hook, where the coil of rope usually hangs' },
    ],

    wounds: {
      blunt: 'A single heavy blow. Something solid and weighty.',
      sharp: 'A narrow wound. Something with a point or an edge.',
      strangle: 'Faint marks around the throat, as if from a cord or rope pulled tight.',
    },

    characters: [
      { id: 'hester', name: 'Mrs. Hester Bramble', short: 'Bramble', title: 'retired schoolmistress', color: '#c99ad6',
        item: 'a knitting needle trailing lilac wool',
        greeting: 'Sit up straight, dear, and ask your questions properly.' },
      { id: 'ambrose', name: 'Colonel Ambrose Whitlock', short: 'Whitlock', title: 'old soldier with a silver moustache', color: '#d4a35c',
        item: 'a pinch of cigar ash, the expensive kind',
        greeting: 'Fire away. I have nothing to hide, and I have faced worse than you.' },
      { id: 'lucien', name: 'Dr. Lucien Vey', short: 'Vey', title: 'spiritualist and medium', color: '#8fa6e0',
        item: 'a tarot card: the Tower',
        greeting: 'The spirits warned me tonight would end badly. Nobody ever listens to the spirits.' },
      { id: 'clementine', name: 'Miss Clementine Ashby', short: 'Ashby', title: 'author of lurid romance novels', color: '#e48aa0',
        item: 'a crumpled manuscript page, the ink still smudged',
        greeting: 'Oh, this is thrilling. Dreadful, of course. But thrilling.' },
      { id: 'tobias', name: 'Mr. Tobias Finch', short: 'Finch', title: "the ship's nervous purser", color: '#9cc58a',
        item: 'a brass key on a tag marked PURSER',
        greeting: 'I-I keep the accounts. That is all I do. Please write that down.' },
      { id: 'odette', name: 'Lady Odette Marchmont', short: 'Marchmont', title: 'widowed heiress in mourning black', color: '#b0a4c8',
        item: 'a black lace glove',
        greeting: 'Be brief. Grief is exhausting, and so are questions.' },
      { id: 'silas', name: 'Captain Silas Rook', short: 'Rook', title: "the Wren's weathered captain", color: '#7fb8c4',
        item: 'a twist of cherry pipe tobacco',
        greeting: 'Thirty years on this crossing, and I have never seen fog like it. Ask your questions.' },
      { id: 'ida', name: 'Professor Ida Quill', short: 'Quill', title: 'folklorist collecting ghost stories', color: '#d6c26a',
        item: 'a notebook page covered in strange symbols',
        greeting: 'Every ship has a ghost story. I think the Wren just found a new one.' },
      { id: 'jasper', name: 'Mr. Jasper Holloway', short: 'Holloway', title: 'travelling seller of curios', color: '#e0946a',
        item: 'a glass eye from a sample case',
        greeting: 'Terrible business. Truly. Can I interest you in a lucky charm while we talk?' },
      { id: 'nell', name: 'Nell Garrow', short: 'Garrow', title: "the ship's cook", color: '#e6d3b0',
        item: 'a trail of flour',
        greeting: 'Make it quick. The bread will not bake itself, murder or no murder.' },
    ],

    // {s} = the suspect, {v} = the victim. Everyone has a motive: motives alone never solve the case.
    motives: [
      '{s} owed {v} a great deal of money, and {v} had stopped being patient about it.',
      "{v} had found out a secret from {s}'s past and was threatening to tell everyone.",
      "{s} was cut out of {v}'s will only last week.",
      "{v} ruined {s}'s reputation years ago. {s} has never forgotten it.",
      '{s} and {v} were heard arguing on the gangway before we sailed.',
      'Last spring, {v} won the house {s} grew up in, in a game of cards.',
      '{v} had been blackmailing {s} for months.',
    ],

    // The red herring: an innocent guest who lies about where they were, for a harmless reason.
    secrets: [
      'slipped off to the {room} to read a love letter, and was too embarrassed to say so',
      'was in the {room} eating an entire second pudding in secret',
      'was in the {room} trying to hold a séance alone',
      'went to the {room} for a quiet cry where nobody could see',
      'was in the {room} hunting for a ring that had been lost overboard years ago, and was mortified to admit it',
    ],

    traceReasons: [
      'the cold teacup beside it',
      'how far the nearby candle has burned',
      'the rainwater still drying around it',
      'the ashes cooling in the grate',
    ],

    omens: [
      'Somewhere below, a bell rings once. The Wren has no bell.',
      'The lamps dim all at once, then return, as if the ship took a breath.',
      'A child laughs somewhere down the corridor. There are no children aboard.',
      'The fog presses against the porthole. For a moment it looks like a face.',
      'Every clock on the ship seems to tick in time with your heartbeat.',
      'Someone knocks three times on the hull. From outside.',
      'You smell lilies, the kind people bring to funerals.',
      'A door you closed is standing open again.',
      "The ship's cat watches you, then stares at the empty chair beside you.",
      'Far off in the fog, someone is singing an old sea shanty, very slowly.',
    ],
  };
})();
