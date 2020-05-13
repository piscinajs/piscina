'use strict';

const React = require('react');

class Greeting extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return React.createElement('div', null, 'hello ' + this.props.name);
  }
}

module.exports = Greeting;
