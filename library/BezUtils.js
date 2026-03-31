/**
 * @file BezUtils.js
 * Shared enum types and utility functions used by Bez.js and Pol.js.
 * No dependency on Illustrator API. No dependency on other library files.
 * @author m1b
 * @version 2026-03-30
 */

// include guard sentinel
var _bezUtilsIncluded = true;


/* -------------------- *
 *  SHARED ENUM TYPES   *
 * -------------------- */

/**
 * The types of scaling.
 * @enum {String}
 */
var BezScaleType = {

    /** No scaling. */
    DO_NOT_SCALE: 'do_not_scale',

    /** Scale by the scale factor. */
    SCALE_BY_FACTOR: 'scale_by_factor',

    /** Scale so that min dimension matches bounding box's max dimension, centered. */
    FIT_BOX: 'fit_box',

    /** Scale to fill bounding box, centered. */
    FILL_BOX: 'fill_box',

    /** Fill the bounding box exactly, no matter what proportion difference. */
    STRETCH: 'stretch',

};


/**
 * The types of rotations.
 * @enum {String}
 */
var BezRotationType = {

    /** Normal relative rotation. */
    NORMAL: 'normal',

    /** Rotate relative to bez's rotational datum, if any. */
    FROM_DATUM: 'from_datum',

};


/**
 * The transform center types, ie. the fulcrum of the transform.
 * @enum {String}
 */
var BezTransformPositionType = {

    /** Transform around top left of bounding box. */
    TOP_LEFT: 'top_left',

    /** Transform around top right of bounding box. */
    TOP_RIGHT: 'top_right',

    /** Transform around bottom right of bounding box. */
    BOTTOM_RIGHT: 'bottom_right',

    /** Transform around bottom left of bounding box. */
    BOTTOM_LEFT: 'bottom_left',

    /** Transform around center of bounding box. */
    CENTER: 'center',

    /** Transform around top of bounding box. */
    TOP: 'top',

    /** Transform around right of bounding box. */
    RIGHT: 'right',

    /** Transform around bottom of bounding box. */
    BOTTOM: 'bottom',

    /** Transform around left of bounding box. */
    LEFT: 'left',

    /** Transform around a path point. */
    PATH_POINT: 'path_point',

    /** Transform around an arbitrary point. */
    POINT: 'point',

};


/**
 * The types of sorting.
 * @enum {String}
 */
var BezSortType = {

    /** Sort by x coordinate. */
    SORT_X: 'sort_x',

    /** Sort by y coordinate. */
    SORT_Y: 'sort_y'

};


/**
 * The types of hash comparison.
 * @enum {String}
 */
var BezHashComparisonType = {

    /** Compare the entire hash. */
    NORMAL: 'normal',

    /** Compare only angle values of hash. */
    ANGLES_ONLY: 'angles_only',

    /** Compare only length ratio values of hash. */
    LENGTHS_ONLY: 'lengths_only',

};


/* ---------------------- *
 *  GEOMETRY UTILITIES    *
 * ---------------------- */

/**
 * Returns coordinates for an intermediate
 * point at `t` between `p1` and `p2`.
 * @param {Array<Number>} p1 - a point [x, y].
 * @param {Array<Number>} p2 - a point [x, y].
 * @param {Number} t - number in range [0..1].
 * @returns {Array<Number>} - [x, y].
 */
function intermediatePoint(p1, p2, t) {
    return [
        (p2[0] - p1[0]) * t + p1[0],
        (p2[1] - p1[1]) * t + p1[1]
    ];
};


/**
 * Returns distance and the point on segment
 * measuring from the bez's anchor to the
 * line segment p1, p2.
 * @param {BezPoint|PathPoint|Array<Number>} fromPoint - the point to measure from [x, y].
 * @param {BezPoint|PathPoint|Array<Number>} p1 - start point of segment [x, y].
 * @param {BezPoint|PathPoint|Array<Number>} p2 - end point of segment [x, y].
 * @returns {Object} - { distance: point: t: }.
 */
function distanceFromSegment(fromPoint, p1, p2) {

    var p = fromPoint,
        s = p1,
        e = p2;

    if (p.hasOwnProperty('anchor'))
        p = p.anchor;

    if (s.hasOwnProperty('anchor'))
        s = s.anchor;

    if (e.hasOwnProperty('anchor'))
        e = e.anchor;

    var lenSquared = distSquared(s, e);

    if (lenSquared == 0)
        return distSquared(p, s);

    var t = ((p[0] - s[0]) * (e[0] - s[0]) + (p[1] - s[1]) * (e[1] - s[1])) / lenSquared;
    t = Math.max(0, Math.min(1, t));

    var pt = intermediatePoint(s, e, t);

    var d = Math.sqrt(distSquared(p, [s[0] + t * (e[0] - s[0]), s[1] + t * (e[1] - s[1])]));

    return {
        distance: d,
        point: pt,
        t: t,
    };

    function sqr(x) {
        return x * x;
    }

    function distSquared(s, e) {
        return sqr(s[0] - e[0]) + sqr(s[1] - e[1]);
    }

};


