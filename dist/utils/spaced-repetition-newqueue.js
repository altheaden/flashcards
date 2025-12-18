"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptySRQueue = emptySRQueue;
exports.chooseNext = chooseNext;
exports.incorporateLast = incorporateLast;
exports.filterNewQueue = filterNewQueue;
exports.refillNewQueue = refillNewQueue;
function emptySRQueue(maxNewCards) {
    return {
        maxNewCards: maxNewCards,
        newQueue: []
    };
}
function chooseNext(q, allOpts) {
    var newOpts = allOpts.filter((k) => !q.newQueue.includes(k));
    if (q.newQueue.length > 0) {
        return q.newQueue[0];
    }
    else {
        return undefined;
    }
}
function incorporateLast(q, c, isStillNew) {
    if (c === undefined) {
        return q;
    }
    if (c === q.newQueue[0]) {
        q.newQueue.shift();
    }
    if (isStillNew) {
        q.newQueue.push(c);
    }
    return q;
}
function filterNewQueue(q, fxn) {
    q.newQueue = q.newQueue.filter(fxn);
    return q;
}
function refillNewQueue(q, allOpts, refillOnlyWhenEmpty = false) {
    var cardsNeeded = q.maxNewCards - q.newQueue.length;
    if (refillOnlyWhenEmpty && q.newQueue.length > 0) {
        cardsNeeded = 0;
    }
    if (cardsNeeded == 0) {
        return q;
    }
    var cardsAdding = Math.min(allOpts.length, cardsNeeded);
    var nextCards = allOpts.slice(0, cardsAdding);
    nextCards.forEach((s) => q.newQueue.push(s));
    return q;
}
