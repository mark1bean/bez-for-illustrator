//@include '../library/Bez.js'

(function () {

    if (Bez == undefined)
        throw 'Must have Bez.js in same folder as this script.';


    var doc = app.activeDocument,
        item = doc.selection[0],
        bez = new Bez({ pageItem: item });

    $/*debug*/.write('before: ');
    debugShowFirstPoint(bez)

    bez.draw({ select: true });

    $/*debug*/.write('after: ');
    debugShowFirstPoint(bez)


    bez.drawPathIndicators();

    function debugShowFirstPoint(bez) {
        $/*debug*/.writeln('1st ' + Math.floor(bez.paths[0][0].anchor[0]) + ' (' + Math.floor(bez.pageItem.pathPoints[0].anchor[0]) + ')');
    }

    return;

    var p0 = bez.point(0, 0),
        p1 = bez.point(0, 1),

        pink = getPink(),
        cyan = getCyan(),

        firstPointAppearance = {
            filled: false,
            stroked: true,
            strokeWidth: 0.5,
            strokeColor: pink
        },
        secondPointAppearance = {
            filled: true,
            stroked: false,
            fillColor: cyan
        };

    p3 = bez.pathItems[0].pathPoints[0];

    // Bez.drawCircle(bez.doc, p0.anchor, 2, firstPointAppearance);
    // Bez.drawCircle(bez.doc, p1.anchor, 1, secondPointAppearance);
    Bez.drawCircle(bez.doc, p3.anchor, 1);


    function debugShowOrder(bez) {
        $/*debug*/.writeln('* ' + Math.floor(bez.paths[0][0].anchor[0]) + ' -> ' + Math.floor(bez.paths[0][1].anchor[0]));
    }


    function drawCircle(doc, c, r, col) {
        var circle = doc.pathItems.ellipse(c[1] + r, c[0] - r, r * 2, r * 2);
        circle.stroked = false;
        circle.filled = true;
        circle.fillColor = col;
        return circle;
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
