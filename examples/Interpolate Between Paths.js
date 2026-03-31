/**
 * @file Interpolate Between Paths.js
 *
 * @author m1b
 * @version 2022-12-23
 * @requires Bez.js
*/
if ('undefined' === typeof Bez) {
    //@include '/Users/mark/Scripting/Illustrator/Projects/Bez/public/bez-for-illustrator/library/Bez.js'
}
(function () {

    if (typeof Bez === 'undefined')
        throw Error('Cannot find the required script file "Bez.js".');

    var settings = {
        drawWithSteps: false,
        values: [0.25],
        reverse: false,
        steps: 3,
        showUI: true,
        useEasing: false,
    };

    var doc = app.activeDocument;

    if (doc.selection.length != 2) {
        alert('Please select two path items and try again.');
        return;
    }

    if (settings.showUI) {

        var result = ui(settings);

        if (2 === result)
            // user cancelled
            return;

    }

    // interpolate!
    Bez.pathItemsFromInterpolation(
        {
            pathItem1: doc.selection[Number(!settings.reverse)],
            pathItem2: doc.selection[Number(settings.reverse)],
            values: settings.values,
            steps: settings.steps,
            valueFunction: settings.useEasing ? easeOutQuad : null,
        }
    );

    // example easing function
    // see also Ease.js in ../libary
    function easeOutQuad(t) { return t * (2 - t) };

})();

/** Returns `str` converted to an array of numbers. */
function getNumbers(str, delim) {

    var parts = str.split(delim || ',');
    var numbers = [];

    for (var i = 0, n; i < parts.length; i++) {
        n = Number(parts[i]);
        if (!isNaN(n))
            numbers.push(n);
    }

    return numbers;

};

/**
 * User interface for this script. Will update the `settings` object.
 * @author m1b
 * @version 2026-02-22
 * @param {Object} settings - the script settings.
 * @returns {1|2}
 */
function ui(settings) {

    var w = new Window("dialog { text:'Interpolate Between Paths' }");


    var radioButtons = w.add('Group {orientation:"column", margins:[10,10,10,10], alignChildren:["left","top"] }');
    var drawWithStepsRadio = radioButtons.add('radiobutton {text:"Interpolate with number of steps"}');
    var drawWithValuesRadio = radioButtons.add('radiobutton {text:"Interpolate with specific values"}');

    var group = w.add('Group {orientation:"column", alignment:["fill","fill"], alignChildren:["left","fill"], margins:[10,10,10,10] }');
    var stack = group.add('Group { orientation:"stack", alignment:["left","top"], alignChildren:["fill","fill"] }');

    var stepsGroup = stack.add('Group { orientation:"column", alignment:["left","top"], alignChildren:["left","top"] }');
    var stepsLabel = stepsGroup.add('StaticText { text: "Number of steps:" }')
    var stepsField = stepsGroup.add('EditText { text:"", preferredSize:[200,-1] }');
    var useEasingCheckBox = stepsGroup.add('Checkbox { text:"Use easing", alignment:["left","bottom"] }');

    var valuesGroup = stack.add('Group { orientation:"column", alignment:["left","top"], alignChildren:["left","top"] }');
    var valuesLabel = valuesGroup.add('StaticText { text: "Values:" }');
    var valuesField = valuesGroup.add('EditText { text:"", preferredSize:[200,-1] }');
    valuesGroup.add('StaticText { text: "Example: \\"0.2, 0.3, 0.7\\"" }');

    var reverseCheckBox = group.add('Checkbox { text:"Reverse", alignment:["left","bottom"] }');

    var bottomUI = w.add('Group {orientation:"row", alignment:["fill","top"], margins: [0,20,0,0] }');
    var buttons = bottomUI.add('Group {orientation:"row", alignment:["right","top"], alignChildren:"right" }');
    var cancelButton = buttons.add('button {text:"Cancel", properties:{ name: "cancel" } }');
    var interpolateButton = buttons.add('button {text:"Interpolate", properties:{ name: "ok" } }');

    valuesField.text = String(settings.values);
    stepsField.text = String(settings.steps);
    (settings.drawWithSteps ? drawWithStepsRadio : drawWithValuesRadio).value = true;

    drawWithStepsRadio.onClick = updateUI;
    drawWithValuesRadio.onClick = updateUI;

    updateUI();

    function updateUI() {
        settings.drawWithSteps = drawWithStepsRadio.value;
        valuesGroup.visible = !settings.drawWithSteps;
        stepsGroup.visible = settings.drawWithSteps;
        useEasingCheckBox.value = settings.useEasing;
        return true;
    };

    // event handling
    interpolateButton.onClick = function () {
        settings.drawWithSteps = drawWithStepsRadio.value;
        settings.steps = settings.drawWithSteps ? Number(stepsField.text) : undefined;
        settings.values = settings.drawWithSteps ? undefined : getNumbers(valuesField.text);
        settings.reverse = reverseCheckBox.value;
        settings.useEasing = useEasingCheckBox.value;
        w.close(1);
    };

    w.center();
    return w.show();

};