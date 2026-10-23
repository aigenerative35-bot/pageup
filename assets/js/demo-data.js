/* PageUp — offline demo catalogue.
   Used only when firebase-config.js still holds placeholder values, so the
   site is fully browsable before you connect a project. Every title below is
   in the public domain. Replace it with real data by seeding Firestore. */

const EXCERPT = {
  pride: `It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.

However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered as the rightful property of some one or other of their daughters.

"My dear Mr. Bennet," said his lady to him one day, "have you heard that Netherfield Park is let at last?"

Mr. Bennet replied that he had not.

"But it is," returned she; "for Mrs. Long has just been here, and she told me all about it."

Mr. Bennet made no answer.`,
  sherlock: `To Sherlock Holmes she is always the woman. I have seldom heard him mention her under any other name. In his eyes she eclipses and predominates the whole of her sex.

It was not that he felt any emotion akin to love for Irene Adler. All emotions, and that one particularly, were abhorrent to his cold, precise but admirably balanced mind. He was, I take it, the most perfect reasoning and observing machine that the world has seen.

I had seen little of Holmes lately. My marriage had drifted us away from each other.`,
  frankenstein: `You will rejoice to hear that no disaster has accompanied the commencement of an enterprise which you have regarded with such evil forebodings.

I arrived here yesterday, and my first task is to assure my dear sister of my welfare and increasing confidence in the success of my undertaking.

I am already far north of London, and as I walk in the streets of Petersburgh, I feel a cold northern breeze play upon my cheeks, which braces my nerves and fills me with delight.`,
  republic: `I went down yesterday to the Piraeus with Glaucon the son of Ariston, that I might offer up my prayers to the goddess; and also because I wanted to see in what manner they would celebrate the festival, which was a new thing.

When we had finished our prayers and viewed the spectacle, we turned in the direction of the city; and at that instant Polemarchus the son of Cephalus chanced to catch sight of us from a distance as we were starting on our way home, and told his servant to run and bid us wait for him.`,
  meditations: `From my grandfather Verus I learned good morals and the government of my temper.

From the reputation and remembrance of my father, modesty and a manly character.

From my mother, piety and beneficence, and abstinence, not only from evil deeds, but even from evil thoughts; and further, simplicity in my way of living, far removed from the habits of the rich.`,
  artwar: `Sun Tzu said: The art of war is of vital importance to the State.

It is a matter of life and death, a road either to safety or to ruin. Hence it is a subject of inquiry which can on no account be neglected.

The art of war is governed by five constant factors, all of which need to be taken into account. These are: the Moral Law; Heaven; Earth; the Commander; Method and discipline.`,
  alice: `Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, "and what is the use of a book," thought Alice, "without pictures or conversations?"

So she was considering in her own mind whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.`,
  moby: `Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world.

It is a way I have of driving off the spleen and regulating the circulation. Whenever I find myself growing grim about the mouth; whenever it is a damp, drizzly November in my soul, then I account it high time to get to sea as soon as I can.`,
  darwin: `When on board H.M.S. Beagle, as naturalist, I was much struck with certain facts in the distribution of the inhabitants of South America, and in the geological relations of the present to the past inhabitants of that continent.

These facts seemed to me to throw some light on the origin of species—that mystery of mysteries, as it has been called by one of our greatest philosophers.`,
  dracula: `3 May. Bistritz. Left Munich at 8:35 P.M., on 1st May, arriving at Vienna early next morning; should have arrived at 6:46, but train was an hour late.

Buda-Pesth seems a wonderful place, from the glimpse which I got of it from the train and the little I could walk through the streets. I feared to go very far from the station, as we had arrived late and would start as near the correct time as possible.`,
  gandhi: `It is difficult to judge the merits of a book. But the reader is the best judge. My object in writing this booklet is to show that the British rule in India is harmful.

I have written many things in Indian Home Rule. I have said that the British Government is a government of force. The reader should not think that I have any ill-will against the English.`,
  einstein: `In your schooldays most of you who read this book made acquaintance with the noble building of Euclid's geometry, and you remember—perhaps with more respect than love—the magnificent structure, on the lofty staircase of which you were chased about for uncounted hours by conscientious teachers.

The sole purpose of this book is to present the theory of relativity in as simple and comprehensible a form as possible to readers who are interested in the theory but are not conversant with the mathematical apparatus of theoretical physics.`,
  timeMachine: `The Time Traveller (for so it will be convenient to speak of him) was expounding a recondite matter to us. His grey eyes shone and twinkled, and his usually pale face was flushed and animated.

The fire burned brightly, and the soft radiance of the incandescent lights in the lilies of silver caught the bubbles that flashed and passed in our glasses.

Our chairs, being his patents, embraced and caressed us rather than submitted to be sat upon, and there was that luxurious after-dinner atmosphere when thought roams gracefully free of the trammels of precision.`,
  treasure: `Squire Trelawney, Dr. Livesey, and the rest of these gentlemen having asked me to write down the whole particulars about Treasure Island, from the beginning to the end, keeping nothing back but the bearings of the island, and that only because there is still treasure not yet lifted, I take up my pen in the year of grace 17-- and go back to the time when my father kept the Admiral Benbow inn.

I remember him as if it were yesterday, as he came plodding to the inn door, his sea-chest following behind him in a hand-barrow.`,
  janeEyre: `There was no possibility of taking a walk that day. We had been wandering, indeed, in the leafless shrubbery an hour in the morning; but since dinner the cold winter wind had brought with it clouds so sombre, and a rain so penetrating, that further out-door exercise was now out of the question.

I was glad of it: I never liked long walks, especially on chilly afternoons: dreadful to me was the coming home in the raw twilight, with nipped fingers and toes.`,
  expectations: `My father's family name being Pirrip, and my Christian name Philip, my infant tongue could make of both names nothing longer or more explicit than Pip. So, I called myself Pip, and came to be called Pip.

I give Pirrip as my father's family name, on the authority of his tombstone and my sister -- Mrs. Joe Gargery, who married the blacksmith.

Ours was the marsh country, down by the river, within, as the river wound, twenty miles of the sea.`,
  dorian: `The studio was filled with the rich odour of roses, and when the light summer wind stirred amidst the trees of the garden, there came through the open door the heavy scent of the lilac, or the more delicate perfume of the pink-flowering thorn.

From the corner of the divan of Persian saddle-bags on which he was lying, smoking, as was his custom, innumerable cigarettes, Lord Henry Wotton could just catch the gleam of the honey-sweet and honey-coloured blossoms of a laburnum.`,
  prince: `All states, all powers, that have held and hold rule over men have been and are either republics or principalities.

Principalities are either hereditary, in which the family has been long established; or they are new. The new are either entirely new, as was Milan to Francesco Sforza, or they are, as it were, members annexed to the hereditary state of the prince who has acquired them.`,
  twoCities: `It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness, it was the spring of hope, it was the winter of despair.

We had everything before us, we had nothing before us, we were all going direct to Heaven, we were all going direct the other way -- in short, the period was so far like the present period.`,
  jungle: `It was seven o'clock of a very warm evening in the Seeonee hills when Father Wolf woke up from his day's rest, scratched himself, yawned, and spread out his paws one after the other to get rid of the sleepy feeling in their tips.

Mother Wolf lay with her big grey nose dropped across her four tumbling, squealing cubs, and the moon shone into the mouth of the cave where they all lived.

"Augrh!" said Father Wolf. "It is time to hunt again."`,
};

