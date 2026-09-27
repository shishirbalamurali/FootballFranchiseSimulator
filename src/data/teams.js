// 32 original franchises. Internal IDs are permanent save/roster-import keys.
// brandId names the supplied logo; never rename an ID when a franchise is rebranded.
//
// draftStyle values:
//   'BPA'       — best player available, ignores need almost entirely
//   'NEED'      — heavy need-based, fills roster holes first
//   'OFFENSE'   — biased toward offensive skill positions (QB/WR/TE/RB)
//   'DEFENSE'   — biased toward defensive positions (DL/LB/CB/S)
//   'TRENCHES'  — obsessed with OL and DL
//   'SKILL'     — prioritizes WR, CB, S — playmakers
//   'REBUILD'   — targets highest upside/potential (pot) over immediate OVR
//   'BALANCED'  — moderate need + moderate value; versatile approach

export const TEAMS = [
    // AFC NORTH
    {
        id: 'ravens',
        brandId: 'baltimore-ospreys',
        location: "Baltimore",
        name: "Ospreys",
        nickname: "Own the air",
        abbreviation: "BAL",
        conference: 'AFC',
        division: 'North',
        draftStyle: 'DEFENSE',
        theme: {
            primary: "#092C59",
            secondary: "#C57C42",
            accent: "#C57C42",
            bgA: "#eceef0",
            bgB: "#dbdfe5",
            pattern: 'stripes'
        }
    },
    {
        id: 'bengals',
        brandId: 'louisville-hounds',
        location: "Louisville",
        name: "Hounds",
        nickname: "Run together",
        abbreviation: "LOU",
        conference: 'AFC',
        division: 'North',
        draftStyle: 'SKILL',
        theme: {
            primary: "#400A41",
            secondary: "#E5B746",
            accent: "#E5B746",
            bgA: "#efecef",
            bgB: "#e2dbe2",
            pattern: 'stripes'
        }
    },
    {
        id: 'browns',
        brandId: 'columbus-owls',
        location: "Columbus",
        name: "Owls",
        nickname: "See the whole field",
        abbreviation: "COL",
        conference: 'AFC',
        division: 'North',
        draftStyle: 'REBUILD',
        theme: {
            primary: "#101D40",
            secondary: "#C46B2A",
            accent: "#C46B2A",
            bgA: "#ecedef",
            bgB: "#dcdde2",
            pattern: 'paper'
        }
    },
    {
        id: 'steelers',
        brandId: 'st-louis-archers',
        location: "St. Louis",
        name: "Archers",
        nickname: "Find your mark",
        abbreviation: "STL",
        conference: 'AFC',
        division: 'North',
        draftStyle: 'TRENCHES',
        theme: {
            primary: "#073E2F",
            secondary: "#C6A34A",
            accent: "#C6A34A",
            bgA: "#ebefee",
            bgB: "#dae2e0",
            pattern: 'dots'
        }
    },

    // AFC SOUTH
    {
        id: 'texans',
        brandId: 'houston-apollos',
        location: "Houston",
        name: "Apollos",
        nickname: "Reach higher",
        abbreviation: "HOU",
        conference: 'AFC',
        division: 'South',
        draftStyle: 'DEFENSE',
        theme: {
            primary: "#0C3158",
            secondary: "#F27924",
            accent: "#F27924",
            bgA: "#eceef0",
            bgB: "#dbe0e5",
            pattern: 'dots'
        }
    },
    {
        id: 'colts',
        brandId: 'salt-lake-ibex',
        location: "Salt Lake",
        name: "Ibex",
        nickname: "Take the high ground",
        abbreviation: "SLC",
        conference: 'AFC',
        division: 'South',
        draftStyle: 'BALANCED',
        theme: {
            primary: "#360F41",
            secondary: "#AFD8F5",
            accent: "#AFD8F5",
            bgA: "#eeecef",
            bgB: "#e1dbe2",
            pattern: 'stripes'
        }
    },
    {
        id: 'jaguars',
        brandId: 'memphis-kings',
        location: "Memphis",
        name: "Kings",
        nickname: "Earn the crown",
        abbreviation: "MEM",
        conference: 'AFC',
        division: 'South',
        draftStyle: 'REBUILD',
        theme: {
            primary: "#16367D",
            secondary: "#C8803B",
            accent: "#C8803B",
            bgA: "#eceef2",
            bgB: "#dce1ea",
            pattern: 'dots'
        }
    },
    {
        id: 'titans',
        brandId: 'nashville-switchmen',
        location: "Nashville",
        name: "Switchmen",
        nickname: "Set the direction",
        abbreviation: "NSH",
        conference: 'AFC',
        division: 'South',
        draftStyle: 'TRENCHES',
        theme: {
            primary: "#252724",
            secondary: "#F36B19",
            accent: "#F36B19",
            bgA: "#ededed",
            bgB: "#dedfde",
            pattern: 'stripes'
        }
    },

    // AFC EAST
    {
        id: 'bills',
        brandId: 'omaha-mammoths',
        location: "Omaha",
        name: "Mammoths",
        nickname: "Built to endure",
        abbreviation: "OMA",
        conference: 'AFC',
        division: 'East',
        draftStyle: 'OFFENSE',
        theme: {
            primary: "#43133E",
            secondary: "#EEE1C5",
            accent: "#EEE1C5",
            bgA: "#efecef",
            bgB: "#e2dce2",
            pattern: 'dots'
        }
    },
    {
        id: 'dolphins',
        brandId: 'austin-bats',
        location: "Austin",
        name: "Bats",
        nickname: "Own the night",
        abbreviation: "AUS",
        conference: 'AFC',
        division: 'East',
        draftStyle: 'SKILL',
        theme: {
            primary: "#151A20",
            secondary: "#00B5C8",
            accent: "#00B5C8",
            bgA: "#eceded",
            bgB: "#dcddde",
            pattern: 'dots'
        }
    },
    {
        id: 'patriots',
        brandId: 'boston-beacons',
        location: "Boston",
        name: "Beacons",
        nickname: "Light the way",
        abbreviation: "BOS",
        conference: 'AFC',
        division: 'East',
        draftStyle: 'BPA',
        theme: {
            primary: "#052B57",
            secondary: "#FFBC08",
            accent: "#FFBC08",
            bgA: "#ebeef0",
            bgB: "#dadfe5",
            pattern: 'stripes'
        }
    },
    {
        id: 'jets',
        brandId: 'new-york-gargoyles',
        location: "New York",
        name: "Gargoyles",
        nickname: "Stand above",
        abbreviation: "NY",
        conference: 'AFC',
        division: 'East',
        draftStyle: 'NEED',
        theme: {
            primary: "#23282B",
            secondary: "#00875C",
            accent: "#00875C",
            bgA: "#ededee",
            bgB: "#dedfdf",
            pattern: 'paper'
        }
    },

    // AFC WEST
    {
        id: 'broncos',
        brandId: 'denver-pikas',
        location: "Denver",
        name: "Pikas",
        nickname: "Small margin. Big fight.",
        abbreviation: "DEN",
        conference: 'AFC',
        division: 'West',
        draftStyle: 'DEFENSE',
        theme: {
            primary: "#16466C",
            secondary: "#F7BA13",
            accent: "#F7BA13",
            bgA: "#eceff1",
            bgB: "#dce3e8",
            pattern: 'dots'
        }
    },
    {
        id: 'chiefs',
        brandId: 'oklahoma-city-bison',
        location: "Oklahoma City",
        name: "Bison",
        nickname: "Move as one",
        abbreviation: "OKC",
        conference: 'AFC',
        division: 'West',
        draftStyle: 'OFFENSE',
        theme: {
            primary: "#960D1B",
            secondary: "#ECD9B5",
            accent: "#ECD9B5",
            bgA: "#f4eced",
            bgB: "#eddbdd",
            pattern: 'stripes'
        }
    },
    {
        id: 'raiders',
        brandId: 'las-vegas-sidewinders',
        location: "Las Vegas",
        name: "Sidewinders",
        nickname: "Strike from anywhere",
        abbreviation: "LV",
        conference: 'AFC',
        division: 'West',
        draftStyle: 'BPA',
        theme: {
            primary: "#181A1B",
            secondary: "#DCC095",
            accent: "#DCC095",
            bgA: "#eceded",
            bgB: "#dddddd",
            pattern: 'paper'
        }
    },
    {
        id: 'chargers',
        brandId: 'san-diego-gray-whales',
        location: "San Diego",
        name: "Gray Whales",
        nickname: "Turn the tide",
        abbreviation: "SD",
        conference: 'AFC',
        division: 'West',
        draftStyle: 'SKILL',
        theme: {
            primary: "#075089",
            secondary: "#999D9D",
            accent: "#999D9D",
            bgA: "#ebf0f3",
            bgB: "#dae4eb",
            pattern: 'dots'
        }
    },

    // NFC NORTH
    {
        id: 'bears',
        brandId: 'chicago-riveters',
        location: "Chicago",
        name: "Riveters",
        nickname: "Built by hand",
        abbreviation: "CHI",
        conference: 'NFC',
        division: 'North',
        draftStyle: 'TRENCHES',
        theme: {
            primary: "#781527",
            secondary: "#7B7E7F",
            accent: "#7B7E7F",
            bgA: "#f2eced",
            bgB: "#e9dcdf",
            pattern: 'stripes'
        }
    },
    {
        id: 'lions',
        brandId: 'detroit-peregrines',
        location: "Detroit",
        name: "Peregrines",
        nickname: "Win the next yard",
        abbreviation: "DET",
        conference: 'NFC',
        division: 'North',
        draftStyle: 'OFFENSE',
        theme: {
            primary: "#072B56",
            secondary: "#FF6C1D",
            accent: "#FF6C1D",
            bgA: "#ebeef0",
            bgB: "#dadfe5",
            pattern: 'dots'
        }
    },
    {
        id: 'packers',
        brandId: 'milwaukee-badgers',
        location: "Milwaukee",
        name: "Badgers",
        nickname: "Hold your ground",
        abbreviation: "MIL",
        conference: 'NFC',
        division: 'North',
        draftStyle: 'BPA',
        theme: {
            primary: "#073C28",
            secondary: "#EDE7C9",
            accent: "#EDE7C9",
            bgA: "#ebefed",
            bgB: "#dae1df",
            pattern: 'paper'
        }
    },
    {
        id: 'vikings',
        brandId: 'minneapolis-muskox',
        location: "Minneapolis",
        name: "Muskox",
        nickname: "Weather every storm",
        abbreviation: "MIN",
        conference: 'NFC',
        division: 'North',
        draftStyle: 'SKILL',
        theme: {
            primary: "#06494C",
            secondary: "#F1EDDD",
            accent: "#F1EDDD",
            bgA: "#ebeff0",
            bgB: "#dae3e3",
            pattern: 'dots'
        }
    },

    // NFC SOUTH
    {
        id: 'falcons',
        brandId: 'atlanta-stags',
        location: "Atlanta",
        name: "Stags",
        nickname: "Lead the charge",
        abbreviation: "ATL",
        conference: 'NFC',
        division: 'South',
        draftStyle: 'OFFENSE',
        theme: {
            primary: "#083F2C",
            secondary: "#DBCA83",
            accent: "#DBCA83",
            bgA: "#ebefee",
            bgB: "#dbe2df",
            pattern: 'stripes'
        }
    },
    {
        id: 'panthers',
        brandId: 'raleigh-copperheads',
        location: "Raleigh",
        name: "Copperheads",
        nickname: "Wait. Read. Strike.",
        abbreviation: "RAL",
        conference: 'NFC',
        division: 'South',
        draftStyle: 'REBUILD',
        theme: {
            primary: "#174B36",
            secondary: "#BE702F",
            accent: "#BE702F",
            bgA: "#ecf0ee",
            bgB: "#dce3e1",
            pattern: 'dots'
        }
    },
    {
        id: 'saints',
        brandId: 'new-orleans-lanterns',
        location: "New Orleans",
        name: "Lanterns",
        nickname: "Keep the flame",
        abbreviation: "NO",
        conference: 'NFC',
        division: 'South',
        draftStyle: 'BALANCED',
        theme: {
            primary: "#401444",
            secondary: "#F4B323",
            accent: "#F4B323",
            bgA: "#efecef",
            bgB: "#e2dce2",
            pattern: 'paper'
        }
    },
    {
        id: 'bucs',
        brandId: 'orlando-herons',
        location: "Orlando",
        name: "Herons",
        nickname: "Rise with purpose",
        abbreviation: "ORL",
        conference: 'NFC',
        division: 'South',
        draftStyle: 'NEED',
        theme: {
            primary: "#143357",
            secondary: "#F66E54",
            accent: "#F66E54",
            bgA: "#eceef0",
            bgB: "#dce0e5",
            pattern: 'stripes'
        }
    },

    // NFC EAST
    {
        id: 'cowboys',
        brandId: 'san-antonio-javelinas',
        location: "San Antonio",
        name: "Javelinas",
        nickname: "Never give ground",
        abbreviation: "SA",
        conference: 'NFC',
        division: 'East',
        draftStyle: 'TRENCHES',
        theme: {
            primary: "#66112E",
            secondary: "#DCC595",
            accent: "#DCC595",
            bgA: "#f1ecee",
            bgB: "#e7dcdf",
            pattern: 'stripes'
        }
    },
    {
        id: 'giants',
        brandId: 'portland-firs',
        location: "Portland",
        name: "Firs",
        nickname: "Rooted here",
        abbreviation: "POR",
        conference: 'NFC',
        division: 'East',
        draftStyle: 'DEFENSE',
        theme: {
            primary: "#085637",
            secondary: "#BABEBD",
            accent: "#BABEBD",
            bgA: "#ebf0ee",
            bgB: "#dbe5e1",
            pattern: 'dots'
        }
    },
    {
        id: 'eagles',
        brandId: 'philadelphia-founders',
        location: "Philadelphia",
        name: "Founders",
        nickname: "Write the next chapter",
        abbreviation: "PHI",
        conference: 'NFC',
        division: 'East',
        draftStyle: 'BPA',
        theme: {
            primary: "#760B25",
            secondary: "#F3E8CD",
            accent: "#F3E8CD",
            bgA: "#f2eced",
            bgB: "#e9dbde",
            pattern: 'paper'
        }
    },
    {
        id: 'commanders',
        brandId: 'richmond-foxes',
        location: "Richmond",
        name: "Foxes",
        nickname: "Always one step ahead",
        abbreviation: "RIC",
        conference: 'NFC',
        division: 'East',
        draftStyle: 'NEED',
        theme: {
            primary: "#B7481C",
            secondary: "#272D32",
            accent: "#272D32",
            bgA: "#f6efed",
            bgB: "#f1e3dd",
            pattern: 'stripes'
        }
    },

    // NFC WEST
    {
        id: 'cardinals',
        brandId: 'albuquerque-roadrunners',
        location: "Albuquerque",
        name: "Roadrunners",
        nickname: "Set the pace",
        abbreviation: "ABQ",
        conference: 'NFC',
        division: 'West',
        draftStyle: 'REBUILD',
        theme: {
            primary: "#048F9E",
            secondary: "#B74521",
            accent: "#B74521",
            bgA: "#ebf4f4",
            bgB: "#daecee",
            pattern: 'dots'
        }
    },
    {
        id: '49ers',
        brandId: 'san-jose-tridents',
        location: "San Jose",
        name: "Tridents",
        nickname: "Three points. One purpose.",
        abbreviation: "SJ",
        conference: 'NFC',
        division: 'West',
        draftStyle: 'TRENCHES',
        theme: {
            primary: "#062C4E",
            secondary: "#54CBA4",
            accent: "#54CBA4",
            bgA: "#ebeef0",
            bgB: "#dadfe4",
            pattern: 'stripes'
        }
    },
    {
        id: 'seahawks',
        brandId: 'seattle-sockeyes',
        location: "Seattle",
        name: "Sockeyes",
        nickname: "Against the current",
        abbreviation: "SEA",
        conference: 'NFC',
        division: 'West',
        draftStyle: 'DEFENSE',
        theme: {
            primary: "#B00E36",
            secondary: "#092F4C",
            accent: "#092F4C",
            bgA: "#f6ecee",
            bgB: "#f0dbe1",
            pattern: 'paper'
        }
    },
    {
        id: 'rams',
        brandId: 'los-angeles-sabers',
        location: "Los Angeles",
        name: "Sabers",
        nickname: "Make your mark",
        abbreviation: "LA",
        conference: 'NFC',
        division: 'West',
        draftStyle: 'BALANCED',
        theme: {
            primary: "#430D67",
            secondary: "#E4C76B",
            accent: "#E4C76B",
            bgA: "#efecf1",
            bgB: "#e2dbe7",
            pattern: 'dots'
        }
    }
];

// Helper functions
export const getTeamById = (id) => TEAMS.find(t => t.id === id);
export const getTeamsByDivision = (conference, division) =>
    TEAMS.filter(t => t.conference === conference && t.division === division);
export const getTeamsByConference = (conference) =>
    TEAMS.filter(t => t.conference === conference);

export const DIVISIONS = ['North', 'South', 'East', 'West'];
export const CONFERENCES = ['AFC', 'NFC'];
