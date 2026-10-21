# Grow the care catalog to 100 species

Status: shipped (0.9.0)
Issue: https://github.com/timoneiro/fronds/issues/57
Builds after: none

## Problem
The bundled catalog has 61 species. Photo ID (Pl@ntNet) and name search (iNaturalist) now find
plants it doesn't cover, such as calla lilies, Pink Princess philodendrons and Venus flytraps. Those plants get no watering default, care tip or pet-safety warning. Adding the
most popular missing houseplants turns more of those matches into "In catalog" with care defaults.

## Behavior
1. 39 new species are in the catalog (100 in total), exactly as listed in the tasks below. They work
   like every existing entry:
   - local search by common name, scientific name or alias (cultivars included, e.g. "Pink Princess"),
   - care defaults when chosen,
   - an "In catalog" mark on Pl@ntNet and iNaturalist results with the same scientific name, an
     alias or (for genus-level entries) the same genus,
   - the Care card with light, humidity, pet toxicity, difficulty and tip.
2. Existing entries don't change.

Examples:
- Typing "pink princess" in the species picker shows "Blushing philodendron *Philodendron
  erubescens*". Choosing it sets the watering interval to 7 days.
- An iNaturalist search for "costela-de-adão" is unchanged. A Pl@ntNet or iNaturalist result
  *Zantedeschia aethiopica* now shows "In catalog", and choosing it sets the calla lily with a 5-day
  interval.
- A Pl@ntNet result *Streptocarpus saxorum* matches the genus entry "Cape primrose". *Streptocarpus
  ionanthus* still matches the African violet through its existing alias.

## Out of scope
- Changing existing entries, their values or their aliases.
- An "unknown" pet-toxicity value. Species that ASPCA doesn't list (at species or genus level) are
  not added.
- Moving the catalog to JSON, non-English aliases, or new fields on `Species`.
- Species beyond the 39 below. A later batch gets its own spec.

## Constraints
- **Pet toxicity comes from ASPCA.** Each value below is taken from the ASPCA cat and dog plant lists
  (checked 2026-10-21; cats and dogs agree for all). The value is either the species' own entry
  (including synonyms) or, when the species isn't listed, the genus where every listed member agrees.
- Data only: no schema, backup, sync or UI change. Plants store `speciesId`, so new ids are additive.
- Every `wiki` title was checked to exist on English Wikipedia (2026-10-21). For redirects, the
  target article title is used (e.g. `Taro`, `Meyer lemon`, `Venus flytrap`).

## Context for implementers
- `CATALOG` in `src/species/catalog.ts`: one `s({ ... })` line per species. Append the new lines at
  the end of the array, after `tillandsia`, in the order given, indented by two spaces like the
  existing lines. Copy the entry lines exactly: the values are decided and must not be "improved".
- `norm`, `findByScientificName`, `searchCatalog` in the same file. Tests are in
  `src/species/catalog.test.ts`.
- Four common names are already shared by two entries each and stay allowed: "split-leaf
  philodendron", "ribbon plant", "dracaena" and "money tree" (compared with `norm`).
- Don't touch: anything outside `src/species/catalog.ts`, `src/species/catalog.test.ts`, `README.md`,
  `CHANGELOG.md`, `package.json` and `package-lock.json`.

## Tasks
1. **Catalog integrity test**
   - Change: a new test in `src/species/catalog.test.ts` that asserts:
     - every `scientificName` is unique after `norm`;
     - no alias `norm`-equals another entry's `scientificName`;
     - any name (common name, scientific name or alias, after `norm`) used by more than one entry is
       one of the four allowed shared names above;
     - every entry has a non-empty `wiki` and `tip`, and `waterEveryDays` is an integer from 1 to 30.
   - Depends on: none
   - Done when: `npx vitest run src/species/catalog.test.ts` passes on the current catalog.
   - Executor: haiku
