// Internal symbol used to mark Transferable objects returned
// by the Piscina.move() function
export const kMovable = Symbol('Piscina.kMovable');
export const kWorkerData = Symbol('Piscina.kWorkerData');
export const kTransferable = Symbol.for('Piscina.transferable');
export const kValue = Symbol.for('Piscina.valueOf');
export const kQueueOptions = Symbol.for('Piscina.queueOptions');
export const kRequestCountField = 0;
export const kResponseCountField = 1;
export const kFieldCount = 2;
