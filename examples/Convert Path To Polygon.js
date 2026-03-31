if ('undefined' === typeof Bez) {
    //@include '../library/Bez.js'
}

/**
 * Convert Selected Paths to Polygons
 * @author m1b
 * @version 2022-12-23
 * @requires Bez.js
 */
(function () {

    var doc = app.activeDocument;
    var bezs = Bez.fromItems(doc.selection);

    if (bezs.length == 0) {
        alert('Please select a path item and try again.');
        return;
    }

    var exampleIndex = prompt('Choose an example from 1 to 5', 1);
    if (
        exampleIndex
        && !isNaN(Number(exampleIndex))
    ) {
        // run an example function
        var example = [
            example1, // Ask user to choose distance between added path points.
            example2, // Ask user to choose how many path points to add to each segment, apply to curved segments only.
            example3, // Ask user to choose values of path points to add to each segment.
            example4, // Ask user to choose lengths of path points to add to each segment, but only on horizontal or vertical straight lines.
            example5, // Add points at set distance, but with easing valueFunction.
        ][Number(exampleIndex) - 1];

        if ('function' === typeof example)
            example();

    }

    /**
     * Applies convertToPolygon options to all selected items.
     * @param {Object} options - options passed to bez.convertToPolygon.
     */
    function applyToAll(options) {

        for (var i = 0; i < bezs.length; i++)
            bezs[i].convertToPolygon(options);

    };

    /**
     * Example 1:
     * Ask user to choose distance between added path points.
     */
    function example1() {

        var distance = Number(prompt('Enter the distance between added points:', 10));
        if (
            distance == 0
            || isNaN(distance)
        )
            return;

        applyToAll({ distance: distance, filterFunction: Bez.isCurvedSegment });

    };

    /**
     * Example 2:
     * Ask user to choose how many path points to add to each segment, apply to curved segments only.
     */
    function example2() {

        var numberOfPoints = Number(prompt('Enter the number of path points to add to each segment:', 3));

        if (
            numberOfPoints == 0
            || isNaN(numberOfPoints)
        )
            return;

        applyToAll(
            {
                numberOfPoints: numberOfPoints,
                filterFunction: Bez.isCurvedSegment,
            }
        );

    };


    /**
     * Example 3:
     * Ask user to choose values of path points to add to each segment.
     */
    function example3() {

        var values = [],
            userValues = (prompt('Enter position values in range -1..1, separated by commas:', '0.45, 0.5, 0.55') || '').split(/,\s*/g);

        for (var i = 0; i < userValues.length; i++) {

            var v = Number(userValues[i]);

            if (
                isNaN(v)
                || v <= -1
                || v >= 1
            )
                continue;

            values.push(v);

        }

        if (values.length == 0)
            return;

        applyToAll({ values: values });

    };


    /**
     * Example 4:
     * Ask user to choose lengths of path points to add to each segment.
     * Filter so only apply to segments which are vertical or horizontal straight lines.
     */
    function example4() {

        var lengths = [],
            userValues = (prompt('Enter lengths, in pts, separated by commas:', '25, 50, -25, -50') || '').split(/,\s*/g);

        for (var i = 0; i < userValues.length; i++) {

            var v = Number(userValues[i]);

            if (!isNaN(v))
                lengths.push(v);

        }

        if (lengths.length == 0)
            return;

        applyToAll({ lengths: lengths, filterFunction: onlyHorizontalOrVerticalStraightLines });

    };


    /**
     * Example 5:
     * Add points at set distance, but with easing valueFunction.
     */
    function example5() {

        applyToAll(
            {
                distance: 25,
                valueFunction: easeInOutQuad,
            }
        );

    };

    /**
     * Example custom filterFunction:
     * Returns true only when the segment has control points
     * longer than `curveThreshold`.
     * Note: this function returns a function closure containing
     * the `curveThreshold` parameter. So *call* it (with curveThreshold
     * parameter) when you are passing the filterFunction.
     * @returns {Function}
     */
    function onlyCurvedSegmentsLargerThan(curveThreshold) {

        // returns a function with curveThreshold set
        return (
            /**
             *
             * @param {PathPoint} p1 - first path point.
             * @param {PathPoint} p2 - second path point.
             * @returns {Boolean}
             */
            function (p1, p2,) {

                var d1 = distanceBetweenPoints(p1.rightDirection, p1.anchor),
                    d2 = distanceBetweenPoints(p2.leftDirection, p2.anchor);

                return (
                    Math.abs(d1) > curveThreshold
                    || Math.abs(d2) > curveThreshold
                );

            }

        );

    };


    /**
     * Example custom filterFunction:
     * Returns true only when the line p1p2
     * is perfectly horizontal or vertical.
     * @returns {Boolean}
     */
    function onlyHorizontalOrVerticalStraightLines(p1, p2) {

        var angle = round(getAngleABC([p1.anchor[0] + 1, p1.anchor[1]], p1.anchor, p2.anchor), 2);

        return (
            Math.abs(angle) % 90 == 0
            && Bez.isStraightLineSegment(p1, p2)
        );

    };


    /**
     * Example custom valueFunction.
     * See Ease.js for more examples.
     * @param {Number} t - number in range 0..1.
     * @returns {Number}
     */
    function easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : - 1 + (4 - 2 * t) * t;
    };


})();