2. **Batch A: aroids and climbers**
   - Change: append these lines to `CATALOG`, and add a test that `findByScientificName` finds
     `Philodendron erubescens` → `philodendron-erubescens` and `Philodendron xanadu` → `thaumatophyllum-xanadu`, and that `searchCatalog('pink princess')[0].id` is `philodendron-erubescens`.
     Cebu Blue pothos ties with golden pothos on the query "Epipremnum" and sorts first, so in the
     existing test "finds by common name, alias and scientific name" change
     `searchCatalog('Epipremnum')` to `searchCatalog('Epipremnum aureum')` (same expected id). This is
     the only change allowed to an existing assertion.
     ```ts
       s({ id: 'philodendron-erubescens', commonName: 'Blushing philodendron', scientificName: 'Philodendron erubescens', aliases: ['Pink Princess', 'Birkin', 'Imperial Red', 'Prince of Orange'], light: 'bright-indirect', waterEveryDays: 7, humidity: 'medium', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Philodendron erubescens', tip: 'Water when the top 2–3 cm are dry; more light keeps pink and red variegation bright.' }),
       s({ id: 'epipremnum-pinnatum', commonName: 'Cebu Blue pothos', scientificName: 'Epipremnum pinnatum', aliases: ['Cebu Blue', 'Dragon-tail plant', 'Centipede tongavine'], light: 'bright-indirect', waterEveryDays: 7, humidity: 'medium', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Epipremnum pinnatum', tip: 'Let the top half of the soil dry; give it something to climb and the leaves grow bigger.' }),
       s({ id: 'thaumatophyllum-xanadu', commonName: 'Xanadu philodendron', scientificName: 'Thaumatophyllum xanadu', aliases: ['Philodendron xanadu', 'Winterbourn'], light: 'bright-indirect', waterEveryDays: 7, humidity: 'medium', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Philodendron xanadu', tip: 'Grows wide rather than tall; keep the soil lightly moist and wipe the leaves now and then.' }),
       s({ id: 'caladium', commonName: 'Caladium', scientificName: 'Caladium', aliases: ['Angel wings', 'Heart of Jesus', 'Caladium bicolor'], light: 'bright-indirect', waterEveryDays: 5, humidity: 'high', petToxicity: 'toxic', difficulty: 'hard', wiki: 'Caladium', tip: 'Keep evenly moist while in leaf. It dies back in autumn: store the tuber dry and replant in spring.' }),
       s({ id: 'colocasia-esculenta', commonName: 'Taro', scientificName: 'Colocasia esculenta', aliases: ['Black Magic', 'Mojito', 'Dasheen', 'Colocasia'], light: 'bright-indirect', waterEveryDays: 4, humidity: 'high', petToxicity: 'toxic', difficulty: 'medium', wiki: 'Taro', tip: 'A thirsty plant: never let it dry out, and give it a big pot and plenty of light.' }),
       s({ id: 'zantedeschia-aethiopica', commonName: 'Calla lily', scientificName: 'Zantedeschia aethiopica', aliases: ['Arum lily', 'Calla'], light: 'bright-indirect', waterEveryDays: 5, humidity: 'medium', petToxicity: 'toxic', difficulty: 'medium', wiki: 'Zantedeschia aethiopica', tip: 'Keep moist while growing and flowering; afterwards water less and let the leaves die back.' }),
       s({ id: 'tradescantia-fluminensis', commonName: 'Small-leaf spiderwort', scientificName: 'Tradescantia fluminensis', aliases: ['Quicksilver', 'Speedy Henry', 'River spiderwort'], light: 'bright-indirect', waterEveryDays: 7, humidity: 'medium', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Tradescantia fluminensis', tip: 'Pinch the tips to keep it bushy; cuttings root in a glass of water within a week.' }),
       s({ id: 'tradescantia-pallida', commonName: 'Purple heart', scientificName: 'Tradescantia pallida', aliases: ['Purple queen', 'Setcreasea pallida'], light: 'bright-direct', waterEveryDays: 7, humidity: 'low', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Tradescantia pallida', tip: 'Needs strong light to stay purple; let the top of the soil dry between waterings.' }),
       s({ id: 'hoya-kerrii', commonName: 'Sweetheart hoya', scientificName: 'Hoya kerrii', aliases: ['Valentine hoya', 'Lucky heart', 'Wax hearts'], light: 'bright-indirect', waterEveryDays: 14, humidity: 'medium', petToxicity: 'non-toxic', difficulty: 'medium', wiki: 'Hoya kerrii', tip: 'Single-leaf hearts without a node never grow on. Let the soil dry fully between waterings.' }),
       s({ id: 'ficus-pumila', commonName: 'Creeping fig', scientificName: 'Ficus pumila', aliases: ['Climbing fig', 'Fig ivy'], light: 'medium', waterEveryDays: 5, humidity: 'high', petToxicity: 'toxic', difficulty: 'medium', wiki: 'Ficus pumila', tip: 'Its small leaves crisp quickly if the soil dries out; keep it evenly moist and away from heaters.' }),
     ```
   - Depends on: 1
   - Done when: `npx vitest run src/species/catalog.test.ts` passes and
     `grep -c "^  s({" src/species/catalog.ts` prints 71.
   - Executor: haiku
