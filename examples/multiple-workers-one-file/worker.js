'use strict';

function add ({ a, b }) { return a + b; }
function multiply ({ a, b }) { return a * b; }

add.add = add;
add.multiply = multiply;

// The add function is the default handler, but
// additional named handlers are exported.
module.exports = add;