/**
 * Returns the square distance between two points.
 * @param {Array<Number>} p1 - a point array [x, y].
 * @param {Array<Number>} p2 - a point array [x, y].
 * @returns {Number} - distance squared in points.
 */
function squareDistanceBetweenPoints(p1, p2) {

    var a = p1[0] - p2[0],
        b = p1[1] - p2[1];

    return a * a + b * b;

};


/**
 * Returns distance between two points.
 * @param {Array<Number>} p1 - a point array [x, y].
 * @param {Array<Number>} p2 - a point array [x, y].
 * @returns {Number} - distance in points.
 */
function distanceBetweenPoints(p1, p2) {

    var a = p1[0] - p2[0],
        b = p1[1] - p2[1];

    return Math.sqrt(a * a + b * b);

};


/**
 * Returns true when points are equal.
 * Note: points are simple [x, y] arrays.
 * @param {Array<Number>} p1 - point [x, y].
 * @param {Array<Number>} p2 - point [x, y].
 * @returns {Boolean}
 */
function pointsAreEqual(p1, p2) {
    return p1[0] == p2[0] && p1[1] == p2[1];
};


/**
 * Returns x, y difference between two points.
 * @param {Array} p1 - a point array [x, y].
 * @param {Array} p2 - a point array [x, y].
 * @returns {Array} - [dx, dy].
 */
function differenceBetweenPoints(p1, p2) {
    return [-(p2[0] - p1[0]), -(p2[1] - p1[1])];
};


/**
 * Returns angle between two points and horizontal.
 * @param {Array} p1 - a point array [x, y].
 * @param {Array} p2 - a point array [x, y].
 * @param {Boolean} asRadians - whether the result should be in radians (default: false).
 * @returns {Number} - the angle.
 */
function angleBetweenPoints(p1, p2, asRadians) {

    var delta = differenceBetweenPoints(p1, p2),
        theta = Math.atan2(-delta[1], -delta[0]); // radians

    if (asRadians)
        return theta;

    return theta * (180 / Math.PI);

};


/**
 * Returns angle ABC in degrees.
 * @param {Array<Number>} a - point [x, y].
 * @param {Array<Number>} b - point [x, y].
 * @param {Array<Number>} c - point [x, y].
 * @returns {Number} - the angle in degrees.
 */
function getAngleABC(a, b, c) {

    var ab = [b[0] - a[0], b[1] - a[1]],
        cb = [b[0] - c[0], b[1] - c[1]],
        dot = (ab[0] * cb[0] + ab[1] * cb[1]),
        cross = (ab[0] * cb[1] - ab[1] * cb[0]),
        alpha = Math.atan2(cross, dot);

    return alpha * 180 / Math.PI;

};


/**
 * Returns a scaleFactor needed to perform a box fitting.
 * @param {BezScaleType} scaleType - the scale type.
 * @param {Array<Number>} bounds - the bounds of the object to scale.
 * @param {Array<Number>} box - the bounds of the target box.
 * @param {Number} [strokeWidth] - the item's strokeWidth (default: 0).
 * @returns {Array<Number>} - [sx, sy] scale factors.
 */
function getScaleFactorForBoxFitting(scaleType, bounds, box, strokeWidth) {

    var scaleType = scaleType || BezScaleType.FIT_BOX,
        scaleFactor = [1, 1],
        strokeWidth = strokeWidth || 0,
        boxWidth = box[2] - box[0],
        boxHeight = -(box[3] - box[1]),
        itemWidth = bounds[2] - bounds[0],
        itemHeight = -(bounds[3] - bounds[1]),
        boxCenter = [box[0] + boxWidth / 2, box[1] - boxHeight / 2],
        itemCenter = [bounds[0] + itemWidth / 2, bounds[1] - itemHeight / 2],
        boxRatio = boxWidth / boxHeight,
        itemRatio = itemWidth / itemHeight;

    if (BezScaleType.FIT_BOX === scaleType) {

        // scale to fit inside bounding box
        if (itemRatio < boxRatio)
            // landscape
            scaleFactor = (boxHeight - strokeWidth) / itemHeight;
        else
            // portrait
            scaleFactor = (boxWidth - strokeWidth) / itemWidth;

    }

    else if (BezScaleType.FILL_BOX === scaleType) {

        // scale to fill bounding box completely
        if (itemRatio < boxRatio)
            // landscape
            scaleFactor = (boxWidth - strokeWidth) / itemWidth;
        else
            // portrait
            scaleFactor = (boxHeight - strokeWidth) / itemHeight;

    }

    else if (BezScaleType.STRETCH === scaleType) {

        // scale to match bounding box (stretch to fit)
        scaleFactor = [(boxWidth - strokeWidth) / itemWidth, (boxHeight - strokeWidth) / itemHeight];

    }

    if ('Number' === scaleFactor.constructor.name)
        scaleFactor = [scaleFactor, scaleFactor];

    return scaleFactor;

};


