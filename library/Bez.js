if ('undefined' === typeof _bezUtilsIncluded)
    $.evalFile(File($.fileName).parent + '/BezUtils.js');

if ('undefined' === typeof BezMath)
    $.evalFile(File($.fileName).parent + '/BezMath.js');

if ('undefined' === typeof BezPoint)
    $.evalFile(File($.fileName).parent + '/BezPoint.js');

if ('undefined' === typeof Mat)
    $.evalFile(File($.fileName).parent + '/Mat.js');

if ('undefined' === typeof Pol)
    $.evalFile(File($.fileName).parent + '/Pol.js');

// re-export BezMath functions onto Bez namespace for backwards compatibility
// (Bez is available here via hoisting since it is a function declaration)
Bez.getQ = BezMath.getQ;
Bez.getK = BezMath.getK;
Bez.getLength = BezMath.getLength;
Bez.pointOnBezier = BezMath.pointOnBezier;
Bez.getSegmentLength = BezMath.getSegmentLength;
Bez.getExtremaOfCurve = BezMath.getExtremaOfCurve;
Bez.getTValues = BezMath.getTValues;
Bez.tForLength = BezMath.tForLength;
Bez.getAngleOfPointP1 = BezMath.getAngleOfPointP1;


/**
 * BEZ - A general purpose path-manipulation helper object.
 *
 * Acknowledgements:
 * I have gratefully used the bezier maths code by Hiroyuki Sato:
 * https://github.com/Shanfan/Illustrator-Scripts-Archive/blob/master/jsx/Divide%20(length).jsx

 * Notes:
 * A bez treats every pathItem as a compoundPathItem, so
 * to access the Bez's paths, iterate over bez.pathItems.
 * `pathItems`, `pathPoints`, `points` and `closed` share the
 * same indexing, so bez.pathItems[i].closed === bez.pathsClosed[i]
 *
 * If you are manipulating the paths, do all the manipulating
 * of the `points` arrays, and then call draw(), or redraw(),
 * depending on whether you are creating (draw) or editing
 * (redraw) an item.
 *
 * Example 1. Make Bez from a pathItem or compoundPathItem
 *   var bez = new Bez({ pageItem: item });
 *
 * Example 2. Make Bez from array of "paths" which are arrays of points
 *   var bez = new Bez({ paths: myPathsArray });
 *   // nothing is added to the document until you draw it:
 *   bez.draw();
 *   bez.select();
 *
 * @author m1b
 * @version 2022-12-22
 * @constructor
 * @param {Object} options
 * @param {PathItem} [options.pageItem] - an Illustrator PathItem.
 * @param {Array<Array<BezPoint>>} [options.paths] - the paths/points array.
 * @param {Array<Boolean>} [options.pathsClosed] - array showing which paths are closed.
 * @param {Object} [options.appearance] - the current absolute rotation value of the bez (default: 0).
 * @param {Number} [options.absoluteRotationAngle] - the current absolute rotation value of the bez (default: 0).
 * @param {Number} [options.rotationOffsetFromDatum] - the number of degrees to offset the rotation datum calculation (default: 0).
 * @param {Function} [options.pathItemFilter] - a function that, given a PathItem, returns true or false. False pathItems will be ignored. (default: no filter).
 * @param {Array<BezPoint>|BezTransformPositionType|Function} [options.transformPoint] - can be [x, y] coordinates, a BezTransformPositionType, or a function that returns coordinates, given the bez (default: undefined).
 */
function Bez(options) {

    var self = this;

    self.pageItem = options.pageItem;
    self.doc = options.doc;
    self.absoluteRotationAngle = options.absoluteRotationAngle || 0;
    self.rotationOffsetFromDatum = options.rotationOffsetFromDatum || 0;
    self.transformPoint = options.transformPoint;
    self.pathItemFilter = options.pathItemFilter;
    self.appearance = options.appearance || {};

    self.paths = []; // the paths/points array [[BezPoints], [BezPoints], ... ]
    self.pathsClosed = []; // matching array [Boolean, Boolean, ...]
    self.pathsLengths = []; // matching array [Boolean, Boolean, ...]
    self.pathItems = []; // Illustrator dom PathItems

    if (self.pageItem != undefined) {

        self.doc = self.doc || getParentDocument(self.pageItem);

        if (self.pageItem.parent.typename == 'CompoundPathItem')
            // handle case where compoundPathItem is partially selected
            self.pageItem = self.pageItem.parent;

        self.consumePageItem(self.pageItem);

    }

    else if (options.paths != undefined)
        self.consumePoints(options.paths)

    else
        throw Error('new Bez failed: no `pageItem` or `paths` supplied.');

    self.doc = self.doc || app.activeDocument;

    if (
        self.paths != undefined
        && options.pathsClosed != undefined
        && options.pathsClosed.constructor.name == 'Boolean'
    )
        // closed value to be applied to every path
        for (var i = 0; i < self.paths.length; i++)
            self.pathsClosed[i] = options.pathsClosed;

    else if (
        // closed values are specified for each path
        options.pathsClosed != undefined
        && options.pathsClosed.constructor.name == 'Array'
        && options.pathsClosed.length === self.paths.length
    )
        for (var i = 0; i < self.paths.length; i++)
            self.pathsClosed[i] = options.pathsClosed[i];

    if (self.pathsClosed.length == 0)
        throw Error('new Bez failed: no `pathsClosed` supplied.');

};


/**
 * Returns coordinates of either
 * (a) a supplied point,
 * (b) a supplied transformPositionType for the bez, or
 * (c) the bez's transformPoint (the usual usage).
 * @author m1b
 * @version 2023-01-04
 * @param {Object} options
 * @param {Array<Number>} [options.transformPoint] - the point to transform from (default: bez's transformPoint or undefined).
 * @param {BezTransformPositionType} [options.transformPositionType] - a transformPositionType (default: undefined).
 * @returns {Array<Number>} - [x, y]
 */
Bez.prototype.getCoordinatesOfTransformPoint = function getCoordinatesOfTransformPoint(options) {

    options = options || {};

    var self = this,
        transformPoint = options.transformPoint,
        transformPositionType = options.transformPositionType,
        tp;

    // 1. try to resolve tp for supplied `transformPoint`

    if (transformPoint != undefined) {

        if (
            transformPoint.constructor.name == 'Array'
            && transformPoint.length == 2
        )
            tp = transformPoint;

        else if (transformPoint.hasOwnProperty('anchor'))
            // convert from BezPoint or PathPoint
            tp = transformPoint.anchor;

        else if (
            transformPositionType == undefined
            && transformPoint.constructor.name == 'String'
        )
            // might be a BezTransformPositionType
            tp = self.getCoordinatesOfTransformPosition(transformPoint);

    }


    // 2. try to resolve tp for supplied `transformPositionType`

    if (
        tp == undefined
        && transformPositionType != undefined
    )
        tp = self.getCoordinatesOfTransformPosition(transformPositionType);

    if (
        tp == undefined
        && self.transformPoint == undefined
    )
        return;

    // 3. try to resolve tp for `self.transformPoint`

    if (self.transformPoint.constructor.name == 'String')
        // might be a BezTransformPositionType
        tp = self.getCoordinatesOfTransformPosition(self.transformPoint);

    else if (self.transformPoint.constructor.name == 'Function')
        // use the transformPoint function
        tp = self.transformPoint(self);

    else
        tp = self.transformPoint;

    if (tp.hasOwnProperty('anchor'))
        tp = tp.anchor;

    return tp;

};


/**
 * Returns a function that, given a bez, will
 * return coordinates for a BezPoint specified
 * by `pathIndex` and `pointIndex`.
 * Use this to generate a closure suitable for
 * passing as a Bez's `transformPoint` parameter.
 * @param {Number} pathIndex - the index to the bez's paths.
 * @param {Number} pointIndex - the index to that path's points.
 * @returns {Array<Number>} [x, y].
 */
Bez.getCoordinatesOfPoint = function bezGetCoordinatesOf(pathIndex, pointIndex) {

    if (
        pathIndex == undefined
        || isNaN(Number(pathIndex))
    )
        throw Error('Bez.getCoordinatesOfPoint failed: bad `pathIndex` (' + pathIndex + ').')

    if (
        pointIndex == undefined
        || isNaN(Number(pointIndex))
    )
        throw Error('Bez.getCoordinatesOfPoint failed: bad `pointIndex` (' + pointIndex + ').')

    return function (bez) {
        var p = bez.point(pathIndex, pointIndex);
        if (p != undefined)
            return p.anchor;
    };

};


/**
 * Duplicate the bez.
 * Note: the heavy lifting of duplicating
 * the bez is in the constructor, which
 * carefully copies `points` and `closed`
 * to ensure new references are made.
 * @param {Boolean} duplicatePageItem - whether to duplicate the PageItem (default: true).
 * @returns {Bez}
 */
Bez.prototype.duplicate = function duplicate(duplicatePageItem) {

    var self = this,
        newPageItem;

    if (
        self.pageItem != undefined
        && duplicatePageItem !== false
    )
        newPageItem = self.pageItem.duplicate();

    return new Bez(
        {
            pageItem: newPageItem,
            paths: newPageItem ? undefined : self.paths,
            pathsClosed: newPageItem ? undefined : self.pathsClosed,
            doc: self.doc,
            absoluteRotationAngle: self.absoluteRotationAngle,
            rotationOffsetFromDatum: self.rotationOffsetFromDatum,
            transformPoint: self.transformPoint,
        }
    );

};


/**
 * Returns a BezPoint, given pathIndex and pointIndex.
 * Note: will return undefined if supplied indices
 * are out-of-bounds.
 * @author m1b
 * @version 2023-01-04
 * @example - simple usage
 *   bez.point(0,1) will return the second
 *   point of the first path of the bez.
 * @example - negative indices
 *   bez.point(-1,-2) will return the second
 *   last point of the last path of the bez.
 * @param {Number} pathIndex - the index of the bez's path (can be negative).
 * @param {Number} pointIndex - the index of that path's point (can be negative).
 * @returns {BezPoint}
 */
Bez.prototype.point = function myPoint(pathIndex, pointIndex) {

    if (
        pathIndex == undefined
        || isNaN(Number(pathIndex))
    )
        throw Error('Bez.prototype.point failed: bad `pathIndex` (' + pathIndex + ').')

    if (
        pointIndex == undefined
        || isNaN(Number(pointIndex))
    )
        throw Error('Bez.prototype.point failed: bad `pointIndex` (' + pointIndex + ').')

    var self = this;

    if (pathIndex < 0)
        // handle negative index
        pathIndex += self.paths.length;

    if (
        pathIndex < 0
        || pathIndex >= self.paths.length
    )
        // throw Error('Bez.prototype.point failed: `pathIndex` out of bounds (' + pathIndex + ').')
        return;

    if (pointIndex < 0)
        // handle negative index
        pointIndex += self.paths[pathIndex].length;

    if (
        pointIndex < 0
        || pointIndex >= self.paths[pathIndex].length
    )
        // throw Error('Bez.prototype.point failed: `pointIndex` out of bounds (' + pointIndex + ').')
        return;

    return self.paths[pathIndex][pointIndex];

}




/**
 * Loads points into the bez.
 * @param {Array<any>} points - the points.
 */
Bez.prototype.consumePoints = function consumePoints(points) {

    var self = this;

    self.paths = [];

    for (var i = 0; i < points.length; i++) {

        self.paths[i] = [];

        for (var j = 0; j < points[i].length; j++)
            self.paths[i][j] = new BezPoint(points[i][j]);

    }

};


/**
 * Loads pageItem into the bez.
 * @param {PathItem|CompoundPathItem} pageItem - an Illlustrator PathItem or CompoundPathItem.
 */
Bez.prototype.consumePageItem = function consumePageItem(pageItem) {

    if (pageItem == undefined)
        return;

    var self = this;

    self.pageItem = pageItem;
    self.pathItems = [];
    self.paths = [];
    self.pathsClosed = [];

    // store CompoundPathItem
    if (pageItem.constructor.name == 'CompoundPathItem')
        for (var i = 0, len = pageItem.pathItems.length; i < len; i++) {
            if (
                undefined == self.pathItemFilter
                || self.pathItemFilter(pageItem.pathItems[i])
            )
                self.pathItems.push(pageItem.pathItems[i]);
        }

    else if (pageItem.constructor.name == 'GroupItem')
        // how to handle a group item here?
        throw Error('Don\'t know how to handle a group item here.');

    // store PathItem
    else if (pageItem.hasOwnProperty('pathPoints'))
        self.pathItems = [pageItem];

    else if (pageItem.constructor.name == 'Array')
        throw Error('Bez.prototype.consumePageItem: expected PathItem, but received Array.');

    if (self.pathItems.length == 0)
        throw Error('Bez.prototype.consumePageItem: no pathItems.');

    // store points
    for (var i = 0; i < self.pathItems.length; i++) {

        if (0 === self.pathItems[i].pathPoints.length)
            continue;

        self.paths[i] = [];
        self.pathsClosed[i] = self.pathItems[i].closed == true;

        for (var j = 0; j < self.pathItems[i].pathPoints.length; j++)
            self.paths[i][j] = new BezPoint(self.pathItems[i].pathPoints[j]);

    }

};


/**
 * Returns the bez's centroid.
 * @param {Number} [flatness] - the average length of lines when approximating curved segments (default: undefined, do not approximate curved segments).
 * @param {<Array<Array<Number>>} [polygon] - an array of path/points coordinates (default: make polygon from bez's points).
 * @returns {Array<Number>} - the centroid [x, y].
 */
Bez.prototype.getCentroid = function getMyCentroid(flatness, polygon) {

    var self = this;

    return Bez.getCentroid(polygon || self.getPolygon(flatness));

};


/**
 * Returns true with point `p` is contained by with the bez.
 * @author m1b and chatGPT
 * @version 2023-06-12
 * @param {Array<Number>} p - a point [x, y].
 * @param {Number} flatness - length of line segments in pts when approximating curves (default: 2).
 * @returns {Boolean}
 */
Bez.prototype.containsPoint = function containsPoint(p, flatness) {

    var self = this,
        x = p[0],
        y = p[1],
        doesIntersect = false;

    // note getPolygon() returns an array of
    // polygons (one for each path in bez)
    self.polygons = self.polygons || self.getPolygon(flatness || 2);

    polygonsLoop:
    for (var k = 0; k < self.polygons.length; k++) {

        var polygon = self.polygons[k],
            inside = false;

        for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {

            var xi = polygon[i][0],
                yi = polygon[i][1],
                xj = polygon[j][0],
                yj = polygon[j][1],

                intersect = (
                    ((yi > y) !== (yj > y))
                    && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
                );

            if (intersect)
                inside = !inside;

        }

        if (inside) {
            doesIntersect = true;
            break polygonsLoop;
        }

    }

    return inside;

};


/**
 * Create pathItems by interpolating between 2 pathItems.
 * @author m1b
 * @version 2022-12-22
 * @param {Object} options
 * @param {PathItem} options.pathItem1 - an Illustrator path item.
 * @param {PathItem} options.pathItem2 - an Illustrator path item with matching number of path points.
 * @param {Number} [options.steps] - number of interpolated paths to create (default: 1 step).
 * @param {Array<Number>} [options.values] - array of numbers in range 0..1 (default: 1 step).
 * @param {Function} [options.valueFunction] - a function that applies to the values (default: none).
 * @param {Boolean} [options.reverse] - whether to reverse direction of pathItem1's paths (default: false).
 * @returns {Array<PathItem>} - Array of one or more PathItems
 * */
