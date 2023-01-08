//@include '../library/Bez.js'

/**
 * Add path points between points.
 * @author m1b
 * @version 2022-12-31
 * @requires Bez.js
 */
(function () {

    if (typeof Bez === 'undefined')
        throw Error('Cannot find the required script file "Bez.js".');

    var doc = app.activeDocument,
        items = itemsInsideGroupItems(doc.selection, ['PathItem', 'CompoundPathItem']);

    if (items.length == 0) {
        alert('Please select one or more path items and try again.');
        return;
    }

    // var distance = Number(prompt('Enter the distance between added points:', 10));
    // var distance = 20;
    // if (
    //     distance == 0
    //     || isNaN(distance)
    // )
    //     return;

    for (var i = 0; i < items.length; i++) {

        var bez = new Bez({ pageItem: items[i] });

        bez.addExtraPointsBetweenPoints(
            {
                distance: 1,
                // filterFunction: Bez.isCurvedSegment
                // numberOfPoints: 3,
                // values: [0.1, 0.9],
                // lengths: [1, 2, -1],
            }
        );

    }


    // Some example filterFunctions:

    /**
     * Returns true only when the segment is sufficiently curved.
     * Note: this function returns a function closure containing
     * the `curveThreshold` parameter. So use *call* it (with
     * parameter) when you are passing the filterFunction.
     * @returns {Number}
     */
    function onlyCurvedSegmentsLargerThan(curveThreshold) {

        return function (p1, p2, segmentLength, distance, numberOfPoints, bounds) {

            var d1 = distanceBetweenPoints(p1.rightDirection, p1.anchor),
                d2 = distanceBetweenPoints(p2.leftDirection, p2.anchor);

            return (
                Math.abs(d1) > curveThreshold
                || Math.abs(d2) > curveThreshold
            );

        };

    };


    /**
     * Example custom filterFunction:
     * Returns spacing that approximates "distance" in points,
     * but only when the line p1p2 is horizontal or vertical.
     * @returns {Number}
     */
    function onlyHorizontalOrVerticalStraightLines(p1, p2, segmentLength, distance, numberOfPoints, bounds) {

        var angle = round(getAngleABC([p1.anchor[0] + 1, p1.anchor[1]], p1.anchor, p2.anchor), 2);

        return (
            Math.abs(angle) % 90 == 0
            && Bez.isStraightLineSegment(p1, p2)
        );

    };


})();