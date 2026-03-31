/**
 * @file PolAlgorithms.js
 * Advanced polygon algorithm methods attached to the Pol namespace.
 * Extends Pol with convex hull, overlap detection, polygon decomposition,
 * boundary point calculation, and line intersection utilities.
 *
 * Depends on Pol.js (and transitively BezUtils.js).
 *
 * @author m1b
 * @version 2026-03-31
 */

if ('undefined' === typeof Pol)
    $.evalFile(File($.fileName).parent + '/Pol.js');

if ('undefined' === typeof Mat)
    $.evalFile(File($.fileName).parent + '/Mat.js');

// include guard sentinel
var _polAlgorithmsIncluded = true;


/* ------------------- *
 *  CONVEX HULL        *
 * ------------------- */

/**
 * Returns the convex hull of a polygon.
 * @version 2023-11-05
 * @param {Number} [flatness] - the average length of lines when approximating curved segments (default: 2).
 * @param {Boolean} [forceUpdate] - whether to re-calculate the convex hull even if it already exists (default: false).
 * @returns {Array<point>} - the convex hull.
 */
Pol.prototype.getConvexHull = function getConvexHull(flatness, forceUpdate) {

    var self = this,
        convexHull = self.convexHull,
        poly = self.paths,
        hull = [];

    if (
        true !== forceUpdate
        && undefined != convexHull
    )
        // use stored value
        return self.convexHull;

    // we only want the outer path
    poly = poly[0];

    if (poly.length < 4) {
        // triangle is already convex
        self.convexHull = poly;
        return poly;
    }

    // Helper function to determine the orientation of three points (p, q, r)
    function orientation(p, q, r) {

        var val = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);

        if (val === 0)
            // collinear
            return 0;

        // clockwise or counterclockwise
        return val > 0 ? 1 : 2;
    };

    var n = poly.length;
    var hull = [];
    var l = 0;

    // Find the leftmost point
    for (var i = 1; i < n; i++)
        if (poly[i][0] < poly[l][0])
            l = i;

    var p = l;
    var q;
    do {
        hull.push(poly[p]);

        q = (p + 1) % n;
        for (var i = 0; i < n; i++) {
            // If i is more counterclockwise than current q, update q
            if (orientation(poly[p], poly[i], poly[q]) === 2)
                q = i;
        }

        // Set p as q for the next iteration
        p = q;

    } while (p !== l);

    return hull;

};


/* ----------------------- *
 *  OVERLAP DETECTION      *
 * ----------------------- */

/**
 * Returns true when the polygons overlap.
 * @version 2023-11-26
 * @param {polygon} poly1 - an array of [x, y] points.
 * @param {polygon} poly2 - an array of [x, y] points.
 * @returns {Boolean}
 */
Pol.doPolygonsOverlap = function doPolygonsOverlap(poly1, poly2) {

    // decompose into convex pieces
    var hulls1 = Pol.decomposePolygonIntoConvexPieces(poly1),
        hulls2 = Pol.decomposePolygonIntoConvexPieces(poly2);

    for (var i = 0; i < hulls1.length; i++)
        for (var j = 0; j < hulls2.length; j++)
            if (Pol.doPolygonsOverlapAsConvexHulls(hulls1[i], hulls2[j]))
                return true;

    return false;

};

/**
 * Returns true when the polygons'
 * convex hulls overlap.
 * @author ChatGPT 3.5 and m1b
 * @version 2023-11-26
 * @param {polygon} poly1 - an array of [x, y] points.
 * @param {polygon} poly2 - an array of [x, y] points.
 * @returns {Boolean}
 */
