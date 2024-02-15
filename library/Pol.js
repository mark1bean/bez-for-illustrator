if ('undefined' === typeof Bez)
    $.evalFile(File($.fileName).parent + 'Bez.js');


/**
 * POL - A general purpose simple-polygon manipulation helper object.
 *
 * Notes:
 * Pol treats every pathItem as a compoundPathItem, so
 * to access the Pol's paths, iterate over pol.paths.
 * We call this a path/points array.
 *
 * pol.pathsClosed[i] and pol.paths[i] share the same indexing.
 *
 *   Example 1. Make Pol from a page item:
 *     var pol = new Pol({ pageItem: item });
 *
 *   Example 2. Make Pol from array of "paths" which are arrays of points
 *     var pol = new Pol({ paths: myPathsArray });
 *
 * To draw the polygon to a separate path item, use the static Pol.draw, but to
 * update the pol's own page item, use the pol.draw.
 *
 * @author m1b
 * @version 2024-01-20
 * @constructor
 * @param {Object} options
 * @param {Array<Array<point>>} [options.paths] - a paths/points array.
 * @param {PathItem|CompoundPathItem} [options.pageItem] - a function that, given a PathItem, returns true or false. False pathItems will be ignored. (default: no filter).
 * @param {Number} [flatness] - the average length of lines when performing curved segment approximation (default: 2).
 * @param {Function} [options.pathItemFilter] - a function that, given a PathItem, returns true or false. False pathItems will be ignored. (default: no filter).
 * @param {Array<Boolean>} [options.pathsClosed] - array showing which paths are closed.
 */
function Pol(options) {

    var self = this;

    self.doc = options.doc;

    self.paths = []; // the paths/points array
    self.pathsClosed = []; // the closed-ness of each path
    self.pathsPolarity = []; // the polarity of each path

    self.absoluteRotationAngle = options.absoluteRotationAngle || 0;
    self.rotationOffsetFromDatum = options.rotationOffsetFromDatum || 0;
    self.transformPoint = options.transformPoint;
    self.pathItemFilter = options.pathItemFilter;
    self.appearance = options.appearance || {};

    if (undefined != options.pageItem)
        // this will set `self.paths` and `self.pathsClosed`
        self.consumePageItem(options.pageItem, options.flatness || 2);

    if (undefined == self.paths)
        throw Error('Pol constructor failed: no `paths` supplied.');

    if (
        self.paths != undefined
        && undefined != options.pathsClosed
        && options.pathsClosed.constructor.name == 'Boolean'
    )
        // closed value to be applied to every path
        for (var i = 0; i < self.paths.length; i++)
            self.pathsClosed[i] = options.pathsClosed;

    else if (
        // closed values are specified for each path
        undefined != options.pathsClosed
        && 'Array' == options.pathsClosed.constructor.name
        && options.pathsClosed.length === self.paths.length
    )
        for (var i = 0; i < self.paths.length; i++)
            self.pathsClosed[i] = options.pathsClosed[i];

    if (self.pathsClosed.length == 0)
        throw Error('new Pol failed: no `pathsClosed` supplied.');

};


/**
 * Given an Illustrator page item, extracts polygon paths.
 * If the page item has bezier curves, uses creates an
 * intermediary Bez for the conversion.
 * @param {PageItem} pageItem - an Illustrator page item with paths.
 * @param {Number} [flatness] - the average length of lines when approximating curved segments (default: 2).
 */
Pol.prototype.consumePageItem = function consumePageItem(pageItem, flatness) {

    var self = this;

    self.pageItem = pageItem;

    if ('undefined' === typeof Bez)
        throw Error('Pol.prototype.consumePageItem: requires Bez.js.');

    var bez = new Bez({ pageItem: pageItem, pathItemFilter: self.pathItemFilter });

    self.paths = bez.getPolygon({ flatness: flatness || 2 });
    self.pathsClosed = bez.pathsClosed.slice();

};


/**
 * Duplicate the pol.
 * Note: the heavy lifting of duplicating
 * the pol is in the constructor, which
 * carefully copies `points` and `closed`
 * to ensure new references are made.
 * @returns {Pol}
 */
Pol.prototype.duplicate = function duplicate() {

    var self = this;

    return new Pol(
        {
            paths: self.paths,
            pathsClosed: self.pathsClosed,
        }
    );

};


/**
 * Returns true with point `p` is contained by with the bez.
 * @version 2023-06-12
 * @param {Array<Number>} point - a point [x, y].
 * @returns {Boolean}
 */