/* --------------------- *
 *  GENERAL UTILITIES    *
 * --------------------- */

/**
 * Cycle value n between m values.
 * eg. toggle(0, 2) // 1
 *     toggle(1, 2) // 0
 * @param {Number} n - the value.
 * @param {Number} [m] - number of values (default: 2).
 */
function toggle(n, m) {
    m = m || 2;
    return (n + 1) % m;
};


/**
 * Rounds a single number or an array of numbers.
 * @param {Number|Array<Number>} nums - the number or numbers to round.
 * @param {Number} [places] - decimal places (default: 1).
 * @param {Boolean} [floor] - whether to floor the result (default: false).
 * @returns {Number|Array<Number>} the rounded number or numbers.
 */
function round(nums, places, floor) {

    places = Math.pow(10, places || 1);

    var result = [];

    if (nums.constructor.name != 'Array')
        nums = [nums];

    for (var i = 0; i < nums.length; i++)
        if (floor === true)
            result[i] = Math.floor(nums[i] * places) / places;
        else
            result[i] = Math.round(nums[i] * places) / places;

    return nums.length == 1 ? result[0] : result;

};


/**
 * Compares two arrays and returns a score between 0 and 1
 * based on how similar they are, where 1 means an exact match.
 * @author ChatGPT 2023-01-30 and @m1b
 * @version 2023-02-05
 * @param {Array<Number>} arr1 - an array to compare.
 * @param {Array<Number>} arr2 - an array to compare.
 * @param {Number} [start] - the index of the first element to compare (default: 0).
 * @param {Number} [inc] - the increment (default: 1).
 * @returns {Number} - the score.
 */
function compareArraysWithDifference(arr1, arr2, start, inc) {

    start = start || 0;
    inc = inc || 1;

    var score = 0,
        maxValue = -1,
        maxDiff = 0,
        len = Math.max(arr1.length, arr2.length);

    for (var i = start; i < len; i += inc) {

        var v1 = arr1[i] || 0,
            v2 = arr2[i] || 0;

        maxDiff = Math.max(maxDiff, Math.abs(v1 - v2));

        if (v1 > maxValue)
            maxValue = v1;

    }

    score = 1 - maxDiff / maxValue;

    var shift = 0;
    for (var i = start; i < len; i += inc) {

        var j = (i + shift) % len;

        if (arr1[i] !== arr2[j])
            shift++;

    }

    var scoreWithShift = 1 - shift / len;

    return Math.max(score, scoreWithShift);

};


/**
 * Returns total of array values.
 * @param {Array<Number>} arr - the array to sum.
 * @returns {Number}
 */
function sum(arr) {
    var s = 0, i = arr.length;
    while (i--) s += arr[i];
    return s;
};


/**
 * Returns the index of `obj` in `arr`,
 * or -1 if not found. ES3-safe alternative to Array.indexOf.
 * @param {any} obj - the object to locate.
 * @param {Array<any>} arr - the array to search.
 * @returns {Number} - the index of the found object.
 */
function indexOf(obj, arr) {
    for (var i = 0; i < arr.length; i++)
        if (arr[i] === obj)
            return i;
    return -1;
};


/**
 * Returns a deep copy of an array of arrays.
 * @param {Array<Array>} arrays - array of arrays.
 * @return {Array<Array>}
 */
function copyArrays(arrays) {

    var copy = [];

    for (var i = 0; i < arrays.length; i++)
        copy[i] = 'Array' === arrays[i].constructor.name
            ? copyArrays(arrays[i])
            : arrays[i];

    return copy;

};


/**
 * Concatenates all paths into a single array of points.
 * @version 2024-01-27
 * @param {Array<Array<Array<point>>>} paths - the paths to concatenate.
 * @returns {Array<point>}
 */
function concatPaths(paths) {

    var result = [];

    for (var i = 0; i < paths.length; i++) {
        if (
            'Array' === paths[i].constructor.name
            && 'Array' === paths[i][0].constructor.name
        ) {
            // a path
            result = result.concat(concatPaths(paths[i]));
        } else {
            // a point
            result.push(paths[i]);
        }
    }

    return result;

};
