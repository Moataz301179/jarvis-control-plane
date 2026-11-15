import { config } from '/srv/jarvis/current/lib/config.js';

const rows = [
  ['supplier', 'MTS | General Hotel Supplies', 'mtshotelsupply.com', 'http://www.mtshotelsupply.com', '63ca7f2a85408400cb39eac4'],
  ['supplier', 'MAMIBA', 'mamibacare.com', 'http://www.mamibacare.com', '5f485a350d0f590001a31143'],
  ['supplier', 'TM Fashion Factory & Hotel Supplies', 'tmuniform.com', 'http://www.tmuniform.com', '5fcb6b9e439c2e00016d5d74'],
  ['supplier', 'Eits Automation Control', 'eits-egypt.com', 'http://www.eits-egypt.com', '60497604b1640d00010a9272'],
  ['supplier', 'Exceed For Distribution & Hotel Supplies', 'exceeddhs.com', 'http://www.exceeddhs.com', '6715877cfd2cdc0001a23d1c'],
  ['supplier', 'Egyptian International For Trading & Supplies EITS', 'eits-group.com', 'http://www.eits-group.com', '60b1b79f75898e000106ffe2'],
  ['supplier', 'AlRabat Business Group', 'alrabat.net', 'http://www.alrabat.net', '56e132b6f3e5bb3f3d000775'],
  ['supplier', 'Qio', 'qioeg.com', 'http://www.qioeg.com', '63df522b494d080108590ebf'],
  ['supplier', 'ETTC - Egyptian Tabletop Trading Company', 'ettcegypt.com', 'http://www.ettcegypt.com', '61ec8972a89b4e0001f8e576'],
  ['hotel', 'Steigenberger ALDAU Beach Hotel', 'steigenbergeraldaubeach.com', 'http://www.steigenbergeraldaubeach.com', '54a241d174686935be92761a'],
  ['hotel', 'Steigenberger ALDAU Resort', 'steigenbergeraldauresort.com', 'http://www.steigenbergeraldauresort.com', '6731f2e78afdf9000167a1c1'],
  ['hotel', 'Mövenpick Resort Sharm el Sheikh', 'all.accor.com', 'http://all.accor.com/B4L5', '64179fc8656a0100013c1e9b'],
  ['hotel', 'Pickalbatros Hotels & Resorts', 'pickalbatros.com', 'http://www.pickalbatros.com', '5e5789bc9064ba0001921d59'],
  ['hotel', 'Sheraton Soma Bay Resort', 'sheratonsomabay.com', 'http://www.sheratonsomabay.com', '5da3ba2238b98f0001c17791'],
  ['hotel', 'SUNRISE Resorts & Cruises', 'sunrise-resorts.com', 'http://www.sunrise-resorts.com', '5a9e0775a6da98d97e79c989'],
  ['hotel', 'Savoy Sharm Group', 'savoy-sharm.com', 'http://www.savoy-sharm.com', '54a134c969702d3e83135400'],
  ['hotel', 'Steigenberger Aqua Magic', 'steigenbergeraquamagic.com', 'http://www.steigenbergeraquamagic.com', '66dde34039e8d000010a5c8e'],
  ['hotel', 'Jasmine Palace Resort And Spa', 'jasminepalaceresort.com', 'http://www.jasminepalaceresort.com', '61ec13a1d0523b0001264722'],
  ['hotel', 'Sunny Days Resort & SPA', 'sunnydaysegypt.com', 'http://www.sunnydaysegypt.com', '54a12afb69702db878101b02'],
];

const records = rows.map(([entity_type, name, domain, website_url, source_ref]) => ({
  project_code: 'HV',
  entity_type,
  name,
  domain,
  website_url,
  location: entity_type === 'supplier' ? 'Egypt' : 'Red Sea, Egypt',
  source: 'Apollo organization lookup',
  source_ref,
  evidence: {
    observed_at: '2026-11-13T03:16:00Z',
    query: entity_type === 'supplier'
      ? 'hotel supplies; hospitality supplies; food and beverage distribution'
      : 'hotel; resort; hospitality',
    verification: 'candidate from Apollo global organization index',
  },
}));

const response = await fetch('http://127.0.0.1:3100/v1/business/discoveries/import', {
  method: 'POST',
  headers: { authorization: `Bearer ${config.ownerToken}`, 'content-type': 'application/json' },
  body: JSON.stringify({ records }),
});
const body = await response.json();
if (!response.ok) throw new Error(JSON.stringify(body));
console.log(JSON.stringify(body));
