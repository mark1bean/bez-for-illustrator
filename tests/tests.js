



/**
 * Throw error if condition is false.
 * @param {Bool} condition - the test.
 * @param {String} message - the message shown if test fails (default: '').
 */
function assert(condition, message) {
    if (!condition)
        throw Error('Assert failed: ' + (message || ''));
};
