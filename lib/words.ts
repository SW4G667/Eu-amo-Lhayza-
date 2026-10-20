/**
 * Dicionário embutido de palavras curtas (pt-BR + inglês).
 * Usado no modo "dicionário" e na pontuação de qualidade dos nomes.
 */
const WORDS = `
sol mar ceu rio luz paz voz ovo ouro arco alvo amor anjo arte ato ave azul
bem boa bolo bom bonde brilho caos cais calma calor cama cano caos cara
caro casa cava cera chave chuva cio cor coral cume cupido dado dano dia
dom dono dor dos eco ela eles era erro essa este eu faca faro fada fama
fase fe fé fio fim fim flor fogo foz frio fruta fumo gato gelo gema gente
giro giz gol gosto grao graca grilo heroi hoje hora humor igual ilha indio
iris jogo jovem jugo lado lago lapis lar leal lei lens leo leste lido lima
lime lira liso lixo lobo lua luar lume luta luz maca magia mago mal mapa
marco mas mato mau medo mel mesa meu miau mim mimo mina mito moca moeda
mola muito muro nao nuvem oceano oeste olhar olho ombro onda onix opcao
otimo ou ouro ouvir ovo pao par paz peca pele pena pera peso pico pilha
pino piso pluma pneu po poeira polo pombo pono portal pote praia preto
prima prisma proa puro quadra quem raio ramo rapaz raro raso real regra rei
remo rico rio riso ritmo robo roca roda rosa roxo rubro rua rubi ruge sabio
sabor saga sal salto sapo sede selo sempre ser serra sinal sobre sol sono
sorte suave sul sumo tao tapete teia tema tempo tenra terra tese tigre tio
tipo toco todo topo torre trem tres trono tudo tulipa turma um undo uniao
uva vaca vaga vale vapor veia veloz venda vento ver vez vida vidro vila
vim vinho vir voz vulto zebra zero zumbi zona

ace air arc ash ash awe axe bay bee bet bit boa bog bold bolt bone book
born boss bow box boy brag brew brim brow bug bulb burn bush buzz byte
cake calm card care cash cast cave cell chat chip city clap clay clip
cloud club coal coat code coin cold cool cope core corn cove cozy crew
crow cube cute dare dark dawn deal dean deck deep deer demo dew dice
dirt dive dock dome door dove down draw drop drum dual duck duel dune
dusk dust duty each earl ease east easy echo edge elan epic even ever
exit face fact fade fair fall fame fang farm fast fate fear feel fern
few fig file film find fine fire firm fish fist five flag flat flaw
flew flex flow flux foam foil fold folk font food fork form fort four
free frog fuel full fund fuse gain game gate gave gear gem gift gild
glad gleam glide glow goal goat gold golf gone good goth grab gray
grid grim grip grow gulf guru gust halo hand hard harp hash hawk haze
heat herd hero high hill hint hive hold holy home hood hook hope horn
host hour huge hunt hush ice icon idea idle inch into iron isle item
jade jazz join joke jolt joy july jump june june keen keep kelp kept
key kind king kite knee knot know lace lady lake lame lamp land lane
lark last late lava lawn lead leaf lean leap left lend lens less levy
life lift like lily lime line link lion list live load loan lock loft
logo long look loom loop lord lose loss lost loud love luck lull luma
luna lure lush lute made mail main make male mall mark mask mass mast
mate math maze mead mean meat meet melt memo mesh mile milk mill mind
mine mint miss mist mode mold mole monk mood moon moss most moth move
much myth nail name nave near neat neck need neon nest news next nice
night nine node none noon norm north nose note nova numb oath obey
odds okay olive omega once one only onyx open opal orbit order ore
oval oven over pace pack page paid pail pain pair pale palm park part
pass past path peak pear peat pebble pedro peer pelt perk petal phase
piano pick pier pine pink pipe plan play plot plum plus poem poet pole
poll pond pool poor pope port pose post pour prey prim prize probe
prompt proof proud pull pulse pump pure push quay queen quest quick
quiet quill quit race rack radar radio raft rage raid rail rain raise
rake ramp rank rare rash rate raven raw ray reach read real realm reed
reef reel reign rein rely rend rent rest rice rich ride rift ring
rise risk rite road roam roar robe rock rode role roll roof room root
rope rose rouge rough round route row royal ruby rug rule run rush
rust sage sail saint salt same sand save saw scale scan scar scene
scope seal seam seat seed self sell send sense sent serf set sewn
shade shaft shake shall shame shape share shark sharp shed shell shine
ship shirt shoe shop shore short shot show shrub shy side sign silk
sill silo silver sing sink site six size sketch ski skill skin sky
slab slam slate sleek sleep slide slim slip slot slow small smart
smile smoke snap snow soap soar sock soft soil solar sold sole solo
solve song soon sort soul sound soup sour south space span spare spark
speak spear speed spell spend spice spider spike spin spirit split
spoke spoon sport spot spray spread spring sprout spur squad square
stack staff stage stair stake stamp stand star stare stark start state
stay steam steel steep steer stem step stern stick still sting stock
stone stood stool stop store storm story stove strap straw stream
street stress stride strike string strip stroke strong stuck study
stuff style sugar suit summer sun super sure surf surge swap swear
sweep sweet swell swept swift swim swing swirl sword symbol system
table take tale talk tall tank tape task taste tea teach team tear
tech tell temple tend tent term test text thank theme then they thin
thing think third this thorn thought three threw throw thumb thunder
tide tidy tie tiger tight tile till tilt time tiny tip tire title
toast today toe together told toll tomb tone tool tooth top topic
torch total touch tough tour tower town toy trace track trade trail
train trait tram trap tray treat tree trek trend trial tribe trick
tried trim trio trip trout truck true trunk trust truth try tube
tuck tune tunnel turf turn tutor twelve twenty twice twin twist two
type ultra uncle under union unit unless until upon upper urban urge
usable use usual utter vague valid value valve vapor vast vault vein
velvet vendor venture verb verge verse very vessel vet via vibe vice
view vigor villa vine vinyl viola virtue vision visit vital vivid
vocal voice void volt vote vowel voyage wage wagon waist wait wake
walk wall want war ward warm warn warp wash wasp waste watch water
wave wax way weak wealth wear weather web wedge week weigh weird well
west wet whale what wheat wheel when where which while whip whisper
white who whole why wide widow width wife wild will win wind window
wine wing wink winner winter wire wise wish wit witch with wolf woman
wonder wood wool word wore work world worm worry worth would wound
wrap wrist write wrong yard yarn year yeast yellow yes yet yield
yoga yoke you young your youth zebra zero zinc zone zoom
`.split(/\s+/).filter(Boolean);

const WORD_SET = new Set(WORDS);

export function isDictionaryWord(name: string): boolean {
  return WORD_SET.has(name.toLowerCase());
}

export function allWords(): string[] {
  return WORDS;
}

const SYLLABLES = [
  "ka", "lo", "ri", "na", "ve", "mi", "so", "ta", "ze", "lu", "no", "ra",
  "di", "mo", "sa", "te", "vi", "ce", "bo", "fu", "ga", "he", "ja", "ki",
  "lu", "my", "ny", "or", "pa", "qu", "ry", "sh", "ti", "ur", "vy", "we",
  "xa", "ya", "zo", "bra", "cli", "dra", "fen", "gla", "kro", "lum", "nor",
  "pha", "syl", "tran", "vel", "zan", "cry", "flo", "nyx", "sol", "vex",
];

export function pronounceableName(length: number): string {
  let out = "";
  let guard = 0;
  while (out.length < length && guard < 40) {
    guard += 1;
    const chunk = SYLLABLES[Math.floor(Math.random() * SYLLABLES.length)];
    out += chunk;
  }
  return out.slice(0, length);
}
