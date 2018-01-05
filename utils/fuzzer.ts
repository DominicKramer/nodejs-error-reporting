/**1
 * Copyright 2016 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// jscs:disable
// jshint ignore: start

var indexOf = require('lodash.indexof');
var without = require('lodash.without');
var maxBy = require('lodash.maxby');
var random = require('lodash.random');
var is1 = require('is');
var isNumber = is1.number;
var isString = is1.string;
var isArray = is1.array;
var isFunction = is1.function;


export class Fuzzer {
  generate = {
    types: function() {
      return [
        'object',
        'array',
        'string',
        'number',
        'null',
        'undefined',
        'function',
        'boolean',
      ];
    },

    string: function(len) {
      var lenChecked = isNumber(len) ? len : 10;
      var chars: string[] = [];

      for (var i = 0; i < lenChecked; i++) {
        chars.push(String.fromCharCode(random(32, 126)));
      }

      return chars.join('');
    },

    boolean: function() {
      return !!random(0, 1);
    },

    alphaNumericString: function(len) {
      var lenChecked = isNumber(len) ? len : 10;
      var chars: string[] = [];
      var thisRange: number[] = [];
      var ranges = [[48, 57], [65, 90], [97, 122]];

      for (var i = 0; i < lenChecked; i++) {
        thisRange = ranges[random(0, 2)];
        chars.push(String.fromCharCode(random(thisRange[0], thisRange[1])));
      }

      return chars.join('');
    },

    function: function() {
      var availableTypes = without(this.types(), 'function');
      var typeToGen = this.types()[random(0, availableTypes.length - 1)];
      var fnToCall = this[typeToGen];

      return function() {
        return fnToCall();
      };
    },

    number: function(lower, upper) {
      var lowerChecked = isNumber(lower) ? lower : 0;
      var upperChecked = isNumber(upper) ? upper : 100;

      return random(lowerChecked, upperChecked);
    },

    null: function() {
      return null;
    },

    undefined: function() {
      return undefined;
    },

    array: function(
      len,
      ofOneType,
      currentDepth,
      allowedDepth
    ) {
      var lenChecked = isNumber(len) ? len : random(1, 10);
      var availableTypes =
        isString(ofOneType) && indexOf(this.types(), ofOneType) > -1
          ? [ofOneType]
          : this.types();
      var currentDepthChecked = isNumber(currentDepth) ? currentDepth : 0;
      var allowedDepthChecked = isNumber(allowedDepth) ? allowedDepth : 3;
      var arr: {}[] = [];
      var currentTypeBeingGenerated = '';
      currentDepthChecked += 1;

      // Deny the ability to nest more objects
      if (currentDepthChecked >= allowedDepthChecked) {
        availableTypes = without(this.types(), 'object', 'array');
      }

      for (var i = 0; i < lenChecked; i++) {
        currentTypeBeingGenerated =
          availableTypes[random(0, availableTypes.length - 1)];

        if (currentTypeBeingGenerated === 'object') {
          arr.push(
            this[currentTypeBeingGenerated](
              null,
              currentDepthChecked,
              allowedDepthChecked
            )
          );
        } else if (currentTypeBeingGenerated === 'array') {
          arr.push(
            this[currentTypeBeingGenerated](
              null,
              ofOneType,
              currentDepthChecked,
              allowedDepthChecked
            )
          );
        } else {
          arr.push(this[currentTypeBeingGenerated]());
        }
      }

      return arr;
    },

    object: function(
      numProperties,
      currentDepth,
      allowedDepth
    ) {
      var numPropertiesChecked = isNumber(numProperties)
        ? numProperties
        : random(1, 10);
      var currentDepthChecked = isNumber(currentDepth) ? currentDepth : 0;
      var allowedDepthChecked = isNumber(allowedDepth) ? allowedDepth : 3;
      var obj = {};
      currentDepthChecked += 1;

      var availableTypes = this.types();

      // Deny the ability to nest more objects
      if (currentDepth >= allowedDepth) {
        availableTypes = without(availableTypes, 'object', 'array');
      }

      var currentTypeBeingGenerated: string|number = 0;
      var currentKey = '';

      for (var i = 0; i < numPropertiesChecked; i++) {
        currentTypeBeingGenerated =
          availableTypes[random(0, availableTypes.length - 1)];
        currentKey = this.alphaNumericString(random(1, 10));

        if (currentTypeBeingGenerated === 'object') {
          obj[currentKey] = this[currentTypeBeingGenerated](
            null,
            currentDepthChecked,
            allowedDepthChecked
          );
        } else if (currentTypeBeingGenerated === 'array') {
          obj[currentKey] = this[currentTypeBeingGenerated](
            null,
            null,
            currentDepthChecked,
            allowedDepthChecked
          );
        } else {
          obj[currentKey] = this[currentTypeBeingGenerated]();
        }
      }

      return obj;
    }
  };

  _backFillUnevenTypesArrays(argsTypesArray) {
    var largestLength = maxBy(argsTypesArray, function(o) {
      return o.length;
    }).length;

    for (var i = 0; i < argsTypesArray.length; i++) {
      if (argsTypesArray[i].length !== largestLength) {
        while (argsTypesArray[i].length < largestLength) {
          argsTypesArray[i].push(
            argsTypesArray[i][random(0, argsTypesArray[i].length - 1)]
          );
        }
      }
    }

    return argsTypesArray;
  }

  _normalizeTypesArrayLengths(argsTypesArray) {
    var allAreTheSameLength = true;
    var lastLength = argsTypesArray[0].length;

    for (var i = 1; i < argsTypesArray.length; i++) {
      if (argsTypesArray[i].length !== lastLength) {
        allAreTheSameLength = false;
        break;
      }
    }

    if (allAreTheSameLength) {
      return argsTypesArray;
    }

    return this._backFillUnevenTypesArrays(argsTypesArray);
  }

  _generateTypesToFuzzWith(expectsArgTypes) {
    var argsTypesArray: Array<{}[]> = [];
    var tmpArray = this.generate.types();

    for (var i = 0; i < expectsArgTypes.length; i++) {
      if (!isArray(expectsArgTypes[i])) {
        argsTypesArray.push(without(this.generate.types(), expectsArgTypes[i]));
      } else {
        for (var j = 0; j < expectsArgTypes[i].length; j++) {
          tmpArray = without(tmpArray, expectsArgTypes[i][j]);
        }

        argsTypesArray.push(([] as {}[]).concat(tmpArray));
        tmpArray = this.generate.types();
      }
    }

    argsTypesArray = this._normalizeTypesArrayLengths(argsTypesArray);
    return argsTypesArray;
  };

  _generateValuesForFuzzTyping(
    typesToFuzzOnEach,
    index
  ) {
    var args: {}[] = [];
    var typeToGen = '';

    for (var i = 0; i < typesToFuzzOnEach.length; i++) {
      typeToGen = typesToFuzzOnEach[i][index];

      args.push(this.generate[typeToGen]());
    }

    return args;
  }

  fuzzFunctionForTypes(
    fnToFuzz,
    expectsArgTypes?: {},
    cb?: Function,
    withContext?: {}
  ) {
    var expectsArgTypesChecked = isArray(expectsArgTypes) ? expectsArgTypes : [];
    var typesToFuzzOnEach = this._generateTypesToFuzzWith(expectsArgTypesChecked);

    var returnValue = undefined;

    for (var i = 0; i < typesToFuzzOnEach[0].length; i++) {
      returnValue = fnToFuzz.apply(
        withContext,
        this._generateValuesForFuzzTyping(typesToFuzzOnEach, i)
      );

      if (isFunction(cb)) {
        cb!(returnValue);
      }
    }

    return true;
  }
}