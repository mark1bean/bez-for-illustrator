if ('undefined' === typeof Bez) {
    //@include '../library/Bez.js'
}

/**
 * Make a bez example.
 * @author m1b
 * @version 2026-04-01
 * @requires Bez.js
 */
(function () {

    var doc = app.activeDocument;

    var bez = new Bez(
        {
            doc: doc,
            paths: [[[0, 0], [0, 12], [12, 12], [12, 0]]],
            pathsClosed: [true],
        }
    );

    bez.draw();


})();