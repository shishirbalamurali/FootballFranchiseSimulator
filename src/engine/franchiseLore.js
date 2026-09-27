// Franchise culture and history (Claude-owned module).
//
// Static, fictional lore for all 32 clubs, keyed by the permanent team id
// (never the brand), plus a culture system that reacts to story-event
// decisions. Pure data and pure functions: nothing here is saved, so every
// old save gets the lore for free. History *made in your save* is merged on
// top by franchiseHistory() from seasonHistory.

export const LEAGUE_START_YEAR = 2024;

/**
 * Culture = what a locker room and fan base value. `values` weights the
 * stances a decision can take (see STANCES); positive means the building
 * loves it, negative means it grates.
 */
export const CULTURES = {
  trenches: {
    label: 'Blue-Collar', icon: '🔨',
    blurb: 'Win up front, win ugly, win cold. Toughness is the only currency.',
    values: { tough: 2, discipline: 1, bold: -1, care: -1 },
    love: 'Hard hat, lunch pail, no excuses. That is exactly how this town wants it done.',
    hate: 'A few of the old linemen think it is soft. They will say so on local radio.',
  },
  showtime: {
    label: 'Showtime', icon: '🎬',
    blurb: 'Stars, swagger and big plays. The crowd came for fireworks.',
    values: { bold: 2, fire: 1, process: -1, patient: -1 },
    love: 'The fan base eats it up. This is a franchise that likes to make headlines.',
    hate: 'Talk radio calls it timid. This market wants a splash, not a spreadsheet.',
  },
  defense: {
    label: 'Defense First', icon: '🛡️',
    blurb: 'Preparation, discipline and a pass rush that never rests.',
    values: { prep: 2, discipline: 1, bold: -1 },
    love: 'The film-room crowd nods along. Preparation is the house religion here.',
    hate: 'The veterans on defense bristle. Around here you earn it on tape, not on vibes.',
  },
  family: {
    label: "Players' Club", icon: '🤝',
    blurb: 'Take care of your people and they will take care of Sundays.',
    values: { care: 2, loyal: 2, discipline: -1 },
    love: 'The locker room feels looked after. In this building, loyalty runs both ways.',
    hate: 'It lands cold in a building that prides itself on looking after its own.',
  },
  analytics: {
    label: 'Brain Trust', icon: '🧮',
    blurb: 'Trust the process, trust the numbers, never chase a feeling.',
    values: { process: 2, prep: 1, fire: -1 },
    love: 'The analytics staff signs off. It is the percentage play, and they love that.',
    hate: 'The front office winces. Nobody here likes making calls on emotion.',
  },
  underdog: {
    label: 'Chip on the Shoulder', icon: '⚡',
    blurb: 'Overlooked, underestimated and fueled by every slight.',
    values: { fire: 2, tough: 1, patient: -1 },
    love: 'The fan base is fired up. Nobody believed in them, and that is how they like it.',
    hate: 'The fans wanted some fight. Playing it safe does not sell in this city.',
  },
  dynasty: {
    label: 'Championship Standard', icon: '🏆',
    blurb: 'Anything short of a title is a failed season. Do your job.',
    values: { discipline: 2, prep: 1, fire: -1 },
    love: 'Very on-brand. The standard is the standard, and you just upheld it.',
    hate: 'The old guard grumbles. Title teams here never needed a pep rally.',
  },
  youth: {
    label: 'Youth Movement', icon: '🌱',
    blurb: 'Draft, develop and hand the kids the keys.',
    values: { develop: 2, patient: 1, loyal: -1 },
    love: 'The player-development staff is thrilled. The whole plan here runs on growth.',
    hate: 'The development staff is uneasy. This roster was built to grow, not to cash out.',
  },
  renegade: {
    label: 'Renegades', icon: '🏴‍☠️',
    blurb: 'Misfits, rebels and castoffs who play like they have nothing to lose.',
    values: { bold: 2, loyal: 1, discipline: -2 },
    love: 'The misfits love it. This team never played by anybody else\'s rules.',
    hate: 'The locker room rolls its eyes. They did not come here to be managed.',
  },
};

export const STANCES = {
  bold: 'Bold', patient: 'Patient', develop: 'Development', care: 'Player care',
  tough: 'Toughness', loyal: 'Loyalty', fire: 'Emotion', prep: 'Preparation',
  discipline: 'Discipline', process: 'Process',
};

