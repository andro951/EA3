/** Deterministic acceptance routes. They are test inputs, not hidden player automation. */
const choice=choiceId=>({kind:'choice',choiceId});
const travel=location=>({kind:'travel',location});
const offer=offerId=>({kind:'offer',offerId});
const route=(storyId,ending,choices)=>({storyId,ending,actions:choices.map(choice)});
export const playthroughs=[
 route('the-ember-road','beacon',['map','fen','prepare','together','restore']),
 route('the-ember-road','hearth-ending',['settle','stay']),
 route('the-ember-road','tomorrow-ending',['market','defer']),
 route('the-ember-road','survey-ending',['map','road','inspect']),
 route('low-tide','breakfast',['tea','letter','encourage','stay']),
 route('low-tide','return',['work','clips','return']),
 route('low-tide','distance',['quiet','alone']),
 route('borrowed-skies','commons',['survey','cross','study','circuit']),
 route('borrowed-skies','anchored',['archive','tow','dock']),
 route('borrowed-skies','carriers',['archive','copies','leave']),
 route('ninth-bell','record',['ledger','hear','climb','compare','ask']),
 route('ninth-bell','quiet',['witness','check-ledger','mechanism','compare','private']),
 route('table-seven','music',['help','copy','ordinary','dessert','song']),
 route('table-seven','crew',['rafa','envelope','disaster','cake','work']),
 route('table-seven','walk',['sit','quiet','dessert','walk']),
 route('copper-clover','small',['plan','review','small']),
 {storyId:'copper-clover',ending:'nursery',actions:[choice('plan'),travel('market'),offer('seeds'),travel('greenhouse'),offer('grow'),travel('market'),offer('sell'),offer('potting'),travel('workshop'),offer('roof'),choice('review'),choice('nursery')]},
 {storyId:'copper-clover',ending:'cooperative',actions:[choice('plan'),travel('market'),offer('seeds'),travel('greenhouse'),offer('grow'),travel('market'),offer('sell'),travel('workshop'),offer('jun'),offer('display'),choice('review'),choice('cooperative')]},
 route('last-lantern','small-lights',['inspect','find-route','chain']),
 route('last-lantern','beam',['listen','observe','lens','low-beam'])
];