Pol.doPolygonsOverlapAsConvexHulls = function doPolygonsOverlapAsConvexHulls(poly1, poly2) {

    var axesToCheck = axes(poly1).concat(axes(poly2));

    for (var k = 0; k < axesToCheck.length; k++) {
        var axis = axesToCheck[k];
        if (!overlapOnAxis(poly1, poly2, axis))
            // separating axis found
            return false;
    }

    // no separating axis found, polygons overlap
    return true;

    /**
     * Returns array of vectors, where each vector is
     * a pair of coordinates representing a perpendicular
     * axis to one of the edges of the input polygon.
     * @param {Array<point>} poly - array of [x, y] points.
     * @returns {Array<point>}
     */
    function axes(poly) {

        var result = [];

        for (var i = 0; i < poly.length; i++) {
            var point = poly[i],
                nextPoint = poly[(i + 1) % poly.length],
                edge = [nextPoint[0] - point[0], nextPoint[1] - point[1]];
            result.push([-edge[1], edge[0]]);
        }

        return result;

    };

    /**
     * Returns minimum and maximum values.
     * @param {Array<Number>} values - the numbers to process.
     * @returns {min: max:}
     */
    function getMinMax(values) {

        var min = values[0],
            max = values[0];

        for (var i = 1; i < values.length; i++) {

            var value = values[i];

            if (value < min)
                min = value;

            else if (value > max)
                max = value;
        }

        return { min: min, max: max };

    };

    /**
     * Returns true if the polygons overlap on an axis.
     * @param {polygon} poly1 - a polygon to test.
     * @param {polygon} poly2 - a polygon to test.
     * @param {Array<Number>} axis - the axis vector.
     * @returns {Boolean}
     */
    function overlapOnAxis(poly1, poly2, axis) {

        var proj1 = [];
        var proj2 = [];

        for (var i = 0; i < poly1.length; i++)
            proj1[i] = poly1[i][0] * axis[0] + poly1[i][1] * axis[1];

        for (var j = 0; j < poly2.length; j++)
            proj2[j] = poly2[j][0] * axis[0] + poly2[j][1] * axis[1];

        var minMax1 = getMinMax(proj1);
        var minMax2 = getMinMax(proj2);

        return (
            minMax1.min <= minMax2.max && minMax1.max >= minMax2.min
        );

    }

};

/**
 * Decomposes a non-convex polygon into convex
 * sub-polygons using the ear clipping method.
 * @author ChatGPT and m1b
 * @version 2023-11-26
 * @param {Array<point>} poly - an array of points.
 * @returns {Array<Array<point>>} - array of convex polygons.
 */
Pol.decomposePolygonIntoConvexPieces = function decomposePolygonIntoConvexPieces(poly) {

    var result = [];

    while (poly.length >= 3) {

        var ear = findEar(poly);

        if (!ear)
            // The polygon is not simple or convex
            return null;

        result.push(ear);
        removeEar(poly, ear);

    }

    return result;

    function isEar(poly, ear) {

        var p1 = ear[0],
            p2 = ear[1],
            p3 = ear[2];

        for (var i = 0; i < poly.length; i++) {

            if (
                poly[i] !== p1
                && poly[i] !== p2
                && poly[i] !== p3
                && isPointInTriangle(poly[i], p1, p2, p3)
            )
                return false;

        }

        return true;

    };

    function isPointInTriangle(point, p1, p2, p3) {

        var area = 0.5 * (-p2[1] * p3[0] + p1[1] * (-p2[0] + p3[0]) + p1[0] * (p2[1] - p3[1]) + p2[0] * p3[1]),
            s = 1 / (2 * area) * (p1[1] * p3[0] - p1[0] * p3[1] + (p3[1] - p1[1]) * point[0] + (p1[0] - p3[0]) * point[1]),
            t = 1 / (2 * area) * (p1[0] * p2[1] - p1[1] * p2[0] + (p1[1] - p2[1]) * point[0] + (p2[0] - p1[0]) * point[1]);

        return s > 0 && t > 0 && 1 - s - t > 0;

    };

    function findEar(poly) {

        for (var i = 0; i < poly.length; i++) {

            var p1 = poly[i],
                p2 = poly[(i + 1) % poly.length],
                p3 = poly[(i + 2) % poly.length],
                ear = [p1, p2, p3];

            if (isEar(poly, ear))
                return ear;

        }

        return null;

    };

    function removeEar(poly, ear) {

        var index = indexOf(ear[1], poly);

        if (index !== -1)
            poly.splice(index, 1);

    };

};