3. **Batch B: succulents, cacti and small foliage**
   - Change: append these lines to `CATALOG`, and add a test that `findByScientificName` finds
     `Sansevieria cylindrica` → `dracaena-angolensis` and `Lithops aucampiae` → `lithops`.
     Cylindrical snake plant ties with the snake plant on the query "snake" and sorts first, so in
     the existing test "finds by common name, alias and scientific name" change
     `searchCatalog('snake')` to `searchCatalog('snake plant')` (same expected id). This is the only
     change allowed to an existing assertion in this task.
     ```ts
       s({ id: 'dracaena-angolensis', commonName: 'Cylindrical snake plant', scientificName: 'Dracaena angolensis', aliases: ['Sansevieria cylindrica', 'African spear', 'Spear sansevieria'], light: 'low', waterEveryDays: 21, humidity: 'low', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Dracaena angolensis', tip: 'Even more drought-tolerant than the snake plant; in winter, water about once a month.' }),
       s({ id: 'kalanchoe-tomentosa', commonName: 'Panda plant', scientificName: 'Kalanchoe tomentosa', aliases: ['Pussy ears', 'Chocolate soldier'], light: 'bright-direct', waterEveryDays: 14, humidity: 'low', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Kalanchoe tomentosa', tip: 'Its fuzzy leaves store water: water the soil, not the leaves, and only when it is dry.' }),
       s({ id: 'opuntia-microdasys', commonName: 'Bunny ears cactus', scientificName: 'Opuntia microdasys', aliases: ["Angel's wings cactus", 'Polka-dot cactus'], light: 'bright-direct', waterEveryDays: 21, humidity: 'low', petToxicity: 'non-toxic', difficulty: 'easy', wiki: 'Opuntia microdasys', tip: 'The fuzzy dots are tiny barbed spines, so handle it with tongs. Keep it almost dry in winter.' }),
       s({ id: 'mammillaria', commonName: 'Pincushion cactus', scientificName: 'Mammillaria', aliases: ['Powder puff cactus', 'Old lady cactus', 'Thimble cactus'], light: 'bright-direct', waterEveryDays: 21, humidity: 'low', petToxicity: 'non-toxic', difficulty: 'easy', wiki: 'Mammillaria', tip: 'Water thoroughly, then let it dry completely; a cool, dry winter helps it flower.' }),
       s({ id: 'lithops', commonName: 'Living stones', scientificName: 'Lithops', aliases: ['Pebble plant', 'Stone plant'], light: 'bright-direct', waterEveryDays: 21, humidity: 'low', petToxicity: 'non-toxic', difficulty: 'hard', wiki: 'Lithops', tip: "Don't water while the old leaves shrivel and new ones form inside them (winter to spring)." }),
       s({ id: 'rhipsalis', commonName: 'Mistletoe cactus', scientificName: 'Rhipsalis', aliases: ['Rhipsalis baccifera', 'Jungle cactus'], light: 'bright-indirect', waterEveryDays: 7, humidity: 'medium', petToxicity: 'non-toxic', difficulty: 'easy', wiki: 'Rhipsalis', tip: 'A jungle cactus: unlike desert cacti it likes regular water and no direct midday sun.' }),
       s({ id: 'curio-radicans', commonName: 'String of bananas', scientificName: 'Curio radicans', aliases: ['Senecio radicans', 'Fishhooks'], light: 'bright-indirect', waterEveryDays: 14, humidity: 'low', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Curio radicans', tip: 'Hardier and faster-growing than string of pearls; water when the bananas start to soften.' }),
       s({ id: 'euphorbia-trigona', commonName: 'African milk tree', scientificName: 'Euphorbia trigona', aliases: ['Cathedral cactus', 'Royal Red'], light: 'bright-direct', waterEveryDays: 14, humidity: 'low', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Euphorbia trigona', tip: 'Its white sap irritates skin and eyes, so wear gloves when pruning.' }),
       s({ id: 'pilea-cadierei', commonName: 'Aluminium plant', scientificName: 'Pilea cadierei', aliases: ['Aluminum plant', 'Watermelon pilea'], light: 'bright-indirect', waterEveryDays: 6, humidity: 'medium', petToxicity: 'non-toxic', difficulty: 'easy', wiki: 'Pilea cadierei', tip: 'Pinch the tips to keep it bushy; it gets leggy after a couple of years, so root cuttings to renew it.' }),
       s({ id: 'soleirolia-soleirolii', commonName: "Baby's tears", scientificName: 'Soleirolia soleirolii', aliases: ['Mind-your-own-business', "Angel's tears", 'Helxine'], light: 'medium', waterEveryDays: 4, humidity: 'high', petToxicity: 'non-toxic', difficulty: 'medium', wiki: 'Soleirolia', tip: 'Never let it dry out; water from below. It collapses fast when thirsty but usually recovers.' }),
     ```
   - Depends on: 2
   - Done when: `npx vitest run src/species/catalog.test.ts` passes and
     `grep -c "^  s({" src/species/catalog.ts` prints 81.
   - Executor: haiku
