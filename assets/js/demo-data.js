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
];

export const DEMO_CATEGORIES = [
  'Fiction', 'Mystery', 'Horror', 'Philosophy', 'Strategy',
  'Children', 'Adventure', 'Science', 'History',
];
