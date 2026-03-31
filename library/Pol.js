if ('undefined' === typeof _bezUtilsIncluded)
    $.evalFile(File($.fileName).parent + '/BezUtils.js');

if ('undefined' === typeof Mat)
    $.evalFile(File($.fileName).parent + '/Mat.js');

/**
 * Pol - A general purpose simple-polygon manipulation helper object.
 *
 * Notes:
 * Pol treats every pathItem as a compoundPathItem, so
 * to access the Pol's paths, iterate over pol.paths.
 * We call this a path/points array, eg. second point of
 * first path is pol.paths[0][1].
 *
 * pol.pathsClosed[i] and pol.paths[i] share the same indexing.
 *
 *   Example 1. Make Pol from a page item (via Bez):
 *     var bez = new Bez({ pageItem: item });
 *     var pol = new Pol({ paths: bez.getPolygon({ flatness: 2 }), pathsClosed: bez.pathsClosed });
 *
 *   Example 2. Make Pol from array of "paths" which are arrays of points
 *     var pol = new Pol({ paths: myPathsArray });
 *
 * To draw the polygon to a new (separate) path item, use the static Pol.draw,
 * but to update the pol's own page item, use the pol.draw.
 *
 * @author m1b
 * @version 2026-03-31
 * @constructor
 * @param {Object} options
 * @param {Array<Array<point>>} [options.paths] - a paths/points array.
 * @param {Function} [options.pathItemFilter] - a function that, given a PathItem, returns true or false. False pathItems will be ignored. (default: no filter).
 * @param {Array<Boolean>} [options.pathsClosed] - array showing which paths are closed.
 */
function Pol(options) {

    var self = this;

    self.doc = options.doc;

    self.paths = options.paths ? copyArrays(options.paths) : []; // the paths/points array
    self.pathsClosed = []; // the closed-ness of each path
    self.pathsPolarity = []; // the polarity of each path

    self.absoluteRotationAngle = options.absoluteRotationAngle || 0;
    self.rotationOffsetFromDatum = options.rotationOffsetFromDatum || 0;
    self.transformPoint = options.transformPoint;
    self.pathItemFilter = options.pathItemFilter;
    self.appearance = options.appearance || {};

    if (self.paths.length == 0 && undefined == options.pathsClosed)
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
        y = point[1];

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

        if (inside)
            break pathsLoop;

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

// Pol.prototype.getConvexHull — see PolAlgorithms.js

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

// Pol.doPolygonsOverlap — see PolAlgorithms.js

// Pol.doPolygonsOverlapAsConvexHulls, Pol.decomposePolygonIntoConvexPieces — see PolAlgorithms.js

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
 * @param {Function} [options.filter] - a function, given the point, that decides whether to rotate the point (default: undefined).
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
 * @param {Function} [options.filter] - a function, given a point, that decides whether to scale the point (default: undefined).
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
        filter = options.filter,
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
                filter != undefined
                && filter(p) == false
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
 * @param {Function} [options.filter] - a function, given a point, that decides whether to scale the point (default: undefined).
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
        filter = options.filter,
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
                filter != undefined
                && filter(p) == false
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
 * Returns a deep copy of pol's paths.
 * @returns {Array<polygon>}
 */
Pol.prototype.copyPaths = function copyPaths() {

    var self = this;

    return copyArrays(self.paths)

};

// Pol.prototype.getBoundaryPoints — see PolAlgorithms.js

// Pol.getBoundaryPoints, Pol.getLineLineCollision — see PolAlgorithms.js

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

// getSorterForAngle, angleOfLine, getMinDistanceBetweenMatchedPoints — see PolAlgorithms.js
// findIntersectionPoints, getDistanceApart, getBoundaryPointsForSlices — see PolAlgorithms.js
// concatPaths — see BezUtils.js

if ('undefined' === typeof _polAlgorithmsIncluded)
    $.evalFile(File($.fileName).parent + '/PolAlgorithms.js');