Bez.pathItemsFromInterpolation = function pathItemsFromInterpolation(options) {

    options = options || {};

    var pathItem1 = options.pathItem1,
        pathItem2 = options.pathItem2,
        steps = options.steps || 0,
        values = options.values,
        valueFunction = options.valueFunction;

    if (
        pathItem1 == undefined
        || pathItem2 == undefined
    ) {
        alert('Bez.pathItemsFromInterpolation failed: No path item.');
        return;
    }

    if (
        values != undefined
        && values.constructor.name == 'Array'
        && values.length > 0
    )
        steps = values.length;

    // default
    steps = steps || 1;

    // placement should be between path items in layer order
    var placement = (pathItem1.absoluteZOrderPosition < pathItem2.absoluteZOrderPosition)
        ? ElementPlacement.PLACEAFTER
        : ElementPlacement.PLACEBEFORE;

    if (values == undefined) {
        values = [];
        var inc = 1 / (steps + 1);
        for (var i = 0; i < steps; i++)
            values.push(inc * (i + 1))
    }

    var bez1 = new Bez({ pageItem: pathItem1 }),
        bez2 = new Bez({ pageItem: pathItem2 }),
        compatiblePaths = (bez1.paths.length === bez2.paths.length);

    if (compatiblePaths)
        for (var i = 0; i < bez1.paths.length; i++) {
            compatiblePaths = (
                bez1.paths[i].length === bez2.paths[i].length
                && bez1.pathsClosed[i] === bez2.pathsClosed[i]
            );
            if (compatiblePaths !== true)
                break;
        }

    if (!compatiblePaths) {
        alert('Cannot interpolate due to incompatible anchor points.')
        return;
    }

    //make items
    items = [];

    for (var i = 0; i < values.length; i++) {

        var t = values[i];

        if (valueFunction != undefined)
            t = valueFunction(t);

        items[i] = makePathItemInterpolated(bez1, bez2, t, options.reverse == true);

        if (items[i] != undefined)
            items[i].move(pathItem2, placement)
    }

    return items;


    function makePathItemInterpolated(bez1, bez2, t, reverse) {

        reverse = (reverse === true);

        var deletethisLine = 1,
            newPoints = [];

        for (var i = 0; i < bez1.paths.length; i++) {

            var closed = bez1.pathsClosed[i];

            if (closed) {
                bez1.paths[i].push(bez1.paths[i][0]);
                bez2.paths[i].push(bez2.paths[i][0]);
            }

            // calculate the points
            var pointCount = bez1.paths[i].length - 1,
                points1 = bez1.paths[i],
                points2 = bez2.paths[i];

            if (reverse)
                points2 = points2.slice().reverse();

            newPoints[i] = [];

            for (var j = 0; j <= pointCount; j++)
                newPoints[i].push(BezPoint.bezPointFromInterpolation(points1[j], points2[j], t));

        }

        var newBez = new Bez({
            paths: newPoints,
            pathsClosed: bez1.pathsClosed
        });

        return newBez.draw();

    }

};


/**
 * Adds extra points to each path segment.
 * @author m1b
 * @version 2023-01-02
 *
 * Call this method in any of four ways:
 *
 * (a) Specify a distance between extra points
 *     @example
 *       bez.addSegmentPoints({ distance: 10 });
 *
 * (b) Specify a number of points added to each segment
 *     This example will align the bez's bottom
 *     to the bottom of the supplied box.
 *     @example
 *       bez.addSegmentPoints({ numberOfPoints: 3 });
 *
 * (c) Specify a values array. This example will add
 *     a point at 10% and 90% within each segment.
 *     @example
 *       bez.addSegmentPoints({ values: [0.1, 0.9] });
 *
 * (d) Specify a lengths array. This example
 *     will add a point at distance 3 and then
 *     at distance 6 in each segment.
 *     @example
 *       bez.addSegmentPoints({ lengths: [3, 6] });
 *
 * More options:
 *  • retractControlPoints - will convert points into
 *    straight-line segments.
 *  • selectedSegmentsOnly - whether to add points
 *    only to selected segments.
 *  • filterFunction - the extra points will only be
 *    added if the filter returns true for a segment.
 *    @example pass Bez.isCurvedSegment as filterFunction
 *    to add extra points only to curved segments.
 *
 * @param {Object} options
 * @param {Number} [options.distance] - the approximate distance between added points.
 * @param {Number} [options.numberOfPoints] - the number of points to add between existing points.
 * @param {Array<Number>} [options.values] - array of numbers in range 0..1.
 * @param {Array<Number>} [options.lengths] - array of numbers representing lengths in points at which to add points.
 * @param {Boolean} [options.selectedSegmentsOnly] - whether to apply to just the selected segments (default: false).
 * @param {Boolean} [options.retractControlPoints] - whether to retract all segments control points (default: false).
 * @param {Function} [options.filterFunction] - a function to decide whether to add points, given a segment (default: undefined).
 * @param {Function} [options.valueFunction] - a function to modify each calculated tValue (default: undefined).
 */
Bez.prototype.addSegmentPoints = function addSegmentPoints(options) {

    options = options || {};

    var self = this;

    options.paths = self.paths.slice();
    options.pathsClosed = self.pathsClosed;

    self.paths = Bez.addSegmentPoints(options);

    self.draw();

};


/**
 * Returns a new paths/points array including
 * extra points added to each segment.
 * @author m1b
 * @version 2023-01-02
 *
 * Call this method in any of four ways:
 *
 * (a) Specify a distance between extra points
 *     @example
 *       Bez.addSegmentPoints({ distance: 10 });
 *
 * (b) Specify a number of points added to each segment
 *     This example will align the bez's bottom
 *     to the bottom of the supplied box.
 *     @example
 *       bez.addSegmentPoints({ numberOfPoints: 3 });
 *
 * (c) Specify a values array. This example will add
 *     a point at 10% and 90% within each segment.
 *     @example
 *       bez.addSegmentPoints({ values: [0.1, 0.9] });
 *
 * (d) Specify a lengths array. This example
 *     will add a point at distance 3 and then
 *     at distance 6 in each segment.
 *     @example
 *       bez.addSegmentPoints({ lengths: [3, 6] });
 *
 * More options:
 *  • retractControlPoints - will convert points into
 *    straight-line segments.
 *  • selectedSegmentsOnly - whether to add points
 *    only to selected segments.
 *  • filterFunction - the extra points will only be
 *    added if the filter returns true for a segment.
 *    @example pass Bez.isCurvedSegment as filterFunction
 *    to add extra points only to curved segments.
 *
 * @param {Object} options
 * @param {Array<Array<BezPoint>>} options.paths - the paths/points array.
 * @param {Array<Boolean>} options.pathsClosed - array showing which paths are closed.
 * @param {Number} [options.distance] - the approximate distance between added points.
 * @param {Number} [options.numberOfPoints] - the number of points to add between existing points.
 * @param {Array<Number>} [options.values] - array of numbers in range 0..1.
 * @param {Array<Number>} [options.lengths] - array of numbers representing lengths in points at which to add points.
 * @param {Boolean} [options.selectedSegmentsOnly] - whether to apply to just the selected segments (default: false).
 * @param {Boolean} [options.retractControlPoints] - whether to retract all segments control points (default: false).
 * @param {Function} [options.filterFunction] - a function to decide whether to add points, given a segment (default: undefined).
 */
Bez.addSegmentPoints = function bezAddSegmentPoints(options) {

    options = options || {};

    var paths = Bez.copyPaths(options.paths),
        pathsClosed = options.pathsClosed,
        pointsWithExtraPoints = [],
        distance = options.distance,
        numberOfPoints = options.numberOfPoints,
        values = options.values,
        lengths = options.lengths,
        filterFunction = options.filterFunction,
        selectedSegmentsOnly = options.selectedSegmentsOnly === true,
        retractControlPoints = options.retractControlPoints === true;

    if (
        paths == undefined
        || pathsClosed == undefined
        || paths.length !== pathsClosed.length
    )
        throw Error('Bez.addSegmentPoints failed: requires `points` and `closed` parameters with matching lengths.');

    if (
        distance == undefined
        && numberOfPoints == undefined
        && values == undefined
        && lengths == undefined
    )
        throw Error('Bez.addSegmentPoints failed: requires `distance`, `numberOfPoints` or `values` parameters.');

    if (distance == 0)
        distance == Infinity;

    var points,
        closed,
        newPoints,
        pointsCount,
        tValues,
        splitPoints,
        skipThisSegment,
        end,
        next;

    pathsLoop:
    for (var i = 0, l = paths.length; i < l; i++) {

        points = paths[i];
        closed = pathsClosed[i];
        newPoints = [];
        pointsCount = points.length;

        if (points.length < 2)
            continue;

        pointsLoop:
        for (var j = 0, p1, p2; j < pointsCount; j++) {

            // $/*debug*/.writeln('>> j = ' + j);
            p1 = new BezPoint(points[j]);

            end = j == pointsCount - 1;

            if (end && !closed) {
                // no closing segment
                newPoints.push(p1);
                break pointsLoop;
            }

            next = end ? 0 : j + 1;

            p2 = new BezPoint(points[next]);

            skipThisSegment = false;

            if (
                selectedSegmentsOnly
                && !Bez.segmentIsSelected(p1, p2)
            )
                // segment wasn't selected
                skipThisSegment = true;

            if (
                filterFunction != undefined
                && filterFunction(p1, p2) == false
            )
                // segment failed the filter function
                skipThisSegment = true;

            if (skipThisSegment) {
                // just add the original point back in
                newPoints.push(p1);
                continue pointsLoop;
            }

            options.p1 = p1;
            options.p2 = p2;

            tValues = Bez.getTValues(options);
            // $/*debug*/.writeln('tValues = ' + tValues);

            if (
                tValues == undefined
                || tValues.length == 0
            ) {
                // no tValues, so just add existing point back in
                newPoints.push(p1);
                continue pointsLoop;
            }

            // get the split points
            splitPoints = Bez.splitSegment(p1, p2, tValues);

            // replace p1 and p2 with the adjusted p1 and p2
            points[j] = splitPoints[0];
            points[next] = splitPoints[splitPoints.length - 1];

            // add the split points to the new points
            newPoints = newPoints.concat(splitPoints);

            // remove the last splitpoint (adjusted p2)
            newPoints.pop();

            if (end)
                // fix up the reciprocal control point on the first point
                newPoints[0].leftDirection = splitPoints[splitPoints.length - 1].leftDirection;

        }

        if (retractControlPoints)
            Bez.retractControlPoints(newPoints);

        // add the points
        pointsWithExtraPoints[i] = newPoints;

    }

    return pointsWithExtraPoints;

};


/**
 * Convert the bez paths to straight sided polygons.
 * @author m1b
 * @version 2022-12-30
 * @param {Object} options
 * @param {Number} [options.distance] - the approximate distance between added points (default: undefined).
 * @param {Number} [options.numberOfPoints] - the number of points to add between existing points (default: undefined).
 * @param {Array<Number>} [options.values] - array of numbers in range 0..1 (default: 1 step).
 * @param {Boolean} [options.selectedSegmentsOnly] - whether to apply to just the selected segments (default: true).
 * @param {Boolean} [options.retractControlPoints] - whether to retract all segments control points (default: false).
 * @param {Function} [options.filterFunction] - a function to decide whether to add points, given a segment (default: undefined).
 */
Bez.prototype.addExtraPointsBetweenPoints = function addExtraPointsBetweenPoints(options) {

    var self = this;

    // note: self.addSegmentPoints will update
    // the points and also redraw()
    self.addSegmentPoints(options);

};


/**
 * Performs a function on each of the bez's points.
 * @author m1b
 * @version 2022-12-22
 * @param {Object} [options]
 * @param {Function} options.fn - a function, given data on each point, can return either a replacement BezPoint, or nothing.
 * @param {Number} [options.pathIndex] - an index to the bez's path array (default: undefined, meaning every path).
 * @returns {Object} - user object.
 */
Bez.prototype.eachPoint = function eachPoint(options) {

    options = options || {};

    var self = this,
        filterFunction = options.filterFunction,
        pathIndex = options.pathIndex,
        selectedSegmentsOnly = options.selectedSegmentsOnly !== false,
        fn = options.fn,
        start = 0,
        end = self.paths.length,
        isSelected = self.pathItems[pathIndex || 0].selected == true,
        redraw = false;

    if (fn == undefined)
        throw Error('Bez.prototype.eachPoint failed: no `pointFunction` supplied.')

    if (
        pathIndex != undefined
        && !isNan(Number(pathIndex))
        && pathIndex >= 0
        && pathIndex <= self.paths.length
    ) {
        start = pathIndex;
        end = pathIndex;
    }

    pathsLoop:
    for (var i = start; i < end; i++) {

        var points = self.paths[i],
            closed = self.pathsClosed[i],
            pointsCount = points.length,
            result = {};

        pointsLoop:
        for (var j = 0; j < pointsCount; j++) {

            var skipThisSegment = false,
                closedFirstPoint = closed && j == 0,
                closedLastPoint = closed && j == pointsCount - 1,
                index0 = closedFirstPoint ? pointsCount - 1 : j - 1,
                index1 = j,
                index2 = closedLastPoint ? 0 : j + 1,
                p0 = index0 >= 0 ? points[index0] : undefined,
                p1 = points[index1],
                p2 = index0 < pointsCount ? points[index2] : undefined;

            // $/*debug*/.writeln('p0 = ' + p0);
            // $/*debug*/.writeln('p1 = ' + p1);
            // $/*debug*/.writeln('p2 = ' + p2);

            if (closed && p0 == undefined)
                p0 = points[pointsCount - 1];

            if (closed && p2 == undefined)
                p2 = points[0];

            if (
                selectedSegmentsOnly
                && p1.pathPoint.selected !== PathPointSelection.ANCHORPOINT
            )
                // segment wasn't selected
                skipThisSegment = true;

            if (
                filterFunction != undefined
                && filterFunction(p1, p2) == false
            )
                // segment failed the filter function
                skipThisSegment = true;

            if (skipThisSegment)
                continue pointsLoop;

            // $/*debug*/.writeln(j + ': p1.angle = ' + p1.angle + '\u00B0');

            // execute the function
            fn(self, p0, p1, p2, j, i, result);

        }

    }

    if (redraw)
        self.draw({ select: isSelected });

    return result;

};


/**
 * Makes a "hash" of the bez which can be used for comparing
 * the bez against another bez. The hash is an array which
 * describes the bez's points in terms of angles and segment lengths.
 * The hash is an array of numbers: [angle, length, angle, length]
 * where "angle" = angle of segment relative to previous segment,
 * and "length" = length of segment as proportion of the path length.
 * Example hash of a rectangle bez:
 *   [270, 0.28571, 270, 0.21428, 270, 0.28571, 270, 0.21428]
 * @author m1b
 * @version 2023-02-08
 * @param {String} checkHash - another hash to match.
 * @param {Number} angleTolerance - how close, in degrees, angles must be to be considered matching.
 * @param {Number} lengthRatioTolerance - how close, as a proportion of total path, lengths must be to be considered matching.
 * @returns {String|Boolean}
 */
