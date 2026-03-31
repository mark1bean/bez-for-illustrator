if ('undefined' === typeof Bez) {
    //@include '../library/Bez.js'
}
if ('undefined' === typeof polylabel) {
    //@include '../library/PolyLabel.js'
}

/**
 * Finds the visual center of selected path item and, for demonstration purposes,
 * draws pink circle showing size and position of visual center, and labels with the radius, fitted inside circle.
 * @author m1b
 * @version 2026-03-31
 * @requires Bez.js
 * @requires PolyLabel.js by Volodymyr Agafonkin. https://github.com/mapbox/polylabel
 */
(function () {

    var doc = app.activeDocument;
    var bezs = Bez.fromItems(doc.selection);
    var pink = getPink();
    var white = getWhite();

    for (var i = 0; i < bezs.length; i++) {

        var bez = bezs[i];

        // approximate best flatness value
        var b = bez.pageItem.geometricBounds;
        var goodEnoughFlatness = Math.max(b[2] - b[0], b[1] - b[3]) / 20;

        var vc = bez.findVisualCenter({ flatness: goodEnoughFlatness, precision: 0.2 });

        if (vc == undefined)
            continue;

        // these are just examples of doing something with the result:

        // draw a pink circle, to show visual center
        drawCircle(doc, vc.center, vc.radius, pink);

        // scale an example textFrame to fit in visual center
        var tf = doc.textFrames.add();
        tf.contents = String(Math.round(vc.radius));
        tf.textRange.tracking = 0;
        tf.textRange.paragraphAttributes.justification = Justification.CENTER;
        tf.textRange.fillColor = white;
        fitTextInCircle({ textFrame: tf, circle: vc, margin: 0.5 });

    }

    /**
     * Scales the textFrame to fit inside the supplied circle.
     * @author m1b
     * @version 2022-12-21
     * @param {Object} options
     * @param {TextFrame} options.textFrame - an Illustrator TextFrame object.
     * @param {Object} options.circle - an object representing a circle {center: [x, y], radius: r}.
     * @param {Number} [options.margin] - amount of empty space around text frame (default: 0).
     */
    function fitTextInCircle(options) {

        options = options || {};

        var textFrame = options.textFrame;
        var circle = options.circle;
        var margin = options.margin || 0;
        var dup = textFrame.duplicate().createOutline();
        var bounds = dup.visibleBounds;
        var textCenter = [bounds[0] + ((bounds[2] - bounds[0]) / 2), bounds[1] + ((bounds[3] - bounds[1]) / 2)];
        var diag = distanceBetweenPoints([bounds[0], bounds[1]], [bounds[2], bounds[3]]);
        var scaleFactor = ((circle.radius - margin) * 2) / diag;

        dup.remove();

        textFrame.translate(-textCenter[0], -textCenter[1]);
        textFrame.resize(scaleFactor * 100, scaleFactor * 100, undefined, undefined, undefined, undefined, undefined, Transformation.DOCUMENTORIGIN);
        textFrame.translate(circle.center[0], circle.center[1]);

    };

    /**
     * Draws a circle in the Illustrator document.
     * @param {Document} doc - an Illustrator Document.
     * @param {Array<Number>} center - center of circle [x, y].
     * @param {Number} radiusDegrees - radius of circle.
     * @param {Color} col - the circle fillColor.
     * @returns {PathItem}
     */
    function drawCircle(doc, center, radiusDegrees, col) {
        var circle = doc.pathItems.ellipse(center[1] + radiusDegrees, center[0] - radiusDegrees, radiusDegrees * 2, radiusDegrees * 2);
        circle.stroked = false;
        circle.filled = true;
        circle.fillColor = col;
        return circle;
    };

    /**
     * @returns {CMYKColor} - pink.
     */
    function getPink() {
        var c = new CMYKColor();
        c.cyan = 0;
        c.magenta = 100;
        c.yellow = 20;
        c.black = 0;
        return c;
    };

    /**
     * @returns {CMYKColor} - white.
     */
    function getWhite() {
        var c = new CMYKColor();
        c.cyan = 0;
        c.magenta = 0;
        c.yellow = 0;
        c.black = 0;
        return c;
    };

})();