4. **Batch C: trees, palms and ferns**
   - Change: append these lines to `CATALOG`, and add a test that `findByScientificName` finds
     `Cordyline terminalis` → `cordyline-fruticosa` and `Davallia fejeensis` → `davallia`.
     ```ts
       s({ id: 'phoenix-roebelenii', commonName: 'Pygmy date palm', scientificName: 'Phoenix roebelenii', aliases: ['Dwarf date palm', 'Miniature date palm'], light: 'bright-indirect', waterEveryDays: 7, humidity: 'medium', petToxicity: 'non-toxic', difficulty: 'medium', wiki: 'Phoenix roebelenii', tip: 'Keep the soil lightly moist and away from cold drafts; trim only fully brown fronds.' }),
       s({ id: 'ravenea-rivularis', commonName: 'Majesty palm', scientificName: 'Ravenea rivularis', aliases: ['Majestic palm'], light: 'bright-indirect', waterEveryDays: 5, humidity: 'high', petToxicity: 'non-toxic', difficulty: 'hard', wiki: 'Ravenea rivularis', tip: 'Needs more light and water than most palms; brown tips mean the air or soil is too dry.' }),
       s({ id: 'dracaena-reflexa', commonName: 'Song of India', scientificName: 'Dracaena reflexa', aliases: ['Pleomele', 'Malaysian dracaena', 'Song of Jamaica'], light: 'bright-indirect', waterEveryDays: 10, humidity: 'medium', petToxicity: 'toxic', difficulty: 'medium', wiki: 'Dracaena reflexa', tip: 'Let the top half of the soil dry; brown tips often come from fluoride in tap water.' }),
       s({ id: 'cordyline-fruticosa', commonName: 'Ti plant', scientificName: 'Cordyline fruticosa', aliases: ['Hawaiian ti', 'Good luck plant', 'Cordyline terminalis'], light: 'bright-indirect', waterEveryDays: 7, humidity: 'high', petToxicity: 'toxic', difficulty: 'medium', wiki: 'Cordyline fruticosa', tip: 'Bright light keeps the red and pink colours; keep the soil lightly moist, never soggy.' }),
       s({ id: 'citrus-meyeri', commonName: 'Meyer lemon', scientificName: 'Citrus × meyeri', aliases: ['Lemon tree', 'Citrus'], light: 'bright-direct', waterEveryDays: 7, humidity: 'medium', petToxicity: 'toxic', difficulty: 'hard', wiki: 'Meyer lemon', tip: 'Water deeply when the top 3 cm are dry and feed in spring and summer; it drops leaves in low light.' }),
       s({ id: 'platycerium-bifurcatum', commonName: 'Staghorn fern', scientificName: 'Platycerium bifurcatum', aliases: ['Elkhorn fern'], light: 'bright-indirect', waterEveryDays: 7, humidity: 'high', petToxicity: 'non-toxic', difficulty: 'medium', wiki: 'Platycerium bifurcatum', tip: "Water when the root ball feels light (soak mounted ones for 15 minutes); don't remove the brown shield fronds." }),
       s({ id: 'davallia', commonName: "Rabbit's foot fern", scientificName: 'Davallia', aliases: ['Davallia fejeensis', "Hare's foot fern", 'Ball fern'], light: 'bright-indirect', waterEveryDays: 5, humidity: 'high', petToxicity: 'non-toxic', difficulty: 'medium', wiki: 'Davallia', tip: "Let the furry rhizomes creep over the pot edge; don't bury them. Keep the soil lightly moist." }),
       s({ id: 'musa-acuminata', commonName: 'Banana plant', scientificName: 'Musa acuminata', aliases: ['Dwarf Cavendish', 'Banana', 'Musa'], light: 'bright-direct', waterEveryDays: 4, humidity: 'high', petToxicity: 'non-toxic', difficulty: 'medium', wiki: 'Musa acuminata', tip: 'Grows fast in summer and needs lots of water and light; torn leaves are normal.' }),
       s({ id: 'polyscias-fruticosa', commonName: 'Ming aralia', scientificName: 'Polyscias fruticosa', aliases: ['Polyscias', 'Aralia'], light: 'bright-indirect', waterEveryDays: 7, humidity: 'high', petToxicity: 'toxic', difficulty: 'hard', wiki: 'Polyscias fruticosa', tip: 'Drops leaves when moved or chilled; let the top few cm dry, then water thoroughly.' }),
     ```
   - Depends on: 3
   - Done when: `npx vitest run src/species/catalog.test.ts` passes and
     `grep -c "^  s({" src/species/catalog.ts` prints 90.
   - Executor: haiku
