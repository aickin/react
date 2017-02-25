/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @emails react-core
 */

'use strict';

var ExecutionEnvironment;
var React;
var ReactDOM;
var ReactDOMFeatureFlags;
var ReactDOMServer;
var ReactMarkupChecksum;
var ReactReconcileTransaction;
var ReactTestUtils;

var ID_ATTRIBUTE_NAME;
var ROOT_ATTRIBUTE_NAME;

const TEXT_NODE_TYPE = 3;
const COMMENT_NODE_TYPE = 8;

// performs fn asynchronously and expects count errors logged to console.error.
// will fail the test if the count of errors logged is not equal to count.
function expectErrors(fn, count) {
  if (console.error.calls && console.error.calls.reset) {
    console.error.calls.reset();
  } else {
    spyOn(console, 'error');
  }

  return fn().then((result) => {
    if (console.error.calls.count() !== count) {
      console.log(`We expected ${count} warning(s), but saw ${console.error.calls.count()} warning(s).`);
      if (console.error.calls.count() > 0) {
        console.log(`We saw these warnings:`);
        for (var i = 0; i < console.error.calls.count(); i++) {
          console.log(console.error.calls.argsFor(i)[0]);
        }
      }
    }
    expect(console.error.calls.count()).toBe(count);
    return result;
  });
}

function itRejects(desc, testFn) {
  it(desc, function() {
    return testFn()
      .then(() => expect(false).toBe('The promise resolved and should not have.'))
      .catch(() => {});
  });
}

// renders the reactElement into domElement, and expects a certain number of errors.
// returns a Promise that resolves when the render is complete.
function renderIntoDom(reactElement, domElement, errorCount = 0) {
  return expectErrors(
    () => new Promise((resolve) => ReactDOM.render(reactElement, domElement, () => resolve(domElement.firstChild))),
    errorCount
  );
}

// Renders text using SSR and then stuffs it into a DOM node; returns the DOM
// element that corresponds with the reactElement.
// Does not render on client or perform client-side revival.
function serverRender(reactElement, errorCount = 0) {
  return expectErrors(
    () => new Promise(resolve => resolve(ReactDOMServer.renderToString(reactElement))),
    errorCount)
  .then((markup) => {
    var domElement = document.createElement('div');
    domElement.innerHTML = markup;
    return domElement.firstChild;
  });
}

const clientCleanRender = (element, errorCount = 0) => {
  const div = document.createElement('div');
  return renderIntoDom(element, div, errorCount);
};

const clientRenderOnServerString = (element, errorCount = 0) => {
  return serverRender(element, errorCount).then((markup) => {
    resetModules();
    var domElement = document.createElement('div');
    domElement.innerHTML = markup;
    return renderIntoDom(element, domElement, errorCount);
  });
};

const clientRenderOnBadMarkup = (element, errorCount = 0) => {
  var domElement = document.createElement('div');
  domElement.innerHTML = '<div id="badIdWhichWillCauseMismatch" data-reactroot="" data-reactid="1"></div>';
  return renderIntoDom(element, domElement, errorCount + 1);
};

// runs a DOM rendering test as four different tests, with four different rendering
// scenarios:
// -- render to string on server
// -- render on client without any server markup "clean client render"
// -- render on client on top of good server-generated string markup
// -- render on client on top of bad server-generated markup
//
// testFn is a test that has one arg, which is a render function. the render
// function takes in a ReactElement and an optional expected error count and
// returns a promise of a DOM Element.
//
// You should only perform tests that examine the DOM of the results of
// render; you should not depend on the interactivity of the returned DOM element,
// as that will not work in the server string scenario.
function itRenders(desc, testFn) {
  it(`${desc} with server string render`,
    () => testFn(serverRender));
  itClientRenders(desc, testFn);
}

// run testFn in three different rendering scenarios:
// -- render on client without any server markup "clean client render"
// -- render on client on top of good server-generated string markup
// -- render on client on top of bad server-generated markup
//
// testFn is a test that has one arg, which is a render function. the render
// function takes in a ReactElement and an optional expected error count and
// returns a promise of a DOM Element.
//
// Since all of the renders in this function are on the client, you can test interactivity,
// unlike with itRenders.
function itClientRenders(desc, testFn) {
  it(`${desc} with clean client render`,
    () => testFn(clientCleanRender));
  it(`${desc} with client render on top of good server markup`,
    () => testFn(clientRenderOnServerString));
  it(`${desc} with client render on top of bad server markup`,
    () => testFn(clientRenderOnBadMarkup));
}

function itThrowsOnRender(desc, testFn) {
  itRejects(`${desc} with server string render`,
     () => testFn(serverRender));
  itRejects(`${desc} with clean client render`,
     () => testFn(clientCleanRender));

   // we subtract one from the warning count here because the throw means that it won't
   // get the usual markup mismatch warning.
  itRejects(`${desc} with client render on top of bad server markup`,
     () => testFn((element, warningCount = 0) => clientRenderOnBadMarkup(element, warningCount - 1)));
}

function resetModules() {
  jest.resetModuleRegistry();
  React = require('React');
  ReactDOM = require('ReactDOM');
  ReactDOMFeatureFlags = require('ReactDOMFeatureFlags');
  ReactMarkupChecksum = require('ReactMarkupChecksum');
  ReactTestUtils = require('ReactTestUtils');
  ReactReconcileTransaction = require('ReactReconcileTransaction');

  ExecutionEnvironment = require('ExecutionEnvironment');
  ExecutionEnvironment.canUseDOM = false;
  ReactDOMServer = require('ReactDOMServer');


}

