function compute_alpha_times_bucket_count_squared(bucket_count) {
    return 0.7213 / (1 + 1.079 / bucket_count) * bucket_count * bucket_count;
}

// Create a HyperLogLog counter of 2^n buckets.
// 2^0 to 2^32 - requires that many BYTES (really 6 bit words for 64 bit hashing)
// The limit of 2^32 comes from using the first 32 bit int of the hash
// for the bucket index. Theoretically we could scale that to allow more, but that means
// more than 4GB per HLL, which is unlikely.
function HyperLogLog(n) {
    var bucket_count = Math.pow(2, n);
    var alpha_times_bucket_count_squared = compute_alpha_times_bucket_count_squared(bucket_count);
    var buckets = new Buffer(bucket_count);
    buckets.fill(0);

    // Maintain some running counts so that returning cardinality is cheap.

    var sum_of_inverses = bucket_count;
    var count_zero_buckets = bucket_count;

    var self = {
        add: function add(unique_hash) {
            if (unique_hash === null) {
                return; // nothing to add
            }

            var bucket = unique_hash[0] >>> (32 - n);
            var trailing_zeroes = 1;

            count_zeroes:
                for (var i = 3; i >= 2; --i) {
                    var data = unique_hash[i];
                    for (var j = 32; j; --j) {
                        if (data & 0x1) {
                            break count_zeroes;
                        }

                        ++trailing_zeroes;
                        data = data >>> 1;
                    }
                }

            // Maintain a running sum of inverses for quick cardinality checking.
            var old_value = buckets[bucket];
            var new_value = Math.max(trailing_zeroes, old_value);
            sum_of_inverses += Math.pow(2, -new_value) - Math.pow(2, -old_value);
            if (new_value !== 0 && old_value === 0) {
                --count_zero_buckets;
            }

            buckets[bucket] = new_value;

            return self;
        },

        count: function count() {
            /*var sum_of_inverses = 0;
            var count_zero_buckets = 0;

            for (var i = 0; i < bucket_count; ++i) {
                var bucket = buckets[i];
                if (bucket === 0) ++count_zero_buckets;
                sum_of_inverses += 1 / Math.pow(2, bucket);
            }*/
            // No longer need to compute this all every time, since we keep running counts to keep this cheap.

            var estimate = alpha_times_bucket_count_squared / sum_of_inverses;

            // Apply small cardinality correction
            if (count_zero_buckets > 0 && estimate < 5/2 * bucket_count) {
                estimate = bucket_count * Math.log(bucket_count / count_zero_buckets);
            }

            return Math.floor(estimate + 0.5);
        },

        relative_error: function relative_error() {
            // Estimate the relative error for this HLL.
            return 1.04 / Math.sqrt(bucket_count);
        },

        output: function output() {
            return {
                n: n,
                buckets: buckets
            }
        },

        merge: function merge(data) {
            if (n > data.n) {
                // Fold this HLL down to the size of the incoming one.
                var new_bucket_count = Math.pow(2, data.n);
                var old_buckets_per_new_bucket = Math.pow(2, n - data.n);
                var new_buckets = new Buffer(new_bucket_count);

                for (var i = 0; i < new_bucket_count; ++i) {
                    var new_bucket_value = data.buckets[i];
                    for (var j = 0; j < old_buckets_per_new_bucket; ++j) {
                        new_bucket_value = Math.max(new_bucket_value, buckets[i * old_buckets_per_new_bucket + j]);
                    }
                    new_buckets[i] = new_bucket_value;
                }

                buckets = new_buckets;
                n = data.n;

                bucket_count = Math.pow(2, n);
                alpha_times_bucket_count_squared = compute_alpha_times_bucket_count_squared(bucket_count);
            } else {
                var new_buckets_per_existing = Math.pow(2, data.n - n);
                for (var i = data.buckets.length - 1; i >= 0; --i) {
                    var existing_bucket_index = (i / new_buckets_per_existing) | 0;
                    buckets[existing_bucket_index] = Math.max(buckets[existing_bucket_index], data.buckets[i]);
                }
            }

            // Recompute running totals
            sum_of_inverses = 0;
            count_zero_buckets = 0;
            for (var i = 0; i < bucket_count; ++i) {
                var bucket = buckets[i];
                if (bucket === 0) {
                    ++count_zero_buckets;
                }
                sum_of_inverses += Math.pow(2, -bucket);
            }
        }
    };

    return self;
};

module.exports = HyperLogLog;

module.exports.hash = require('murmurhash3').murmur128Sync;