Bez.prototype.makeHash = function myMakeHash(checkHash, angleTolerance, lengthRatioTolerance) {

    var self = this,
        hash = [],
        precision = 4, // decimal places shown in hash
        pathsLengths = [],
        pathStartAngle = 0,
        checker;

    if (checkHash != undefined)

        // split the checking hash into stack of elements
        checker = checkHash.slice();

    pathsLoop:
    for (var i = 0; i < self.paths.length; i++) {

        var points = self.paths[i].slice(),
            pathLength = 0;

        points.push(points[0]);

        // 1. the first loop gathers information about the path

        pointsLoop1:
        for (var j = 1; j < points.length; j++) {

            // add segmentLength property to the 2nd point of each segment
            points[j].segmentLength = Bez.getSegmentLength(points[j - 1], points[j]);

            // sum the lengths to get the total path length
            pathLength += points[j].segmentLength;

            // add angle property to most points
            points[j - 1].angle = Bez.getAngleOfPointP1(points[j - 1], points[j]);

            if (
                i > 0
                && j == 1
            ) {
                // is it worth adding a virtual line segment
                // between the last path and this one?
                // it would capture the relative position of the sub-paths
                // hash.push(round((points[j - 1].angle - pathStartAngle + 360) % 360, precision, true));
            }

            if (j == 1)
                pathStartAngle = points[j - 1].angle;

        }

        pathsLengths[i] = pathLength;

        // 2. the second loop adds to the digest

        pointsLoop2:
        for (var j = 0; j < points.length - 1; j++) {

            var angleDelta = (points[j + 1].angle || 0) - (points[j].angle || 0),
                segmentRatio = (points[j].segmentLength || 0) / pathLength;

            hash.push(round(((angleDelta + 360) % 360) / 360, precision, true));
            hash.push(round(segmentRatio, precision, true));

        }

    }

    self.hash = hash;

    return hash;

};


/**
 * Returns the centroid [x, y] of the polygon.
 * @param {Array<point>} polygon - an array of path/points coordinates [[x,y],[x,y]].
 * @returns {Array<Number>} - the centroid [x, y]
 */
Bez.getCentroid = function getCentroid(polygon) {

    var area = 0;
    var x = 0;
    var y = 0;
    var points = polygon[0];

    for (var i = 0, len = points.length, j = len - 1; i < len; j = i++) {
        var a = points[i];
        var b = points[j];
        var f = a[0] * b[1] - b[0] * a[1];
        x += (a[0] + b[0]) * f;
        y += (a[1] + b[1]) * f;
        area += f * 3;
    }

    if (area === 0)
        return [points[0][0], points[0][1]];

    return [x / area, -y / area];

};


/**
 * Converts a CompoundPathItem into individual PathItems.
 * @author m1b
 * @version 2023-03-29
 * @param {CompoundPathItem} item - the item to uncompound.
 * @returns {Array<PathItem>} - the individual path items.
 */
Bez.uncompound = function uncompound(item) {

    if (!item.hasOwnProperty('pathItems'))
        return;

    var pathItems = [],
        container = item.parent;

    for (var i = item.pathItems.length - 1; i >= 0; i--) {
        pathItems[i] = item.pathItems[i];
        pathItems[i].move(container, ElementPlacement.PLACEATBEGINNING);
    }

    return pathItems;

};


/**
 * Returns the rotation amount in degrees
 * that the item needs to be rotated such
 * that it has a minimal bounding box area.
 * Assuming that `item` is a rectangular
 * object, such as a PlacedItem, RasterItem
 * or a rectangular path item, the resulting
 * rotation will rotate it so that the sides
 * of the rectangle align to a factor of 90°.
 * In other words, it will return the value
 * required to "unrotate" the item.
 * @author m1b
 * @version 2023-08-25
 * @param {PageItem} item - an Illustrator page item.
 * @returns {Number}
 */
Bez.findRotationByMinimalBounds = function findRotationByMinimalBounds(item) {

    // we will rotate a copy and leave the original
    var workingItem = item.duplicate(),

        convergenceThreshold = 0.001,
        inc = 45, // the starting rotation increment
        rotationAmount = 0,
        prevArea = area(workingItem);

    while (Math.abs(inc) >= convergenceThreshold) {

        workingItem.rotate(inc);

        var newArea = area(workingItem);

        if (newArea < prevArea) {
            prevArea = newArea;
            rotationAmount -= inc;
            inc *= 0.5;
        }

        else {
            workingItem.rotate(-inc); // Undo the last rotation
            inc *= -0.5;
        }

    }

    // clean up
    workingItem.remove();

    return round(rotationAmount, 2);

    /**
     * Returns area of bounding box of `item`.
     * @param {PageItem} item
     * @returns {Number}
     */
    function area(item) {
        return item.width * item.height;
    };

};


/**
 * Draws visual indicators showing path direction.
 * @author m1b
 * @version 2022-12-22
 * @param {Object} [options]
 * @param {Number} [options.pathIndex] - the index to the path (default: all paths).
 */
Bez.prototype.drawPathIndicators = function (options) {

    options = options || {};

    var self = this,
        size = options.size || 2,

        pink = getPink(),
        cyan = getCyan(),

        firstPointAppearance = {
            filled: false,
            stroked: true,
            strokeWidth: 0.5,
            strokeColor: pink,
            strokeDashes: [],
        },

        secondPointAppearance = {
            filled: false,
            stroked: true,
            strokeWidth: 0.5,
            strokeColor: cyan,
            strokeDashes: [],
        };

    for (var i = 0; i < self.paths.length; i++) {

        var p1 = self.point(i, 0),
            p2 = self.point(i, 1);

        // draw a circle at the first point
        Bez.drawCircle(self.doc, p1.anchor, size, firstPointAppearance);

        // draw a square at the second point
        Bez.drawSquare(self.doc, p2.anchor, size * 2, secondPointAppearance);

    }

    function getPink() {
        var c = new CMYKColor();
        c.cyan = 0;
        c.magenta = 100;
        c.yellow = 20;
        c.black = 0;
        return c;
    };

    function getCyan() {
        var c = new CMYKColor();
        c.cyan = 100;
        c.magenta = 0;
        c.yellow = 20;
        c.black = 0;
        return c;
    };

};


/**
 * Given array of points, retracts all control points.
 * @author mark1bean
 * @version 2022-12-30
 * @param {Array<Array<BezPoint>>|Array<BezPoint>} points - single array, or nested arrays, of BezPoints.
 */
Bez.retractControlPoints = function retractControlPoints(points) {

    if (
        points == undefined
        || points.constructor.name != 'Array'
        || points.length == 0
    )
        throw Error('Bez.retractControlPoints: does not recognize parameter.');

    if (points[0].constructor.name == 'Array')
        for (var i = 0; i < points.length; i++)
            Bez.retractControlPoints(points[i]);

    else if (points[0] instanceof BezPoint) {
        for (var i = 0; i < points.length; i++)
            points[i].retractControlPoints();
    }

};


/**
 * Convert the bez to straight-line segmented polygons.
 * @author m1b
 * @version 2022-12-30
 *
 * @param {Object} options
 * @param {Number} [options.distance] - the approximate distance between added points (default: undefined).
 */
Bez.prototype.convertToPolygon = function convertToPolygon(options) {

    options = options || {};
    options.retractControlPoints = true;

    var self = this;

    // note: self.addSegmentPoints will update
    // the points and also redraw()
    self.addSegmentPoints(options);

};


/**
 * Returns the visual centre of a path item,
 * in the form of the largest circle that
 * can fit into the path item.
 * @author m1b
 * @version 2022-12-22
 *
 * @requires Bez.js
 * @requires PolyLabel.js by Volodymyr Agafonkin.
 *     Original JS version: https://github.com/mapbox/polylabel
 *     ExtendScript version: https://github.com/mark1bean/bez-for-illustrator/lib/PolyLabel.js
 *
 * @param {Object} options
 * @param {Number} [options.flatness] - the average length, in points, of flats on curved segments (default: 5).
 * @param {Number} [options.precision] - precision used when calculating the visual center (default: 1.0).
 * @returns {Object} - the largest circle found {center: [x, y] radius: r}
 */
Bez.prototype.findVisualCenter = function findVisualCenter(options) {

    if (polylabel == undefined)
        throw Error('findVisualCenter not available: Please include the required script file "PolyLabel.js" at the start of your code.');

    options = options || {};

    var self = this,
        polygon = self.getPolygon(options.flatness);

    return polylabel(polygon, options.precision || 1, false);

};


/**
 * Returns array of paths/points
 * of raw coordinates [x, y] and
 * also stores the polygon.
 * @author m1b
 * @version 2023-12-10
 * @param {Object} options
 * @param {Number} [options.flatness] - the average length of the flats when approximating curved segments (default: no points added).
 * @param {Boolean} [options.forceUpdate] - whether to force update the polygon if it has already been calculated (default: false).
 * @param {Boolean} [options.outerPathsOnly] - whether to only return polygon of the outer paths (default: false).
 * @param {Boolean} [options.simplify] - whether to remove redundant points (default: false).
 * @returns {Array<Array<Number>>}
 */
Bez.prototype.getPolygon = function getPolygon(options) {

    options = options || {};

    var self = this,
        flatness = options.flatness,
        forceUpdate = true === options.forceUpdate,
        outerPathsOnly = true === options.outerPathsOnly,
        simplify = true === options.simplify;

    if (
        true !== forceUpdate
        && undefined != self.polygon
        && self.polygonFlatness == flatness
    )
        // use stored value
        return self.polygon;

    var paths = self.paths;

    if (
        undefined != flatness
        && flatness > 0
    ) {
        // convert to polygon (flatness is average distance between path points)
        paths = Bez.addSegmentPoints({
            distance: flatness || 1,
            filterFunction: Bez.isCurvedSegment,
            retractControlPoints: true,
            paths: paths,
            pathsClosed: self.pathsClosed.slice(),
        });
    }

    if (paths.length == 0)
        throw Error('Bez.prototype.getPolygon: no paths returned.');

    // now convert the BezPoints to a simple array
    var polyPaths = [];

    for (var i = 0; i < paths.length; i++) {

        var path = { points: [] };

        for (var j = 0; j < paths[i].length; j++)
            path.points[j] = [paths[i][j].anchor[0], paths[i][j].anchor[1]];

        if (simplify === true)
            path.points = Pol.simplifyPolygon(path.points, flatness / 10);

        path.area = Pol.getPolygonArea(path.points);

        polyPaths.push(path);

    }

    // sort by area, largest first
    polyPaths.sort(function (a, b) { return b.area - a.area });

    if (Math.abs(polyPaths[0].area) < Math.abs(polyPaths[polyPaths.length - 1].area))

        // reverse the polarity!
        polyPaths.sort(function (a, b) { return a.area - b.area });

    // format as simple polygon points (first element is outer path)
    var polygon = [];

    for (var i = 0; i < polyPaths.length; i++)
        polygon.push(polyPaths[i].points);

    // store it
    self.polygon = polygon;
    self.polygonFlatness = flatness;

    return polygon;

};


/**
 * Reverses the order of path points.
 * @author m1b
 * @version 2022-12-22
 * @param {Object} options
 * @param {Number} [pathIndex] - the index to the path (default: all paths).
 * @param {Boolean} [redraw] - whether to redraw the pageItem (default: true).
 */
Bez.prototype.reverse = function reverse(options) {

    options = options || {};

    var self = this,
        pathIndex = options.pathIndex,
        start = 0,
        end = self.paths.length,
        redraw = options.redraw !== false,
        isSelected = self.pathItems[pathIndex || 0].selected == true;

    if (
        pathIndex != undefined
        && !isNan(Number(pathIndex))
    ) {
        start = pathIndex;
        end = pathIndex;

        if (pathIndex > self.paths.length)
            throw Error('Bez.prototype.reverse failed: pathIndex out of bounds.')

    }

    pathsLoop:
    for (var i = start; i < end; i++) {

        var points = self.paths[i].slice(),
            closed = self.pathsClosed[i],
            pointsCount = points.length,
            newPoints = [];

        // $/*debug*/.writeln(points[0].anchor.join(', '));

        points.reverse();

        // $/*debug*/.writeln(points[0].anchor.join(', '));

        if (closed)
            // we still want the path to
            // start on the same point
            points.unshift(points.pop());

        // $/*debug*/.writeln(points[0].anchor.join(', '));

        pointsLoop:
        for (var j = 0; j < pointsCount; j++) {

            var p = points[j];

            // swap control points around
            var left = p.leftDirection;
            p.leftDirection = p.rightDirection;
            p.rightDirection = left;

            // newPoints.push(p);
            newPoints[j] = p;
        }

        self.paths[i] = newPoints;

    }

    if (redraw)
        self.draw({ select: isSelected });

};


/**
 * Returns information on the closest point
 * to the supplied point.
 * @param {BezPoint|PathPoint|Array<Number>} point - the point to check against.
 * @returns {Object} - { distance: point: pathIndex: pointIndex: }

 */
Bez.prototype.closestToPoint = function closestToPoint(point) {

    var self = this,
        p = point;

    if (p.hasOwnProperty('anchor'))
        p = p.anchor;

    if (
        p.constructor.name != 'Array'
        || p.length !== 2
    )
        throw Error('Bez.prototype.closestToPoint failed: bad `point` parameter (' + point + ').');

    var closest = {
        distance: Infinity,
        point: undefined,
        pathIndex: undefined,
        pointIndex: undefined
    }
    for (i = 0; i < self.paths.length; i++)
        for (j = 0; j < self.paths[i].length; j++) {
            var p1 = self.paths[i][j],
                d = distanceBetweenPoints(p, p1.anchor);
            if (d < closest.distance) {
                closest.distance = d;
                closest.point = p1;
                closest.pathIndex = i;
                closest.pointIndex = j;
            }
        }

    return closest;

};


/**
 * Re-orders a path by stipulating the first point.
 * @author m1b
 * @version 2022-12-22
 * @param {Object} options
 * @param {Number} [options.pathIndex] - the index to the paths (default: undefined, all paths).
 * @param {Number} [options.pointIndex] - the index to that path's points (default: all paths).
 * @param {Boolean} [options.redraw] - whether to redraw the bez (default: false).
 */
Bez.prototype.setFirstPoint = function reverse(options) {

    options = options || {};

    var self = this,
        pathIndex = options.pathIndex || 0,
        pointIndex = options.pointIndex,
        isSelected = self.pathItems[pathIndex || 0].selected == true;

    if (
        pathIndex == undefined
        || isNaN(Number(pathIndex))
        || pointIndex == undefined
        || isNaN(Number(pointIndex))
    )
        throw Error('Bez.prototype.setFirstPoint failed: could not determine first point.');

    // reorder the points in path
    var points = self.paths[pathIndex];
    self.paths[pathIndex] = points.slice(pointIndex, points.length).concat(points.slice(0, pointIndex));

    if (redraw)
        self.draw({ select: isSelected });

};


/**
 * Returns the indices of the point.
 * @param {BezPoint} point - the BezPoint.
 * @returns {Array<Number>} - [pathIndex, pointIndex].
 */
Bez.prototype.getIndicesOfPoint = function getIndicesOfPoint(point) {

    var self = this,
        indices;

    for (i = 0; i < self.paths.length; i++)
        for (j = 0; j < self.paths[i].length; j++)
            if (self.paths[i][j].isEqualTo(point))
                return [i, j];

};


/**
 * Returns array of selected points.
 * Note: requires a valid PageItem.
 * @returns {Array<BezPoint>}
 */