5. **Batch D: flowering plants**
   - Change: append these lines to `CATALOG`, and add a test that `findByScientificName` finds
     `Streptocarpus saxorum` → `streptocarpus`, `Streptocarpus ionanthus` → `saintpaulia` (unchanged)
     and `Hibiscus rosa-sinensis` → `hibiscus-rosa-sinensis`.
     ```ts
       s({ id: 'guzmania', commonName: 'Guzmania', scientificName: 'Guzmania', aliases: ['Bromeliad', 'Scarlet star'], light: 'bright-indirect', waterEveryDays: 7, humidity: 'medium', petToxicity: 'non-toxic', difficulty: 'easy', wiki: 'Guzmania', tip: 'Keep a little water in the central cup and the soil just moist. It dies after flowering, so pot up the pups.' }),
       s({ id: 'cyclamen-persicum', commonName: 'Cyclamen', scientificName: 'Cyclamen persicum', aliases: ['Persian cyclamen', "Florist's cyclamen"], light: 'bright-indirect', waterEveryDays: 5, humidity: 'medium', petToxicity: 'toxic', difficulty: 'medium', wiki: 'Cyclamen persicum', tip: 'Likes it cool (10–18 °C); water from below and keep water off the tuber.' }),
       s({ id: 'streptocarpus', commonName: 'Cape primrose', scientificName: 'Streptocarpus', aliases: ['Streps'], light: 'bright-indirect', waterEveryDays: 7, humidity: 'medium', petToxicity: 'non-toxic', difficulty: 'medium', wiki: 'Streptocarpus', tip: 'Let the top of the soil dry between waterings; cut spent flower stalks off at the base.' }),
       s({ id: 'aeschynanthus', commonName: 'Lipstick plant', scientificName: 'Aeschynanthus', aliases: ['Aeschynanthus radicans', 'Basket vine'], light: 'bright-indirect', waterEveryDays: 7, humidity: 'high', petToxicity: 'non-toxic', difficulty: 'medium', wiki: 'Aeschynanthus', tip: 'Flowers best in bright light with the soil slightly dry between waterings.' }),
       s({ id: 'hibiscus-rosa-sinensis', commonName: 'Chinese hibiscus', scientificName: 'Hibiscus rosa-sinensis', aliases: ['Hibiscus', 'Rose of China', 'Tropical hibiscus'], light: 'bright-direct', waterEveryDays: 4, humidity: 'medium', petToxicity: 'non-toxic', difficulty: 'medium', wiki: 'Hibiscus × rosa-sinensis', tip: 'Thirsty while flowering, so check the soil every few days; buds drop if it dries out or is moved.' }),
       s({ id: 'gardenia-jasminoides', commonName: 'Gardenia', scientificName: 'Gardenia jasminoides', aliases: ['Cape jasmine', 'Gardenia augusta'], light: 'bright-indirect', waterEveryDays: 5, humidity: 'high', petToxicity: 'toxic', difficulty: 'hard', wiki: 'Gardenia jasminoides', tip: 'Use rain or filtered water and keep it evenly moist; buds drop in drafts or dry air.' }),
       s({ id: 'dionaea-muscipula', commonName: 'Venus flytrap', scientificName: 'Dionaea muscipula', aliases: ['Flytrap'], light: 'bright-direct', waterEveryDays: 3, humidity: 'high', petToxicity: 'non-toxic', difficulty: 'hard', wiki: 'Venus flytrap', tip: 'Keep the pot standing in rain or distilled water (never tap water) and give it a cool winter rest.' }),
       s({ id: 'jasminum-polyanthum', commonName: 'Pink jasmine', scientificName: 'Jasminum polyanthum', aliases: ['Jasmine', 'Chinese jasmine'], light: 'bright-direct', waterEveryDays: 5, humidity: 'medium', petToxicity: 'non-toxic', difficulty: 'medium', wiki: 'Jasminum polyanthum', tip: 'Needs a cool spell (below 15 °C) in late autumn to set its winter flowers; keep the soil lightly moist.' }),
       s({ id: 'hippeastrum', commonName: 'Amaryllis', scientificName: 'Hippeastrum', aliases: ["Knight's star lily", 'Amaryllis bulb'], light: 'bright-indirect', waterEveryDays: 7, humidity: 'medium', petToxicity: 'toxic', difficulty: 'medium', wiki: 'Hippeastrum', tip: 'Water sparingly until the flower stalk appears; after flowering, keep the leaves growing to recharge the bulb.' }),
       s({ id: 'chrysanthemum', commonName: 'Chrysanthemum', scientificName: 'Chrysanthemum', aliases: ['Mum', 'Pot mum', "Florist's daisy"], light: 'bright-indirect', waterEveryDays: 4, humidity: 'medium', petToxicity: 'toxic', difficulty: 'medium', wiki: 'Chrysanthemum', tip: 'Pot mums drink a lot while flowering: check the soil every couple of days and pick off spent blooms.' }),
     ```
   - Depends on: 4
   - Done when: `npx vitest run src/species/catalog.test.ts` passes and
     `grep -c "^  s({" src/species/catalog.ts` prints 100.
   - Executor: haiku
