/*

    Bez
    For Adobe Illustrator

    A tool with some bezier-path-related functionality

    by m1b:
    https://community.adobe.com/t5/user/viewprofilepage/user-id/13791991

    Gratefully using bezier code by Hiroyuki Sato:
    https://github.com/Shanfan/Illustrator-Scripts-Archive/blob/master/jsx/Divide%20(length).jsx


    Terminology:
    Bez - a Bez instance can hold a reference to pathItem
    (and internal pathItems if compoundPathItem) and provides
    convenient access to the various Bez functionality
    BezSection - a section containing BezPoints
    BezPoint - a point, basically same as Illustrator's PathPoint

    path - the whole path, but only one path of a compound path
    section - part of a path, divided according to purpose,
              eg. for aligning dashes to corners
    segment - path segment defined by two points
    point - could mean a BezPoint, a PathPoint or a simple [x,y] array
    advance - a moving marker of position on path

*/




/**
 * Bez
 *
 * A path manipulation helper object.
 *
 * @param {Object} params
 * @param {[PathItem]} params.pathItem - a PathItem
 * @param {[Array[BezPoints]]} params.points - Array of BezPoints
 */
Bez = function (params) {
    /*
        A bez treats a pathItem as a compoundPathItem, so
        to access the Bez's paths, iterate over bez.pathItems
        in case the bez has multiple pathItems
        bez.pathItems, bez.pathPoints, bez.closed and bez.points
        share the same indexing, so bez.pathItems[i].closed === bez.closed[i]

        Usage example:
        var myBez1 = new Bez({ pathItem: item });

        or

        var myBez2 = new Bez({ points: myPointsArray });
        myBez2.draw();
    */

    if (
        params.pathItem == undefined
        && params.points == undefined
    )
        throw 'Could not make Bez because no pathItem or points were supplied.';

    if (params.points == undefined)
        this.pathItem = params.pathItem;

    if (params.points == undefined)
        // array of arrays of BezPoints for each pathItem
        this.points = [];
    else
        this.points = params.points

    // array of pathItems
    this.pathItems = [];
    // array of arrays of PathPoints for each pathItem
    this.pathPoints = [];
    // array of booleans
    this.closed = [params.closed == true];

    // store pathItem(s)
    if (this.pathItem != undefined) {
        if (params.pathItem.constructor.name == 'CompoundPathItem') {
            for (var i = 0; i < params.pathItem.pathItems.length; i++)
                this.pathItems[i] = params.pathItem.pathItems[i];
        }
        else if (params.pathItem.hasOwnProperty('pathPoints')) {
            this.pathItems = [params.pathItem];
        }

        // store points
        for (var i = 0; i < this.pathItems.length; i++) {
            this.pathPoints[i] = this.pathItems[i].pathPoints;
            this.points[i] = [];
            this.closed[i] = this.pathItems[i].closed == true;
            for (var j = 0; j < this.pathItems[i].pathPoints.length; j++)
                this.points[i][j] = BezPoint.convertPoint(this.pathItems[i].pathPoints[j]);
        }
    }
}



/**
 * Bez.drawDashes
 *
 * make pathItems based on points supplied
 * added to group supplied
 *
 * @param {Array[BezPoints]} points - BezPoints must be marked with `endOfDash` property
 * @param {Document} doc - the document
 * @param {GroupItem} group - the dashes will be added to this group
 * @param {BOOLEAN} closed - is the path closed
 * @param {BOOLEAN} alignDashes - dashes align to corners and path ends
 * @param {StrokeCap} strokeCap
 * @param {Color} strokeColor
 * @param {StrokeJoin} strokeJoin
 * @param {StrokeMiterLimit} strokeMiterLimit
 * @param {StrokeWidth} strokeWidth
 */
Bez.drawDashes = function (points, doc, group, closed, alignDashes, strokeCap, strokeColor, strokeJoin, strokeMiterLimit, strokeWidth) {
    closed = closed || false;
    alignDashes = alignDashes || false;
    strokeCap = strokeCap || StrokeCap.BUTTENDCAP;
    strokeJoin = strokeJoin || StrokeJoin.MITERENDJOIN;
    strokeMiterLimit = strokeMiterLimit || 4;
    strokeWidth = strokeWidth || 1;

    var pointStack = points.slice(),
        dashItems = [];

    if (closed == true && alignDashes == true) {
        // if closed and fitted path, rotate the stack
        // so first dash will be part of last dash
        var counter = 0;
        // rotate stack until first item is endOfDash
        while (pointStack[0].endOfDash != true) {
            pointStack.push(pointStack.shift());
            if (counter++ > pointStack.length) break;
        }
        counter = 0
        // rotate stack until first item isn't endOfDash
        while (pointStack[0].endOfDash == true) {
            pointStack.push(pointStack.shift());
            if (counter++ > pointStack.length) break;
        }
    }

    while (pointStack.length > 0) {

        // make the path item
        var item = doc.activeLayer.pathItems.add();
        item.filled = false;
        item.strokeDashes = [];
        item.strokeCap = strokeCap;
        item.strokeJoin = strokeJoin;
        item.strokeMiterLimit = strokeMiterLimit;
        item.strokeWidth = strokeWidth;

        if (strokeColor != undefined) {
            item.stroked = true;
            item.strokeColor = strokeColor;
        } else {
            item.stroked = false;
        }

        dashItems.push(item);

        // add to group
        item.move(group, ElementPlacement.PLACEATBEGINNING);

        // middle points
        var drawing = true
        while (drawing) {
            var p = pointStack.shift();
            if (pointStack.length == 0) {
                // end of path:
                drawing = false;

            } else if (pointsAreEqual(p.anchor, pointStack[0].anchor)) {
                // end of section, but don't stop drawing
                // here, because the two sections should be joined

                // join two overlapping points by give leftDirection
                // to next point and removing redundant point
                var left = p.leftDirection;
                p = pointStack.shift();
                p.leftDirection = left;

            } else {
                if (p.endOfDash == true)
                    // end of dash:
                    drawing = false;
            }

            addPoint(item, p);
        }
        item.closed = false;
    }

}