Bez.prototype.getSelectedPoints = function getSelectedPoints() {

    var self = this,
        points = [];

    for (var i = 0; i < self.paths.length; i++)
        for (var j = 0; j < self.paths[i].length; j++)
            if (
                self.paths[i][j].pathPoint != undefined
                && self.paths[i][j].pathPoint.selected == ANCHORPOINT
            )
                points.push(self.paths[i][j]);

    return points;

};

/**
 * Re-orders a path by stipulating the first point.
 * @author m1b
 * @version 2022-12-22
 * @param {Object} options
 * @param {Number} [options.pathIndex] - the index to the paths (default: undefined, all paths).
 * @param {Number} [options.pointIndex] - the index to that path's points (default: all paths).
 * @param {Boolean} [options.redraw] - whether to redraw the bez (default: false).
 */
Bez.prototype.getClosestPointTo = function getClosestPointTo(options) {

    options = options || {};

    var self = this,
        point = options.point,
        firstSelectedPoint = options.firstSelectedPoint,
        pathIndex = options.pathIndex || 0,
        pointIndex = options.pointIndex,
        redraw = options.redraw === true,
        closestPoint;



    // 1. point specified by point
    if (point != undefined) {



    }

    // 2. point specified by indices


    return closestPoint;
};


/**
 * Given a path segment p1,p2 and
 * tValues to split the path, returns
 * an array of BezPoints starting
 * with p1, ending with p2 and with
 * the new points in between.
 * Note that this function doesn't
 * change the bez's points or pathItems.
 * @author m1b
 * @version 2022-12-30
 * @param {BezPoint|PathPoint} p1 - point at start of segment.
 * @param {BezPoint|PathPoint} p2 - point at end of segment.
 * @param {Array} tValues - array of numbers in range 0..1.
 * @returns {Array<BezPoint>} - the points that will replace the original segment.
 */
Bez.splitSegment = function splitSegment(p1, p2, tValues) {

    if (
        p1 == undefined
        || p2 == undefined
    )
        throw Error('Bez.splitSegment failed: supplied point is undefined.');

    var q = Bez.getQ(p1, p2),
        splitPoints = [],
        firstT = tValues[0],
        lastT = tValues[tValues.length - 1];

    // add start and end points to tValues
    tValues.unshift(0);
    tValues.push(1);

    // calculate the points at the split position
    if (
        pointsAreEqual(q[0], q[1])
        && pointsAreEqual(q[2], q[3])
    ) {
        // control points equal anchor points
        for (var j = 1; j < tValues.length - 1; j++) {
            var p = Bez.pointOnBezier(q, tValues[j]);
            splitPoints.push(new BezPoint({ anchor: p, pointType: PointType.CORNER }));
        }
    }

    else {

        for (var j = 1; j < tValues.length - 1; j++)
            splitPoints.push(getDivPnt(q, tValues[j - 1], tValues[j], tValues[j + 1]));

    }

    // adjust and add the first and last points
    var firstPoint = new BezPoint(p1);
    var lastPoint = new BezPoint(p2);
    firstPoint.rightDirection = scaleHandle(p1, p1.rightDirection, firstT);
    lastPoint.leftDirection = scaleHandle(p2, p2.leftDirection, 1 - lastT);
    splitPoints.unshift(firstPoint);
    splitPoints.push(lastPoint);

    // finished
    return splitPoints;

    /**
     * Scales a control point
     * @param {BezPoint|PathPoint} p - a point.
     * @param {Number} n - direction (0 == leftDirection, 1 == rightDirection).
     * @param {Number} scaleFactor - the scaleFactor applied to the handle.
     * @returns {Array<Number>} - the new point [x, y]
     */
    function scaleHandle(p, handle, scaleFactor) {

        return [
            p.anchor[0] + (handle[0] - p.anchor[0]) * scaleFactor,
            p.anchor[1] + (handle[1] - p.anchor[1]) * scaleFactor
        ];
    }

    /**
     * Returns a BezPoint at calculated at "t1".
     * @param {Array<Number>} q - the segment's 4 coordinates.
     * @param {Number} t0 - the previous tValue.
     * @param {Number} t1 - the div point's tValue.
     * @param {Number} t2 - the next tValue.
     * @returns {BezPoint}
     */
    function getDivPnt(q, t0, t1, t2) {

        var anchor = Bez.pointOnBezier(q, t1),
            r = defDir(q, 1, t1, anchor, (t2 - t1) / (1 - t1)),
            l = defDir(q, 0, t1, anchor, (t1 - t0) / t1);

        return new BezPoint(
            {
                anchor: anchor,
                leftDirection: l,
                rightDirection: r,
                pointType: PointType.SMOOTH
            }
        );

    }


    /**
     * Returns the coordinates [x, y]
     * of the handle of the point on
     * the bezier curve that corresponds
     * to the parameter t
     * @param {Array<Number>} q - the 4 points.
     * @param {Number} dir - the direction flag (0 == leftDirection, 1 == rightDirection).
     * @param {Number} t - the tValue.
     * @param {Array<Number>} anchor - the anchor point.
     * @param {Number} m - the scaleFactor.
     * @returns {Array<Number>} - [x, y].
     */
    function defDir(q, dir, t, anchor, m) {

        var handle = [
            t * (t * (q[dir][0] - 2 * q[dir + 1][0] + q[dir + 2][0]) + 2 * (q[dir + 1][0] - q[dir][0])) + q[dir][0],
            t * (t * (q[dir][1] - 2 * q[dir + 1][1] + q[dir + 2][1]) + 2 * (q[dir + 1][1] - q[dir][1])) + q[dir][1]
        ];

        return [
            anchor[0] + (handle[0] - anchor[0]) * m,
            anchor[1] + (handle[1] - anchor[1]) * m
        ];
    }

} // end Bez.splitSegment


/**
 * Updates this.pageItem using this.paths.
 * @author m1b
 * @version 2022-05-23
 * @param {Object} options
 * @param {Layer|GroupItem} [options.container] - the object that the bez will be drawn into (default: undefined).
 * @param {Boolean} [options.select] - select the pathItem afterwards (default: undefined)
 */
Bez.prototype.draw = function draw(options) {

    options = options || {};

    var self = this;

    self.updatePageItem();

    if (options.select === true)
        self.select();

};


/**
 * Draws the supplied paths, either
 * updating a supplied pageItem, or
 * creating a new pageItem.
 * @author m1b
 * @version 2023-11-29
 * @param {Object} options
 * @param {Object} options.doc - an Illustrator Document.
 * @param {Array<Array<BezPoint>>} options.paths - the paths/points array.
 * @param {Array<Boolean>} options.pathsClosed - array showing which paths are closed.
 * @param {PageItem} [options.pageItem] - a page item to update (default: create new page item).
 * @param {Object} [options.properties] - an object of key/values to apply to each path (default: undefined).
 * @param {Boolean} [options.drawAsCompoundPathItem] - whether to draw as CompoundPathItem or individual PathItems (default: true).
 * @param {Layer|GroupItem} [options.container] - the object that a new item will be drawn into (default: active layer).
 * @param {Boolean} [options.select] - whether to select the drawn item(s) (default: false).
 * @returns {PathItem}
 */
Bez.draw = function bezDraw(options) {

    options = options || {};

    var doc = options.doc,
        paths = options.paths,
        pathsClosed = options.pathsClosed || [],
        pageItem = options.pageItem,
        drawAsCompoundPathItem = options.drawAsCompoundPathItem !== false,
        select = options.select === true;

    if (doc == undefined)
        throw Error('Bez.draw failed: no `doc` parameter.');

    if (paths == undefined)
        throw Error('Bez.draw failed: no `paths` parameter.');

    if (
        (
            pathsClosed.constructor.name != 'Boolean'
            && pathsClosed.constructor.name != 'Array'
        )
        || (
            pathsClosed.constructor.name == 'Array'
            && pathsClosed.length !== paths.length
        )
    )
        throw Error('Bez.draw failed: bad `pathsClosed` parameter.');

    // if (select)
    //     doc.selection = [];

    var container = options.container || doc.activeLayer,
        location,
        drawnItems = [];

    var makeCompoundPath = paths.length > 1 && drawAsCompoundPathItem == true;
    var createNewPageItem = pageItem == undefined
        || (makeCompoundPath && pageItem.constructor.name !== 'CompoundPathItem')
        || (!makeCompoundPath && pageItem.constructor.name === 'CompoundPathItem');

    if (
        createNewPageItem
        && makeCompoundPath
    ) {
        pageItem = container.compoundPathItems.add();
        drawnItems[0] = pageItem;
    }

    if (
        pageItem != undefined
        && pageItem.constructor.name == 'CompoundPathItem'
    ) {
        location = pageItem;
    }
    else {
        location = container;
    }

    var pathsCount = paths.length - 1;

    while (location.pathItems.length < pathsCount)
        location.pathItems.add();

    pathsLoop:
    for (var i = pathsCount; i >= 0; i--) {

        var points = paths[i],

            // create a path item
            item = location.pathItems.add();

        // add the pathPoints
        addPathPointsLoop:
        for (var j = 0; j < points.length; j++) {

            if (points[j].doNotDraw)
                continue addPathPointsLoop;

            var p = item.pathPoints.add();

            if (points[j].constructor.name === 'Array') {
                p.anchor = points[j];
                p.leftDirection = points[j];
                p.rightDirection = points[j];
                p.pointType = PointType.CORNER;
            }

            else {
                p.anchor = points[j].anchor;
                p.leftDirection = points[j].leftDirection;
                p.rightDirection = points[j].rightDirection;
                p.pointType = points[j].pointType;
            }

        }

        // set the closed
        if (pathsClosed.constructor.name == 'Boolean')
            item.closed = pathsClosed;
        else if (pathsClosed.constructor.name == 'Array')
            item.closed = pathsClosed[i];

        // set the polarity
        item.polarity = i == 0 ? PolarityValues.POSITIVE : PolarityValues.NEGATIVE;

        if (select)
            item.selected = true;

        if (options.properties != undefined)
            // we only need to do this for the first path item
            applyProperties(item, doc, options.properties);

        drawnItems.push(item);

    }

    if (
        drawnItems.length == 1
        || drawAsCompoundPathItem == true
    )
        return drawnItems[0]

    else if (drawnItems.length > 1)
        return drawnItems;

};


/**
 * Updates the bez's page item
 * to match its path/points array.
 * @author m1b
 * @version 2023-11-29
 */
Bez.prototype.updatePageItem = function updatePageItem() {

    var self = this,
        doc = self.doc,
        pageItem = self.pageItem,
        paths = self.paths,
        pathsClosed = self.pathsClosed;

    if (doc == undefined)
        throw Error('Bez.draw failed: no `doc` parameter.');

    if (paths == undefined)
        throw Error('Bez.prototype.draw failed: no `paths` parameter.');

    if (
        pathsClosed == undefined
        && (
            pathsClosed.constructor.name != 'Boolean'
            || pathsClosed.length !== paths.length
        )
    )
        throw Error('Bez.prototype.draw failed: bad `pathsClosed` parameter.');

    if (pageItem != undefined) {

        if (
            (
                pageItem.constructor.name === 'CompoundPathItem'
                && paths.length === 1
            )
            || (
                pageItem.constructor.name === 'PathItem'
                && paths.length !== 1
            )
        ) {
            // page item is wrong type, so start again
            pageItem.remove();
            self.pageItem = pageItem = undefined;
        }

    }

    if (pageItem == undefined) {

        // create the appropriate page item
        pageItem = paths.length === 1
            ? doc.activeLayer.pathItems.add()
            : doc.activeLayer.compoundPathItems.add();

    }

    var pathItems,
        pathsCount = paths.length;

    if (pageItem.constructor.name == 'CompoundPathItem') {
        // adjust the number of path items
        while (pageItem.pathItems.length < pathsCount)
            pageItem.pathItems.add();
        while (pageItem.pathItems.length > pathsCount)
            pageItem.pathItems[pageItem.pathItems.length - 1].remove();
        pathItems = pageItem.pathItems;
    }
    else {
        pathItems = [pageItem];
    }

    pathsLoop:
    for (var i = 0; i < pathsCount; i++) {

        var item = pathItems[i],
            points = paths[i],
            pointsCount = paths[i].length;

        // ensure pathItem has the correct number of pathPoints
        while (item.pathPoints.length < pointsCount)
            item.pathPoints.add();
        while (item.pathPoints.length > pointsCount)
            item.pathPoints[item.pathPoints.length - 1].remove();

        // adjust the points
        pointsLoop:
        for (var j = 0; j < pointsCount; j++) {

            if (points[j].doNotDraw)
                continue pointsLoop;

            var p = item.pathPoints[j];
            p.anchor = points[j].anchor;
            p.leftDirection = points[j].leftDirection;
            p.rightDirection = points[j].rightDirection;
            p.pointType = points[j].pointType;

        }

        // set the closed
        if (pathsClosed.constructor.name == 'Boolean')
            item.closed = pathsClosed;
        else if (pathsClosed.constructor.name == 'Array')
            item.closed = pathsClosed[i];

        // set the polarity
        item.polarity = i == 0 ? PolarityValues.POSITIVE : PolarityValues.NEGATIVE;

    }

};


/**
 * Adds points for a new path to the bez.
 * Use redraw() to update the pathItem.
 * @param {Array<BezPoint>} points - an array of points to add.
 * @param {Boolean} closed - whether the new path is closed.
 */
Bez.prototype.addPath = function bezAddPath(points, closed) {

    if (
        points == undefined
        || points.constructor.name != 'Array'
        || points.length < 2
        || !points[0].hasOwnProperty('anchor')
    )
        throw Error('Bez.prototype.addPath failed: bad `points` parameter.')

    var self = this;
    self.paths.push(points.slice());
    self.pathsClosed.push(closed == true);

};


/**
 * Returns an array of Bez objects made from all PathItems
 * in `items`, recursing into GroupItems and CompoundPathItems.
 * @author m1b
 * @version 2026-03-31
 * @param {Array<PageItem>} items - Illustrator page items (eg. doc.selection).
 * @returns {Array<Bez>}
 */
Bez.fromItems = function bezFromItems(items) {

    var pathItems = _extractPathItems(items),
        bezs = [];

    for (var i = 0; i < pathItems.length; i++)
        bezs.push(new Bez({ pageItem: pathItems[i] }));

    return bezs;

    function _extractPathItems(items) {

        var found = [];

        for (var i = 0; i < items.length; i++) {

            var item = items[i];

            if (item.typename == 'PathItem')
                found.push(item);

            else if (item.typename == 'CompoundPathItem')
                for (var j = 0; j < item.pathItems.length; j++)
                    found.push(item.pathItems[j]);

            else if (item.typename == 'GroupItem')
                found = found.concat(_extractPathItems(item.pageItems));

        }

        return found;

    }

};


/**
 * Returns a copy of a path or array of paths.
 * Use this to avoid unintentionally manipulating
 * the existing path(s).
 * @param {Array<BezPoint>|Array<Array<BezPoint>>} paths - the paths to copy.
 * @returns {Array<BezPoint>|Array<Array<BezPoint>>}
 */
Bez.copyPaths = function copyPaths(paths) {

    if (paths[0].constructor.name == 'Array') {

        var newPaths = [];

        for (var i = 0; i < paths.length; i++)
            newPaths.push(Bez.copyPaths(paths[i]));

        return newPaths;

    }

    var newPath = [];

    for (var i = 0; i < paths.length; i++)
        newPath.push(new BezPoint(paths[i]));

    return newPath;

};


