/**
 * Tool for generating dash-gap patterns attempting
 * to match Illustrator's own algorithm
 *
 * usage:
 * var myDash = new Dasher([12,6]);
 *
 * @param {Array} pattern - an array [dash, gap, dash, gap, ...]
 */
function Dasher(pattern) {

    var self = this;

    // dashes smaller than this will be removed
    self.tolerance = 0.001;

    if (pattern.constructor.name != 'Array')
        return;

    // check for too-small dash lengths
    for (var i = 0; i < pattern.length; i++)
        if (pattern[i] < self.tolerance)
            throw Error('Dasher failed: dash length of pattern[' + i + '] is less than minimum (' + self.tolerance + ').');

    if (pattern.length % 2 == 1)
        // if odd number of dash lengths, double it
        pattern = pattern.concat(pattern);

    self.pattern = pattern;

    // total length of one repetition
    var sum = 0;
    var i = pattern.length;

    while (i--)
        sum += pattern[i];

    self.sum = sum;

};



/**
 * Returns array of basic (non-aligned)
 * dash|gap lengths. The last dash or gap
 * may be truncated.
 * @author m1b
 * @version 2022-05-23
 *
 * @param {Number} len - a length in points
 * @param {Boolean} [omitFinalLength] - whether to omit the final dash length (default: false).
 * @returns {Array} array of dash-gap lengths
 */
Dasher.prototype.basicPatternForLength = function (len, omitFinalLength) {

    if (
        len == undefined
        || len == 0
    )
        return;

    var self = this;
    var pattern = this.pattern;
    var advance = 0;
    var index = 0;
    var result = [];

    while (advance < len) {
        result.push(pattern[index]);
        advance += pattern[index];
        index = (index + 1) % pattern.length;
    }

    var remainder = len - advance;

    if (remainder > 0)
        result.push(remainder);
    else
        result[result.length - 1] += remainder;

    // remove zero amounts from end
    while (result[result.length - 1] < self.tolerance)
        result.pop();

    if (omitFinalLength)
        // the final length isn't needed for many purposes
        result.pop();

    return result;

};




/**
 * Returns array of dash|gap lengths.
 * Attempts to match Illustrator's own
 * dash layout rules for "Align dashes
 * to corners and path ends, adjusting
 * lengths to fit".
 *
 * @param {Number} len - a length in points
 * @param {Boolean} [dontSplitFirstDash] - whether to split first dash between last (default: false).
 * @param {Boolean} [omitFinalLength] - whether to omit the final dash length (default: false).
 * @returns {Array} array of dash-gap lengths
 */
Dasher.prototype.alignedPatternForLength = function (len, dontSplitFirstDash, omitFinalLength) {

    if (
        len == undefined
        || len == 0
    )
        return;

    var pattern = this.pattern;
    var patternSum = this.sum;
    var patternLength = pattern.length;
    // length of first dash
    var firstLength = dontSplitFirstDash === true ? 0 : pattern[0];
    // start and end are half the first dash
    // unless dontSplitStartDash is true
    var start = firstLength / 2;
    var end = start;
    var result = [];
    // the space between the start and end lengths
    var middleMaxWidth = len - start - end;
    // calculate the number of repetitions
    var r = len / patternSum;
    var rf = Math.floor(r);
    var rc = Math.ceil(r);
    var scaleUp = (len - firstLength) / ((patternSum * rf) - firstLength);
    var scaleDown = ((patternSum * rc) - firstLength) / (len - firstLength);
    var reps = scaleUp > scaleDown ? rc : rf;

    // can't have zero reps
    if (reps == 0)
        reps = 1;

    // calculate scale
    var middleWidth = patternSum * reps - firstLength;
    var scaleFactor = middleMaxWidth / middleWidth;

    // don't scale up more than 150%
    if (scaleFactor > 1.5) {
        reps = rc;
        middleWidth = patternSum * reps - firstLength;
        scaleFactor = middleMaxWidth / middleWidth;
    }

    if (middleMaxWidth <= 0) {
        // no room for anthing but a full dash
        result = [len];

    }

    else if (
        scaleFactor < 0.5
        && patternLength <= 2
    ) {
        // start and end dashes only with gap in middle
        result = [middleMaxWidth];

        if (!dontSplitFirstDash) {
            // add the start and end dash lengths
            result.unshift(start);
            result.push(end);
        }

    }

    else {

        // dash lengths are scaled to fit between start and end lengths
        result = Dasher.getScaledRepetitions(pattern, scaleFactor, reps, dontSplitFirstDash);

        if (!dontSplitFirstDash) {
            // add the start and end dash lengths
            result.unshift(start);
            result.push(end);
        }

    }

    if (omitFinalLength)
        // the final length isn't needed for many purposes
        result.pop();

    return result;

};



/**
 * Scale and repeat all values in the pattern.
 * @param {Array} pattern - array of dash-gap pattern.
 * @param {Number} scaleFactor - scale factor.
 * @param {Number} reps - number of repetitions.
 * @param {Boolean} dontSplitFirstDash - whether to split first dash between last.
 * @returns {Array} array of dash-gap lengths.
 */
Dasher.getScaledRepetitions = function (pattern, scaleFactor, reps, dontSplitFirstDash) {

    var scaledValues = [];
    var repeatScaledValues = [];

    // scale the values
    for (var i = 0; i < pattern.length; i++)
        scaledValues[i] = pattern[i] * scaleFactor;

    // add the repetitions
    for (var i = 0; i < reps; i++)
        repeatScaledValues = repeatScaledValues.concat(scaledValues);

    if (!dontSplitFirstDash)
        // remove first dash length when it's divided between start and end
        repeatScaledValues.shift();

    return repeatScaledValues;

};




/**
 * Returns representation of the Dasher instance.
 * @returns {String} representation of the pattern
 */
Dasher.prototype.toString = function () {
    return '[ ' + this.pattern.join('  ') + ' ]';
};
