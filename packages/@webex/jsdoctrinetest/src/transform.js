/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */


import template from '@babel/template';
import traverse from '@babel/traverse';

import parse from './parse';
import generateSpec from './mocha-template';
import {
  build as buildLiteralAssertion,
  test as literalAssertionTest
} from './assertions/literal';

const assertionStatementTemplate = template(`
  return Promise.resolve(ORIGINAL)
    .then(function(result) {
      ASSERTIONS
    })
`);

/**
 * @param {Object} options
 * @param {ast} options.comment
 * @param {string} options.name
 * @param {string} options.filename
 * @param {string} options.type
 * @returns {ast}
 */
export default function transform({
  comment, name, filename, type
}) {
  const ast = parse(comment);

  traverse(ast, {
    enter(path) {
      if (path.node.trailingComments) {
        const assertions = path.node.trailingComments.map(makeAsserter);

        if (assertions.length) {
          Reflect.deleteProperty(path.node, 'trailingComments');

          path.replaceWith(assertionStatementTemplate({
            ORIGINAL: path.node,
            ASSERTIONS: assertions
          }));
        }
      }
    }
  });

  return generateSpec({
    testCase: ast,
    name,
    filename,
    type
  });
}

/**
 * Takes a trailing comment from an example block and changes it to an assertion
 * @param {CommentBlock} comment
 * @returns {ast}
 */
function makeAsserter(comment) {
  if (literalAssertionTest(comment.value)) {
    return buildLiteralAssertion(comment.value);
  }

  return null;
}
