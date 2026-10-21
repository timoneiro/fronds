/**
 * Bundled houseplant care catalog — works offline and needs no API key.
 *
 * Values are general indoor baselines for a typical home, not rules:
 * `waterEveryDays` seeds a plant's interval and the user adjusts from there.
 * Pet toxicity follows the ASPCA toxic/non-toxic plant lists (cats & dogs).
 * To add a species, append an entry; `wiki` must be an existing English
 * Wikipedia article title (used for the description and photo).
 */

import type { Plant } from '../db/types'

export type Light = 'low' | 'medium' | 'bright-indirect' | 'bright-direct'
export type Level = 'low' | 'medium' | 'high'
export type PetToxicity = 'non-toxic' | 'toxic' | 'highly-toxic'
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface Species {
  id: string
  commonName: string
  scientificName: string
  aliases?: string[]
  light: Light
  waterEveryDays: number
  humidity: Level
  petToxicity: PetToxicity
  difficulty: Difficulty
  wiki: string
  tip: string
}

export const LIGHT_LABEL: Record<Light, string> = {
  low: 'Tolerates low light',
  medium: 'Medium, indirect light',
  'bright-indirect': 'Bright, indirect light',
  'bright-direct': 'Bright light, some direct sun',
}

export const TOXICITY_LABEL: Record<PetToxicity, string> = {
  'non-toxic': 'Pet safe',
  toxic: 'Toxic to cats & dogs',
  'highly-toxic': 'Highly toxic to pets — can be fatal',
}

const s = (x: Species) => x