describe('ReactDOMServer', () => {
  beforeEach(() => {
    resetModules();
    var DOMProperty = require('DOMProperty');
    ID_ATTRIBUTE_NAME = DOMProperty.ID_ATTRIBUTE_NAME;
    ROOT_ATTRIBUTE_NAME = DOMProperty.ROOT_ATTRIBUTE_NAME;
  });

  describe('renderToString', () => {
    it('should generate simple markup', () => {
      var response = ReactDOMServer.renderToString(
        <span>hello world</span>
      );
      expect(response).toMatch(new RegExp(
        '<span ' + ROOT_ATTRIBUTE_NAME + '="" ' +
          ID_ATTRIBUTE_NAME + '="[^"]+" ' +
          ReactMarkupChecksum.CHECKSUM_ATTR_NAME + '="[^"]+">hello world</span>'
      ));
    });

    it('should generate simple markup for self-closing tags', () => {
      var response = ReactDOMServer.renderToString(
        <img />
      );
      expect(response).toMatch(new RegExp(
        '<img ' + ROOT_ATTRIBUTE_NAME + '="" ' +
          ID_ATTRIBUTE_NAME + '="[^"]+" ' +
          ReactMarkupChecksum.CHECKSUM_ATTR_NAME + '="[^"]+"/>'
      ));
    });

    it('should generate simple markup for attribute with `>` symbol', () => {
      var response = ReactDOMServer.renderToString(
        <img data-attr=">" />
      );
      expect(response).toMatch(new RegExp(
        '<img data-attr="&gt;" ' + ROOT_ATTRIBUTE_NAME + '="" ' +
          ID_ATTRIBUTE_NAME + '="[^"]+" ' +
          ReactMarkupChecksum.CHECKSUM_ATTR_NAME + '="[^"]+"/>'
      ));
    });

    it('should generate comment markup for component returns null', () => {
      class NullComponent extends React.Component {
        render() {
          return null;
        }
      }

      var response = ReactDOMServer.renderToString(<NullComponent />);
      expect(response).toBe('<!-- react-empty: 1 -->');
    });

    // TODO: Test that listeners are not registered onto any document/container.

    it('should render composite components', () => {
      class Parent extends React.Component {
        render() {
          return <div><Child name="child" /></div>;
        }
      }

      class Child extends React.Component {
        render() {
          return <span>My name is {this.props.name}</span>;
        }
      }

      var response = ReactDOMServer.renderToString(
        <Parent />
      );
      expect(response).toMatch(new RegExp(
        '<div ' + ROOT_ATTRIBUTE_NAME + '="" ' +
          ID_ATTRIBUTE_NAME + '="[^"]+" ' +
          ReactMarkupChecksum.CHECKSUM_ATTR_NAME + '="[^"]+">' +
          '<span ' + ID_ATTRIBUTE_NAME + '="[^"]+">' +
            '<!-- react-text: [0-9]+ -->My name is <!-- /react-text -->' +
            '<!-- react-text: [0-9]+ -->child<!-- /react-text -->' +
          '</span>' +
        '</div>'
      ));
    });

    it('should only execute certain lifecycle methods', () => {
      function runTest() {
        var lifecycle = [];

        class TestComponent extends React.Component {
          constructor(props) {
            super(props);
            lifecycle.push('getInitialState');
            this.state = {name: 'TestComponent'};
          }

          componentWillMount() {
            lifecycle.push('componentWillMount');
          }

          componentDidMount() {
            lifecycle.push('componentDidMount');
          }

          render() {
            lifecycle.push('render');
            return <span>Component name: {this.state.name}</span>;
          }

          componentWillUpdate() {
            lifecycle.push('componentWillUpdate');
          }

          componentDidUpdate() {
            lifecycle.push('componentDidUpdate');
          }

          shouldComponentUpdate() {
            lifecycle.push('shouldComponentUpdate');
          }

          componentWillReceiveProps() {
            lifecycle.push('componentWillReceiveProps');
          }

          componentWillUnmount() {
            lifecycle.push('componentWillUnmount');
          }
        }

        var response = ReactDOMServer.renderToString(
          <TestComponent />
        );

        expect(response).toMatch(new RegExp(
          '<span ' + ROOT_ATTRIBUTE_NAME + '="" ' +
            ID_ATTRIBUTE_NAME + '="[^"]+" ' +
            ReactMarkupChecksum.CHECKSUM_ATTR_NAME + '="[^"]+">' +
            '<!-- react-text: [0-9]+ -->Component name: <!-- /react-text -->' +
            '<!-- react-text: [0-9]+ -->TestComponent<!-- /react-text -->' +
          '</span>'
        ));
        expect(lifecycle).toEqual(
          ['getInitialState', 'componentWillMount', 'render']
        );
      }

      runTest();

      // This should work the same regardless of whether you can use DOM or not.
      ExecutionEnvironment.canUseDOM = true;
      runTest();
    });

    it('should have the correct mounting behavior', () => {
      // This test is testing client-side behavior.
      ExecutionEnvironment.canUseDOM = true;

      var mountCount = 0;
      var numClicks = 0;

      class TestComponent extends React.Component {
        componentDidMount() {
          mountCount++;
        }

        click = () => {
          numClicks++;
        };

        render() {
          return (
            <span ref="span" onClick={this.click}>Name: {this.props.name}</span>
          );
        }
      }

      var element = document.createElement('div');
      ReactDOM.render(<TestComponent />, element);

      var lastMarkup = element.innerHTML;

      // Exercise the update path. Markup should not change,
      // but some lifecycle methods should be run again.
      ReactDOM.render(<TestComponent name="x" />, element);
      expect(mountCount).toEqual(1);

      // Unmount and remount. We should get another mount event and
      // we should get different markup, as the IDs are unique each time.
      ReactDOM.unmountComponentAtNode(element);
      expect(element.innerHTML).toEqual('');
      ReactDOM.render(<TestComponent name="x" />, element);
      expect(mountCount).toEqual(2);
      expect(element.innerHTML).not.toEqual(lastMarkup);

      // Now kill the node and render it on top of server-rendered markup, as if
      // we used server rendering. We should mount again, but the markup should
      // be unchanged. We will append a sentinel at the end of innerHTML to be
      // sure that innerHTML was not changed.
      ReactDOM.unmountComponentAtNode(element);
      expect(element.innerHTML).toEqual('');

      ExecutionEnvironment.canUseDOM = false;
      lastMarkup = ReactDOMServer.renderToString(
        <TestComponent name="x" />
      );
      ExecutionEnvironment.canUseDOM = true;
      element.innerHTML = lastMarkup;

      var instance = ReactDOM.render(<TestComponent name="x" />, element);
      expect(mountCount).toEqual(3);

      var expectedMarkup = lastMarkup;
      if (ReactDOMFeatureFlags.useFiber) {
        var reactMetaData = /\s+data-react[a-z-]+="[^"]*"/g;
        var reactComments = /<!-- \/?react-text(: \d+)? -->/g;
        expectedMarkup =
          expectedMarkup
          .replace(reactMetaData, '')
          .replace(reactComments, '');
      }
      expect(element.innerHTML).toBe(expectedMarkup);

      // Ensure the events system works after mount into server markup
      expect(numClicks).toEqual(0);
      ReactTestUtils.Simulate.click(ReactDOM.findDOMNode(instance.refs.span));
      expect(numClicks).toEqual(1);

      ReactDOM.unmountComponentAtNode(element);
      expect(element.innerHTML).toEqual('');

      // Now simulate a situation where the app is not idempotent. React should
      // warn but do the right thing.
      element.innerHTML = lastMarkup;
      spyOn(console, 'error');
      instance = ReactDOM.render(<TestComponent name="y" />, element);
      expect(mountCount).toEqual(4);
      expectDev(console.error.calls.count()).toBe(1);
      expect(element.innerHTML.length > 0).toBe(true);
      expect(element.innerHTML).not.toEqual(lastMarkup);

      // Ensure the events system works after markup mismatch.
      expect(numClicks).toEqual(1);
      ReactTestUtils.Simulate.click(ReactDOM.findDOMNode(instance.refs.span));
      expect(numClicks).toEqual(2);
    });

    it('should throw with silly args', () => {
      expect(
        ReactDOMServer.renderToString.bind(
          ReactDOMServer,
          'not a component'
        )
      ).toThrowError(
        'renderToString(): You must pass a valid ReactElement.'
      );
    });
  });

  describe('renderToStaticMarkup', () => {
    it('should not put checksum and React ID on components', () => {
      class NestedComponent extends React.Component {
        render() {
          return <div>inner text</div>;
        }
      }

      class TestComponent extends React.Component {
        render() {
          return <span><NestedComponent /></span>;
        }
      }

      var response = ReactDOMServer.renderToStaticMarkup(
        <TestComponent />
      );

      expect(response).toBe('<span><div>inner text</div></span>');
    });

    it('should not put checksum and React ID on text components', () => {
      class TestComponent extends React.Component {
        render() {
          return <span>{'hello'} {'world'}</span>;
        }
      }

      var response = ReactDOMServer.renderToStaticMarkup(
        <TestComponent />
      );

      expect(response).toBe('<span>hello world</span>');
    });

    it('should only execute certain lifecycle methods', () => {
      function runTest() {
        var lifecycle = [];

        class TestComponent extends React.Component {
          constructor(props) {
            super(props);
            lifecycle.push('getInitialState');
            this.state = {name: 'TestComponent'};
          }

          componentWillMount() {
            lifecycle.push('componentWillMount');
          }

          componentDidMount() {
            lifecycle.push('componentDidMount');
          }

          render() {
            lifecycle.push('render');
            return <span>Component name: {this.state.name}</span>;
          }

          componentWillUpdate() {
            lifecycle.push('componentWillUpdate');
          }

          componentDidUpdate() {
            lifecycle.push('componentDidUpdate');
          }

          shouldComponentUpdate() {
            lifecycle.push('shouldComponentUpdate');
          }

          componentWillReceiveProps() {
            lifecycle.push('componentWillReceiveProps');
          }

          componentWillUnmount() {
            lifecycle.push('componentWillUnmount');
          }
        }

        var response = ReactDOMServer.renderToStaticMarkup(
          <TestComponent />
        );

        expect(response).toBe('<span>Component name: TestComponent</span>');
        expect(lifecycle).toEqual(
          ['getInitialState', 'componentWillMount', 'render']
        );
      }

      runTest();

      // This should work the same regardless of whether you can use DOM or not.
      ExecutionEnvironment.canUseDOM = true;
      runTest();
    });

    it('should throw with silly args', () => {
      expect(
        ReactDOMServer.renderToStaticMarkup.bind(
          ReactDOMServer,
          'not a component'
        )
      ).toThrowError(
        'renderToStaticMarkup(): You must pass a valid ReactElement.'
      );
    });

    it('allows setState in componentWillMount without using DOM', () => {
      class Component extends React.Component {
        componentWillMount() {
          this.setState({text: 'hello, world'});
        }

        render() {
          return <div>{this.state.text}</div>;
        }
      }

      ReactReconcileTransaction.prototype.perform = function() {
        // We shouldn't ever be calling this on the server
        throw new Error('Browser reconcile transaction should not be used');
      };
      var markup = ReactDOMServer.renderToString(
        <Component />
      );
      expect(markup.indexOf('hello, world') >= 0).toBe(true);
    });

    it('renders components with different batching strategies', () => {
      class StaticComponent extends React.Component {
        render() {
          const staticContent = ReactDOMServer.renderToStaticMarkup(
            <div>
              <img src="foo-bar.jpg" />
            </div>
          );
          return <div dangerouslySetInnerHTML={{__html: staticContent}} />;
        }
      }

      class Component extends React.Component {
        componentWillMount() {
          this.setState({text: 'hello, world'});
        }

        render() {
          return <div>{this.state.text}</div>;
        }
      }

      expect(
        ReactDOMServer.renderToString.bind(
          ReactDOMServer,
          <div>
            <StaticComponent />
            <Component />
          </div>
        )
      ).not.toThrow();
    });
  });

  it('warns with a no-op when an async setState is triggered', () => {
    class Foo extends React.Component {
      componentWillMount() {
        this.setState({text: 'hello'});
        setTimeout(() => {
          this.setState({text: 'error'});
        });
      }
      render() {
        return <div onClick={() => {}}>{this.state.text}</div>;
      }
    }

    spyOn(console, 'error');
    ReactDOMServer.renderToString(<Foo />);
    jest.runOnlyPendingTimers();
    expectDev(console.error.calls.count()).toBe(1);
    expectDev(console.error.calls.mostRecent().args[0]).toBe(
      'Warning: setState(...): Can only update a mounting component.' +
      ' This usually means you called setState() outside componentWillMount() on the server.' +
      ' This is a no-op.\n\nPlease check the code for the Foo component.'
    );
    var markup = ReactDOMServer.renderToStaticMarkup(<Foo />);
    expect(markup).toBe('<div>hello</div>');
  });

  it('warns with a no-op when an async replaceState is triggered', () => {
    var Bar = React.createClass({
      componentWillMount: function() {
        this.replaceState({text: 'hello'});
        setTimeout(() => {
          this.replaceState({text: 'error'});
        });
      },
      render: function() {
        return <div onClick={() => {}}>{this.state.text}</div>;
      },
    });

    spyOn(console, 'error');
    ReactDOMServer.renderToString(<Bar />);
    jest.runOnlyPendingTimers();
    expectDev(console.error.calls.count()).toBe(1);
    expectDev(console.error.calls.mostRecent().args[0]).toBe(
      'Warning: replaceState(...): Can only update a mounting component. ' +
      'This usually means you called replaceState() outside componentWillMount() on the server. ' +
      'This is a no-op.\n\nPlease check the code for the Bar component.'
    );
    var markup = ReactDOMServer.renderToStaticMarkup(<Bar />);
    expect(markup).toBe('<div>hello</div>');
  });

  it('warns with a no-op when an async forceUpdate is triggered', () => {
    class Baz extends React.Component {
      componentWillMount() {
        this.forceUpdate();
        setTimeout(() => {
          this.forceUpdate();
        });
      }

      render() {
        return <div onClick={() => {}} />;
      }
    }

    spyOn(console, 'error');
    ReactDOMServer.renderToString(<Baz />);
    jest.runOnlyPendingTimers();
    expectDev(console.error.calls.count()).toBe(1);
    expectDev(console.error.calls.mostRecent().args[0]).toBe(
      'Warning: forceUpdate(...): Can only update a mounting component. ' +
      'This usually means you called forceUpdate() outside componentWillMount() on the server. ' +
      'This is a no-op.\n\nPlease check the code for the Baz component.'
    );
    var markup = ReactDOMServer.renderToStaticMarkup(<Baz />);
    expect(markup).toBe('<div></div>');
  });

  it('should warn when children are mutated during render', () => {
    spyOn(console, 'error');
    function Wrapper(props) {
      props.children[1] = <p key={1} />; // Mutation is illegal
      return <div>{props.children}</div>;
    }
    expect(() => {
      ReactDOMServer.renderToStaticMarkup(
        <Wrapper>
          <span key={0}/>
          <span key={1}/>
          <span key={2}/>
        </Wrapper>
      );
    }).toThrowError(/Cannot assign to read only property.*/);
  });

  describe('basic element rendering', function() {
    itRenders('should render a blank div', render =>
      render(<div/>).then(e => expect(e.tagName.toLowerCase()).toBe('div')));

    itRenders('should render a div with inline styles', render =>
      render(<div style={{color:'red', width:'30px'}}/>).then(e => {
        expect(e.style.color).toBe('red');
        expect(e.style.width).toBe('30px');
      })
    );

    itRenders('should render a self-closing tag', render =>
      render(<br/>).then(e => expect(e.tagName.toLowerCase()).toBe('br')));

    itRenders('should render a self-closing tag as a child', render =>
      render(<div><br/></div>).then(e => {
        expect(e.childNodes.length).toBe(1);
        expect(e.firstChild.tagName.toLowerCase()).toBe('br');
      })
    );
  });

  describe('property to attribute mapping', function() {
    describe('string properties', function() {
      itRenders('renders simple numbers', (render) => {
        return render(<div width={30}/>).then(e => expect(e.getAttribute('width')).toBe('30'));
      });

      itRenders('renders simple strings', (render) => {
        return render(<div width={'30'}/>).then(e => expect(e.getAttribute('width')).toBe('30'));
      });

      // this seems like it might mask programmer error, but it's existing behavior.
      itRenders('renders string prop with true value', render =>
        render(<a href={true}/>).then(e => expect(e.getAttribute('href')).toBe('true')));

      // this seems like it might mask programmer error, but it's existing behavior.
      itRenders('renders string prop with false value', render =>
        render(<a href={false}/>).then(e => expect(e.getAttribute('href')).toBe('false')));

      // this seems like somewhat odd behavior, as it isn't how <a html> works
      // in HTML, but it's existing behavior.
      itRenders('renders string prop with true value', render =>
        /* eslint-disable react/jsx-boolean-value */
        render(<a href/>).then(e => expect(e.getAttribute('href')).toBe('true')));
        /* eslint-enable react/jsx-boolean-value */
    });

    describe('boolean properties', function() {
      itRenders('renders boolean prop with true value', render =>
        render(<div hidden={true}/>).then(e => expect(e.getAttribute('hidden')).toBe('')));

      itRenders('renders boolean prop with false value', render =>
        render(<div hidden={false}/>).then(e => expect(e.getAttribute('hidden')).toBe(null)));

      itRenders('renders boolean prop with missing value', render => {
        /* eslint-disable react/jsx-boolean-value */
        return render(<div hidden/>).then(e => expect(e.getAttribute('hidden')).toBe(''));
        /* eslint-enable react/jsx-boolean-value */
      });

      itRenders('renders boolean prop with self value', render => {
        return render(<div hidden="hidden"/>).then(e => expect(e.getAttribute('hidden')).toBe(''));
      });

      // this does not seem like correct behavior, since hidden="" in HTML indicates
      // that the boolean property is present. however, it is how the current code
      // behaves, so the test is included here.
      itRenders('renders boolean prop with "" value', render =>
        render(<div hidden=""/>).then(e => expect(e.getAttribute('hidden')).toBe(null)));

      // this seems like it might mask programmer error, but it's existing behavior.
      itRenders('renders boolean prop with string value', render =>
        render(<div hidden="foo"/>).then(e => expect(e.getAttribute('hidden')).toBe('')));

      // this seems like it might mask programmer error, but it's existing behavior.
      itRenders('renders boolean prop with array value', render =>
        render(<div hidden={['foo', 'bar']}/>).then(e => expect(e.getAttribute('hidden')).toBe('')));

      // this seems like it might mask programmer error, but it's existing behavior.
      itRenders('renders boolean prop with object value', render =>
        render(<div hidden={{foo:'bar'}}/>).then(e => expect(e.getAttribute('hidden')).toBe('')));

      // this seems like it might mask programmer error, but it's existing behavior.
      itRenders('renders boolean prop with non-zero number value', render =>
        render(<div hidden={10}/>).then(e => expect(e.getAttribute('hidden')).toBe('')));

      // this seems like it might mask programmer error, but it's existing behavior.
      itRenders('renders boolean prop with zero value', render =>
        render(<div hidden={0}/>).then(e => expect(e.getAttribute('hidden')).toBe(null)));
    });

    describe('download property (combined boolean/string attribute)', function() {
      itRenders('handles download prop with true value', render =>
        render(<a download={true}/>).then(e => expect(e.getAttribute('download')).toBe('')));

      itRenders('handles download prop with false value', render =>
        render(<a download={false}/>).then(e => expect(e.getAttribute('download')).toBe(null)));

      itRenders('handles download prop with no value', render =>
        /* eslint-disable react/jsx-boolean-value */
        render(<a download/>).then(e => expect(e.getAttribute('download')).toBe('')));
        /* eslint-enable react/jsx-boolean-value */

      itRenders('handles download prop with string value', render =>
        render(<a download="myfile"/>).then(e => expect(e.getAttribute('download')).toBe('myfile')));

      itRenders('handles download prop with string "true" value', render =>
        render(<a download={'true'}/>).then(e => expect(e.getAttribute('download')).toBe('true')));
    });

    describe('className property', function() {
      itRenders('renders className prop with string value', render =>
        render(<div className="myClassName"/>).then(e => expect(e.getAttribute('class')).toBe('myClassName')));

      itRenders('renders className prop with empty string value', render =>
        render(<div className=""/>).then(e => expect(e.getAttribute('class')).toBe('')));

      // this probably is just masking programmer error, but it is existing behavior.
      itRenders('renders className prop with true value', render =>
        render(<div className={true}/>).then(e => expect(e.getAttribute('class')).toBe('true')));

      // this probably is just masking programmer error, but it is existing behavior.
      itRenders('renders className prop with false value', render =>
        render(<div className={false}/>).then(e => expect(e.getAttribute('class')).toBe('false')));

      // this probably is just masking programmer error, but it is existing behavior.
      /* eslint-disable react/jsx-boolean-value */
      itRenders('renders className prop with false value', render =>
        render(<div className/>).then(e => expect(e.getAttribute('class')).toBe('true')));
      /* eslint-enable react/jsx-boolean-value */
    });

    describe('htmlFor property', function() {
      itRenders('renders htmlFor with string value', render =>
        render(<div htmlFor="myFor"/>).then(e => expect(e.getAttribute('for')).toBe('myFor')));

      itRenders('renders htmlFor with an empty string', render =>
        render(<div htmlFor=""/>).then(e => expect(e.getAttribute('for')).toBe('')));

      // this probably is just masking programmer error, but it is existing behavior.
      itRenders('renders className prop with true value', render =>
        render(<div htmlFor={true}/>).then(e => expect(e.getAttribute('for')).toBe('true')));

      // this probably is just masking programmer error, but it is existing behavior.
      itRenders('renders className prop with false value', render =>
        render(<div htmlFor={false}/>).then(e => expect(e.getAttribute('for')).toBe('false')));

      // this probably is just masking programmer error, but it is existing behavior.
      /* eslint-disable react/jsx-boolean-value */
      itRenders('renders className prop with false value', render =>
        render(<div htmlFor/>).then(e => expect(e.getAttribute('for')).toBe('true')));
      /* eslint-enable react/jsx-boolean-value */

    });

    describe('props with special meaning in React', function() {
      itRenders('does not render ref property as an attribute', render => {
        class RefComponent extends React.Component {
          render() {
            return <div ref="foo"/>;
          }
        }
        return render(<RefComponent/>).then(e => expect(e.getAttribute('ref')).toBe(null));
      });

      itRenders('does not render children property as an attribute', render =>
        render(React.createElement('div', {}, 'foo')).then(e => expect(e.getAttribute('children')).toBe(null)));

      itRenders('does not render key property as an attribute', render =>
        render(<div key="foo"/>).then(e => expect(e.getAttribute('key')).toBe(null)));

      itRenders('does not render dangerouslySetInnerHTML as an attribute', render =>
        render(<div dangerouslySetInnerHTML={{__html:'foo'}}/>)
          .then(e => expect(e.getAttribute('dangerouslySetInnerHTML')).toBe(null)));
    });

    describe('unknown attributes', function() {
      itRenders('does not render unknown attributes', render =>
        render(<div foo="bar"/>, 1).then(e => expect(e.getAttribute('foo')).toBe(null)));

      itRenders('does render unknown data- attributes', render =>
        render(<div data-foo="bar"/>).then(e => expect(e.getAttribute('data-foo')).toBe('bar')));

      itRenders('does not render unknown attributes for non-standard elements', render =>
        render(<nonstandard foo="bar"/>, 1).then(e => expect(e.getAttribute('foo')).toBe(null)));

      itRenders('does render unknown attributes for custom elements', render =>
        render(<custom-element foo="bar"/>).then(e => expect(e.getAttribute('foo')).toBe('bar')));

      itRenders('does render unknown attributes for custom elements using is', render =>
        render(<div is="custom-element" foo="bar"/>).then(e => expect(e.getAttribute('foo')).toBe('bar')));
    });

    itRenders('does not render HTML events', render =>
      render(<div onClick={() => {}}/>).then(e => {
        expect(e.getAttribute('onClick')).toBe(null);
        expect(e.getAttribute('onClick')).toBe(null);
        expect(e.getAttribute('click')).toBe(null);
      })
    );
  });

  describe('components and children', function() {
    function expectNode(node, type, value) {
      expect(node).not.toBe(null);
      expect(node.nodeType).toBe(type);
      expect(node.nodeValue).toMatch(value);
    }

    function expectTextNode(node, text) {
      expectNode(node, COMMENT_NODE_TYPE, / react-text: [0-9]+ /);
      if (text.length > 0) {
        node = node.nextSibling;
        expectNode(node, TEXT_NODE_TYPE, text);
      }
      expectNode(node.nextSibling, COMMENT_NODE_TYPE, / \/react-text /);
    }

    function expectEmptyNode(node) {
      expectNode(node, COMMENT_NODE_TYPE, / react-empty: [0-9]+ /);
    }

    describe('elements with text children', function() {
      itRenders('renders a div with text', render =>
        render(<div>Text</div>).then(e => {
          expect(e.tagName.toLowerCase()).toBe('div');
          expect(e.childNodes.length).toBe(1);
          expectNode(e.firstChild, TEXT_NODE_TYPE, 'Text');
        }));
      itRenders('renders a div with text with flanking whitespace', render =>
        render(<div>  Text </div>).then(e => {
          expect(e.childNodes.length).toBe(1);
          expectNode(e.childNodes[0], TEXT_NODE_TYPE, '  Text ');
        }));
      itRenders('renders a div with text', render =>
        render(<div>{'Text'}</div>).then(e => {
          expect(e.childNodes.length).toBe(1);
          expectNode(e.firstChild, TEXT_NODE_TYPE, 'Text');
        }));
      itRenders('renders a div with blank text child', render =>
        render(<div>{''}</div>).then(e => {
          expect(e.childNodes.length).toBe(0);
        }));
      itRenders('renders a div with blank text children', render =>
        render(<div>{''}{''}{''}</div>).then(e => {
          expect(e.childNodes.length).toBe(6);
          expectTextNode(e.childNodes[0], '');
          expectTextNode(e.childNodes[2], '');
          expectTextNode(e.childNodes[4], '');
        }));
      itRenders('renders a div with whitespace children', render =>
        render(<div>{' '}{' '}{' '}</div>).then(e => {
          expect(e.childNodes.length).toBe(9);
          expectTextNode(e.childNodes[0], ' ');
          expectTextNode(e.childNodes[3], ' ');
          expectTextNode(e.childNodes[6], ' ');
        }));
      itRenders('renders a div with text sibling to a node', render =>
        render(<div>Text<span>More Text</span></div>).then(e => {
          expect(e.childNodes.length).toBe(4);
          expectTextNode(e.childNodes[0], 'Text');
          expect(e.childNodes[3].tagName.toLowerCase()).toBe('span');
          expect(e.childNodes[3].childNodes.length).toBe(1);
          expectNode(e.childNodes[3].firstChild, TEXT_NODE_TYPE, 'More Text');
        }));
      itRenders('renders a non-standard element with text', render =>
        render(<nonstandard>Text</nonstandard>).then(e => {
          expect(e.tagName.toLowerCase()).toBe('nonstandard');
          expect(e.childNodes.length).toBe(1);
          expectNode(e.firstChild, TEXT_NODE_TYPE, 'Text');
        }));
      itRenders('renders a custom element with text', render =>
        render(<custom-element>Text</custom-element>).then(e => {
          expect(e.tagName.toLowerCase()).toBe('custom-element');
          expect(e.childNodes.length).toBe(1);
          expectNode(e.firstChild, TEXT_NODE_TYPE, 'Text');
        }));
      itRenders('renders leading blank children with comments when there are multiple children', (render) => {
        return render(<div>{''}foo</div>).then(e => {
          expect(e.childNodes.length).toBe(5);
          expectTextNode(e.childNodes[0], '');
          expectTextNode(e.childNodes[2], 'foo');
        });
      });

      itRenders('renders trailing blank children with comments when there are multiple children', (render) => {
        return render(<div>foo{''}</div>).then(e => {
          expect(e.childNodes.length).toBe(5);
          expectTextNode(e.childNodes[0], 'foo');
          expectTextNode(e.childNodes[3], '');
        });
      });

      itRenders('renders an element with just one text child without comments', (render) => {
        return render(<div>foo</div>).then(e => {
          expect(e.childNodes.length).toBe(1);
          expectNode(e.firstChild, TEXT_NODE_TYPE, 'foo');
        });
      });

      itRenders('renders an element with two text children with comments', (render) => {
        return render(<div>{'foo'}{'bar'}</div>).then(e => {
          expect(e.childNodes.length).toBe(6);
          expectTextNode(e.childNodes[0], 'foo');
          expectTextNode(e.childNodes[3], 'bar');
        });
      });
    });

    describe('elements with number children', function() {
      itRenders('renders a number as single child',
        render => render(<div>{3}</div>).then(e => expect(e.textContent).toBe('3')));

      // zero is falsey, so it could look like no children if the code isn't careful.
      itRenders('renders zero as single child',
        render => render(<div>{0}</div>).then(e => expect(e.textContent).toBe('0')));

      itRenders('renders an element with number and text children with comments', (render) => {
        return render(<div>{'foo'}{40}</div>).then(e => {
          expect(e.childNodes.length).toBe(6);
          expectTextNode(e.childNodes[0], 'foo');
          expectTextNode(e.childNodes[3], '40');
        });
      });
    });

    describe('null, false, and undefined children', function() {
      itRenders('renders null single child as blank',
        render => render(<div>{null}</div>).then(e => expect(e.childNodes.length).toBe(0)));
      itRenders('renders false single child as blank',
        render => render(<div>{false}</div>).then(e => expect(e.childNodes.length).toBe(0)));
      itRenders('renders undefined single child as blank',
        render => render(<div>{undefined}</div>).then(e => expect(e.childNodes.length).toBe(0)));
      itRenders('renders a null component as empty', (render) => {
        const NullComponent = () => null;
        return render(<NullComponent/>).then(e => expectEmptyNode(e));
      });

      itRenders('renders a null component children as empty', (render) => {
        const NullComponent = () => null;
        return render(<div><NullComponent/></div>).then(e => {
          expect(e.childNodes.length).toBe(1);
          expectEmptyNode(e.firstChild);
        });
      });

      itRenders('renders a false component as empty', (render) => {
        const FalseComponent = () => false;
        return render(<FalseComponent />).then(e => expectEmptyNode(e));
      });

      itRenders('renders null children as blank', (render) => {
        return render(<div>{null}foo</div>).then(e => {
          expect(e.childNodes.length).toBe(3);
          expectTextNode(e.childNodes[0], 'foo');
        });
      });

      itRenders('renders false children as blank', (render) => {
        return render(<div>{false}foo</div>).then(e => {
          expect(e.childNodes.length).toBe(3);
          expectTextNode(e.childNodes[0], 'foo');
        });
      });

      itRenders('renders null and false children together as blank', (render) => {
        return render(<div>{false}{null}foo{null}{false}</div>).then(e => {
          expect(e.childNodes.length).toBe(3);
          expectTextNode(e.childNodes[0], 'foo');
        });
      });

      itRenders('renders only null and false children as blank', (render) => {
        return render(<div>{false}{null}{null}{false}</div>).then(e => {
          expect(e.childNodes.length).toBe(0);
        });
      });
    });

    describe('elements with implicit namespaces', function() {
      itRenders('renders an svg element', render =>
        render(<svg/>).then(e => {
          expect(e.childNodes.length).toBe(0);
          expect(e.tagName.toLowerCase()).toBe('svg');
          expect(e.namespaceURI).toBe('http://www.w3.org/2000/svg');
        }));
      itRenders('renders svg element with an xlink', render =>
        render(<svg><image xlinkHref="http://i.imgur.com/w7GCRPb.png"/></svg>).then(e => {
          e = e.firstChild;
          expect(e.childNodes.length).toBe(0);
          expect(e.tagName.toLowerCase()).toBe('image');
          expect(e.namespaceURI).toBe('http://www.w3.org/2000/svg');
          expect(e.getAttributeNS('http://www.w3.org/1999/xlink', 'href')).toBe('http://i.imgur.com/w7GCRPb.png');
        }));
      itRenders('renders a math element', render =>
        render(<math/>).then(e => {
          expect(e.childNodes.length).toBe(0);
          expect(e.tagName.toLowerCase()).toBe('math');
          expect(e.namespaceURI).toBe('http://www.w3.org/1998/Math/MathML');
        }));
    });
    // specially wrapped components
    // (see the big switch near the beginning ofReactDOMComponent.mountComponent)
    itRenders('renders an img', render =>
      render(<img/>).then(e => {
        expect(e.childNodes.length).toBe(0);
        expect(e.nextSibling).toBe(null);
        expect(e.tagName.toLowerCase()).toBe('img');
      }));
    itRenders('renders a button', render =>
      render(<button/>).then(e => {
        expect(e.childNodes.length).toBe(0);
        expect(e.nextSibling).toBe(null);
        expect(e.tagName.toLowerCase()).toBe('button');
      }));

    itRenders('renders a div with dangerouslySetInnerHTML',
      render => render(<div dangerouslySetInnerHTML={{__html:"<span id='child'/>"}}/>).then(e => {
        expect(e.childNodes.length).toBe(1);
        expect(e.firstChild.tagName.toLowerCase()).toBe('span');
        expect(e.firstChild.getAttribute('id')).toBe('child');
        expect(e.firstChild.childNodes.length).toBe(0);
      }));

    describe('newline-eating elements', function() {
      itRenders('renders a newline-eating tag with content not starting with \\n',
        render => render(<pre>Hello</pre>).then(e => expect(e.textContent).toBe('Hello')));
      itRenders('renders a newline-eating tag with content starting with \\n',
        render => render(<pre>{'\nHello'}</pre>).then(e => expect(e.textContent).toBe('\nHello')));
      itRenders('renders a normal tag with content starting with \\n',
        render => render(<div>{'\nHello'}</div>).then(e => expect(e.textContent).toBe('\nHello')));
    });

    describe('different component implementations', function() {
      function checkFooDiv(e) {
        expect(e.childNodes.length).toBe(1);
        expectNode(e.firstChild, TEXT_NODE_TYPE, 'foo');
      }

      itRenders('renders stateless components', render => {
        const StatelessComponent = () => <div>foo</div>;
        return render(<StatelessComponent/>).then(checkFooDiv);
      });

      itRenders('renders React.createClass components', render => {
        const RccComponent = React.createClass({
          render: function() {
            return <div>foo</div>;
          },
        });
        return render(<RccComponent/>).then(checkFooDiv);
      });

      itRenders('renders ES6 class components', render => {
        class ClassComponent extends React.Component {
          render() {
            return <div>foo</div>;
          }
        }
        return render(<ClassComponent/>).then(checkFooDiv);
      });

      itRenders('renders factory components', render => {
        const FactoryComponent = () => {
          return {
            render: function() {
              return <div>foo</div>;
            },
          };
        };
        return render(<FactoryComponent/>).then(checkFooDiv);
      });
    });

    describe('component hierarchies', function() {
      itRenders('renders single child hierarchies of components', render => {
        const Component = (props) => <div>{props.children}</div>;
        return render(
          <Component>
            <Component>
              <Component>
                <Component/>
              </Component>
            </Component>
          </Component>)
          .then(element => {
            for (var i = 0; i < 3; i++) {
              expect(element.tagName.toLowerCase()).toBe('div');
              expect(element.childNodes.length).toBe(1);
              element = element.firstChild;
            }
            expect(element.tagName.toLowerCase()).toBe('div');
            expect(element.childNodes.length).toBe(0);
          });
      });

      itRenders('renders multi-child hierarchies of components', render => {
        const Component = (props) => <div>{props.children}</div>;
        return render(
          <Component>
            <Component>
              <Component/><Component/>
            </Component>
            <Component>
              <Component/><Component/>
            </Component>
          </Component>)
          .then(element => {
            expect(element.tagName.toLowerCase()).toBe('div');
            expect(element.childNodes.length).toBe(2);
            for (var i = 0; i < 2; i++) {
              var child = element.childNodes[i];
              expect(child.tagName.toLowerCase()).toBe('div');
              expect(child.childNodes.length).toBe(2);
              for (var j = 0; j < 2; j++) {
                var grandchild = child.childNodes[j];
                expect(grandchild.tagName.toLowerCase()).toBe('div');
                expect(grandchild.childNodes.length).toBe(0);
              }
            }
          });
      });

      itRenders('renders a div with a child', render =>
        render(<div id="parent"><div id="child"/></div>).then(e => {
          expect(e.id).toBe('parent');
          expect(e.childNodes.length).toBe(1);
          expect(e.childNodes[0].id).toBe('child');
          expect(e.childNodes[0].childNodes.length).toBe(0);
        }));
      itRenders('renders a div with multiple children', render =>
        render(<div id="parent"><div id="child1"/><div id="child2"/></div>).then(e => {
          expect(e.id).toBe('parent');
          expect(e.childNodes.length).toBe(2);
          expect(e.childNodes[0].id).toBe('child1');
          expect(e.childNodes[0].childNodes.length).toBe(0);
          expect(e.childNodes[1].id).toBe('child2');
          expect(e.childNodes[1].childNodes.length).toBe(0);
        }));
      itRenders('renders a div with multiple children separated by whitespace', render =>
        render(<div id="parent"><div id="child1"/> <div id="child2"/></div>).then(e => {
          expect(e.id).toBe('parent');
          expect(e.childNodes.length).toBe(5);
          expect(e.childNodes[0].id).toBe('child1');
          expect(e.childNodes[0].childNodes.length).toBe(0);
          expectTextNode(e.childNodes[1], ' ');
          expect(e.childNodes[4].id).toBe('child2');
          expect(e.childNodes[4].childNodes.length).toBe(0);
        }));
      itRenders('renders a div with a child surrounded by whitespace', render =>
        render(<div id="parent">  <div id="child"/>   </div>).then(e => { // eslint-disable-line no-multi-spaces
          expect(e.id).toBe('parent');
          expect(e.childNodes.length).toBe(7);
          expectTextNode(e.childNodes[0], '  ');
          expect(e.childNodes[3].id).toBe('child');
          expect(e.childNodes[3].childNodes.length).toBe(0);
          expectTextNode(e.childNodes[4], '   ');
        }));
    });

    describe('escaping >, <, and &', function() {
      itRenders('escapes >,<, and & as single child', render => {
        return render(<div>{'<span>Text&quot;</span>'}</div>).then(e => {
          expect(e.childNodes.length).toBe(1);
          expectNode(e.firstChild, TEXT_NODE_TYPE, '<span>Text&quot;</span>');
        });
      });

      itRenders('escapes >,<, and & as multiple children', render => {
        return render(<div>{'<span>Text1&quot;</span>'}{'<span>Text2&quot;</span>'}</div>).then(e => {
          expect(e.childNodes.length).toBe(6);
          expectTextNode(e.childNodes[0], '<span>Text1&quot;</span>');
          expectTextNode(e.childNodes[3], '<span>Text2&quot;</span>');
        });
      });
    });

    describe('components that throw errors', function() {
      itThrowsOnRender('throws rendering a string component', (render) => {
        const StringComponent = () => 'foo';
        return render(<StringComponent/>, 1);
      });

      itThrowsOnRender('throws rendering an undefined component', (render) => {
        const UndefinedComponent = () => undefined;
        return render(<UndefinedComponent/>, 1);
      });

      itThrowsOnRender('throws rendering a number component', (render) => {
        const NumberComponent = () => 54;
        return render(<NumberComponent/>, 1);
      });

      itThrowsOnRender('throws when rendering null', render => render(null));
      itThrowsOnRender('throws when rendering false', render => render(false));
      itThrowsOnRender('throws when rendering undefined', render => render(undefined));
      itThrowsOnRender('throws when rendering number', render => render(30));
      itThrowsOnRender('throws when rendering string', render => render('foo'));
    });
  });

  describe('form controls', function() {
    describe('inputs', function() {
      itRenders('can render an input with a value', (render) => {
        return Promise.all([
          render(<input value="foo" onChange={() => {}}/>).then(e =>
            expect(e.getAttribute('value') || e.value).toBe('foo')),
          render(<input value="foo" readOnly={true}/>).then(e =>
            expect(e.getAttribute('value') || e.value).toBe('foo')),
        ]);
      });

      itRenders('can render an input with a value and no onChange/readOnly', render => {
        return render(<input value="foo"/>, 1)
          .then(element => expect(element.getAttribute('value') || element.value).toBe('foo'));
      });

      itRenders('can render an input with a defaultValue', (render) => {
        return render(<input defaultValue="foo"/>).then(e => {
          expect(e.getAttribute('value') || e.value).toBe('foo');
          expect(e.getAttribute('defaultValue')).toBe(null);
        });
      });

      itRenders('can render an input with both a value and defaultValue part 1', render => {
        return render(<input value="foo" defaultValue="bar" readOnly={true}/>, 1)
          .then(element => {
            expect(element.getAttribute('value') || element.value).toBe('foo');
            expect(element.getAttribute('defaultValue')).toBe(null);
          });
      });

      itRenders('can render an input with both a value and defaultValue part 2', render => {
        return render(<input defaultValue="bar" value="foo" readOnly={true}/>, 1)
          .then(element => {
            expect(element.getAttribute('value') || element.value).toBe('foo');
            expect(element.getAttribute('defaultValue')).toBe(null);
          });
      });
    });

    describe('checkboxes', function() {
      itRenders('can render a checkbox that is checked', (render) => {
        return Promise.all([
          render(<input type="checkbox" checked={true} onChange={() => {}}/>)
            .then(e => expect(e.checked).toBe(true)),
          render(<input type="checkbox" checked={true} readOnly={true}/>)
            .then(e => expect(e.checked).toBe(true)),
        ]);
      });

      itRenders('can render a checkbox that is checked and no onChange/readOnly', render => {
        return render(<input type="checkbox" checked={true}/>, 1)
          .then(element => expect(element.checked).toBe(true));
      });

      itRenders('can render a checkbox with defaultChecked', (render) => {
        return render(<input type="checkbox" defaultChecked={true}/>).then(e => {
          expect(e.checked).toBe(true);
          expect(e.getAttribute('defaultChecked')).toBe(null);
        });
      });

      itRenders('can render a checkbox with both a checked and defaultChecked part 1', render => {
        return render(<input type="checkbox" checked={true} defaultChecked={false} readOnly={true}/>, 1)
          .then(element => {
            expect(element.checked).toBe(true);
            expect(element.getAttribute('defaultChecked')).toBe(null);
          });
      });

      itRenders('can render a checkbox with both a checked and defaultChecked part 2', render => {
        return render(<input type="checkbox" defaultChecked={false} checked={true} readOnly={true}/>, 1)
          .then(element => {
            expect(element.checked).toBe(true);
            expect(element.getAttribute('defaultChecked')).toBe(null);
          });
      });
    });

    describe('textareas', function() {
      // textareas
      // ---------
      itRenders('can render a textarea with a value', (render) => {
        return Promise.all([
          render(<textarea value="foo" onChange={() => {}}/>).then(e => {
            expect(e.getAttribute('value')).toBe(null);
            expect(e.value).toBe('foo');
          }),
          render(<textarea value="foo" readOnly={true}/>).then(e => {
            expect(e.getAttribute('value')).toBe(null);
            expect(e.value).toBe('foo');
          }),
        ]);
      });

      itRenders('can render a textarea with a value and no onChange/readOnly', render => {
        return render(<textarea value="foo"/>, 1)
          .then(element => {
            expect(element.getAttribute('value')).toBe(null);
            expect(element.value).toBe('foo');
          });
      });

      itRenders('can render a textarea with a defaultValue', (render) => {
        return render(<textarea defaultValue="foo"/>).then(e => {
          expect(e.getAttribute('value')).toBe(null);
          expect(e.getAttribute('defaultValue')).toBe(null);
          expect(e.value).toBe('foo');
        });
      });

      itRenders('can render a textarea with both a value and defaultValue part 1', render => {
        return render(<textarea value="foo" defaultValue="bar" readOnly={true}/>, 1)
          .then(element => {
            expect(element.getAttribute('value')).toBe(null);
            expect(element.getAttribute('defaultValue')).toBe(null);
            expect(element.value).toBe('foo');
          });
      });

      itRenders('can render a textarea with both a value and defaultValue part 2', render => {
        return render(<textarea defaultValue="bar" value="foo" readOnly={true}/>, 1)
          .then(element => {
            expect(element.getAttribute('value')).toBe(null);
            expect(element.getAttribute('defaultValue')).toBe(null);
            expect(element.value).toBe('foo');
          });
      });
    });

    describe('selects', function() {
      var options;
      beforeEach(function() {
        options = [
          <option key={1} value="foo" id="foo">Foo</option>,
          <option key={2} value="bar" id="bar">Bar</option>,
          <option key={3} value="baz" id="baz">Baz</option>,
        ];
      });

      const expectSelectValue = (element, selected) => {
        // the select shouldn't have a value or defaultValue attribute.
        expect(element.getAttribute('value')).toBe(null);
        expect(element.getAttribute('defaultValue')).toBe(null);

        ['foo', 'bar', 'baz'].forEach((value) => {
          const selectedValue = (selected.indexOf(value) !== -1);
          var option = element.querySelector(`#${value}`);
          expect(option.selected).toBe(selectedValue);
        });
      };
      itRenders('can render a select with a value', (render) => {
        return Promise.all([
          render(<select value="bar" onChange={() => {}}>{options}</select>)
            .then(e => expectSelectValue(e, ['bar'])),
          render(<select value="bar" readOnly={true}>{options}</select>)
            .then(e => expectSelectValue(e, ['bar'])),
          render(<select value={['bar', 'baz']} multiple={true} readOnly={true}>{options}</select>)
            .then(e => expectSelectValue(e, ['bar', 'baz'])),
        ]);
      });

      itRenders('can render a select with a value and no onChange/readOnly', render => {
        return render(<select value="bar">{options}</select>, 1)
          .then(element => expectSelectValue(element, ['bar']));
      });

      itRenders('can render a select with a defaultValue', (render) => {
        return render(<select defaultValue="bar">{options}</select>)
          .then(e => expectSelectValue(e, ['bar']));
      });

      itRenders('can render a select with both a value and defaultValue part 1', render => {
        return render(<select value="bar" defaultValue="baz" readOnly={true}>{options}</select>, 1)
          .then(element => expectSelectValue(element, ['bar']));
      });

      itRenders('can render a select with both a value and defaultValue part 2', render => {
        return render(<select defaultValue="baz" value="bar" readOnly={true}>{options}</select>, 1)
          .then(element => expectSelectValue(element, ['bar']));
      });
    });

    // helper function that creates a controlled input
    const getControlledFieldClass = (initialValue, onChange = () => {}, TagName = 'input',
      valueKey = 'value', extraProps = {}, children = null) => {
      return class ControlledField extends React.Component {
        constructor() {
          super();
          this.state = {[valueKey]: initialValue};
        }
        handleChange(event) {
          onChange(event);
          this.setState({[valueKey]: event.target[valueKey]});
        }
        render() {
          return (<TagName type="text"
            {...{[valueKey]: this.state[valueKey]}}
            onChange={this.handleChange.bind(this)}
            {...extraProps}>{children}</TagName>);
        }
      };
    };

    describe('user interaction with controlled inputs', function() {
      const testControlledField = (render, initialValue, changedValue, TagName = 'input',
        valueKey = 'value', extraProps = {}, children = null) => {

        let changeCount = 0;
        const ControlledField = getControlledFieldClass(
          initialValue, () => changeCount++, TagName, valueKey, extraProps, children
        );

        return render(<ControlledField/>).then(e => {
          expect(changeCount).toBe(0);
          expect(e[valueKey]).toBe(initialValue);

          // simulate a user typing.
          e[valueKey] = changedValue;
          ReactTestUtils.Simulate.change(e);

          expect(changeCount).toBe(1);
          expect(e[valueKey]).toBe(changedValue);
        });
      };

      itClientRenders('should render a controlled text input',
        render => testControlledField(render, 'Hello', 'Goodbye'));

      itClientRenders('should render a controlled textarea',
        render => testControlledField(render, 'Hello', 'Goodbye', 'textarea'));

      itClientRenders('should render a controlled checkbox',
        render => testControlledField(render, true, false, 'input', 'checked', {type:'checkbox'}));

      itClientRenders('should render a controlled select',
        render => testControlledField(render, 'B', 'A', 'select', 'value', {},
          [
            <option key="1" value="A">Option A</option>,
            <option key="2" value="B">Option B</option>,
          ]));
    });

    describe('user interaction with inputs before client render', function() {
      // User interaction before client markup reconnect
      const testFieldWithUserInteractionBeforeClientRender = (
        element, initialValue = 'foo', changedValue = 'bar', valueKey = 'value'
      ) => {
        return serverRender(element).then(field => {
          expect(field[valueKey]).toBe(initialValue);

          // simulate a user typing in the field **before** client-side reconnect happens.
          field[valueKey] = changedValue;

          // reconnect to the server markup.
          return renderIntoDom(element, field.parentNode).then(clientField => {
            // verify that the input field was not replaced.
            expect(clientField).toBe(field);
            expect(clientField[valueKey]).toBe(changedValue);
          });
        });
      };

      it('should not blow away user-entered text on successful reconnect to an uncontrolled input', () => {
        return testFieldWithUserInteractionBeforeClientRender(<input defaultValue="foo"/>, 'foo', 'bar');
      });

      it('should not blow away user-entered text on successful reconnect to a controlled input', () => {
        let changeCount = 0;
        const Component = getControlledFieldClass('foo', () => changeCount++);
        return testFieldWithUserInteractionBeforeClientRender(<Component/>, 'foo', 'bar')
          .then(() => expect(changeCount).toBe(0));
      });

      it('should not blow away user-entered text on successful reconnect to an uncontrolled checkbox', () => {
        return testFieldWithUserInteractionBeforeClientRender(
          <input type="checkbox" defaultChecked={true}/>, true, false, 'checked'
        );
      });

      it('should not blow away user-entered text on successful reconnect to a controlled checkbox', () => {
        let changeCount = 0;
        const Component = getControlledFieldClass(true, () => changeCount++, 'input', 'checked', {type: 'checkbox'});
        return testFieldWithUserInteractionBeforeClientRender(<Component/>, true, false, 'checked')
          .then(() => expect(changeCount).toBe(0));
      });

      it('should not blow away user-entered text on successful reconnect to an uncontrolled textarea', () => {
        return testFieldWithUserInteractionBeforeClientRender(
          <textarea defaultValue="foo"/>, 'foo', 'bar', 'textContent');
      });

      it('should not blow away user-entered text on successful reconnect to a controlled textarea', () => {
        let changeCount = 0;
        const Component = getControlledFieldClass('foo', () => changeCount++, 'textarea', 'value');
        return testFieldWithUserInteractionBeforeClientRender(<Component/>, 'foo', 'bar', 'textContent')
          .then(() => expect(changeCount).toBe(0));
      });
    });
  });

  describe('context', function() {
    itRenders('can render context', (render) => {
      class ClassChildWithContext extends React.Component {
        render() {
          return <div id="classChild">{this.context.text}</div>;
        }
    }
      ClassChildWithContext.contextTypes = {text: React.PropTypes.string};

      function StatelessChildWithContext(props, context) {
        return <div id="statelessChild">{context.text}</div>;
      }
      StatelessChildWithContext.contextTypes = {text: React.PropTypes.string};

      class ClassChildWithoutContext extends React.Component {
        render() {
            // this should render blank; context isn't passed to this component.
          return <div id="classWoChild">{this.context.text}</div>;
        }
      }

      function StatelessChildWithoutContext(props, context) {
        // this should render blank; context isn't passed to this component.
        return <div id="statelessWoChild">{context.text}</div>;
      }

      class ClassChildWithWrongContext extends React.Component {
        render() {
            // this should render blank; context.text isn't passed to this component.
          return <div id="classWrongChild">{this.context.text}</div>;
        }
      }
      ClassChildWithWrongContext.contextTypes = {foo: React.PropTypes.string};

      function StatelessChildWithWrongContext(props, context) {
      // this should render blank; context.text isn't passed to this component.
        return <div id="statelessWrongChild">{context.text}</div>;
      }
      StatelessChildWithWrongContext.contextTypes = {foo: React.PropTypes.string};

      class Parent extends React.Component {
        getChildContext() {
          return {text: 'purple'};
        }
        render() {
          return (
          <div id="parent">
            <ClassChildWithContext/>
            <StatelessChildWithContext/>
            <ClassChildWithWrongContext/>
            <StatelessChildWithWrongContext/>
            <ClassChildWithoutContext/>
            <StatelessChildWithoutContext/>
          </div>);
        }
    }
      Parent.childContextTypes = {text: React.PropTypes.string };

      return render(<Parent/>).then(e => {
        expect(e.querySelector('#classChild').textContent).toBe('purple');
        expect(e.querySelector('#statelessChild').textContent).toBe('purple');
        expect(e.querySelector('#classWoChild').textContent).toBe('');
        expect(e.querySelector('#statelessWoChild').textContent).toBe('');
        expect(e.querySelector('#classWrongChild').textContent).toBe('');
        expect(e.querySelector('#statelessWrongChild').textContent).toBe('');
      });
    });

    itRenders('can pass context through to a grandchild', (render) => {
      class ClassGrandchild extends React.Component {
        render() {
          return <div id="classGrandchild">{this.context.text}</div>;
        }
      }
      ClassGrandchild.contextTypes = {text: React.PropTypes.string};

      function StatelessGrandchild(props, context) {
        return <div id="statelessGrandchild">{context.text}</div>;
      }
      StatelessGrandchild.contextTypes = {text: React.PropTypes.string};

      class Child extends React.Component {
        render() {
          // Child has no contextTypes; contents of #childContext should be a blank string.
          return (
            <div id="child">
              <div id="childContext">{this.context.text}</div>
              <ClassGrandchild/>
              <StatelessGrandchild/>
            </div>);
        }
      }

      class Parent extends React.Component {
        getChildContext() {
          return {text: 'purple'};
        }
        render() {
          return <div id="parent"><Child/></div>;
        }
    }
      Parent.childContextTypes = {text: React.PropTypes.string };

      return render(<Parent/>).then(e => {
        expect(e.querySelector('#childContext').textContent).toBe('');
        expect(e.querySelector('#statelessGrandchild').textContent).toBe('purple');
        expect(e.querySelector('#classGrandchild').textContent).toBe('purple');
      });
    });

    itRenders('should let a child context override a parent context', (render) => {
      class Parent extends React.Component {
        getChildContext() {
          return {text: 'purple'};
        }
        render() {
          return <Child/>;
        }
      }
      Parent.childContextTypes = {text: React.PropTypes.string};

      class Child extends React.Component {
        getChildContext() {
          return {text: 'red'};
        }
        render() {
          return <Grandchild/>;
        }
      }
      Child.childContextTypes = {text: React.PropTypes.string};

      const Grandchild = (props, context) => {
        return <div>{context.text}</div>;
      };
      Grandchild.contextTypes = {text: React.PropTypes.string};

      return render(<Parent/>).then(e => expect(e.textContent).toBe('red'));
    });

    itRenders('should merge a child context with a parent context', (render) => {
      class Parent extends React.Component {
        getChildContext() {
          return {text1: 'purple'};
        }
        render() {
          return <Child/>;
        }
      }
      Parent.childContextTypes = {text1: React.PropTypes.string};

      class Child extends React.Component {
        getChildContext() {
          return {text2: 'red'};
        }
        render() {
          return <Grandchild/>;
        }
      }
      Child.childContextTypes = {text2: React.PropTypes.string};

      const Grandchild = (props, context) => {
        return <div><div id="first">{context.text1}</div><div id="second">{context.text2}</div></div>;
      };
      Grandchild.contextTypes = {text1: React.PropTypes.string, text2: React.PropTypes.string};

      return render(<Parent/>).then(e => {
        expect(e.querySelector('#first').textContent).toBe('purple');
        expect(e.querySelector('#second').textContent).toBe('red');
      });
    });

    itRenders('should run componentWillMount before getChildContext', (render) => {
      class Parent extends React.Component {
        getChildContext() {
          return {text: this.state.text};
        }
        componentWillMount() {
          this.setState({text: 'foo'});
        }
        render() {
          return <Child/>;
        }
      }
      Parent.childContextTypes = {text: React.PropTypes.string};

      const Child = (props, context) => {
        return <div>{context.text}</div>;
      };
      Child.contextTypes = {text: React.PropTypes.string};

      return render(<Parent/>).then(e => expect(e.textContent).toBe('foo'));
    });


    itThrowsOnRender('throws if getChildContext exists without childContextTypes', render => {
      class Component extends React.Component {
        render() {
          return <div/>;
        }
        getChildContext() {
          return {foo: 'bar'};
        }
      }
      return render(<Component/>);
    });

    itThrowsOnRender('throws if getChildContext returns a value not in childContextTypes', render => {
      class Component extends React.Component {
        render() {
          return <div/>;
        }
        getChildContext() {
          return {value1: 'foo', value2: 'bar'};
        }
      }
      Component.childContextTypes = {value1: React.PropTypes.string};
      return render(<Component/>);
    });
  });
});