Pol.prototype.containsPoint = function containsPoint(point) {

    var self = this;
    return Pol.containsPoint(self.paths, point);

};


/**
 * Returns true with point `point` is contained by `path`.
 * @version 2023-06-12
 * @param {Array<Array<point>>} paths - a path/points array.
 * @param {Array<Number>} point - a point [x, y].
 * @returns {Boolean}
 */
Pol.pathContainsPoint = function containsPoint(paths, point) {

    var x = point[0],
        y = point[1],
        doesIntersect = false;

    if ('Number' === paths[0][0].constructor.name)
        // if path is singular, put it into array
        paths = [paths]

    pathsLoop:
    for (var k = 0; k < paths.length; k++) {

        var path = paths[k],
            inside = false;

        for (var i = 0, j = path.length - 1; i < path.length; j = i++) {

            var xi = path[i][0],
                yi = path[i][1],
                xj = path[j][0],
                yj = path[j][1],

                intersect = (
                    ((yi > y) !== (yj > y))
                    && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
                );

            if (intersect)
                inside = !inside;

        }

        if (inside) {
            doesIntersect = true;
            break pathsLoop;
        }

    }

    return inside;

};


/**
 * Returns the pol's centroid.
 * @param {<Array<Array<Number>>} [polygon] - an array of path/points coordinates (default: make polygon from pol's points).
 * @returns {Array<Number>} - the centroid [x, y].
 */
Pol.prototype.getCentroid = function getMyCentroid() {

    var self = this;

    return Pol.getCentroidForPath(self.paths);

};


/**
 * Returns the centroid [x, y] of the polygon.
 * @param {Array<point>} path - an array of points.
 * @returns {Array<Number>}
 */
Pol.getCentroidForPath = function getCentroidForPath(path) {

    var area = 0,
        x = 0,
        y = 0;

    for (var i = 0, len = path.length, j = len - 1; i < len; j = i++) {

        var a = path[i],
            b = path[j],
            f = a[0] * b[1] - b[0] * a[1];

        x += (a[0] + b[0]) * f;
        y += (a[1] + b[1]) * f;
        area += f * 3;

    }

    if (area === 0)
        return [path[0][0], path[0][1]];

    return [x / area, y / area];

};


/**
 * desc
 * @date 2024-01-27
 * @param {Object} options
 * @param {Document} options.doc - an Illustrator Document
 * @param {Array<Array<point>>} options.paths - a paths/points array.
 * @param {Array<Boolean>} options.pathsClosed - an array of path-is-closed booleans.
 * @param {Layer|GroupItem} [options.container] - an Illustrator DOM container (default: active layer).
 * @param {PathItem|CompoundPathItem} [options.pageItem] - an Illustrator page item.
 * @param {Boolean} [options.drawAsCompoundPathItem] - whether to draw multiple paths as a compoundPath, or as separate PathItems (default: true).
 * @param {Boolean} options.select - whether to select the drawn item (default: false).
 */