/* ----------------------- *
 *  BOUNDARY POINTS        *
 * ----------------------- */

/**
 * Returns an array of points that hug one boundary of the pol.
 * Same as Pol.getBoundaryPoints, but caches the boundary points
 * in boundaries property indexed by the direction key,
 * eg. pol.boundaries['left'].
 * @param {Object} options - same parameters as Pol.getBoundaryPoints.
 * @param {Number} options.sampleSize - the size of the 'slices' in points, smaller means more accurate and slower.
 * @param {Array<Number>} options.bounds - the full bounds of the polygons [L, T, R, B].
 * @param {String} options.direction - the direction of the boundary (left|right|top|bottom).
 * @param {Boolean} options.force - whether to re-calculate boundary even if cached (default: false).
 * @returns {Array<point>}
 */
Pol.prototype.getBoundaryPoints = function getBoundaryPoints(options) {

    options = options || {};

    var self = this;

    self.boundaries = self.boundaries || {};

    if (
        undefined == self.boundaries[options.direction]
        || true === options.force
    )
        self.boundaries[options.direction] = Pol.getBoundaryPoints({
            paths: self.paths,
            pathsClosed: self.pathsClosed,
            sampleSize: options.sampleSize,
            direction: options.direction,
            bounds: options.bounds,
        });

    return self.boundaries[options.direction];

};

/**
 * Returns an array of [x,y] points which are derived
 * by calculating intersections of parallel lines that
 * with path segments closest to the `direction`.
 *
 * To visualize, pass the returned points to Pol.draw().
 *
 * Use it for butting two paths together:
 * For example, on the left path, calculate the 'right'
 * boundary points and on the right path calculate the
 * 'left' boundary points. In this case you must use
 * the same `sampleSize` and `bounds` for each (ie. the
 * bounds must encompass both polygons) so that each
 * boundary point is directly comparable. Then you can
 * calculate the shortest distance between pairs of
 * boundary points to know how far far you can move one
 * of the paths before it touches the other.
 * @author m1b
 * @version 2024-01-18
 * @param {String} options.direction - the direction of the boundary: 'left', 'right', 'top', or'bottom'.
 * @param {Array<Array<Number>>} options.paths - polygon as paths/points arrays.
 * @param {Number} options.sampleSize - the size of the 'slices' in points, lower number is more accurate and slower.
 * @param {Array<Number>} options.bounds - the full bounds of the polygons [L, T, R, B].
 * @param {Boolean} [options.pathsClosed] - whether the polygons are closed (default: true).
 * @returns {Array<Array<Number>>} - the boundary points
 */