/**
 * Returns the bez's bounding box.
 * @author m1b
 * @version 2023-11-26
 * @param {Boolean} forceUpdate - whether to recalculate the bounds (default: use the cached value).
 * @returns {Array<Number>}
 */
Bez.prototype.getBounds = function (forceUpdate) {

    var self = this;

    if (
        forceUpdate !== true
        && self.bounds != undefined
    )
        // use stored value
        return self.bounds;

    var coords = [[], []],

        // calculate extrama
        paths = Bez.addExtrema({
            paths: self.paths,
            pathsClosed: self.pathsClosed,
            selectedSegmentsOnly: false
        });

    for (var i = 0; i < paths.length; i++)
        for (var j = 0; j < paths[i].length; j++) {
            coords[0].push(paths[i][j].anchor[0]);
            coords[1].push(paths[i][j].anchor[1]);
        }

    var bounds = [
            /* left */ Math.min.apply(null, coords[0]),
            /* top */ Math.max.apply(null, coords[1]),
            /* right */ Math.max.apply(null, coords[0]),
            /* bottom */ Math.min.apply(null, coords[1]),
    ];

    self.bounds = bounds;

    return bounds;

};


/**
 * Returns the coordinates of the requested
 * transform position type, for example
 * BezTransformPositionType.BOTTOM_RIGHT
 * @author m1b
 * @version 2023-01-02
 * @param {BezTransformPositionType} transformPositionType - the transform center type (default: BezTransformPositionType.CENTER).
 * @param {Array<Number>} [bounds] - the bounds to use (default: the bez's bounds).
 * @returns {Array<Number>} - [x, y].
 */
Bez.prototype.getCoordinatesOfTransformPosition = function getCoordinatesOfTransformPosition(transformPositionType, bounds) {

    return Bez.getCoordinatesOfTransformPosition(transformPositionType, bounds || this.getBounds());

};


/**
 * Returns the coordinates of the requested
 * transform position type, for example
 * BezTransformPositionType.BOTTOM_RIGHT
 * @author m1b
 * @version 2023-01-02
 * @param {BezTransformPositionType} obj - the transform center type (default: BezTransformPositionType.CENTER).
 * @param {Array<Number>} bounds - the bounds to use (default: the bez's bounds).
 * @returns {Array<Number>} - the coodinates [x, y].
 */
Bez.getCoordinatesOfTransformPosition = function bezGetCoordinatesOfTransformPosition(obj, bounds) {

    if (obj.hasOwnProperty('anchor'))
        return obj.anchor;

    if (bounds == undefined)
        throw Error('Bez.getCoordinatesOfTransformPosition failed: no `bounds` supplied.');

    if (obj == BezTransformPositionType.TOP_LEFT)
        return [bounds[0], bounds[1]];

    if (obj == BezTransformPositionType.TOP_RIGHT)
        return [bounds[2], bounds[1]];

    if (obj == BezTransformPositionType.BOTTOM_RIGHT)
        return [bounds[2], bounds[3]];

    if (obj == BezTransformPositionType.BOTTOM_LEFT)
        return [bounds[0], bounds[3]];

    if (obj == BezTransformPositionType.CENTER)
        return [bounds[0] + (bounds[2] - bounds[0]) / 2, bounds[1] + (bounds[3] - bounds[1]) / 2];

    if (obj == BezTransformPositionType.TOP)
        return [bounds[0] + (bounds[2] - bounds[0]) / 2, bounds[1]];

    if (obj == BezTransformPositionType.RIGHT)
        return [bounds[2], bounds[1] + (bounds[3] - bounds[1]) / 2];

    if (obj == BezTransformPositionType.BOTTOM)
        return [bounds[0] + (bounds[2] - bounds[0]) / 2, bounds[3]];

    if (obj == BezTransformPositionType.LEFT)
        return [bounds[0], bounds[1] + (bounds[3] - bounds[1]) / 2];

};


/**
 * Rotate the bez's points.
 * @author m1b
 * @version 2023-01-01
 * @param {Object} options
 * @param {Number} options.angle - the rotation angle in degrees.
 * @param {Array<BezPoint>|Array<Array<BezPoint>>} [options.paths] - the points to rotate, can be nested by paths (default: the bez's points).
 * @param {BezTransformPositionType} [options.transformPositionType] - a transformPositionType (default: undefined).
 * @param {BezRotationType} [options.rotationType] - (default: BezRotationType.NORMAL).
 * @param {Number} [options.angleOffset] - an additional rotation (default: 0).
 * @param {Array<Number>} [options.transformPoint] - the point to transform from (default: bez's transformPoint or undefined).
 * @param {Function} [options.angleFunction] - a function, given the point, that modifies the angle for each point (default: undefined).
 * @param {Function} [options.filterFunction] - a function, given the point, that decides whether to rotate the point (default: undefined).
 * @param {Boolean} [option.selectedPointsOnly] - whether to rotate only the selected points (default: false).
 * @param {Boolean} [options.redraw] - whether to redraw the bez (default: true).
 * @param {Boolean} [options.updateAbsoluteRotation] - whether to update the bez's absoluteRotation value (default: true when all points are rotated).
*/
Bez.prototype.rotate = function rotate(options) {

    options = options || {};

    var self = this,
        angle = Number(options.angle),
        points = options.paths || self.paths,
        transformPositionType = options.transformPositionType,
        rotationType = options.rotationType || BezRotationType.NORMAL,
        angleOffset = Number(options.angleOffset || 0),
        transformPoint = options.transformPoint,
        angleFunction = options.angleFunction,
        filterFunction = options.filterFunction,
        selectedPointsOnly = options.selectedPointsOnly === true,
        redraw = options.redraw !== false,
        isSelected = self.pageItem && self.pageItem.selected == true,
        updateAbsoluteRotationAngle = options.updateAbsoluteRotation !== false,
        absoluteRotationAngle,
        tp = transformPoint;

    if (
        angle == undefined
        || isNaN(angle)
    )
        throw Error('Bez.prototype.rotate failed: bad `angle` supplied. (' + angle + ')');

    // get transformation point
    var tp = self.getCoordinatesOfTransformPoint(options);

    if (
        tp == undefined
        || tp.constructor.name != 'Array'
        || tp.length !== 2
    )
        throw Error('Bez.prototype.rotate failed: could not determine `transformPoint`. (' + transformPoint + ')');

    // $/*debug*/.writeln('angle = ' + angle);

    if (rotationType == BezRotationType.FROM_DATUM) {
        var d = self.getRotationDatum();
        angle += d - (d - self.rotationOffsetFromDatum || 0);
    }

    // rotate the points

    pathsLoop:
    for (var i = 0; i < points.length; i++) {

        var newPoints = [];

        pointsLoop:
        for (var j = 0; j < points[i].length; j++) {

            var p = points[i][j],
                skipThisPoint = false;

            if (
                selectedPointsOnly
                && p.pathPoint != undefined
                && p.pathPoint.selected !== PathPointSelection.ANCHORPOINT
            )
                // segment wasn't selected
                skipThisPoint = true;

            if (
                filterFunction != undefined
                && filterFunction(p) == false
            )
                // segment failed the filter function
                skipThisPoint = true;

            if (skipThisPoint) {
                // just add the original point back in
                newPoints.push(p);
                updateAbsoluteRotationAngle = false;
                continue pointsLoop;
            }

            var a = angle;
            if (angleFunction != undefined)
                a = angleFunction(p, a + angleOffset);


            // rotate the point
            newPoints.push(p.rotate(tp, a));

            // keep track of the absolute rotation (if applicable)
            if (absoluteRotationAngle == undefined)
                absoluteRotationAngle = a;

            if (
                updateAbsoluteRotationAngle == true
                && absoluteRotationAngle != a
            )
                updateAbsoluteRotationAngle = false;

        }

        // update the points
        self.paths[i] = newPoints;

    }

    if (
        updateAbsoluteRotationAngle == true
        && absoluteRotationAngle != undefined
    )
        self.absoluteRotationAngle = absoluteRotationAngle;

    if (redraw)
        self.draw({ select: isSelected });

};


/**
 * Rotate the bez absolutely.
 * @author m1b
 * @version 2023-01-03
 * @param {Object} options
 * @param {Number} angle - the absolute rotation angle in degrees.
 * @param {Array<BezPoint>|Array<Array<BezPoint>>} [points] - the points to rotate, can be nested by paths (default: the bez's points).
 * @param {BezTransformPositionType} [transformPositionType] - a transformPositionType (default: BezTransformPositionType.CENTER).
 * @param {Boolean} [rotationType] - (default: BezRotationType.NORMAL).
 * @param {Number} [angleOffset] - an additional rotation (default: 0).
 * @param {Array<Number>} [transformPoint] - (default: bez.transformPoint)
 * @param {Function} [options.angleFunction] - a function, given the point, that modifies the angle for each point (default: undefined).
 * @param {Function} [options.filterFunction] - a function, given the point, that decides whether to rotate the point (default: undefined).
 * @param {Boolean} [options.redraw] - whether to redraw the bez (default: true).
*/
Bez.prototype.setAngle = function setAngle(options) {

    var self = this;

    options = options || {};
    options.selectedPointsOnly = false;
    options.updateAbsoluteRotation = true;
    options.rotationType = BezRotationType.FROM_DATUM;

    self.rotate(options);

};


/**
 * Returns an angle derived from the
 * bez's geometry.
 * @author m1b
 * @version 2023-01-03
 * @param {Boolean} reverse -
 * @param {Number} pathIndex -
 */
Bez.prototype.getRotationDatum = function getRotationDatum(reverse, pathIndex) {

    var self = this;

    pathIndex = pathIndex || self.paths.length - 1;

    var points = self.paths[pathIndex],
        closed = self.pathsClosed[pathIndex],
        p1, p2;

    if (reverse === true && closed) {
        // closed path, use the last and first points
        p1 = points[points.length - 1];
        p2 = points[0]
    }
    else if (reverse === true) {
        // open path, use the last two points
        p1 = points[points.length - 2];
        p2 = points[points.length - 1]
    }
    else {
        p1 = points[0];
        p2 = points[1]
    }

    return Bez.getAngleOfPointP1(p1, p2, false, reverse);

}



/**
 * Scale the bez's points.
 * @author m1b
 * @version 2023-01-01
 * @param {Object} options
 * @param {Number|Array<Number>} [options.scaleFactor] - the scaleFactor, where 1 means no scaling (default: undefined).
 * @param {Array<Number>} [options.box] - a bounding box [L, T, R, B] for size-fitting purposes (default: undefined).
 * @param {Array<BezPoint>|Array<Array<BezPoint>>} [options.paths] - the points to rotate, can be nested (default: the bez's points).
 * @param {BezTransformPositionType} [options.transformPositionType] - a transformPositionType (default: BezTransformPositionType.CENTER).
 * @param {BezScaleType} [options.scaleType] - the type of scaling (default: BezScaleType.SCALE_BY_FACTOR).
 * @param {Array<Number>} [options.transformPoint] - the point from which the transform is performed (default: undefined)
 * @param {Number} [options.scaleFactorOffset] - an additional scaleFactor (default: 1).
 * @param {Number} [options.boxFittingStrokeWidth] - the strokeWidth to accommodate when box fitting (default: 0).
 * @param {Function} [options.scaleFunction] - a function, given a point, that modifies the scaleFactor for each point (default: undefined).
 * @param {Function} [options.filterFunction] - a function, given a point, that decides whether to scale the point (default: undefined).
 * @param {Boolean} [options.selectedPointsOnly] - whether to scale only the selected points (default: false).
 * @param {Boolean} [options.redraw] - whether to redraw the bez (default: true).
 */
Bez.prototype.scale = function scale(options) {

    options = options || {};

    var self = this,
        scaleFactor = options.scaleFactor,
        points = options.paths || self.paths,
        transformPositionType = options.transformPositionType || BezTransformPositionType.CENTER,
        scaleType = options.scaleType || BezScaleType.SCALE_BY_FACTOR,
        scaleFactorOffset = options.scaleFactorOffset || [1, 1],
        transformPoint = options.transformPoint,
        box = options.box,
        boxFittingStrokeWidth = options.boxFittingStrokeWidth,
        scaleFunction = options.scaleFunction,
        filterFunction = options.filterFunction,
        selectedPointsOnly = options.selectedPointsOnly === true,
        redraw = options.redraw !== false,
        isSelected = self.pageItem && self.pageItem.selected == true,
        bounds = self.getBounds(),
        isBoxTypeScaling = (
            scaleType == BezScaleType.FIT_BOX
            || scaleType == BezScaleType.FILL_BOX
            || scaleType == BezScaleType.STRETCH
        );

    if (
        isBoxTypeScaling
        && box == undefined
    )
        throw Error('Bez.prototype.scale failed: no `box` supplied for box fitting.');

    // get transformation point
    var tp = self.getCoordinatesOfTransformPoint(options);

    if (
        tp == undefined
        || tp.constructor.name != 'Array'
        || tp.length !== 2
    )
        throw Error('Bez.prototype.scale failed: could not determine `tp`.');

    if (isBoxTypeScaling)
        scaleFactor = getScaleFactorForBoxFitting(scaleType, bounds, box, boxFittingStrokeWidth);

    if (scaleFactor == undefined)
        throw Error('Bez.prototype.scale failed: could not determine `scaleFactor`.');

    // scale the points

    pathsLoop:
    for (var i = 0; i < points.length; i++) {

        var newPoints = [];

        pointsLoop:
        for (var j = 0; j < points[i].length; j++) {

            var p = points[i][j],
                skipThisPoint = false;

            if (
                selectedPointsOnly
                && p.pathPoint != undefined
                && p.pathPoint.selected !== PathPointSelection.ANCHORPOINT
            )
                // segment wasn't selected
                skipThisPoint = true;

            if (
                filterFunction != undefined
                && filterFunction(p) == false
            )
                // segment failed the filter function
                skipThisPoint = true;

            if (skipThisPoint) {
                // just add the original point back in
                newPoints.push(p);
                continue pointsLoop;
            }

            if (scaleFactor.constructor.name == 'Number')
                scaleFactor = [scaleFactor, scaleFactor];

            if (scaleFactorOffset.constructor.name == 'Number')
                scaleFactorOffset = [scaleFactorOffset, scaleFactorOffset];

            var s = [scaleFactor[0] * scaleFactorOffset[0], scaleFactor[1] * scaleFactorOffset[1]];
            if (scaleFunction != undefined)
                s = scaleFunction(p, s);

            // sanity
            if (s.constructor.name != 'Array'
                || s.length !== 2
            )
                throw Error('Bez.prototype.scale failed: bad value for `s`.');

            // scale the point
            newPoints.push(p.scale(tp, s));

        }

        // update the points
        self.paths[i] = newPoints;

    }

    if (redraw)
        self.draw({ select: isSelected });

};