// [founded, stadium, culture, fans, origin, titles, legends, tradition, eras]
// Legends are [name, position, note]. Eras are [span, name].
const RAW = {
  ravens: [1996, 'Harborline Field', 'defense', 'The Flock',
    'Born in a harbor town that had lost its team, the Ospreys were built from the back end forward: a secondary that hunts the ball like its namesake over the Chesapeake.',
    [2000, 2012],
    [['Marcus "Talon" Reed', 'S', 'Nine-time All-Pro and the reason quarterbacks stopped throwing deep'], ['Dale Okafor', 'LB', 'Called the defense for thirteen seasons']],
    'Fans raise paper wings on every third-down stop.',
    [['1996–2003', 'The Talon Years'], ['2004–2015', 'Second Wind'], ['2016–2023', 'Holding Pattern']]],
  bengals: [1968, 'Riverbend Park', 'family', 'The Pack',
    'A river-town club that never had its neighbors\' budget and learned to win as a pack. Nobody eats alone in Louisville.',
    [],
    [['Tre Whitfield', 'WR', 'Franchise leader in every receiving category'], ['Gus Albrecht', 'HC', 'Coached nineteen seasons without a losing locker room']],
    'The whole stadium howls the opening kickoff.',
    [['1968–1987', 'Kennel Days'], ['1988–2005', 'The Run-and-Shoot Pack'], ['2006–2023', 'Still Hunting']]],
  browns: [1946, 'Scioto Stadium', 'analytics', 'The Night Watch',
    'Founded by a university physics professor who charted every play by hand. The Owls have always trusted the chart over the gut.',
    [1954, 1964],
    [['Otto Brandt', 'QB', 'Threw the league\'s first 4,000-yard season'], ['Ruth Kessler', 'GM', 'First woman to run a front office; built the \'64 champions']],
    'A single owl hoot echoes through the stadium before every opposing snap.',
    [['1946–1965', 'The Professor\'s Owls'], ['1966–1999', 'The Long Winter'], ['2000–2023', 'The Model Rebuild']]],
  steelers: [1933, 'Gateway Grounds', 'dynasty', 'The Quiver',
    'Founded by brickyard workers along the Mississippi, the Archers win ugly, win cold and win often. Six titles hang in the rafters.',
    [1974, 1975, 1978, 1979, 2005, 2008],
    [['Joe Kowalczyk', 'DT', 'Anchor of the Iron Quiver defense'], ['Lynn Castellano', 'WR', 'Made the arrow catch in the \'75 title game']],
    'Fans twirl gold towels in the "Quiver Wave."',
    [['1933–1968', 'The Hard Years'], ['1969–1980', 'The Quiver Dynasty'], ['1981–2023', 'Standard Bearers']]],
  texans: [2002, 'Launchpad Stadium', 'analytics', 'Mission Control',
    'An expansion club named for the missions launched from its backyard, run by engineers who treat every snap like a flight plan. It is still chasing its first moonshot.',
    [],
    [['Deshawn Pryor', 'DE', 'Five-time sack leader'], ['Andre Cole', 'WR', 'Hands like a docking clamp']],
    'A countdown from ten fills the dome before kickoff.',
    [['2002–2010', 'Expansion Growing Pains'], ['2011–2019', 'Liftoff'], ['2020–2023', 'Recalibrating']]],
  colts: [1953, 'Wasatch Field', 'dynasty', 'The Herd on the Hill',
    'Moved to the mountains in 1984 and never looked back. Visiting teams gasp for air while the Ibex keep climbing.',
    [1958, 1970, 2006],
    [['Johnny Varga', 'QB', 'Invented the two-minute drill'], ['Hollis Marsh', 'QB', 'Called his own plays for fourteen years']],
    'The upper deck stomps on third down. Locals call it the "Rockslide."',
    [['1953–1983', 'Lowland Origins'], ['1984–2011', 'The Altitude Era'], ['2012–2023', 'Summit Chase']]],
  jaguars: [1995, 'Pyramid Park', 'youth', 'The Court',
    'A blues-city expansion team that has never bought a veteran it could draft instead. In Memphis the crown is earned, never purchased.',
    [],
    [['Fred Tarver', 'RB', 'Ran for 11,000 yards in gold'], ['Tony Bosco', 'LT', 'Protected the blind side for a decade']],
    'A live horn section plays the team onto the field.',
    [['1995–2002', 'Young Kings'], ['2003–2016', 'The Wilderness'], ['2017–2023', 'The Crowning Class']]],
  titans: [1960, 'Railyard Stadium', 'trenches', 'The Yard',
    'Named for the rail workers who threw the switches in the old Nashville yards. This franchise moves the pile and sets the direction of the game.',
    [1961, 1962],
    [['Earl Coffey', 'RB', 'Punished tacklers for eight seasons'], ['Bruce Mathers', 'DE', '"The Conductor" of the pass rush']],
    'A train whistle blows after every first down.',
    [['1960–1996', 'The Old Line'], ['1997–2008', 'The Music City Run'], ['2009–2023', 'Switchback']]],
  bills: [1960, 'Prairie Bowl', 'family', 'The Herd',
    'Four straight title-game heartbreaks could not break them. Omaha\'s faithful fill the Prairie Bowl through every blizzard.',
    [1964, 1965],
    [['Jim Kellerman', 'QB', 'Led four straight title-game runs'], ['Otis Mabry', 'RB', 'Twelve seasons of do-everything toughness']],
    'Every December, fans pack snow into a mammoth outside Gate 4.',
    [['1960–1965', 'Early Glory'], ['1988–1993', 'Four Straight'], ['1994–2023', 'Built to Endure']]],
  dolphins: [1966, 'Bridge Street Field', 'showtime', 'The Colony',
    'Every summer dusk a million bats pour out from under the Congress Avenue bridge. This franchise plays the same way: fast, dark and all at once.',
    [1972, 1973],
    [['Dan Marchetti', 'QB', 'Quickest release the league has ever seen'], ['Mercury Dale', 'WR', 'Starred on the undefeated \'72 team']],
    'The lights drop before kickoff and 70,000 phone lights flicker like wings.',
    [['1966–1971', 'Nightfall'], ['1972–1984', 'The Perfect Dark'], ['1985–2023', 'Waiting for Dusk']]],
  patriots: [1960, 'Harbor Light Stadium', 'dynasty', 'The Keepers',
    'Forty years in the fog, then two decades as the brightest light in the league. Boston expects nothing less now.',
    [2001, 2003, 2004, 2014, 2016, 2018],
    [['Nate Tolliver', 'QB', 'Six rings and a statue at Gate A'], ['Rodney Harkin', 'S', 'Hit anything that moved']],
    'After every home win, the lighthouse beam sweeps across the harbor.',
    [['1960–2000', 'The Fog Years'], ['2001–2019', 'The Beacon Dynasty'], ['2020–2023', 'After the Light']]],
  jets: [1960, 'Five Boroughs Field', 'showtime', 'The Stone Crowd',
    'One famous guarantee, one ring and fifty years of back pages. The Gargoyles are loud, proud and always one piece away.',
    [1968],
    [['Joe Navarro', 'QB', 'Guaranteed the title and delivered it'], ['Curtis Lark', 'RB', 'Heart of the ground-and-pound years']],
    'The "G-A-R-G" chant, led since 1978 by a fan in a stone mask.',
    [['1960–1969', 'The Guarantee'], ['1970–2009', 'Back Pages'], ['2010–2023', 'Rebuilding the Ledge']]],
  broncos: [1960, 'Mile High Meadow', 'defense', 'The Rockpile',
    'The smallest mascot in the league and the thinnest air. Denver built its identity on defenses that fight for every inch.',
    [1997, 1998, 2015],
    [['John Elgin', 'QB', 'Comeback artist of the Rockies'], ['Von Mercer', 'OLB', 'Most valuable player of the 2015 title game']],
    'The "Squeak": a stadium-wide whistle on every opposing third down.',
    [['1960–1976', 'Orange Dawn'], ['1977–1998', 'The Elgin Era'], ['1999–2023', 'Thin Air']]],
  chiefs: [1960, 'Red Dirt Field', 'showtime', 'The Stampede',
    'A prairie franchise that went fifty years between titles, then found a quarterback who threw sidearm, left-handed and on the run. The herd has not stopped moving since.',
    [1969, 2019, 2022, 2023],
    [['Len Dawes', 'QB', 'Won the first title in \'69'], ['Cal Rourke', 'QB', 'Three rings in five seasons']],
    'The whole stadium stomps in unison. You can hear the stampede a mile away.',
    [['1960–1970', 'First Herd'], ['1971–2017', 'The Long Graze'], ['2018–2023', 'The Stampede']]],
  raiders: [1960, 'The Neon Pit', 'renegade', 'The Den',
    'Outlaws in three cities before settling on the Strip. The Sidewinders sign the players nobody else wants and dare you to stop them.',
    [1976, 1980, 1983],
    [['Ray Delgado', 'QB', 'Coolest head in any huddle'], ['Otis Crane', 'CB', 'Nobody threw his way for a decade']],
    'End-zone fans in black-and-silver snake masks fill "the Den."',
    [['1960–1981', 'The Outlaw Years'], ['1982–1994', 'Hollywood Exile'], ['1995–2023', 'Neon and Venom']]],
  chargers: [1960, 'Point Loma Stadium', 'underdog', 'The Pod',
    'The league\'s first true passing offense was born on the Point. The Gray Whales have never met a vertical route they did not like, or a January that did not break their hearts.',
    [1963],
    [['Dan Fontaine', 'QB', 'Threw for 4,000 yards when nobody did'], ['Tavita Lealofi', 'LB', 'Heart of the franchise for thirteen years']],
    'After every touchdown, the "Blowhole" section sprays seawater.',
    [['1960–1977', 'The Early Tide'], ['1978–1986', 'Air Point Loma'], ['1987–2023', 'Waiting on the Swell']]],
  bears: [1920, 'Lakefront Yards', 'trenches', 'The Shift',
    'A founding member of the league, forged in the South Side steel mills. The Riveters have never had a great quarterback and have never needed one.',
    [1921, 1932, 1933, 1940, 1941, 1946, 1963, 1985],
    [['Hank Bukowski', 'LB', 'The scariest man ever to wear the rivet'], ['Mo Lattimore', 'RB', 'Carried the \'85 champions']],
    'A factory whistle sounds after every sack.',
    [['1920–1946', 'The Founding Forge'], ['1947–1985', 'Monsters of the Lake'], ['1986–2023', 'Retooling']]],
  lions: [1930, 'Motor City Field', 'underdog', 'The Aerie',
    'Four early titles, then decades of heartbreak. Detroit\'s fans never left. They learned to fight for the next yard.',
    [1935, 1952, 1953, 1957],
    [['Barry Sandoval', 'RB', 'Juked half the league into retirement'], ['Bobby Laird', 'QB', 'Won three titles in six years']],
    'On fourth-down stops, fans dive-bomb foam falcons from the upper deck.',
    [['1930–1957', 'The Golden Talons'], ['1958–2020', 'The Long Dive'], ['2021–2023', 'The Climb']]],
  packers: [1919, 'Brewhouse Field', 'dynasty', 'The Shareholders',
    'Community-owned since the Depression, the Badgers are the league\'s small-town giant. Thirteen titles, and a season-ticket waiting list longer than the city.',
    [1929, 1930, 1931, 1936, 1939, 1944, 1961, 1962, 1965, 1966, 1967, 1996, 2010],
    [['Vince Lomax', 'HC', 'Five titles in seven years; the trophy almost bears his name'], ['Ole Halvorsen', 'QB', 'Snuck in the winning score in the Ice Bowl']],
    'Touchdown scorers leap into the stands. Fans call it the "Burrow Jump."',
    [['1919–1944', 'Town Team Titans'], ['1959–1967', 'The Lomax Years'], ['1992–2023', 'The Modern Burrow']]],
  vikings: [1961, 'North Star Stadium', 'trenches', 'The Frost Line',
    'Four title-game trips, zero rings. The Muskox circle up against the cold and wait for their storm to finally break.',
    [],
    [['Nils Ostrander', 'DT', 'Anchor of the Frost Line defensive front'], ['Jarvis Moen', 'WR', 'Caught seventeen touchdowns as a rookie']],
    'The "Horn of the North" sounds before every kickoff.',
    [['1961–1977', 'The Frost Line'], ['1978–2009', 'Almost Every Year'], ['2010–2023', 'Weathering It']]],
  falcons: [1966, 'Peachtree Dome', 'showtime', 'The Rut',
    'Built for speed in a city that never slows down. The Stags once led a title game by 25, and everybody in Atlanta remembers how it ended.',
    [],
    [['Michael Vance', 'QB', 'The most electric player of his generation'], ['Julius Joyner', 'WR', 'Franchise receiving king']],
    'On kickoff, fans lock their hands above their heads like antlers.',
    [['1966–1990', 'Young Bucks'], ['1991–2007', 'Prime Time'], ['2008–2023', 'Lead the Charge']]],
  panthers: [1995, 'Triangle Field', 'youth', 'The Nest',
    'Patience is the whole playbook in Raleigh: draft, develop and strike once the window opens.',
    [],
    [['Luke Kuykendall', 'LB', 'Tackling machine for a decade'], ['Sammy Pruitt', 'WR', 'Five-foot-nine of pure spite']],
    'On opposing third downs, a hiss rolls through the stands.',
    [['1995–2002', 'Hatchlings'], ['2003–2015', 'Two Title-Game Trips'], ['2016–2023', 'Shedding Skin']]],
  saints: [1967, 'Crescent Dome', 'family', 'The Flame Keepers',
    'Forty years of paper bags over faces, then one night in 2009 that lit up the whole city. In New Orleans the flame is a promise.',
    [2009],
    [['Drew Bremond', 'QB', 'Rebuilt a franchise and a city'], ['Archie Mandeville', 'QB', 'A great player on some very bad teams']],
    'A second-line brass band leads the team out of the tunnel.',
    [['1967–1986', 'The Paper Bag Years'], ['1987–2005', 'Striking the Match'], ['2006–2023', 'Keep the Flame']]],
  bucs: [1976, 'Lakeside Bowl', 'underdog', 'The Wading Line',
    'They lost their first 26 games and have won two titles since. The Herons wait in the shallows until the moment is right, then strike.',
    [2002, 2020],
    [['Derrick Brandt', 'LB', 'Speed-to-the-ball linebacker for fourteen seasons'], ['Otis Rhea', 'DT', 'Undersized and unblockable']],
    'The crowd rises on one leg for the final defensive stand.',
    [['1976–1996', 'Zero and Twenty-Six'], ['1997–2008', 'The Wade'], ['2009–2023', 'Rising with Purpose']]],
  cowboys: [1960, 'Alamo Plaza Stadium', 'showtime', 'The Sounder',
    'Five titles, the biggest stadium in Texas and the loudest opinions in football. The Javelinas are never out of the headlines.',
    [1971, 1977, 1992, 1993, 1995],
    [['Roger Stallworth', 'QB', '"Captain Comeback"'], ['Emmett Ruiz', 'RB', 'The league\'s all-time leading rusher']],
    'Cowbells and tusk-horn trumpets ring out after every defensive stand.',
    [['1960–1970', 'Branding Iron'], ['1971–1995', 'Texas Royalty'], ['1996–2023', 'The Spotlight Years']]],
  giants: [1925, 'Old Growth Field', 'defense', 'The Grove',
    'Nearly a century old and rooted in Northwest rain. The Firs win with pass rushers and patience.',
    [1927, 1938, 1956, 1986, 1990, 2007, 2011],
    [['Lawrence Tolbert', 'LB', 'Changed the way offenses block'], ['Frank Gilley', 'RB', 'Golden boy of the \'56 champions']],
    'Fans raise cedar branches for every goal-line stand.',
    [['1925–1963', 'Old Growth'], ['1981–1991', 'The Big Timber Defense'], ['2004–2023', 'Deep Roots']]],
  eagles: [1933, 'Independence Field', 'renegade', 'The Congress',
    'Philadelphia wrote the country\'s rules and the rules of hostile crowds. Two early titles, a long wait, and then the most unlikely champion of the century.',
    [1948, 1949, 1960, 2017],
    [['Reggie Whitmore', 'DE', '"The Reverend" of the pass rush'], ['Chuck Bedrosian', 'C/LB', 'The last of the sixty-minute men']],
    'Before every kickoff, the crowd shouts out "the Declaration," a fight-song chant.',
    [['1933–1960', 'The Founding Fathers'], ['1961–2016', 'Life, Liberty and Heartbreak'], ['2017–2023', 'The Underdog Charter']]],
  commanders: [1932, 'James River Field', 'analytics', 'The Skulk',
    'Clever, cunning and sometimes too smart for their own good. The Foxes have out-schemed the league five times.',
    [1937, 1942, 1982, 1987, 1991],
    [['"Slingin\'" Sammy Bower', 'QB', 'Turned the forward pass into a weapon'], ['Joe Rigby', 'RB', 'Seventy yards on fourth-and-one in the \'82 title game']],
    'The "Hail to the Foxes" march is older than the stadium.',
    [['1932–1945', 'The Slinger Era'], ['1981–1992', 'The Den of Genius'], ['1993–2023', 'Outfoxed']]],
  cardinals: [1920, 'High Desert Stadium', 'youth', 'The Dust Cloud',
    'The league\'s oldest nomads: three cities, two titles and a century of patience. Albuquerque wants a fast team for a fast town.',
    [1925, 1947],
    [['Larry Wilder', 'S', 'Played through two broken hands'], ['Aeneas Holt', 'CB', 'A shutdown corner before the term existed']],
    'A "beep-beep" horn sounds after every first down.',
    [['1920–1959', 'The Nomads'], ['1960–2007', 'Desert Mirage'], ['2008–2023', 'Setting the Pace']]],
  '49ers': [1946, 'Silicon Field', 'dynasty', 'The Tide Pool',
    'Five titles built on a precise, timing-based offense that the whole league eventually copied. San Jose expects excellence, and it expects it to look good.',
    [1981, 1984, 1988, 1989, 1994],
    [['Joe Montoya', 'QB', 'Four for four in title games'], ['Jerome Price', 'WR', 'The greatest receiver who ever lived']],
    'Before every home game, the big screen replays "The Catch."',
    [['1946–1978', 'Low Tide'], ['1979–1998', 'The Trident Dynasty'], ['1999–2023', 'Three Points, One Purpose']]],
  seahawks: [1976, 'Sound Stadium', 'defense', 'The Run',
    'The loudest stadium in the league and a secondary called "the Riptide." Seattle swims upstream and likes it.',
    [2013],
    [['Steve Largemont', 'WR', 'Had the surest hands of the dome days'], ['Richard Shermer', 'CB', 'Nobody talked more, and nobody allowed less']],
    'Before kickoff, a local hero raises the "12th Fish" flag.',
    [['1976–2004', 'Upstream'], ['2005–2014', 'The Riptide'], ['2015–2023', 'Against the Current']]],
  rams: [1936, 'Coastline Coliseum', 'showtime', 'The Blades',
    'Twice Hollywood\'s team. The Sabers bring stars, lights and a flashy scheme, and they have cashed it in on both coasts.',
    [1945, 1951, 1999, 2021],
    [['Kurt Wexler', 'QB', 'From grocery bagger to league MVP'], ['Aaron Donner', 'DT', 'The most dominant interior rusher of his era']],
    'A guest star draws a saber and plants it at midfield.',
    [['1936–1994', 'Coastline Classics'], ['1995–2015', 'The Greatest Show'], ['2016–2023', 'Make Your Mark']]],
};

