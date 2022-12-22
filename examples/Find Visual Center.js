//@include '../library/Bez.js'
//@include '../library/PolyLabel.js'
//@include '/Users/mark/Scripting/Indesign/Lib/Explr.js'


/**
 * Example usage: findVisualCenter.
 * Finds the visual center of selected
 * path item and, for demonstration
 * purposes, draws pink circle showing
 * size and position of visual center,
 * and scales random number to fit
 * inside circle.
 */


if (Bez == undefined)
    throw Error('Cannot find the required script file "Bez.js".');
if (polylabel == undefined)
    throw Error('Cannot find the required script file "PolyLabel.js".');


var doc = app.activeDocument,
    item = doc.selection[0],
    vc = findVisualCenter({ item: item, flatness: 5, precision: 1 });

// $/*debug*/.writeln('item.pathItems[0].area = ' + item.pathItems[0].area);
// $/*debug*/.writeln('item.pathItems[0].pathPoints.length = ' + item.pathItems[0].pathPoints.length);
// $/*debug*/.writeln('item.pathItems[0].polarity = ' + item.pathItems[0].polarity);

// $/*debug*/.writeln('item.pathItems[1].area = ' + item.pathItems[1].area);
// $/*debug*/.writeln('item.pathItems[1].pathPoints.length = ' + item.pathItems[1].pathPoints.length);
// $/*debug*/.writeln('item.pathItems[1].polarity = ' + item.pathItems[1].polarity);


if (vc) {

    // draw a pink circle, just to show visual center
    drawCircle(doc, [vc.x, vc.y], vc.radius, getPink());

    // scale an example textFrame to fit in visual center
    var tf = doc.textFrames.add();
    tf.contents = String(Math.floor(Math.random() * 100));
    tf.textRange.tracking = 0;
    tf.textRange.paragraphAttributes.justification = Justification.CENTER;
    tf.textRange.fillColor = getWhite();
    fitTextInCircle({ textFrame: tf, circle: vc, margin: 0.5 });

}




/**
 * Returns the visual centre of a path item,
 * in the form of the largest circle that
 * can fit into the path item.
 * @author m1b
 * @version 2022-12-22
 *
 * @requires Bez.js
 * @requires PolyLabel.js
 *
 * Acknowledgements:
 *   PolyLabel by Volodymyr Agafonkin.
 *   https://github.com/mapbox/polylabel
 *
 * @param {Object} options
 * @param {Path Item} options.item - an Illustrator PathItem.
 * @param {Number} [options.flatness] - the average length, in points, of flats on curved segments (default: 5).
 * @param {Number} [options.precision] - precision used when calculating the visual center (default: 1.0).
 * @returns {Object} - the largest circle found {cx: cy: radius:}
 */
function findVisualCenter(options) {

    options = options || {};
    var item = options.item,
        flatness = options.flatness || 5,
        precision = options.precision || 1;

    if (item == undefined) {
        alert('Please select a path item and try again.');
        return;
    }

    var dup = item.duplicate(),
        bez = new Bez({ pathItem: dup });

    // convert to polygon (flatness is average distance between path points)
    bez.convertToPolygon(flatness);

    // now convert the bez to an simple array
    var paths = [];

    for (var i = 0; i < bez.points.length; i++) {

        var path = {
            points: [],
            area: bez.points.length == 1
                ? bez.pathItem.area
                : item.pathItems[i].area
        };

        for (var j = 0; j < bez.points[i].length; j++)
            path.points[j] = [bez.points[i][j].anchor[0], -bez.points[i][j].anchor[1]];

        paths.push(path);

    }

    // sort by area, largest first
    paths.sort(function (a, b) { return b.area - a.area });

    if (Math.abs(paths[0].area) < Math.abs(paths[paths.length - 1].area))

        // reverse the polarity!
        paths.sort(function (a, b) { return a.area - b.area });

    // format as simple polygon points (first element is outer path)
    var polygon = [];

    for (var i = 0; i < paths.length; i++)
        polygon.push(paths[i].points);

    // we don't need the duplicate anymore
    dup.remove();
    bez = null;

    // calculate the visual center
    var visualCenter = polylabel(polygon, precision, false);

    return visualCenter;

};



/**
 * Scales the textFrame to fit inside the supplied circle.
 * @author m1b
 * @version 2022-12-21
 * Note: performs a better fitting by using bounds
 * of an outlined version of the text frame.
 * @param {Object} options
 * @param {TextFrame} options.textFrame - an Illustrator TextFrame object.
 * @param {Object} options.circle - an object representing a circle {cx: cy: radius:}.
 * @param {Number} [options.margin] - amount of empty space around text frame (default: 0).
 */
function fitTextInCircle(options) {

    options = options || {};

    var textFrame = options.textFrame,
        circle = options.circle,
        margin = options.margin || 0,

        dup = textFrame.duplicate().createOutline(),
        bounds = dup.visibleBounds,
        centre = { x: bounds[0] + ((bounds[2] - bounds[0]) / 2), y: bounds[1] + ((bounds[3] - bounds[1]) / 2) },
        diag = distanceBetweenPoints([bounds[0], bounds[1]], [bounds[2], bounds[3]]),
        scaleFactor = ((circle.radius - margin) * 2) / diag * 100;

    dup.remove();

    textFrame.translate(-centre.x, -centre.y);
    textFrame.resize(scaleFactor, scaleFactor, undefined, undefined, undefined, undefined, undefined, Transformation.DOCUMENTORIGIN);
    textFrame.translate(circle.x, -circle.y);

};


function drawCircle(doc, c, r, col) {
    var circle = doc.pathItems.ellipse(-c[1] + r, c[0] - r, r * 2, r * 2);
    circle.filled = true;
    circle.fillColor = col;
};


function getPink() {
    var c = new CMYKColor();
    c.cyan = 0;
    c.magenta = 100;
    c.yellow = 20;
    c.black = 0;
    return c;
};


function getWhite() {
    var c = new CMYKColor();
    c.cyan = 0;
    c.magenta = 0;
    c.yellow = 0;
    c.black = 0;
    return c;
};