6. **Contributor rules**
   - Change:
     - In `README.md` "Adding a species", after the ASPCA sentence, add: "If ASPCA doesn't list the
       species, use its genus only when every listed member of the genus agrees; otherwise leave the
       species out. Aliases may include cultivar names; `npm test` checks that names don't clash."
     - The README layout line `species/   bundled care catalog + Wikipedia client` becomes
       `species/   bundled care catalog + Wikipedia, iNaturalist and Pl@ntNet clients`.
     - In the comment at the top of `src/species/catalog.ts`, after the ASPCA line, add
       " * Species ASPCA doesn't list (nor their genus) are left out."
   - Depends on: 5
   - Done when: `grep -n "every listed member of the genus agrees" README.md`, `grep -n "iNaturalist
     and Pl@ntNet clients" README.md` and `grep -n "nor their genus" src/species/catalog.ts` each
     match, and `npm run lint` passes.
   - Executor: haiku
7. **Version and changelog**
   - Change: minor bump in `package.json` and `package-lock.json`, and a `CHANGELOG.md` entry
     ("**39 more plants in the care guide**": 100 species now, with examples such as calla lily,
     Pink Princess philodendron, Venus flytrap, Meyer lemon and staghorn fern. Mention that cultivar
     names like "Pink Princess" or "Cebu Blue" find their species, and that photo ID and online
     search now show "In catalog" for more plants).
   - Depends on: 6
   - Done when: `npm test` and `npm run build` pass.
   - Executor: haiku

