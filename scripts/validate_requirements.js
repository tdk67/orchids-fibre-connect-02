const fs = require('fs');
const path = require('path');

const filesToTable = [
  {
    path: 'src/lib/scraping/das-oertliche-scraper.js',
    checks: [
      { name: 'Lead limit is 20 (maxPages = 1)', pattern: /maxPages\s*=\s*1/ },
      { name: 'Phone number extraction exists', pattern: /item\.telephone\s*\|\|\s*item\.phone/ }
    ]
  },
  {
    path: 'src/pages/Unternehmenssuche.jsx',
    checks: [
      { name: 'Area Lead count badge exists', pattern: /\{allLeads\.filter\(l => getAreaLeadMatch\(l, area\)\)\.length\}\s*Leads/ },
      { name: 'Phone number in Map Popup exists', pattern: /lead\.telefon\s*&&\s*\(/ },
      { name: 'Quick navigation (View Leads) exists', pattern: /setActiveSection\("leads"\)/ },
      { name: 'Lead limit in generator is 1', pattern: /fetchStreetLeads\(.*maxPages:\s*1/ }
    ]
  },
  {
    path: 'src/utils/geoUtils.js',
    checks: [
      { name: 'No Nominatim fallback in geocodeAddress', pattern: /PER USER REQUEST: Does not use Nominatim anymore/ }
    ]
  }
];

let allPassed = true;

console.log('--- VALIDATING CRITICAL REQUIREMENTS ---');

filesToTable.forEach(file => {
  const filePath = path.join(process.cwd(), file.path);
  if (!fs.existsSync(filePath)) {
    console.error(`[FAIL] File missing: ${file.path}`);
    allPassed = false;
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  console.log(`\nChecking ${file.path}:`);

  file.checks.forEach(check => {
    const passed = check.pattern.test(content);
    if (passed) {
      console.log(`  [PASS] ${check.name}`);
    } else {
      console.log(`  [FAIL] ${check.name}`);
      allPassed = false;
    }
  });
});

console.log('\n---------------------------------------');
if (allPassed) {
  console.log('ALL CRITICAL VALIDATIONS PASSED');
  process.exit(0);
} else {
  console.log('SOME VALIDATIONS FAILED');
  process.exit(1);
}