/**
 * Translates the bez's points,
 * with aligning functionality.
 * @author m1b
 * @version 2023-01-01
 *
 * Call this method in any of three ways:
 *
 * (a) Simple translation
 *     @example
 *       bez.translate({ translation: [10, -20] });
 *
 * (b) Align with transformPositionType
 *     This example will align the bez's bottom
 *     to the bottom of the supplied box.
 *     @example
 *       bez.translate({
 *         transformPositionType: BezTransformPositionType.BOTTOM,
 *         alignToBox: somePageItem.geometricBounds
 *       });
 *
 * (c) Align points
 *     This example will align the bez's first point
 *     with a PathItem's first point.
 *     @example
 *       bez.translate({
 *         alignMyPoint: bez.paths[0][0].anchor,
 *         alignToPoint: somePathItem.pathPoints[0].anchor,
 *       });
 *
 *     You can use Bez.getCoordinatesOf to get points.
 *     This exampe will align the bez's top left, with
 *     the page item's top right:
 *     @example
 *       bez.translate({
 *         alignMyPoint: bez.getCoordinatesOf(BezTransformPositionType.TOP_LEFT),
 *         alignToPoint: Bez.getCoordinatesOf(BezTransformPositionType.TOP_RIGHT, somePageItem.geometricBounds)
 *       });
 *     (Note the important difference between bez and Bez
 *     in the last example: getCoordinatesOf
 *     is both a method of the instance bez, as well as a
 *     method of the class Bez. The instance method will use
 *     the instance's own bounds, whereas the class method
 *     will fail if no bounds are supplied.)
 *
 * @param {Object} options
 * @param {Number|Array<Number>} [options.translation] - the translation [tz, ty] (default: undefined).
 * @param {Array<BezPoint>|Array<Array<BezPoint>>} [options.paths] - the points to rotate, can be nested (default: the bez's points).
 * @param {BezTransformPositionType} [options.transformPositionType] - a transformPositionType (default: undefined).
 * @param {Array<Number>} [options.alignMyPoint] - a point on the bez to align from (default: undefined).
 * @param {Array<Number>} [options.alignToPoint] - a point to align to (default: undefined).
 * @param {Array<Number>} [options.alignToBox] - a bounding box [L, T, R, B] for size-fitting purposes (default: undefined).
 * @param {Number} [options.translationOffset] - an additional translation (default: [0, 0]).
 * @param {Function} [options.translateFunction] - a function, given a point, that modifies the scaleFactor for each point (default: undefined).
 * @param {Function} [options.filterFunction] - a function, given a point, that decides whether to scale the point (default: undefined).
 * @param {Boolean} [options.selectedPointsOnly] - whether to translate only the selected points (default: false).
 * @param {Boolean} [options.redraw] - whether to redraw the bez (default: true).
 */
Bez.prototype.translate = function translate(options) {

    options = options || {};

    var self = this,
        translation = options.translation,
        points = options.paths || self.paths,
        transformPositionType = options.transformPositionType,
        alignMyPoint = options.alignMyPoint,
        alignToPoint = options.alignToPoint,
        alignToBox = options.alignToBox,
        translationOffset = options.translationOffset || [0, 0],
        translateFunction = options.translateFunction,
        filterFunction = options.filterFunction,
        selectedPointsOnly = options.selectedPointsOnly === true,
        redraw = options.redraw !== false,
        isSelected = self.pageItem && self.pageItem.selected == true,
        myBounds = self.getBounds(),
        bounds = transformPositionType != undefined ? myBounds : undefined;

    if (
        alignMyPoint != undefined
        && alignToPoint == undefined
    )
        throw Error('Bez.prototype.translate failed: no `alignToPoint` given with `alignMyPoint`.');

    if (
        transformPositionType != undefined
        && alignToBox == undefined
    )
        throw Error('Bez.prototype.translate failed: no `alignToBox` given with `transformPositionType`.');

    if (transformPositionType != undefined) {
        alignMyPoint = Bez.getCoordinatesOfgetCoordinatesOfTransformPosition(transformPositionType, bounds);
        alignToPoint = Bez.getCoordinatesOfgetCoordinatesOfTransformPosition(transformPositionType, alignToBox);
        translation = differenceBetweenPoints(alignToPoint, alignMyPoint);
    }

    else if (
        alignMyPoint != undefined
        && alignToPoint != undefined
    ) {

        if (alignToPoint.hasOwnProperty('anchor'))
            alignToPoint = alignToPoint.anchor;

        if (alignMyPoint.hasOwnProperty('anchor'))
            alignMyPoint = alignMyPoint.anchor;

        if (alignToPoint.constructor.name == 'String')
            alignToPoint = Bez.getCoordinatesOfgetCoordinatesOfTransformPosition(alignToPoint, alignToBox);

        if (alignMyPoint.constructor.name == 'String')
            alignMyPoint = Bez.getCoordinatesOfgetCoordinatesOfTransformPosition(alignMyPoint, myBounds);

        translation = differenceBetweenPoints(alignToPoint, alignMyPoint);
    }

    if (
        translation == undefined
        || translation.constructor.name != 'Array'
        || translation.length !== 2
    )
        throw Error('Bez.prototype.translate failed: could not determine `translation`.');

    // translate the points

    pathsLoop:
    for (var i = 0; i < points.length; i++) {

        var newPoints = [];

        pointsLoop:
        for (var j = 0; j < points[i].length; j++) {

            var p = points[i][j],
                skipThisPoint = false;

            if (
                selectedPointsOnly
                && p.pathPoint != undefined
                && p.pathPoint.selected !== PathPointSelection.ANCHORPOINT
            )
                // segment wasn't selected
                skipThisPoint = true;

            if (
                filterFunction != undefined
                && filterFunction(p) == false
            )
                // segment failed the filter function
                skipThisPoint = true;

            if (skipThisPoint) {
                // just add the original point back in
                newPoints.push(p);
                continue pointsLoop;
            }

            var tr = [translation[0] + translationOffset[0], translation[1] + translationOffset[1]];
            if (translateFunction != undefined)
                tr = translateFunction(p, tr);

            // last check
            if (tr.constructor.name != 'Array'
                || tr.length !== 2
            )
                throw Error('Bez.prototype.translate failed: bad value for `tr`.');

            // translate the point
            newPoints.push(p.translate(tr));

        }

        // update the points
        self.paths[i] = newPoints;

    }

    if (redraw)
        self.draw({ select: isSelected });

};




/**
 * Returns true when the segment p1,p2 is a straight line.
 * @param {BezPoint|PathPoint} p1 - first point of segment.
 * @param {BezPoint|PathPoint} p2 - second point of segment.
 * @returns {Boolean}
 */
Bez.isStraightLineSegment = function isStraightLineSegment(p1, p2) {

    var d1 = distanceBetweenPoints(p1.rightDirection, p1.anchor),
        d2 = distanceBetweenPoints(p2.leftDirection, p2.anchor);

    return (
        Math.abs(d1) == 0
        && Math.abs(d2) == 0
    );

};


/**
 * Returns true when the segment p1,p2 is a curved segment.
 * @param {BezPoint|PathPoint} p1 - first point of segment.
 * @param {BezPoint|PathPoint} p2 - second point of segment.
 * @returns {Boolean}
 */
Bez.isCurvedSegment = function isCurvedSegment(p1, p2) {

    return !Bez.isStraightLineSegment(p1, p2);

};


/**
 * Returns true when the segment p1p2 is selected.
 * Important! Does not check if pathPoints exist.
 * @param {BezPoint} p1 - a BezPoint with a pathPoint.
 * @param {BezPoint} p2 - a BezPoint with a pathPoint.
 * @returns {Boolean}
 */
Bez.segmentIsSelected = function bezSegmentIsSelected(p1, p2) {

    return !(
        (
            p1.pathPoint.selected == PathPointSelection.LEFTDIRECTION
            || p1.pathPoint.selected == PathPointSelection.NOSELECTION
        )
        && (
            p2.pathPoint.selected == PathPointSelection.RIGHTDIRECTION
            || p2.pathPoint.selected == PathPointSelection.NOSELECTION
        )
    );

};


/**
 * Returns the details of the smallest distance between
 * this bez and the supplied bez.
 * @param {Bez} bez - the Bez to measure from.
 * @returns {Object} - { p1: p2: distance: closePoint1: closePoint2: }
 */
Bez.prototype.smallestDistanceFrom = function smallestDistanceFrom(bez) {

    var self = this;

    // var closest = {
    //     distance: Infinity,
    //     point: undefined,
    //     pathIndex: undefined,
    //     pointIndex: undefined
    // }
    // for (i = 0; i < self.paths.length; i++)
    //     for (j = 0; j < self.paths[i].length; j++) {
    //         var p1 = self.paths[i][j],
    //             d = distanceBetweenPoints(p, p1.anchor);
    //         if (d < closest.distance) {
    //             closest.distance = d;
    //             closest.point = p1;
    //             closest.pathIndex = i;
    //             closest.pointIndex = j;
    //         }
    //     }




    return closest;

};


/**
 * Sort a paths/points array.
 * The `points` parameter can be
 * either a normal paths/points
 * nested array, or just a single
 * path's points array.
 * @author m1b
 * @version 2023-01-05
 * Handles BezSortType.SORT_X and
 * BezSortType.SORT_Y sorts.
 * @param {Array<Array<BezPoint>>} points - a paths/points array.
 * @param {BezSortType} sortType - the type of sort.
 * @param {Array<Array<BezPoint>>} - the sorted points array.
 */
Bez.sortPointsByXOrY = function sortPointsByXOrY(points, sortType) {

    var sorted = [],
        pathSorter,
        pointSorter,
        axis = sortType == BezSortType.SORT_X ? 0 : 1;

    pathSorter = function (a, b) { return a[0].anchor[axis] - b[0].anchor[axis] };
    pointSorter = function (a, b) { return a.anchor[axis] - b.anchor[axis] };

    // sort each path
    for (var i = 0; i < points.length; i++) {
        sorted[i] = points[i].slice();
        sorted[i].sort(pointSorter);
    }

    sorted.sort(pathSorter);

    return sorted;

};


/**
 * Sort a paths/points array by
 * distance from the given `point`.
 * The `points` parameter can be
 * either a normal paths/points
 * nested array, or just a single
 * path's points array.
 * @author m1b
 * @version 2023-01-05
 * @param {Array<Array<BezPoint>>} points - a paths/points array.
 * @param {BezPoint|PathPoint|Array<Number>} point - the point to measure from.
 * @param {Array<Array<BezPoint>>} - the sorted points array.
 */
Bez.sortPointsByDistanceFromPoint = function sortPointsByDistanceFromPoint(points, point) {

    var sorted = [],
        pathSorter,
        pointSorter,
        addDistance,

        // the points might be paths/points or just points only
        pointsAreBezPoints = points[0][0].hasOwnProperty('anchor');

    if (point.hasOwnProperty('anchor'))
        point = point.anchor;

    pathSorter = function (a, b) { return a[0].distance - b[0].distance };
    pointSorter = function (a, b) { return a.distance - b.distance };

    // how to add the distance property to each point
    addDistance = pointsAreBezPoints
        ? function (p1, p2) { p1.distance = distanceBetweenPoints(p1.anchor, p2) }
        : function (p1, p2) { p1.distance = distanceBetweenPoints(p1, p2) };

    // calculate distances
    for (var i = 0; i < points.length; i++) {

        sorted[i] = points[i].slice();

        for (var j = 0; j < sorted[i].length; j++)
            addDistance(sorted[i][j], point);

        // sort the points
        sorted[i].sort(pointSorter);

    }

    // sort the paths
    sorted.sort(pathSorter);

    return sorted;

};


/**
 * Draws and returns a circle Bez.
 * @param {Document} doc - an Illustrator Document.
 * @param {Array<Number>} c - center of circle [x, y].
 * @param {Number} radius - radius of circle.
 * @param {Function} [styleFunction] - a function, given circle, styles circle.pageItem (default: undefined).
 * @returns {Bez}
 */
Bez.drawCircle = function bezDrawCircle(doc, center, radius, appearance) {

    if (center.hasOwnProperty('anchor'))
        center = center.anchor;

    var circle = new Bez({
        doc: doc,
        paths: [Bez.circlePoints(center, radius)],
        pathsClosed: [true],
        appearance: appearance
    });

    circle.draw();

    return circle;

};


/**
 * Draws and returns a circle Bez.
 * @param {Document} doc - an Illustrator Document.
 * @param {Array<Number>} c - center of circle [x, y].
 * @param {Number} radius - radius of circle.
 * @param {Function} [styleFunction] - a function, given circle, styles circle.pageItem (default: undefined).
 * @returns {Bez}
 */
Bez.drawSquare = function bezDrawSquare(doc, center, sideLength, appearance) {

    if (center.hasOwnProperty('anchor'))
        center = center.anchor;

    var square = new Bez({
        doc: doc,
        paths: [Bez.squarePoints(center, sideLength)],
        pathsClosed: [true],
        appearance: appearance
    });

    square.draw();

    return square;

};


/**
 * Returns array of BezPoints
 * constituting a circle;
 * @param {Array<Number>} center - center of circle [x, y].
 * @param {Number} radius - radius of circle.
 * @returns {Array<BezPoint>}
 */
Bez.circlePoints = function bezCirclePoints(center, radius) {

    var x = center[0],
        y = center[1],
        control = radius * 0.5522847498,
        points = [
            new BezPoint({
                anchor: [radius + x, y],
                leftDirection: [radius + x, control + y],
                rightDirection: [radius + x, -control + y],
                pointType: PointType.SMOOTH
            }),
            new BezPoint({
                anchor: [x, -radius + y],
                leftDirection: [control + x, -radius + y],
                rightDirection: [-control + x, -radius + y],
                pointType: PointType.SMOOTH
            }),
            new BezPoint({
                anchor: [-radius + x, y],
                leftDirection: [-radius + x, -control + y],
                rightDirection: [-radius + x, control + y],
                pointType: PointType.SMOOTH
            }),
            new BezPoint({
                anchor: [x, radius + y],
                leftDirection: [-control + x, radius + y],
                rightDirection: [control + x, radius + y],
                pointType: PointType.SMOOTH
            }),
        ];

    return points;

};


/**
 * Returns array of BezPoints
 * constituting a circle;
 * @param {Array<Number>} center - center of circle [x, y].
 * @param {Number} size - radius of circle.
 * @returns {Array<BezPoint>}
 */
Bez.squarePoints = function bezSquarePoints(center, sideLength) {

    var x = center[0],
        y = center[1],
        size = sideLength / 2,
        points = [
            new BezPoint({ anchor: [-size + x, size + y] }),
            new BezPoint({ anchor: [-size + x, -size + y] }),
            new BezPoint({ anchor: [size + x, -size + y] }),
            new BezPoint({ anchor: [size + x, size + y] }),
        ];

    return points;

};


/**
* Adds new points at extrema of paths.
* @author m1b
* @version 2023-01-01
* @param {Object} options
* @param {Boolean} [options.selectedSegmentsOnly] - whether to apply to just the selected segments (default: true).
*/
Bez.prototype.addExtrema = function addExtrema(options) {

    options = options || {};

    var self = this;

    self.paths = Bez.addExtrema({
        paths: self.paths,
        pathsClosed: self.pathsClosed,
        selectedSegmentsOnly: options.selectedSegmentsOnly !== false
    });

    self.draw({ select: true });

};


/**
 * Adds new points at extrema of paths.
 * @author m1b
 * @version 2023-01-01
 * @param {Object} options
 * @param {Array<Array<BezPoint>>} options.paths - the paths/points array.
 * @param {Array<Boolean>} options.pathsClosed - array showing which paths are closed.
 * @param {Boolean} [options.selectedSegmentsOnly] - whether to apply to just the selected segments (default: true).
 * @returns {Array<Array<BezPoints>>} - the paths array, with extrema added.
 */
