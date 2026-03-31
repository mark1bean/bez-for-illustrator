/**
 * @file BezMath.js
 * Pure bezier mathematics — stateless functions that work on
 * raw coordinate arrays and BezPoint-like objects. No Illustrator
 * API calls, no dependency on the Bez class itself.
 *
 * Acknowledgements:
 * Bezier length/t-value code adapted from Hiroyuki Sato:
 * https://github.com/Shanfan/Illustrator-Scripts-Archive/blob/master/jsx/Divide%20(length).jsx
 * Extrema algorithm by Timo:
 * https://stackoverflow.com/questions/2587751
 * Python version by Nishio Hirokazu.
 *
 * @author m1b
 * @version 2026-03-30
 */

if ('undefined' === typeof _bezUtilsIncluded)
    $.evalFile(File($.fileName).parent + '/BezUtils.js');

var BezMath = {};


/**
 * Get description of segment between two points.
 * @param {BezPoint|PathPoint} p1
 * @param {BezPoint|PathPoint} p2
 * @returns {Array<Array<Number>>} - [anchor1, rightDir1, leftDir2, anchor2]
 */
BezMath.getQ = function getQ(p1, p2) {
    return [p1.anchor, p1.rightDirection, p2.leftDirection, p2.anchor];
};


/**
 * Returns k value (segment coefficients) for length calculations.
 * @param {Array<Array<Number>>} q - segment description, see BezMath.getQ().
 * @returns {Array<Number>} - the k values.
 */
BezMath.getK = function getK(q) {

    var m = [
        q[3][0] - q[0][0] + 3 * (q[1][0] - q[2][0]),
        q[0][0] - 2 * q[1][0] + q[2][0],
        q[1][0] - q[0][0]
    ];
    var n = [
        q[3][1] - q[0][1] + 3 * (q[1][1] - q[2][1]),
        q[0][1] - 2 * q[1][1] + q[2][1],
        q[1][1] - q[0][1]
    ];
    var k = [
        m[0] * m[0] + n[0] * n[0],
        4 * (m[0] * m[1] + n[0] * n[1]),
        2 * ((m[0] * m[2] + n[0] * n[2]) + 2 * (m[1] * m[1] + n[1] * n[1])),
        4 * (m[1] * m[2] + n[1] * n[2]),
        m[2] * m[2] + n[2] * n[2]
    ];

    return k;

};


/**
 * Returns the length of a bezier curve segment
 * from t=0 to the given t value.
 * Uses Simpson's rule numerical integration (128 steps).
 * @param {Array<Number>} k - segment coefficients, see BezMath.getK().
 * @param {Number} t - number in range 0..1.
 * @returns {Number} - length in points.
 */
BezMath.getLength = function getLength(k, t) {

    var h = t / 128;
    var hh = h * 2;
    var fc = function (t, k) {
        return Math.sqrt(t * (t * (t * (t * k[0] + k[1]) + k[2]) + k[3]) + k[4]) || 0
    };
    var total = (fc(0, k) - fc(t, k)) / 2;

    for (var i = h; i < t; i += hh)
        total += 2 * fc(i, k) + fc(i + h, k);

    return total * hh;

};


/**
 * Returns [x, y] coordinates of a point on segment q at t.
 * @param {Array<Array<Number>>} q - segment description, see BezMath.getQ().
 * @param {Number} t - number in range 0..1.
 * @returns {Array<Number>} - [x, y].
 */
BezMath.pointOnBezier = function pointOnBezier(q, t) {

    var u = 1 - t;

    return [
        u * u * u * q[0][0] + 3 * u * t * (u * q[1][0] + t * q[2][0]) + t * t * t * q[3][0],
        u * u * u * q[0][1] + 3 * u * t * (u * q[1][1] + t * q[2][1]) + t * t * t * q[3][1]
    ];

};


/**
 * Calculates the arc length of a bezier path segment.
 * @param {BezPoint|PathPoint} p1
 * @param {BezPoint|PathPoint} p2
 * @returns {Number} - segment length in points.
 */
BezMath.getSegmentLength = function getSegmentLength(p1, p2) {

    if (
        p1 == undefined
        || p2 == undefined
    )
        throw Error('BezMath.getSegmentLength failed: a point was undefined.');

    return BezMath.getLength(BezMath.getK(BezMath.getQ(p1, p2)), 1);

};


/**
 * Returns t values at which the bezier curve has extrema (local min/max).
 * Based on python code by Nishio Hirokazu, modified by m1b.
 * @param {BezPoint} p1 - first point of segment.
 * @param {BezPoint} p2 - second point of segment.
 * @returns {Array<Number>} - t values found, sorted.
 */