Pol.draw = function polDraw(options) {

    options = options || {};

    var doc = options.doc,
        container = options.container,
        paths = options.paths,
        pathsClosed = options.pathsClosed || [],
        pageItem = options.pageItem,
        drawAsCompoundPathItem = options.drawAsCompoundPathItem !== false,
        select = options.select === true;

    if (doc == undefined)
        throw Error('Pol.draw failed: no `doc` parameter.');

    if (paths == undefined)
        throw Error('Pol.draw failed: no `paths` parameter.');

    if (
        (
            'Boolean' != pathsClosed.constructor.name
            && 'Array' != pathsClosed.constructor.name
        )
        || (
            'Array' == pathsClosed.constructor.name
            && paths.length !== pathsClosed.length
        )
    )
        throw Error('Pol.draw failed: bad `pathsClosed` parameter.');

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

            var p = item.pathPoints.add();

            p.anchor = points[j];
            p.leftDirection = points[j];
            p.rightDirection = points[j];
            p.pointType = PointType.CORNER;

        }

        // set the closed
        if (pathsClosed.constructor.name == 'Boolean')
            item.closed = pathsClosed;
        else if (pathsClosed.constructor.name == 'Array')
            item.closed = pathsClosed[i];

        debugger; // 2024-01-27XXX


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
Pol.findRotationByMinimalBounds = function findRotationByMinimalBounds(item) {

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
Pol.prototype.drawPathIndicators = function (options) {

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
        Pol.drawCircle(self.doc, p1.anchor, size, firstPointAppearance);

        // draw a square at the second point
        Pol.drawSquare(self.doc, p2.anchor, size * 2, secondPointAppearance);

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




/**
 * Returns simplified polygon, where points
 * are removed if considered collinear.
 * @param {polygon} poly - array of [x, y] points.
 * @param {Number} [tolerance] - tolerance value; higher values tend to remove more points (default: 0.001).
 * @returns {polygon|Array<polygon>}
 */
Pol.simplifyPolygon = function simplifyPolygon(poly, tolerance) {

    if (undefined == tolerance)
        // this assumes very conservative simplification
        tolerance = 0.001;

    var simplifiedPolygon = [];

    // handle multiple path polygons
    if (poly[0][0].constructor.name == 'Array') {

        for (var i = 0; i < poly.length; i++)
            simplifiedPolygon.push(simplifyPolygon(poly[i]));

        return simplifiedPolygon;

    }

    // add the first point
    simplifiedPolygon.push(poly[0]);

    // add non-collinear points
    for (var i = 1; i < poly.length - 1; i++)
        if (!isCollinear(poly[i - 1], poly[i], poly[i + 1], tolerance))
            simplifiedPolygon.push(poly[i]);

    // add the last point
    simplifiedPolygon.push(poly[poly.length - 1]);

    return simplifiedPolygon;

    /**
     * Returns true when the points fall along
     * a line, given `tolerance`.
     * @param {point} p1 - point [x, y].
     * @param {point} p2 - point [x, y].
     * @param {point} p3 - point [x, y].
     * @returns {Boolean}
     */
    function isCollinear(p1, p2, p3, tolerance) {
        var crossProduct = (p2[1] - p1[1]) * (p3[0] - p2[0]) - (p2[0] - p1[0]) * (p3[1] - p2[1]);
        return Math.abs(crossProduct) < tolerance;
    };

};


/**
 * Reverses the order of path points.
 * @author m1b
 * @version 2022-12-22
 * @param {Object} options
 * @param {Number} [pathIndex] - the index to the path (default: all paths).
 * @param {Boolean} [redraw] - whether to redraw the pageItem (default: true).
 */
Pol.prototype.reverse = function reverse(options) {

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
            throw Error('Pol.prototype.reverse failed: pathIndex out of bounds.')

    }

    pathsLoop:
    for (var i = start; i < end; i++) {

        var points = self.paths[i].slice(),
            closed = self.pathsClosed[i],
            pointsCount = points.length,
            newPoints = [];

        points.reverse();

        if (closed)
            // we still want the path to
            // start on the same point
            points.unshift(points.pop());

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
Pol.prototype.closestToPoint = function closestToPoint(point) {

    var self = this,
        p = point;

    if (p.hasOwnProperty('anchor'))
        p = p.anchor;

    if (
        p.constructor.name != 'Array'
        || p.length !== 2
    )
        throw Error('Pol.prototype.closestToPoint failed: bad `point` parameter (' + point + ').');

    var closest = {
        distance: Infinity,
        point: undefined,
        pathIndex: undefined,
        pointIndex: undefined
    }
    for (i = 0; i < self.paths.length; i++)
        for (j = 0; j < self.paths[i].length; j++) {
            var p1 = self.paths[i][j],
                d = distanceBetweenPoints(p, p1);
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
 * @param {Boolean} [options.redraw] - whether to redraw the pol (default: false).
 */
Pol.prototype.setFirstPoint = function setFirstPoint(options) {

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
        throw Error('Pol.prototype.setFirstPoint failed: could not determine first point.');

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
Pol.prototype.getIndicesOfPoint = function getIndicesOfPoint(point) {

    var self = this,
        indices;

    for (i = 0; i < self.paths.length; i++)
        for (j = 0; j < self.paths[i].length; j++)
            if (self.paths[i][j].isEqualTo(point))
                return [i, j];

};


/**
 * Updates self.pageItem.
 * @author m1b
 * @version 2024-01-27
 * @param {Boolean} [options.select] - select the pathItem afterwards (default: undefined)
 */
Pol.prototype.draw = function draw(select) {

    var self = this;

    self.updatePageItem();

    if (true === select)
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
Pol.draw = function polDraw(options) {

    options = options || {};

    var doc = options.doc,
        paths = options.paths,
        pathsClosed = options.pathsClosed || [],
        pageItem = options.pageItem,
        drawAsCompoundPathItem = options.drawAsCompoundPathItem !== false,
        select = options.select === true;

    if (doc == undefined)
        throw Error('Pol.draw failed: no `doc` parameter.');

    if (paths == undefined)
        throw Error('Pol.draw failed: no `paths` parameter.');

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
        throw Error('Pol.draw failed: bad `pathsClosed` parameter.');

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
 * Updates the pol's page item
 * to match its path/points array.
 * @author m1b
 * @version 2023-11-29
 */
Pol.prototype.updatePageItem = function updatePageItem() {

    var self = this,
        doc = self.doc,
        pageItem = self.pageItem,
        paths = self.paths,
        pathsClosed = self.pathsClosed;

    if (doc == undefined)
        throw Error('Pol.updatePageItem failed: no `doc` parameter.');

    if (paths == undefined)
        throw Error('Pol.prototype.updatePageItem failed: no `paths` parameter.');

    if (
        pathsClosed == undefined
        && (
            pathsClosed.constructor.name != 'Boolean'
            || pathsClosed.length !== paths.length
        )
    )
        throw Error('Pol.prototype.updatePageItem failed: bad `pathsClosed` parameter.');

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
            p.anchor = points[j];
            p.leftDirection = points[j];
            p.rightDirection = points[j];
            p.pointType = PointType.CORNER;

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
 * Adds points for a new path to the pol.
 * Use redraw() to update the pathItem.
 * @param {Array<BezPoint>} points - an array of points to add.
 * @param {Boolean} closed - whether the new path is closed.
 */
Pol.prototype.addPath = function addPath(points, closed) {

    if (
        points == undefined
        || points.constructor.name != 'Array'
        || points.length < 2
        || !points[0].hasOwnProperty('anchor')
    )
        throw Error('Pol.prototype.addPath failed: bad `points` parameter.')

    var self = this;
    self.paths.push(points.slice());
    self.pathsClosed.push(closed == true);

};


/**
 * Returns the pol's bounding box.
 * @author m1b
 * @version 2024-01-27
 * @returns {Array<Number>}
 */
Pol.prototype.getBounds = function getBounds() {

    var self = this;
    return Pol.getBounds(self.paths);

};


/**
 * Returns the coordinates of the requested
 * transform position type, for example
 * BezTransformPositionType.BOTTOM_RIGHT
 * @author m1b
 * @version 2023-01-02
 * @param {BezTransformPositionType} transformPositionType - the transform center type (default: BezTransformPositionType.CENTER).
 * @param {Array<Number>} [bounds] - the bounds to use (default: the pol's bounds).
 * @returns {Array<Number>} - [x, y].
 */
Pol.prototype.getCoordinatesOfTransformPosition = function getCoordinatesOfTransformPosition(transformPositionType, bounds) {

    return Pol.getCoordinatesOfTransformPosition(transformPositionType, bounds || this.getBounds());

};


/**
 * Returns the coordinates of the requested
 * transform position type, for example
 * BezTransformPositionType.BOTTOM_RIGHT
 * @author m1b
 * @version 2024-01-27
 * @param {BezTransformPositionType} positionType - the transform center type (default: BezTransformPositionType.CENTER).
 * @param {Array<Number>} bounds - the bounds to use (default: the pol's bounds).
 * @returns {Array<Number>} - the coodinates [x, y].
 */
Pol.getCoordinatesOfTransformPosition = function bezGetCoordinatesOfTransformPosition(positionType, bounds) {

    if (bounds == undefined)
        throw Error('Pol.getCoordinatesOfTransformPosition failed: no `bounds` supplied.');

    if (BezTransformPositionType.TOP_LEFT === positionType)
        return [bounds[0], bounds[1]];

    if (BezTransformPositionType.TOP_RIGHT === positionType)
        return [bounds[2], bounds[1]];

    if (BezTransformPositionType.BOTTOM_RIGHT === positionType)
        return [bounds[2], bounds[3]];

    if (BezTransformPositionType.BOTTOM_LEFT === positionType)
        return [bounds[0], bounds[3]];

    if (BezTransformPositionType.CENTER === positionType)
        return [bounds[0] + (bounds[2] - bounds[0]) / 2, bounds[1] + (bounds[3] - bounds[1]) / 2];

    if (BezTransformPositionType.TOP === positionType)
        return [bounds[0] + (bounds[2] - bounds[0]) / 2, bounds[1]];

    if (BezTransformPositionType.RIGHT === positionType)
        return [bounds[2], bounds[1] + (bounds[3] - bounds[1]) / 2];

    if (BezTransformPositionType.BOTTOM === positionType)
        return [bounds[0] + (bounds[2] - bounds[0]) / 2, bounds[3]];

    if (BezTransformPositionType.LEFT === positionType)
        return [bounds[0], bounds[1] + (bounds[3] - bounds[1]) / 2];

};


/**
 * Rotate the pol's points.
 * @author m1b
 * @version 2023-01-01
 * @param {Object} options
 * @param {Number} options.angle - the rotation angle in degrees.
 * @param {Array<BezPoint>|Array<Array<BezPoint>>} [options.paths] - the points to rotate, can be nested by paths (default: the pol's points).
 * @param {BezTransformPositionType} [options.transformPositionType] - a transformPositionType (default: undefined).
 * @param {BezRotationType} [options.rotationType] - (default: BezRotationType.NORMAL).
 * @param {Number} [options.angleOffset] - an additional rotation (default: 0).
 * @param {Array<Number>} [options.transformPoint] - the point to transform from (default: pol's transformPoint or undefined).
 * @param {Boolean} [options.redraw] - whether to redraw the pol (default: false).
 * @returns {Array<Array<point>>}
*/
Pol.prototype.rotate = function rotate(options) {

    options = options || {};

    var self = this,
        angle = Number(options.angle),
        paths = options.paths || self.paths,
        transformPositionType = options.transformPositionType || BezTransformPositionType.CENTER,
        rotationType = options.rotationType || BezRotationType.NORMAL,
        angleOffset = Number(options.angleOffset || 0),
        transformPoint = options.transformPoint,
        redraw = options.redraw === true;

    if (
        angle == undefined
        || isNaN(angle)
    )
        throw Error('Pol.prototype.rotate failed: bad `angle` supplied. (' + angle + ')');

    // get transformation point
    transformPoint = self.getCoordinatesOfTransformPoint({
        transformPoint: transformPoint,
        transformPositionType: transformPositionType,
    });

    if (
        transformPoint == undefined
        || transformPoint.constructor.name != 'Array'
        || transformPoint.length !== 2
    )
        throw Error('Pol.prototype.rotate failed: could not determine `transformPoint`. (' + transformPoint + ')');

    if (rotationType == BezRotationType.FROM_DATUM) {
        var d = self.getRotationDatum();
        angle += d - (d - self.rotationOffsetFromDatum || 0);
    }

    if (0 === angle)
        return;

    // rotate the points
    var newPaths = Mat.transformPaths({
        paths: self.paths,
        matrix: Mat.getRotationMatrix(angle, true),
        netTranslationVector: transformPoint,
    });

    // update the points
    self.paths = newPaths;

    if (redraw)
        self.draw();

    return newPaths;

};


/**
 * Rotate the pol absolutely.
 * @author m1b
 * @version 2023-01-03
 * @param {Object} options
 * @param {Number} angle - the absolute rotation angle in degrees.
 * @param {Array<BezPoint>|Array<Array<BezPoint>>} [points] - the points to rotate, can be nested by paths (default: the pol's points).
 * @param {BezTransformPositionType} [transformPositionType] - a transformPositionType (default: BezTransformPositionType.CENTER).
 * @param {Boolean} [rotationType] - (default: BezRotationType.NORMAL).
 * @param {Number} [angleOffset] - an additional rotation (default: 0).
 * @param {Array<Number>} [transformPoint] - (default: pol.transformPoint)
 * @param {Function} [options.angleFunction] - a function, given the point, that modifies the angle for each point (default: undefined).
 * @param {Function} [options.filterFunction] - a function, given the point, that decides whether to rotate the point (default: undefined).
 * @param {Boolean} [options.redraw] - whether to redraw the pol (default: true).
*/
Pol.prototype.setAngle = function setAngle(options) {

    var self = this;

    options = options || {};
    options.selectedPointsOnly = false;
    options.updateAbsoluteRotation = true;
    options.rotationType = BezRotationType.FROM_DATUM;

    self.rotate(options);

};


/**
 * Returns an angle derived from the
 * pol's geometry.
 * @author m1b
 * @version 2023-01-03
 * @param {Boolean} reverse -
 * @param {Number} pathIndex -
 */
Pol.prototype.getRotationDatum = function getRotationDatum(reverse, pathIndex) {

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

    return Pol.getAngleOfPointP1(p1, p2, false, reverse);

}



/**
 * Scale the pol's points.
 * @author m1b
 * @version 2023-01-01
 * @param {Object} options
 * @param {Number|Array<Number>} [options.scaleFactor] - the scaleFactor, where 1 means no scaling (default: undefined).
 * @param {Array<Number>} [options.box] - a bounding box [L, T, R, B] for size-fitting purposes (default: undefined).
 * @param {Array<BezPoint>|Array<Array<BezPoint>>} [options.paths] - the points to rotate, can be nested (default: the pol's points).
 * @param {BezTransformPositionType} [options.transformPositionType] - a transformPositionType (default: BezTransformPositionType.CENTER).
 * @param {BezScaleType} [options.scaleType] - the type of scaling (default: BezScaleType.SCALE_BY_FACTOR).
 * @param {Array<Number>} [options.transformPoint] - the point from which the transform is performed (default: undefined)
 * @param {Number} [options.scaleFactorOffset] - an additional scaleFactor (default: 1).
 * @param {Number} [options.boxFittingStrokeWidth] - the strokeWidth to accommodate when box fitting (default: 0).
 * @param {Function} [options.scaleFunction] - a function, given a point, that modifies the scaleFactor for each point (default: undefined).
 * @param {Function} [options.filterFunction] - a function, given a point, that decides whether to scale the point (default: undefined).
 * @param {Boolean} [options.selectedPointsOnly] - whether to scale only the selected points (default: false).
 * @param {Boolean} [options.redraw] - whether to redraw the pol (default: true).
 */
Pol.prototype.scale = function scale(options) {

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
        throw Error('Pol.prototype.scale failed: no `box` supplied for box fitting.');

    // get transformation point
    var tp = self.getCoordinatesOfTransformPoint(options);

    if (
        tp == undefined
        || tp.constructor.name != 'Array'
        || tp.length !== 2
    )
        throw Error('Pol.prototype.scale failed: could not determine `tp`.');

    if (isBoxTypeScaling)
        scaleFactor = getScaleFactorForBoxFitting(scaleType, bounds, box, boxFittingStrokeWidth);

    if (scaleFactor == undefined)
        throw Error('Pol.prototype.scale failed: could not determine `scaleFactor`.');

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
                throw Error('Pol.prototype.scale failed: bad value for `s`.');

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
 * Translates the pol's points,
 * with aligning functionality.
 * @author m1b
 * @version 2023-01-01
 *
 * Call this method in any of three ways:
 *
 * (a) Simple translation
 *     @example
 *       pol.translate({ translation: [10, -20] });
 *
 * (b) Align with transformPositionType
 *     This example will align the pol's bottom
 *     to the bottom of the supplied box.
 *     @example
 *       pol.translate({
 *         transformPositionType: BezTransformPositionType.BOTTOM,
 *         alignToBox: somePageItem.geometricBounds
 *       });
 *
 * (c) Align points
 *     This example will align the pol's first point
 *     with a PathItem's first point.
 *     @example
 *       pol.translate({
 *         alignMyPoint: pol.paths[0][0].anchor,
 *         alignToPoint: somePathItem.pathPoints[0].anchor,
 *       });
 *
 *     You can use Pol.getCoordinatesOf to get points.
 *     This exampe will align the pol's top left, with
 *     the page item's top right:
 *     @example
 *       pol.translate({
 *         alignMyPoint: pol.getCoordinatesOf(BezTransformPositionType.TOP_LEFT),
 *         alignToPoint: Pol.getCoordinatesOf(BezTransformPositionType.TOP_RIGHT, somePageItem.geometricBounds)
 *       });
 *     (Note the important difference between pol and Pol
 *     in the last example: getCoordinatesOf
 *     is both a method of the instance pol, as well as a
 *     method of the class Pol. The instance method will use
 *     the instance's own bounds, whereas the class method
 *     will fail if no bounds are supplied.)
 *
 * @param {Object} options
 * @param {Number|Array<Number>} [options.translation] - the translation [tz, ty] (default: undefined).
 * @param {Array<BezPoint>|Array<Array<BezPoint>>} [options.paths] - the points to rotate, can be nested (default: the pol's points).
 * @param {BezTransformPositionType} [options.transformPositionType] - a transformPositionType (default: undefined).
 * @param {Array<Number>} [options.alignMyPoint] - a point on the pol to align from (default: undefined).
 * @param {Array<Number>} [options.alignToPoint] - a point to align to (default: undefined).
 * @param {Array<Number>} [options.alignToBox] - a bounding box [L, T, R, B] for size-fitting purposes (default: undefined).
 * @param {Number} [options.translationOffset] - an additional translation (default: [0, 0]).
 * @param {Function} [options.translateFunction] - a function, given a point, that modifies the scaleFactor for each point (default: undefined).
 * @param {Function} [options.filterFunction] - a function, given a point, that decides whether to scale the point (default: undefined).
 * @param {Boolean} [options.selectedPointsOnly] - whether to translate only the selected points (default: false).
 * @param {Boolean} [options.redraw] - whether to redraw the pol (default: true).
 */
Pol.prototype.translate = function translate(options) {

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
        throw Error('Pol.prototype.translate failed: no `alignToPoint` given with `alignMyPoint`.');

    if (
        transformPositionType != undefined
        && alignToBox == undefined
    )
        throw Error('Pol.prototype.translate failed: no `alignToBox` given with `transformPositionType`.');

    if (transformPositionType != undefined) {
        alignMyPoint = Pol.getCoordinatesOfgetCoordinatesOfTransformPosition(transformPositionType, bounds);
        alignToPoint = Pol.getCoordinatesOfgetCoordinatesOfTransformPosition(transformPositionType, alignToBox);
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
            alignToPoint = Pol.getCoordinatesOfgetCoordinatesOfTransformPosition(alignToPoint, alignToBox);

        if (alignMyPoint.constructor.name == 'String')
            alignMyPoint = Pol.getCoordinatesOfgetCoordinatesOfTransformPosition(alignMyPoint, myBounds);

        translation = differenceBetweenPoints(alignToPoint, alignMyPoint);
    }

    if (
        translation == undefined
        || translation.constructor.name != 'Array'
        || translation.length !== 2
    )
        throw Error('Pol.prototype.translate failed: could not determine `translation`.');

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
                throw Error('Pol.prototype.translate failed: bad value for `tr`.');

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
 * Returns coordinates of either
 * (a) a supplied point,
 * (b) a supplied transformPositionType for the pol, or
 * (c) the pol's transformPoint (the usual usage).
 * @author m1b
 * @version 2023-01-04
 * @param {Object} options
 * @param {Array<Number>} [options.transformPoint] - the point to transform from (default: bez's transformPoint or undefined).
 * @param {BezTransformPositionType} [options.transformPositionType] - a transformPositionType (default: undefined).
 * @returns {Array<Number>} - [x, y]
 */
Pol.prototype.getCoordinatesOfTransformPoint = function getCoordinatesOfTransformPoint(options) {

    options = options || {};

    var self = this,
        transformPoint = options.transformPoint,
        transformPositionType = options.transformPositionType,
        tp;

    // 1. try to resolve tp for supplied `transformPoint`

    if (transformPoint != undefined) {

        if (
            transformPoint.constructor.name == 'Array'
            && 2 === transformPoint.length
        )
            tp = transformPoint;

        else if (transformPoint.hasOwnProperty('anchor'))
            // convert from BezPoint or PathPoint
            tp = transformPoint.anchor;

        else if (
            undefined == transformPositionType
            && 'String' === transformPoint.constructor.name
        )
            // might be a BezTransformPositionType
            tp = self.getCoordinatesOfTransformPosition(transformPoint);

    }


    // 2. try to resolve tp for supplied `transformPositionType`

    if (
        undefined == tp
        && undefined != transformPositionType
    )
        tp = self.getCoordinatesOfTransformPosition(transformPositionType);

    return tp;

};


/**
 * Selects the pol's pathItem.
 * @author m1b
 * @version 2023-03-25
 */
Pol.prototype.select = function select() {

    var self = this;

    if (self.pageItem)
        self.pageItem.selected = true;

};


/**
 * Deselects the pol's pathItem.
 * @author m1b
 * @version 2023-01-05
 */
Pol.prototype.deselect = function deselect() {

    var self = this;
    if (self.pageItem)
        self.pageItem.selected = false;

};


/**
 * Returns string representation of the Pol.
 * @author m1b
 * @version 2022-05-23
 * @returns {String}
 */
Pol.prototype.toString = function bezToString() {

    return '[Pol: ' + this.paths.length + ' paths]';

};


/**
 * Returns area of single-path polygon.
 * @param {Array<point>} path
 * @returns {Number}
 */
Pol.getPolygonArea = function getPolygonArea(path) {

    var area = 0;

    for (var i = 0, l = path.length; i < l; i++) {

        var addX = path[i][0],
            addY = path[i == path.length - 1 ? 0 : i + 1][1],
            subX = path[i == path.length - 1 ? 0 : i + 1][0],
            subY = path[i][1];

        area += (addX * addY * 0.5);
        area -= (subX * subY * 0.5);

    }

    return Math.abs(area);

};


/**
 * Returns the index of the found `obj` in `arr`
 * or returns -1 if object isn't found.
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
 * Returns a deep copy of pol's paths.
 * @returns {Array<polygon>}
 */
Pol.prototype.copyPaths = function copyPaths() {

    var self = this;

    return copyArrays(self.paths)

};


/**
 * Returns a copy of an array of arrays.
 * @param {Array<Array>} arrays - array of arrays.
 * @return {Array<Array>}
 */
function copyArrays(arrays) {

    var copy = [];

    for (var i = 0; i < arrays.length; i++)
        copy[i] = Array.isArray(arrays[i])
            ? copyArrays(arrays[i])
            : arrays[i];

    return copy;

};


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
 * Returns the bounds of an array of pols or polygons.
 * @param {Array<polygon>} polygons - an array of arrays of points [x, y].
 * @returns {Array<Number>} - [L, T, R, B].
 */
Pol.getBounds = function getBounds(polygons) {

    if (
        undefined == polygons
        || 'Array' !== polygons.constructor.name
    )
        throw Error('Pol.getPolygonBounds: bad `polygons` supplied.');

    var points = concatPaths(polygons);

    var left = Infinity,
        top = -Infinity,
        right = -Infinity,
        bottom = Infinity;

    for (var i = 0; i < points.length; i++) {

        left = Math.min(left, points[i][0]);
        top = Math.max(top, points[i][1]);
        right = Math.max(right, points[i][0]);
        bottom = Math.min(bottom, points[i][1]);

    }

    return [left, top, right, bottom];

};


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
    const angleRadians = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);

    // Convert radians to degrees
    const angleDegrees = (angleRadians * 180) / Math.PI;

    if (true === makePositive)
        angleDegrees = (angleDegrees + 360) % 360;

    return angleDegrees;

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

            // $.writeln('> Line: ' + [x1, y1] + ' to ' + [x2, y2]);


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
 * @param {Document} options.doc - an Illustrator Document.
 * @param {Pol} options.pol1 - the left polygon.
 * @param {Pol} options.pol2 - the right polygon.
 * @param {Boolean} [options.ignoreOverlappingItems] - whether to ignore cases where two items overlap (when there is negative distance between them) (default: false).
 * @param {Boolean} [options.drawBoundaryLines] - whether to draw the boundary lines (default: false).
 * @returns {?Number} - the distance between the two polygons.
 */
function getDistanceApart(options) {

    options = options || {};

    var pol1 = options.pol1,
        pol2 = options.pol2,
        ignoreOverlappingItems = true === options.ignoreOverlappingItems;
    drawBoundaryLines = true === options.drawBoundaryLines;

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
    var boundary1 = getBoundaryPoints(pathsLeft, extreme1, yValues, sortRight),
        boundary2 = getBoundaryPoints(pathsRight, extreme2, yValues, sortLeft);

    if (drawBoundaryLines) {
        // draw boundary lines
        drawPath(boundary1);
        drawPath(boundary2);
        // return;
    }

    var touchDistance = getMinDistanceBetweenMatchedPoints(boundary1, boundary2);

    if (overlap)
        // adjust for the earlier overlap correction
        touchDistance -= overlap;

    return touchDistance;


    /* ---------------------------------------------   */

    // draw the boundary just for debugging purposes
    function drawPath(path) {

        var boundaryItem = Bez.draw({
            doc: options.doc,
            paths: Bez.convertToPaths([path]),
            pathsClosed: [false],
            select: true,
        });

        boundaryItem.move(options.doc, ElementPlacement.PLACEATEND);

    };

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


/**
 * Returns an array of points derived
 * by intersecting "slices" at `yValues`
 * @param {Array<Array<point>>} paths - a paths/points array.
 * @param {Number} extreme - the extreme point of the boundary.
 * @param {Array<Number>} yValues - the y-axis slice positions.
 * @param {Function} sorter - a sorter used to sort each slice of points.
 * @returns {Array<point>}
 */
function getBoundaryPoints(paths, extreme, yValues, sorter) {

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