const mk = (o) => ({
  id: o.id,
  title: o.title,
  author: o.author,
  description: o.description,
  category: o.category,
  tags: o.tags || [],
  language: o.language || 'English',
  format: o.format || 'epub',
  pages: o.pages,
  publisher: o.publisher || 'Public Domain Press',
  publishedYear: o.publishedYear,
  isbn: o.isbn || '',
  isPremium: !!o.isPremium,
  price: o.price || 0,
  previewPages: o.previewPages ?? 12,
  views: o.views || 0,
  likes: o.likes || 0,
  ratingSum: (o.ratingAvg || 0) * (o.ratingCount || 0),
  ratingCount: o.ratingCount || 0,
  ratingAvg: o.ratingAvg || 0,
  trendScore: o.trendScore || (o.views || 0) / 100 + (o.likes || 0),
  coverUrl: '',
  fileUrl: '',
  textContent: EXCERPT[o.excerptKey] || '',
  isNew: !!o.isNew,
});

export const DEMO_BOOKS = [
  mk({ id: 'demo-pride', title: 'Pride and Prejudice', author: 'Jane Austen', category: 'Fiction', excerptKey: 'pride',
       description: 'Elizabeth Bennet and Mr Darcy spar through drawing rooms and ballrooms in the sharpest comedy of manners in the English language.',
       tags: ['romance', 'classic', 'regency'], pages: 432, publishedYear: 1813, format: 'epub',
       views: 18420, likes: 2310, ratingAvg: 4.7, ratingCount: 812, trendScore: 2510 }),
  mk({ id: 'demo-sherlock', title: 'The Adventures of Sherlock Holmes', author: 'Arthur Conan Doyle', category: 'Mystery', excerptKey: 'sherlock',
       description: 'Twelve cases from Baker Street, including the one woman who ever outwitted the world\'s first consulting detective.',
       tags: ['detective', 'crime', 'short stories'], pages: 307, publishedYear: 1892, format: 'epub',
       views: 15230, likes: 1980, ratingAvg: 4.6, ratingCount: 654, trendScore: 2130 }),
  mk({ id: 'demo-frankenstein', title: 'Frankenstein', author: 'Mary Shelley', category: 'Horror', excerptKey: 'frankenstein',
       description: 'A young scientist gives life to a creature he cannot love, and learns what it means to be abandoned by your maker.',
       tags: ['gothic', 'science fiction', 'classic'], pages: 280, publishedYear: 1818, format: 'pdf',
       views: 12890, likes: 1640, ratingAvg: 4.5, ratingCount: 590, trendScore: 1770 }),
  mk({ id: 'demo-republic', title: 'The Republic', author: 'Plato', category: 'Philosophy', excerptKey: 'republic',
       description: 'Socrates builds an ideal city to answer a simple question: why should anyone be just when injustice pays better?',
       tags: ['politics', 'ethics', 'ancient'], pages: 416, publishedYear: -380, format: 'pdf',
       views: 9410, likes: 1120, ratingAvg: 4.4, ratingCount: 401, trendScore: 1210 }),
  mk({ id: 'demo-meditations', title: 'Meditations', author: 'Marcus Aurelius', category: 'Philosophy', excerptKey: 'meditations',
       description: 'The private notebook of a Roman emperor, written to keep himself steady in a life of plague, war and betrayal.',
       tags: ['stoicism', 'self help', 'classic'], pages: 254, publishedYear: 180, format: 'epub',
       views: 22140, likes: 3120, ratingAvg: 4.8, ratingCount: 1040, trendScore: 3340 }),
  mk({ id: 'demo-artwar', title: 'The Art of War', author: 'Sun Tzu', category: 'Strategy', excerptKey: 'artwar',
       description: 'Thirteen chapters on winning without fighting, still read in boardrooms as often as in barracks.',
       tags: ['business', 'military', 'leadership'], pages: 128, publishedYear: -500, format: 'epub',
       views: 19870, likes: 2450, ratingAvg: 4.5, ratingCount: 720, trendScore: 2640 }),
  mk({ id: 'demo-alice', title: "Alice's Adventures in Wonderland", author: 'Lewis Carroll', category: 'Children', excerptKey: 'alice',
       description: 'Down the rabbit hole and through a world where logic is a game and nobody has time for it.',
       tags: ['fantasy', 'classic', 'young readers'], pages: 200, publishedYear: 1865, format: 'epub',
       views: 13440, likes: 1560, ratingAvg: 4.6, ratingCount: 512, trendScore: 1690 }),
  mk({ id: 'demo-moby', title: 'Moby-Dick', author: 'Herman Melville', category: 'Adventure', excerptKey: 'moby',
       description: 'Ahab drags a whaling crew across the world in pursuit of the white whale that took his leg.',
       tags: ['sea', 'classic', 'epic'], pages: 635, publishedYear: 1851, format: 'pdf',
       views: 8720, likes: 980, ratingAvg: 4.2, ratingCount: 366, trendScore: 1070 }),
  mk({ id: 'demo-darwin', title: 'On the Origin of Species', author: 'Charles Darwin', category: 'Science', excerptKey: 'darwin',
       description: 'The book that rearranged how we think about living things, argued patiently from a lifetime of observation.',
       tags: ['biology', 'evolution', 'science'], pages: 502, publishedYear: 1859, format: 'pdf',
       views: 10450, likes: 1290, ratingAvg: 4.5, ratingCount: 448, trendScore: 1390 }),
  mk({ id: 'demo-dracula', title: 'Dracula', author: 'Bram Stoker', category: 'Horror', excerptKey: 'dracula',
       description: 'Told entirely in letters and diaries, the count arrives in England and a small band of friends must stop him.',
       tags: ['gothic', 'vampire', 'classic'], pages: 418, publishedYear: 1897, format: 'epub',
       views: 11230, likes: 1410, ratingAvg: 4.4, ratingCount: 470, trendScore: 1520 }),
  mk({ id: 'demo-einstein', title: 'Relativity: The Special and General Theory', author: 'Albert Einstein', category: 'Science', excerptKey: 'einstein',
       description: 'Einstein explains his own theory to readers who know no mathematics beyond school algebra.',
       tags: ['physics', 'science', 'modern'], pages: 168, publishedYear: 1916, format: 'pdf',
       views: 14320, likes: 1890, ratingAvg: 4.6, ratingCount: 623, trendScore: 2030, isPremium: true, price: 149, previewPages: 14 }),
  mk({ id: 'demo-gandhi', title: 'Indian Home Rule', author: 'M. K. Gandhi', category: 'History', excerptKey: 'gandhi',
       description: 'Written as a dialogue, Gandhi sets out his case for swaraj and the means by which it might be won.',
       tags: ['india', 'freedom', 'politics'], pages: 128, publishedYear: 1909, format: 'pdf',
       views: 7620, likes: 890, ratingAvg: 4.3, ratingCount: 214, trendScore: 970, isPremium: true, price: 99, previewPages: 10, isNew: true }),
  mk({ id: 'demo-timemachine', title: 'The Time Machine', author: 'H. G. Wells', category: 'Science Fiction', excerptKey: 'timeMachine',
       description: 'An inventor builds a machine that carries him to the year 802,701, and finds what humanity has become.',
       tags: ['science fiction', 'classic', 'victorian'], pages: 118, publishedYear: 1895, format: 'epub',
       views: 13980, likes: 1720, ratingAvg: 4.5, ratingCount: 588, trendScore: 1860 }),
  mk({ id: 'demo-treasure', title: 'Treasure Island', author: 'Robert Louis Stevenson', category: 'Adventure', excerptKey: 'treasure',
       description: 'A map, a one-legged cook and a boy who has to grow up fast between Bristol and Skeleton Island.',
       tags: ['pirates', 'adventure', 'classic'], pages: 292, publishedYear: 1883, format: 'epub',
       views: 11870, likes: 1420, ratingAvg: 4.4, ratingCount: 476, trendScore: 1530 }),
  mk({ id: 'demo-janeeyre', title: 'Jane Eyre', author: 'Charlotte Bronte', category: 'Fiction', excerptKey: 'janeEyre',
       description: 'An orphan refuses to be small, and the house she comes to is hiding something on the third floor.',
       tags: ['gothic', 'romance', 'classic'], pages: 532, publishedYear: 1847, format: 'epub',
       views: 14520, likes: 1810, ratingAvg: 4.6, ratingCount: 690, trendScore: 1950 }),
  mk({ id: 'demo-expectations', title: 'Great Expectations', author: 'Charles Dickens', category: 'Fiction', excerptKey: 'expectations',
       description: 'A blacksmith\'s boy, a convict on the marshes, and a fortune whose source he never questions.',
       tags: ['classic', 'victorian', 'coming of age'], pages: 505, publishedYear: 1861, format: 'pdf',
       views: 10960, likes: 1330, ratingAvg: 4.5, ratingCount: 502, trendScore: 1430 }),
  mk({ id: 'demo-dorian', title: 'The Picture of Dorian Gray', author: 'Oscar Wilde', category: 'Fiction', excerptKey: 'dorian',
       description: 'A portrait ages so its subject need not, and Wilde makes every line about it quotable.',
       tags: ['gothic', 'classic', 'philosophy'], pages: 254, publishedYear: 1890, format: 'epub',
       views: 13040, likes: 1690, ratingAvg: 4.5, ratingCount: 615, trendScore: 1790 }),
  mk({ id: 'demo-prince', title: 'The Prince', author: 'Niccolo Machiavelli', category: 'Strategy', excerptKey: 'prince',
       description: 'A short, cold book about how power is actually kept, written for a family that had just lost it.',
       tags: ['politics', 'strategy', 'classic'], pages: 140, publishedYear: 1532, format: 'pdf',
       views: 10120, likes: 1180, ratingAvg: 4.3, ratingCount: 392, trendScore: 1280 }),
  mk({ id: 'demo-twocities', title: 'A Tale of Two Cities', author: 'Charles Dickens', category: 'History', excerptKey: 'twoCities',
       description: 'London and Paris in the years around the Revolution, and a sacrifice nobody expects.',
       tags: ['history', 'classic', 'revolution'], pages: 489, publishedYear: 1859, format: 'epub',
       views: 12240, likes: 1490, ratingAvg: 4.5, ratingCount: 548, trendScore: 1610 }),
  mk({ id: 'demo-junglebook', title: 'The Jungle Book', author: 'Rudyard Kipling', category: 'Children', excerptKey: 'jungle',
       description: 'Mowgli is raised by wolves and taught by a bear and a panther, and the tiger never stops waiting.',
       tags: ['children', 'animals', 'classic'], pages: 210, publishedYear: 1894, format: 'epub',
       views: 12610, likes: 1510, ratingAvg: 4.4, ratingCount: 486, trendScore: 1640 }),
  mk({ id: 'demo-liberty', title: 'On Liberty', author: 'John Stuart Mill', category: 'Philosophy', excerptKey: null,
       description: 'The classic argument for the limits of authority over the individual, and where those limits sit.',
       tags: ['philosophy', 'politics', 'ethics'], pages: 190, publishedYear: 1859, format: 'pdf',
       views: 7180, likes: 810, ratingAvg: 4.2, ratingCount: 244, trendScore: 890 }),
  mk({ id: 'demo-wealth', title: 'An Inquiry into the Nature and Causes of the Wealth of Nations', author: 'Adam Smith', category: 'Economics', excerptKey: null,
       description: 'The division of labour, the invisible hand, and the book that founded a discipline.',
       tags: ['economics', 'history', 'classic'], pages: 640, publishedYear: 1776, format: 'pdf',
       views: 8420, likes: 960, ratingAvg: 4.3, ratingCount: 302, trendScore: 1050, isPremium: true, price: 199, previewPages: 16 }),
  mk({ id: 'demo-warpeace', title: 'War and Peace', author: 'Leo Tolstoy', category: 'Fiction', excerptKey: null,
       description: 'Five families, one invasion, and the argument that history is not made by great men.',
       tags: ['epic', 'history', 'classic'], pages: 1225, publishedYear: 1869, format: 'epub',
       views: 9640, likes: 1180, ratingAvg: 4.6, ratingCount: 428, trendScore: 1310, isPremium: true, price: 249, previewPages: 18, isNew: true }),
];

export const DEMO_CATEGORIES = [
  'Fiction', 'Mystery', 'Horror', 'Philosophy', 'Strategy', 'Children',
  'Adventure', 'Science', 'History', 'Science Fiction', 'Economics',
];