/**
 * Bez.pathItemsFromInterpolation
 *
 * Create pathItems by interpolating between 2 pathItems
 *
 * @param {PathItem} pathItem1
 * @param {PathItem} pathItem2
 * @param {[Number]} numberOfPaths - number of interpolated paths to create
 * @param {[Number]} t - number in range 0..1 or array of such numbers
 * @returns {PathItem[]} - Array of one or more PathItems
 * */
Bez.pathItemsFromInterpolation = function (pathItem1, pathItem2, numberOfPaths, t) {

    if (
        pathItem1 == undefined
        || pathItem2 == undefined
    ) {
        alert('Bez.pathItemsFromInterpolation failed: No path item.');
        return;
    }

    numberOfPaths = numberOfPaths || 1;

    // placement should be between path items in layer order
    var placement = (pathItem1.absoluteZOrderPosition < pathItem2.absoluteZOrderPosition)
        ? ElementPlacement.PLACEAFTER
        : ElementPlacement.PLACEBEFORE;

    if (t == undefined) {
        // make multiple interpolations
        var inc = 1 / (numberOfPaths + 1),
            items = [];

        //make items
        for (var i = 0; i < numberOfPaths; i++) {
            t = inc * (i + 1);
            items[i] = makePathItemInterpolated(pathItem1, pathItem2, t);
            items[i].move(pathItem2, placement)
        }
        return items;
    }

    else {
        // make one interpolation at t
        return [makePathItemInterpolated(pathItem1, pathItem2, t)];
    }

    function makePathItemInterpolated(pathItem1, pathItem2, t) {

        var bez1 = new Bez({ pathItem: pathItem1 }),
            bez2 = new Bez({ pathItem: pathItem2 }),
            pointCount = bez1.points[0].length,
            newPoints = [];

        if (bez1.points[0].length != bez2.points[0].length) {
            alert('Cannot interpolate due to incompatible anchor points.')
            return;
        }

        // calculate the points
        for (var i = 0; i < pointCount; i++)
            newPoints.push(BezPoint.bezPointFromInterpolation(bez1.points[0][i], bez2.points[0][i], t));

        var newBez = new Bez({ points: newPoints, closed: bez1.closed[0] });
        return newBez.draw();
    }

}



/**
 * Bez.getExtremaOfCurve
 *
 * Calculate t values of a segment's extrema
 *
 * @param {Array[4]} q - segment description - see Bez.getQ()
 * @param {Array} - the t values found
 */
