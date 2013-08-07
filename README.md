HyperLogLog Distinct Value Estimator
====================================

[HyperLogLog](http://algo.inria.fr/flajolet/Publications/FlFuGaMe07.pdf) (HLL) is a probabilistic
estimator of the cardinality of a stream of values. Given
a bounded amount of memory, it can estimate the cardinality of a stream with bounded relative error
and it is possible to trade off memory usage for precision. Formally, the standard error for an HLL
with `n` registers is less than `1.04/sqrt(n)`.

Example
-------

```javascript
var HyperLogLog = require('hyperloglog');
var hll = HyperLogLog(12);

// Insert 3 values, two of them distinct.
hll.add(HyperLogLog.hash("value1"));
hll.add(HyperLogLog.hash("value2"));
hll.add(HyperLogLog.hash("value1"));

assert(2 === hll.count());
```

API
---

### HyperLogLog.hash(string)

In order to count items, they must first be hashed. The `hash()` function provides a suitable hash.
Its output is an array of four 32 bit postive integers, which, taken together constitute the complete
hash of the input string. Currently the implementation is MurmurHash3-128.

### HyperLogLog(n)

Construct an HLL data structure with `n` bit indices into the register array. This implies that
there will be `2^n` registers. Typical values for `n` are around 12, which would use 4096 registers and
yield less than 1.625% relative error. Higher values use more memory, but provide greater precision.

### hll.add(hash)

Adds a hash to the HLL. The hash must be in the format emitted by `hash()`. If

### hll.count()

Get the current estimate of the number of distinct values that have been added.

### hll.relative_error()

Get the expected relative error, based on the number of registers. This will not change as
values are added. The absolute standard error is the relative error multiplied by the estimated
cardinality from `count()`.

### hll.output()

Return an external representation of the internal HLL state. This may be useful for serializing,
storing, and migrating an HLL. The format returned is the same as that accepted by `merge()`.

### hll.merge(data)

Merge another HLL's state into this HLL. The `data` must be of the same form as that returned by `output()`.
If the incoming data has fewer registers than this HLL, this one will be folded down to be the same size as the
incoming data, with a corresponding loss of precision. If the incoming data has more registers, it will be folded
down as it is merged. The result is that this HLL will be updated as though it had processed all values that were
previously processed by either HLL.

```javascript
hll1.add(hash1);
hll1.add(hash2);

hll2.add(hash2);
hll2.add(hash3);

hll1.merge(hll2.output());

assert(3 === hll1.count());
```

Possible Improvements
---------------------

- Make HLL use a compressed representation from [Google's paper](http://static.googleusercontent.com/external_content/untrusted_dlcp/research.google.com/en/us/pubs/archive/40671.pdf)
- Bit shift registers to use 6 bits per register instead of 8 since we only ever actually use 6 for up to 2^64 (2^2^6).
- Go to 5 bits per register and add the high cardinality correction. Save 16% on storage for effectively the same standard error.
