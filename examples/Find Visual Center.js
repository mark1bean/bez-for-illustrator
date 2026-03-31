if ('undefined' === typeof Bez) {
    //@include '../library/Bez.js'
}
if ('undefined' === typeof polylabel) {
    //@include '../library/PolyLabel.js'
}


/**
 * Finds the visual center of selected
 * path item and, for demonstration
 * purposes, draws pink circle showing
 * size and position of visual center,
 * and scales random number to fit
 * inside circle.
 * @author m1b
 * @version 2022-12-23
 * @requires Bez.js
 * @requires PolyLabel.js by Volodymyr Agafonkin. https://github.com/mapbox/polylabel
 */
(function () {

    if (Bez == undefined)
        throw Error('Cannot find the required script file "Bez.js".');
    if (polylabel == undefined)
        throw Error('Cannot find the required script file "PolyLabel.js".');

    var doc = app.activeDocument,
        items = doc.selection,
        pink = getPink(),
        white = getWhite();

    for (var i = 0; i < items.length; i++) {

        if (
            items[i].constructor.name != 'PathItem'
            & items[i].constructor.name != 'CompoundPathItem'
        )
            continue;

        var bez = new Bez({ pageItem: items[i] });

        var vc = bez.findVisualCenter({ flatness: 1, precision: 0.2 });

        if (vc == undefined)
            continue;

        // these are just examples of doing something with the result:

        // draw a pink circle, to show visual center
        drawCircle(doc, vc.center, vc.radius, pink);

        // scale an example textFrame to fit in visual center
        var tf = doc.textFrames.add();
        tf.contents = String(Math.floor(Math.random() * 100));
        tf.textRange.tracking = 0;
        tf.textRange.paragraphAttributes.justification = Justification.CENTER;
        tf.textRange.fillColor = white;
        fitTextInCircle({ textFrame: tf, circle: vc, margin: 0.5 });

    }


    /**
     * Scales the textFrame to fit inside the supplied circle.
     * @author m1b
     * @version 2022-12-21
     * Note: performs a better fitting by using bounds
     * of an outlined version of the text frame.
     * @param {Object} options
     * @param {TextFrame} options.textFrame - an Illustrator TextFrame object.
     * @param {Object} options.circle - an object representing a circle {center: [x, y], radius: r}.
     * @param {Number} [options.margin] - amount of empty space around text frame (default: 0).
     */
    function fitTextInCircle(options) {

        options = options || {};

        var textFrame = options.textFrame,
            circle = options.circle,
            margin = options.margin || 0,

            dup = textFrame.duplicate().createOutline(),
            bounds = dup.visibleBounds,
            textCenter = [bounds[0] + ((bounds[2] - bounds[0]) / 2), bounds[1] + ((bounds[3] - bounds[1]) / 2)],
            diag = distanceBetweenPoints([bounds[0], bounds[1]], [bounds[2], bounds[3]]),
            scaleFactor = ((circle.radius - margin) * 2) / diag;

        dup.remove();

        textFrame.translate(-textCenter[0], -textCenter[1]);
        textFrame.resize(scaleFactor * 100, scaleFactor * 100, undefined, undefined, undefined, undefined, undefined, Transformation.DOCUMENTORIGIN);
        textFrame.translate(circle.center[0], circle.center[1]);

    };

    /**
     * Draws a circle in the Illustrator document.
     * @param {Document} doc - an Illustrator Document.
     * @param {Array<Number>} c - center of circle [x, y].
     * @param {Number} r - radius of circle.
     * @param {Color} col - the circle fillColor.
     * @returns {PathItem}
     */
    function drawCircle(doc, c, r, col) {
        var circle = doc.pathItems.ellipse(c[1] + r, c[0] - r, r * 2, r * 2);
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