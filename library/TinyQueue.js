/**
 * Tiny Queue ported to ExtendScript.
 * @url https://github.com/mourner/tinyqueue
 * @author Volodymyr Agafonkin
 * Ported to ExtendScript by m1b.
 * @constructor
 * @param {Object} options
 * @param {Array} [options.data] - array of data (default: empty array).
 * @param {Function} [options.compare] - function that compares (default: default compare function).
 */
function TinyQueue(options) {

    options = options || {};
    this.data = options.data || [];
    this.length = this.data.length;
    this.compare = options.compare || function (a, b) {
        return a < b ? -1 : a > b ? 1 : 0;
    };

    if (this.length > 0) {
        for (var i = (this.length >> 1) - 1; i >= 0; i--)
            this._down(i);
    }

};


TinyQueue.prototype.push = function (item) {

    this.data.push(item);
    this._up(this.length++);

};


TinyQueue.prototype.pop = function () {

    if (this.length === 0)
        return undefined;

    const top = this.data[0];
    const bottom = this.data.pop();

    if (--this.length > 0) {
        this.data[0] = bottom;
        this._down(0);
    }

    return top;

};


TinyQueue.prototype.peek = function () {
    return this.data[0];
}


TinyQueue.prototype._up = function (pos) {

    const data = this.data;
    const compare = this.compare;
    const item = data[pos];

    while (pos > 0) {

        const parent = (pos - 1) >> 1;
        const current = data[parent];

        if (compare(item, current) >= 0)
            break;

        data[pos] = current;
        pos = parent;
    }

    data[pos] = item;

};




TinyQueue.prototype._down = function (pos) {

    const data = this.data;
    const compare = this.compare;
    const halfLength = this.length >> 1;
    const item = data[pos];

    while (pos < halfLength) {

        var bestChild = (pos << 1) + 1; // initially it is the left child
        const right = bestChild + 1;

        if (
            right < this.length
            && compare(data[right], data[bestChild]) < 0
        )
            bestChild = right;

        if (compare(data[bestChild], item) >= 0)
            break;

        data[pos] = data[bestChild];
        pos = bestChild;
    }

    data[pos] = item;

};