BezMath.getExtremaOfCurve = function getExtremaOfCurve(p1, p2) {

    var q = BezMath.getQ(p1, p2);
    var tValues = [];
    var x0 = q[0][0];
    var y0 = q[0][1];
    var x1 = q[1][0];
    var y1 = q[1][1];
    var x2 = q[2][0];
    var y2 = q[2][1];
    var x3 = q[3][0];
    var y3 = q[3][1];

    var a;
    var b;
    var c;
    var t;
    var t1;
    var t2;
    var b2ac;
    var sqrtb2ac;

    for (var i = 0; i < 2; ++i) {

        if (i == 0) {
            b = 6 * x0 - 12 * x1 + 6 * x2;
            a = -3 * x0 + 9 * x1 - 9 * x2 + 3 * x3;
            c = 3 * x1 - 3 * x0;
        }

        else {
            b = 6 * y0 - 12 * y1 + 6 * y2;
            a = -3 * y0 + 9 * y1 - 9 * y2 + 3 * y3;
            c = 3 * y1 - 3 * y0;
        }

        if (Math.abs(a) < 1e-12) {

            if (Math.abs(b) < 1e-12)
                continue;

            t = -c / b;

            if (0 < t && t < 1)
                tValues.push(t);

            continue;
        }

        b2ac = b * b - 4 * c * a;
        sqrtb2ac = Math.sqrt(b2ac);

        if (b2ac < 0)
            continue;

        t1 = (-b + sqrtb2ac) / (2 * a);

        if (0 < t1 && t1 < 1)
            tValues.push(t1);

        t2 = (-b - sqrtb2ac) / (2 * a);

        if (0 < t2 && t2 < 1)
            tValues.push(t2);
    }

    return tValues.sort();

};


/**
 * Returns tValues calculated for segment p1,p2, using a spacingFunction.
 * @author m1b
 * @version 2022-12-30
 * @param {Object} options
 * @param {BezPoint} options.p1 - first point of segment.
 * @param {BezPoint} options.p2 - second point of segment.
 * @param {Number} [options.distance] - the approximate distance between added points.
 * @param {Number} [options.numberOfPoints] - the number of points to add between existing points.
 * @param {Array<Number>} [options.values] - array of numbers in range 0..1 representing positions on segment.
 * @param {Array<Number>} [options.lengths] - array of numbers representing absolute lengths on segment.
 * @param {Function} [options.spacingFunction] - a function to calculate distance between added points.
 * @param {Function} [options.valueFunction] - a function to modify each value.
 * @param {Array<Number>} [options.bounds] - bounds for special use in spacing function.
 * @returns {Array<Number>} - the tValues.
 */
