"use strict";
var Heap = require('heap');

module.exports = (logSources, printer) => {
  // Set to keep track of sources that have log entries.
  let logs = new Set();
  
  // Initialize min-heap.
  let heap = new Heap(function(a, b) {
    return a.date - b.date;
  });

  // Add the first entry of each source to the heap.
  var entry;
  for (let [sourceId, logSource] of logSources.entries()) {
    entry = logSource.pop();
    entry.sourceId = sourceId;
    heap.push(entry);
    logs.add(sourceId);
  }

  // Pop the first entry from the heap (smallest date) and retrieve the corresponding source entry.
  // If a source is not present, fetch an entry from one of the sources in the source set.
  while (entry = heap.pop()) {
    let sourceId = entry.sourceId;
    printer.print(entry);
    
    while (!(entry = logSources[sourceId].pop()) && logs.size) {
      // If the source is not present, remove it from the set to save searching time later.
      logs.delete(sourceId);
      
      // Get the next available source if there are more sources in the set.
      if (logs.size) {
        sourceId = logs.values().next().value;
      }
    }

    // Add the new entry to the heap.
    if (logs.size) {
      entry.sourceId = sourceId;
      heap.push(entry);
    }
  }

  //synchronization complete.
  printer.done();

  //message indicating synchronization is complete.
  return console.log("Synchronized sorting complete.");
};
