// if ('undefined' === typeof Bez) {
//@include '../library/Bez.js'
// }

(function () {

    var doc = app.activeDocument,
        item = doc.selection[0],
        bez = new Bez({ pageItem: item });

    bez.reverse();
    bez.drawPathIndicators({ size: 20 });

    return;

})();