Bez.addExtrema = function addExtrema(options) {

    options = options || {};

    var paths = Bez.copyPaths(options.paths),
        pathsClosed = options.pathsClosed,
        selectedSegmentsOnly = options.selectedSegmentsOnly !== false,
        results = [];

    pathsLoop:
    for (var i = 0; i < paths.length; i++) {

        var points = paths[i],
            closed = pathsClosed[i],
            newPoints = [],
            pointsCount = points.length;

        if (points.length < 2)
            continue;

        pointsLoop:
        for (var j = 0; j < pointsCount; j++) {

            var closeMeNow = closed && j == pointsCount - 1,
                index1 = j,
                index2 = closeMeNow ? 0 : j + 1,
                p1 = points[index1],
                p2 = points[index2];

            if (p2 == undefined) {
                // finish up an open path
                newPoints.push(p1);
                break;
            }

            if (
                selectedSegmentsOnly
                && p1.pathPoint != undefined
                && (
                    p1.pathPoint.selected == PathPointSelection.NOSELECTION
                    || p2.pathPoint.selected == PathPointSelection.NOSELECTION
                )
            ) {

                // segment wasn't selected
                // so just add point as is
                newPoints.push(p1);
                continue pointsLoop;

            }

            // get tValues of extrema
            var tValues = Bez.getExtremaOfCurve(p1, p2);

            if (tValues.length == 0) {

                // no extrema, so just add existing point back in
                newPoints.push(p1);
                continue pointsLoop;

            }

            // get the split points
            var splitPoints = Bez.splitSegment(p1, p2, tValues);

            // replace p1 and p2 with the adjusted p1 and p2
            points[index1] = splitPoints[0];
            points[index2] = splitPoints[splitPoints.length - 1];

            // add the split points to the new points
            newPoints = newPoints.concat(splitPoints);

            // remove the last splitpoint (adjusted p2)
            newPoints.pop();

            if (closeMeNow)
                newPoints[0].leftDirection = splitPoints[splitPoints.length - 1].leftDirection;

        }

        results[i] = newPoints;

    }

    return results;

};


/**
 * Selects the bez's pathItem.
 * @author m1b
 * @version 2023-03-25
 */
Bez.prototype.select = function select() {

    var self = this;

    if (self.pageItem)
        self.pageItem.selected = true;

};


/**
 * Deselects the bez's pathItem.
 * @author m1b
 * @version 2023-01-05
 */
Bez.prototype.deselect = function deselect() {

    var self = this;
    if (self.pageItem)
        self.pageItem.selected = false;

};


/**
 * Returns string representation of the Bez.
 * @author m1b
 * @version 2022-05-23
 * @returns {String}
 */
Bez.prototype.toString = function bezToString() {

    return '[Bez: ' + this.paths.length + ' paths]';

};


/**
 * Converts a simple polygon array to an array of BezPoints.
 * @param {Array<Array<point>>} poly - an array of [x, y] points.
 * @return {Array<BezPoint>}
 */
Bez.convertToPaths = function convertToPaths(poly) {

    // handle multiple paths
    if (
        'Array' === poly[0].constructor.name
        && poly[0].length > 0
        && 'Array' === poly[0][0].constructor.name
    ) {

        var paths = [];

        for (var i = 0; i < poly.length; i++)
            paths.push(Bez.convertToPaths(poly[i]))

        return paths;

    }

    var path = [];

    for (var i = 0; i < poly.length; i++)
        if (undefined != poly[i])
            path.push(new BezPoint(poly[i]));

    return path;

};


/**
 * desc
 * @date 2023-02-08
 * @param {Bez} bez
 * @param {Object} options
 * @param {Boolean} [ignoreAngles] - whether to ignore the angle elements of hash (default: false).
 * @param {Boolean} [ignoreLengths] - whether to ignore the length elements of hash (default: false).
 * @param {Boolean} [ignoreElementCount] - whether to ignore differences in element count of the hashes (default: true).
 */
Bez.prototype.getSimilarityTo = function getSimilarityTo(bez, options) {

    options = options || {};

    if ('Bez' !== bez.constructor.name)
        bez = new Bez({ pageItem: bez });

    var self = this,
        ignoreElementCount = options.ignoreElementCount !== false,
        ignoreAngles = options.ignoreAngles === true,
        ignoreLengths = options.ignoreLengths === true,

        hash1 = self.hash || self.makeHash(),
        hash2 = bez.hash || bez.makeHash();

    if (
        !ignoreElementCount
        && hash1.length !== hash2.length
    )
        // if the element count doesn't match, reject similarity
        return 0;

    if (
        ignoreAngles
        && ignoreLengths
    )
        return 1;

    var start = ignoreAngles ? 1 : 0,
        inc = ignoreAngles || ignoreLengths ? 2 : 1;

    // $/*debug*/.writeln('start = ' + start);
    // $/*debug*/.writeln('inc = ' + inc);

    return compareArraysWithDifference(hash1, hash2, start, inc)

};


/**
 * Calculates and adds to each point:
 *   `angle` - angle of point B in ABC.
 * @author m1b
 * @version 2023-03-20
 */
Bez.prototype.calculateAngles = function calculateAngles() {

    var self = this;

    for (var i = 0; i < self.paths.length; i++) {

        var points = self.paths[i],
            pointCount = points.length,
            closed = self.pathsClosed[i];

        pointsLoop:
        for (var j = 0; j < pointCount; j++) {

            if (
                (j == 0 && closed != true)
                || (j == pointCount - 1 && closed != true)
            )
                continue pointsLoop;

            var isFirstPoint = (j == 0),
                isLastPoint = (j == points.length - 1);

            // get three points to make angle
            var p0 = isFirstPoint ? points[pointCount - 1] : points[j - 1],
                p1 = points[j],
                p2 = isLastPoint ? points[0] : points[j + 1];

            var a = [p1.leftDirection[0], p1.leftDirection[1]],
                b = [p1.anchor[0], p1.anchor[1]],
                c = [p1.rightDirection[0], p1.rightDirection[1]];

            // if straight lines, ignore direction points
            if (pointsAreEqual(a, b))
                a = [p0.anchor[0], p0.anchor[1]];
            if (pointsAreEqual(b, c))
                c = [p2.anchor[0], p2.anchor[1]];

            // calculate angle
            p1.angle = (getAngleABC(a, b, c));

        }

    }

};


/**
 * Calculates and adds to each point:
 *   `length` - length of segment.
 *   `pathOffset` - the distance from start of path.
 * @author m1b
 * @version 2023-03-20
 */
Bez.prototype.calculateLengthsAndPathOffsets = function calculateLengthsAndPathOffset() {

    var self = this,
        paths = self.paths;

    self.pathsLengths = [];

    pathsLoop:
    for (var i = 0; i < paths.length; i++) {

        var points = self.paths[i],
            closed = self.pathsClosed[i],
            pathLength = 0,
            p1 = points[0],
            p2;

        pointsLoop:
        for (var j = 1; j < points.length; j++) {

            p1 = points[j - 1]
            p2 = points[j];

            // calculate length of this segment
            p1.length = Bez.getSegmentLength(p1, p2);
            // the distance from start of path
            p1.pathOffset = pathLength;
            // running total of length of path
            pathLength += p1.length;

            if (j == points.length - 1) {

                // update the last point
                p2.pathOffset = pathLength;
                p2.sectionEnd = true;

            }

        }

        if (closed) {
            // add the final length and pathOffset to the first point
            p2.length = Bez.getSegmentLength(p2, points[0]);
            pathLength += p2.length;
            points[0].pathLength = pathLength;
        }

        else
            points[0].pathLength = pathLength;


        self.pathsLengths[i] = pathLength;

    }

};


/**
 * Converts item to individual dashes.
 * Notes: the `filterFunction` is a function
 * that takes the index of the current outputted
 * dash path item and returns true to draw it,
 * or false to not draw it. So
 * @author m1b
 * @version 2023-03-31
 * @param {Object} options
 * @param {PathItem} options.pathItem - an Illustrator PathItem.
 * @param {Document} [options.doc] - an Illustrator Document.
 * @param {Array<Number>} [options.pattern] - array of dash|gap lengths (default: item.strokeDashes).
 * @param {Number} [options.pathIndex] - the index to the path to convert (default: 0).
 * @param {Function} [options.filterFunction] - a function to determine whether to keep or remove an individual dash path. (default: removeGaps).
 * @param {Boolean} [options.alignDashes] - if true, align dashes to corners (default: item's setting).
 * @param {Document|GroupItem|Layer} [options.container] - Layer to place dashes (default: the pathItem's document).
 * @return {Boolean} - success; if false, means item wasn't converted.
 */
Bez.convertPathItemToDashes = function bezConvertPathItemToDashes(options) {

    if (Dasher == undefined)
        throw Error('Bez.convertPathItemToDashes: Missing dependency "Dasher.js".');

    var item = options.pathItem,
        pattern = options.pattern || item.strokeDashes,
        pathIndex = options.pathIndex || 0,
        doc = options.doc || getParentDocument(item),

        // new points will not be created
        // if this close to an existing point
        tolerance = 0.001;

    if (item == undefined)
        throw Error('convertPathItemToDashes failed: bad `item` parameter.');

    if (
        pattern == undefined
        || pattern.constructor.name !== 'Array'
        || pattern.length == 0
    ) {
        alert('Item has no dash pattern, or no dash pattern was supplied.');
        // throw Error('convertPathItemToDashes failed: bad `pattern` parameter.');
        return false;
    }

    // get dash alignment
    // note: the `strokeDashesAreAligned` function is a *hack*
    // so it is recommended to always specify options.alignDashes
    var alignDashes = (options.alignDashes == undefined)
        ? strokeDashesAreAligned(item, false)
        : options.alignDashes;

    var bez = new Bez({ pageItem: item }),
        points = bez.paths[pathIndex].slice(),
        closed = bez.pathsClosed[pathIndex],
        closingPoint;

    if (closed) {
        // add a closing point
        closingPoint = new BezPoint(points[0]);
        points.push(closingPoint);
    }

    /*
        Prepare points: give each point
        a `length`, and `pathOffset` property.
    */

    bez.calculateLengthsAndPathOffsets();

    if (alignDashes) {

        /*
            Prepare points: add `sectionEnd` property
            to match Illustrator's dash alignment method
            and add `sectionLength` property, which
            is the length between dash corners.
        */

        // dash alignment corners are based on angles
        bez.calculateAngles()

        var pathLength = bez.pathsLengths[pathIndex],
            sectionLength = pathLength,
            dashCornerCount = 0;

        // mark the dash alignment corners
        for (var i = points.length - 1; i >= 0; i--) {

            var currentPoint = points[i];

            if (
                BezPoint.checkForDashCornerPoint(currentPoint)
                || (closed == false && i == 0)
            ) {
                currentPoint.sectionEnd = true;
                currentPoint.sectionLength = sectionLength - currentPoint.pathOffset;
                dashCornerCount++;
                sectionLength = currentPoint.pathOffset;
            }

        }

    }

    // closed, non-cornered paths don't split
    // the first dash between start and end
    // (this is used as parameter to Dasher.alignedPatternForLength)
    var isClosedWithNoDashCorners = (
        alignDashes == true
        && item.closed == true
        && dashCornerCount == 0
    );

    /*
        Calculate all dash lengths and add them
        to `cutLengths` property of each point where
        sectionEnd == true.
    */
    var /*points = bez.paths[pathIndex],*/
        startPoint = points[0],
        currentPoint,
        sectionLength,

        // make a Dasher to handle the pattern fitting
        dasher = new Dasher(pattern);

    if (dasher == undefined)
        throw Error('Could not make Dasher with [' + pattern + '].');

    if (isClosedWithNoDashCorners) {

        // special case, a closed path with no dash alignment corners,
        // example: an Illustrator circle with 4 points each with 180° angle
        startPoint.sectionLength = pathLength;
        startPoint.cutLengths = dasher.alignedPatternForLength(startPoint.sectionLength, true);

    }

    else {

        // assign dash lengths to first point in each "section"
        for (var i = 0; i < points.length; i++) {

            currentPoint = points[i];

            if (alignDashes == true) {

                // dashes are aligned

                if (currentPoint.sectionEnd == true) {
                    // get dash lengths for the length between dash corners
                    // this method aligns dashes with corners and scales
                    // dash|gaps to fit the section between corners
                    // attempting to match Illustrator's own method
                    currentPoint.cutLengths = dasher.alignedPatternForLength(currentPoint.sectionLength, false);
                }

            }

            else if (i == points.length - 1) {

                // dashes are not aligned
                // XXX Explr.init(points, 'look for sectionLength')
                // get dash lengths for the whole path
                // this method conserves actual dash|gap lengths
                var sectionLength = closed ? startPoint.pathLength : currentPoint.pathOffset;
                startPoint.cutLengths = dasher.basicPatternForLength(sectionLength);

            }

        }

    }

    // Explr.init(points, 'points before expandCutLengths');

    // special case where cutLength is too big for closed path
    // just return the whole path
    if (startPoint.cutLengths.length < 2) {
        if (closed)
            points.pop();
        return drawPaths([points], [true]);
    }

    var lastDashIsGap = startPoint.cutLengths.length % 2 == 0;
    // $/*debug*/.writeln('startPoint.cutLengths.length = ' + startPoint.cutLengths.length);
    // $/*debug*/.writeln('lastDashIsGap = ' + lastDashIsGap);

    /*
        Expand all cutLengths arrays into actual BezPoints
    */

    var newPoints = Bez.expandCutLengths(points, closed, true, tolerance);

    // Explr.init(newPoints, 'newPoints after expandCutLengths');

    // calculate the best point to start
    // and rotate the stack to it

    if (
        closed == true
        && !lastDashIsGap
        && pointsAreEqual(newPoints[0], newPoints[newPoints.length - 1])
    ) {
        // combine the closing point with the first point
        newPoints[0].leftDirection = newPoints.pop().leftDirection;
    }

    /*
        Arrange the points into paths individual paths
        ie. a path for each "dash".
    */

    var rotateToFindBestStartingPoint = closed && !lastDashIsGap;

    // if (
    //     // !isClosedWithNoDashCorners
    //     // && closed == true
    //     // && alignDashes == true
    //     !lastDashIsGap
    // ) {

    // rotate the stack so first dash
    // will be part of last dash
    if (rotateToFindBestStartingPoint) {

        // rotate stack until first item is a break
        var counter = newPoints.length;
        while (
            counter-- > 0
            && newPoints[0].break != true
        ) {
            newPoints.unshift(newPoints.pop());
        }
    }

    // Explr.init(newPoints, 'after rotation (lastDashIsGap = ' + lastDashIsGap + ') ' + item.polarity);

    var cutPaths = Bez.cutIntoPaths(newPoints, removeGaps);

    /*
        Draw the dash paths.
    */
    return drawPaths(cutPaths.paths, cutPaths.pathsClosed);

    /**
     * Draw the paths to Illustrator, configured
     * to remove fill and dash patterns.
     * @param {Array<Array<BezPoint>>} paths - nested array of points.
     * @param {Array<Boolean>} pathsClosed - corresponding array of booleans.
     * @returns {Array<PathItem>}
     */
    function drawPaths(paths, pathsClosed) {
        return Bez.draw({
            doc: doc,
            paths: paths,
            pathsClosed: pathsClosed,
            drawAsCompoundPathItem: options.drawAsCompoundPathItem === true,
            select: false,
            properties: {
                filled: false,
                stroked: true,
                strokeColor: item.strokeColor,
                strokeDashes: [],
                strokeCap: item.strokeCap,
                strokeJoin: item.strokeJoin,
                strokeMiterLimit: item.strokeMiterLimit,
                strokeOverprint: item.strokeOverprint,
                strokeWidth: item.strokeWidth
            }
        });

    }

    function removeGaps(index) { return (index % 2 === 0) };

};