BezMath.getTValues = function getTValues(options) {

    options = options || {};

    var p1 = options.p1;
    var p2 = options.p2;
    var distance = options.distance;
    var numberOfPoints = options.numberOfPoints;
    var values = options.values;
    var lengths = options.lengths;
    var spacingFunction = options.spacingFunction;
    var valueFunction = options.valueFunction;
    var bounds = options.bounds;

    if (
        distance == undefined
        && numberOfPoints == undefined
        && values == undefined
        && lengths == undefined
    )
        throw Error('BezMath.getTValues failed: must supply "distance", "numberOfPoints" or "values" parameter.')

    if (distance === 0)
        distance = Infinity

    var tValues = [];
    var q = BezMath.getQ(p1, p2);
    var k = BezMath.getK(q);
    var segmentLength = BezMath.getLength(k, 1);

    if (lengths == undefined) {

        if (spacingFunction == undefined)
            if (distance != undefined)
                spacingFunction = equispaceByDistance;
            else if (numberOfPoints != undefined)
                spacingFunction = equispaceByNumberOfPoints;
            else if (values != undefined)
                spacingFunction = spaceByValues;

        lengths = spacingFunction(
            {
                p1: p1,
                p2: p2,
                q: q,
                k: k,
                segmentLength: segmentLength,
                distance: distance,
                numberOfPoints: numberOfPoints,
                values: values,
                bounds: bounds
            }
        );

    }

    if (
        lengths == undefined
        || lengths.length == 0
    )
        return;

    for (var i = 0; i < lengths.length; i++) {

        var t = BezMath.tForLength(q, lengths[i], k);

        if (valueFunction != undefined)
            t = valueFunction(t);

        tValues.push(t);

    }

    return tValues.sort();


    /**
     * Returns spacing that approximates "distance" in points.
     * @param {Object} options
     * @param {Number} options.segmentLength - the length of segment in points.
     * @param {Number} options.distance - the desired spacing.
     * @returns {Array<Number>}
     */
    function equispaceByDistance(options) {

        options = options || {};

        var segmentLength = options.segmentLength;
        var distance = options.distance;
        var numberOfPoints = Math.floor(segmentLength / distance);
        var adv = 0;
        var lengths = [];

        if (numberOfPoints === 0)
            return;

        for (var i = 0; i < numberOfPoints - 1; i++) {
            adv += segmentLength / numberOfPoints;
            lengths.push(adv);
        }

        return lengths;

    };

    /**
     * Returns spacing that fits "numberOfPoints" points in segment.
     * @param {Object} options
     * @param {Number} options.segmentLength - the length of segment in points.
     * @param {Number} options.numberOfPoints - the number of points to add.
     * @returns {Array<Number>}
     */
    function equispaceByNumberOfPoints(options) {

        options = options || {};

        var segmentLength = options.segmentLength;
        var numberOfPoints = options.numberOfPoints + 1;
        var adv = 0;
        var lengths = [];

        for (var i = 0; i < numberOfPoints - 1; i++) {
            adv += segmentLength / numberOfPoints;
            lengths.push(adv);
        }

        return lengths;

    };

    /**
     * Returns spacing lengths according to supplied `values`.
     * @param {Object} options
     * @param {Array<Number>} options.q - the segment's q values.
     * @param {Array<Number>} options.k - the segment's k values.
     * @param {Number} options.segmentLength - the length of segment in points.
     * @param {Array<Number>} options.values - proportionate positions in range 0..1.
     * @returns {Array<Number>}
     */
    function spaceByValues(options) {

        options = options || {};

        var segmentLength = options.segmentLength;
        var values = options.values;
        var lengths = [];

        for (var i = 0; i < values.length; i++)
            lengths.push(segmentLength * values[i]);

        return lengths;

    };

};


/**
 * Returns tValue for the given arc length along a segment.
 * tValue is always in range 0..1, where 0 is start and 1 is end.
 * Uses binary search with 30 iterations, tolerance 0.001.
 * @param {Array<Array<Number>>} q - segment description, see BezMath.getQ().
 * @param {Number} len - length along segment in points.
 * @param {Array<Number>} [k] - segment coefficients, see BezMath.getK().
 * @returns {Number}
 */
BezMath.tForLength = function tForLength(q, len, k) {

    k = k || BezMath.getK(q);

    var segmentLength = BezMath.getLength(k, 1);

    if (len == 0)
        return segmentLength;

    else if (len < 0) {

        len += segmentLength;

        if (len < 0)
            return 0;

    }

    else if (len > segmentLength)
        return 1;

    var t;
    var d;
    var t0 = 0;
    var t1 = 1;
    var tolerance = 0.001;

    for (var h = 1; h < 30; h++) {

        t = t0 + (t1 - t0) / 2;
        d = len - BezMath.getLength(k, t);

        if (Math.abs(d) < tolerance)
            break;

        else if (d < 0)
            t1 = t;

        else
            t0 = t;

    }

    return t;

};


/**
 * Returns the "angle" of a point in terms of the path flow.
 * Works by calculating a small value of t at the appropriate
 * place on the segment.
 * @param {BezPoint} p1 - the point to calculate angle of.
 * @param {BezPoint} p2 - the second point in segment p1,p2.
 * @param {Boolean} [convertToPositive] - whether to return positive values only, eg. -90° → 270° (default: false).
 * @param {Boolean} [reverseDirection] - whether to calculate angle from the other end of segment (default: false).
 * @returns {Number} - the angle in degrees.
 */
BezMath.getAngleOfPointP1 = function getAngleOfPointP1(p1, p2, convertToPositive, reverseDirection) {

    if (
        p1 == undefined
        || p2 == undefined
    )
        return;

    var t;
    var pT;
    var angle;

    if (reverseDirection === true) {
        t = 0.99;
        pT = BezMath.pointOnBezier(BezMath.getQ(p1, p2), t);
        angle = angleBetweenPoints(p2.anchor, pT);
    }

    else {
        t = 0.01;
        pT = BezMath.pointOnBezier(BezMath.getQ(p1, p2), t);
        angle = angleBetweenPoints(p1.anchor, pT);
    }

    if (convertToPositive === true)
        angle = (angle + 360) % 360;

    return round(angle, 5);

};