export const LORE = Object.fromEntries(Object.entries(RAW).map(([id, r]) => {
  const [founded, stadium, culture, fans, origin, titles, legends, tradition, eras] = r;
  return [id, {
    founded, stadium, culture, fans, origin, titles, tradition,
    legends: legends.map(([name, position, note]) => ({ name, position, note })),
    eras: eras.map(([span, name]) => ({ span, name })),
  }];
}));

export function loreFor(teamId) {
  return LORE[teamId] ?? null;
}

export function cultureFor(teamId) {
  const lore = LORE[teamId];
  return lore ? { id: lore.culture, ...CULTURES[lore.culture] } : null;
}

/**
 * Titles before the save began, plus titles won in this save.
 * @param {string} teamId
 * @param {Array}  seasonHistory  store.seasonHistory ({ year, seasonRecap: { winner, finalist, playoffTeams } })
 */
export function franchiseHistory(teamId, seasonHistory = []) {
  const lore = LORE[teamId];
  if (!lore) return null;
  const saveTitles = [];
  const saveFinals = [];
  let playoffs = 0;
  for (const h of seasonHistory || []) {
    const r = h?.seasonRecap;
    if (!r) continue;
    const year = r.year ?? h.year;
    if (r.winner === teamId) saveTitles.push(year);
    else if (r.finalist === teamId || r.finalist?.id === teamId) saveFinals.push(year);
    if (r.playoffTeams?.includes(teamId)) playoffs += 1;
  }
  const titles = [...lore.titles, ...saveTitles].filter(y => y != null);
  const last = titles.length ? Math.max(...titles) : null;
  const seasonsPlayed = (seasonHistory || []).length;
  const currentYear = LEAGUE_START_YEAR + seasonsPlayed;
  return {
    titles,
    saveTitles,
    saveFinals,
    playoffs,
    lastTitle: last,
    drought: last == null ? currentYear - lore.founded : currentYear - last - 1,
    neverWon: last == null,
  };
}

