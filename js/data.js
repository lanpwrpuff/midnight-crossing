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

  // Interrogation reactions, by personality. These never state facts: facts always come from the case.
  //  coy: asked about the victim, before you know their motive.   admit: once you know their motive.
  //  push: a challenge that proves nothing.   back: a clue that backs up their story.
  //  rattle: the killer, caught in the lie about the murder hour (they never confess).
  //  confess: the red herring, caught in their harmless lie.   evade: a clue they cannot explain.
  //  shrug: a clue that has nothing to do with them.   things: asked about belongings you have not searched.
  MC.TALK = {
    nervous: {
      coy: ['We… we knew each other. A little. More than a little. Is that bad?', 'I would rather not talk about them. My hands are shaking just thinking about it.'],
      admit: ['You know. Of course you know. Yes, it is true, but I would never, ever…', 'Oh no. Who told you? Yes. Yes, it is true.'],
      push: ['That does not prove anything! Does it? I do not think it does.', 'I-I do not see what that has to do with me.'],
      back: ['There! You see? I told you the truth.', 'Oh, thank goodness. That is exactly what I said.'],
      rattle: ['I… no. No, you are confusing me. I know where I was.', 'Stop. Please. I have told you where I was. I will not change it.'],
      confess: ['All right! All right. I lied. But not about anything terrible, I swear.', 'Please do not look at me like that. I will tell you the truth.'],
      evade: ['I-I could have picked that up anywhere. Could I not?', 'I do not know how that got there. Honestly.'],
      shrug: ['That is horrible. I do not want to look at it.', 'I do not know anything about that. I promise.'],
      things: ['My things? You want to look through my things? I suppose… if you must.', 'There is nothing in my bag. Nothing important. Look if you like.'],
    },
    grand: {
      coy: ['We moved in the same circles. Some of us more gracefully than others.', 'I tolerated them. That is the most generous word I have.'],
      admit: ['So people have been gossiping. Yes, it is true. It is also beneath me to kill over it.', 'I see my private affairs are now public property. Very well. It is true.'],
      push: ['You are wasting my evening with that.', 'I fail to see why that should trouble me in the least.'],
      back: ['Naturally. I do not tell untruths.', 'As I said. I am pleased you have caught up.'],
      rattle: ['I have told you where I was. I do not repeat myself.', 'How dare you. I know perfectly well where I was.'],
      confess: ['Very well. I was not entirely candid. It is not what you think.', 'If you must know, and apparently you must.'],
      evade: ['I cannot be expected to account for every speck on my belongings.', 'Someone should have cleaned that.'],
      shrug: ['Grotesque. Put it away.', 'That is a matter for the police, not for me.'],
      things: ['My belongings are worth more than this whole place. Handle them carefully, if you must.', 'You may look. You may not touch anything shiny.'],
    },
    cheerful: {
      coy: ['Oh, we had our ups and downs! Mostly downs, if I am honest.', 'Complicated! Everyone was complicated with them.'],
      admit: ['Ah. You found out! Yes, all true. Awkward, isn\'t it?', 'Well, the cat is out of the bag. It is true. But I did not do it!'],
      push: ['Ooh, close, but no. That does not catch me out at all.', 'Nice try! But I do not see the problem.'],
      back: ['See? Open book!', 'Ha! Exactly what I told you.'],
      rattle: ['Ha. Ha ha. No. I was where I said I was. Next question?', 'That is… hm. No. I know where I was. Moving on!'],
      confess: ['Oh dear. Caught! Fine, fine, I will tell you.', 'All right, you got me. It is a bit embarrassing, though.'],
      evade: ['Oh, that? I have no idea. I am terribly messy.', 'Goodness, I could have picked that up anywhere!'],
      shrug: ['Gosh. No idea, I am afraid.', 'Grim! But nothing to do with me.'],
      things: ['Go ahead and rummage! You will find mostly sweets.', 'My bag? Sure! Do not judge the mess.'],
    },
    blunt: {
      coy: ['We did not get on. Next question.', 'I knew them. I did not like them. That is all.'],
      admit: ['Yes. It is true. Doesn\'t mean I killed anyone.', 'Fine. You know. So?'],
      push: ['That proves nothing.', 'And? That changes nothing.'],
      back: ['Told you.', 'Right. Like I said.'],
      rattle: ['I said where I was. I am not saying it again.', 'No. I know where I was. Drop it.'],
      confess: ['Fine. I lied. Here is why.', 'All right. Not where I said. You want the truth? Here.'],
      evade: ['No idea how that got there.', 'Stuff gets on things. Move on.'],
      shrug: ['Nothing to do with me.', 'Not my business.'],
      things: ['Search them. Nothing to find.', 'Go on, then. Look.'],
    },
    gloomy: {
      coy: ['They had a shadow on them. I saw it the day we met.', 'We knew each other. That was misfortune enough.'],
      admit: ['So it comes out. It always does, on nights like this. Yes. It is true.', 'Yes. The past never stays buried.'],
      push: ['That means nothing. Nothing means anything, tonight.', 'You are chasing shadows.'],
      back: ['As I said. The truth is a cold comfort.', 'Yes. Just as I told you.'],
      rattle: ['I know where I was. Whatever walks these halls can tell you so.', 'No. I will not say anything else about that hour.'],
      confess: ['Very well. The truth, then, for what it is worth.', 'I lied. Not for the reason you fear.'],
      evade: ['Everything here leaves a mark on you.', 'I cannot say. This place clings.'],
      shrug: ['Another sign. There will be more.', 'It means nothing to me.'],
      things: ['Look, if you must. You will find only sorrow.', 'My things will tell you nothing I have not.'],
    },
    charming: {
      coy: ['We had history. Doesn\'t everyone, with someone like that?', 'Oh, we were close, once. Then we were not.'],
      admit: ['Ah. You\'ve done your homework. Yes, it is true. But murder? Darling, no.', 'Guilty, of that much. Nothing more.'],
      push: ['Lovely try, but no.', 'You will have to do better than that, I am afraid.'],
      back: ['There. Am I not a model witness?', 'Exactly as I said. Shall we have a drink to celebrate?'],
      rattle: ['Let\'s not spoil a pleasant chat. I was where I said.', 'My, you are persistent. I know where I was.'],
      confess: ['All right, you have caught me out. Rather sweetly, too.', 'Fine. The truth. Promise not to laugh.'],
      evade: ['Who knows? I do get about.', 'I couldn\'t possibly say.'],
      shrug: ['How ghastly. Not my sort of thing.', 'I haven\'t the faintest.'],
      things: ['Rummaging through my things? How forward. Go on.', 'Be gentle with my bag.'],
    },
    suspicious: {
      coy: ['Why do you want to know? Who has been talking?', 'We knew each other. Why? What have you heard?'],
      admit: ['So someone has been talking. Yes, it is true. Who told you?', 'I knew this would come out. Yes. It is true.'],
      push: ['That is what they want you to think.', 'Someone wants you looking at me. That proves nothing.'],
      back: ['There. See? I am not the one hiding things.', 'Just what I said. Now look at the others.'],
      rattle: ['No. I know where I was. Someone is setting me up.', 'I am not saying another word about that hour.'],
      confess: ['All right. I lied. But not for the reason you think.', 'Fine. You want the truth? Keep it to yourself.'],
      evade: ['Someone could have put that there.', 'I do not know. And neither do you.'],
      shrug: ['Why show me that? What are you trying to do?', 'Nothing to do with me. Ask the others.'],
      things: ['You want my things? Fine. But I am watching you.', 'Go on. You will not find anything.'],
    },
    scholarly: {
      coy: ['Our acquaintance was long and, regrettably, instructive.', 'We disagreed on most things, and loudly.'],
      admit: ['An accurate account. Yes. A motive is not a method, however.', 'Correct. I will not insult you by denying it.'],
      push: ['That does not follow, I am afraid.', 'An interesting observation, but it proves nothing.'],
      back: ['Consistent with my account, you will note.', 'Precisely as I described.'],
      rattle: ['I know where I was. My recollection is not in question.', 'I have given my account. I stand by every word.'],
      confess: ['Very well. A correction to my earlier account.', 'I concede the point. Here is the true version.'],
      evade: ['Contamination is easily acquired in close quarters.', 'I could not say with any certainty.'],
      shrug: ['Fascinating, in a ghastly way. But not my concern.', 'I have no particular knowledge of it.'],
      things: ['You may examine them. Please keep my notes in order.', 'By all means. Methodically, I hope.'],
    },
    // The final accusation. crack: the killer, rightly named. wronged: an innocent guest, wrongly named.
    crack: {
      nervous: 'I did not mean… yes. Yes, it was me. I cannot carry it any longer.',
      grand: 'So. You are cleverer than you look. Yes. I did it, and I would again.',
      cheerful: 'Oh. Oh, well. I really thought I had got away with it.',
      blunt: 'Fine. It was me. They had it coming.',
      gloomy: 'I knew this night would take me too. Yes. It was me.',
      charming: 'And we were getting on so well. Yes, darling. It was me.',
      suspicious: 'Who told you? No, never mind. Yes. I did it.',
      scholarly: 'A sound deduction. I have no rebuttal. It was me.',
    },
    wronged: {
      nervous: 'Me? No! No, I swear, you have it wrong!',
      grand: 'How dare you. You will regret this mistake.',
      cheerful: 'Me? Oh, you could not be more wrong!',
      blunt: 'Wrong. You have got the wrong person.',
      gloomy: 'Of course you blame me. But you are wrong.',
      charming: 'Flattering, but no. You have made a mistake.',
      suspicious: 'I knew it. You were always going to pin it on me.',
      scholarly: 'Your reasoning has failed you. It was not me.',
    },
    // How a guest greets you when you come back to them, depending on how the night has gone.
    mood: {
      again: ['Back again? Go on, then.', 'More questions? Very well.', 'You again. What is it this time?'],
      late: ['It will be light soon. Are you any closer?', 'You look as tired as I feel. Go on.', 'The night is nearly over. Ask what you must.'],
      cold: ['You again. I have told you where I was.', 'I have nothing more to say to you. But ask, if you must.'],
      relieved: ['Thank you for keeping my secret. What else do you need?', 'I feel lighter, now that you know. Ask what you like.'],
    },
    // The red herring's confession, in their own words. Same order as MC.DATA.secrets.
    secrets: [
      'I slipped off to the {room} to read a love letter. There. Now you know.',
      'I was in the {room}, eating an entire second pudding. In secret. Please do not tell anyone.',
      'I was in the {room}, trying to hold a séance on my own. I did not want to be laughed at.',
      'I went to the {room} for a quiet cry, where nobody could see me.',
      'I was in the {room}, hunting for a ring I lost years ago. It is mortifying.',
      'I was in the {room}, practising a wedding speech. Badly.',
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