## Acceptance criteria
- [ ] `grep -c "^  s({" src/species/catalog.ts` prints 100.
- [ ] `npm test` passes, including the integrity test and the per-batch lookups.
- [ ] `git diff main -- src/species/catalog.ts` shows only added lines inside `CATALOG`, plus the one
      comment line. No existing entry line is changed or removed.
- [ ] In the dev app, "pink princess" in the species picker finds Blushing philodendron, and choosing
      it sets the interval to 7.
- [ ] On a new plant, choosing "Calla lily" from the picker shows its Care card with "Toxic to cats &
      dogs" and the Wikipedia description of *Zantedeschia aethiopica*.
- [ ] An iNaturalist search for "venus flytrap" marks *Dionaea muscipula* "In catalog".

## Verification
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all pass.
- Manual checks above on `npm run dev`.

## Escalate when
- The integrity test fails because of a new entry (a name clash). Report the clash; don't rename or
  drop an alias yourself.
- A new entry would need a value that differs from the spec, or a type change.
- Any check fails after two attempts.

## Open questions
- None.

## Notes
- The 39 species came from a list of popular houseplants missing from the catalog. Nine candidates
  were dropped because ASPCA lists neither them nor their genus: mini monstera (*Rhaphidophora
  tetrasperma*), gasteria, agave, croton, olive tree, blue star fern, Stromanthe, Ctenanthe and urn
  plant (*Aechmea fasciata*). A future spec can add them with an "unknown" pet-safety value.
- Genus-derived toxicity (no species entry on ASPCA): *Philodendron erubescens*, *Epipremnum
  pinnatum*, *Thaumatophyllum xanadu* (ASPCA's *Philodendron selloum* is now *Thaumatophyllum*),
  *Tradescantia pallida*, *Dracaena angolensis* (with *Sansevieria trifasciata*), *Kalanchoe
  tomentosa*, *Opuntia microdasys*, *Curio radicans* (ASPCA's *Senecio*, as the existing string of
  pearls), *Euphorbia trigona*, *Citrus × meyeri*, *Hibiscus rosa-sinensis*, *Polyscias fruticosa*,
  *Ficus pumila* and the genus-level entries.
- New aliases avoid names existing entries already use ("Inch plant" and "Wandering dude" belong to
  *Tradescantia zebrina*; "Elephant ear" to Alocasia).
- Care values are indoor baselines in the same style as the existing entries. Review them in the
  spec PR, since the executor copies them as they are.
- No overlap with other specs: data only, no shared helpers or Dexie versions.
- Search ties: `searchCatalog` breaks equal scores by common name, so some new entries now come
  first for one-word queries ("Epipremnum" → Cebu Blue pothos, "snake" → Cylindrical snake plant,
  "ficus" → Creeping fig, "cactus" → *Euphorbia trigona*). The two existing tests that hit this now
  query the full name. A later spec could make ties prefer older entries; future catalog batches
  should check existing `searchCatalog` assertions against the new names first.