// ── Decisions ───────────────────────────────────────────────────────────────

// Which stance each choice of a story event takes, by event type and choice
// index (progression.js EVENT_POOL order).
const CHOICE_STANCES = {
  BREAKOUT_CANDIDATE: [['develop', 'bold'], ['patient', 'discipline']],
  VETERAN_MENTOR:     [['develop', 'loyal'], ['process']],
  SCOUTING_REPORT:    [['prep', 'bold'], ['process']],
  CHEMISTRY_EVENT:    [['care', 'loyal'], ['prep']],
  MEDIA_CONTROVERSY:  [['discipline'], ['loyal', 'patient']],
  POSITION_COACH:     [['bold'], ['process', 'patient']],
  INJURY_SCARE:       [['care', 'patient'], ['tough', 'bold']],
  UNDERDOG_MOMENT:    [['fire'], ['discipline', 'prep']],
  CONTRACT_EXTENSION: [['loyal'], ['process', 'patient']],
  RIVAL_WEEK:         [['fire', 'prep'], ['process']],
};

export function choiceStances(eventType, index) {
  return CHOICE_STANCES[eventType]?.[index] ?? [];
}

/** How a team's culture reads a choice: fit -1 / 0 / 1 plus a one-line reaction. */
export function cultureReaction(teamId, eventType, index) {
  const culture = cultureFor(teamId);
  const stances = choiceStances(eventType, index);
  if (!culture || !stances.length) return { fit: 0, stances, reaction: null, culture };
  const score = stances.reduce((sum, s) => sum + (culture.values[s] ?? 0), 0);
  const fit = score > 0 ? 1 : score < 0 ? -1 : 0;
  return {
    fit,
    stances,
    culture,
    reaction: fit > 0 ? culture.love : fit < 0 ? culture.hate : 'The building shrugs. It is not a call anyone here will remember.',
  };
}

