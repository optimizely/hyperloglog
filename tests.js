var HyperLogLog = require('./hyperloglog');
var hash = HyperLogLog.hash;
var vows = require('vows');
var assert = require('assert');

vows.describe('HyperLogLog').addBatch({
    'empty hll has cardinality of zero': function () {
        assert.equal(HyperLogLog(8).count(), 0);
    },

    'counts unique things': function () {
        var thing1 = hash('thing1');
        var thing2 = hash('thing2');
        var thing3 = hash('thing3');

        var hll = HyperLogLog(8);

        hll.add(thing1);

        assert.equal(hll.count(), 1);

        for (var i = 0; i < 100; ++i) {
            hll.add(thing1);
            hll.add(thing2);
            hll.add(thing3);
        }

        assert.equal(hll.count(), 3);
    },

    'merges overlapping counts': function () {
        var hll = HyperLogLog(15);
        var hll2 = HyperLogLog(15);

        for (var i = 0; i < 100; ++i) {
            hll.add(hash('Just hll ' + i));
            hll2.add(hash('Just hll2 ' + i));
            var both = hash('Both ' + i);
            hll.add(both);
            hll2.add(both);
        }

        assert(Math.abs(hll.count() - 200) <= 2);
        assert(Math.abs(hll2.count() - 200) <= 2);

        hll.merge(hll2.output());

        assert(Math.abs(hll.count() - 300) <= 3);
    },

    'merges bigger HLL into a smaller one': function () {
        var hll = HyperLogLog(8);
        var hll2 = HyperLogLog(14);

        var original_relative_error = hll.relative_error();

        hll.add(hash('Just hll'));
        hll2.add(hash('Just hll2'));
        var both = hash('both');
        hll.add(both);
        hll2.add(both);

        hll.merge(hll2.output());

        assert.equal(hll.count(), 3);
        assert(hll.relative_error() == original_relative_error);
    },

    'merges a smaller HLL into a bigger one': function () {
        // The result is the same size as the smaller one.
        var hll = HyperLogLog(14);
        var hll2 = HyperLogLog(8);

        var original_relative_error = hll.relative_error();

        hll.add(hash('Just hll'));
        hll2.add(hash('Just hll2'));
        var both = hash('both');
        hll.add(both);
        hll2.add(both);

        hll.merge(hll2.output());

        assert.equal(hll.count(), 3);
        assert(hll.relative_error() > original_relative_error);
    }
}).export(module);