Pol.getBoundaryPoints = function getBoundaryPoints(options) {

    options = options || {};

    var axis,
        bounds = options.bounds,
        pathsClosed = options.pathsClosed || false,
        sampleSize = options.sampleSize,

        // direction now is a sort function
        direction = allDirections(options.direction);

    if (undefined == sampleSize)
        throw Error('Pol.getBoundaryPoints: bad `sampleSize` supplied.');

    if (undefined == options.bounds)
        throw Error('Pol.getBoundaryPoints: bad `bounds` supplied.');

    // min and max are the axis-orthogonal bounds
    // minA and maxA are the axis-parallel bounds
    var min,
        max,
        minA,
        maxA;

    if (0 === axis) {
        // left or right direction
        // slices are vertical
        min = bounds[1];
        max = bounds[3];
        minA = bounds[0];
        maxA = bounds[2];
    }
    else {
        // top or bottom direction
        // slices are horizontal
        min = bounds[0];
        max = bounds[2];
        minA = bounds[1];
        maxA = bounds[3];
    }

    var sampleCount = Math.round(Math.abs(max - min) / options.sampleSize),
        boundaryPoints = Array(sampleCount),
        paths = options.paths;

    if (undefined == options.paths)
        throw Error('Pol.getBoundaryPoints: bad `paths` supplied.');

    if ('Array' !== paths[0][0].constructor.name)
        // always treat as if there are multiple paths
        paths = [paths];

    if ('Number' !== paths[0][0][0].constructor.name)
        throw Error('getBoundaryPoints: bad `paths` supplied.');

    var collisions = [];

    // calculate the sample slice steps
    var steps = [],
        // we put an extra sample step close to both extremes
        // to catch cases (eg. fonts) where shapes have points
        // close to the extremes but not actually on them.
        // Imagine a hand written A with one leg slightly shorter
        // than the other leg. var `buffer` is that distance.
        buffer = sampleSize * 0.2,
        bmin = min + buffer,
        bmax = max - buffer;

    // add the starting  extreme step
    steps.push(getValueForStep(min, max, sampleCount, 0));

    // now calculate the steps between the buffer zones
    for (var i = 0; i < sampleCount; i++)
        steps.push(getValueForStep(bmin, bmax, sampleCount, i));

    // add the end extreme step
    steps.push(getValueForStep(min, max, sampleCount, sampleCount - 1));

    if (false) {
        // DEBUGGING: this returns the slice lines for drawing
        var points = [];
        for (var i = 0, n; i < steps.length; i++) {
            n = steps[i];
            line = (0 === axis)
                // horizontal lines
                ? line = [[minA, n], [maxA, n]]
                // vertical lines
                : line = [[n, minA], [n, maxA]];
            points = points.concat(line);
        }
        return points;
    }

    linesLoop:
    for (var i = 0, n, points, line; i < steps.length; i++) {

        n = steps[i];

        line = (0 === axis)
            // horizontal lines
            ? line = [[minA, n], [maxA, n]]
            // vertical lines
            : line = [[n, minA], [n, maxA]];

        // create points at their intersections with poly
        collisions[i] = [];

        pathsLoop:
        for (var p = 0; p < paths.length; p++) {

            points = paths[p];

            pointsLoop:
            for (var j = 0, c, next, end; j < points.length; j++) {

                end = points.length - 1 === j;

                if (end && !pathsClosed)
                    // no closing segment
                    break pointsLoop;

                next = end ? 0 : j + 1;

                c = Pol.getLineLineCollision(line[0], line[1], points[j], points[next]);

                if (c)
                    collisions[i].push(c);

            }

        }

        if (0 === collisions[i].length) {
            // no intersections, so we'll use the extreme points
            collisions[i].push(leftDirection === direction || bottomDirection === direction ? line[1] : line[0]);
        }

        // sort and keep the closest point in the direction we want
        boundaryPoints[i] = collisions[i].sort(direction)[0];

    }

    return boundaryPoints;

    /**
     * Returns interpolated value between `min` and `max`.
     * @param {Number} min - the value at the first step.
     * @param {Number} max - the value at the last step.
     * @param {Number} stepCount - the number of steps.
     * @param {Number} step - the step to be calculated.
     * @returns {Number}
     */
    function getValueForStep(min, max, stepCount, step) {
        return min + ((max - min) / (stepCount - 1) * step);
    };

    /**
     * Given a direction `key`, sets axis and returns sorter function.
     * This function also serves as a reasonable enum for direction.
     * @param {String} key - the direction key.
     * @returns {Function}
     */
    function allDirections(key) {

        switch (key) {
            case 'left': axis = 0; return leftDirection;
            case 'right': axis = 0; return rightDirection;
            case 'top': axis = 1; return topDirection;
            case 'bottom': axis = 1; return bottomDirection;
            default: throw Error('getBoundaryPoints: bad `direction` supplied.');
        };

    };

    /** Sort function for left direction */
    function leftDirection(a, b) { return a[0] - b[0] };

    /** Sort function for right direction */
    function rightDirection(a, b) { return b[0] - a[0] };

    /** Sort function for top direction */
    function topDirection(a, b) { return b[1] - a[1] };

    /** Sort function for bottom direction */
    function bottomDirection(a, b) { return a[1] - b[1] };

};