const CATEGORY = {
  BREAKOUT_CANDIDATE: ['Player development', 'Director of player development'],
  VETERAN_MENTOR:     ['Player development', 'Team captain'],
  SCOUTING_REPORT:    ['Game plan', 'Defensive coordinator'],
  CHEMISTRY_EVENT:    ['Locker room', 'Team captain'],
  MEDIA_CONTROVERSY:  ['Locker room', 'Head of media relations'],
  POSITION_COACH:     ['Coaching staff', 'Assistant general manager'],
  INJURY_SCARE:       ['Medical', 'Head athletic trainer'],
  UNDERDOG_MOMENT:    ['Game plan', 'Team captain'],
  CONTRACT_EXTENSION: ['Front office', 'Director of football operations'],
  RIVAL_WEEK:         ['Game plan', 'Offensive coordinator'],
};

const QUOTES = {
  BREAKOUT_CANDIDATE: c => `I have seen ${c.p} take reps with the ones in walkthrough and not blink once. Give the kid the ball and find out what we have.`,
  VETERAN_MENTOR:     c => `${c.v} came to me asking to take ${c.r} under his wing. Guys like that do not offer twice.`,
  SCOUTING_REPORT:    () => `Their protection slides the wrong way on long yardage, every time. If we can sell the look, we will be sitting in the backfield by the second quarter.`,
  CHEMISTRY_EVENT:    () => `The guys want to get away together for a weekend. No phones, no playbook, just the team.`,
  MEDIA_CONTROVERSY:  c => `The clip of ${c.p} is everywhere. Reporters are going to be waiting at your podium in twenty minutes, and they want to know what you are going to do.`,
  POSITION_COACH:     c => `A top ${c.g} coach just came free. That almost never happens midseason. The catch is that the players would be learning a new language on the fly.`,
  INJURY_SCARE:       c => `${c.p} says he is fine. He always says he is fine. The scan says maybe. It is your call, coach.`,
  UNDERDOG_MOMENT:    () => `Every show picked against us this week. The guys have printed the headlines and taped them inside their lockers.`,
  CONTRACT_EXTENSION: c => `${c.p}'s agent called this morning. He wants to be here, but he also knows what the open market could pay him.`,
  RIVAL_WEEK:         () => `The crowd circled this one in July. Whatever we have in the bag, this is the week to use it.`,
};

