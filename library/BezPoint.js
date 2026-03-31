/**
 * @file BezPoint.js
 * A path-point data object that stores an anchor and its two
 * control handles (leftDirection, rightDirection), along with
 * transform methods that return new BezPoint instances.
 *
 * Requires BezUtils.js for distanceBetweenPoints and intermediatePoint.
 * Uses the Illustrator global enum PointType.
 *
 * @author m1b
 * @version 2026-03-30
 */

if ('undefined' === typeof _bezUtilsIncluded)
    $.evalFile(File($.fileName).parent + '/BezUtils.js');


/**
 * A path point object helper.
 * @constructor
 * @author m1b
 * @version 2026-03-31
 * @param {Object} p
 * @param {Array} p.anchor - anchor point [x, y].
 * @param {Array} [p.leftDirection] - left control point [x, y] (default: same as anchor).
 * @param {Array} [p.rightDirection] - right control point [x, y] (default: same as anchor).
 * @param {PointType} [p.pointType] - smooth or corner (default: corner).
 * @param {PathPoint} [p.pathPoint] - a PathPoint.
 */
function BezPoint(p) {

    p = p || {};

    var self = this;

    // if options is array of numbers
    if (p.constructor.name == 'Array') {

        if (p.length >= 2) {
            self.anchor = p.slice(0, 2);
        }
        if (p.length >= 4) {
            self.leftDirection = p.slice(2, 4);
        }
        if (p.length >= 6) {
            self.rightDirection = p.slice(4, 6);
        }

    }

    // if options is a PathPoint
    else if (p.constructor.name == 'PathPoint') {

        self.anchor = [p.anchor[0], p.anchor[1]];
        self.leftDirection = [p.leftDirection[0], p.leftDirection[1]];
        self.rightDirection = [p.rightDirection[0], p.rightDirection[1]];
        self.pointType = p.pointType;
        self.pathPoint = p;

    }

    // if it has an anchor, we'll eat it whole
    else if (p.hasOwnProperty('anchor')) {

        // add all the properties, eg. length, angle, break, etc.
        for (var key in p)
            if (p.hasOwnProperty(key)) {
                if (
                    self[key] != undefined
                    && self[key].constructor.name == 'Array'
                )
                    // de-reference arrays
                    self[key] = p[key].slice();
                else
                    self[key] = p[key];
            }

        if (self.pathPoint != undefined) {
            // get missing values from PathPoint
            if (self.anchor == undefined)
                self.anchor = [p.pathPoint.anchor[0], p.pathPoint.anchor[1]];
            if (self.leftDirection == undefined)
                self.leftDirection = [p.pathPoint.leftDirection[0], p.pathPoint.leftDirection[1]];
            if (self.rightDirection == undefined)
                self.rightDirection = [p.pathPoint.rightDirection[0], p.pathPoint.rightDirection[1]];
            self.pointType = self.pointType || p.pathPoint.pointType;
        }

    }

    else
        throw Error('BezPoint failed: bad parameter (' + p + ').');

    if (self.anchor == undefined)
        throw Error('BezPoint failed: no anchor supplied.');

    // for sanity
    self.leftDirection = self.leftDirection || self.anchor;
    self.rightDirection = self.rightDirection || self.anchor;
    self.pointType = self.pointType || PointType.CORNER;

};


/**
 * Returns string representation of BezPoint.
 * @returns {String}
 */
BezPoint.prototype.toString = function bezPointToString() {

    return '[BezPoint A:'
        + (Math.round(this.anchor[0] * 100) / 100)
        + ', '
        + (Math.round(this.anchor[1] * 100) / 100)
        + (this.break ? ' break' : '')
        + (this.sectionEnd ? ' sectionEnd' : '')
        + (this.closing ? ' closing' : '')
        + (this.noBreak ? ' noBreak' : '')
        + (this.note != undefined ? ' ' + this.note : '')
        + ']';

};


/**
 * Returns true when BezPoint has an extended left control point.
 * @returns {Boolean}
 */
BezPoint.prototype.hasLeftDirection = function hasLeftDirection() {
    return (
        this.anchor[0] != this.leftDirection[0]
        || this.anchor[1] != this.leftDirection[1]
    )
};


/**
 * Returns true when BezPoint has an extended right control point.
 * @returns {Boolean}
 */
BezPoint.prototype.hasRightDirection = function hasRightDirection() {
    return (
        this.anchor[0] != this.rightDirection[0]
        || this.anchor[1] != this.rightDirection[1]
    )
};


/**
 * Retracts the BezPoint's control points to the anchor.
 * @author mark1bean
 * @version 2022-12-30
 */
BezPoint.prototype.retractControlPoints = function () {

    var self = this;
    self.leftDirection = self.anchor;
    self.rightDirection = self.anchor;
    self.pointType = PointType.CORNER;

};


/**
 * Returns distance in points between this BezPoint and `point`.
 * @param {BezPoint|PathPoint|Array<Number>} point - the point to measure from.
 * @returns {Number}
 */
BezPoint.prototype.distanceFromPoint = function distanceFromPoint(point) {

    if (point.hasOwnProperty('anchor'))
        point = point.anchor;

    var self = this;
    return distanceBetweenPoints(self.anchor, point);

};