/* ----------------------- *
 *  LINE INTERSECTION      *
 * ----------------------- */

/**
 * Returns the point at which two finite lines intersect.
 * From https://stackoverflow.com/a/30159167
 * @param {Array<Number>} p0 - A point array. The start point of line A.
 * @param {Array<Number>} p1 - A point array. The end point of line A.
 * @param {Array<Number>} p2 - A point array. The start point of line B.
 * @param {Array<Number>} p3 - A point array. The end point of line B.
 * @return {?Array<Number>}
 */
Pol.getLineLineCollision = function getLineLineCollision(p0, p1, p2, p3) {

    // Calculate vectors directly from array points:
    const s10_x = p1[0] - p0[0];
    const s10_y = p1[1] - p0[1];
    const s32_x = p3[0] - p2[0];
    const s32_y = p3[1] - p2[1];

    const denom = s10_x * s32_y - s32_x * s10_y;

    if (denom === 0)
        return;

    const denom_positive = denom > 0;

    const s02_x = p0[0] - p2[0];
    const s02_y = p0[1] - p2[1];

    const s_numer = s10_x * s02_y - s10_y * s02_x;

    if ((s_numer < 0) === denom_positive)
        return;

    const t_numer = s32_x * s02_y - s32_y * s02_x;

    if ((t_numer < 0) === denom_positive)
        return;

    if (
        (s_numer > denom) === denom_positive
        || (t_numer > denom) === denom_positive
    )
        return;

    const t = t_numer / denom;

    // Calculate intersection point using array indexing:
    const pi = [p0[0] + (t * s10_x), p0[1] + (t * s10_y)];

    return pi;

};

/**
 * Given a path, will return all points
 * intersecting the "slice" at `targetY`.
 * @param {Array<Array<point>>} paths - paths/points array.
 * @param {Number} targetY - the target y-axis "slice".
 * @param {Number} [tolerance] - how near a value must be to be considered the same value (default: 0.1).
 * @returns {?Array<point>}
 */
function findIntersectionPoints(paths, targetY, tolerance) {

    if (undefined == tolerance)
        tolerance = 0.1;

    if (
        'Array' !== paths.constructor.name
        || 0 === paths.length
        || 'Array' !== paths[0].constructor.name
        || 0 === paths[0].length
        || 'Array' !== paths[0][0].constructor.name
        || 0 === paths[0][0].length
        || 'Number' !== paths[0][0][0].constructor.name
    )
        throw Error('findIntersectionPoints: bad `paths` supplied.');

    // a single path
    if ('Number' === paths[0][0].constructor.name)
        paths = [paths];

    var found = [];

    for (var i = 0, points; i < paths.length; i++) {

        points = paths[i];

        for (var j = 0, x, x1, x2, y1, y2; j < points.length - 1; j++) {

            x1 = points[j][0];
            y1 = points[j][1];
            x2 = points[j + 1][0];
            y2 = points[j + 1][1];

            if (
                Math.min(y1, y2) > targetY
                || targetY > Math.max(y1, y2)
            )
                // line's Y coordinates are out of range of targetY
                continue;

            // avoid division by zero
            if (y1 !== y2) {

                // linear interpolation
                x = x1 + (targetY - y1) * (x2 - x1) / (y2 - y1);
                appendIfNotLast(found, [x, targetY]);
                continue;

            }

            else if (y1 === targetY) {

                // the line is horizontal and intersects with the targetY
                // add both points
                appendIfNotLast(found, [x1, y1]);
                appendIfNotLast(found, [x2, y1]);
                continue;

            }

        }

    }

    if (found.length > 0)
        return found;

    /**
     * Adds point to points array IF it isn't
     * identical to the last point added.
     * @param {Array} arr - an array.
     * @param {Array<Number>} point - a point [x,y].
     */
    function appendIfNotLast(arr, point) {

        if (undefined == point)
            return;

        else if (
            0 === arr.length
            || arr[arr.length - 1][0] !== point[0]
            || arr[arr.length - 1][1] !== point[1]
        )
            arr.push(point);

    };

};