const STAKES = {
  BREAKOUT_CANDIDATE: 'A young player\'s growth vs. the depth chart\'s pecking order.',
  VETERAN_MENTOR:     'Two players\' practice time vs. the rookie\'s long-term ceiling.',
  SCOUTING_REPORT:    'This week\'s result vs. the risk of overthinking the game plan.',
  CHEMISTRY_EVENT:    'Two weeks of team chemistry vs. a weekend of film study.',
  MEDIA_CONTROVERSY:  'Locker-room trust vs. a distracted star.',
  POSITION_COACH:     'A month-long ceiling raise vs. midseason stability.',
  INJURY_SCARE:       'A key player on Sunday vs. his health for the rest of the season.',
  UNDERDOG_MOMENT:    'Emotional fuel vs. keeping everyone calm.',
  CONTRACT_EXTENSION: 'A franchise player\'s future vs. your offseason cap flexibility.',
  RIVAL_WEEK:         'Bragging rights vs. overloading the week.',
};

const effectChips = (effect, ctx, eventType, index) => {
  if (!effect) {
    if (eventType === 'INJURY_SCARE' && index === 1) return [{ label: 'Plays Sunday', tone: 'positive' }, { label: 'Injury risk', tone: 'negative' }];
    if (eventType === 'CONTRACT_EXTENSION' && index === 1) return [{ label: 'May test free agency', tone: 'warning' }];
    return [{ label: 'No change', tone: 'neutral' }];
  }
  const w = n => `${n} wk${n === 1 ? '' : 's'}`;
  switch (effect.type) {
    case 'player_ovr':      return [{ label: `+${effect.delta} OVR · ${ctx.pShort}`, tone: 'positive' }, { label: 'Permanent', tone: 'info' }];
    case 'rookie_ovr':      return [{ label: `+${effect.delta} OVR · ${ctx.rShort}`, tone: 'positive' }, { label: 'Permanent', tone: 'info' }];
    case 'win_prob_boost':  return [{ label: `+${effect.value}% win chance`, tone: 'positive' }, { label: w(effect.weeks), tone: 'info' }];
    case 'team_boost':      return [{ label: `+${effect.value} team OVR`, tone: 'positive' }, { label: w(effect.weeks), tone: 'info' }];
    case 'group_boost':     return [{ label: `+${effect.value} ${ctx.g} OVR`, tone: 'positive' }, { label: w(effect.weeks), tone: 'info' }];
    case 'player_penalty':  return [{ label: `${effect.delta} OVR · ${ctx.pShort}`, tone: 'negative' }, { label: w(effect.weeks), tone: 'info' }];
    case 'rest_player':     return [{ label: `${ctx.pShort} sits this week`, tone: 'warning' }, { label: 'No injury risk', tone: 'positive' }];
    case 'extend_contract': return [{ label: `${effect.years}-yr extension`, tone: 'positive' }, { label: 'Off the market', tone: 'info' }];
    default:                return [];
  }
};

