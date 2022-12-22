/*

    Dasher
    for Adobe Illustrator

    A tool for generating dash|gap patterns that
    attempts to match Illustrator's own algorithm

    by m1b
    https://github.com/mark1bean/dasher-for-illustrator

*/


/**
 * Dasher
 *
 * Tool for generating dash-gap patterns attempting
 * to match Illustrator's own algorithm
 *
 * usage:
 * var dasher = new Dasher([12,6]);
 *
 * @param {Array} pattern - an array [dash, gap, dash, gap, ...]
 */
function Dasher(pattern) {
    if (pattern.constructor.name != 'Array') return;
    if (pattern.length == 1) pattern[1] = pattern[0];

    // if odd number of dash lengths, double it
    if (pattern.length % 2 == 1)
        pattern = pattern.concat(pattern);

    this.pattern = pattern;

    // total length of one repetition
    var sum = 0, i = pattern.length;
    while (i--) sum += pattern[i];
    this.sum = sum;
}



/**
 * Dasher.prototype.basicPatternForLength
 *
 * Returns array of basic (non-aligned)
 * dash|gap lengths.
 * The last dash or gap may be truncated.
 *
 * @param {Number} len - a length in points
 * @returns {Array} array of dash-gap lengths
 */
Dasher.prototype.basicPatternForLength = function (len) {

    if (len == undefined || len == 0) return;
    var pattern = this.pattern,
        advance = 0,
        index = 0,
        result = [];

    while (advance < len) {
        result.push(pattern[index]);
        advance += pattern[index];
        index = (index + 1) % pattern.length;
    }
    var remainder = len - advance;
    if (remainder > 0) {
        result.push(remainder)
    } else {
        result[result.length - 1] += remainder;
    };

    return result;
}




/**
 * Dasher.prototype.alignedPatternForLength
 *
 * Returns array of dash|gap lengths.
 * Attempts to match Illustrator's own
 * dash layout rules for "Align dashes
 * to corners and path ends, adjusting
 * lengths to fit"
 *
 * @param {Number} len - a length in points
 * @param {Boolean} dontSplitFirstDash - whether to split first dash between last
 * @returns {Array} array of dash-gap lengths
 */
Dasher.prototype.alignedPatternForLength = function (len, dontSplitFirstDash) {
    // returns array of dash|gap lengths
    // this method attempts to match
    // Illustrator's own dash layout rules
    // for "Align dashes to corners and path
    // ends, adjusting lengths to fit"

    if (len == undefined || len == 0) return;
    var pattern = this.pattern,
        patternSum = this.sum,
        patternLength = pattern.length,

        // length of first dash
        firstLength = dontSplitFirstDash ? 0 : pattern[0],

        // start and end are half the first dash
        // unless dontSplitStartDash is true
        start = firstLength / 2,
        end = start,
        result = [],

        // the space between the start and end lengths
        middleMaxWidth = len - start - end,

        // calculate the number of repetitions
        r = len / patternSum,
        rf = Math.floor(r),
        rc = Math.ceil(r),
        scaleUp = (len - firstLength) / ((patternSum * rf) - firstLength),
        scaleDown = ((patternSum * rc) - firstLength) / (len - firstLength),
        reps = scaleUp > scaleDown ? rc : rf;

    // can't have zero reps
    if (reps == 0) reps = 1;

    // calculate scale
    var middleWidth = patternSum * reps - firstLength,
        scaleFactor = middleMaxWidth / middleWidth;

    // don't scale up more than 150%
    if (scaleFactor > 1.5) {
        reps = rc;
        middleWidth = patternSum * reps - firstLength;
        scaleFactor = middleMaxWidth / middleWidth;
    }

    if (middleMaxWidth <= 0) {
        // no room for anthing but a full dash
        result = [len];

    } else if (scaleFactor < 0.5 && patternLength <= 2) {
        // start and end dashes only with gap in middle
        result = [middleMaxWidth];
        if (!dontSplitFirstDash) {
            // add the start and end dash lengths
            result.unshift(start);
            result.push(end);
        }

    } else {
        // dash lengths are scaled to fit between start and end lengths
        result = Dasher.getScaledRepetitions(pattern, scaleFactor, reps, dontSplitFirstDash);
        if (!dontSplitFirstDash) {
            // add the start and end dash lengths
            result.unshift(start);
            result.push(end);
        }
    }

    return result;
}



/**
 * Dasher.getScaledRepetitions
 *
 * Scale and repeat all values
 * in the pattern
 *
 * @param {Array} pattern - array of dash-gap pattern
 * @param {Number} scaleFactor - scale factor
 * @param {Number} reps - number of repetitions
 * @param {Boolean} dontSplitFirstDash - whether to split first dash between last
 * @returns {Array} array of dash-gap lengths
 */
Dasher.getScaledRepetitions = function (pattern, scaleFactor, reps, dontSplitFirstDash) {

    var scaledValues = [],
        repeatScaledValues = [];

    // scale the values
    for (var i = 0; i < pattern.length; i++)
        scaledValues[i] = pattern[i] * scaleFactor;

    // add the repetitions
    for (var i = 0; i < reps; i++)
        repeatScaledValues = repeatScaledValues.concat(scaledValues);

    if (!dontSplitFirstDash) {
        // remove first dash length when it's divided between start and end
        repeatScaledValues.shift();
    }

    return repeatScaledValues;
}



/**
 * Dasher.prototype.toString
 * @returns {String} representation of the pattern
 */
Dasher.prototype.toString = function () {
    return '[ ' + this.pattern.join('  ') + ' ]';
}