/* -------------------------------- *
 *  GEOMETRY / SORTING UTILITIES    *
 * -------------------------------- */

/**
 * Returns a function that sorts points
 * along an axis specified as `angleDegrees`.
 * @author m1b
 * @version 2024-01-22
 * @param {Number} angleDegrees - the axis angle in degrees.
 */
function getSorterForAngle(angleDegrees) {

    var angleRadians = (angleDegrees * Math.PI) / 180;

    switch (angleDegrees) {

        // first some simple cases
        case 0: return function (a, b) { return a[0] - b[0] };
        case 90: return function (a, b) { return b[1] - a[1] };
        case 180: return function (a, b) { return b[0] - a[0] };
        case 270: return function (a, b) { return a[1] - b[1] };

        // for arbitrary angle
        default:
            return function (a, b) {
                return (calculateDistanceAlongAxis(a) - calculateDistanceAlongAxis(b));
            };
    }

    /**
     * For a given point, returns the x coordinate
     * rotated by `angleRadians`.
     * @param {point} point - the point [x, y] to compare.
     * @returns {Number}
     */
    function calculateDistanceAlongAxis(point) {

        var dx = point[0],
            dy = point[1],
            rotatedX = dx * Math.cos(angleRadians) + dy * Math.sin(angleRadians);

        return rotatedX;

    };

};

/**
 * Returns angle, in degrees, of the line p1_p2.
 * @param {point} p1 - array [x, y].
 * @param {point} p2 - array [x, y].
 * @param {Boolean} makePositive - whether to return a positive angle, eg. -10° == 350° (default: false).
 * @returns {Number}
 */
function angleOfLine(p1, p2, makePositive) {

    // Calculate the angle in radians
    var angleRadians = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);

    // Convert radians to degrees
    var angleDegrees = (angleRadians * 180) / Math.PI;

    if (true === makePositive)
        angleDegrees = (angleDegrees + 360) % 360;

    return angleDegrees;

};

/**
 * Compares pairs of points, and returns the minimum distance between any pair.
 * If either point is undefined, that pair will be ignored.
 * @param {Array<point>} points1 - an array of [x,y] points.
 * @param {Array<point>} points2 - an array of [x,y] points.
 * @returns {Number}
 */
function getMinDistanceBetweenMatchedPoints(points1, points2) {

    var len = Math.min(points1.length, points2.length),
        minSquareDistance = Infinity;

    for (var i = 0, squareDistance; i < len; i++) {

        if (
            undefined == points1[i]
            || undefined == points2[i]
        )
            // ignore unmatched points
            continue;

        // we compare the squared distances, for efficiency
        squareDistance = Math.pow(points2[i][0] - points1[i][0], 2) + Math.pow(points2[i][1] - points1[i][1], 2);

        if (minSquareDistance > squareDistance)
            minSquareDistance = squareDistance;

    }

    // return the actual distance
    return Math.sqrt(minSquareDistance);

};

/**
 * Returns an array of points derived
 * by intersecting "slices" at `yValues`
 * @param {Array<Array<point>>} paths - a paths/points array.
 * @param {Number} extreme - the extreme point of the boundary.
 * @param {Array<Number>} yValues - the y-axis slice positions.
 * @param {Function} sorter - a sorter used to sort each slice of points.
 * @returns {Array<point>}
 */
function getBoundaryPointsForSlices(paths, extreme, yValues, sorter) {

    var boundary = [];

    for (var i = 0, intersect; i < yValues.length; i++) {

        // find points by slicing along y axis
        // if no points found, use extreme value
        intersect = findIntersectionPoints(paths, yValues[i]) || [[extreme, yValues[i]]];

        // sort away from extreme side
        intersect.sort(sorter);

        // add just the first point
        boundary.push(intersect[0]);

    }

    return boundary;

};