const shortName = p => (p?.name ? p.name.split(' ').slice(-1)[0] : 'player');

/**
 * Everything the decision screen needs beyond the raw event: category,
 * speaker quote, stakes, and per-choice effect chips and culture fit.
 * @param {object} event   pendingStoryEvent
 * @param {object} opts    { teamId, roster }
 */
export function decisionScene(event, { teamId, roster = [] } = {}) {
  if (!event) return null;
  const byId = id => roster.find(p => p.id === id);
  const player = byId(event.ctx?.playerId);
  const vet = byId(event.ctx?.vetId);
  const rookie = byId(event.ctx?.rookieId);
  const c = {
    p: player?.name ?? 'He', v: vet?.name ?? 'A veteran', r: rookie?.name ?? 'the rookie',
    pShort: shortName(player), rShort: shortName(rookie),
    g: event.ctx?.posGroup ?? 'position',
  };
  const [category, speaker] = CATEGORY[event.type] ?? ['Front office', 'Your staff'];
  const quote = QUOTES[event.type]?.(c) ?? null;
  const culture = cultureFor(teamId);

  return {
    category,
    speaker,
    quote,
    stakes: STAKES[event.type] ?? null,
    culture,
    subject: player || rookie || null,
    choices: (event.choices || []).map((choice, i) => {
      const r = cultureReaction(teamId, event.type, i);
      return {
        ...choice,
        chips: effectChips(choice.effect, c, event.type, i),
        stances: r.stances.map(s => STANCES[s]),
        fit: r.fit,
        reaction: r.reaction,
      };
    }),
  };
}
