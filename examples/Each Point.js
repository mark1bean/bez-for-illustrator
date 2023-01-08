//@include '../library/Bez.js'


/**
 * Example using Bez.forEach.
 * Draws an arrow at each anchor point,
 * oriented to the path direction.
 * @author m1b
 * @version 2023-01-07
 * @requires Bez.js
 */
(function () {

    if (typeof Bez === 'undefined')
        throw Error('Cannot find the required script file "Bez.js".');

    var doc = app.activeDocument,
        items = itemsInsideGroupItems(doc.selection, ['PathItem', 'CompoundPathItem']);

    for (var i = 0; i < items.length; i++) {

        var group = doc.groupItems.add(),
            bez = new Bez({ pageItem: items[i] });

        bez.eachPoint({
            fn: drawIndicator,
            selectedSegmentsOnly: false
        });

    }

    /**
     * Example:
     * Draws arrows at each anchor point,
     * angled in the direction of the path.
     * @param {Document} doc
     * @param {BezPoint} [p0] - the point before the current point.
     * @param {BezPoint} p1 - the current point.
     * @param {BezPoint} [p2] - the point after the current point.
     * @param {Number} i - the forEach iterator number.
     */
    function drawIndicator(doc, p0, p1, p2, i) {

        var angle = Bez.getAngleOfPointP1(p1, p2);

        if (
            angle == undefined
            && p0 != undefined
        )
            // get the angle of the last point by
            // flipping the reverse angle of p0,p1
            angle = Bez.getAngleOfPointP1(p0, p1, false, true) + 180;

        // draw arrow
        var arrow = makeArrow({
            filled: false,
            stroked: true,
            strokeWidth: 0.5,
        });

        arrow.appearance.strokeColor = i === 0 ? getPink() : getCyan();

        // because no transform point is specified,
        // will transform around the arrow's transformPoint

        // transform but don't draw yet
        arrow.rotate({ angle: angle, redraw: false });
        arrow.scale({ scaleFactor: 1.5, redraw: false });

        // now draw the arrow
        arrow.draw({ container: group });


        /**
         * Make an arrow pointing towards
         * angle 0° with appearance properties.
         * @returns {Bez} - the arrow.
         */
        function makeArrow(appearance) {

            var x = p1.anchor[0],
                y = p1.anchor[1],

                points = [
                    [-1 + x, 1 + y],
                    [x, y],
                    [-1 + x, -1 + y]
                ];

            return new Bez(
                {
                    paths: [points],
                    pathsClosed: [false],
                    transformPoint: points[1],
                    appearance: appearance
                }
            );

        }

    };

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

})();