/**
 * Returns the distance required to move
 * `pol2` left (ie. 180°) until it touches `pol1`.
 *
 * IMPORTANT:
 * You must pre-rotate pol1 and pol2
 * so that pol2 is right of pol1.
 *
 * @author m1b
 * @version 2024-01-18
 * @param {Object} options
 * @param {Pol} options.pol1 - the left polygon.
 * @param {Pol} options.pol2 - the right polygon.
 * @param {Boolean} [options.ignoreOverlappingItems] - whether to ignore cases where two items overlap (when there is negative distance between them) (default: false).
 * @returns {?Number} - the distance between the two polygons.
 */
function getDistanceApart(options) {

    options = options || {};

    var pol1 = options.pol1,
        pol2 = options.pol2,
        ignoreOverlappingItems = true === options.ignoreOverlappingItems;

    // make copy of all paths
    var pathsLeft = pol1.copyPaths(),
        pathsRight = pol2.copyPaths();

    // sort paths
    pathsLeft.sort(fromTopThenRight);
    pathsRight.sort(fromTopThenLeft);

    var allPoints = concatPaths([pathsLeft, pathsRight]);
    allPoints.sort(fromTop);

    // collect all Y values - these are the 'slices' to intersect
    var yValues = [];

    for (var i = 0; i < allPoints.length; i++) {

        if (
            0 === yValues.length
            || yValues[yValues.length - 1] !== allPoints[i][1]
        )
            yValues.push(allPoints[i][1]);

    }

    // fresh copy of paths
    pathsLeft = pol1.copyPaths();
    pathsRight = pol2.copyPaths();

    // add closing point
    for (var i = 0; i < pathsLeft.length; i++)
        if (pol1.pathsClosed[i])
            pathsLeft[i].push(pathsLeft[i][0]);

    // add closing point
    for (var i = 0; i < pathsRight.length; i++)
        if (pol2.pathsClosed[i])
            pathsRight[i].push(pathsRight[i][0]);

    var bounds1 = pol1.getBounds(),
        bounds2 = pol2.getBounds(),
        overlap = bounds1[2] - bounds2[0];

    if (overlap > 0) {
        // paths are overlapping

        if (ignoreOverlappingItems)
            return;

        Mat.transformPaths({
            paths: pathsRight,
            matrix: Mat.getTranslationMatrix([overlap, 0]),
        });
    }
    else
        overlap = undefined;

    // extreme points are used when a path
    // has no intersection with the slice
    var extreme1 = bounds1[0],
        extreme2 = bounds2[2];

    // boundaries are a "path" of points, one per slice,
    // that bound the item from one direction
    var boundary1 = getBoundaryPointsForSlices(pathsLeft, extreme1, yValues, sortRight),
        boundary2 = getBoundaryPointsForSlices(pathsRight, extreme2, yValues, sortLeft);

    var touchDistance = getMinDistanceBetweenMatchedPoints(boundary1, boundary2);

    if (overlap)
        // adjust for the earlier overlap correction
        touchDistance -= overlap;

    return touchDistance;

    // SORTING FUNCTIONS

    function fromTop(a, b) {
        return b[1] - a[1];
    };

    function sortRight(a, b) {
        return b[0] - a[0];
    };

    function sortLeft(a, b) {
        return a[0] - b[0];
    };

    function fromTopThenLeft(a, b) {
        if (a[1] < b[1]) return -1;
        if (a[1] > b[1]) return 1;
        if (a[0] < b[0]) return -1;
        if (a[0] > b[0]) return 1;
        return 0;
    };

    function fromTopThenRight(a, b) {
        if (a[1] < b[1]) return -1;
        if (a[1] > b[1]) return 1;
        if (a[0] < b[0]) return 1;
        if (a[0] > b[0]) return -1;
        return 0;
    };

};
