// 32 fictional football teams with unique color schemes and identities
export const TEAMS = [
    // AFC NORTH
    {
        id: 'ravens',
        location: 'Baltimore',
        abbreviation: 'BAL',
        conference: 'AFC',
        division: 'North',
        theme: {
            primary: '#5e2b87',
            secondary: '#1c1154',
            accent: '#f4c542',
            bgA: '#f0ebf8',
            bgB: '#e4ddf4',
            pattern: 'stripes'
        }
    },
    {
        id: 'bengals',
        location: 'Cincinnati',
        abbreviation: 'CIN',
        conference: 'AFC',
        division: 'North',
        theme: {
            primary: '#ff6b35',
            secondary: '#1a1a1a',
            accent: '#ffd23f',
            bgA: '#fff5f0',
            bgB: '#ffe8dc',
            pattern: 'stripes'
        }
    },
    {
        id: 'browns',
        location: 'Cleveland',
        abbreviation: 'CLE',
        conference: 'AFC',
        division: 'North',
        theme: {
            primary: '#8b4513',
            secondary: '#ff6b35',
            accent: '#f0e68c',
            bgA: '#faf5f0',
            bgB: '#f0e8dc',
            pattern: 'paper'
        }
    },
    {
        id: 'steelers',
        location: 'Pittsburgh',
        abbreviation: 'PIT',
        conference: 'AFC',
        division: 'North',
        theme: {
            primary: '#1a1a1a',
            secondary: '#ffd700',
            accent: '#ff4444',
            bgA: '#f5f5f5',
            bgB: '#e8e8e8',
            pattern: 'dots'
        }
    },

    // AFC SOUTH
    {
        id: 'texans',
        location: 'Houston',
        abbreviation: 'HOU',
        conference: 'AFC',
        division: 'South',
        theme: {
            primary: '#c41e3a',
            secondary: '#1c3c5a',
            accent: '#ffffff',
            bgA: '#fef0f2',
            bgB: '#fce0e4',
            pattern: 'dots'
        }
    },
    {
        id: 'colts',
        location: 'Indianapolis',
        abbreviation: 'IND',
        conference: 'AFC',
        division: 'South',
        theme: {
            primary: '#0057b8',
            secondary: '#ffffff',
            accent: '#c0c0c0',
            bgA: '#e8f4ff',
            bgB: '#d4e8ff',
            pattern: 'stripes'
        }
    },
    {
        id: 'jaguars',
        location: 'Jacksonville',
        abbreviation: 'JAX',
        conference: 'AFC',
        division: 'South',
        theme: {
            primary: '#008080',
            secondary: '#d4a942',
            accent: '#1a1a1a',
            bgA: '#e8f5f5',
            bgB: '#d4ebeb',
            pattern: 'dots'
        }
    },
    {
        id: 'titans',
        location: 'Nashville',
        abbreviation: 'TEN',
        conference: 'AFC',
        division: 'South',
        theme: {
            primary: '#4b92db',
            secondary: '#c60c30',
            accent: '#8cc8ff',
            bgA: '#eff7ff',
            bgB: '#dbeeff',
            pattern: 'stripes'
        }
    },

    // AFC EAST
    {
        id: 'bills',
        location: 'Buffalo',
        abbreviation: 'BUF',
        conference: 'AFC',
        division: 'East',
        theme: {
            primary: '#0051a5',
            secondary: '#c60c30',
            accent: '#ffffff',
            bgA: '#e8f2ff',
            bgB: '#d4e6ff',
            pattern: 'dots'
        }
    },
    {
        id: 'dolphins',
        location: 'Miami',
        abbreviation: 'MIA',
        conference: 'AFC',
        division: 'East',
        theme: {
            primary: '#008e97',
            secondary: '#fc4c02',
            accent: '#00b8c6',
            bgA: '#e8f9fa',
            bgB: '#d4f3f5',
            pattern: 'dots'
        }
    },
    {
        id: 'patriots',
        location: 'Boston',
        abbreviation: 'NE',
        conference: 'AFC',
        division: 'East',
        theme: {
            primary: '#003087',
            secondary: '#c60c30',
            accent: '#b0b7bc',
            bgA: '#e8efff',
            bgB: '#d4e2ff',
            pattern: 'stripes'
        }
    },
    {
        id: 'jets',
        location: 'New York',
        abbreviation: 'NYJ',
        conference: 'AFC',
        division: 'East',
        theme: {
            primary: '#0c5c3e',
            secondary: '#ffffff',
            accent: '#7ed957',
            bgA: '#e8f5f0',
            bgB: '#d4ebe3',
            pattern: 'paper'
        }
    },

    // AFC WEST
    {
        id: 'broncos',
        location: 'Denver',
        abbreviation: 'DEN',
        conference: 'AFC',
        division: 'West',
        theme: {
            primary: '#fb4f14',
            secondary: '#002244',
            accent: '#ffa500',
            bgA: '#fff5f0',
            bgB: '#ffe8dc',
            pattern: 'dots'
        }
    },
    {
        id: 'chiefs',
        location: 'Kansas City',
        abbreviation: 'KC',
        conference: 'AFC',
        division: 'West',
        theme: {
            primary: '#e31837',
            secondary: '#ffb81c',
            accent: '#ffffff',
            bgA: '#fef0f2',
            bgB: '#fce0e4',
            pattern: 'stripes'
        }
    },
    {
        id: 'raiders',
        location: 'Las Vegas',
        abbreviation: 'LV',
        conference: 'AFC',
        division: 'West',
        theme: {
            primary: '#1a1a1a',
            secondary: '#c0c0c0',
            accent: '#d4d4d4',
            bgA: '#f5f5f5',
            bgB: '#e8e8e8',
            pattern: 'paper'
        }
    },
    {
        id: 'chargers',
        location: 'Los Angeles',
        abbreviation: 'LAC',
        conference: 'AFC',
        division: 'West',
        theme: {
            primary: '#007bc7',
            secondary: '#ffc20e',
            accent: '#87ceeb',
            bgA: '#e8f6ff',
            bgB: '#d4edff',
            pattern: 'dots'
        }
    },

    // NFC NORTH
    {
        id: 'bears',
        location: 'Chicago',
        abbreviation: 'CHI',
        conference: 'NFC',
        division: 'North',
        theme: {
            primary: '#0b162a',
            secondary: '#c83803',
            accent: '#ff8a3d',
            bgA: '#f0f2f5',
            bgB: '#e3e6ea',
            pattern: 'stripes'
        }
    },
    {
        id: 'lions',
        location: 'Detroit',
        abbreviation: 'DET',
        conference: 'NFC',
        division: 'North',
        theme: {
            primary: '#0076b6',
            secondary: '#b0b7bc',
            accent: '#5eb3e8',
            bgA: '#e8f6ff',
            bgB: '#d4edff',
            pattern: 'dots'
        }
    },
    {
        id: 'packers',
        location: 'Green Bay',
        abbreviation: 'GB',
        conference: 'NFC',
        division: 'North',
        theme: {
            primary: '#203731',
            secondary: '#ffb612',
            accent: '#7ed957',
            bgA: '#f0f5f3',
            bgB: '#e3ebe8',
            pattern: 'paper'
        }
    },
    {
        id: 'vikings',
        location: 'Minneapolis',
        abbreviation: 'MIN',
        conference: 'NFC',
        division: 'North',
        theme: {
            primary: '#4f2683',
            secondary: '#ffc62f',
            accent: '#a78ce6',
            bgA: '#f7f0ff',
            bgB: '#efe3ff',
            pattern: 'dots'
        }
    },

    // NFC SOUTH
    {
        id: 'falcons',
        location: 'Atlanta',
        abbreviation: 'ATL',
        conference: 'NFC',
        division: 'South',
        theme: {
            primary: '#a71930',
            secondary: '#1a1a1a',
            accent: '#e85c5c',
            bgA: '#fef0f2',
            bgB: '#fce0e4',
            pattern: 'stripes'
        }
    },
    {
        id: 'panthers',
        location: 'Carolina',
        abbreviation: 'CAR',
        conference: 'NFC',
        division: 'South',
        theme: {
            primary: '#0085ca',
            secondary: '#1a1a1a',
            accent: '#87ceeb',
            bgA: '#e8f8ff',
            bgB: '#d4f1ff',
            pattern: 'dots'
        }
    },
    {
        id: 'saints',
        location: 'New Orleans',
        abbreviation: 'NO',
        conference: 'NFC',
        division: 'South',
        theme: {
            primary: '#d3bc8d',
            secondary: '#1a1a1a',
            accent: '#ffffff',
            bgA: '#faf8f0',
            bgB: '#f5f1e3',
            pattern: 'paper'
        }
    },
    {
        id: 'bucs',
        location: 'Tampa Bay',
        abbreviation: 'TB',
        conference: 'NFC',
        division: 'South',
        theme: {
            primary: '#d50a0a',
            secondary: '#34302b',
            accent: '#ff6b6b',
            bgA: '#fff0f0',
            bgB: '#ffe3e3',
            pattern: 'stripes'
        }
    },

    // NFC EAST
    {
        id: 'cowboys',
        location: 'Dallas',
        abbreviation: 'DAL',
        conference: 'NFC',
        division: 'East',
        theme: {
            primary: '#003594',
            secondary: '#869397',
            accent: '#5b8dc9',
            bgA: '#e8f0ff',
            bgB: '#d4e3ff',
            pattern: 'stripes'
        }
    },
    {
        id: 'giants',
        location: 'New Jersey',
        abbreviation: 'NYG',
        conference: 'NFC',
        division: 'East',
        theme: {
            primary: '#0b2265',
            secondary: '#a71930',
            accent: '#4d6cb5',
            bgA: '#e8eeff',
            bgB: '#d4deff',
            pattern: 'dots'
        }
    },
    {
        id: 'eagles',
        location: 'Philadelphia',
        abbreviation: 'PHI',
        conference: 'NFC',
        division: 'East',
        theme: {
            primary: '#004c54',
            secondary: '#a5acaf',
            accent: '#5eb3a3',
            bgA: '#e8f5f5',
            bgB: '#d4ebeb',
            pattern: 'paper'
        }
    },
    {
        id: 'commanders',
        location: 'Washington',
        abbreviation: 'WAS',
        conference: 'NFC',
        division: 'East',
        theme: {
            primary: '#773141',
            secondary: '#ffb612',
            accent: '#c97b94',
            bgA: '#fef5f7',
            bgB: '#fce8ed',
            pattern: 'stripes'
        }
    },

    // NFC WEST
    {
        id: 'cardinals',
        location: 'Arizona',
        abbreviation: 'ARI',
        conference: 'NFC',
        division: 'West',
        theme: {
            primary: '#97233f',
            secondary: '#ffb612',
            accent: '#e85c74',
            bgA: '#fef0f3',
            bgB: '#fce0e6',
            pattern: 'dots'
        }
    },
    {
        id: '49ers',
        location: 'San Francisco',
        abbreviation: 'SF',
        conference: 'NFC',
        division: 'West',
        theme: {
            primary: '#aa0000',
            secondary: '#b3995d',
            accent: '#ff6b6b',
            bgA: '#fff0f0',
            bgB: '#ffe3e3',
            pattern: 'stripes'
        }
    },
    {
        id: 'seahawks',
        location: 'Seattle',
        abbreviation: 'SEA',
        conference: 'NFC',
        division: 'West',
        theme: {
            primary: '#002244',
            secondary: '#69be28',
            accent: '#a5acaf',
            bgA: '#e8f0f5',
            bgB: '#d4e3eb',
            pattern: 'paper'
        }
    },
    {
        id: 'rams',
        location: 'Los Angeles',
        abbreviation: 'LAR',
        conference: 'NFC',
        division: 'West',
        theme: {
            primary: '#003594',
            secondary: '#ffd100',
            accent: '#5b8dc9',
            bgA: '#e8f0ff',
            bgB: '#d4e3ff',
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
