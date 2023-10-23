"use strict";
var Heap = require('heap');

module.exports = (logSources, printer) => {
  return new Promise((resolve, reject) => {
    // Set to keep track of sources that have log entries.
    let logs = new Set();

    // Rough maximum size of the heap allowed to prevent memory constraints.
    const maxHeapSize = 10000000;

    //size of asynchronous calls when the heap is below the maximum size.
    const size = 50;

    // Initialize a min-heap.
    let heap = new Heap(function(a, b) {
      return a.date - b.date;
    });

    function getEntries(sourceId, logSource) {
      try {
        logSource.popAsync().then(function (entry) {
          if (entry) {
            // Add sourceId to the entry so it can be traced back to the source when popped from the heap.
            entry.sourceId = sourceId;
            heap.push(entry);
            logs.add(sourceId);
            // Once all sources have at least one entry in the heap, start the heap handling process.
            if (logs.size === logSources.length) {
              accessHeap();
            }
          }
        });
      } catch {
        console.log("getEntries function failed for source " + sourceId);
      }
    }

    /**
     * Function to access and handle entries in the heap.
     */
    function accessHeap() {
      // If all entries have been printed, return.
      if (heap.size() === 0 && logs.size === 0) {
        printer.done();
        console.log("Asynchronous sorting complete.");
        return;
      }

      // Pop the first entry from the heap (smallest date).
      const entry = heap.pop();
      if (!entry) {
        return;
      }

      const sourceId = entry.sourceId;

      printer.print(entry);

      // Chain calls to the popAsync wrapper to take advantage of asynchronous infrastructure and fill the heap.
      // The size can be adjusted for different processing speeds.
      // A heap size check is performed to ensure memory constraints are respected.
      if (heap.size() < maxHeapSize) {
        const sourceOffsets = [...Array(size).keys()];
        Promise.all(sourceOffsets.map(i => pullLogSource((sourceId + i) % logSources.length))).then(() => {});
      }

      // Fetch an entry from the same source as the last popped entry if possible and restart heap handling.
      // It's essential to fetch from the same source as the last popped one to maintain chronological order.
      pullLogSource(sourceId).then(() => {
        accessHeap();
      });
    }

    /**
     * Function to retrieve and process log entries from asynchronous sources.
    */
    function pullLogSource(sourceId) {
      // If there are no sources to pop from, stop processing.
      if (logs.size === 0) {
        return Promise.resolve();
      }

      // Try to pop an entry from the source asynchronously.
      return logSources[sourceId].popAsync().then(function (entry) {
        if (entry) {
          // Add the new entry to the heap.
          entry.sourceId = sourceId;
          heap.push(entry);
        } else {
          // Remove drained source from the set and attempt to find a new one.
          logs.delete(sourceId);
          if (logs.size === 0) {
            return Promise.resolve();
          }
          // Continue processing with the next available source.
          sourceId = logs.values().next().value;
          return pullLogSource(sourceId);
        }
      });
    }

    /**
     * Function to initiate retrieval of entries from all log sources in chronological order.
     */
    function getAllEntries() {
      for (const [sourceId, logSource] of logSources.entries()) {
        getEntries(sourceId, logSource);
      }
    }

    // Initiate the process of synchronizing and printing log entries from all sources.
    resolve(getAllEntries());
  });
};