export const CATALOG: Species[] = [
  s({ id: 'monstera-deliciosa', commonName: 'Monstera', scientificName: 'Monstera deliciosa', aliases: ['Swiss cheese plant', 'Split-leaf philodendron'], light: 'bright-indirect', waterEveryDays: 7, humidity: 'medium', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Monstera deliciosa', tip: 'Let the top few cm of soil dry out between waterings; give it a moss pole to climb.' }),
  s({ id: 'monstera-adansonii', commonName: 'Swiss cheese vine', scientificName: 'Monstera adansonii', aliases: ['Monkey mask', 'Adansonii'], light: 'bright-indirect', waterEveryDays: 6, humidity: 'high', petToxicity: 'toxic', difficulty: 'medium', wiki: 'Monstera adansonii', tip: 'Likes evenly moist soil and higher humidity than its big cousin.' }),
  s({ id: 'epipremnum-aureum', commonName: 'Pothos', scientificName: 'Epipremnum aureum', aliases: ["Devil's ivy", 'Golden pothos', 'Money plant'], light: 'low', waterEveryDays: 7, humidity: 'medium', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Epipremnum aureum', tip: 'Water when the top half of the soil is dry; drooping leaves mean it is thirsty.' }),
  s({ id: 'scindapsus-pictus', commonName: 'Satin pothos', scientificName: 'Scindapsus pictus', aliases: ['Silver pothos', 'Silver philodendron'], light: 'medium', waterEveryDays: 9, humidity: 'medium', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Scindapsus pictus', tip: 'Leaves curl when it needs water — a handy built-in reminder.' }),
  s({ id: 'philodendron-hederaceum', commonName: 'Heartleaf philodendron', scientificName: 'Philodendron hederaceum', aliases: ['Sweetheart plant', 'Philodendron'], light: 'medium', waterEveryDays: 7, humidity: 'medium', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Philodendron hederaceum', tip: 'Water when the top 2–3 cm are dry; yellow leaves usually mean overwatering.' }),
  s({ id: 'thaumatophyllum-bipinnatifidum', commonName: 'Tree philodendron', scientificName: 'Thaumatophyllum bipinnatifidum', aliases: ['Philodendron selloum', 'Split-leaf philodendron', 'Hope philodendron'], light: 'bright-indirect', waterEveryDays: 7, humidity: 'medium', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Thaumatophyllum bipinnatifidum', tip: 'Needs room to spread; keep soil lightly moist in summer, drier in winter.' }),
  s({ id: 'dracaena-trifasciata', commonName: 'Snake plant', scientificName: 'Dracaena trifasciata', aliases: ['Sansevieria', "Mother-in-law's tongue", 'Sansevieria trifasciata'], light: 'low', waterEveryDays: 14, humidity: 'low', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Dracaena trifasciata', tip: 'Let the soil dry out completely; water even less in winter. Overwatering is the main killer.' }),
  s({ id: 'zamioculcas-zamiifolia', commonName: 'ZZ plant', scientificName: 'Zamioculcas zamiifolia', aliases: ['Zanzibar gem', 'Zamioculcas'], light: 'low', waterEveryDays: 14, humidity: 'low', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Zamioculcas', tip: 'Stores water in its rhizomes — water only when the soil is fully dry.' }),
  s({ id: 'chlorophytum-comosum', commonName: 'Spider plant', scientificName: 'Chlorophytum comosum', aliases: ['Airplane plant', 'Ribbon plant'], light: 'medium', waterEveryDays: 7, humidity: 'medium', petToxicity: 'non-toxic', difficulty: 'easy', wiki: 'Chlorophytum comosum', tip: 'Brown tips often come from fluoride in tap water; rainwater or filtered water helps.' }),
  s({ id: 'spathiphyllum', commonName: 'Peace lily', scientificName: 'Spathiphyllum', aliases: ['Spath'], light: 'low', waterEveryDays: 6, humidity: 'high', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Spathiphyllum', tip: 'Dramatically droops when thirsty and perks up within hours of watering.' }),
  s({ id: 'ficus-lyrata', commonName: 'Fiddle-leaf fig', scientificName: 'Ficus lyrata', aliases: ['Fiddle leaf'], light: 'bright-direct', waterEveryDays: 7, humidity: 'medium', petToxicity: 'toxic', difficulty: 'hard', wiki: 'Ficus lyrata', tip: 'Hates being moved and cold drafts; water when the top 5 cm are dry.' }),
  s({ id: 'ficus-elastica', commonName: 'Rubber plant', scientificName: 'Ficus elastica', aliases: ['Rubber tree', 'Rubber fig'], light: 'bright-indirect', waterEveryDays: 10, humidity: 'medium', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Ficus elastica', tip: 'Wipe the big leaves to keep them glossy; let the top half of the soil dry.' }),
  s({ id: 'ficus-benjamina', commonName: 'Weeping fig', scientificName: 'Ficus benjamina', aliases: ['Benjamin fig', 'Ficus tree'], light: 'bright-indirect', waterEveryDays: 7, humidity: 'medium', petToxicity: 'toxic', difficulty: 'medium', wiki: 'Ficus benjamina', tip: 'Drops leaves when moved or in drafts — pick a spot and leave it there.' }),
  s({ id: 'aloe-vera', commonName: 'Aloe vera', scientificName: 'Aloe vera', aliases: ['Aloe'], light: 'bright-direct', waterEveryDays: 14, humidity: 'low', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Aloe vera', tip: 'Water deeply, then let it dry out completely. Use a gritty cactus mix.' }),
  s({ id: 'goeppertia', commonName: 'Calathea', scientificName: 'Goeppertia spp.', aliases: ['Rattlesnake plant', 'Calathea orbifolia', 'Zebra plant', 'Peacock plant'], light: 'medium', waterEveryDays: 5, humidity: 'high', petToxicity: 'non-toxic', difficulty: 'hard', wiki: 'Goeppertia', tip: 'Keep soil evenly moist and humidity high; use soft or filtered water to avoid crispy edges.' }),
  s({ id: 'maranta-leuconeura', commonName: 'Prayer plant', scientificName: 'Maranta leuconeura', aliases: ['Maranta'], light: 'medium', waterEveryDays: 5, humidity: 'high', petToxicity: 'non-toxic', difficulty: 'medium', wiki: 'Maranta leuconeura', tip: 'Leaves fold up at night. Keep the soil slightly moist, never soggy.' }),
  s({ id: 'pilea-peperomioides', commonName: 'Chinese money plant', scientificName: 'Pilea peperomioides', aliases: ['Pilea', 'Pancake plant', 'UFO plant'], light: 'bright-indirect', waterEveryDays: 7, humidity: 'medium', petToxicity: 'non-toxic', difficulty: 'easy', wiki: 'Pilea peperomioides', tip: 'Rotate weekly so it grows straight; pups at the base are easy to share.' }),
  s({ id: 'peperomia', commonName: 'Peperomia', scientificName: 'Peperomia obtusifolia', aliases: ['Baby rubber plant', 'Radiator plant'], light: 'medium', waterEveryDays: 10, humidity: 'medium', petToxicity: 'non-toxic', difficulty: 'easy', wiki: 'Peperomia obtusifolia', tip: 'Semi-succulent leaves store water — let the soil dry out between waterings.' }),
  s({ id: 'hoya-carnosa', commonName: 'Hoya', scientificName: 'Hoya carnosa', aliases: ['Wax plant', 'Porcelain flower'], light: 'bright-indirect', waterEveryDays: 10, humidity: 'medium', petToxicity: 'non-toxic', difficulty: 'easy', wiki: 'Hoya carnosa', tip: "Let it dry out between waterings and don't cut old flower spurs — they rebloom." }),
  s({ id: 'aglaonema', commonName: 'Chinese evergreen', scientificName: 'Aglaonema', aliases: ['Aglaonema'], light: 'low', waterEveryDays: 8, humidity: 'medium', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Aglaonema', tip: 'Very tolerant of low light; keep away from cold windows in winter.' }),
  s({ id: 'dieffenbachia', commonName: 'Dumb cane', scientificName: 'Dieffenbachia', aliases: ['Dieffenbachia'], light: 'medium', waterEveryDays: 7, humidity: 'medium', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Dieffenbachia', tip: 'Sap irritates skin and mouth — wear gloves when pruning.' }),
  s({ id: 'dracaena-marginata', commonName: 'Dragon tree', scientificName: 'Dracaena marginata', aliases: ['Madagascar dragon tree', 'Dracaena'], light: 'medium', waterEveryDays: 10, humidity: 'low', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Dracaena marginata', tip: 'Sensitive to fluoride; let the top half of the soil dry out.' }),
  s({ id: 'dracaena-fragrans', commonName: 'Corn plant', scientificName: 'Dracaena fragrans', aliases: ['Mass cane', 'Dracaena'], light: 'medium', waterEveryDays: 10, humidity: 'medium', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Dracaena fragrans', tip: 'Water when the top few cm are dry; brown tips point to dry air or tap-water salts.' }),
  s({ id: 'dracaena-sanderiana', commonName: 'Lucky bamboo', scientificName: 'Dracaena sanderiana', aliases: ['Ribbon plant'], light: 'medium', waterEveryDays: 7, humidity: 'medium', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Dracaena sanderiana', tip: 'If grown in water, keep roots covered and change the water weekly.' }),
  s({ id: 'chamaedorea-elegans', commonName: 'Parlor palm', scientificName: 'Chamaedorea elegans', aliases: ['Neanthe bella palm'], light: 'low', waterEveryDays: 7, humidity: 'medium', petToxicity: 'non-toxic', difficulty: 'easy', wiki: 'Chamaedorea elegans', tip: 'One of the best palms for low light; keep the soil lightly moist.' }),
  s({ id: 'dypsis-lutescens', commonName: 'Areca palm', scientificName: 'Dypsis lutescens', aliases: ['Butterfly palm', 'Golden cane palm'], light: 'bright-indirect', waterEveryDays: 7, humidity: 'high', petToxicity: 'non-toxic', difficulty: 'medium', wiki: 'Dypsis lutescens', tip: 'Likes bright light and moist (not wet) soil; mist or group with plants for humidity.' }),
  s({ id: 'howea-forsteriana', commonName: 'Kentia palm', scientificName: 'Howea forsteriana', aliases: ['Thatch palm', 'Paradise palm'], light: 'medium', waterEveryDays: 10, humidity: 'medium', petToxicity: 'non-toxic', difficulty: 'easy', wiki: 'Howea forsteriana', tip: 'Slow-growing and forgiving; let the top of the soil dry between waterings.' }),
  s({ id: 'rhapis-excelsa', commonName: 'Lady palm', scientificName: 'Rhapis excelsa', aliases: ['Broadleaf lady palm'], light: 'medium', waterEveryDays: 7, humidity: 'medium', petToxicity: 'non-toxic', difficulty: 'easy', wiki: 'Rhapis excelsa', tip: 'Keep soil lightly moist; tolerates lower light well.' }),
  s({ id: 'beaucarnea-recurvata', commonName: 'Ponytail palm', scientificName: 'Beaucarnea recurvata', aliases: ['Elephant foot'], light: 'bright-direct', waterEveryDays: 18, humidity: 'low', petToxicity: 'non-toxic', difficulty: 'easy', wiki: 'Beaucarnea recurvata', tip: 'Not a real palm — its swollen trunk stores water, so let it dry out fully.' }),
  s({ id: 'cycas-revoluta', commonName: 'Sago palm', scientificName: 'Cycas revoluta', aliases: ['King sago'], light: 'bright-direct', waterEveryDays: 14, humidity: 'low', petToxicity: 'highly-toxic', difficulty: 'medium', wiki: 'Cycas revoluta', tip: 'Every part is poisonous, especially the seeds. Keep well away from pets and children.' }),
  s({ id: 'nephrolepis-exaltata', commonName: 'Boston fern', scientificName: 'Nephrolepis exaltata', aliases: ['Sword fern'], light: 'medium', waterEveryDays: 3, humidity: 'high', petToxicity: 'non-toxic', difficulty: 'medium', wiki: 'Nephrolepis exaltata', tip: 'Never let it dry out completely; a bright bathroom is ideal.' }),
  s({ id: 'asplenium-nidus', commonName: "Bird's nest fern", scientificName: 'Asplenium nidus', light: 'medium', waterEveryDays: 6, humidity: 'high', petToxicity: 'non-toxic', difficulty: 'easy', wiki: 'Asplenium nidus', tip: 'Water around the soil, not into the central rosette, to avoid rot.' }),
  s({ id: 'adiantum', commonName: 'Maidenhair fern', scientificName: 'Adiantum', aliases: ['Adiantum raddianum'], light: 'medium', waterEveryDays: 3, humidity: 'high', petToxicity: 'non-toxic', difficulty: 'hard', wiki: 'Adiantum', tip: 'Fronds crisp up fast if the soil dries even once — keep it consistently moist.' }),
  s({ id: 'asparagus-setaceus', commonName: 'Asparagus fern', scientificName: 'Asparagus setaceus', aliases: ['Lace fern', 'Plumosa fern'], light: 'bright-indirect', waterEveryDays: 5, humidity: 'medium', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Asparagus setaceus', tip: 'Not a true fern; its berries are toxic to pets.' }),
  s({ id: 'tradescantia-zebrina', commonName: 'Inch plant', scientificName: 'Tradescantia zebrina', aliases: ['Wandering dude', 'Tradescantia'], light: 'bright-indirect', waterEveryDays: 6, humidity: 'medium', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Tradescantia zebrina', tip: 'Pinch back leggy stems — cuttings root in water in days. Sap can irritate pets.' }),
  s({ id: 'schefflera-arboricola', commonName: 'Umbrella plant', scientificName: 'Schefflera arboricola', aliases: ['Dwarf umbrella tree', 'Schefflera'], light: 'bright-indirect', waterEveryDays: 8, humidity: 'medium', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Schefflera arboricola', tip: 'Water when the top half of the soil is dry; prune to keep it bushy.' }),
  s({ id: 'crassula-ovata', commonName: 'Jade plant', scientificName: 'Crassula ovata', aliases: ['Money tree', 'Lucky plant'], light: 'bright-direct', waterEveryDays: 14, humidity: 'low', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Crassula ovata', tip: 'Soak and dry: water thoroughly, then wait until the soil is completely dry.' }),
  s({ id: 'echeveria', commonName: 'Echeveria', scientificName: 'Echeveria', aliases: ['Hens and chicks', 'Succulent'], light: 'bright-direct', waterEveryDays: 14, humidity: 'low', petToxicity: 'non-toxic', difficulty: 'easy', wiki: 'Echeveria', tip: 'Needs lots of light or it stretches; water the soil, not the rosette.' }),
  s({ id: 'haworthia', commonName: 'Haworthia', scientificName: 'Haworthia', aliases: ['Zebra succulent', 'Haworthiopsis'], light: 'bright-indirect', waterEveryDays: 14, humidity: 'low', petToxicity: 'non-toxic', difficulty: 'easy', wiki: 'Haworthia', tip: 'Handles less light than most succulents; water only when fully dry.' }),
  s({ id: 'portulacaria-afra', commonName: 'Elephant bush', scientificName: 'Portulacaria afra', aliases: ['Dwarf jade', 'Spekboom'], light: 'bright-direct', waterEveryDays: 14, humidity: 'low', petToxicity: 'non-toxic', difficulty: 'easy', wiki: 'Portulacaria afra', tip: 'Pet-safe lookalike of jade; loves sun and dry soil.' }),
  s({ id: 'sedum-morganianum', commonName: "Burro's tail", scientificName: 'Sedum morganianum', aliases: ["Donkey's tail"], light: 'bright-direct', waterEveryDays: 14, humidity: 'low', petToxicity: 'non-toxic', difficulty: 'medium', wiki: 'Sedum morganianum', tip: 'Leaves drop at the slightest touch — hang it somewhere out of the way.' }),
  s({ id: 'curio-rowleyanus', commonName: 'String of pearls', scientificName: 'Curio rowleyanus', aliases: ['Senecio rowleyanus'], light: 'bright-indirect', waterEveryDays: 14, humidity: 'low', petToxicity: 'toxic', difficulty: 'medium', wiki: 'Curio rowleyanus', tip: 'Water when the pearls start to wrinkle slightly; shallow pots prevent rot.' }),
  s({ id: 'ceropegia-woodii', commonName: 'String of hearts', scientificName: 'Ceropegia woodii', aliases: ['Rosary vine', 'Chain of hearts'], light: 'bright-indirect', waterEveryDays: 14, humidity: 'low', petToxicity: 'non-toxic', difficulty: 'easy', wiki: 'Ceropegia woodii', tip: 'Let the soil dry out; thin vines and pale leaves mean it wants more light.' }),
  s({ id: 'kalanchoe-blossfeldiana', commonName: 'Kalanchoe', scientificName: 'Kalanchoe blossfeldiana', aliases: ['Flaming Katy', 'Florist kalanchoe'], light: 'bright-direct', waterEveryDays: 12, humidity: 'low', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Kalanchoe blossfeldiana', tip: 'Treat as a succulent; needs long nights in autumn to rebloom.' }),
  s({ id: 'euphorbia-milii', commonName: 'Crown of thorns', scientificName: 'Euphorbia milii', aliases: ['Christ plant'], light: 'bright-direct', waterEveryDays: 14, humidity: 'low', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Euphorbia milii', tip: 'Milky sap is irritating; loves sun and dry soil.' }),
  s({ id: 'schlumbergera', commonName: 'Christmas cactus', scientificName: 'Schlumbergera', aliases: ['Thanksgiving cactus', 'Holiday cactus'], light: 'bright-indirect', waterEveryDays: 8, humidity: 'medium', petToxicity: 'non-toxic', difficulty: 'easy', wiki: 'Schlumbergera', tip: 'A forest cactus — likes more water than desert cacti; cool nights trigger buds.' }),
  s({ id: 'aspidistra-elatior', commonName: 'Cast iron plant', scientificName: 'Aspidistra elatior', aliases: ['Bar-room plant', 'Aspidistra'], light: 'low', waterEveryDays: 12, humidity: 'low', petToxicity: 'non-toxic', difficulty: 'easy', wiki: 'Aspidistra elatior', tip: 'Nearly indestructible; tolerates dark corners and neglect.' }),
  s({ id: 'phalaenopsis', commonName: 'Moth orchid', scientificName: 'Phalaenopsis', aliases: ['Orchid', 'Phalaenopsis orchid'], light: 'bright-indirect', waterEveryDays: 8, humidity: 'medium', petToxicity: 'non-toxic', difficulty: 'medium', wiki: 'Phalaenopsis', tip: 'Soak the bark for 10 minutes when roots turn silvery, then drain fully.' }),
  s({ id: 'saintpaulia', commonName: 'African violet', scientificName: 'Saintpaulia', aliases: ['Streptocarpus ionanthus'], light: 'bright-indirect', waterEveryDays: 6, humidity: 'medium', petToxicity: 'non-toxic', difficulty: 'medium', wiki: 'Saintpaulia', tip: 'Water from below with room-temperature water; cold water spots the leaves.' }),
  s({ id: 'anthurium-andraeanum', commonName: 'Anthurium', scientificName: 'Anthurium andraeanum', aliases: ['Flamingo flower', 'Laceleaf'], light: 'bright-indirect', waterEveryDays: 7, humidity: 'high', petToxicity: 'toxic', difficulty: 'medium', wiki: 'Anthurium andraeanum', tip: 'Water when the top third is dry; bright light keeps it flowering.' }),
  s({ id: 'begonia-maculata', commonName: 'Polka dot begonia', scientificName: 'Begonia maculata', aliases: ['Begonia', 'Angel wing begonia'], light: 'bright-indirect', waterEveryDays: 6, humidity: 'high', petToxicity: 'toxic', difficulty: 'medium', wiki: 'Begonia maculata', tip: 'Keep soil slightly moist and avoid wetting the leaves (they get powdery mildew).' }),
  s({ id: 'alocasia', commonName: 'Alocasia', scientificName: 'Alocasia × amazonica', aliases: ['Elephant ear', 'African mask', 'Alocasia polly'], light: 'bright-indirect', waterEveryDays: 6, humidity: 'high', petToxicity: 'toxic', difficulty: 'hard', wiki: 'Alocasia', tip: 'May go dormant in winter and drop leaves — cut watering back and it will return.' }),
  s({ id: 'syngonium-podophyllum', commonName: 'Arrowhead plant', scientificName: 'Syngonium podophyllum', aliases: ['Syngonium', 'Arrowhead vine'], light: 'medium', waterEveryDays: 7, humidity: 'medium', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Syngonium podophyllum', tip: 'Keep lightly moist; it climbs or trails as it matures.' }),
  s({ id: 'fittonia', commonName: 'Nerve plant', scientificName: 'Fittonia albivenis', aliases: ['Fittonia', 'Mosaic plant'], light: 'medium', waterEveryDays: 4, humidity: 'high', petToxicity: 'non-toxic', difficulty: 'medium', wiki: 'Fittonia', tip: 'Faints dramatically when dry and recovers fast; great in terrariums.' }),
  s({ id: 'hypoestes-phyllostachya', commonName: 'Polka dot plant', scientificName: 'Hypoestes phyllostachya', aliases: ['Freckle face'], light: 'bright-indirect', waterEveryDays: 4, humidity: 'high', petToxicity: 'non-toxic', difficulty: 'medium', wiki: 'Hypoestes phyllostachya', tip: 'Pinch tips to keep it bushy; colours fade in low light.' }),
  s({ id: 'hedera-helix', commonName: 'English ivy', scientificName: 'Hedera helix', aliases: ['Ivy', 'Common ivy'], light: 'medium', waterEveryDays: 6, humidity: 'medium', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Hedera helix', tip: 'Prefers cooler rooms; spider mites love it in dry air.' }),
  s({ id: 'yucca-gigantea', commonName: 'Spineless yucca', scientificName: 'Yucca gigantea', aliases: ['Yucca elephantipes', 'Yucca'], light: 'bright-direct', waterEveryDays: 14, humidity: 'low', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Yucca gigantea', tip: 'Drought tolerant; give it your sunniest spot and let the soil dry out.' }),
  s({ id: 'strelitzia-reginae', commonName: 'Bird of paradise', scientificName: 'Strelitzia reginae', aliases: ['Strelitzia', 'Crane flower'], light: 'bright-direct', waterEveryDays: 7, humidity: 'medium', petToxicity: 'toxic', difficulty: 'medium', wiki: 'Strelitzia reginae', tip: 'Split leaves are natural. Needs lots of light to thrive indoors.' }),
  s({ id: 'oxalis-triangularis', commonName: 'Purple shamrock', scientificName: 'Oxalis triangularis', aliases: ['False shamrock', 'Oxalis'], light: 'bright-indirect', waterEveryDays: 6, humidity: 'medium', petToxicity: 'toxic', difficulty: 'easy', wiki: 'Oxalis triangularis', tip: 'Goes dormant sometimes — stop watering for a few weeks and it regrows.' }),
  s({ id: 'pachira-aquatica', commonName: 'Money tree', scientificName: 'Pachira aquatica', aliases: ['Malabar chestnut', 'Guiana chestnut'], light: 'bright-indirect', waterEveryDays: 10, humidity: 'medium', petToxicity: 'non-toxic', difficulty: 'easy', wiki: 'Pachira aquatica', tip: 'Water when the top half of the soil is dry; the braided trunk hates soggy soil.' }),
  s({ id: 'tillandsia', commonName: 'Air plant', scientificName: 'Tillandsia', aliases: ['Tillandsia'], light: 'bright-indirect', waterEveryDays: 7, humidity: 'medium', petToxicity: 'non-toxic', difficulty: 'easy', wiki: 'Tillandsia', tip: '"Watering" = soak 20–30 min, then shake off and dry upside-down within 4 hours.' }),
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
]

export const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/** Display name of a plant's species, from the catalog or free text. */
export function speciesLabel(plant: Pick<Plant, 'speciesId' | 'speciesName'>): string | undefined {
  return getSpecies(plant.speciesId)?.commonName ?? plant.speciesName
}

export function getSpecies(id: string | undefined): Species | undefined {
  return id ? CATALOG.find((x) => x.id === id) : undefined
}

/**
 * Finds a species by scientific name (case-insensitive), then by alias. Falls back
 * to the genus (first word) for genus-level entries such as `Spathiphyllum`.
 */
export function findByScientificName(name: string): Species | undefined {
  const q = norm(name)
  if (!q) return undefined
  const exact = CATALOG.find((x) => norm(x.scientificName) === q)
  if (exact) return exact
  const byAlias = CATALOG.find((x) => (x.aliases ?? []).some((a) => norm(a) === q))
  if (byAlias) return byAlias
  const genus = q.split(/\s+/)[0]
  return CATALOG.find((x) => !/\s/.test(norm(x.scientificName)) && norm(x.scientificName) === genus)
}

/** Ranked search over common names, scientific names and aliases. */
export function searchCatalog(query: string, limit = 8): Species[] {
  const q = norm(query)
  if (!q) return []
  const scored: { sp: Species; score: number }[] = []
  for (const sp of CATALOG) {
    const names = [sp.commonName, sp.scientificName, ...(sp.aliases ?? [])].map(norm)
    let score = 0
    for (const n of names) {
      if (n === q) score = Math.max(score, 3)
      else if (n.startsWith(q) || n.split(/\s+/).some((w) => w.startsWith(q))) score = Math.max(score, 2)
      else if (n.includes(q)) score = Math.max(score, 1)
    }
    if (score) scored.push({ sp, score })
  }
  return scored
    .sort((a, b) => b.score - a.score || a.sp.commonName.localeCompare(b.sp.commonName))
    .slice(0, limit)
    .map((x) => x.sp)
}
