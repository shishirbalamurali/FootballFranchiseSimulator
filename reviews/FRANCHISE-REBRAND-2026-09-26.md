# Franchise rebrand — September 26, 2026

All 32 supplied logos are integrated. San Jose Tridents is intentional.
WebP versions retain original dimensions and transparency, with quality-94 encoding. Original files are untouched.

## Compatibility

Internal keys and division membership remain unchanged. Saves, schedules, player histories, draft picks, roster imports and playbook selections continue to use those stable keys. Loaded team metadata and champion objects refresh to the current identities; old narrative text remains a historical snapshot.

## Identity map

| Internal save key | Current franchise | Colors | Supplied file |
| --- | --- | --- | --- |
| ravens | Baltimore Ospreys | #092C59 / #C57C42 | baltimore_ospreys.png |
| bengals | Louisville Hounds | #400A41 / #E5B746 | loiusville_hounds.png |
| browns | Columbus Owls | #101D40 / #C46B2A | columbus_owls.png |
| steelers | St. Louis Archers | #073E2F / #C6A34A | stlouis_archers.png |
| texans | Houston Apollos | #0C3158 / #F27924 | houston_apollos.png |
| colts | Salt Lake Ibex | #360F41 / #AFD8F5 | saltlakecity_ibex.png |
| jaguars | Memphis Kings | #16367D / #C8803B | memphis_kings.png |
| titans | Nashville Switchmen | #252724 / #F36B19 | nashville_switchmen.png |
| bills | Omaha Mammoths | #43133E / #EEE1C5 | omaha_mammoths.png |
| dolphins | Austin Bats | #151A20 / #00B5C8 | austin_bats.png |
| patriots | Boston Beacons | #052B57 / #FFBC08 | boston_beacons.png |
| jets | New York Gargoyles | #23282B / #00875C | newyork_gargoyles.png |
| broncos | Denver Pikas | #16466C / #F7BA13 | denver_pikas.png |
| chiefs | Oklahoma City Bison | #960D1B / #ECD9B5 | okcbison.png |
| raiders | Las Vegas Sidewinders | #181A1B / #DCC095 | lasvegas_sidewinders.png |
| chargers | San Diego Gray Whales | #075089 / #999D9D | sandiego_whales.png |
| bears | Chicago Riveters | #781527 / #7B7E7F | chicago_riveters.png |
| lions | Detroit Peregrines | #072B56 / #FF6C1D | detroit_peregines.png |
| packers | Milwaukee Badgers | #073C28 / #EDE7C9 | milwaukee_badgers.png |
| vikings | Minneapolis Muskox | #06494C / #F1EDDD | minneapolis_muskox.png |
| falcons | Atlanta Stags | #083F2C / #DBCA83 | atlanta_stags.png |
| panthers | Raleigh Copperheads | #174B36 / #BE702F | raleigh_copperheads.png |
| saints | New Orleans Lanterns | #401444 / #F4B323 | neworlean_lanterns.png |
| bucs | Orlando Herons | #143357 / #F66E54 | orlando_herron.png |
| cowboys | San Antonio Javelinas | #66112E / #DCC595 | san antonio_javelinas.png |
| giants | Portland Firs | #085637 / #BABEBD | portland_firs.png |
| eagles | Philadelphia Founders | #760B25 / #F3E8CD | philidelphia_founder.png |
| commanders | Richmond Foxes | #B7481C / #272D32 | richmond_foxes.png |
| cardinals | Albuquerque Roadrunners | #048F9E / #B74521 | albequrque_roadrunners.png |
| 49ers | San Jose Tridents | #062C4E / #54CBA4 | sanjose_tridents.png |
| seahawks | Seattle Sockeyes | #B00E36 / #092F4C | seattle_sockeyes.png |
| rams | Los Angeles Sabers | #430D67 / #E4C76B | losangeles_sabers.png |

## Verification

- `npm test`: passes, including 32-logo resolution, palette contrast, playbook branding, and legacy save hydration assertions.
- `npm run lint`: passes. Fixed the previously reported development-fixture export issue and disposed preview roots on hot reload.
- `npm run build`: passes; the existing large-JavaScript-chunk advisory remains.
- Browser: all 32 images loaded on team selection; checked San Jose hub, OKC schedule, New York dark standings and branded playbooks, with no horizontal overflow at 1280px.
- `tests/branding-preview.html` provides an in-memory gallery and real page previews without saving a franchise. Automatic approval review blocked starting a saved test franchise, so page verification used this non-persisting fixture instead.
