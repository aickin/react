/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @typechecks static-only
 * @providesModule ReactServerAsyncRendering
 */
'use strict';

var ReactDefaultBatchingStrategy = require('ReactDefaultBatchingStrategy');
var ReactElement = require('ReactElement');
var ReactInstanceHandles = require('ReactInstanceHandles');
var ReactMarkupChecksum = require('ReactMarkupChecksum');
var ReactServerBatchingStrategy = require('ReactServerBatchingStrategy');
var ReactServerRenderingTransaction =
  require('ReactServerRenderingTransaction');
var ReactUpdates = require('ReactUpdates');

var emptyObject = require('emptyObject');
var instantiateReactComponent = require('instantiateReactComponent');
var invariant = require('invariant');
var rollingAdler32 = require('rollingAdler32');

/**
 * @param {ReactElement} element
 * @return {Number} the markup checksum
 */
function renderToString(element, stream) {
  invariant(
    ReactElement.isValidElement(element),
    'renderToString(): You must pass a valid ReactElement.'
  );

  var transaction;
  try {
    ReactUpdates.injection.injectBatchingStrategy(ReactServerBatchingStrategy);

    var id = ReactInstanceHandles.createReactRootID();
    transaction = ReactServerRenderingTransaction.getPooled(false);

    var rollingHash = rollingAdler32('');
    // wrap the stream so that we can update the hash every time a string is written to the
    // output.
    var wrappedStream = {
      write: function(text) {
        // pass through to the underlying stream.
        stream.write(text);
        // also, add to the rolling hash.
        rollingHash = rollingAdler32(text, rollingHash);
      }
    }
    return transaction.perform(function() {
      var componentInstance = instantiateReactComponent(element, null);
      componentInstance.mountComponentAsync(id, transaction, emptyObject, wrappedStream);
      return rollingHash.hash();
    }, null);
  } finally {
    ReactServerRenderingTransaction.release(transaction);
    // Revert to the DOM batching strategy since these two renderers
    // currently share these stateful modules.
    ReactUpdates.injection.injectBatchingStrategy(ReactDefaultBatchingStrategy);
  }
}

/**
 * @param {ReactElement} element
 * @return {string} the HTML markup, without the extra React ID and checksum
 * (for generating static pages)
 */
function renderToStaticMarkup(element, stream) {
  invariant(
    ReactElement.isValidElement(element),
    'renderToStaticMarkup(): You must pass a valid ReactElement.'
  );

  var transaction;
  try {
    ReactUpdates.injection.injectBatchingStrategy(ReactServerBatchingStrategy);

    var id = ReactInstanceHandles.createReactRootID();
    transaction = ReactServerRenderingTransaction.getPooled(true);

    return transaction.perform(function() {
      var componentInstance = instantiateReactComponent(element, null);
      componentInstance.mountComponentAsync(id, transaction, emptyObject, stream);
    }, null);
  } finally {
    ReactServerRenderingTransaction.release(transaction);
    // Revert to the DOM batching strategy since these two renderers
    // currently share these stateful modules.
    ReactUpdates.injection.injectBatchingStrategy(ReactDefaultBatchingStrategy);
  }
}

module.exports = {
  renderToString: renderToString,
  renderToStaticMarkup: renderToStaticMarkup,
};
