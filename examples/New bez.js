if ('undefined' === typeof Bez) {
    //@include '../library/Bez.js'
}

/**
 * Make a bez example.
 * @author m1b
 * @version 2022-12-23
 * @requires Bez.js
 */
(function () {

    if (typeof Bez === 'undefined')
        throw Error('Cannot find the required script file "Bez.js".');

    var doc = app.activeDocument;

    var bez = new Bez(
        {
            paths: [
                [[0, 0], [0, 12], [12, 12], [12, 0]]
            ],
            pathsClosed: [true],
        }
    );

    bez.draw();


})();