Bez.getExtremaOfCurve = function (q) {
    // from Timo's answer here:
    // https://stackoverflow.com/questions/2587751/an-algorithm-to-find-bounding-box-of-closed-bezier-curves
    // based on python code by Nishio Hirokazu
    // modified by m1b to suit my needs
    var tValues = [],
        x0 = q[0][0], y0 = q[0][1],
        x1 = q[1][0], y1 = q[1][1],
        x2 = q[2][0], y2 = q[2][1],
        x3 = q[3][0], y3 = q[3][1],
        a, b, c, t, t1, t2, b2ac, sqrtb2ac;

    for (var i = 0; i < 2; ++i) {
        if (i == 0) {
            b = 6 * x0 - 12 * x1 + 6 * x2;
            a = -3 * x0 + 9 * x1 - 9 * x2 + 3 * x3;
            c = 3 * x1 - 3 * x0;
        } else {
            b = 6 * y0 - 12 * y1 + 6 * y2;
            a = -3 * y0 + 9 * y1 - 9 * y2 + 3 * y3;
            c = 3 * y1 - 3 * y0;
        }
        if (Math.abs(a) < 1e-12) {
            if (Math.abs(b) < 1e-12)
                continue;
            t = -c / b;
            if (0 < t && t < 1) {
                tValues.push(t);
            }
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
 * Bez.getK
 *
 * @param {Array[4]} q - segment description - see Bez.getQ()
 * @param {Array} - the k values
 */
Bez.getK = function (q) {
    var
        m = [
            q[3][0] - q[0][0] + 3 * (q[1][0] - q[2][0]),
            q[0][0] - 2 * q[1][0] + q[2][0],
            q[1][0] - q[0][0]
        ],
        n = [
            q[3][1] - q[0][1] + 3 * (q[1][1] - q[2][1]),
            q[0][1] - 2 * q[1][1] + q[2][1],
            q[1][1] - q[0][1]
        ],
        k = [
            m[0] * m[0] + n[0] * n[0],
            4 * (m[0] * m[1] + n[0] * n[1]),
            2 * ((m[0] * m[2] + n[0] * n[2]) + 2 * (m[1] * m[1] + n[1] * n[1])),
            4 * (m[1] * m[2] + n[1] * n[2]),
            m[2] * m[2] + n[2] * n[2]
        ];
    return k;
}



/**
 * Bez.getLength
 *
 * return the length of bezier curve segment
 *
 * @param {Array[5]} k - eg. output of Bez.getK()
 * @param {Number} t - number in range 0..1
 * @returns {Number} - length in points
 */
Bez.getLength = function (k, t) {
    var h = t / 128;
    var hh = h * 2;
    var fc = function (t, k) {
        return Math.sqrt(t * (t * (t * (t * k[0] + k[1]) + k[2]) + k[3]) + k[4]) || 0
    };
    var total = (fc(0, k) - fc(t, k)) / 2;
    for (var i = h; i < t; i += hh) {
        total += 2 * fc(i, k) + fc(i + h, k);
    }
    return total * hh;
}



/**
 * Bez.getQ
 *
 * get description segment
 * between two points
 *
 * @param {(BezPoint|PathPoint)} p1
 * @param {(BezPoint|PathPoint)} p2
 * @returns {Array[4]}
 */
Bez.getQ = function (p1, p2) {
    // accepts 2 BezPoints
    return [p1.anchor, p1.rightDirection, p2.leftDirection, p2.anchor];
}



/**
 * Bez.pointOnBezier
 *
 * Returns [x,y] coordinates of
 * a point on segment q at t
 *
 * @param {Array[4]} q - segment description - see Bez.getQ()
 * @param {Number} t - Number in range 0..1
 * @returns {Array[2]} - Array [x,y]
 */
Bez.pointOnBezier = function (q, t) {
    // return the [x, y] coordinate on the bezier curve
    // that corresponds to the paramter "t"
    var u = 1 - t;
    return [
        u * u * u * q[0][0] + 3 * u * t * (u * q[1][0] + t * q[2][0]) + t * t * t * q[3][0],
        u * u * u * q[0][1] + 3 * u * t * (u * q[1][1] + t * q[2][1]) + t * t * t * q[3][1]
    ];
}



/**
 * Bez.segmentLength
 *
 * Calculate length of path segment.
 *
 * @param {(BezPoint|PathPoint)} p1
 * @param {(BezPoint|PathPoint)} p2
 * @returns {Number} - segment length in points
 */
Bez.segmentLength = function (p1, p2) {
    return Bez.getLength(Bez.getK(Bez.getQ(p1, p2)), 1)
}



/**
 * Bez.splitSegment
 *
 * Calculate BezPoints after adding a
 * point to the segment at each tValue.
 *
 * Note: this doesn't do anything to
 * the associated path item
 *
 * @param {(BezPoint|PathPoint)} p1 - point at start of segment
 * @param {(BezPoint|PathPoint)} p2 - point at end of segment
 * @param {Array} tValues - array of numbers in range 0..1
 * @returns {Array[BezPoint]} - the points that make up the new multi-segment
 */
Bez.splitSegment = function (p1, p2, tValues) {
    // returns points after splitting at tValues
    if (p1 == undefined || p2 == undefined)
        throw 'Bez.splitSegment: supplied point is undefined.';
    var q = Bez.getQ(p1, p2),
        splitPoints = [],
        firstT = tValues[0],
        lastT = tValues[tValues.length - 1];

    // add start and end points to tValues
    tValues.unshift(0);
    tValues.push(1);

    // calculate the points at the split position
    if (pointsAreEqual(q[0], q[1]) && pointsAreEqual(q[2], q[3])) {
        // control points equal anchor points
        for (var j = 1; j < tValues.length - 1; j++) {
            var p = Bez.pointOnBezier(q, tValues[j]);
            splitPoints.push(new BezPoint(p, p, p, PointType.CORNER));
        }
    } else {
        for (var j = 1; j < tValues.length - 1; j++) {
            splitPoints.push(BezPoint.convertPoint(getDivPnt(q, tValues[j - 1], tValues[j], tValues[j + 1])));
        }
    }

    // adjust and add the first and last points
    var firstPoint = new BezPoint(p1.anchor, p1.leftDirection, scaleHandle(p1, 1, firstT), p1.pointType, p1.pathPoint),
        lastPoint = new BezPoint(p2.anchor, scaleHandle(p2, 0, 1 - lastT), p2.rightDirection, p2.pointType, p2.pathPoint);
    splitPoints.unshift(firstPoint);
    splitPoints.push(lastPoint);

    // finished
    return splitPoints;

    // helper functions
    function scaleHandle(p, n, scaleFactor) {
        // p = pathPoint or BezPoint,
        // n = 0:leftDir, 1:rightDir,
        // scaleFactor = magnification rate
        var handle = (n == 1 ? p.rightDirection : p.leftDirection);
        return [
            p.anchor[0] + (handle[0] - p.anchor[0]) * scaleFactor,
            p.anchor[1] + (handle[1] - p.anchor[1]) * scaleFactor
        ];
    }
    function getDivPnt(q, t0, t1, t2, anc) {
        // returns an array for properties of a pathpoint
        // that corresponds to the parameter "t1"
        // q=4 points, t0-2=parameters, anc=coordinate of anchor
        if (!anc) anc = Bez.pointOnBezier(q, t1);
        var r = defDir(q, 1, t1, anc, (t2 - t1) / (1 - t1)),
            l = defDir(q, 0, t1, anc, (t1 - t0) / t1);
        return [anc, l, r, PointType.SMOOTH];
    }
    function defDir(q, dir, t, anc, m) {
        // returns the [x, y] coordinate of the handle
        // of the point on the bezier curve
        // that corresponds to the parameter t
        // q=4 points, dir=0:left|1:right,
        // anc=anchor, m=magnification ratio
        var handle = [
            t * (t * (q[dir][0] - 2 * q[dir + 1][0] + q[dir + 2][0]) + 2 * (q[dir + 1][0] - q[dir][0])) + q[dir][0],
            t * (t * (q[dir][1] - 2 * q[dir + 1][1] + q[dir + 2][1]) + 2 * (q[dir + 1][1] - q[dir][1])) + q[dir][1]
        ];
        return [
            anc[0] + (handle[0] - anc[0]) * m,
            anc[1] + (handle[1] - anc[1]) * m
        ];
    }

} // end Bez.splitSegment



/**
 * Bez.tForLength
 *
 * Gets tValue (0..1) at len along segment.
 *
 * @param {Array[4]} q - segment description - see Bez.getQ()
 * @param {Number} len - length in points
 * @param {Array[5]} k - see Bez.getK()
 * @returns {Number} - number in range 0..1
 */
Bez.tForLength = function (q, len, k) {
    // when "len" is 0, return the length of whole this segment.
    k = k || Bez.getK(q);
    var fullLen = Bez.getLength(k, 1);

    if (len == 0) {
        return fullLen;
    } else if (len < 0) {
        len += fullLen;
        if (len < 0) return 0;
    } else if (len > fullLen) {
        return 1;
    }

    var t, d,
        t0 = 0,
        t1 = 1,
        tolerance = 0.001;

    for (var h = 1; h < 30; h++) {
        t = t0 + (t1 - t0) / 2;
        d = len - Bez.getLength(k, t);

        if (Math.abs(d) < tolerance) break;
        else if (d < 0) t1 = t;
        else t0 = t;
    }

    return t;
}



/**
 * Bez.prototype.redraw
 *
 * Updates this.pathItem using this.points.
 *
 * @param {BOOLEAN} select - select the pathItem afterwards
 */
Bez.prototype.redraw = function (select) {
    /* updates pathItem with this.points */

    for (var k = 0; k < this.pathItems.length; k++) {
        var pathPoints = this.pathPoints[k],
            points = this.points[k],
            closed = this.closed[k];

        if (closed) {
            // remove the last point, so it doesn't draw double
            var lastPoint = points[points.length - 1];
            points[0].leftDirection = lastPoint.leftDirection;
            points.pop();
        }

        // remove excess path points
        while (pathPoints.length > points.length)
            pathPoints[pathPoints.length - 1].remove();

        // replace path points with points
        // adding new path points as necessary
        for (var i = 0; i < points.length; i++) {
            var p = i < pathPoints.length ? pathPoints[i] : pathPoints.add();
            p.anchor = points[i].anchor;
            p.rightDirection = points[i].rightDirection;
            p.leftDirection = points[i].leftDirection;
            p.pointType = points[i].pointType;
            //not selected (just because it looks messy)
            p.selected = PathPointSelection.NOSELECTION
        }
    }

    if (select)
        this.pathItem.selected = true;
}



/**
 * Bez.prototype.addPathPointAtExtrema
 *
 * Adds new points at extrema of paths.
 *
 * @param {BOOLEAN} selectedSegmentsOnly - apply to just the selected segments
 */
Bez.prototype.addPathPointAtExtrema = function (selectedSegmentsOnly) {
    /*
        - iterate over the points, populating newPoints
          array, which includes added points (extrema)
        - if `selectedSegmentsOnly`, extrema are only
          calculated for selected segments
    */

    for (var k = 0; k < this.pathItems.length; k++) {
        var points = this.points[k],
            closed = this.closed[k],
            newPoints = [];

        if (closed == true) {
            // repeat the first point
            // as the end point
            points.push(points[0]);
        }

        pointsLoop:
        for (var i = 0; i < points.length - 1; i++) {

            var index1 = i,
                index2 = i + 1,
                p1 = points[index1],
                p2 = points[index2];

            if (
                selectedSegmentsOnly &&
                (
                    p1.pathPoint.selected == PathPointSelection.NOSELECTION
                    || p2.pathPoint.selected == PathPointSelection.NOSELECTION
                )
            ) {
                // segment wasn't selected
                // so just add point as is
                newPoints.push(p1);
                // add p2 if it's the last point
                if (i == points.length - 2)
                    newPoints.push(p2);
                continue pointsLoop;
            }

            // get tValues of extrema
            var q = Bez.getQ(p1, p2),
                tValues = Bez.getExtremaOfCurve(q);

            if (tValues.length == 0) {
                // no extrema found, so
                // just add point as is
                newPoints.push(p1);
                // add p2 if it's the last point
                if (i == points.length - 2)
                    newPoints.push(p2);
                continue pointsLoop;
            }

            // get the split points
            var splitPoints = Bez.splitSegment(p1, p2, tValues);

            // replace p1 and p2 with the adjusted p1 and p2
            points[index1] = splitPoints[0];
            points[index2] = splitPoints[splitPoints.length - 1];

            // add the split points to the new points
            newPoints = newPoints.concat(splitPoints);

            if (i < points.length - 2)
                // remove the last splitpoint (adjusted p2)
                // unless we're at the end of loop
                newPoints.pop();
        }

        // update the points
        this.points[k] = newPoints;
    }

    // redraw the pathItem
    this.redraw(true);
}


/**
 * Bez.prototype.select
 *
 * Selects this.pathItem.
 */
Bez.prototype.select = function () {
    this.pathItem.selected = true;
}



/**
 * Bez.prototype.draw
 *
 * Create a new path item of the bez,
 * but will not replace the bez's pathItem.
 * (see Bez.prototype.redraw)
 *
 * To Do: update this function to include
 * various appearance properties
 *
 * @param {Color} strokeColor
 * @returns {PathItem} the path item created
 */
Bez.prototype.draw = function (strokeColor) {
    // create path item
    var doc = app.activeDocument,
        item = doc.activeLayer.pathItems.add();

    if (this.closed[0] === true) {
        // remove the last point, so it doesn't draw double
        var lastPoint = this.points[this.points.length - 1];
        this.points[0].leftDirection = lastPoint.leftDirection;
        this.points.pop();
    }

    // add points to it
    for (var s = 1; s < this.points.length; s++) {
        var p1 = this.points[s - 1],
            p2 = this.points[s];
        if (s == 1) {
            // add p1 of first segment
            var _p1 = addPoint(item, p1);
            if (p1.previous != undefined)
                _p1.leftDirection = p1.previous.rightDirection;
        }
        // add p2
        _p2 = addPoint(item, p2);
    }
    item.closed = this.closed == true;

    return item;
} // end Bez.prototype.draw



/**
 * Bez.prototype.getSections
 * generates a BezSection for each
 * section according to the logic of
 * `Align dashes to corners and path ends`
 * @returns {Array[BezSection]} - array of BezSections
 */
Bez.prototype.getSections = function () {
    // assumes this.pathItems.length == 1
    var points = this.points[0].slice(),
        closed = this.closed[0];

    if (closed && this.alignDashes && !this.isClosedWithSingleSection) {
        // if closed path, sections much start
        // on an endOfSection, so if necessary
        // rotate the points stack
        while (points[0].endOfSection != true)
            points.push(points.shift());
    }

    if (closed == true) {
        // repeat the first point
        // as the end point
        points.push(points[0]);
    }

    var sections = [new BezSection()],
        section = sections[0];
    for (var i = 0; i < points.length - 1; i++) {
        p1 = points[i]
        p2 = points[i + 1];

        section.points.push(p1);

        // calculate length of this segment
        p2.length = Bez.segmentLength(p1, p2);
        // and length of section
        section.length += p2.length;

        if (p2.endOfSection == true || i == points.length - 2) {
            // add last point of section
            section.points.push(p2);

            if (p2.endOfSection == true && i != points.length - 2) {
                // start a new section
                sections.push(new BezSection());
                section = sections[sections.length - 1];
            }
        }
    }

    return sections;
}



/**
 * Bez.prototype.toString
 */
Bez.prototype.toString = function () {
    var list = ['[Bez'];
    for (var i = 0; i < this.points.length; i++) {
        list.push('  ' + i + ': ' + this.points[i] + ' ' + (this.points[i].angle ? round(this.points[i].angle, 6) + '\u00B0' : '') + (this.points[i].endOfSection ? ' endOfSection' : ''));
    }
    list.push(']')
    return list.join('\n');
}



/**
 * Bez.prototype.markSectionDivisions
 * mark points with `angle` and
 * `endOfSection` properties
 */
Bez.prototype.markSectionDivisions = function () {
    // all the dasher-related methods
    // assume this.pathItems.length == 1

    var points = this.points[0],
        pointCount = points.length,
        closed = this.closed[0];

    for (var i = 0; i < pointCount; i++) {
        if (
            (i == 0 && closed != true)
            || (i == pointCount - 1 && closed != true)
        )
            continue;

        // get three points to make angle
        var p0 = i == 0 ? points[pointCount - 1] : points[i - 1],
            p1 = points[i],
            p2 = i == pointCount - 1 ? points[0] : points[i + 1];

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
        // if angle is too low, break section here
        p1.endOfSection = Math.abs(p1.angle) < 135;
    }
}



/**
 * Bez.prototype.convertToDashes
 * Create actual paths to match
 * pathItem's dashed stroke
 * @requires Dasher.js - https://github.com/mark1bean/dasher-for-illustrator
 * @param {[Object]} options
 * @param {[Array]} options.pattern - array of dash|gap lengths
 * @param {[Boolean]} options.alignDashes - if true, align dashes to corners
 * @param {[Layer]} options.layer - Layer to place dashes
 * @param {[StrokeCap]} options.strokeCap - type of line capping
 * @param {[(Swatch|Color|Number)]} options.strokeColor - color of stroke
 * @param {[StrokeJoin]} options.strokeJoin - type of stroke join
 * @param {[Number]} options.strokeMiterLimit - mitre limit
 * @param {[Number]} options.strokeWidth - width of stroke in pts
 * If options are omitted script will use bez.pathItem's existing properties
 * @returns {Array[PathItem]} - the "dash" path items
 */
Bez.prototype.convertToDashes = function (options) {

    if (this.pathItem == undefined) return;
    if (Dasher == undefined)
        throw 'Missing dependency: Dasher.js.';

    options = options || {};

    // get the pattern from the stroke dashes
    var pattern = options.pattern;
    if (pattern == undefined)
        pattern = this.pathItem.strokeDashes;
    this.pattern = pattern;

    // get dash alignment
    var alignDashes = options.alignDashes;
    if (alignDashes == undefined)
        alignDashes = strokeDashesAreAligned(this.pathItem, false);
    this.alignDashes = alignDashes;

    var strokeCap = options.strokeCap || this.pathItem.strokeCap;
    var strokeJoin = options.strokeJoin || this.pathItem.strokeJoin;
    var strokeMiterLimit = options.strokeMiterLimit || this.pathItem.strokeMiterLimit;
    var strokeWidth = options.strokeWidth || this.pathItem.strokeWidth;

    var strokeColor = options.strokeColor;
    if (strokeColor != undefined) {
        if (strokeColor.constructor.name == 'Color') {
            item.strokeColor = strokeColor;
        } else if (strokeColor.constructor.name == 'Swatch') {
            item.strokeColor = strokeColor.color;
        } else if (strokeColor.constructor.name == 'Number') {
            item.strokeColor = doc.swatches[strokeColor].color;
        }
    } else {
        // apply the item's current strokeColor
        strokeColor = this.pathItem.strokeColor;
    }

    // make a DashPattern
    var dasher = new Dasher(pattern)
    if (dasher == undefined)
        throw 'Could not make Dasher with ' + pattern;
    if (alignDashes) {
        // mark all the corners for dash fitting
        this.markSectionDivisions();
    }

    // gather the points into sections
    var sections = this.getSections();
    if (sections.length == 0) throw 'Error: no sections found.';

    // get item's document
    var doc = getParentDocument(this.pathItem);

    // group to contain dashes
    var group = doc.activeLayer.groupItems.add();
    // group.name = '<Dashes>';

    if (options.layer != undefined && options.layer.constructor.name == 'Layer') {
        // add to layer
        group.move(options.layer, ElementPlacement.PLACEATEND);
    } else {
        // add before item
        group.move(this.pathItem, ElementPlacement.PLACEBEFORE);
    }

    // closed, non-cornered paths don't split
    // the first dash between start and end
    this.isClosedWithSingleSection = (
        this.pathItem.closed == true
        && sections.length == 1
    )

    var dashPoints = [];

    // for each section:
    for (var i = 0; i < sections.length; i++) {
        var section = sections[i];

        // calculate a stack of dash lengths
        var dashStack;
        if (alignDashes) {
            // this method aligns dashes with corners
            // and scales dash|gaps to fit section
            dashStack = dasher.alignedPatternForLength(section.length, this.isClosedWithSingleSection);
        } else {
            // this method conserves actual dash|gap lengths
            dashStack = dasher.basicPatternForLength(section.length);
        }

        // get path points for dash lengths
        dashPoints = dashPoints.concat(section.getDashPoints(dashStack, alignDashes));

        if (dashPoints.length == 0) return;

        // mark the last point as end of section
        dashPoints[dashPoints.length - 1].endOfSection = true;
    }

    // draw the dashes as pathItems
    var dashItems = Bez.drawDashes(dashPoints, doc, group, this.pathItem.closed, alignDashes, strokeCap, strokeColor, strokeJoin, strokeMiterLimit, strokeWidth);

    this.pathItem.selected = false;
    group.selected = true;

    return dashItems;

} // end Bez.convertToDashes




/**
 * BezSection
 * Object representing a section
 * of a path of segments.
 */
BezSection = function () {
    this.points = [];
    this.length = 0;
    this.dashStack = [];
}



/**
 * BezSection.prototype.getDashPoints
 * Calculate points from which
 * dashes will be constructed
 * @param {Array} dashStack - array of dash lengths (eg. output from Dasher.js)
 * @param {[Boolean]} alignDashes - if true, align dashes to corners
 * @returns {Array} - array of points
 */
BezSection.prototype.getDashPoints = function (dashStack, alignDashes) {

    if (dashStack == undefined || dashStack.length == 0)
        return [];

    // add a zero dashLength to start of dashStack
    dashStack.unshift(0);

    // remove the last dash length; later it
    // will be replaced by last section point
    var lastDashLength;
    if (alignDashes) lastDashLength = dashStack.pop();

    // the points of this section
    var pointStack = this.points.slice(),
        dashPoints = [];

    // an alternator for the dashStack (1=dash, 0=gap)
    var dashOrGap = 1;

    // the segment's two points
    var p1, p2;

    pointLoop:
    while (pointStack.length > 1) {

        // segment points p1 and p2
        p1 = pointStack.shift();
        p2 = pointStack[0];

        // the length in pts of this path segment
        var segmentLength = p2.length;
        // the position in pts along this path segment
        var segmentAdvance = 0;

        // while the dash falls inside this segment
        dashLoop:
        while (segmentAdvance + dashStack[0] < segmentLength) {

            // bezier details
            var q = Bez.getQ(p1, p2),
                k = Bez.getK(q);

            // the next dash length
            var dashLength = dashStack.shift();

            if (dashLength == 0) {
                dashPoints.push(p1);
                continue dashLoop;
            }

            // get points resulting after splitting segment at dashLength
            var t = Bez.tForLength(q, dashLength, k),
                splitPoints = Bez.splitSegment(p1, p2, [t]);

            // update previous dashPoint's handles
            if (dashOrGap == 1)
                with (dashPoints[dashPoints.length - 1]) {
                    leftDirection = splitPoints[0].leftDirection;
                    rightDirection = splitPoints[0].rightDirection;
                }

            // add the new dashPoint
            dashPoints.push(splitPoints[1]);

            // update next point
            pointStack[0] = splitPoints[2];

            // split becomes new segment
            p1 = dashPoints[dashPoints.length - 1];
            p2 = pointStack[0];

            // flag if end of dash
            dashPoints[dashPoints.length - 1].endOfDash = (dashOrGap == 1);

            // advance
            segmentAdvance += dashLength;

            // alternate dash|gap
            dashOrGap = toggle(dashOrGap);

        } // end dashLoop (end of segment)

        if (dashOrGap == 1) {
            // add existing path point as part of dash
            dashPoints.push(pointStack[0]);
        }

        // shorten the dash that was interrupted
        dashStack[0] += segmentAdvance - segmentLength;

    } // end pointLoop

    dashPoints[dashPoints.length - 1].endOfDash = true;

    if (alignDashes) segmentAdvance += lastDashLength;

    return dashPoints;
}



/**
 * BezSection.prototype.toString
 */
BezSection.prototype.toString = function () {
    var dashPointsPrintout = '';
    if (this.dashes != undefined) {
        dashPointsPrintout = this.dashes;
        dashPointsPrintout.unshift('-\nDash Points:');
        dashPointsPrintout = dashPointsPrintout.join('\n')
    }
    return this.points.join('\n') + (dashPointsPrintout.length > 0 ? ('\n' + dashPointsPrintout) : '');
}






/**
 * BezPoint
 * A point object
 * @param {Array[2]} anchor - anchor point
 * @param {Array[2]} leftDirection - left control point
 * @param {Array[2]} rightDirection - right control point
 * @param {PointType} pointType - smooth or corner
 * @param {[PathPoint]} pathPoint - a PathPoint
 */
BezPoint = function (anchor, leftDirection, rightDirection, pointType, pathPoint) {
    this.anchor = anchor;
    this.leftDirection = leftDirection || anchor;
    this.rightDirection = rightDirection || anchor;
    this.pointType = pointType;
    this.pathPoint = pathPoint;
}



/**
 * BezPoint.convertPoint
 * @param {(PathPoint|Array[4])} p - PathPoint or [anchor,leftDir,rightDir,pointType]
 * @returns {BezPoint}
 */
BezPoint.convertPoint = function (p) {
    if (p == undefined) return;
    if (p.hasOwnProperty('anchor')) {
        return new BezPoint(p.anchor, p.leftDirection, p.rightDirection, p.pointType, p);
    } else {
        if (p.length == 4) {
            return new BezPoint(p[0], p[1], p[2], p[3]);
        } else {
            throw 'Cannot make BezPoint from array with ' + p.length + ' elements.';
        }
    }
}



/**
 * BezPoint.bezPointFromInterpolation - make interpolated BezPoint
 * @param {BezPoint} p1
 * @param {BezPoint} p2
 * @param {Number} t - number in range 0..1 or array of such numbers
 * @returns {BezPoint}
 */
BezPoint.bezPointFromInterpolation = function (p1, p2, t) {
    return new BezPoint(
        /* anchor    */ intPoint(p1.anchor, p2.anchor, t),
        /* left      */ intPoint(p1.leftDirection, p2.leftDirection, t),
        /* right     */ intPoint(p1.rightDirection, p2.rightDirection, t),
        /* pointType */ p1.pointType,
        /* pathPoint */ undefined
    );

    function intPoint(p1, p2, t) {
        // expects 2-element arrays for p1 and p2
        // expects t in range 0..1
        return [
            (p2[0] - p1[0]) * t + p1[0],
            (p2[1] - p1[1]) * t + p1[1]
        ];
    }
}




/**
 * BezPoint.prototype.toString
 */
BezPoint.prototype.toString = function () {
    var list = [
        '[BezPoint',
        'A:' + round(this.anchor),
        'L:' + round(this.leftDirection),
        'R:' + round(this.rightDirection),
        this.pointType
    ];
    if (!this.hasRightDirection())
        list.splice(3, 1);
    if (!this.hasLeftDirection())
        list.splice(2, 1);
    list = list.join(' ')
        + (this.endOfDash ? ' endOfDash' : '')
        + (this.endOfSection ? ' endOfSection' : '')
        + ']';
    return list;
}



/**
 * BezPoint.prototype.hasLeftDirection
 * @returns {Boolean}
 */
BezPoint.prototype.hasLeftDirection = function () {
    return (
        this.anchor[0] != this.leftDirection[0]
        || this.anchor[1] != this.leftDirection[1]
    )
}



/**
 * BezPoint.prototype.hasRightDirection
 * @returns {Boolean}
 */
BezPoint.prototype.hasRightDirection = function () {
    return (
        this.anchor[0] != this.rightDirection[0]
        || this.anchor[1] != this.rightDirection[1]
    )
}




// functions:

/**
 * addPoint
 * Adds a new PathPoint to an item
 * @param {PathItem} item - the target path item
 * @param {(BezPoint|PathPoint)} p - the point to add
 */
function addPoint(item, p) {
    if (p == undefined) return;
    newPoint = item.pathPoints.add();
    newPoint.anchor = p.anchor;
    newPoint.leftDirection = p.leftDirection;
    newPoint.rightDirection = p.rightDirection;
    newPoint.pointType = p.pointType;
    return newPoint;
}



/**
 * strokeDashesAreAligned
 * This function returns true if the item's stroke
 * dash alignment is set to 'aligning to corners
 * and path ends, adjusting lengths to fit'.
 *
 * At this time there is no API access to this setting
 * so this method is quite hacky: it converts a model
 * duplicate of the item into outline stroke
 * and counts the number of dashes.
 * @param {PathItem} item - path item or compoundPathItem with dashed stroke
 * @param {Boolean} keepSelection - don't discard current selection
 */
function strokeDashesAreAligned(item, keepSelection) {

    if (
        item == undefined || !(item.hasOwnProperty('pathPoints') || item.hasOwnProperty('pathItems'))
    )
        return;

    var dashesAreAligned;

    // we only worry about storing the
    // selection because the outline
    // stroke test later destroys it
    keepSelection = keepSelection || true;
    var doc = getParentDocument(item),
        selectedItems = [];
    if (keepSelection) {
        for (var i = 0; i < doc.selection.length; i++) {
            selectedItems.push(doc.selection[i]);
        }
    }

    if (item.typename == 'CompoundPathItem') {

        // COMPOUND PATH ITEM

        if (
            item.pathItems[0].stroked == false
            || item.pathItems[0].strokeDashes.length == 0
        ) return;

        // duplicate
        var dup = item.duplicate();
        doc.selection = null;
        dup.selected = true;
        // uncompound
        app.executeMenuCommand('noCompoundPath');
        // collect the resulting path items
        var pathItemsToDelete = [];
        for (var i = 0; i < doc.selection.length; i++)
            pathItemsToDelete.push(doc.selection[i]);

        // get result on just the first path
        dashesAreAligned = strokeDashesAreAligned(pathItemsToDelete[0], keepSelection);

        // remove uncompounded duplicates
        for (var i = pathItemsToDelete.length - 1; i >= 0; i--)
            pathItemsToDelete[i].remove();

    } else {

        // PATH ITEM

        if (
            item.stroked == false
            || item.strokeDashes.length == 0
        ) return;

        // duplicate item
        var modelPathItem = item.duplicate();

        // standardise model
        var standardPoints = [[0, 0], [3, 0]];
        modelPathItem.filled = false;
        modelPathItem.stroked = true;
        modelPathItem.strokeWidth = 0.1;
        modelPathItem.strokeDashes = [1];
        modelPathItem.closed = false;
        for (var i = modelPathItem.pathPoints.length - 1; i >= 0; i--) {
            if (i >= standardPoints.length) {
                modelPathItem.pathPoints[i].remove();
            } else {
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
        var dashesAreAligned = modelPathItem.pathItems.length == 3;

        // remove the model and reselect the original
        modelPathItem.remove();

        // re-instate inital selection
        for (var i = 0; i < selectedItems.length; i++) {
            selectedItems[i].selected = true;
        }
    }

    return dashesAreAligned;
}



/**
 * toggle
 * cycle value n between m values
 * eg. toggle(0,2) // 1
 *     toggle(1,2) // 0
 * @param {Number} n - the value
 * @param {Number} m - number of values
 */
function toggle(n, m) {
    m = m || 2;
    return (n + 1) % m;
}



/**
 * round
 * Rounds a single number or an array of numbers
 * @param {(Number|Array[Number])} nums - the number or numbers to round
 * @param {places} places - decimal places
 * @returns {(Number|Array[Number])} the rounded number or numbers
 */
function round(nums, places) {
    places = Math.pow(10, places || 1);
    var result = [];
    if (nums.constructor.name != 'Array') nums = [nums];
    for (var i = 0; i < nums.length; i++) {
        result[i] = Math.round(nums[i] * places) / places;
    }
    return nums.length == 1 ? result[0] : result;
}



/**
 * getAngleABC
 * returns angle ABC in degrees
 * @param {Array[2]} a - point [x, y]
 * @param {Array[2]} b - point [x, y]
 * @param {Array[2]} c - point [x, y]
 */
function getAngleABC(a, b, c) {
    var ab = [b[0] - a[0], b[1] - a[1]];
    var cb = [b[0] - c[0], b[1] - c[1]];
    var dot = (ab[0] * cb[0] + ab[1] * cb[1]);
    var cross = (ab[0] * cb[1] - ab[1] * cb[0]);
    var alpha = Math.atan2(cross, dot);
    return alpha * 180 / Math.PI;
}



/**
 * pointsAreEqual
 * @param {Array[2]} p1 - point [x, y]
 * @param {Array[2]} p2 - point [x, y]
 * @returns {Boolean}
 */
function pointsAreEqual(p1, p2) {
    return p1[0] == p2[0] && p1[1] == p2[1];
}



/**
 * getParentDocument
 * @param {PageItem} obj - a page item
 * @returns {Document} the page item's document
 */
function getParentDocument(obj) {
    while (obj.hasOwnProperty('parent') && obj.constructor.name != 'Document')
        obj = obj.parent;
    return obj;
}



/**
 * itemsInsideGroupItems
 * Returns array containing items, including
 * items found inside GroupItems
 *
 * Example usage:
 * var items = itemsInsideGroupItems(doc.selection, ['PathItem', 'CompoundPathItem']);
 *
 * @param {Array[PathItem]} items - path items
 * @param {[(String|Array[String])]} typenames - item constructor names to target
 * @param {[level]} level - recursion level (private parameter)
 * @returns {Array[PathItem]} the path items found
 */
function itemsInsideGroupItems(items, typenames, level) {
    try {
        if (level == undefined) level = 0;
        var found = [];
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (item.uuid != undefined) {
                if (item.typename == 'GroupItem') {
                    found = found.concat(itemsInsideGroupItems(item.pageItems, typenames, level + 1));
                } else if (typenames === undefined || itemIsType(item, typenames)) {
                    found.push(item);
                }
            }
        }
        return found;
    } catch (err) {
        alert('itemsInsideGroupItems: ' + err)
    }
}



/**
 * itemIsType
 * returns true if item.typename matches any of the typenames
 * @param {PathItem} item - a path item
 * @param {[(String|Array[String])]} typenames - item constructor names to target
 * @returns {Boolean}
 */
function itemIsType(item, typenames) {
    // returns true if item.typename matches any of the typenames
    if (item === undefined) throw 'itemIsType: No item supplied.';
    if (typenames === undefined) throw 'itemIsType: No typenames supplied.';
    if (typenames.constructor.name != 'Array') typenames = [typenames];
    var matched = false;
    for (var i = 0; i < typenames.length; i++) {
        if (typenames[i] == item.typename) {
            matched = true;
            break;
        }
    }
    return matched;
}


var inch = 72;
var mm = 2.834645669;
