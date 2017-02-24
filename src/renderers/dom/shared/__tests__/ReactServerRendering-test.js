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
    () => Promise.resolve(ReactDOMServer.renderToString(reactElement)),
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
});