/**
 * Returns BezPoint interpolated at t between p1 and p2.
 * @param {BezPoint} p1
 * @param {BezPoint} p2
 * @param {Number} t - number in range 0..1.
 * @returns {BezPoint}
 */
BezPoint.bezPointFromInterpolation = function bezPointFromInterpolation(p1, p2, t) {

    return new BezPoint(
        {
            anchor: intermediatePoint(p1.anchor, p2.anchor, t),
            leftDirection: intermediatePoint(p1.leftDirection, p2.leftDirection, t),
            rightDirection: intermediatePoint(p1.rightDirection, p2.rightDirection, t),
            pointType: p1.pointType,
            pathPoint: undefined
        }
    );

};


/**
 * Returns true when this BezPoint is equal to `point`.
 * @param {BezPoint} point - the point to compare to.
 * @returns {Boolean}
 * @version 2026-03-31
 */
BezPoint.prototype.isEqualTo = function isEqualTo(point) {

    var self = this;

    return (
        self.anchor[0] === point.anchor[0]
        && self.anchor[1] === point.anchor[1]
        && self.leftDirection[0] === point.leftDirection[0]
        && self.leftDirection[1] === point.leftDirection[1]
        && self.rightDirection[0] === point.rightDirection[0]
        && self.rightDirection[1] === point.rightDirection[1]
        && self.pointType === point.pointType
    );

};


/**
 * Returns a new BezPoint that is this one scaled.
 * @author m1b
 * @version 2023-01-02
 * @param {Array<Number>} transformPoint - the point to scale around.
 * @param {Array<Number>} scaleFactor - the scale factors [sx, sy].
 * @returns {BezPoint}
 */
BezPoint.prototype.scale = function bezPointScale(transformPoint, scaleFactor) {

    var self = this;

    return new BezPoint(
        {
            anchor: getScaledPoint(self.anchor),
            leftDirection: getScaledPoint(self.leftDirection),
            rightDirection: getScaledPoint(self.rightDirection),
            pointType: self.pointType,
            pathPoint: self.pathPoint
        }
    );

    /**
     * Calculate the scaled point.
     * @param {Array<Number>} p - [x, y].
     * @returns {Array<Number>} - the scaled point [sx, sy].
     */
    function getScaledPoint(p) {
        return [
            (p[0] - transformPoint[0]) * scaleFactor[0] + transformPoint[0],
            (p[1] - transformPoint[1]) * scaleFactor[1] + transformPoint[1]
        ];
    }

};


/**
 * Returns a new BezPoint that is this one translated.
 * @author m1b
 * @version 2023-01-02
 * @param {Array<Number>} translation - the translation [tx, ty].
 * @returns {BezPoint}
 */
BezPoint.prototype.translate = function bezPointTranslate(translation) {

    var self = this;

    return new BezPoint(
        {
            anchor: getTranslatedPoint(self.anchor),
            leftDirection: getTranslatedPoint(self.leftDirection),
            rightDirection: getTranslatedPoint(self.rightDirection),
            pointType: self.pointType,
            pathPoint: self.pathPoint
        }
    );

    /**
     * Calculate the translated point.
     * @param {Array<Number>} p - [x, y].
     * @returns {Array<Number>} - the translated point.
     */
    function getTranslatedPoint(p) {
        return [p[0] + translation[0], p[1] + translation[1]];
    }

};


/**
 * Returns a new BezPoint that is this one rotated.
 * @author m1b
 * @version 2023-01-01
 * @param {Array<Number>} transformPoint - the point to rotate around.
 * @param {Number} angle - the angle to rotate, in degrees.
 * @returns {BezPoint}
 */
BezPoint.prototype.rotate = function bezPointRotate(transformPoint, angle) {

    var self = this,
        cx = transformPoint[0],
        cy = transformPoint[1],
        radians = (Math.PI / 180) * angle,
        cos = Math.cos(radians),
        sin = Math.sin(radians);

    return new BezPoint(
        {
            anchor: getRotatedPoint(self.anchor),
            leftDirection: getRotatedPoint(self.leftDirection),
            rightDirection: getRotatedPoint(self.rightDirection),
            pointType: self.pointType,
            pathPoint: self.pathPoint
        }
    );

    /**
     * Calculate the rotated point.
     * @param {Array<Number>} p - [x, y].
     * @returns {Array<Number>} - the rotated point [rx, ry].
     */
    function getRotatedPoint(p) {
        var x = p[0],
            y = p[1];

        return [
            (cos * (x - cx)) - (sin * (y - cy)) + cx,
            (cos * (y - cy)) + (sin * (x - cx)) + cy
        ];

    }

};


/**
 * Returns true when a stroke dash section should be
 * reset at this point, attempting to match Illustrator's
 * "Align stroke to corners and path ends" algorithm.
 * @author m1b
 * @version 2023-03-14
 * @param {BezPoint} p - a point.
 * @returns {Boolean}
 */
BezPoint.checkForDashCornerPoint = function bezPointAlignStrokeDashHere(p) {
    // if angle is too low, break section here
    return (Math.abs(p.angle) < 135);
};