/**
 * Expand points by creating new points according
 * to the `cutLengths` property of any point.
 * Using `ignoreLastLength`, the last cutLength
 * can be ignored, if desired, because it is
 * superfluous for some needs, eg. making dashs.
 * Note: it will be ignored in each section.
 * @param {Array<BezPoint>} points - a path of points to expand.
 * @param {Boolean} closed - whether the points represent a closed path.
 * @param {Boolean} [ignoreLastLength] - whether the omit the last cutLength (default: false).
 * @param {Number} [tolerance] - how close an expanded point can be to an existing point (default: 0.01 pt).
 * @returns {Array<BezPoint>} - the expanded points.
 */
Bez.expandCutLengths = function bezExpandCutLengths(points, closed, ignoreLastLength, tolerance, addPointsButDontCut) {

    tolerance = tolerance || 0.01;
    ignoreLastLength = ignoreLastLength === true;
    addPointsButDontCut = addPointsButDontCut === true;

    /*
        Distribute cutLengths to the correct segment
        and calculate tValues for each
    */

    var cutLengthsStack,
        remainder,
        advance,
        pointCount = points.length - 1;

    distribute:
    for (var i = 0; i < pointCount; i++) {

        var currentPoint = points[i],
            nextPoint = closed && i == points.length - 1 ? points[0] : points[i + 1];

        if (
            cutLengthsStack == undefined
            || cutLengthsStack.length == 0
        ) {

            if (
                currentPoint.cutLengths != undefined
                && currentPoint.cutLengths.length > 0
            ) {
                // load the new cutLengths to process
                cutLengthsStack = currentPoint.cutLengths.slice();

                if (ignoreLastLength)
                    cutLengthsStack.pop();

            }

            else
                // move on
                continue distribute;

        }

        var q = Bez.getQ(currentPoint, nextPoint),
            k = Bez.getK(q);

        currentPoint.segmentOffsets = [];
        currentPoint.tValues = [];
        remainder = currentPoint.length;
        advance = 0;

        // $/*debug*/.writeln('i = ' + i + '   segment length = ' + remainder);

        // add the offsets that fit in this segment
        addSegmentOffsets:
        while (
            cutLengthsStack.length
            && cutLengthsStack[0] <= remainder
        ) {

            var l = cutLengthsStack.shift();

            // if (l == 0) alert('"' + l + '" is zero!');

            remainder -= l;
            advance += l;
            // $/*debug*/.write('  L = ' + l + '  remainder = ' + remainder);

            // if remainder is tiny, it means the dash is too close to nextPoint
            if (
                remainder > tolerance
                && l > tolerance
            ) {
                currentPoint.segmentOffsets.push(l);
                currentPoint.tValues.push(Bez.tForLength(q, advance, k));
            }

            else {

                if (l < tolerance) {
                    // too close to the current point
                    currentPoint.break = true;
                }

                if (remainder < tolerance) {
                    // too close to the next point
                    remainder = 0;
                    if (!addPointsButDontCut)
                        nextPoint.break = true;
                    break addSegmentOffsets;
                }

            }

        }

        if (cutLengthsStack.length > 0)
            cutLengthsStack[0] -= remainder;

    }

    /*
        Split each segment at the calculated tValues
        to create new points.
    */

    var pointCount = closed ? points.length - 1 : points.length - 2,
        newPoints = [];

    if (!closed) {
        // when the path is not closed,
        // we start by adding the last point
        newPoints.push(points[points.length - 1]);
        // and the last point must always break
        newPoints[newPoints.length - 1].break = true;
    }

    splitting:
    for (var i = pointCount; i >= 0; i--) {

        // $/*debug*/.writeln('i = ' + i);
        // $/*debug*/.writeln('newPoints = ' + newPoints);

        var closedAndLastPoint = closed && i == pointCount,
            p1 = points[i],
            p2 = closedAndLastPoint ? points[0] : points[i + 1];

        // if (i == 0)
        // $/*debug*/.writeln('p1 = ' + p1 + '   p1.tValues = ' + p1.tValues);
        // if (i == pointCount)
        // $/*debug*/.writeln('p2 = ' + p2);

        if (
            p1.tValues == undefined
            || p1.tValues.length == 0
        ) {
            // no new points to add
            // $/*debug*/.writeln('adding p1 to start');
            newPoints.unshift(p1);
            continue splitting;
        }

        // this returns adjusted p1 and p2 with new points in between
        var splitPoints = Bez.splitSegment(p1, p2, p1.tValues);

        // mark a break at all the middle points of the split
        for (var j = 1; j < splitPoints.length - 1; j++)
            splitPoints[j].break = true;

        if (newPoints.length > 0) {
            // combine the first newPoint and the last splitPoint
            // (the rightDirection of the former and leftDirection of the latter)
            splitPoints[splitPoints.length - 1].rightDirection = newPoints.shift().rightDirection;
            // $/*debug*/.writeln('removing newPoints[0]');
        }

        // $/*debug*/.writeln('adding ' + splitPoints.length + ' points to start');
        newPoints = splitPoints.concat(newPoints);

    }

    // if (closed)
    // remove the added closing point
    // newPoints.pop();

    return newPoints;

};


/**
 * Cuts a single path array of BezPoints into multiple
 * path arrays, by dividing at each "break" point.
 * `filterFunction` is an optional parameter which, given
 * index and point, will return false when path should
 * be removed (eg. to remove gaps in dashes patterns)
 * @author m1b
 * @version 2023-03-26
 * @param {Array<BezPoint>} points - the points to cut.
 * @param {Function} [filterFunction] - a function to exclude paths.
 * @returns {Object} {paths: [], pathsClosed: []}
 */
Bez.cutIntoPaths = function bezCutIntoPaths(points, filterFunction) {

    // filterFunction = filterFunction || function () { return true };

    // if (filterFunction.constructor.name !== 'Function')
    // throw Error('Bez.cutIntoPaths failed: bad `filterFunction` parameter.');

    var paths = [[]],
        pathsClosed = [false],

        // tracks the number of paths (doesn't include removed paths)
        pathCount = 0,
        // tracks the current path index (does include removed paths)
        i = 0;

    // first point can't be a break
    points[0].break = undefined;

    while (currentPoint = points.shift()) {

        paths[pathCount].push(currentPoint);

        if (
            currentPoint.break == true
            || points.length == 0
        ) {
            // end of a path

            if (
                filterFunction != undefined
                && filterFunction(i, currentPoint) == false
            ) {
                // remove this path, eg. an unwanted gap
                paths.pop();
                pathsClosed.pop();
                pathCount--;
            }

            if (points.length > 0) {
                pathCount++;
                i++;
                // make a new path
                paths[pathCount] = [];
                // and repeat the current point
                var startPoint = new BezPoint(currentPoint);
                startPoint.break = false;
                paths[pathCount].push(startPoint);
                // it is cut into sections, so it isn't closed
                pathsClosed[pathCount] = false;
                continue;
            }

        }

    }

    return { paths: paths, pathsClosed: pathsClosed };

};


/**
 * Returns paths/closed such that each segment
 * of each path is converted into a path.
 * So a path with 5 segments will be returned
 * as a 5 paths, each having a single segment.
 * @author m1b
 * @version 2023-04-12
 * @param {Array<Array<BezPoint>>} paths - a bez-style paths array.
 * @param {Array<Boolean>} closed - a bez-style closed array.
 * @returns {Object} - {paths: closed:}
 */
Bez.convertSegmentsToPaths = function bezConvertSegmentsToPaths(paths, closed) {

    var newPaths = [];

    for (var i = 0; i < paths.length; i++) {

        var points = paths[i].slice(),
            closed = closed[i],
            closingPoint;

        if (closed) {
            // add a closing point
            closingPoint = new BezPoint(points[0]);
            points.push(closingPoint);
        }

        // break at every point
        for (var j = 1; j < points.length; j++)
            points[j].break = true;

        // arrange so that the path is cut into individual paths
        var cutPaths = Bez.cutIntoPaths(points);

        newPaths = newPaths.concat(cutPaths.paths);

    }

    return { paths: newPaths, pathsClosed: false };

};


/**
 * Converts the Bez's paths such that each original
 * segment of each original path is converted into
 * a path. So, a path with 5 segments will be converted
 * into 5 paths, each having a single segment.
 * @author m1b
 * @version 2023-04-12
 */
Bez.prototype.convertSegmentsToPaths = function convertSegmentsToPaths() {

    var self = this,
        converted = Bez.convertSegmentsToPaths(self.paths, self.pathsClosed);

    self.paths = converted.paths;
    self.pathsClosed = converted.pathsClosed;
    self.dirty = true;

};


// BezPoint class — see BezPoint.js


// functions:


/**
 * Adds a new PathPoint to an item.
 * @param {PathItem} item - the target path item
 * @param {BezPoint|PathPoint} p - the point to add
 */
function addPoint(item, p) {

    if (p == undefined)
        return;

    // $/*debug*/.write(' >> ' + Math.floor(p.anchor[0]));

    newPoint = item.pathPoints.add();
    newPoint.anchor = p.anchor;
    newPoint.leftDirection = p.leftDirection;
    newPoint.rightDirection = p.rightDirection;
    newPoint.pointType = p.pointType;

    return newPoint;

};


/**
 * This function returns true if the item's stroke
 * dash alignment is set to 'aligning to corners
 * and path ends, adjusting lengths to fit'.
 * NOTE: At this time there is no API access to
 * this setting so this method is a hack: it
 * converts a model duplicate of the item into
 * outline stroke and counts the number of paths.
 * @author m1b
 * @version 2023-03-29
 * @param {PathItem} item - path item or compoundPathItem with dashed stroke
 * @param {Boolean} keepSelection - don't discard current selection
 * @param {Document} doc - the item's Document.
 * @returns {Boolean}
 */
function strokeDashesAreAligned(item, keepSelection, doc) {

    if (item == undefined)
        return;

    // we want to store the selection
    // because the outline stroke
    // test later destroys it
    keepSelection = keepSelection !== false;
    doc = doc || getParentDocument(item);

    var dashesAreAligned,
        selectedItems = doc.selection,
        modelPathItem;

    if (item.parent.constructor.name == 'CompoundPathItem')
        item = item.parent;

    if (item.constructor.name == 'CompoundPathItem') {

        // COMPOUND PATH ITEM

        if (
            item.pathItems[0].stroked == false
            || item.pathItems[0].strokeDashes.length == 0
        )
            return;

        // duplicate first path item
        modelPathItem = item.pathItems[0].duplicate();
        modelPathItem.move(item.parent, ElementPlacement.PLACEATBEGINNING);

    }

    else if (item.constructor.name == 'PathItem') {
        modelPathItem = item.duplicate();
    }

    if (modelPathItem == undefined)
        return;

    if (
        modelPathItem.stroked == false
        || modelPathItem.strokeDashes.length == 0
    )
        return;

    // standardise model
    var standardPoints = [[0, 0], [3, 0]];

    modelPathItem.filled = false;
    modelPathItem.stroked = true;
    modelPathItem.strokeWidth = 0.1;
    modelPathItem.strokeDashes = [1];
    modelPathItem.closed = false;

    // swap the model's points with standard points
    for (var i = modelPathItem.pathPoints.length - 1; i >= 0; i--) {

        if (i >= standardPoints.length) {
            modelPathItem.pathPoints[i].remove();
        }

        else {
            modelPathItem.pathPoints[i].anchor = standardPoints[i];
            modelPathItem.pathPoints[i].leftDirection = standardPoints[i];
            modelPathItem.pathPoints[i].rightDirection = standardPoints[i];
        }

    }

    // convert to outlined stroke
    // must clear selection to do this
    doc.selection = null;
    modelPathItem.selected = true;
    app.executeMenuCommand('OffsetPath v22');
    modelPathItem = doc.selection[0];

    // the model, once converted to compoundPathItem,
    // will have 2 pathItems if dashes are not aligned,
    // or 3 if dashes are aligned
    var dashesAreAligned = modelPathItem.pathItems.length === 3;

    // remove the model and reselect the original
    modelPathItem.remove();

    // re-instate inital selection
    if (keepSelection)
        doc.selection = selectedItems;

    return dashesAreAligned;

};


/**
 * Returns a page item's Document.
 * @param {PageItem} obj - a page item
 * @returns {Document} the page item's document
 */
function getParentDocument(obj) {

    if (obj == undefined)
        return;

    while (
        obj.hasOwnProperty('parent')
        && obj.constructor.name != 'Document'
    )
        obj = obj.parent;

    if (obj.constructor.name == 'Document')
        return obj;

};


/**
 * Returns array containing items, including
 * items found inside GroupItems
 * @author m1b
 * @version 2022-05-23
 * Example usage:
 * var items = itemsInsideGroupItems(doc.selection, ['PathItem', 'CompoundPathItem']);
 * @param {Array<PageItem>} items - array or collection of Illustrator page items.
 * @param {String|Array<String>} [typenames] - item constructor names to target (default: target all typenames).
 * @param {Number} [level] - recursion level (private parameter).
 * @returns {Array<PathItem>} the path items found.
 */
function itemsInsideGroupItems(items, typenames, level) {

    try {

        if (level == undefined)
            level = 0;

        var found = [];

        for (var i = 0; i < items.length; i++) {

            var item = items[i];

            if (
                item.uuid == undefined
                || item.parent.typename == 'CompoundPathItem'
            )
                continue;

            if (item.typename == 'GroupItem') {
                found = found.concat(itemsInsideGroupItems(item.pageItems, typenames, level + 1));
            }

            else if (typenames === undefined || itemIsType(item, typenames)) {
                found.push(item);
            }

        }

        return found;

    } catch (err) {
        alert('itemsInsideGroupItems: ' + err)
    }

};


/**
 * Returns true if item.typename matches any of the typenames
 * @param {PathItem} item - a path item
 * @returns {Boolean}
 */
function itemIsType(item, typenames) {

    if (item === undefined)
        throw Error('itemIsType: No item supplied.');

    if (typenames === undefined)
        throw Error('itemIsType: No typenames supplied.');

    if (typenames.constructor.name != 'Array')
        typenames = [typenames];

    for (var i = 0; i < typenames.length; i++)
        if (typenames[i] == item.typename)
            return true;

    return false;

};


var inch = 72;
var mm = 2.834645669;




/**
 * Apply properties to item. Note: a property
 * can be a function, given the item, and
 * returning a value.
 * @author m1b
 * @version 2023-03-23
 * @param {PageItem} item - an Illustrator PageItem.
 * @param {Document} doc - an Illustrator Document.
 * @param {Object} properties - object of properties to apply to item.
 */
function applyProperties(item, doc, properties) {

    for (var key in properties) {

        if (!properties.hasOwnProperty(key))
            continue;

        if (
            properties[key] != undefined
            && properties[key].constructor.name == 'Function'
        )
            item[key] = properties[key](item, doc);

        else {
            // $/*debug*/.writeln('apply property: "' + key + '"');
            item[key] = properties[key];
        }

    }

};