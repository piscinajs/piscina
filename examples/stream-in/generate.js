'use strict';

const { createWriteStream } = require('fs');

const out = createWriteStream('./data.csv');

const count = parseInt(process.argv[2] || '5000') || 5000;

out.write('a,b,c,d,e,f,g\n');

for (let n = 0; n < count; n++) {
  out.write('1,2,3,4,5,6,7\n');
}

out.end();
console.log('done');
